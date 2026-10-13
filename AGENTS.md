# AGENTS.md — rms-data（公開）

MapleRoyals 攻略庫的**成品**：單頁應用 `index.html`（內容已編碼）、`assets/`（自存圖片），以及 Fly.io 部署設定。
線上網址：https://rms-data.fly.dev/

**建置工具與來源檔在私人 repo `louis70109/rms-data-build`**（含詳細的 AGENTS.md，請先讀那份）。**不要把來源檔或建置程式推到這個公開 repo**——那會讓內容混淆失去意義，也會洩漏全部純文字。

## 系統流程圖

```
 ┌────────────── 來源 ──────────────┐
 │ mapleroyals.net（已關站）        │      royals.ms 論壇（仍在線）
 │        │                          │            │
 │   Wayback Machine 存檔            │            │ curl --compressed
 └────────┼──────────────────────────┘            │
          │ fetch_wayback_page.py                  │ 主樓 HTML + 附件圖
          ▼                                        ▼
 ┌──────────────────── 本機建置 C:\rb（私人 repo：rms-data-build）──────────────────┐
 │                                                                                    │
 │  <slug>.html（來源）  forum-*.html（來源）  *_zh.json（APQ 翻譯）                  │
 │        │                    │                      │                               │
 │        └──────────┬─────────┴──────────────────────┘                               │
 │                   ▼                                                                │
 │   build_spa.py                                                                     │
 │     1 取正文（cm-entry-summary 配對區塊，截掉頁尾／留言／嵌入）                    │
 │     2 套版面：一般頁 tidy ／ itcg_layout ／ apq_layout ／ boss_layout ／ jobs_supp │
 │     3 圖片本地化：img_map.json 有的 → assets/…；沒有的 → 移除                     │
 │     4 內容 JSON → XOR(R0y4ls!) → Base64 → 嵌入單一 index.html（含 noindex）        │
 │        │                                   │                                       │
 │        │ 輸出 img_urls.json（861 個外部圖）▼                                       │
 │        │                       download_images.py（curl --parallel，可重跑）       │
 │        │                                   │ 依真實格式命名 .png/.jpg/…            │
 │        │                                   ▼                                       │
 │        │                       assets/wb/（568 張）＋ img_map.json                 │
 │        ▼                                                                           │
 │   index.html ＋ assets/                                                            │
 └────────┬───────────────────────────────────────────────────────────────────────────┘
          │ publish.sh（複製＋commit＋push）
          ▼
 ┌────────────────── 公開 repo：louis70109/rms-data ──────────────────┐
 │  index.html   assets/{wb,apq,forum}/   Dockerfile   fly.toml        │
 │  .github/workflows/fly-deploy.yml          AGENTS.md  README.md     │
 └────────┬────────────────────────────────────────────────────────────┘
          │ git push origin main
          ▼
 ┌──────────── GitHub Actions（secret：FLY_API_TOKEN）────────────┐
 │  flyctl deploy --app rms-data --remote-only                     │
 └────────┬─────────────────────────────────────────────────────────┘
          ▼
 ┌───────────── Fly.io：rms-data.fly.dev（nrt）─────────────┐
 │  容器：python http.server :8080                           │
 │  提供 /index.html 與 /assets/*（HTTPS，閒置自動休眠）      │
 └────────┬──────────────────────────────────────────────────┘
          ▼
 ┌─────────────────────── 使用者瀏覽器 ───────────────────────┐
 │  載入 index.html → JS 解碼（Base64 → XOR）→ 內容 JSON      │
 │  → 渲染 SPA：側欄分類（可收合）／搜尋／#slug 路由          │
 │  → 圖片從 /assets/… 載入（點擊放大）                       │
 └─────────────────────────────────────────────────────────────┘
```

**不在流程內（刻意）**：GitHub Pages 已關閉；`louis70109.github.io` 綁 nijialin.com 不可動；
來源 HTML／建置程式／翻譯檔只在私人 repo，不進公開 repo。

## 這個 repo 有什麼
| 路徑 | 說明 |
|---|---|
| `index.html` | 40 篇攻略的單頁應用（資料以 XOR+Base64 編碼；有 `noindex`） |
| `assets/wb/` | 從 Wayback 下載的頁面圖片（568 張） |
| `assets/apq/`、`assets/forum/` | APQ 與論壇攻略的圖片（自原站下載） |
| `Dockerfile`、`fly.toml` | 靜態站部署（Python `http.server`，port 8080，app `rms-data`，region nrt） |
| `.github/workflows/fly-deploy.yml` | push 到 `main` 時自動 `flyctl deploy --remote-only` |
| `.nojekyll` | 無用途（GitHub Pages 已關閉），保留無妨 |

## 在本機看網站
不用安裝任何東西：直接雙擊 `index.html`，或：
```bash
python -m http.server 8000     # 然後開 http://127.0.0.1:8000
```
（`index.html` 是單檔；圖片在 `assets/`，要放在同一個資料夾。）

