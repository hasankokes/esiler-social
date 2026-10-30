import path from "node:path";
import type { ProductView, VideoProps } from "../remotion/types.js";
import { buildCaption } from "./captions.js";
import { brandProps, chip, CHANNELS, firstPhoto, p, productView, type Channel, type Config, type ContentKind, type Product } from "./config.js";
import { log } from "./log.js";
import type { MediaItem, MediaLibrary } from "./media/library.js";
import type { Renderer } from "./render/index.js";
import type { Occurrence } from "./schedule.js";
import type { Plan, State } from "./state.js";

export type Built = {
  key: string;
  kind: ContentKind;
  format: "story_image" | "story_video" | "image" | "carousel" | "reel";
  files: string[]; // yerel dosyalar (jpg / mp4)
  captions: Partial<Record<Channel, string>>; // hikâyelerde boş
  usedMedia: string[]; // paylaşılınca "kullanıldı" işaretlenecek klasör medyaları
  usedFallback: string[]; // paylaşılınca öne çıkmış sayılacak yedek ürünler
  fallback: boolean; // gerçek çekim yerine ürün bazlı yedek kullanıldı
  summary: string;
};

type Ctx = { cfg: Config; state: State; media: MediaLibrary; renderer: Renderer; outDir: string };

const byId = (cfg: Config, id: string): Product => {
  const u = cfg.products.find((x) => x.id === id);
  if (!u) throw new Error(`products.yaml'da ürün yok: ${id} (silinmiş olabilir)`);
  return u;
};

const unused = (ctx: Ctx, items: MediaItem[]) => items.filter((m) => !ctx.state.kullanilan_medya[m.id]);

async function view(ctx: Ctx, u: Product): Promise<ProductView> {
  return productView(ctx.cfg, u, await ctx.media.photo(firstPhoto(u)));
}

const captionsFor = (ctx: Ctx, key: string, plan: Plan, u?: Product) =>
  Object.fromEntries(CHANNELS.map((ch) => [ch, buildCaption(ctx.cfg, key, plan.metin, u, ch)])) as Record<Channel, string>;

