import React from "react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CtaBand, Kicker, Logo, Paper, Photo, Swatch, SwatchRow, Title, Wordmark } from "./components";
import { SERIF, upper } from "./fonts";
import { FPS, SAFE, type Brand, type VideoProps } from "./types";

// 1080x1920 Reels ve video hikâye. Süreler saniye cinsinden; toplam süre videoDuration() ile hesaplanır.

export const INTRO = 2.5;
export const OUTRO = 3;
const PER_COLOR = 3.5;
const PER_TIP = 6;
const PER_PRODUCT = 4;
const MAX_CLIP = 5;

export const clipLengths = (klipler: { sure: number }[]) => {
  // Klipler en fazla 5 sn kullanılır; toplam 15–30 sn aralığına sığdırılır.
  let parts = klipler.map((k) => Math.min(k.sure, MAX_CLIP));
  const maxBody = 30 - INTRO - OUTRO;
  let total = parts.reduce((a, b) => a + b, 0);
  while (total > maxBody && parts.length > 1) {
    parts = parts.slice(0, -1);
    total = parts.reduce((a, b) => a + b, 0);
  }
  if (total > maxBody) parts = [maxBody];
  return parts;
};

export const videoDuration = (p: VideoProps): number => {
  switch (p.kind) {
    case "klipler": {
      const body = clipLengths(p.klipler).reduce((a, b) => a + b, 0);
      return Math.max(p.hikaye ? 5 : 15, (p.hikaye ? 0 : INTRO) + body + OUTRO);
    }
    case "renkler":
      return INTRO + p.kareler.length * PER_COLOR + OUTRO;
    case "egitici":
      return 3 + p.maddeler.length * PER_TIP + OUTRO;
    case "urun_montaj":
      return INTRO + p.urunler.length * PER_PRODUCT + OUTRO;
  }
};

const s = (sec: number) => Math.round(sec * FPS);

const useIn = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
};

const FadeUp: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const p = useIn(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, ...style }}>{children}</div>;
};

const Intro: React.FC<{ brand: Brand; kicker: string; title: string }> = ({ brand, kicker, title }) => (
  <Paper brand={brand}>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `${SAFE}px 90px` }}>
      <FadeUp>
        <Kicker brand={brand} style={{ justifyContent: "center" }}>
          {kicker}
        </Kicker>
      </FadeUp>
      <FadeUp delay={6}>
        <Title brand={brand} size={124} italic style={{ marginTop: 30 }}>
          {title}
        </Title>
      </FadeUp>
    </AbsoluteFill>
  </Paper>
);

const Outro: React.FC<{ brand: Brand }> = ({ brand }) => (
  <Paper brand={brand} dark>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `${SAFE}px 80px` }}>
      <FadeUp>
        <Wordmark brand={brand} size={64} light />
      </FadeUp>
      <FadeUp delay={6}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 50, color: "#E9E1D2", margin: "36px 0 80px" }}>{brand.slogan}</div>
      </FadeUp>
      <FadeUp delay={12}>
        <CtaBand brand={brand} size={30} style={{ background: brand.renkler.vurgu }} />
      </FadeUp>
    </AbsoluteFill>
  </Paper>
);

