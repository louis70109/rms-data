# RMS 攻略庫 桌面版

用 Electron 把網站（`index.html` + `assets/`）包成可離線使用的桌面程式。內容全部在 App 內，不需要網路。

## 下載
到 [Releases](../../releases) 下載 `desktop-v*` 的最新版本（Windows／macOS／Linux）。安裝檔**沒有程式碼簽章**，第一次開啟的處理方式寫在每個 Release 的說明裡。

## 本機開發與打包
```bash
cd desktop
npm install
npm start          # 複製網站內容到 app/ 並開啟桌面程式
npm run dist       # 打包到 dist/（本機的作業系統）
```
需要 Node.js 18 以上。

## 發佈新版本
網站內容更新後（根目錄的 `index.html`、`assets/` 已推送），推一個標籤即可：
```bash
git tag desktop-v1.0.1
git push origin desktop-v1.0.1
```
GitHub Actions（`.github/workflows/release-desktop.yml`）會在三個平台打包，並建立 Release 附上安裝檔。
也可以在 Actions 頁面手動執行「Release desktop app」並輸入版本號。

## 設計
- `main.js`：開視窗載入 `app/index.html`；外部連結（Wayback、論壇）交給系統瀏覽器；單一執行個體；安全設定 `contextIsolation`、`sandbox`、關閉 `nodeIntegration`。
- `scripts/prepare-app.js`：把上一層的 `index.html` 與 `assets/` 複製到 `app/`（`app/` 不進版控）。
- 網頁在 `file://` 下不會註冊 Service Worker（PWA 只在瀏覽器版使用）。
