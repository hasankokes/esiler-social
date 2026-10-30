// Meta Graph API için ince istemci. Sürüm GRAPH_VERSION ile değiştirilebilir.
export const GRAPH_VERSION = process.env.GRAPH_VERSION ?? "v26.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public trace?: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function parse(res: Response, what: string) {
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    throw new GraphError(
      `${what}: ${e.message ?? text.slice(0, 300)}${e.error_user_msg ? ` (${e.error_user_msg})` : ""} [kod ${e.code ?? res.status}${e.error_subcode ? `/${e.error_subcode}` : ""}]`,
      e.code,
      e.error_subcode,
      e.fbtrace_id,
    );
  }
  return body;
}

const form = (params: Params) => {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) f.set(k, String(v));
  return f;
};

export async function graphPost(path: string, params: Params, token: string, what = path) {
  const res = await fetch(`${BASE}/${path}`, { method: "POST", body: form({ ...params, access_token: token }) });
  return parse(res, what);
}

export async function graphGet(path: string, params: Params, token: string, what = path) {
  const res = await fetch(`${BASE}/${path}?${form({ ...params, access_token: token })}`);
  return parse(res, what);
}

// Barındırılan dosyayı Facebook video yükleme uç noktasına bildir (rupload.facebook.com).
export async function ruploadFromUrl(videoId: string, fileUrl: string, token: string) {
  const res = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: fileUrl },
  });
  return parse(res, "rupload");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
