import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { CtaBand, Divider, Flower, Kicker, Logo, Paper, Photo, SwatchRow, Title, Wordmark } from "./components";
import { SANS, SERIF, upper } from "./fonts";
import { SAFE, type Brand, type ProductView, type StoryProps } from "./types";

// 1080x1920 hikâye görselleri. Üst ve alt 250px (SAFE) boş bırakılır:
// Instagram profil satırı ve yanıt kutusu bu alanları kaplar.

const Safe: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", top: SAFE, bottom: SAFE, left: 80, right: 80, display: "flex", flexDirection: "column", ...style }}>{children}</div>
);

const Footer: React.FC<{ brand: Brand }> = ({ brand }) => (
  <div style={{ display: "flex", justifyContent: "center", marginTop: "auto" }}>
    <CtaBand brand={brand} size={28} />
  </div>
);

const YeniGelenler: React.FC<{ brand: Brand; urunler: ProductView[] }> = ({ brand, urunler }) => {
  const list = urunler.slice(0, 4);
  const w = 430;
  const h = 520;
  return (
    <Paper brand={brand}>
      <Safe>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker brand={brand}>Bu hafta</Kicker>
          <Logo height={44} />
        </div>
        <Title brand={brand} size={118} italic style={{ marginTop: 26 }}>
          Yeni Gelenler
        </Title>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "34px 40px", marginTop: 40 }}>
          {list.map((u) => (
            <div key={u.id} style={{ width: w }}>
              <Photo src={u.foto} width={w} height={h} fit="cover" />
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 32, color: brand.renkler.koyu, marginTop: 12, lineHeight: 1.1 }}>{u.ad}</div>
              <div style={{ fontSize: 21, color: brand.renkler.acik_metin, marginTop: 4 }}>{`${u.renkler.length} renk · ${u.beden}`}</div>
            </div>
          ))}
        </div>
        <Footer brand={brand} />
      </Safe>
    </Paper>
  );
};

const Anket: React.FC<{ brand: Brand; a: ProductView; b: ProductView }> = ({ brand, a, b }) => {
  const Card: React.FC<{ u: ProductView; label: string }> = ({ u, label }) => (
    <div style={{ width: 440, position: "relative" }}>
      <Photo src={u.foto} width={440} height={660} />
      <div
        style={{
          position: "absolute",
          top: -38,
          left: 175,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: brand.renkler.vurgu,
          color: "#fff",
          fontFamily: SERIF,
          fontSize: 60,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `5px solid ${brand.renkler.zemin}`,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 32, color: brand.renkler.koyu, marginTop: 16, textAlign: "center", lineHeight: 1.1 }}>{u.ad}</div>
    </div>
  );
  return (
    <Paper brand={brand}>
      <Safe>
        <Kicker brand={brand} style={{ justifyContent: "center" }}>
          Anket
        </Kicker>
        <Title brand={brand} size={104} italic style={{ textAlign: "center", marginTop: 22 }}>
          Hangisi vitrininize?
        </Title>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 90 }}>
          <Card u={a} label="A" />
          <Card u={b} label="B" />
        </div>
        <div style={{ textAlign: "center", fontSize: 34, color: brand.renkler.metin, marginTop: 44, lineHeight: 1.45 }}>
          Cevabınızı DM'den yazın: <b style={{ color: brand.renkler.vurgu }}>A mı, B mi?</b>
        </div>
        <Footer brand={brand} />
      </Safe>
    </Paper>
  );
};

const SevkeHazir: React.FC<{ brand: Brand; urunler: ProductView[] }> = ({ brand, urunler }) => (
  <Paper brand={brand}>
    <Safe>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Kicker brand={brand}>Stoktan</Kicker>
        <Logo height={44} />
      </div>
      <Title brand={brand} size={112} italic style={{ marginTop: 26 }}>
        Sevke Hazır
      </Title>
      <div style={{ fontSize: 30, color: brand.renkler.acik_metin, marginTop: 10 }}>Bu modeller stokta, siparişinizle yola çıkar.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 44 }}>
        {urunler.slice(0, 3).map((u) => (
          <div key={u.id} style={{ display: "flex", gap: 32, alignItems: "center", background: "rgba(255,255,255,0.55)", borderRadius: 22, padding: 18 }}>
            <Photo src={u.foto} width={200} height={300} radius={14} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 44, color: brand.renkler.koyu, lineHeight: 1.05 }}>{u.ad}</div>
              <div style={{ fontSize: 24, color: brand.renkler.acik_metin, margin: "10px 0 18px" }}>
                {[u.beden, `${u.renkler.length} renk`].filter(Boolean).join(" · ")}
              </div>
              <SwatchRow chips={u.renkler} size={30} brand={brand} gap={8} max={10} />
            </div>
          </div>
        ))}
      </div>
      <Footer brand={brand} />
    </Safe>
  </Paper>
);

