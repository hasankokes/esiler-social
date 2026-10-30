import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { Brand, ColorChip, ProductView, Tip } from "../remotion/types.js";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const p = (...parts: string[]) => path.join(ROOT, ...parts);

const readYaml = <T>(file: string): T => YAML.parse(fs.readFileSync(p("config", file), "utf8")) as T;

export type Channel = "instagram" | "facebook";
export const CHANNELS: Channel[] = ["instagram", "facebook"];

export type SlotType = "hikaye" | "post" | "carousel" | "reels";
export type ContentKind =
  | "yeni_gelenler"
  | "renk_kartelasi"
  | "anket"
  | "sevke_hazir"
  | "atolye_reels"
  | "doku_yakin"
  | "urun_karti"
  | "son_siparis"
  | "tek_model_renkler"
  | "musteri_vitrini"
  | "paketleme"
  | "egitici_reels"
  | "soru_cevap";

export type Slot = {
  id: string;
  gun: string;
  saat: string;
  tur: SlotType;
  icerik: ContentKind;
  aktif?: boolean;
  elle?: boolean;
  kanallar?: Partial<Record<Channel, boolean>>;
  ayarlar?: Record<string, string | number>;
};

export type Schedule = {
  saat_dilimi: string;
  kanallar: Record<Channel, boolean>;
  en_fazla_gecikme_saat?: number | null;
  tatiller?: string[];
  slotlar: Slot[];
};

export type ProductColor = { ad: string; fotolar: string[] };
export type Product = {
  id: string;
  kod?: string;
  ad: string;
  tam_ad?: string;
  kategori?: string;
  iplik?: string;
  gramaj?: string;
  beden_serisi?: string;
  seri_adedi?: string;
  sevke_hazir?: boolean;
  aktif?: boolean;
  renkler: ProductColor[];
};

export type BrandConfig = Brand & {
  fontlar: { baslik: string; govde: string };
  etiketler: { havuz: string[]; instagram_min: number; instagram_max: number; facebook: number; sabit?: string };
  renk_kodlari: Record<string, string>;
};

export type TipSet = { baslik: string; maddeler: Tip[] };

export type Config = {
  schedule: Schedule;
  brand: BrandConfig;
  products: Product[];
  captions: Record<string, string[]>;
  tips: TipSet[];
};

const DAYS = ["pazar", "pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi"];
export const dayIndex = (gun: string) => {
  const norm = gun
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o");
  const i = DAYS.indexOf(norm);
  if (i < 0) throw new Error(`schedule.yaml: bilinmeyen gün "${gun}"`);
  return i;
};

export function loadConfig(): Config {
  const schedule = readYaml<Schedule>("schedule.yaml");
  const brand = readYaml<BrandConfig>("brand.yaml");
  const products = (readYaml<{ urunler: Product[] }>("products.yaml").urunler ?? []).map((u) => ({ ...u, id: String(u.id) }));
  const captions = readYaml<Record<string, string[]>>("captions.yaml");
  const tips = readYaml<{ setler: TipSet[] }>("egitici.yaml").setler ?? [];
  validate(schedule, products);
  return { schedule, brand, products, captions, tips };
}

function validate(schedule: Schedule, products: Product[]) {
  const ids = new Set<string>();
  for (const s of schedule.slotlar) {
    if (ids.has(s.id)) throw new Error(`schedule.yaml: "${s.id}" iki kez tanımlı`);
    ids.add(s.id);
    dayIndex(s.gun);
    if (!/^\d{2}:\d{2}$/.test(s.saat)) throw new Error(`schedule.yaml: "${s.id}" saati SS:DD olmalı (ör. "08:30")`);
  }
  const pids = new Set<string>();
  for (const u of products) {
    if (pids.has(u.id)) throw new Error(`products.yaml: id "${u.id}" iki kez kullanılmış`);
    pids.add(u.id);
    if (!u.renkler?.length) throw new Error(`products.yaml: "${u.ad}" için en az bir renk gerekli`);
  }
}

export const activeProducts = (cfg: Config) => cfg.products.filter((u) => u.aktif !== false && u.renkler.some((r) => r.fotolar?.length));

export const brandProps = (cfg: Config): Brand => {
  const { marka_adi, web, instagram, whatsapp, slogan, renkler } = cfg.brand;
  return { marka_adi, web, instagram, whatsapp, slogan, renkler };
};

export const chip = (cfg: Config, ad: string): ColorChip => ({ ad, hex: cfg.brand.renk_kodlari?.[ad] ?? cfg.brand.renkler.bej });

export const firstPhoto = (u: Product) => u.renkler.find((r) => r.fotolar?.length)?.fotolar[0] ?? "";

// foto: ana fotoğrafın render sırasında erişilecek (yerel) URL'si.
export const productView = (cfg: Config, u: Product, foto: string): ProductView => ({
  id: u.id,
  kod: u.kod ?? "",
  ad: u.ad,
  kategori: u.kategori ?? "",
  iplik: u.iplik ?? "",
  gramaj: u.gramaj ?? "",
  beden: u.beden_serisi ?? "",
  seri_adedi: u.seri_adedi ?? "",
  renkler: u.renkler.map((r) => chip(cfg, r.ad)),
  foto,
});
