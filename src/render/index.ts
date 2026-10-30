import type { PostProps, StoryProps, VideoProps } from "../../remotion/types.js";

// Render katmanı soyutlaması. İçerik üretimi yalnızca bu arayüzü bilir; motor değiştirilebilir.
//
// Şu an tek motor Remotion. Remotion, 3 kişiye kadar şirketlerde ücretsizdir. Şirket büyürse
// ya lisans alınır ya da bu arayüzü uygulayan ücretsiz bir motor (ör. Satori+resvg ile görsel,
// FFmpeg ile video) eklenip RENDERER ortam değişkeniyle seçilir. Bkz. README "Render motoru".

export type StillJob =
  | { composition: "Post"; props: PostProps; out: string }
  | { composition: "Story"; props: StoryProps; out: string };
export type VideoJob = { composition: "Video"; props: VideoProps; out: string };

export interface Renderer {
  init(): Promise<void>;
  still(job: StillJob): Promise<void>; // JPEG (Instagram yalnızca JPEG kabul eder)
  video(job: VideoJob): Promise<void>; // H.264 MP4 + AAC ses izi
  close(): Promise<void>;
}

export async function createRenderer(): Promise<Renderer> {
  const engine = process.env.RENDERER ?? "remotion";
  if (engine === "remotion") {
    const { RemotionRenderer } = await import("./remotion.js");
    return new RemotionRenderer();
  }
  throw new Error(`Bilinmeyen RENDERER: ${engine}`);
}