const Doku: React.FC<{ brand: Brand; urun: ProductView; foto: string; gercek: boolean }> = ({ brand, urun, foto, gercek }) => (
  <Paper brand={brand} motif={false}>
    <Safe>
      <Kicker brand={brand}>Yakından bakın</Kicker>
      <Title brand={brand} size={92} italic style={{ marginTop: 20 }}>
        Örgü ve işleme detayı
      </Title>
      <div style={{ position: "relative", marginTop: 40, width: 920, height: 900, borderRadius: 28, overflow: "hidden", background: "#EDE6DA" }}>
        {gercek ? (
          <Img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          // Gerçek yakın çekim yoksa ürün fotoğrafının göğüs/işleme bölgesi büyütülür.
          <Img
            src={foto}
            style={{ position: "absolute", width: 920 * 2.3, height: 920 * 2.3 * 1.5, left: -920 * 0.65, top: -920 * 2.3 * 1.5 * 0.24, objectFit: "cover" }}
          />
        )}
        {!gercek && (
          <div style={{ position: "absolute", right: 24, bottom: 24, padding: 8, background: brand.renkler.zemin, borderRadius: 16 }}>
            <Photo src={urun.foto} width={190} height={285} radius={10} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 34 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 44, color: brand.renkler.koyu }}>{urun.ad}</div>
        <div style={{ fontSize: 26, color: brand.renkler.acik_metin, marginTop: 8 }}>{[urun.iplik, urun.gramaj].filter(Boolean).join(" · ")}</div>
      </div>
      <Footer brand={brand} />
    </Safe>
  </Paper>
);

