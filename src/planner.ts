import { activeProducts, type Config, type ContentKind, type Product } from "./config.js";
import { log } from "./log.js";
import type { Occurrence } from "./schedule.js";
import { nextCounter, type Plan, type State } from "./state.js";

export const ROTATION_DAYS = 14;

// Her içerik tipinin kaç ürünü "öne çıkardığı" (14 gün kuralı bunlara uygulanır).
const FEATURED: Partial<Record<ContentKind, number>> = {
  renk_kartelasi: 1,
  anket: 2,
  doku_yakin: 1,
  urun_karti: 1,
  tek_model_renkler: 1,
};

// Gerçek çekim gerektiren içerikler ve yedek için gereken ürün sayısı.
export const FALLBACK: Partial<Record<ContentKind, number>> = {
  atolye_reels: 4,
  musteri_vitrini: 1,
  paketleme: 1,
};

const CAPTION_KEY: Partial<Record<ContentKind, string>> = {
  renk_kartelasi: "renk_kartelasi",
  urun_karti: "urun_karti",
  musteri_vitrini: "musteri_vitrini",
  atolye_reels: "atolye_reels",
  tek_model_renkler: "tek_model_renkler",
  egitici_reels: "egitici_reels",
};

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

// 14 gün içinde öne çıkmamış ürünlerden, en uzun süredir gösterilmeyeni seç.
export function pickProducts(
  cfg: Config,
  state: State,
  n: number,
  date: string,
  opts: { filter?: (u: Product) => boolean; exclude?: string[]; minColors?: number } = {},
): Product[] {
  const pool = activeProducts(cfg).filter(
    (u) => (!opts.filter || opts.filter(u)) && !opts.exclude?.includes(u.id) && (u.renkler.filter((r) => r.fotolar?.length).length >= (opts.minColors ?? 1)),
  );
  const order = new Map(cfg.products.map((u, i) => [u.id, i]));
  const last = (u: Product) => state.one_cikanlar[u.id];
  const fresh = pool.filter((u) => !last(u) || daysBetween(last(u), date) >= ROTATION_DAYS);
  const sorter = (a: Product, b: Product) => (last(a) ?? "").localeCompare(last(b) ?? "") || order.get(a.id)! - order.get(b.id)!;
  const chosen = fresh.sort(sorter).slice(0, n);
  if (chosen.length < n) {
    log.warn(`${date}: 14 gün kuralına uyan yeterli ürün yok, en eski gösterilenler tekrar kullanılıyor.`);
    const rest = pool.filter((u) => !chosen.includes(u)).sort(sorter);
    chosen.push(...rest.slice(0, n - chosen.length));
  }
  return chosen;
}

export function markFeatured(state: State, ids: string[], date: string) {
  for (const id of ids) {
    if (!state.one_cikanlar[id] || state.one_cikanlar[id] < date) state.one_cikanlar[id] = date;
  }
}

// Bir slot tekrarı için planı getirir; yoksa oluşturup state'e yazar.
export function ensurePlan(cfg: Config, state: State, occ: Occurrence): Plan {
  const existing = state.planlar[occ.key];
  if (existing) return existing;
  const kind = occ.slot.icerik;
  const featuredN = FEATURED[kind] ?? 0;
  let urunler: string[] = [];
  if (featuredN) {
    urunler = pickProducts(cfg, state, featuredN, occ.date, { minColors: kind === "tek_model_renkler" || kind === "renk_kartelasi" ? 2 : 1 }).map((u) => u.id);
    markFeatured(state, urunler, occ.date);
  } else if (kind === "sevke_hazir") {
    const ready = activeProducts(cfg).filter((u) => u.sevke_hazir !== false);
    const start = ready.length ? (nextCounter(state, "sevke_hazir") * 3) % ready.length : 0;
    urunler = [...ready.slice(start), ...ready.slice(0, start)].slice(0, 3).map((u) => u.id);
  } else if (kind === "yeni_gelenler") {
    const n = Number(occ.slot.ayarlar?.adet ?? 4);
    urunler = activeProducts(cfg).slice(0, n).map((u) => u.id);
  } else if (kind === "son_siparis") {
    urunler = activeProducts(cfg).slice(0, 1).map((u) => u.id);
  }
  // Yedek ürünler de 14 gün kuralına uyar ve ayrılır (aynı hafta iki yedek aynı ürünü seçmesin).
  const fallbackN = FALLBACK[kind] ?? 0;
  const yedek = fallbackN ? pickProducts(cfg, state, fallbackN, occ.date, { exclude: urunler }).map((u) => u.id) : [];
  markFeatured(state, yedek, occ.date);
  const captionKey = CAPTION_KEY[kind];
  const plan: Plan = {
    urunler,
    yedek_urunler: yedek,
    metin: captionKey ? nextCounter(state, `metin:${captionKey}`) : 0,
    ipucu_seti: kind === "egitici_reels" ? nextCounter(state, "egitici") : undefined,
    olusturma: new Date().toISOString(),
  };
  state.planlar[occ.key] = plan;
  return plan;
}
