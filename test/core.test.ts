import assert from "node:assert/strict";
import { test } from "node:test";
import { fill, hashtags, buildCaption } from "../src/captions.js";
import { loadConfig, type Config } from "../src/config.js";
import { ensurePlan, pickProducts, markFeatured } from "../src/planner.js";
import { findDue } from "../src/runner.js";
import { channelsFor, isoWeek, occurrencesBetween, zonedTime } from "../src/schedule.js";
import { recordError, recordPost, type State } from "../src/state.js";

const cfg = loadConfig();
const emptyState = (): State => ({ surum: 1, yayin_baslangic: null, paylasimlar: {}, planlar: {}, one_cikanlar: {}, kullanilan_medya: {}, sayaclar: {} });
const tz = "Europe/Istanbul";

test("Türkiye saati UTC+3'e çevrilir", () => {
  assert.equal(zonedTime("2026-11-02", "08:30", tz).toISOString(), "2026-11-02T05:30:00.000Z");
});

test("bir haftada takvimdeki 13 slot var, sıralı ve doğru günlerde", () => {
  const occ = occurrencesBetween(cfg, zonedTime("2026-11-02", "00:00", tz), zonedTime("2026-11-08", "23:59", tz));
  assert.equal(occ.length, 13);
  assert.equal(occ[0].key, "2026-11-02_pzt-yeni-gelenler");
  assert.equal(occ.at(-1)!.key, "2026-11-07_cmt-soru-cevap");
  assert.ok(occ.every((o, i) => i === 0 || o.at >= occ[i - 1].at));
  assert.equal(isoWeek("2026-11-02"), "2026-W45");
});

test("tatil günleri atlanır", () => {
  const c: Config = { ...cfg, schedule: { ...cfg.schedule, tatiller: ["2026-11-02"] } };
  const occ = occurrencesBetween(c, zonedTime("2026-11-02", "00:00", tz), zonedTime("2026-11-02", "23:59", tz));
  assert.equal(occ.length, 0);
});

test("kanal şalteri ve slot ayarı", () => {
  const slot = { ...cfg.schedule.slotlar[0], kanallar: { facebook: false } };
  assert.deepEqual(channelsFor(cfg, slot), ["instagram"]);
  const off: Config = { ...cfg, schedule: { ...cfg.schedule, kanallar: { instagram: false, facebook: true } } };
  assert.deepEqual(channelsFor(off, cfg.schedule.slotlar[0]), ["facebook"]);
});

test("gecikmiş slot atlanmaz; paylaşılan kanal tekrar paylaşılmaz", () => {
  const state = emptyState();
  state.yayin_baslangic = "2026-11-02T00:00:00Z";
  // Pazartesi 12:30 slotu, cron 3 saat gecikmiş olsa da sırada
  const now = zonedTime("2026-11-02", "15:45", tz);
  const keys = findDue(cfg, state, now).map((o) => o.key);
  assert.deepEqual(keys, ["2026-11-02_pzt-yeni-gelenler", "2026-11-02_pzt-kartela"]);
  recordPost(state, "2026-11-02_pzt-yeni-gelenler", "instagram", { id: "1", zaman: "" });
  recordPost(state, "2026-11-02_pzt-yeni-gelenler", "facebook", { id: "2", zaman: "" });
  recordPost(state, "2026-11-02_pzt-kartela", "instagram", { id: "3", zaman: "" });
  // Facebook hata verdiyse sadece o kanal tekrar denenir
  recordError(state, "2026-11-02_pzt-kartela", "facebook", "test");
  assert.deepEqual(findDue(cfg, state, now).map((o) => o.key), ["2026-11-02_pzt-kartela"]);
  recordPost(state, "2026-11-02_pzt-kartela", "facebook", { id: "4", zaman: "" });
  assert.deepEqual(findDue(cfg, state, now), []);
});

test("yayın başlangıcından önceki slotlar paylaşılmaz", () => {
  const state = emptyState();
  state.yayin_baslangic = zonedTime("2026-11-02", "10:00", tz).toISOString();
  const keys = findDue(cfg, state, zonedTime("2026-11-02", "13:00", tz)).map((o) => o.key);
  assert.deepEqual(keys, ["2026-11-02_pzt-kartela"]);
});

test("aynı ürün 14 gün içinde tekrar öne çıkmaz", () => {
  const state = emptyState();
  const first = pickProducts(cfg, state, 1, "2026-11-02")[0];
  markFeatured(state, [first.id], "2026-11-02");
  const within = pickProducts(cfg, state, 5, "2026-11-10").map((u) => u.id);
  assert.ok(!within.includes(first.id));
  // Herkes yakın zamanda gösterildiyse, 14 günü dolan ürün geri döner
  for (const u of cfg.products) if (u.id !== first.id) markFeatured(state, [u.id], "2026-11-15");
  assert.equal(pickProducts(cfg, state, 1, "2026-11-16")[0].id, first.id);
});

test("haftalık planlarda ürün kartı, kartela ve renk Reels'i farklı ürünler", () => {
  const state = emptyState();
  const occ = occurrencesBetween(cfg, zonedTime("2026-11-02", "00:00", tz), zonedTime("2026-11-15", "23:59", tz));
  const featured = occ.flatMap((o) => (["renk_kartelasi", "urun_karti", "tek_model_renkler", "doku_yakin", "anket"].includes(o.slot.icerik) ? ensurePlan(cfg, state, o).urunler : []));
  assert.equal(new Set(featured).size, featured.length, "iki hafta içinde tekrar eden ürün var");
});

test("boş alan içeren açıklama satırı silinir", () => {
  assert.equal(fill("Ad: {ad}\nGramaj: {gramaj}\nSon", { ad: "Bluz", gramaj: "" }), "Ad: Bluz\nSon");
});

test("etiket sayısı: Instagram 3–5, Facebook 2; açıklama DM satırıyla biter, numara yok", () => {
  for (let i = 0; i < 10; i++) {
    const ig = hashtags(cfg, "instagram", i).split(" ");
    assert.ok(ig.length >= 3 && ig.length <= 5, `ig ${ig.length}`);
    assert.ok(ig.includes("#esilertriko"));
    assert.equal(hashtags(cfg, "facebook", i).split(" ").length, 2);
  }
  const cap = buildCaption(cfg, "urun_karti", 0, cfg.products[0], "instagram");
  assert.match(cap, /\n\nSipariş ve fiyat için DM\n\n#/);
  assert.doesNotMatch(cap, /WhatsApp|\+90/);
  const withNumber = buildCaption({ ...cfg, brand: { ...cfg.brand, whatsapp: "+90 500 000 00 00" } }, "urun_karti", 0, cfg.products[0], "instagram");
  assert.match(withNumber, /Sipariş ve fiyat için WhatsApp: \+90 500 000 00 00 \/ DM/);
  assert.doesNotMatch(cap, /Gramaj/); // gramaj boş
});

test("aynı kumaştan modeller aynı içerikte yan yana seçilmez", () => {
  const state = emptyState();
  const occ = occurrencesBetween(cfg, zonedTime("2026-11-03", "00:00", tz), zonedTime("2026-11-03", "23:59", tz)).find((o) => o.slot.icerik === "sevke_hazir")!;
  const ids = ensurePlan(cfg, state, occ).urunler;
  const kumas = ids.map((id) => cfg.products.find((u) => u.id === id)!).map((u) => u.kumas || u.iplik);
  assert.equal(new Set(kumas).size, ids.length, `sevke hazır: ${kumas.join(", ")}`);
});
