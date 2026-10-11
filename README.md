# rms-data · MapleRoyals 攻略庫

MapleRoyals（mapleroyals.net）關站後，自網際網路檔案館（Wayback Machine）救回的公開攻略，
整理成一個**單頁應用（SPA）**：側邊欄分類、即時搜尋、同頁切換，單一自包含 `index.html`。

## 內容（20 篇）

| 分類 | 篇目 |
|------|------|
| 規則 | 乖寶寶題庫（Safe Adventures 題庫） |
| 前置任務 | 前置任務總覽、技能前置任務（戰士／法師／弓箭手／盜賊／海盜）、時間神殿前置、東京前置、LHC 圖騰交換前置、魔王巴洛谷前置（BPQ） |
| 轉職 | 二轉 / 三轉 / 四轉流程 |
| 技能書 | 全職業共通、劍士、法師、弓箭手、盜賊、海盜 |

> 賺錢相關頁面已移除。密碼保護與標註「不公開」的文章未收錄。

## 在本地架起來看

### 方法一：直接開檔（最簡單，免安裝）

`index.html` 是自包含單檔，直接用瀏覽器開即可：

- **Windows**：雙擊 `index.html`，或在 PowerShell 執行
  ```powershell
  start index.html
  ```
- **macOS**：`open index.html`　**Linux**：`xdg-open index.html`

文字與版面完全離線；圖片來源指向 Wayback 存檔，顯示時需連網（載不到的會自動隱藏）。

### 方法二：本地伺服器（網址形式瀏覽）

需要用 `http://` 網址打開時（部分瀏覽器對 `file://` 較嚴格），任選一種：

```bash
# Python 3（內建）
python -m http.server 8000
# 然後開 http://127.0.0.1:8000

# 或 Node.js
npx serve .

# 或 VS Code 裝 "Live Server" 外掛，右鍵 index.html → Open with Live Server
```

## 取得這份資料

```bash
git clone git@github.com:louis70109/rms-data.git
cd rms-data
start index.html      # Windows；macOS 用 open、Linux 用 xdg-open
```

更新到最新版：`git pull`

---

內容版權屬原作者，本 repo 僅作個人備份存查。資料來源為各頁面的 Wayback Machine 存檔，
每篇頂部附有原始存檔連結。