const Music: React.FC<{ src?: string; total: number }> = ({ src, total }) => {
  if (!src) return null;
  const frames = s(total);
  return <Audio src={src} volume={(f) => interpolate(f, [0, 15, frames - 30, frames], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />;
};

// Ham kliplerden kurgu (atölye / paketleme).
const Klipler: React.FC<Extract<VideoProps, { kind: "klipler" }>> = (p) => {
  const lens = clipLengths(p.klipler);
  const introLen = p.hikaye ? 0 : INTRO;
  let at = introLen;
  return (
    <AbsoluteFill style={{ background: p.brand.renkler.koyu }}>
      {!p.hikaye && (
        <Sequence durationInFrames={s(INTRO)}>
          <Intro brand={p.brand} kicker="Atölyemizden" title={p.baslik} />
        </Sequence>
      )}
      {lens.map((len, i) => {
        const from = at;
        at += len;
        return (
          <Sequence key={i} from={s(from)} durationInFrames={s(len)}>
            <AbsoluteFill>
              <OffthreadVideo src={p.klipler[i].url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {p.hikaye && i === 0 && (
                <div style={{ position: "absolute", top: SAFE, left: 80, right: 80 }}>
                  <Kicker brand={p.brand} light>
                    Paketleme ve kargo
                  </Kicker>
                  <Title brand={p.brand} size={90} italic light style={{ marginTop: 16, textShadow: "0 4px 30px rgba(0,0,0,0.45)" }}>
                    {p.baslik}
                  </Title>
                </div>
              )}
              <div style={{ position: "absolute", bottom: SAFE, left: 80, padding: "16px 26px", borderRadius: 999, background: "rgba(28,43,58,0.6)" }}>
                <Logo height={34} style={{ filter: "brightness(0) invert(1)", display: "block" }} />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Sequence from={s(at)}>
        <Outro brand={p.brand} />
      </Sequence>
      <Music src={p.muzik} total={videoDuration(p)} />
    </AbsoluteFill>
  );
};

// Tek model çok renk geçişi.
const ColorSlide: React.FC<{ brand: Brand; renk: { ad: string; hex: string }; foto: string; i: number; n: number; ad: string }> = ({ brand, renk, foto, i, n, ad }) => {
  const frame = useCurrentFrame();
  const p = useIn(0);
  const zoom = interpolate(frame, [0, s(PER_COLOR)], [1, 1.04]);
  return (
    <AbsoluteFill lang="tr" style={{ background: brand.renkler.zemin, fontVariantNumeric: "lining-nums" }}>
      <AbsoluteFill style={{ background: renk.hex, opacity: 0.16 }} />
      <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
        <div style={{ position: "absolute", top: SAFE + 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `scale(${zoom})` }}>
            <Photo src={foto} width={780} height={1170} radius={28} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: SAFE - 120, left: 80, right: 80, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 26, letterSpacing: 6, color: brand.renkler.acik_metin }}>{upper(ad)}</span>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: brand.renkler.acik_metin }}>{`${i + 1}/${n}`}</span>
      </div>
      <FadeUp delay={8} style={{ position: "absolute", bottom: SAFE - 60, left: 80, right: 80, display: "flex", alignItems: "center", gap: 28 }}>
        <Swatch chip={renk} size={96} brand={brand} />
        <Title brand={brand} size={92}>
          {renk.ad}
        </Title>
      </FadeUp>
    </AbsoluteFill>
  );
};

const Renkler: React.FC<Extract<VideoProps, { kind: "renkler" }>> = (p) => {
  const n = p.kareler.length;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(INTRO)}>
        <Intro brand={p.brand} kicker={p.urun.ad} title={`Tek model, ${n} renk`} />
      </Sequence>
      {p.kareler.map((k, i) => (
        <Sequence key={k.renk.ad} from={s(INTRO + i * PER_COLOR)} durationInFrames={s(PER_COLOR)}>
          <ColorSlide brand={p.brand} renk={k.renk} foto={k.foto} i={i} n={n} ad={p.urun.ad} />
        </Sequence>
      ))}
      <Sequence from={s(INTRO + n * PER_COLOR)}>
        <Outro brand={p.brand} />
      </Sequence>
      <Music src={p.muzik} total={videoDuration(p)} />
    </AbsoluteFill>
  );
};

// Metin kartlı eğitici Reels.
const TipCard: React.FC<{ brand: Brand; no: number; baslik: string; metin: string }> = ({ brand, no, baslik, metin }) => (
  <Paper brand={brand}>
    <AbsoluteFill style={{ padding: `${SAFE + 80}px 90px`, justifyContent: "center" }}>
      <FadeUp>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 300, lineHeight: 0.8, color: brand.renkler.vurgu }}>{no}</div>
      </FadeUp>
      <FadeUp delay={6}>
        <Title brand={brand} size={104} style={{ marginTop: 40 }}>
          {baslik}
        </Title>
      </FadeUp>
      <FadeUp delay={14}>
        <div style={{ width: 120, height: 2, background: brand.renkler.bej, margin: "44px 0" }} />
        <div style={{ fontSize: 46, lineHeight: 1.45, color: brand.renkler.metin }}>{metin}</div>
      </FadeUp>
    </AbsoluteFill>
  </Paper>
);

