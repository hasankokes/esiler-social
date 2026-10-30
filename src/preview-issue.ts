import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Built } from "./content.js";
import type { Slot } from "./config.js";
import { log } from "./log.js";
import { uploadMedia } from "./publish/hosting.js";

type Summary = { week: string; monday: string; outDir: string; rows: { key: string; at: string; slot: Slot; built?: Built; error?: string }[] };

const GUN: Record<string, string> = { pazartesi: "Pazartesi", sali: "Salı", carsamba: "Çarşamba", persembe: "Perşembe", cuma: "Cuma", cumartesi: "Cumartesi", pazar: "Pazar" };
const TUR: Record<string, string> = { hikaye: "Hikâye", post: "Gönderi", carousel: "Carousel", reels: "Reels" };

// Önizleme dosyalarını Pages'e yükler ve görselli bir GitHub issue açar.
export async function publishPreviewIssue(summary: Summary, today: string) {
  const uploads: Record<string, string> = {};
  for (const r of summary.rows) for (const f of r.built?.files ?? []) uploads[`onizleme/${summary.week}/${r.key}/${path.basename(f)}`] = f;
  const urls = await uploadMedia(uploads, today);

  const lines: string[] = [
    `Gelecek haftanın (${summary.monday} pazartesi) otomatik paylaşımları. Bu içerikler takvim saatinde Instagram ve Facebook'a gidecek.`,
    "",
    "> **YEDEK** yazanlar: ilgili Drive klasöründe (atolye/, vitrin/, paketleme/) yeni medya olmadığı için ürün bazlı üretildi. Paylaşım saatine kadar klasöre medya eklenirse onun yerine gerçek çekim kullanılır.",
    "",
  ];
  let day = "";
  for (const r of summary.rows) {
    if (r.slot.gun !== day) {
      day = r.slot.gun;
      lines.push(`## ${GUN[day] ?? day}`, "");
    }
    lines.push(`### ${r.slot.saat} · ${TUR[r.slot.tur] ?? r.slot.tur}${r.built?.fallback ? " · ⚠️ YEDEK" : ""}${r.slot.elle ? " · elle paylaşılacak" : ""}`);
    if (r.error) {
      lines.push(`❌ Üretilemedi: ${r.error}`, "");
      continue;
    }
    const b = r.built!;
    lines.push(b.summary, "");
    const media = b.files.map((f) => {
      const u = urls[`onizleme/${summary.week}/${r.key}/${path.basename(f)}`];
      return f.endsWith(".mp4") ? `[▶️ ${path.basename(f)}](${u})` : `<img src="${u}" width="220">`;
    });
    lines.push(media.join(" "), "");
    if (b.captions.instagram) {
      lines.push("<details><summary>Açıklama (Instagram)</summary>", "", "```", b.captions.instagram, "```", "", "</details>", "");
    }
  }
  const s = log.summary();
  if (s.warnings.length) lines.push("## Uyarılar", "", ...s.warnings.map((w) => `- ${w}`), "");

  const bodyFile = path.join(summary.outDir, "issue.md");
  fs.writeFileSync(bodyFile, lines.join("\n"));
  const title = `Haftalık önizleme ${summary.week} (${summary.monday})`;
  const out = execFileSync("gh", ["issue", "create", "--title", title, "--body-file", bodyFile, "--label", "onizleme"], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  log.info(`Önizleme issue'su: ${out}`);
  return out;
}