export async function buildContent(ctx: Ctx, occ: Occurrence, plan: Plan): Promise<Built> {
  const { cfg, renderer } = ctx;
  const brand = brandProps(cfg);
  const dir = path.join(ctx.outDir, occ.key);
  const f = (name: string) => path.join(dir, name);
  const kind = occ.slot.icerik;
  const base = { key: occ.key, kind, captions: {}, usedMedia: [] as string[], usedFallback: [] as string[], fallback: false };
  const products = plan.urunler.map((id) => byId(cfg, id));
  const fallbackProducts = () => plan.yedek_urunler.map((id) => byId(cfg, id));

  switch (kind) {
    case "yeni_gelenler": {
      const urunler = await Promise.all(products.map((u) => view(ctx, u)));
      await renderer.still({ composition: "Story", props: { kind: "yeni_gelenler", brand, urunler }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], summary: `Yeni gelenler: ${products.map((u) => u.ad).join(", ")}` };
    }

    case "renk_kartelasi": {
      const u = products[0];
      const pv = await view(ctx, u);
      const colors = u.renkler.filter((r) => r.fotolar?.length).slice(0, 8); // kapak + 8 renk + kapanış = 10 (Instagram sınırı)
      const toplam = colors.length;
      const files = [f("01-kapak.jpg")];
      await renderer.still({ composition: "Post", props: { kind: "kartela_kapak", brand, urun: pv, toplam }, out: files[0] });
      for (const [i, r] of colors.entries()) {
        const out = f(`${String(i + 2).padStart(2, "0")}-${i + 1}.jpg`);
        const foto = await ctx.media.photo(r.fotolar[0]);
        await renderer.still({ composition: "Post", props: { kind: "kartela_renk", brand, urun: pv, renk: chip(cfg, r.ad), foto, sira: i + 1, toplam }, out });
        files.push(out);
      }
      const last = f(`${String(colors.length + 2).padStart(2, "0")}-son.jpg`);
      await renderer.still({ composition: "Post", props: { kind: "kartela_son", brand, urun: pv }, out: last });
      files.push(last);
      return { ...base, format: "carousel", files, captions: captionsFor(ctx, "renk_kartelasi", plan, u), summary: `Renk kartelası: ${u.ad} (${toplam} renk)` };
    }

    case "anket": {
      const [a, b] = await Promise.all(products.slice(0, 2).map((u) => view(ctx, u)));
      await renderer.still({ composition: "Story", props: { kind: "anket", brand, a, b }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], summary: `Anket: ${a.ad} / ${b.ad}` };
    }

    case "sevke_hazir": {
      if (!products.length) throw new Error("products.yaml'da sevke_hazir ürün yok");
      const urunler = await Promise.all(products.map((u) => view(ctx, u)));
      await renderer.still({ composition: "Story", props: { kind: "sevke_hazir", brand, urunler }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], summary: `Sevke hazır: ${products.map((u) => u.ad).join(", ")}` };
    }

    case "doku_yakin": {
      const u = products[0];
      const pv = await view(ctx, u);
      // İsteğe bağlı doku/ klasörü: gerçek yakın çekim varsa o kullanılır.
      const real = unused(ctx, await ctx.media.list("doku")).find((m) => m.kind === "image");
      const foto = real ? (await ctx.media.prepare(real)).url : pv.foto;
      await renderer.still({ composition: "Story", props: { kind: "doku", brand, urun: pv, foto, gercek: Boolean(real) }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], usedMedia: real ? [real.id] : [], summary: `Doku yakın çekim: ${u.ad}${real ? " (gerçek çekim)" : ""}` };
    }

    case "urun_karti": {
      const u = products[0];
      await renderer.still({ composition: "Post", props: { kind: "urun_karti", brand, urun: await view(ctx, u) }, out: f("post.jpg") });
      return { ...base, format: "image", files: [f("post.jpg")], captions: captionsFor(ctx, "urun_karti", plan, u), summary: `Ürün kartı: ${u.ad}` };
    }

    case "son_siparis": {
      const a = occ.slot.ayarlar ?? {};
      await renderer.still({
        composition: "Story",
        props: { kind: "son_siparis", brand, baslik: String(a.baslik ?? "Haftalık sevkiyat"), gun: "Bugün", saat: String(a.son_saat ?? "17:00") },
        out: f("hikaye.jpg"),
      });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], summary: `Son sipariş saati: ${a.son_saat ?? "17:00"}` };
    }

    case "tek_model_renkler": {
      const u = products[0];
      const pv = await view(ctx, u);
      const colors = u.renkler.filter((r) => r.fotolar?.length).slice(0, 5);
      const kareler = await Promise.all(colors.map(async (r) => ({ renk: chip(cfg, r.ad), foto: await ctx.media.photo(r.fotolar[0]) })));
      const props: VideoProps = { kind: "renkler", brand, urun: pv, kareler, muzik: ctx.media.music(plan.metin) };
      await renderer.video({ composition: "Video", props, out: f("reels.mp4") });
      return { ...base, format: "reel", files: [f("reels.mp4")], captions: captionsFor(ctx, "tek_model_renkler", plan, u), summary: `Tek model ${colors.length} renk: ${u.ad}` };
    }

    case "egitici_reels": {
      const sets = cfg.tips;
      if (!sets.length) throw new Error("egitici.yaml boş");
      const set = sets[(plan.ipucu_seti ?? 0) % sets.length];
      const props: VideoProps = { kind: "egitici", brand, baslik: set.baslik, maddeler: set.maddeler.slice(0, 3), muzik: ctx.media.music(plan.metin) };
      await renderer.video({ composition: "Video", props, out: f("reels.mp4") });
      return { ...base, format: "reel", files: [f("reels.mp4")], captions: captionsFor(ctx, "egitici_reels", plan), summary: `Eğitici: ${set.baslik}` };
    }

    case "soru_cevap": {
      await renderer.still({ composition: "Story", props: { kind: "soru_cevap", brand }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], summary: "Soru-cevap çağrısı" };
    }

    // ── Gerçek çekim gerektirenler: klasörde yeni medya yoksa ürün bazlı yedek ──

    case "atolye_reels": {
      const clips = unused(ctx, await ctx.media.list("atolye"))
        .filter((m) => m.kind === "video")
        .slice(0, 6);
      if (clips.length) {
        const prepared = await Promise.all(clips.map((c) => ctx.media.prepare(c)));
        const props: VideoProps = { kind: "klipler", brand, baslik: "İplikten pakete", klipler: prepared.map((c) => ({ url: c.url, sure: c.sure })), muzik: ctx.media.music(plan.metin) };
        await renderer.video({ composition: "Video", props, out: f("reels.mp4") });
        return { ...base, format: "reel", files: [f("reels.mp4")], captions: captionsFor(ctx, "atolye_reels", plan), usedMedia: clips.map((c) => c.id), summary: `Atölye: ${clips.length} klip` };
      }
      log.warn(`${occ.key}: atolye/ klasöründe yeni video yok, ürün bazlı yedek Reels üretildi.`);
      const fb = fallbackProducts();
      const urunler = await Promise.all(fb.map((u) => view(ctx, u)));
      const props: VideoProps = { kind: "urun_montaj", brand, baslik: "Kendi üretimimiz", urunler, muzik: ctx.media.music(plan.metin) };
      await renderer.video({ composition: "Video", props, out: f("reels.mp4") });
      return { ...base, format: "reel", files: [f("reels.mp4")], captions: captionsFor(ctx, "atolye_yedek", plan, fb[0]), usedFallback: fb.map((u) => u.id), fallback: true, summary: `Atölye (YEDEK): ${fb.map((u) => u.ad).join(", ")}` };
    }

    case "musteri_vitrini": {
      const photos = unused(ctx, await ctx.media.list("vitrin"))
        .filter((m) => m.kind === "image")
        .slice(0, 10);
      if (photos.length) {
        const files: string[] = [];
        for (const [i, m] of photos.entries()) {
          const out = f(`${String(i + 1).padStart(2, "0")}.jpg`);
          await renderer.still({ composition: "Post", props: { kind: "vitrin", brand, foto: (await ctx.media.prepare(m)).url, sira: i + 1, toplam: photos.length }, out });
          files.push(out);
        }
        return {
          ...base,
          format: files.length > 1 ? "carousel" : "image",
          files,
          captions: captionsFor(ctx, "musteri_vitrini", plan),
          usedMedia: photos.map((m) => m.id),
          summary: `Müşteri vitrini: ${photos.length} fotoğraf`,
        };
      }
      log.warn(`${occ.key}: vitrin/ klasöründe yeni fotoğraf yok, ürün bazlı yedek gönderi üretildi.`);
      const u = fallbackProducts()[0];
      await renderer.still({ composition: "Post", props: { kind: "vitrin_yedek", brand, urun: await view(ctx, u) }, out: f("post.jpg") });
      return { ...base, format: "image", files: [f("post.jpg")], captions: captionsFor(ctx, "vitrin_yedek", plan, u), usedFallback: [u.id], fallback: true, summary: `Vitrin (YEDEK): ${u.ad}` };
    }

    case "paketleme": {
      const items = unused(ctx, await ctx.media.list("paketleme"));
      const videos = items.filter((m) => m.kind === "video").slice(0, 3);
      if (videos.length) {
        const prepared = await Promise.all(videos.map((c) => ctx.media.prepare(c)));
        const props: VideoProps = { kind: "klipler", brand, baslik: "Siparişleriniz yolda", klipler: prepared.map((c) => ({ url: c.url, sure: c.sure })), hikaye: true };
        await renderer.video({ composition: "Video", props, out: f("hikaye.mp4") });
        return { ...base, format: "story_video", files: [f("hikaye.mp4")], usedMedia: videos.map((v) => v.id), summary: `Paketleme: ${videos.length} video` };
      }
      const photo = items.find((m) => m.kind === "image");
      if (photo) {
        await renderer.still({ composition: "Story", props: { kind: "paketleme_foto", brand, foto: (await ctx.media.prepare(photo)).url }, out: f("hikaye.jpg") });
        return { ...base, format: "story_image", files: [f("hikaye.jpg")], usedMedia: [photo.id], summary: "Paketleme: fotoğraf" };
      }
      log.warn(`${occ.key}: paketleme/ klasöründe yeni medya yok, ürün bazlı yedek hikâye üretildi.`);
      const u = fallbackProducts()[0];
      await renderer.still({ composition: "Story", props: { kind: "paketleme_yedek", brand, urun: await view(ctx, u) }, out: f("hikaye.jpg") });
      return { ...base, format: "story_image", files: [f("hikaye.jpg")], usedFallback: [u.id], fallback: true, summary: `Paketleme (YEDEK): ${u.ad}` };
    }
  }
}

export const OUT_DIR = p("out");
