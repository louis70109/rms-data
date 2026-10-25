# CLAUDE.md

本 repo 是 RMS 攻略庫的**公開成品**（網站 `index.html`、PWA、桌面版 `desktop/`、Fly.io 部署設定）。開始工作前請先閱讀 [AGENTS.md](AGENTS.md)。

- 網站內容由私人建置 repo（`C:\rb`）產生，**不要直接手改 `index.html`**；要更新內容，回私人 repo 修改並建置，再用該 repo 的 `publish.sh` 發佈到這裡。
- 推送到 `main` 會觸發 GitHub Actions 自動部署到 Fly.io。
- 桌面版要打 `desktop-v*` 標籤才會打包發佈。
