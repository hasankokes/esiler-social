import { graphGet, graphPost, ruploadFromUrl, sleep } from "./graph.js";
import type { PublishInput, PublishResult } from "./index.js";

// Facebook sayfası: fotoğraf, çoklu fotoğraf, Reels (video_reels) ve hikâye (photo_stories / video_stories).
// Sayfa uç noktaları Page token ister; System User token'ından her çalıştırmada türetilir.

const pageTokens = new Map<string, string>();

async function pageToken(pageId: string, token: string) {
  if (!pageTokens.has(pageId)) {
    const r = await graphGet(pageId, { fields: "access_token" }, token, "FB sayfa token'ı");
    if (!r.access_token) throw new Error("FB sayfa token'ı alınamadı: System User'a sayfa atanmış mı, pages_show_list izni var mı?");
    pageTokens.set(pageId, r.access_token);
  }
  return pageTokens.get(pageId)!;
}

// Barındırılan videoyu yükle ve yüklemenin bitmesini bekle.
async function uploadVideo(edge: "video_reels" | "video_stories", pageId: string, url: string, token: string) {
  const start = await graphPost(`${pageId}/${edge}`, { upload_phase: "start" }, token, `FB ${edge} start`);
  const videoId = start.video_id as string;
  await ruploadFromUrl(videoId, url, token);
  const until = Date.now() + 10 * 60 * 1000;
  for (;;) {
    const { status } = await graphGet(videoId, { fields: "status" }, token, "FB video durumu");
    const vs = status?.video_status;
    if (vs === "error" || vs === "upload_failed" || vs === "expired" || status?.processing_phase?.status === "error") {
      throw new Error(`FB video işlenemedi: ${JSON.stringify(status?.processing_phase?.error ?? status)}`);
    }
    if (vs === "ready" || status?.uploading_phase?.status === "complete") return videoId;
    if (Date.now() > until) throw new Error(`FB video 10 dk içinde yüklenmedi (durum: ${vs})`);
    await sleep(5000);
  }
}

export async function publishFacebook(input: PublishInput, pageId: string, systemToken: string): Promise<PublishResult> {
  const token = await pageToken(pageId, systemToken);
  const { format, urls, caption } = input;
  switch (format) {
    case "image": {
      const r = await graphPost(`${pageId}/photos`, { url: urls[0], message: caption }, token, "FB fotoğraf");
      return { id: r.post_id ?? r.id };
    }
    case "carousel": {
      const ids: string[] = [];
      for (const url of urls) ids.push((await graphPost(`${pageId}/photos`, { url, published: false }, token, "FB fotoğraf yükleme")).id);
      const params: Record<string, string> = { message: caption ?? "" };
      ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
      const r = await graphPost(`${pageId}/feed`, params, token, "FB çoklu fotoğraf");
      return { id: r.id };
    }
    case "reel": {
      const videoId = await uploadVideo("video_reels", pageId, urls[0], token);
      // İşleme bitmeden finish denenirse hata dönebilir; birkaç kez tekrar dene.
      for (let i = 0; ; i++) {
        try {
          await graphPost(`${pageId}/video_reels`, { video_id: videoId, upload_phase: "finish", video_state: "PUBLISHED", description: caption }, token, "FB Reels yayın");
          return { id: videoId, url: `https://www.facebook.com/reel/${videoId}` };
        } catch (e) {
          if (i >= 5) throw e;
          await sleep(15000);
        }
      }
    }
    case "story_image": {
      const photo = await graphPost(`${pageId}/photos`, { url: urls[0], published: false }, token, "FB hikâye fotoğrafı");
      const r = await graphPost(`${pageId}/photo_stories`, { photo_id: photo.id }, token, "FB fotoğraf hikâyesi");
      return { id: r.post_id ?? photo.id };
    }
    case "story_video": {
      const videoId = await uploadVideo("video_stories", pageId, urls[0], token);
      const r = await graphPost(`${pageId}/video_stories`, { video_id: videoId, upload_phase: "finish" }, token, "FB video hikâyesi");
      return { id: r.post_id ?? videoId };
    }
  }
}
