import fs from "node:fs";
import { p, type Channel } from "./config.js";
import { addDays } from "./schedule.js";

export type PostRecord = { id: string; zaman: string; url?: string };
export type ErrorRecord = { deneme: number; son_hata: string; zaman: string };

export type Plan = {
  urunler: string[]; // öne çıkan ürün id'leri (slot tipine göre 0–4 adet)
  yedek_urunler: string[]; // gerçek çekim yoksa kullanılacak ürünler
  metin: number; // açıklama şablon sırası
  ipucu_seti?: number;
  olusturma: string;
};

export type State = {
  surum: 1;
  // İlk canlı çalıştırmanın zamanı. Bundan önceki slotlar geriye dönük paylaşılmaz.
  yayin_baslangic: string | null;
  paylasimlar: Record<string, Partial<Record<Channel, PostRecord>> & { hatalar?: Partial<Record<Channel, ErrorRecord>>; elle?: boolean }>;
  planlar: Record<string, Plan>;
  one_cikanlar: Record<string, string>; // ürün id → en son öne çıktığı tarih
  kullanilan_medya: Record<string, string>; // Drive dosya id → slot anahtarı
  sayaclar: Record<string, number>;
};

export const STATE_FILE = p("state", "posted_state.json");
export const MAX_ATTEMPTS = 8; // bir kanalda üst üste bu kadar hata olursa o slot o kanalda bırakılır

const empty = (): State => ({
  surum: 1,
  yayin_baslangic: null,
  paylasimlar: {},
  planlar: {},
  one_cikanlar: {},
  kullanilan_medya: {},
  sayaclar: {},
});

export function loadState(file = STATE_FILE): State {
  if (!fs.existsSync(file)) return empty();
  return { ...empty(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
}

export function saveState(state: State, file = STATE_FILE) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
}

// 60 günden eski plan ve kayıtları temizle (dosya büyümesin).
export function prune(state: State, today: string) {
  const cutoff = addDays(today, -60);
  for (const map of [state.paylasimlar, state.planlar] as Record<string, unknown>[]) {
    for (const k of Object.keys(map)) if (k.slice(0, 10) < cutoff) delete map[k];
  }
  for (const [k, v] of Object.entries(state.kullanilan_medya)) if (v.slice(0, 10) < cutoff) delete state.kullanilan_medya[k];
}

export const isPosted = (state: State, key: string, ch: Channel) => Boolean(state.paylasimlar[key]?.[ch]);

export const attempts = (state: State, key: string, ch: Channel) => state.paylasimlar[key]?.hatalar?.[ch]?.deneme ?? 0;

export function recordPost(state: State, key: string, ch: Channel, rec: PostRecord) {
  const entry = (state.paylasimlar[key] ??= {});
  entry[ch] = rec;
  if (entry.hatalar) delete entry.hatalar[ch];
}

export function recordError(state: State, key: string, ch: Channel, message: string) {
  const entry = (state.paylasimlar[key] ??= {});
  const hatalar = (entry.hatalar ??= {});
  hatalar[ch] = { deneme: (hatalar[ch]?.deneme ?? 0) + 1, son_hata: message.slice(0, 500), zaman: new Date().toISOString() };
}

export function nextCounter(state: State, name: string) {
  const v = state.sayaclar[name] ?? 0;
  state.sayaclar[name] = v + 1;
  return v;
}
