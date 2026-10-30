import { JWT } from "google-auth-library";

// Google Drive (service account, salt okunur). Ortam değişkenleri:
//   GOOGLE_SERVICE_ACCOUNT_JSON: service account anahtar dosyasının içeriği (JSON)
//   DRIVE_FOLDER_ID:             paylaşılan ana klasörün id'si (urunler/, atolye/, vitrin/, paketleme/ bunun altında)

export type DriveFile = { id: string; name: string; mimeType: string; createdTime: string; size?: string };

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";

let client: JWT | null | undefined;

function auth(): JWT | null {
  if (client !== undefined) return client;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.DRIVE_FOLDER_ID) return (client = null);
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  client = new JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  return client;
}

export const driveEnabled = () => auth() !== null;

async function api<T>(url: string): Promise<T> {
  const c = auth();
  if (!c) throw new Error("Google Drive ayarlı değil (GOOGLE_SERVICE_ACCOUNT_JSON / DRIVE_FOLDER_ID)");
  const { token } = await c.getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

async function list(q: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken, files(id, name, mimeType, createdTime, size)",
      orderBy: "createdTime",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await api<{ files: DriveFile[]; nextPageToken?: string }>(`${API}?${params}`);
    out.push(...r.files);
    pageToken = r.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const folderCache = new Map<string, string | null>();

// "atolye" veya "urunler/ES-101" gibi bir yolu klasör id'sine çevirir.
export async function folderId(pathStr: string): Promise<string | null> {
  if (folderCache.has(pathStr)) return folderCache.get(pathStr)!;
  let parent = process.env.DRIVE_FOLDER_ID!;
  for (const name of pathStr.split("/").filter(Boolean)) {
    const found = await list(`'${parent}' in parents and name = '${esc(name)}' and mimeType = '${FOLDER}' and trashed = false`);
    if (!found.length) {
      folderCache.set(pathStr, null);
      return null;
    }
    parent = found[0].id;
  }
  folderCache.set(pathStr, parent);
  return parent;
}

// Klasördeki fotoğraf ve videolar (eskiden yeniye).
export async function listMedia(folder: string): Promise<DriveFile[]> {
  const id = await folderId(folder);
  if (!id) return [];
  return list(`'${id}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`);
}

// "drive:urunler/ES-101/1.jpg" → dosya
export async function fileByPath(drivePath: string): Promise<DriveFile | null> {
  const parts = drivePath.replace(/^drive:/, "").split("/");
  const name = parts.pop()!;
  const id = await folderId(parts.join("/"));
  if (!id) return null;
  const found = await list(`'${id}' in parents and name = '${esc(name)}' and trashed = false`);
  return found[0] ?? null;
}

export async function download(fileId: string): Promise<Buffer> {
  const c = auth();
  if (!c) throw new Error("Google Drive ayarlı değil");
  const { token } = await c.getAccessToken();
  const res = await fetch(`${API}/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive indirme ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
