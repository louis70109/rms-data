/* RMS 攻略庫 Service Worker（由 build_spa.py 以內容雜湊替換 08058c329e36 後輸出為 sw.js）
 *
 * 策略
 *  - 殼（index.html、manifest、圖示）：安裝時預先快取；導覽請求「網路優先、失敗用快取」，
 *    所以有網路時永遠拿到最新版，離線時回到上次的版本。
 *  - /assets/*（攻略圖片）：快取優先，沒快取才抓網路並存起來。
 *  - 頁面載入後會要求 SW 在背景把 assets-manifest.json 列出的全部圖片預先快取（每個版本一次），
 *    完成後即可完整離線閱讀。
 *  - 內容更新 → VERSION 改變 → 新 SW 啟用時刪除舊的殼快取。
 *  - 若曾「原地替換」同名圖片，請把 ASSET_CACHE 的版本號 +1。
 */
const VERSION = "08058c329e36";
const CORE_CACHE = "rms-core-" + VERSION;
const ASSET_CACHE = "rms-assets-v1";
const CORE_URLS = [
  "./",
  "index.html",
  "manifest.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((c) => c.addAll(CORE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("rms-core-") && k !== CORE_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 導覽（含 #hash 路由）與 index：網路優先
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // 圖片等資源：快取優先
  if (url.pathname.includes("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }
  // 其他（manifest、sw.js 本身）：直接走網路
});

// 背景預先快取全部圖片
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type !== "WARM" || !Array.isArray(msg.urls)) return;
  const source = event.source;
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const total = msg.urls.length;
    let done = 0;
    const post = (type) => source && source.postMessage({ type, done, total });
    const BATCH = 12;
    for (let i = 0; i < total; i += BATCH) {
      await Promise.all(msg.urls.slice(i, i + BATCH).map(async (u) => {
        try {
          if (!(await cache.match(u))) {
            const res = await fetch(u);
            if (res.ok) await cache.put(u, res);
          }
        } catch (e) { /* 單張失敗不影響整體 */ }
        done++;
      }));
      if (done % 60 < BATCH) post("WARM_PROGRESS");
    }
    post("WARM_DONE");
  })());
});
