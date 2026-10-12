# RMS 攻略庫 桌面版（Windows）

用 [Tauri](https://tauri.app/) 把網站（`index.html` + `assets/`）包成可離線使用的 Windows 桌面程式。
Tauri 用 Windows 內建的 WebView2 顯示網頁，不像 Electron 要連整個瀏覽器一起打包，所以安裝檔小很多。
內容全部內嵌在執行檔內，不需要網路。

## 下載
到 [Releases](../../releases) 下載 `desktop-v*` 的最新版本：
- `RMS-Guide-Setup-*.exe`：安裝版（安裝到目前使用者，不需要系統管理員權限）
- `RMS-Guide-Portable-*.exe`：免安裝版（需要系統已有 WebView2；Windows 11 與多數 Windows 10 已內建）

安裝檔**沒有程式碼簽章**，第一次執行時 Windows SmartScreen 可能出現「未知的發行者」，點「其他資訊」→「仍要執行」即可。

## 結構
| 路徑 | 說明 |
|---|---|
| `src-tauri/src/main.rs` | Rust 外殼，十行左右：建立視窗、載入 opener 外掛 |
| `src-tauri/tauri.conf.json` | 視窗、打包（NSIS）、前端目錄 `../app` |
| `src-tauri/capabilities/default.json` | 權限：`core:default`、`opener:default`（用系統瀏覽器開外部連結） |
| `scripts/prepare-app.js` | 把上一層的 `index.html` 與 `assets/` 複製到 `app/`（`app/` 不進版控） |
| `src-tauri/icons/` | 由 `tauri icon` 從 `assets/icons/icon-512.png` 產生（不進版控） |

網頁本身（`index.html`）偵測到 `window.__TAURI__` 時，會把 `http(s)` 外部連結交給系統瀏覽器，並且不註冊 Service Worker（PWA 只在一般瀏覽器使用）。

## 本機開發與打包
需要 Node.js 18+、[Rust](https://rustup.rs/)，以及 Windows 的 Visual Studio C++ Build Tools。
```bash
cd desktop
npm install
npm run icons      # 第一次：產生圖示
npm run dev        # 開發模式
npm run build      # 打包，輸出在 src-tauri/target/release/bundle/nsis/
```

## 發佈新版本
網站內容更新後（根目錄的 `index.html`、`assets/` 已推送），推一個標籤即可：
```bash
git tag desktop-v1.1.1
git push origin desktop-v1.1.1
```
GitHub Actions（`.github/workflows/release-desktop.yml`）會打包並建立 Release 附上安裝檔。
也可以在 Actions 頁面手動執行「Release desktop app」並輸入版本號。
