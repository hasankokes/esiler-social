import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { p } from "../config.js";
import { log } from "../log.js";
import * as drive from "./drive.js";

// Medya kütüphanesi: ürün fotoğraflarını (URL / Drive) ve klasörlerdeki gerçek çekimleri indirir,
// telefon formatlarını (HEIC, MOV/HEVC) dönüştürür ve render için yerel bir HTTP sunucusundan sunar.
//
// Drive ayarlı değilse aynı klasör yapısı yerelde media-local/ altında aranır (test için).

export type MediaItem = { id: string; name: string; kind: "image" | "video"; source: "drive" | "local" };

const CACHE = p(".cache", "media");
const LOCAL = p("media-local");
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|avi)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
const has = (bin: string) => {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

export class MediaLibrary {
  private server?: http.Server;
  private base = "";

  // localDir: Drive ayarlı değilken klasörlerin aranacağı yer (varsayılan media-local/)
  constructor(private localDir = LOCAL) {}

  async start() {
    fs.mkdirSync(CACHE, { recursive: true });
    this.server = http.createServer((req, res) => {
      const file = path.join(CACHE, path.basename(decodeURIComponent((req.url ?? "/").split("?")[0])));
      if (!fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".png") ? "image/png" : file.endsWith(".mp3") ? "audio/mpeg" : "image/jpeg";
      const size = fs.statSync(file).size;
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (range) {
        const start = +range[1];
        const end = range[2] ? +range[2] : size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
        fs.createReadStream(file).pipe(res);
      }
    });
    await new Promise<void>((r) => this.server!.listen(0, "127.0.0.1", r));
    const addr = this.server.address() as { port: number };
    this.base = `http://127.0.0.1:${addr.port}`;
  }

  async stop() {
    await new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r()));
  }

  private urlFor(file: string) {
    return `${this.base}/${path.basename(file)}`;
  }

  // Ürün fotoğrafı: https://... ya da drive:urunler/... → yerel URL
  async photo(src: string): Promise<string> {
    const out = path.join(CACHE, `${hash(src)}.jpg`);
    if (!fs.existsSync(out)) {
      let buf: Buffer;
      let name = src;
      if (src.startsWith("drive:")) {
        const f = await drive.fileByPath(src);
        if (!f) throw new Error(`Drive'da bulunamadı: ${src}`);
        buf = await drive.download(f.id);
        name = f.name;
      } else if (/^https?:\/\//.test(src)) {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Fotoğraf indirilemedi (${res.status}): ${src}`);
        buf = Buffer.from(await res.arrayBuffer());
      } else {
        buf = fs.readFileSync(path.resolve(p(), src));
      }
      this.writeImage(buf, name, out);
    }
    return this.urlFor(out);
  }

  // Klasördeki medyalar (eskiden yeniye). folder: atolye | vitrin | paketleme | urunler/...
  async list(folder: string): Promise<MediaItem[]> {
    const kindOf = (name: string, mime = ""): MediaItem["kind"] | null =>
      mime.startsWith("video/") || VIDEO_EXT.test(name) ? "video" : mime.startsWith("image/") || IMAGE_EXT.test(name) ? "image" : null;
    if (drive.driveEnabled()) {
      const files = await drive.listMedia(folder);
      return files.flatMap((f) => {
        const kind = kindOf(f.name, f.mimeType);
        return kind ? [{ id: f.id, name: f.name, kind, source: "drive" as const }] : [];
      });
    }
    const dir = path.join(this.localDir, folder);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .sort()
      .flatMap((name) => {
        const kind = kindOf(name);
        return kind ? [{ id: `local:${folder}/${name}`, name, kind, source: "local" as const }] : [];
      });
  }

  private async raw(item: MediaItem): Promise<Buffer> {
    return item.source === "drive" ? drive.download(item.id) : fs.readFileSync(path.join(this.localDir, item.id.replace(/^local:/, "")));
  }

  // Klasör medyasını render'a hazırla. Video için süre (sn) de döner.
  async prepare(item: MediaItem): Promise<{ url: string; sure: number; file: string }> {
    if (item.kind === "image") {
      const out = path.join(CACHE, `${hash(item.id)}.jpg`);
      if (!fs.existsSync(out)) this.writeImage(await this.raw(item), item.name, out);
      return { url: this.urlFor(out), sure: 0, file: out };
    }
    const out = path.join(CACHE, `${hash(item.id)}.mp4`);
    if (!fs.existsSync(out)) {
      const tmp = path.join(CACHE, `${hash(item.id)}.src${path.extname(item.name) || ".mov"}`);
      fs.writeFileSync(tmp, await this.raw(item));
      // Telefon videoları (HEVC/MOV, döndürülmüş) → H.264 MP4, en fazla 1080 genişlik, sessiz.
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", "scale='min(1080,iw)':-2,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out]);
      fs.rmSync(tmp);
    }
    return { url: this.urlFor(out), sure: probeDuration(out), file: out };
  }

  // assets/music/ içinden bir parça (yoksa undefined → müziksiz).
  music(seed: number): string | undefined {
    const dir = p("assets", "music");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav|aac)$/i.test(f)).sort() : [];
    if (!files.length) return undefined;
    const src = path.join(dir, files[seed % files.length]);
    const out = path.join(CACHE, `${hash(src)}.mp3`);
    if (!fs.existsSync(out)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-c:a", "libmp3lame", "-b:a", "192k", out]);
    return this.urlFor(out);
  }

  private writeImage(buf: Buffer, name: string, out: string) {
    const isHeic = /\.(heic|heif)$/i.test(name) || buf.subarray(4, 12).toString("latin1").match(/ftyp(heic|heix|mif1|msf1)/);
    if (!isHeic) {
      fs.writeFileSync(out, buf);
      return;
    }
    // iPhone fotoğrafı (HEIC) → JPEG
    const tmp = out.replace(/\.jpg$/, ".heic");
    fs.writeFileSync(tmp, buf);
    try {
      if (has("heif-convert")) execFileSync("heif-convert", ["-q", "92", tmp, out], { stdio: "ignore" });
      else if (has("sips")) execFileSync("sips", ["-s", "format", "jpeg", tmp, "--out", out], { stdio: "ignore" });
      else execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, out]);
    } catch (e) {
      log.error(`HEIC dönüştürülemedi (${name}): ${(e as Error).message}`);
      throw e;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}

export function probeDuration(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim();
  return Number(out) || 0;
}
