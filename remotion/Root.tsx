import React from "react";
import { AbsoluteFill, Composition, Still } from "remotion";
import "./fonts";
import { SERIF, upper } from "./fonts";
import { Post } from "./Post";
import { Story } from "./Story";
import { Video, videoDuration } from "./Video";
import { FPS, type Brand, type PostProps, type StoryProps, type VideoProps } from "./types";

// Studio'da açılınca görünen örnek veriler. Gerçek render'da inputProps ile ezilir.
const brand: Brand = {
  marka_adi: "Eşiler Triko",
  web: "esiler.com.tr",
  instagram: "@esilertriko",
  whatsapp: "+90 532 771 06 88",
  slogan: "60 yıldır aynı kalite, aynı güven",
  renkler: { zemin: "#F5F0E8", koyu: "#1C2B3A", vurgu: "#B5622C", bej: "#D4C5A9", metin: "#2D2D2D", acik_metin: "#7A7A7A", cizgi: "#E2D9CC" },
};

const Placeholder = "https://placehold.co/1200x1800/EDE6DA/1C2B3A.jpg?text=Esiler";

const demoUrun = {
  id: "demo",
  kod: "",
  ad: "Gönül Bahçesi Penye Bluz",
  kategori: "Penye",
  iplik: "Viskon Karışımlı",
  gramaj: "",
  beden: "M–XL",
  seri_adedi: "",
  renkler: [
    { ad: "Sütlü Kahve", hex: "#A57E5E" },
    { ad: "Bordo", hex: "#6D1F2B" },
    { ad: "Lacivert", hex: "#1F2A44" },
  ],
  foto: Placeholder,
};

// Logo: assets/logo.png bu kompozisyondan üretilir (şeffaf PNG).
const LogoMark: React.FC<{ brand: Brand }> = ({ brand }) => {
  const [first, ...rest] = brand.marka_adi.split(" ");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 120, letterSpacing: 18, color: brand.renkler.koyu, whiteSpace: "nowrap" }}>
        {upper(first)} <span style={{ color: brand.renkler.vurgu }}>{upper(rest.join(" "))}</span>
      </div>
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <>
    <Still id="Post" component={Post as React.FC<Record<string, unknown>>} width={1080} height={1350} defaultProps={{ kind: "urun_karti", brand, urun: demoUrun } satisfies PostProps} />
    <Still id="Story" component={Story as React.FC<Record<string, unknown>>} width={1080} height={1920} defaultProps={{ kind: "soru_cevap", brand } satisfies StoryProps} />
    <Composition
      id="Video"
      component={Video as React.FC<Record<string, unknown>>}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={
        {
          kind: "egitici",
          brand,
          baslik: "Toptan alımda bilmeniz gereken 3 şey",
          maddeler: [
            { baslik: "Seri mantığı", metin: "Ürünler beden serisi halinde gelir." },
            { baslik: "İplik içeriği", metin: "Tutuşu ve yıkamayı belirler." },
            { baslik: "Renk dağılımı", metin: "Koyu ve açık tonları dengeleyin." },
          ],
        } satisfies VideoProps
      }
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(videoDuration(props as VideoProps) * FPS) })}
    />
    <Still id="Logo" component={LogoMark as React.FC<Record<string, unknown>>} width={1500} height={220} defaultProps={{ brand }} />
  </>
);