const Egitici: React.FC<Extract<VideoProps, { kind: "egitici" }>> = (p) => (
  <AbsoluteFill>
    <Sequence durationInFrames={s(3)}>
      <Paper brand={p.brand} dark>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `${SAFE}px 90px` }}>
          <FadeUp>
            <Kicker brand={p.brand} light style={{ justifyContent: "center" }}>
              Butik sahipleri için
            </Kicker>
          </FadeUp>
          <FadeUp delay={6}>
            <Title brand={p.brand} size={120} italic light style={{ marginTop: 34 }}>
              {p.baslik}
            </Title>
          </FadeUp>
        </AbsoluteFill>
      </Paper>
    </Sequence>
    {p.maddeler.map((m, i) => (
      <Sequence key={i} from={s(3 + i * PER_TIP)} durationInFrames={s(PER_TIP)}>
        <TipCard brand={p.brand} no={i + 1} baslik={m.baslik} metin={m.metin} />
      </Sequence>
    ))}
    <Sequence from={s(3 + p.maddeler.length * PER_TIP)}>
      <Outro brand={p.brand} />
    </Sequence>
    <Music src={p.muzik} total={videoDuration(p)} />
  </AbsoluteFill>
);

// Atölye klibi yokken kullanılan yedek: ürün fotoğraflarından montaj.
const ProductSlide: React.FC<{ brand: Brand; u: Extract<VideoProps, { kind: "urun_montaj" }>["urunler"][number] }> = ({ brand, u }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, s(PER_PRODUCT)], [1.0, 1.05]);
  const p = useIn(0);
  return (
    <Paper brand={brand}>
      <div style={{ position: "absolute", top: SAFE, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: p }}>
        <div style={{ transform: `scale(${zoom})` }}>
          <Photo src={u.foto} width={800} height={1080} radius={28} />
        </div>
      </div>
      <FadeUp delay={8} style={{ position: "absolute", bottom: SAFE - 40, left: 90, right: 90 }}>
        <Title brand={brand} size={76}>
          {u.ad}
        </Title>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 18 }}>
          <span style={{ fontSize: 30, color: brand.renkler.acik_metin }}>{`${u.renkler.length} renk · ${u.beden}`}</span>
          <SwatchRow chips={u.renkler} size={30} brand={brand} gap={8} max={8} />
        </div>
      </FadeUp>
    </Paper>
  );
};

const UrunMontaj: React.FC<Extract<VideoProps, { kind: "urun_montaj" }>> = (p) => (
  <AbsoluteFill>
    <Sequence durationInFrames={s(INTRO)}>
      <Intro brand={p.brand} kicker="Eşiler Triko" title={p.baslik} />
    </Sequence>
    {p.urunler.map((u, i) => (
      <Sequence key={u.id} from={s(INTRO + i * PER_PRODUCT)} durationInFrames={s(PER_PRODUCT)}>
        <ProductSlide brand={p.brand} u={u} />
      </Sequence>
    ))}
    <Sequence from={s(INTRO + p.urunler.length * PER_PRODUCT)}>
      <Outro brand={p.brand} />
    </Sequence>
    <Music src={p.muzik} total={videoDuration(p)} />
  </AbsoluteFill>
);

export const Video: React.FC<VideoProps> = (p) => {
  switch (p.kind) {
    case "klipler":
      return <Klipler {...p} />;
    case "renkler":
      return <Renkler {...p} />;
    case "egitici":
      return <Egitici {...p} />;
    case "urun_montaj":
      return <UrunMontaj {...p} />;
  }
};

