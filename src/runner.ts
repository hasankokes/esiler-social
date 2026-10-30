import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildContent, OUT_DIR, type Built } from "./content.js";
import { loadConfig, p, type Channel, type Config } from "./config.js";
import { log } from "./log.js";
import { MediaLibrary } from "./media/library.js";
import { ensurePlan, markFeatured } from "./planner.js";
import { credentials, publish } from "./publish/index.js";
import { uploadMedia } from "./publish/hosting.js";
import { createRenderer, type Renderer } from "./render/index.js";
import { addDays, channelsFor, isoWeek, localParts, occurrencesBetween, weekStart, zonedTime, type Occurrence } from "./schedule.js";
import { attempts, isPosted, loadState, MAX_ATTEMPTS, prune, recordError, recordPost, saveState, STATE_FILE, type State } from "./state.js";

const MAX_LOOKBACK_DAYS = 30; // state 60 gün tutulur; daha eskiye bakılmaz

// GitHub Actions'ta state değişikliğini hemen repo'ya yaz: iş yarıda kesilse bile tekrar paylaşım olmaz.
function persist(state: State, message: string) {
  saveState(state);
  if (process.env.STATE_PUSH !== "true") return;
  const run = (...args: string[]) => execFileSync("git", args, { cwd: p(), stdio: ["ignore", "pipe", "pipe"] }).toString();
  try {
    run("add", path.relative(p(), STATE_FILE));
    if (!run("status", "--porcelain", path.relative(p(), STATE_FILE)).trim()) return;
    run("commit", "-q", "-m", message);
    for (let i = 0; i < 3; i++) {
      try {
        run("pull", "-q", "--rebase", "origin", "main");
        run("push", "-q", "origin", "HEAD:main");
        return;
      } catch (e) {
        if (i === 2) throw e;
      }
    }
  } catch (e) {
    log.error(`posted_state.json repo'ya yazılamadı: ${(e as Error).message}`);
  }
}

class Session {
  media = new MediaLibrary();
  private renderer?: Renderer;
  async start() {
    await this.media.start();
  }
  async getRenderer() {
    if (!this.renderer) {
      this.renderer = await createRenderer();
      await this.renderer.init();
    }
    return this.renderer;
  }
  async close() {
    await this.renderer?.close();
    await this.media.stop();
  }
}

function pendingChannels(cfg: Config, state: State, occ: Occurrence): Channel[] {
  return channelsFor(cfg, occ.slot).filter((ch) => !isPosted(state, occ.key, ch) && attempts(state, occ.key, ch) < MAX_ATTEMPTS);
}

// Zamanı gelmiş, en az bir kanalda henüz paylaşılmamış slot tekrarları.
export function findDue(cfg: Config, state: State, now: Date) {
  const maxDelayH = cfg.schedule.en_fazla_gecikme_saat;
  const floor = [
    now.getTime() - MAX_LOOKBACK_DAYS * 86400000,
    maxDelayH ? now.getTime() - maxDelayH * 3600000 : 0,
    // Henüz canlıya geçilmediyse (DRY_RUN) son 24 saate bakılır.
    state.yayin_baslangic ? Date.parse(state.yayin_baslangic) : now.getTime() - 86400000,
  ];
  const from = new Date(Math.max(...floor));
  return occurrencesBetween(cfg, from, now).filter((o) => pendingChannels(cfg, state, o).length && !state.paylasimlar[o.key]?.elle);
}

// Workflow'un ağır adımları (ffmpeg kurulumu, render) atlayabilmesi için hızlı kontrol.
export function checkDue(now = new Date()) {
  const cfg = loadConfig();
  const state = loadState();
  if (!credentials()) return 0; // token yoksa zamanlanmış çalıştırmalar bir şey yapmaz
  // DRY_RUN'da state yazılmaz; zamanlanmış çalıştırma her 15 dk aynı içeriği boşuna üretmesin.
  // DRY_RUN testi elle tetiklenir (Actions → Paylaşım → Run workflow).
  if (process.env.DRY_RUN === "true" && process.env.GITHUB_EVENT_NAME === "schedule") return 0;
  if (!state.yayin_baslangic) return 1; // ilk canlı çalıştırma başlangıç zamanını kaydeder
  return findDue(cfg, state, now).length;
}

