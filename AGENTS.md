# AGENTS.md — rms-data（公開）

MapleRoyals 攻略庫的**成品**：單頁應用 `index.html`（內容已編碼）、`assets/`（自存圖片），以及 Fly.io 部署設定。
線上網址：https://rms-data.fly.dev/

**建置工具與來源檔在私人 repo `louis70109/rms-data-build`**（含詳細的 AGENTS.md，請先讀那份）。**不要把來源檔或建置程式推到這個公開 repo**——那會讓內容混淆失去意義，也會洩漏全部純文字。

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
PWA（manifest + Service Worker + 圖示）、關閉 `/assets/` 目錄列表。詳見私人 repo 的 AGENTS.md「待辦」。
