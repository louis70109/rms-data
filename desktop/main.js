// RMS 攻略庫 桌面版：用 Electron 把單頁應用（index.html + assets/）包成可離線使用的桌面程式。
// 內容全部在 app/ 內（打包時由 scripts/prepare-app.js 從 repo 根目錄複製），不需要網路。
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 520,
    title: "RMS 攻略庫",
    backgroundColor: "#20242e",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));

  // 站內都是 file:// ；外部連結（Wayback、論壇原文）交給系統瀏覽器，不在 App 內開
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    win = null;
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "editMenu" },
    {
      label: "檢視",
      submenu: [
        { role: "reload", label: "重新載入" },
        { role: "togglefullscreen", label: "全螢幕" },
        { type: "separator" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "縮小" },
        { role: "resetZoom", label: "實際大小" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
