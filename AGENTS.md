# AGENTS.md — rms-data（公開）

MapleRoyals 攻略庫的**成品**（單一 `index.html`，內容已編碼）與 Fly.io 部署設定。
建置工具與來源檔在私人 repo `louis70109/rms-data-build`，**不要把來源檔或建置程式推到這個 repo**。

## 內容
- `index.html`：36 篇攻略的單頁應用（內容 XOR+Base64 編碼，`noindex`）。
- `assets/apq/`：APQ 論壇附件圖（29 張，自原站下載）。
- `Dockerfile`、`fly.toml`：靜態站部署設定（Python http.server，port 8080，app `rms-data`，region nrt）。
- `.github/workflows/fly-deploy.yml`：push 到 `main` 自動部署到 Fly.io。

## 更新流程
1. 在私人 repo 重新建置，產生新的 `index.html`（見私人 repo 的 AGENTS.md）。
2. 把新的 `index.html` 複製到這裡，commit & push。
3. 若設定了 `FLY_API_TOKEN`，GitHub Actions 會自動部署；否則手動執行：`flyctl deploy --app rms-data`。

## 注意
- 不要用 `.dockerignore` 排除 `index.html`。
- Fly deploy token 只放在 repo secret `FLY_API_TOKEN`，不要寫進檔案或對話。
- GitHub Pages 已關閉；`louis70109.github.io` 綁有 nijialin.com 自訂網域，不要解除（會影響另一個網站）。
