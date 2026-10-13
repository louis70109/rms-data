// 把網站內容（上一層的 index.html 與 assets/）複製到 desktop/app/，供 Tauri 打包。
// 用法：在 desktop/ 執行  node scripts/prepare-app.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const out = path.resolve(__dirname, "..", "app");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));
// assets/ocr（價格 OCR 的執行檔，約 14 MB）只給線上版用，桌面版不收
fs.cpSync(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });
fs.rmSync(path.join(out, "assets", "ocr"), { recursive: true, force: true });

// manifest / sw / assets-manifest 是給瀏覽器 PWA 用的，桌面版不需要（file:// 不註冊 Service Worker）
let count = 0;
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name));
    else count++;
  }
})(out);
console.log("已準備 app/：" + count + " 個檔案");
