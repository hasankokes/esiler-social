import { log } from "../log.js";
import { graphGet, graphPost, sleep } from "./graph.js";
import type { PublishInput, PublishResult } from "./index.js";

// Instagram içerik yayınlama: container oluştur → status_code FINISHED olana kadar bekle → media_publish.
// Instagram yalnızca JPEG kabul eder; tüm görseller JPEG üretilir.

async function waitFinished(id: string, token: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  let delay = 3000;
  for (;;) {
    const r = await graphGet(id, { fields: "status_code,status" }, token, "IG container durumu");
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new Error(`IG container ${r.status_code}: ${r.status ?? ""}`);
    if (Date.now() > until) throw new Error(`IG container ${Math.round(timeoutMs / 60000)} dk içinde hazır olmadı (son durum: ${r.status_code})`);
    await sleep(delay);
    delay = Math.min(delay * 1.5, 15000);
  }
}

async function container(igUser: string, params: Record<string, string | boolean | undefined>, token: string, timeoutMs = 120000) {
  const { id } = await graphPost(`${igUser}/media`, params, token, "IG container oluşturma");
  await waitFinished(id, token, timeoutMs);
  return id as string;
}

export async function publishInstagram(input: PublishInput, igUser: string, token: string): Promise<PublishResult> {
  const { format, urls, caption } = input;
  const VIDEO_WAIT = 10 * 60 * 1000;
  let creationId: string;
  switch (format) {
    case "image":
      creationId = await container(igUser, { image_url: urls[0], caption }, token);
      break;
    case "carousel": {
      const children: string[] = [];
      for (const url of urls.slice(0, 10)) children.push(await container(igUser, { image_url: url, is_carousel_item: true }, token));
      creationId = await container(igUser, { media_type: "CAROUSEL", children: children.join(","), caption }, token);
      break;
    }
    case "reel":
      creationId = await container(igUser, { media_type: "REELS", video_url: urls[0], caption, share_to_feed: true }, token, VIDEO_WAIT);
      break;
    case "story_image":
      creationId = await container(igUser, { media_type: "STORIES", image_url: urls[0] }, token);
      break;
    case "story_video":
      creationId = await container(igUser, { media_type: "STORIES", video_url: urls[0] }, token, VIDEO_WAIT);
      break;
  }
  const { id } = await graphPost(`${igUser}/media_publish`, { creation_id: creationId }, token, "IG media_publish");
  let url: string | undefined;
  try {
    url = (await graphGet(id, { fields: "permalink" }, token)).permalink;
  } catch {
    log.info("IG bağlantısı alınamadı (paylaşım yine de yapıldı)");
  }
  return { id, url };
}
