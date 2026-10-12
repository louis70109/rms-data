# rms-data · MapleRoyals 攻略庫

MapleRoyals（mapleroyals.net）關站後，自網際網路檔案館（Wayback Machine）與 royals.ms 論壇救回的公開攻略，
整理成一個**單頁應用（SPA）**：分類側邊欄（可收合）、搜尋、同頁切換、圖片放大。

線上：https://rms-data.fly.dev/

## 內容（40 篇）

| 分類 | 篇目 |
|------|------|
| 規則 | 乖寶寶題庫 |
| 前置任務（24） | 總覽；技能前置（戰士／法師／弓箭手／盜賊／海盜）；殘暴炎魔、炎魔忍耐替代、闇黑龍王、天皇蟾蜍、獅子王城、鐘王、樹王、船長、熊獅、妖僧、CWKPQ、艾靈森林、時間神殿、東京、LHC 圖騰交換、魔王巴洛谷 前置；結婚手冊；寵物任務－騎寵任務 |
| 轉職 | 二轉／三轉／四轉流程 |
| 技能書 | 全職業共通、劍士、法師、弓箭手、盜賊、海盜 |
| 道具 | iTCG 裝備製作 |
| 論壇攻略 | APQ Bonus、APQ 完整攻略（中英對照）、區域 BOSS 一覽、轉職補充（New Source）、四轉技能補充 |

> 賺錢相關頁面已移除；密碼保護與標註「不公開」的文章未收錄。Wayback 沒有存檔的圖片已從頁面移除。

## 在本機架起來看

**方法一（免安裝）**：直接雙擊 `index.html`（圖片在同資料夾的 `assets/`）。

**方法二（本機伺服器）**：
```bash
python -m http.server 8000     # 開 http://127.0.0.1:8000
# 或 npx serve .
```

## 取得與更新
```bash
git clone git@github.com:louis70109/rms-data.git
cd rms-data && python -m http.server 8000
# 更新：git pull
```

## 部署（Fly.io）
push 到 `main` 會由 GitHub Actions 自動部署（需要 `FLY_API_TOKEN` secret）。細節與維護說明見 [AGENTS.md](AGENTS.md)。

---
內容版權屬原作者，本 repo 僅作個人備份存查。
