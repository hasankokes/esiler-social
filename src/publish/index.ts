import type { Built } from "../content.js";
import type { Channel } from "../config.js";
import { publishFacebook } from "./facebook.js";
import { publishInstagram } from "./instagram.js";

export type PublishInput = { format: Built["format"]; urls: string[]; caption?: string };
export type PublishResult = { id: string; url?: string };

export type Credentials = { igUserId: string; fbPageId: string; token: string };

export function credentials(): Credentials | null {
  const igUserId = process.env.IG_USER_ID ?? "";
  const fbPageId = process.env.FB_PAGE_ID ?? "";
  const token = process.env.ACCESS_TOKEN ?? "";
  return token && (igUserId || fbPageId) ? { igUserId, fbPageId, token } : null;
}

export async function publish(channel: Channel, input: PublishInput, creds: Credentials): Promise<PublishResult> {
  if (channel === "instagram") {
    if (!creds.igUserId) throw new Error("IG_USER_ID tanımlı değil");
    return publishInstagram(input, creds.igUserId, creds.token);
  }
  if (!creds.fbPageId) throw new Error("FB_PAGE_ID tanımlı değil");
  return publishFacebook(input, creds.fbPageId, creds.token);
}
