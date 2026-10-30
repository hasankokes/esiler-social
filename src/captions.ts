import type { Channel, Config, Product } from "./config.js";

const fields = (u: Product | undefined): Record<string, string> =>
  u
    ? {
        ad: u.ad,
        kod: u.kod ?? "",
        kategori: u.kategori ?? "",
        iplik: u.iplik ?? "",
        gramaj: u.gramaj ?? "",
        beden: u.beden_serisi ?? "",
        seri_adedi: u.seri_adedi ?? "",
        renk_sayisi: String(u.renkler.length),
        renkler: u.renkler.map((r) => r.ad).join(", "),
      }
    : {};

// Şablonu doldurur. Değeri boş bir alan içeren satır tamamen atlanır.
export function fill(template: string, vars: Record<string, string>) {
  return template
    .split("\n")
    .flatMap((line) => {
      let empty = false;
      const out = line.replace(/\{(\w+)\}/g, (_, k: string) => {
        const v = vars[k];
        if (v === undefined || !v.trim()) empty = true;
        return v ?? "";
      });
      return empty ? [] : [out.replace(/\s+$/, "")];
    })
    .join("\n")
    .trim();
}

// Etiket havuzundan dönüşümlü seçim: Instagram 3–5, Facebook daha az. Sabit etiket hep eklenir.
export function hashtags(cfg: Config, channel: Channel, seed: number) {
  const t = cfg.brand.etiketler;
  const sabit = t.sabit;
  const pool = t.havuz.filter((h) => h !== sabit);
  const span = t.instagram_max - t.instagram_min + 1;
  const count = channel === "instagram" ? t.instagram_min + (seed % span) : t.facebook;
  const rotated = [...pool.slice(seed % pool.length), ...pool.slice(0, seed % pool.length)];
  const picked = rotated.slice(0, Math.max(0, count - (sabit ? 1 : 0)));
  return (sabit ? [...picked, sabit] : picked).slice(0, count).join(" ");
}

export function buildCaption(cfg: Config, key: string, index: number, product: Product | undefined, channel: Channel) {
  const list = cfg.captions[key];
  if (!list?.length) throw new Error(`captions.yaml: "${key}" için şablon yok`);
  const body = fill(list[index % list.length], fields(product));
  const footer = `Sipariş ve fiyat için WhatsApp: ${cfg.brand.whatsapp} / DM`;
  return `${body}\n\n${footer}\n\n${hashtags(cfg, channel, index)}`;
}
