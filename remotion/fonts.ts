import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

// Site ile aynı OFL fontlar. latin + latin-ext birlikte yüklenir: ı latin'de, ğ ş İ latin-ext'te.
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

export const SERIF = "'Cormorant Garamond', Georgia, serif";
export const SANS = "'DM Sans', Helvetica, Arial, sans-serif";

const faces = [
  { family: "Cormorant Garamond", file: "cormorant-latin", style: "normal", range: LATIN, weight: "300 700" },
  { family: "Cormorant Garamond", file: "cormorant-latin-ext", style: "normal", range: LATIN_EXT, weight: "300 700" },
  { family: "Cormorant Garamond", file: "cormorant-italic-latin", style: "italic", range: LATIN, weight: "300 700" },
  { family: "Cormorant Garamond", file: "cormorant-italic-latin-ext", style: "italic", range: LATIN_EXT, weight: "300 700" },
  { family: "DM Sans", file: "dmsans-latin", style: "normal", range: LATIN, weight: "100 1000" },
  { family: "DM Sans", file: "dmsans-latin-ext", style: "normal", range: LATIN_EXT, weight: "100 1000" },
];

const handle = delayRender("Fontlar yükleniyor");
Promise.all(
  faces.map((f) =>
    loadFont({
      family: f.family,
      url: staticFile(`fonts/${f.file}.woff2`),
      style: f.style,
      weight: f.weight,
      unicodeRange: f.range,
      format: "woff2",
    }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font yüklenemedi", err);
    continueRender(handle);
  });

// CSS text-transform:uppercase dil ayarına bağlı; Türkçe büyük harf için her zaman bunu kullan.
export const upper = (s: string) => s.toLocaleUpperCase("tr-TR");
