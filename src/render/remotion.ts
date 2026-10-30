import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition, type HeadlessBrowser } from "@remotion/renderer";
import { p } from "../config.js";
import { log } from "../log.js";
import type { Renderer, StillJob, VideoJob } from "./index.js";

// Yerel Mac'te Remotion'un kendi headless tarayıcısı çökebiliyor; o durumda
// REMOTION_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" verin.
const browserExecutable = process.env.REMOTION_BROWSER || null;
const chromeMode = browserExecutable ? ("chrome-for-testing" as const) : ("headless-shell" as const);

export class RemotionRenderer implements Renderer {
  private serveUrl = "";
  private browser?: HeadlessBrowser;

  async init() {
    // Bundle için public klasörü: fontlar + assets/logo.png
    const pub = p(".cache", "remotion-public");
    fs.rmSync(pub, { recursive: true, force: true });
    fs.mkdirSync(pub, { recursive: true });
    fs.cpSync(p("remotion", "public"), pub, { recursive: true });
    fs.copyFileSync(p("assets", "logo.png"), path.join(pub, "logo.png"));
    log.info("Remotion paketi hazırlanıyor…");
    this.serveUrl = await bundle({ entryPoint: p("remotion", "index.ts"), publicDir: pub });
    this.browser = await openBrowser("chrome", { browserExecutable, chromeMode });
  }

  private async composition(id: string, inputProps: Record<string, unknown>) {
    return selectComposition({ serveUrl: this.serveUrl, id, inputProps, puppeteerInstance: this.browser, browserExecutable, chromeMode });
  }

  async still(job: StillJob) {
    const inputProps = job.props as unknown as Record<string, unknown>;
    const composition = await this.composition(job.composition, inputProps);
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    await renderStill({
      serveUrl: this.serveUrl,
      composition,
      inputProps,
      output: job.out,
      imageFormat: "jpeg",
      jpegQuality: 92,
      puppeteerInstance: this.browser,
      browserExecutable,
      chromeMode,
    });
  }

  async video(job: VideoJob) {
    const inputProps = job.props as unknown as Record<string, unknown>;
    const composition = await this.composition(job.composition, inputProps);
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    await renderMedia({
      serveUrl: this.serveUrl,
      composition,
      inputProps,
      codec: "h264",
      crf: 20,
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      enforceAudioTrack: true, // Meta bazı videolarda ses izi bekliyor; müzik yoksa sessiz iz eklenir
      // Yerelde tarayıcı çökerse RENDER_CONCURRENCY=2 gibi düşük bir değer verin.
      concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null,
      outputLocation: job.out,
      puppeteerInstance: this.browser,
      browserExecutable,
      chromeMode,
    });
  }

  async close() {
    await this.browser?.close({ silent: true });
  }
}
