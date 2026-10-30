import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { CtaBand, Divider, Kicker, Logo, Paper, Photo, Swatch, SwatchRow, Title } from "./components";
import { SANS, SERIF, upper } from "./fonts";
import type { Brand, PostProps, ProductView } from "./types";

// 1080x1350 gönderi görselleri (renderStill).

const Specs: React.FC<{ brand: Brand; urun: ProductView }> = ({ brand, urun }) => {
  const rows: [string, string][] = (
    [
      ["İplik", urun.iplik],
      ["Gramaj", urun.gramaj],
      ["Beden serisi", urun.beden],
      ["Seri adedi", urun.seri_adedi],
      ["Renk", `${urun.renkler.length} seçenek`],
    ] as [string, string][]
  ).filter(([, v]) => v && v.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "20px 0", gap: 20 }}>
            <span style={{ fontSize: 22, letterSpacing: 4, color: brand.renkler.acik_metin }}>{upper(k)}</span>
            <span style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 600, color: brand.renkler.koyu, textAlign: "right" }}>{v}</span>
          </div>
          <Divider brand={brand} />
        </div>
      ))}
    </div>
  );
};

const Header: React.FC<{ brand: Brand; kicker: string; right?: string }> = ({ brand, kicker, right }) => (
  <div style={{ position: "absolute", top: 78, left: 80, right: 80, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <Kicker brand={brand}>{kicker}</Kicker>
    {right ? (
      <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 34, color: brand.renkler.acik_metin }}>{right}</span>
    ) : (
      <Logo height={46} />
    )}
  </div>
);

const UrunKarti: React.FC<{ brand: Brand; urun: ProductView }> = ({ brand, urun }) => (
  <Paper brand={brand}>
    <Header brand={brand} kicker="Ürün kartı" />
    <div style={{ position: "absolute", top: 200, left: 80, right: 80, display: "flex", gap: 56 }}>
      <Photo src={urun.foto} width={520} height={780} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 10 }}>
        {urun.kod ? <div style={{ fontSize: 24, letterSpacing: 5, color: brand.renkler.vurgu, marginBottom: 14 }}>{upper(urun.kod)}</div> : null}
        <Title brand={brand} size={62}>
          {urun.ad}
        </Title>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 32, color: brand.renkler.acik_metin, margin: "14px 0 26px" }}>{urun.kategori}</div>
        <Divider brand={brand} />
        <Specs brand={brand} urun={urun} />
        <div style={{ marginTop: 30 }}>
          <SwatchRow chips={urun.renkler} size={38} brand={brand} gap={10} />
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", bottom: 90, left: 80, right: 80, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 44, fontStyle: "italic", color: brand.renkler.vurgu }}>Seri halinde toptan</div>
      <CtaBand brand={brand} size={24} />
    </div>
  </Paper>
);

const KartelaKapak: React.FC<{ brand: Brand; urun: ProductView; toplam: number }> = ({ brand, urun, toplam }) => (
  <Paper brand={brand}>
    <Header brand={brand} kicker="Renk kartelası" />
    <div style={{ position: "absolute", top: 170, left: 80, right: 80, display: "flex", gap: 56, alignItems: "stretch" }}>
      <Photo src={urun.foto} width={460} height={690} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 160, lineHeight: 0.9, fontWeight: 600, color: brand.renkler.vurgu }}>{urun.renkler.length}</div>
        <div style={{ fontSize: 28, letterSpacing: 8, color: brand.renkler.koyu, marginBottom: 28 }}>{upper("renk seçeneği")}</div>
        <Title brand={brand} size={58} italic>
          {urun.ad}
        </Title>
        <div style={{ fontSize: 26, color: brand.renkler.acik_metin, marginTop: 18 }}>
          {[urun.iplik, urun.beden].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", top: 900, left: 80, right: 80 }}>
      <Divider brand={brand} style={{ marginBottom: 30 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "22px 30px" }}>
        {urun.renkler.slice(0, 14).map((c) => (
          <div key={c.ad} style={{ display: "flex", alignItems: "center", gap: 12, width: 205 }}>
            <Swatch chip={c} size={40} brand={brand} />
            <span style={{ fontSize: 24, color: brand.renkler.metin }}>{c.ad}</span>
          </div>
        ))}
      </div>
    </div>
    <div style={{ position: "absolute", bottom: 80, right: 80, fontFamily: SERIF, fontStyle: "italic", fontSize: 36, color: brand.renkler.acik_metin }}>
      {toplam > 1 ? "Kaydırın →" : ""}
    </div>
  </Paper>
);

