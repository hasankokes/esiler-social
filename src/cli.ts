import fs from "node:fs";
import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { publishPreviewIssue } from "./preview-issue.js";
import { checkDue, preview, runDue } from "./runner.js";
import { renderSamples } from "./samples.js";
import { localParts, occurrencesBetween } from "./schedule.js";
import { verifySetup } from "./verify.js";

// Kullanım:
//   npm run run-due [-- --dry-run] [--now=2026-11-02T09:00:00+03:00]
//   npm run preview [-- --this-week] [--issue] [--save-plans]
//   npm run samples
//   npx tsx src/cli.ts verify          (token, izin ve kimlik kontrolü; paylaşım yapmaz)
//   npx tsx src/cli.ts check           (zamanı gelen paylaşım sayısı; workflow kullanır)
//   npm run plan                       (önümüzdeki 7 günün takvimini listeler)

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const now = value("now") ? new Date(value("now")!) : undefined;

function writeStepSummary() {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const s = log.summary();
  const lines = [...s.errors.map((e) => `- ❌ ${e}`), ...s.warnings.map((w) => `- ⚠️ ${w}`)];
  if (lines.length) fs.appendFileSync(file, `### Uyarı ve hatalar\n\n${lines.join("\n")}\n`);
}

async function main() {
  switch (cmd) {
    case "check": {
      const n = checkDue(now);
      console.log(`due=${n}`);
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `due=${n}\n`);
      break;
    }
    case "run-due":
      await runDue({ now, dryRun: flag("dry-run") });
      break;
    case "preview": {
      const summary = await preview({ now, savePlans: flag("save-plans"), thisWeek: flag("this-week") });
      log.info(`Önizleme dosyaları: ${summary.outDir}`);
      if (flag("issue")) await publishPreviewIssue(summary, localParts(now ?? new Date(), "Europe/Istanbul").date);
      break;
    }
    case "verify":
      await verifySetup();
      break;
    case "samples":
      await renderSamples();
      break;
    case "plan": {
      const cfg = loadConfig();
      const from = now ?? new Date();
      for (const o of occurrencesBetween(cfg, from, new Date(from.getTime() + 7 * 86400000))) {
        console.log(`${o.date} ${o.slot.saat}  ${o.slot.tur.padEnd(8)} ${o.slot.icerik}`);
      }
      break;
    }
    default:
      console.log("Komutlar: check | run-due | preview | samples | plan | verify");
      process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    log.error((e as Error).stack ?? String(e));
    process.exitCode = 1;
  })
  .finally(() => {
    writeStepSummary();
    // Kanal hatalarında iş "başarısız" görünsün ki GitHub e-posta bildirimi göndersin.
    if (log.summary().errors.length) process.exitCode = 1;
  });
