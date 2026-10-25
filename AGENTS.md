# AGENTS.md — rms-data（公開成品）

本 repo 是 MapleRoyals 攻略庫的**公開成品**。內容包含：

- 網站 `index.html` 與 `assets/`（單一檔案，內容已編碼）。
- PWA 檔案：`sw.js`、`manifest.json`、`assets-manifest.json`。
- 部署設定：`Dockerfile`、`fly.toml`、`.github/workflows/`。
- 桌面版：`desktop/`（Tauri）。

線上網址：https://rms-data.fly.dev/

> **不可在這裡直接修改 `index.html`。**
> 內容由私人建置 repo（`C:\rb`，`louis70109/rms-data-build`）產生。
> 要更新內容，必須回私人 repo 修改，建置後用該 repo 的 `publish.sh` 發佈到這裡。
> 本 repo 只收成品。不可放入來源檔或建置程式。

完整流程見私人 repo 的 `AGENTS.md`。本文件只列出與公開 repo 有關的事項。

## 1. 部署

- 推送 `main`，GitHub Actions 會自動執行 `flyctl deploy --remote-only`。
- 這個流程需要 repo secret `FLY_API_TOKEN`。使用者已自行設定。不可索取或寫出 token。
- Dockerfile 只複製 `index.html`、PWA 檔案與 `assets/`。
- **不可加入會排除 `index.html` 的 `.dockerignore`。** 曾因此部署失敗。
- Actions 失敗時，可手動執行 `flyctl deploy --app rms-data`。執行後用 `flyctl status --app rms-data` 確認。

## 2. 圖片與資料夾

- `assets/wb/`：原站圖片（自存）。
- `assets/apq/`：APQ 攻略圖片。
- `assets/forum/`：論壇攻略圖片。
- `assets/icons/`：PWA 圖示。
- `assets/ocr/`：價格 OCR 的執行檔（**目前不發佈**，見第 5 節）。
- 網站不可連到 Wayback 或其他外部圖床。

## 3. 攻略內的連結

- 外部連結一律指向 `https://wiki.royals.ms/items`（列表）。
- 物品名稱指向 `https://wiki.royals.ms/items/<id>`（物品頁）。
- BOSS 名稱指向 `https://wiki.royals.ms/monsters/<id>`（怪物頁），或指向站內頁（`#forum-en-bosses`、`#pre-zakum` 等）。
- 站內跳轉使用 `#slug`。
- 這些規則在私人 repo 實作。本 repo 只收結果。

## 4. 桌面版（Windows，Tauri）

- 位置：`desktop/`。Tauri v2，Rust 外殼加 WebView2。只打包 Windows。不用 Electron。
- 推送 `desktop-vX.Y.Z` 標籤，GitHub Actions 會自動打包並建立 Release。
  - 安裝版：`RMS-Guide-Setup-X.Y.Z.exe`（約 10 MB）。
  - 免安裝版：`RMS-Guide-Portable-X.Y.Z.exe`（約 12 MB）。
- 手動執行：在 Actions 頁面選 `Release desktop app`，輸入版本號。
- 桌面版內嵌網站內容。**網站更新後，必須推新標籤，桌面版才會更新。**
- 桌面版不含價格 OCR。`desktop/scripts/prepare-app.js` 會刪掉 `assets/ocr`。
- 安裝檔沒有程式碼簽章。Windows SmartScreen 會出現警告，使用者需點「其他資訊」再點「仍要執行」。
- 免安裝版需要 WebView2。Windows 11 與多數 Windows 10 已內建。

## 5. 價格 OCR（目前關閉）

- 開關在私人 repo：`OCR_ENABLED = False`。
- 關閉時，`assets/ocr/` 不會發佈，側欄也沒有「工具」分類。
- 開啟時，私人 repo 的 `publish.sh` 會把 `assets/ocr/` 複製過來。**不可手動加入 `assets/ocr/`。**
- OCR 約 14 MB。只在使用者進入工具頁時才下載，之後由 service worker 快取。

## 6. PWA

- `sw.js` 的版本是內容雜湊。內容改變，版本就改變。不需要手動改版本號。
- 若曾原地替換同名圖片，必須在私人 repo 把 `ASSET_CACHE` 的版本加一。
- 內建瀏覽器預覽不支援 Service Worker。請在 Chrome、Edge 或手機上測試。

## 7. 注意事項

- Fly.io 的容器以 Python `http.server` 提供靜態檔。`/assets/` 目錄列表是開啟的。這是已知缺口。
- 站內 HTML 有 `noindex, nofollow, noarchive`。使用者已放棄 SEO。
- XOR+Base64 只是混淆，不是保護。不可向使用者宣稱它能防官方或防爬蟲。
- 不可繞過密碼保護頁。
- 不可解除 `louis70109.github.io` 與 `nijialin.com` 的綁定。該網域承載「忍者工坊」。
- CSV 匯出檔是明文。**不可發佈到公開網址。**