const KartelaRenk: React.FC<{ brand: Brand; urun: ProductView; renk: { ad: string; hex: string }; foto: string; sira: number; toplam: number }> = ({
  brand,
  urun,
  renk,
  foto,
  sira,
  toplam,
}) => (
  <Paper brand={brand} motif={false}>
    <AbsoluteFill style={{ background: renk.hex, opacity: 0.12 }} />
    <Header brand={brand} kicker={urun.ad} right={`${sira} / ${toplam}`} />
    <div style={{ position: "absolute", top: 160, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <Photo src={foto} width={640} height={960} radius={24} />
    </div>
    <div style={{ position: "absolute", bottom: 78, left: 80, right: 80, display: "flex", alignItems: "center", gap: 26 }}>
      <Swatch chip={renk} size={84} brand={brand} />
      <div>
        <div style={{ fontSize: 22, letterSpacing: 6, color: brand.renkler.acik_metin }}>{upper("renk")}</div>
        <Title brand={brand} size={68}>
          {renk.ad}
        </Title>
      </div>
    </div>
  </Paper>
);

const KartelaSon: React.FC<{ brand: Brand; urun: ProductView }> = ({ brand, urun }) => (
  <Paper brand={brand} dark>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 110 }}>
      <Kicker brand={brand} light style={{ justifyContent: "center", marginBottom: 40 }}>
        {urun.ad}
      </Kicker>
      <Title brand={brand} size={96} italic light>
        Hangi renk sizin vitrininize?
      </Title>
      <div style={{ margin: "60px 0 70px", display: "flex", justifyContent: "center" }}>
        <SwatchRow chips={urun.renkler} size={56} brand={brand} gap={16} />
      </div>
      <div style={{ fontSize: 34, color: "#E9E1D2", lineHeight: 1.5 }}>
        Seri halinde toptan sipariş ve fiyat için
        <br />
        {brand.whatsapp ? (
          <>
            <b style={{ fontWeight: 700, color: "#fff" }}>WhatsApp {brand.whatsapp}</b> / DM
          </>
        ) : (
          <b style={{ fontWeight: 700, color: "#fff" }}>DM'den yazın</b>
        )}
      </div>
      <div style={{ marginTop: 90, fontFamily: SERIF, fontWeight: 600, fontSize: 40, letterSpacing: 7, color: brand.renkler.bej }}>
        {upper(brand.marka_adi)}
      </div>
    </AbsoluteFill>
  </Paper>
);

const Vitrin: React.FC<{ brand: Brand; foto: string; sira: number; toplam: number }> = ({ brand, foto, sira, toplam }) => (
  <AbsoluteFill lang="tr" style={{ background: brand.renkler.koyu, fontFamily: SANS, fontVariantNumeric: "lining-nums" }}>
    <Img src={foto} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.55)" }} />
    <Img src={foto} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1130, objectFit: "contain", objectPosition: "center top" }} />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
        background: brand.renkler.zemin,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 80px",
      }}
    >
      <div>
        <Kicker brand={brand}>Müşteri vitrini</Kicker>
        <Title brand={brand} size={56} italic style={{ marginTop: 12 }}>
          Vitrin sizin, kalite bizden
        </Title>
      </div>
      {toplam > 1 ? <div style={{ fontFamily: SERIF, fontSize: 34, color: brand.renkler.acik_metin }}>{`${sira}/${toplam}`}</div> : <Logo height={52} />}
    </div>
  </AbsoluteFill>
);

const VitrinYedek: React.FC<{ brand: Brand; urun: ProductView }> = ({ brand, urun }) => (
  <Paper brand={brand}>
    <Header brand={brand} kicker="Vitrininize yakışacak" />
    <div style={{ position: "absolute", top: 170, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <Photo src={urun.foto} width={600} height={900} radius={24} />
    </div>
    <div style={{ position: "absolute", bottom: 80, left: 80, right: 80, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <Title brand={brand} size={58}>
          {urun.ad}
        </Title>
        <div style={{ fontSize: 26, color: brand.renkler.acik_metin, marginTop: 12 }}>
          {[`${urun.renkler.length} renk`, urun.beden].filter(Boolean).join(" · ")}
        </div>
      </div>
      <SwatchRow chips={urun.renkler} size={34} brand={brand} gap={8} max={6} />
    </div>
  </Paper>
);

export const Post: React.FC<PostProps> = (p) => {
  switch (p.kind) {
    case "urun_karti":
      return <UrunKarti brand={p.brand} urun={p.urun} />;
    case "kartela_kapak":
      return <KartelaKapak brand={p.brand} urun={p.urun} toplam={p.toplam} />;
    case "kartela_renk":
      return <KartelaRenk {...p} />;
    case "kartela_son":
      return <KartelaSon brand={p.brand} urun={p.urun} />;
    case "vitrin":
      return <Vitrin {...p} />;
    case "vitrin_yedek":
      return <VitrinYedek brand={p.brand} urun={p.urun} />;
  }
};
