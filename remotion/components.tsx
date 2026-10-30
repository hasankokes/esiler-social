import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SANS, SERIF, upper } from "./fonts";
import type { Brand, ColorChip } from "./types";

// Gün çiçeği çizgi motifi (sitedeki gun-cicegi.svg ile aynı).
export const Flower: React.FC<{ size: number; color: string; opacity?: number; style?: React.CSSProperties }> = ({
  size,
  color,
  opacity = 1,
  style,
}) => (
  <svg viewBox="0 0 200 200" width={size} height={size} fill="none" stroke={color} strokeWidth={2} style={{ opacity, ...style }}>
    <circle cx="100" cy="100" r="30" />
    {Array.from({ length: 12 }, (_, i) => (
      <path key={i} d="M100 70 Q105 40 100 10 Q95 40 100 70" transform={`rotate(${i * 30} 100 100)`} />
    ))}
  </svg>
);

// Krem zemin + ince bej çerçeve + köşelerde silik çiçek motifi.
export const Paper: React.FC<{ brand: Brand; children: React.ReactNode; dark?: boolean; motif?: boolean }> = ({
  brand,
  children,
  dark,
  motif = true,
}) => {
  const c = brand.renkler;
  return (
    <AbsoluteFill lang="tr" style={{ backgroundColor: dark ? c.koyu : c.zemin, fontFamily: SANS, color: dark ? c.zemin : c.metin, fontVariantNumeric: "lining-nums" }}>
      {motif && (
        <>
          <Flower size={420} color={c.bej} opacity={dark ? 0.12 : 0.45} style={{ position: "absolute", right: -140, top: -140 }} />
          <Flower size={300} color={c.bej} opacity={dark ? 0.1 : 0.35} style={{ position: "absolute", left: -110, bottom: -110 }} />
        </>
      )}
      <div style={{ position: "absolute", inset: 32, border: `1.5px solid ${dark ? "rgba(212,197,169,0.35)" : c.bej}`, borderRadius: 6 }} />
      {children}
    </AbsoluteFill>
  );
};

export const Logo: React.FC<{ height: number; style?: React.CSSProperties }> = ({ height, style }) => (
  <Img src={staticFile("logo.png")} style={{ height, width: "auto", ...style }} />
);

// Logo görseli olmayan koyu zeminler için yazı logosu.
export const Wordmark: React.FC<{ brand: Brand; size: number; light?: boolean }> = ({ brand, size, light }) => {
  const [first, ...rest] = brand.marka_adi.split(" ");
  return (
    <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: size, letterSpacing: size * 0.15, color: light ? brand.renkler.zemin : brand.renkler.koyu }}>
      {upper(first)} <span style={{ color: light ? brand.renkler.bej : brand.renkler.vurgu }}>{upper(rest.join(" "))}</span>
    </div>
  );
};

export const Kicker: React.FC<{ brand: Brand; children: string; size?: number; light?: boolean; style?: React.CSSProperties }> = ({
  brand,
  children,
  size = 26,
  light,
  style,
}) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: size,
      fontWeight: 500,
      letterSpacing: size * 0.28,
      color: light ? brand.renkler.bej : brand.renkler.vurgu,
      display: "flex",
      alignItems: "center",
      gap: 18,
      ...style,
    }}
  >
    <span style={{ width: 46, height: 1.5, background: "currentColor", display: "inline-block" }} />
    {upper(children)}
  </div>
);

export const Title: React.FC<{ brand: Brand; children: React.ReactNode; size: number; italic?: boolean; light?: boolean; style?: React.CSSProperties }> = ({
  brand,
  children,
  size,
  italic,
  light,
  style,
}) => (
  <div
    style={{
      fontFamily: SERIF,
      fontWeight: italic ? 500 : 600,
      fontStyle: italic ? "italic" : "normal",
      fontSize: size,
      lineHeight: 1.02,
      color: light ? brand.renkler.zemin : brand.renkler.koyu,
      ...style,
    }}
  >
    {children}
  </div>
);

// Ürün fotoğrafı: asla kırpılmaz (contain); boşluklar yumuşak bej zeminle dolar.
export const Photo: React.FC<{ src: string; width: number; height: number; radius?: number; style?: React.CSSProperties; fit?: "contain" | "cover" }> = ({
  src,
  width,
  height,
  radius = 18,
  style,
  fit = "contain",
}) => (
  <div style={{ width, height, borderRadius: radius, overflow: "hidden", background: "#EDE6DA", flexShrink: 0, ...style }}>
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: "center top" }} />
  </div>
);

export const Swatch: React.FC<{ chip: ColorChip; size: number; brand: Brand }> = ({ chip, size, brand }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: chip.hex,
      border: `2px solid ${brand.renkler.zemin}`,
      boxShadow: `0 0 0 1.5px ${brand.renkler.bej}`,
      flexShrink: 0,
    }}
  />
);

export const SwatchRow: React.FC<{ chips: ColorChip[]; size: number; brand: Brand; gap?: number; max?: number }> = ({
  chips,
  size,
  brand,
  gap = 12,
  max = 14,
}) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap }}>
    {chips.slice(0, max).map((c) => (
      <Swatch key={c.ad} chip={c} size={size} brand={brand} />
    ))}
  </div>
);

// "Sipariş ve fiyat için DM" bandı (brand.yaml'da numara varsa WhatsApp numarası da yazar).
export const CtaBand: React.FC<{ brand: Brand; size?: number; style?: React.CSSProperties }> = ({ brand, size = 30, style }) => (
  <div
    style={{
      background: brand.renkler.koyu,
      color: brand.renkler.zemin,
      fontFamily: SANS,
      fontSize: size,
      padding: `${size * 0.7}px ${size * 1.2}px`,
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      gap: size * 0.6,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {brand.whatsapp ? <WhatsAppIcon size={size * 1.25} color={brand.renkler.bej} /> : <DmIcon size={size * 1.15} color={brand.renkler.bej} />}
    {brand.whatsapp ? (
      <span>
        Sipariş ve fiyat için <b style={{ fontWeight: 700 }}>{brand.whatsapp}</b> / DM
      </span>
    ) : (
      <span>
        Sipariş ve fiyat için <b style={{ fontWeight: 700 }}>DM</b>
      </span>
    )}
  </div>
);

// Instagram mesaj (kâğıt uçak) simgesi
export const DmIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 3 3 10.2l7.4 2.9L21.5 3z" />
    <path d="M21.5 3 15.6 21l-5.2-7.9" />
  </svg>
);

export const WhatsAppIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
    <path d="M9 8.6c.2 1.9 2.4 4.6 4.6 5.3l1.2-1.1 1.9.9c-.2 1-1 1.8-2 1.8-3.1 0-6.6-3.4-6.6-6.5 0-1 .8-1.8 1.8-2l.9 1.9z" />
  </svg>
);

export const Divider: React.FC<{ brand: Brand; width?: number | string; style?: React.CSSProperties }> = ({ brand, width = "100%", style }) => (
  <div style={{ width, height: 1.5, background: brand.renkler.cizgi, ...style }} />
);
