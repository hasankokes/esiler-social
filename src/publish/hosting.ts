import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { log } from "../log.js";
import { addDays } from "../schedule.js";
import { sleep } from "./graph.js";

// Meta, medyayı herkese açık bir URL'den indirir. Ücretsiz çözüm: GitHub Pages.
// Üretilen dosyalar repo'nun "media" dalına konur, Pages bu daldan yayın yapar:
//   https://<kullanıcı>.github.io/<repo>/<klasör>/<dosya>
// Dal her seferinde tek commit olarak yeniden yazılır ve 7 günden eski klasörler silinir; repo şişmez.
// (GitHub dosya sınırı 100 MB; 30 sn'lik Reels ~10–20 MB.)

const BRANCH = process.env.MEDIA_BRANCH ?? "media";
const KEEP_DAYS = 7;

export function mediaBaseUrl() {
  if (process.env.MEDIA_BASE_URL) return process.env.MEDIA_BASE_URL.replace(/\/$/, "");
  const repo = process.env.GITHUB_REPOSITORY; // "kullanici/repo"
  if (!repo) throw new Error("MEDIA_BASE_URL ya da GITHUB_REPOSITORY tanımlı değil");
  const [owner, name] = repo.split("/");
  return `https://${owner.toLowerCase()}.github.io/${name}`;
}

function remote() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("Medya yüklemek için GITHUB_REPOSITORY ve GITHUB_TOKEN gerekli (GitHub Actions içinde otomatik gelir)");
  return `https://x-access-token:${token}@github.com/${repo}.git`;
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

// uploads: { "2026-11-02_pzt-kartela/01-kapak.jpg": "/yerel/yol.jpg" } → aynı anahtarlarla herkese açık URL'ler
export async function uploadMedia(uploads: Record<string, string>, today: string): Promise<Record<string, string>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "esiler-media-"));
  const url = remote();
  try {
    try {
      git(dir, "clone", "--depth", "1", "--branch", BRANCH, url, ".");
    } catch {
      git(dir, "init", "-q", "-b", BRANCH);
      git(dir, "remote", "add", "origin", url);
    }
    // 7 günden eski klasörleri sil (klasör adları YYYY-AA-GG ile başlar; önizlemeler onizleme/ altında)
    const cutoff = addDays(today, -KEEP_DAYS);
    for (const top of fs.readdirSync(dir)) {
      if (top === ".git") continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(top) && top.slice(0, 10) < cutoff) fs.rmSync(path.join(dir, top), { recursive: true });
      if (top === "onizleme") {
        for (const w of fs.readdirSync(path.join(dir, top))) {
          if (fs.statSync(path.join(dir, top, w)).mtimeMs < Date.now() - 14 * 86400000) fs.rmSync(path.join(dir, top, w), { recursive: true });
        }
      }
    }
    for (const [rel, src] of Object.entries(uploads)) {
      const dst = path.join(dir, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    fs.writeFileSync(path.join(dir, ".nojekyll"), "");
    git(dir, "config", "user.name", "esiler-bot");
    git(dir, "config", "user.email", "esiler-bot@users.noreply.github.com");
    git(dir, "checkout", "-q", "--orphan", "yeni");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", `medya ${new Date().toISOString()}`);
    git(dir, "push", "-q", "-f", "origin", `yeni:${BRANCH}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const base = mediaBaseUrl();
  const urls = Object.fromEntries(Object.keys(uploads).map((rel) => [rel, `${base}/${rel.split("/").map(encodeURIComponent).join("/")}`]));
  await waitOnline(urls, uploads);
  return urls;
}

// Pages yayını genelde 30–90 sn sürer. Dosyalar erişilebilir ve doğru boyutta olana kadar bekle.
async function waitOnline(urls: Record<string, string>, uploads: Record<string, string>) {
  const until = Date.now() + 10 * 60 * 1000;
  const pending = new Set(Object.keys(urls));
  log.info(`GitHub Pages yayını bekleniyor (${pending.size} dosya)…`);
  while (pending.size) {
    for (const rel of [...pending]) {
      try {
        const res = await fetch(urls[rel], { method: "HEAD", cache: "no-store" });
        const len = Number(res.headers.get("content-length") ?? -1);
        if (res.ok && (len < 0 || len === fs.statSync(uploads[rel]).size)) pending.delete(rel);
      } catch {
        /* tekrar dene */
      }
    }
    if (!pending.size) break;
    if (Date.now() > until) throw new Error(`GitHub Pages 10 dk içinde yayınlamadı: ${[...pending].join(", ")} (Settings → Pages kaynağı "${BRANCH}" dalı mı?)`);
    await sleep(10000);
  }
}
