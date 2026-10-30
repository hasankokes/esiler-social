// GitHub Actions'ta uyarı/hata satırları ::warning:: / ::error:: ile işaretlenir, özet ekranında görünür.
const gh = Boolean(process.env.GITHUB_ACTIONS);
const warnings: string[] = [];
const errors: string[] = [];

const ts = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (msg: string) => console.log(`[${ts()}] ${msg}`),
  warn: (msg: string) => {
    warnings.push(msg);
    console.log(gh ? `::warning::${msg}` : `[${ts()}] UYARI: ${msg}`);
  },
  error: (msg: string) => {
    errors.push(msg);
    console.log(gh ? `::error::${msg}` : `[${ts()}] HATA: ${msg}`);
  },
  summary: () => ({ warnings: [...warnings], errors: [...errors] }),
};
