import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildContent } from "./content.js";
import { activeProducts, firstPhoto, loadConfig, p, type ContentKind } from "./config.js";
import { log } from "./log.js";
import { MediaLibrary } from "./media/library.js";
import { ensurePlan } from "./planner.js";
import { createRenderer } from "./render/index.js";
import { occurrencesBetween, zonedTime } from "./schedule.js";
import { loadState } from "./state.js";

// Her şablondan örnek çıktı üretir → samples/
// 1. tur: klasörler boş (gerçek çekim içerikleri ürün bazlı YEDEK ile üretilir)
// 2. tur: atolye/ vitrin/ paketleme/ için temsili medya (ürün fotoğraflarından türetilmiş) ile GERÇEK çekim şablonları

const REAL: ContentKind[] = ["atolye_reels", "musteri_vitrini", "paketleme"];

export async function renderSamples() {
  const cfg = loadConfig();
  const state = loadState(p(".cache", "yok.json")); // boş state; gerçek state'e dokunulmaz
  const outDir = p(".cache", "samples-out");
  const samplesDir = p("samples");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(samplesDir, { recursive: true, force: true });
  fs.mkdirSync(samplesDir, { recursive: true });

  const tz = cfg.schedule.saat_dilimi;
  const occs = occurrencesBetween(cfg, zonedTime("2026-11-02", "00:00", tz), zonedTime("2026-11-08", "23:59", tz));
  const standIn = await makeStandInMedia(cfg);
  const renderer = await createRenderer();
  await renderer.init();

  let n = 0;
  const save = (files: string[], name: string) => {
    for (const f of files) {
      n++;
      const suffix = files.length > 1 ? `-${path.basename(f, path.extname(f))}` : "";
      fs.copyFileSync(f, path.join(samplesDir, `${String(n).padStart(2, "0")}-${name}${suffix}${path.extname(f)}`));
    }
  };

  try {
    for (const [pass, media] of [
      ["yedek", new MediaLibrary(p(".cache", "bos-klasor"))],
      ["gercek", new MediaLibrary(standIn)],
    ] as const) {
      await media.start();
      for (const occ of occs) {
        const real = REAL.includes(occ.slot.icerik);
        if (pass === "gercek" && !real) continue;
        const plan = ensurePlan(cfg, state, occ);
        const built = await buildContent({ cfg, state, media, renderer, outDir: path.join(outDir, pass) }, occ, plan);
        save(built.files, `${occ.slot.id}${real ? `-${pass}` : ""}`);
        if (built.captions.instagram) fs.writeFileSync(path.join(samplesDir, `${String(n).padStart(2, "0")}-${occ.slot.id}${real ? `-${pass}` : ""}-aciklama.txt`), `INSTAGRAM\n\n${built.captions.instagram}\n\n---\nFACEBOOK\n\n${built.captions.facebook}\n`);
        log.info(`örnek: ${occ.slot.id} (${pass}) → ${built.summary}`);
      }
      await media.stop();
    }
  } finally {
    await renderer.close();
  }
  log.info(`Örnekler: ${samplesDir}`);
}

// Drive'a henüz gerçek çekim konmadığı için, ürün fotoğraflarından temsili klip/foto üretir.
async function makeStandInMedia(cfg: ReturnType<typeof loadConfig>) {
  const dir = p(".cache", "temsili-medya");
  if (fs.existsSync(path.join(dir, "atolye"))) return dir;
  for (const sub of ["atolye", "vitrin", "paketleme"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  const photos = activeProducts(cfg)
    .slice(5, 9)
    .map((u) => firstPhoto(u));
  const local: string[] = [];
  for (const src of photos) {
    const f = path.join(dir, `${crypto.createHash("sha1").update(src).digest("hex").slice(0, 8)}.jpg`);
    fs.writeFileSync(f, Buffer.from(await (await fetch(src)).arrayBuffer()));
    local.push(f);
  }
  local.forEach((f, i) => {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-i", f, "-t", "5", "-r", "30", "-vf", "scale=1300:-2,crop=1080:1920:(in_w-1080)*t/5:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "atolye", `klip-${i + 1}.mp4`)]);
  });
  fs.copyFileSync(local[0], path.join(dir, "vitrin", "magaza-1.jpg"));
  fs.copyFileSync(local[1], path.join(dir, "vitrin", "magaza-2.jpg"));
  fs.copyFileSync(local[2], path.join(dir, "paketleme", "paket-1.jpg"));
  for (const f of local) fs.rmSync(f);
  return dir;
}