// ── 15 dakikada bir: zamanı gelmiş ve paylaşılmamış içerikleri yayınla ──
export async function runDue(opts: { now?: Date; dryRun?: boolean }) {
  const cfg = loadConfig();
  const state = loadState();
  const now = opts.now ?? new Date();
  const creds = credentials();
  const dryRun = opts.dryRun || process.env.DRY_RUN === "true" || !creds;
  if (!creds && !opts.dryRun && process.env.DRY_RUN !== "true") log.warn("ACCESS_TOKEN / IG_USER_ID / FB_PAGE_ID tanımlı değil: DRY_RUN modunda çalışılıyor.");
  const tz = cfg.schedule.saat_dilimi;
  const today = localParts(now, tz).date;

  if (!dryRun && !state.yayin_baslangic) {
    state.yayin_baslangic = now.toISOString();
    log.info(`İlk canlı çalıştırma: yayın başlangıcı ${state.yayin_baslangic}. Bundan önceki slotlar geriye dönük paylaşılmaz.`);
    persist(state, "yayın başlangıcı ayarlandı");
  }

  const due = findDue(cfg, state, now);

  if (!due.length) {
    log.info(`Zamanı gelmiş paylaşım yok (${now.toISOString()}).`);
    return;
  }
  log.info(`${due.length} paylaşım sırada: ${due.map((o) => o.key).join(", ")}${dryRun ? " [DRY_RUN]" : ""}`);

  const session = new Session();
  await session.start();
  try {
    for (const occ of due) {
      const channels = pendingChannels(cfg, state, occ);
      let built: Built;
      try {
        const plan = ensurePlan(cfg, state, occ);
        if (!dryRun) persist(state, `plan: ${occ.key}`);
        built = await buildContent({ cfg, state, media: session.media, renderer: await session.getRenderer(), outDir: OUT_DIR }, occ, plan);
        log.info(`${occ.key}: üretildi → ${built.summary} (${built.files.length} dosya)`);
      } catch (e) {
        const msg = `${occ.key}: içerik üretilemedi: ${(e as Error).message}`;
        log.error(msg);
        if (!dryRun) {
          for (const ch of channels) recordError(state, occ.key, ch, msg);
          persist(state, `hata: ${occ.key}`);
        }
        continue;
      }

      if (occ.slot.elle) {
        log.warn(`${occ.key}: "elle" modunda, paylaşılmadı. Dosyalar: ${built.files.join(", ")}`);
        if (!dryRun) {
          (state.paylasimlar[occ.key] ??= {}).elle = true;
          persist(state, `elle: ${occ.key}`);
        }
        continue;
      }
      if (dryRun) {
        for (const ch of channels) log.info(`[DRY_RUN] ${occ.key} → ${ch} (${built.format})${built.captions[ch] ? `\n${built.captions[ch]}` : ""}`);
        continue;
      }

      let urls: string[];
      try {
        const uploads = Object.fromEntries(built.files.map((f) => [`${occ.key}/${path.basename(f)}`, f]));
        const map = await uploadMedia(uploads, today);
        urls = Object.keys(uploads).map((k) => map[k]);
      } catch (e) {
        const msg = `${occ.key}: medya yüklenemedi: ${(e as Error).message}`;
        log.error(msg);
        for (const ch of channels) recordError(state, occ.key, ch, msg);
        persist(state, `hata: ${occ.key}`);
        continue;
      }

      // Kanallar birbirinden bağımsız: biri hata verirse diğeri yine paylaşır.
      let anySuccess = false;
      for (const ch of channels) {
        try {
          const r = await publish(ch, { format: built.format, urls, caption: built.captions[ch] }, creds!);
          recordPost(state, occ.key, ch, { id: r.id, url: r.url, zaman: new Date().toISOString() });
          anySuccess = true;
          log.info(`✓ ${occ.key} → ${ch}: ${r.url ?? r.id}`);
          persist(state, `paylaşıldı: ${occ.key} → ${ch}`);
        } catch (e) {
          const msg = (e as Error).message;
          recordError(state, occ.key, ch, msg);
          const n = attempts(state, occ.key, ch);
          log.error(`✗ ${occ.key} → ${ch} (deneme ${n}/${MAX_ATTEMPTS}): ${msg}`);
          persist(state, `hata: ${occ.key} → ${ch}`);
        }
      }
      if (anySuccess) {
        for (const id of built.usedMedia) state.kullanilan_medya[id] = occ.key;
        markFeatured(state, built.usedFallback, occ.date);
        persist(state, `medya işaretlendi: ${occ.key}`);
      }
    }
  } finally {
    await session.close();
    if (!dryRun) {
      prune(state, today);
      persist(state, "state temizliği");
    }
  }
}

// ── Pazar önizlemesi: gelecek haftanın tüm içeriklerini üret ──
export async function preview(opts: { now?: Date; savePlans?: boolean; thisWeek?: boolean }) {
  const cfg = loadConfig();
  const state = loadState();
  const now = opts.now ?? new Date();
  const tz = cfg.schedule.saat_dilimi;
  const today = localParts(now, tz).date;
  const monday = opts.thisWeek ? weekStart(today) : addDays(weekStart(today), 7);
  const week = isoWeek(monday);
  const from = zonedTime(monday, "00:00", tz);
  const to = zonedTime(addDays(monday, 6), "23:59", tz);
  const occs = occurrencesBetween(cfg, from, to);
  const outDir = path.join(OUT_DIR, "onizleme", week);
  fs.rmSync(outDir, { recursive: true, force: true });
  log.info(`Önizleme ${week} (${monday} haftası): ${occs.length} içerik`);

  const session = new Session();
  await session.start();
  const rows: { occ: Occurrence; built?: Built; error?: string }[] = [];
  try {
    const renderer = await session.getRenderer();
    for (const occ of occs) {
      try {
        const plan = ensurePlan(cfg, state, occ);
        const built = await buildContent({ cfg, state, media: session.media, renderer, outDir }, occ, plan);
        rows.push({ occ, built });
        log.info(`${occ.key}: ${built.summary}`);
      } catch (e) {
        rows.push({ occ, error: (e as Error).message });
        log.error(`${occ.key}: ${(e as Error).message}`);
      }
    }
  } finally {
    await session.close();
  }
  // Planlar kaydedilir: pazartesi paylaşılan içerik, önizlemede görülenle aynı ürünleri kullanır.
  if (opts.savePlans) persist(state, `önizleme planı: ${week}`);
  const summary = { week, monday, outDir, rows: rows.map((r) => ({ key: r.occ.key, at: r.occ.at.toISOString(), slot: r.occ.slot, built: r.built, error: r.error })) };
  fs.writeFileSync(path.join(outDir, "onizleme.json"), JSON.stringify(summary, null, 2));
  return summary;
}
