// 把網站內容（上一層的 index.html 與 assets/）複製到 desktop/app/，供 Tauri 打包。
// 用法：在 desktop/ 執行  node scripts/prepare-app.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const out = path.resolve(__dirname, "..", "app");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));
// assets/ocr（OCR 辨識程式，約 14 MB）要一起打包：桌面版的「乖寶寶題目：截圖找答案」要用，
// 內建之後使用者不用另外下載。價格 OCR 工具在網頁內會被濾掉（見私人 repo 的 build_spa.py）。
fs.cpSync(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });

// manifest / sw / assets-manifest 是給瀏覽器 PWA 用的，桌面版不需要（file:// 不註冊 Service Worker）
let count = 0;
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name));
    else count++;
  }
})(out);
console.log("已準備 app/：" + count + " 個檔案");
