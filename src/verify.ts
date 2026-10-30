import { log } from "./log.js";
import { credentials } from "./publish/index.js";
import { GRAPH_VERSION, graphGet } from "./publish/graph.js";

// Kurulum kontrolü: hiçbir şey paylaşmadan token'ı, izinleri ve kimlikleri doğrular.
// Public repoda Actions log'ları herkese açıktır; burada token yazdırılmaz.

const REQUIRED = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
];
const OPTIONAL = ["ads_read"];

export async function verifySetup() {
  const creds = credentials();
  if (!creds) {
    log.error("ACCESS_TOKEN, IG_USER_ID veya FB_PAGE_ID secret'ı eksik.");
    return;
  }
  const { token, igUserId, fbPageId } = creds;
  log.info(`Graph API ${GRAPH_VERSION}`);
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      log.error(`${name}: ${(e as Error).message}`);
    }
  };

  await step("Token", async () => {
    const me = await graphGet("me", { fields: "id,name" }, token);
    log.info(`✓ Token geçerli: ${me.name} (${me.id})`);
    try {
      const d = (await graphGet("debug_token", { input_token: token }, token)).data;
      const exp = d.expires_at === 0 || d.data_access_expires_at === 0 ? "süresiz" : new Date(d.expires_at * 1000).toISOString();
      log.info(`  tür: ${d.type ?? "?"}, bitiş: ${exp}`);
      if (d.expires_at && d.expires_at !== 0) log.warn(`Token süreli (${exp}). System User token'ı "Hiçbir zaman" süresiyle oluşturulmalı.`);
    } catch {
      log.info("  (token bitiş tarihi okunamadı; developers.facebook.com/tools/debug/accesstoken ile bakılabilir)");
    }
  });

  await step("İzinler", async () => {
    const perms = (await graphGet("me/permissions", {}, token)).data as { permission: string; status: string }[];
    const granted = new Set(perms.filter((p) => p.status === "granted").map((p) => p.permission));
    const missing = REQUIRED.filter((p) => !granted.has(p));
    log.info(`✓ Verilen izinler: ${[...granted].sort().join(", ")}`);
    if (missing.length) log.error(`Eksik izin: ${missing.join(", ")}. Token'ı bu izinlerle yeniden oluşturun.`);
    for (const p of OPTIONAL) if (!granted.has(p)) log.warn(`${p} izni yok. Instagram paylaşımı "izin" hatası verirse token'a bu izni ekleyin.`);
  });

  if (fbPageId) {
    await step("Facebook sayfası", async () => {
      const page = await graphGet(fbPageId, { fields: "name,instagram_business_account{id,username}" }, token);
      log.info(`✓ Sayfa: ${page.name} (${fbPageId})`);
      const linked = page.instagram_business_account;
      if (!linked) log.warn("Sayfaya bağlı Instagram işletme hesabı görünmüyor.");
      else if (igUserId && linked.id !== igUserId) log.error(`IG_USER_ID (${igUserId}) sayfaya bağlı hesapla (${linked.id} @${linked.username}) eşleşmiyor.`);
      else log.info(`  bağlı Instagram: @${linked.username} (${linked.id})`);
      const pt = await graphGet(fbPageId, { fields: "access_token" }, token);
      if (!pt.access_token) throw new Error("Sayfa token'ı alınamadı: System User'a sayfa 'içerik oluştur' yetkisiyle atanmış mı?");
      log.info("  ✓ sayfa token'ı alınabiliyor (paylaşım için gerekli)");
    });
  }

  if (igUserId) {
    await step("Instagram", async () => {
      const ig = await graphGet(igUserId, { fields: "username,name,media_count" }, token);
      log.info(`✓ Instagram: @${ig.username} (${ig.media_count} gönderi)`);
      const lim = (await graphGet(`${igUserId}/content_publishing_limit`, { fields: "config,quota_usage" }, token)).data?.[0];
      if (lim) log.info(`  paylaşım kotası: son 24 saatte ${lim.quota_usage}/${lim.config?.quota_total ?? "?"}`);
    });
  }

  const s = log.summary();
  log.info(s.errors.length ? `Kontrol bitti: ${s.errors.length} hata.` : "Kontrol bitti: paylaşım için her şey hazır görünüyor.");
}