const SonSiparis: React.FC<{ brand: Brand; baslik: string; gun: string; saat: string }> = ({ brand, baslik, gun, saat }) => (
  <Paper brand={brand} dark>
    <Safe style={{ alignItems: "center", textAlign: "center" }}>
      <Wordmark brand={brand} size={40} light />
      <div style={{ marginTop: 120 }}>
        <Kicker brand={brand} light style={{ justifyContent: "center" }}>
          {baslik}
        </Kicker>
      </div>
      <Title brand={brand} size={120} light style={{ marginTop: 30 }}>
        Son sipariş
      </Title>
      <div style={{ position: "relative", width: 560, height: 560, marginTop: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Flower size={560} color={brand.renkler.bej} opacity={0.35} style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "relative", zIndex: 1, width: 380, height: 380, borderRadius: "50%", border: `2px solid ${brand.renkler.bej}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: brand.renkler.koyu }}>
          <div style={{ fontSize: 30, letterSpacing: 8, color: brand.renkler.bej }}>{upper(gun)}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 150, lineHeight: 1, color: brand.renkler.zemin }}>{saat}</div>
        </div>
      </div>
      <div style={{ fontSize: 34, color: "#E9E1D2", marginTop: 60, lineHeight: 1.5 }}>
        Bu saate kadar gelen siparişleriniz
        <br />
        hafta sonu beklemeden yola çıkar.
      </div>
      <div style={{ marginTop: "auto" }}>
        <CtaBand brand={brand} size={28} style={{ background: brand.renkler.vurgu }} />
      </div>
    </Safe>
  </Paper>
);

const SoruCevap: React.FC<{ brand: Brand }> = ({ brand }) => (
  <Paper brand={brand}>
    <Safe style={{ alignItems: "center", textAlign: "center" }}>
      <Logo height={50} />
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 560, lineHeight: 0.9, color: brand.renkler.vurgu, marginTop: 60 }}>?</div>
      <Kicker brand={brand} style={{ justifyContent: "center", marginTop: 30 }}>
        Soru – cevap
      </Kicker>
      <Title brand={brand} size={92} italic style={{ marginTop: 26 }}>
        Toptan alımla ilgili merak ettikleriniz
      </Title>
      <Divider brand={brand} width={200} style={{ margin: "44px 0" }} />
      <div style={{ fontSize: 34, lineHeight: 1.5, color: brand.renkler.metin }}>
        Seri, beden, renk, sevkiyat…
        <br />
        Sorularınızı DM'den gönderin, hemen yanıtlayalım.
      </div>
      <Footer brand={brand} />
    </Safe>
  </Paper>
);

const PaketlemeFoto: React.FC<{ brand: Brand; foto: string }> = ({ brand, foto }) => (
  <AbsoluteFill lang="tr" style={{ background: brand.renkler.koyu, fontFamily: SANS, fontVariantNumeric: "lining-nums" }}>
    <Img src={foto} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.5)" }} />
    <Img src={foto} style={{ position: "absolute", left: 0, right: 0, top: SAFE + 200, width: "100%", height: 1040, objectFit: "contain" }} />
    <div style={{ position: "absolute", top: SAFE, left: 80, right: 80 }}>
      <Kicker brand={brand} light>
        Paketleme ve kargo
      </Kicker>
      <Title brand={brand} size={96} italic light style={{ marginTop: 18 }}>
        Siparişleriniz yolda
      </Title>
    </div>
    <div style={{ position: "absolute", bottom: SAFE, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <CtaBand brand={brand} size={28} style={{ background: brand.renkler.vurgu }} />
    </div>
  </AbsoluteFill>
);

// Gerçek paketleme fotoğrafı yoksa: çizgi kutu illüstrasyonu + ürün.
const PaketlemeYedek: React.FC<{ brand: Brand; urun: ProductView }> = ({ brand, urun }) => {
  const c = brand.renkler;
  return (
    <Paper brand={brand}>
      <Safe style={{ alignItems: "center", textAlign: "center" }}>
        <Kicker brand={brand} style={{ justifyContent: "center" }}>
          Paketleme ve kargo
        </Kicker>
        <Title brand={brand} size={100} italic style={{ marginTop: 22 }}>
          Özenle paketlendi
        </Title>
        <div style={{ position: "relative", width: 900, height: 820, marginTop: 50 }}>
          <svg viewBox="0 0 900 820" width={900} height={820} fill="none" stroke={c.koyu} strokeWidth={3} strokeLinejoin="round" style={{ position: "absolute", inset: 0 }}>
            <path d="M120 360 L450 250 L780 360 L780 700 L450 800 L120 700 Z" fill="#EFE6D6" />
            <path d="M120 360 L450 470 L780 360" />
            <path d="M450 470 L450 800" />
            <path d="M120 360 L40 250 L370 140 L450 250" stroke={c.vurgu} />
            <path d="M780 360 L860 250 L530 140 L450 250" stroke={c.vurgu} />
            <path d="M260 520 Q300 560 340 520 Q380 480 420 520" stroke={c.bej} strokeWidth={4} />
            <path d="M540 520 Q580 560 620 520 Q660 480 700 520" stroke={c.bej} strokeWidth={4} />
          </svg>
          <div style={{ position: "absolute", left: 330, top: 0, padding: 10, background: c.zemin, borderRadius: 18, transform: "rotate(-4deg)", boxShadow: "0 18px 40px rgba(28,43,58,0.18)" }}>
            <Photo src={urun.foto} width={240} height={360} radius={12} />
          </div>
        </div>
        <div style={{ fontSize: 34, lineHeight: 1.5, color: c.metin, marginTop: 30 }}>
          Her seri tek tek kontrol edilir,
          <br />
          katlanır ve kargoya hazırlanır.
        </div>
        <Footer brand={brand} />
      </Safe>
    </Paper>
  );
};

export const Story: React.FC<StoryProps> = (p) => {
  switch (p.kind) {
    case "yeni_gelenler":
      return <YeniGelenler brand={p.brand} urunler={p.urunler} />;
    case "anket":
      return <Anket brand={p.brand} a={p.a} b={p.b} />;
    case "sevke_hazir":
      return <SevkeHazir brand={p.brand} urunler={p.urunler} />;
    case "doku":
      return <Doku {...p} />;
    case "son_siparis":
      return <SonSiparis brand={p.brand} baslik={p.baslik} gun={p.gun} saat={p.saat} />;
    case "soru_cevap":
      return <SoruCevap brand={p.brand} />;
    case "paketleme_foto":
      return <PaketlemeFoto brand={p.brand} foto={p.foto} />;
    case "paketleme_yedek":
      return <PaketlemeYedek brand={p.brand} urun={p.urun} />;
  }
};
