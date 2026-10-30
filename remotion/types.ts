// Şablonlara giden veri tipleri. Node tarafı (src/) da bu tipleri kullanır.

export type Brand = {
  marka_adi: string;
  web: string;
  instagram: string;
  whatsapp: string;
  slogan: string;
  renkler: {
    zemin: string;
    koyu: string;
    vurgu: string;
    bej: string;
    metin: string;
    acik_metin: string;
    cizgi: string;
  };
};

export type ColorChip = { ad: string; hex: string };

export type ProductView = {
  id: string;
  kod: string;
  ad: string;
  kategori: string;
  iplik: string;
  gramaj: string;
  beden: string;
  seri_adedi: string;
  renkler: ColorChip[];
  foto: string; // ana fotoğraf URL'si
};

export type PostProps =
  | { kind: "urun_karti"; brand: Brand; urun: ProductView }
  | { kind: "kartela_kapak"; brand: Brand; urun: ProductView; toplam: number }
  | {
      kind: "kartela_renk";
      brand: Brand;
      urun: ProductView;
      renk: ColorChip;
      foto: string;
      sira: number;
      toplam: number;
    }
  | { kind: "kartela_son"; brand: Brand; urun: ProductView }
  | { kind: "vitrin"; brand: Brand; foto: string; sira: number; toplam: number }
  | { kind: "vitrin_yedek"; brand: Brand; urun: ProductView };

export type StoryProps =
  | { kind: "yeni_gelenler"; brand: Brand; urunler: ProductView[] }
  | { kind: "anket"; brand: Brand; a: ProductView; b: ProductView }
  | { kind: "sevke_hazir"; brand: Brand; urunler: ProductView[] }
  | { kind: "doku"; brand: Brand; urun: ProductView; foto: string; gercek: boolean }
  | { kind: "son_siparis"; brand: Brand; baslik: string; gun: string; saat: string; urun?: ProductView }
  | { kind: "soru_cevap"; brand: Brand }
  | { kind: "paketleme_foto"; brand: Brand; foto: string }
  | { kind: "paketleme_yedek"; brand: Brand; urun: ProductView };

export type Tip = { baslik: string; metin: string };

export type VideoProps =
  | {
      kind: "klipler";
      brand: Brand;
      baslik: string;
      klipler: { url: string; sure: number }[]; // saniye
      muzik?: string;
      hikaye?: boolean;
    }
  | {
      kind: "renkler";
      brand: Brand;
      urun: ProductView;
      kareler: { renk: ColorChip; foto: string }[];
      muzik?: string;
    }
  | { kind: "egitici"; brand: Brand; baslik: string; maddeler: Tip[]; muzik?: string }
  | {
      kind: "urun_montaj";
      brand: Brand;
      baslik: string;
      urunler: ProductView[];
      muzik?: string;
    };

export const FPS = 30;
export const SAFE = 250; // hikâye/reels üst ve alt güvenli alan (px)