## 更新網站的流程
1. 在私人 repo（建置資料夾，如 `C:\rb`）修改來源／翻譯／版面，執行 `python -I build_spa.py "C:/rb"` 產生新的 `index.html`；圖片用 `download_images.py` 下載。
2. 用私人 repo 的 `publish.sh <這個 repo 的路徑> "訊息"`，或手動把 `index.html` 與 `assets/` 複製過來，commit、push。
3. GitHub Actions 自動部署到 Fly.io。看 Actions 結果或 `curl -I https://rms-data.fly.dev/` 確認。

## 部署細節
- 自動部署需要 repo secret **`FLY_API_TOKEN`**（已設定）。沒設定時，工作流程會略過部署並印出訊息。token 由使用者自己用 `flyctl tokens create deploy -a rms-data` 產生，**不要寫進檔案或對話**。
- 手動部署：安裝並登入 `flyctl`（`flyctl auth login` 由使用者自己做），在這個 repo 根目錄執行 `flyctl deploy --app rms-data`。
- **不要用 `.dockerignore` 排除 `index.html`**（曾因此部署失敗）。Dockerfile 只複製 `index.html` 與 `assets`。
- 部署指令偶爾在結尾回報錯誤，但新機器其實已啟動；用 `flyctl status --app rms-data` 與線上檢查確認。

## 注意事項
- **GitHub Pages 已關閉**。`louis70109.github.io` 綁有 `nijialin.com`（另一個網站），**不要解除自訂網域**，除非使用者明確要求並知道會影響那個網站。
- 編碼（XOR+Base64）只是混淆，金鑰就在頁面 JS 裡，**不能防止有心人解碼**；也不要做 cloaking／偽裝搜尋引擎。
- 圖片只引用 `assets/` 內的檔案；不要再連到 Wayback 或外部圖床。
- `/assets/` 目錄列表目前是開啟的（Python `http.server` 預設），這是已知缺口。

## 待辦
關閉 `/assets/` 目錄列表。詳見私人 repo 的 AGENTS.md「待辦」。

## PWA（已完成）
- `manifest.json`、`sw.js`、`assets-manifest.json` 由私人 repo 的 `build_spa.py` 產生，`assets/icons/` 為圖示；**Dockerfile 必須複製這三個檔案**（已設定）。
- `sw.js` 的版本是內容雜湊，內容變動就會自動換新；殼網路優先、圖片快取優先，頁面載入後背景預先快取全部圖片（631 個）。
- 若原地替換同名圖片，需調高 `sw.js` 範本內 `ASSET_CACHE` 版本（在私人 repo 的 `pwa/sw.template.js`）。

## 桌面版（Windows，Tauri）
- 位置：`desktop/`。用 **Tauri v2**（Rust 外殼 + Windows 內建 WebView2）把 `index.html` + `assets/` 包成程式，**不用 Electron**（使用者嫌太肥；Electron 版約 87 MB，Tauri 版約 10–12 MB）。
- 只打包 **Windows**（使用者指定）。產出：安裝版（NSIS，`currentUser` 安裝）與免安裝版（直接用編譯出的 `rms-guide.exe`）。
- 發佈：推標籤 `desktop-vX.Y.Z`（或在 Actions 手動執行並輸入版本）→ `.github/workflows/release-desktop.yml` 在 `windows-latest` 用 Rust + Node 打包，建立 Release 並附上 `RMS-Guide-Setup-X.Y.Z.exe`、`RMS-Guide-Portable-X.Y.Z.exe`。目前最新：`desktop-v1.1.0`。
- 流程中 CI 會：寫入版本號（`tauri.conf.json`、`Cargo.toml`）→ `node scripts/prepare-app.js` 把根目錄的網站內容複製到 `desktop/app/` → `npx tauri icon ../assets/icons/icon-512.png` 產生圖示 → `npx tauri build`。`app/`、`src-tauri/icons/`、`src-tauri/target/` 不進版控。
- 網頁偵測到 `window.__TAURI__` 時：外部 `http(s)` 連結交給系統瀏覽器（`opener` 外掛 + `capabilities/default.json` 的 `opener:default`），且**不註冊 Service Worker**。這段 JS 在私人 repo 的 `build_spa.py`。
- 沒有程式碼簽章：Windows SmartScreen 會警告；免安裝版需要系統已有 WebView2。
- 本機沒有 Rust 工具鏈，編譯只在 CI 進行；改 `src-tauri/` 後要靠 Actions 驗證。
- 網站內容更新後，要重新推標籤才會有包含新內容的桌面版（內容是內嵌的）。

## 價格 OCR 工具（站內「工具」分類）
- 頁面 `#tool-price-ocr`：貼上遊戲 Item Search 截圖，讀出商品名稱與價格，標出最低價，第二低價 ≥ 2 倍時提醒。圖片只在瀏覽器處理。
- 執行檔在 `assets/ocr/`（tesseract.js、worker、三個 LSTM 核心、`eng.traineddata.gz`，共約 14 MB，只在使用時下載、之後快取）。這些檔案由私人建置 repo 產生後複製過來，**不要手改**。
- **OCR 只放線上版，桌面版不含**：`desktop/scripts/prepare-app.js` 會刪掉 `assets/ocr`，網頁在 Tauri 裡會隱藏「工具」頁。
