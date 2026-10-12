/*
 * price-ocr.js — 讀取遊戲「Item Search」截圖：抓出商品名稱與各店家價格。
 *
 * 瀏覽器：<script src="tesseract.min.js"></script><script src="price-ocr.js"></script>
 *         const r = await PriceOCR.analyze(blobOrCanvasOrImg);
 *         PriceOCR.onPaste(document, (blob)=>PriceOCR.analyze(blob).then(show));   // 從剪貼簿貼上
 * Node：  const r = await PriceOCR.analyze(path, nodeEnv)  （nodeEnv 見 test.js）
 *
 * 回傳：{ item, prices[], best, second, ratio, warning, notes[] }
 *   item     "[Mastery Book] Genesis"（每張圖不同，從 "Search results for … that you entered" 抓）
 *   prices   PRICE 欄由上而下的金額（數字）
 *   best     第一列金額（遊戲預設由低到高排序）
 *   warning  第二列 ≥ 第一列 2 倍時的提醒文字，否則 null
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PriceOCR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COL_SCALES = [4, 5, 3, 6, 7];  // 價格欄只認數字，用多種放大倍數各讀一次再投票（平手時以前面的為準）
  const SCALE = 3;           // 放大倍數：遊戲字小，放大後辨識率高很多
  const RATIO_LIMIT = 2;     // 第二名 ≥ 第一名的幾倍就提醒

  // ---------- 環境（瀏覽器預設；Node 由呼叫端傳入同樣介面） ----------
  const browserEnv = {
    async loadImage(src) {
      if (src && src.getContext) return src;                       // canvas
      if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) return src;
      const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
      return await createImageBitmap(blob);
    },
    createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
    toInput(canvas) { return canvas; },                            // tesseract.js 直接吃 canvas
  };

  // ---------- 前處理：放大 + 取綠色通道當灰階 ----------
  // 洋紅色價格字 (255,0,255) 在綠色通道是黑的，黑字/灰字也一樣深，白底則是白，所以文字全部變成深色。
  function preprocess(env, img, crop, SCALE = 3) {
    const sx = crop ? crop.x : 0, sy = crop ? crop.y : 0;
    const sw = crop ? crop.w : img.width, sh = crop ? crop.h : img.height;
    const pad = 12 * SCALE;
    const c = env.createCanvas(sw * SCALE + pad * 2, sh * SCALE + pad * 2);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, pad, pad, sw * SCALE, sh * SCALE);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      let v = Math.min(p[i], p[i + 1], p[i + 2]);               // 最小通道
      v = v > 200 ? 255 : v < 90 ? 0 : (v - 90) * 255 / 110;      // 拉對比
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    return { canvas: c, pad, ox: sx, oy: sy };
  }

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const wordsOf = (data) => (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)));

  // ---------- 純文字解析（可單獨測試） ----------
  function parseItem(text) {
    const t = text.replace(/\s+/g, ' ');
    let m = t.match(/Search results for\s+(.+?)\s+that you entered/i);
    if (!m) m = t.match(/Search results for\s+(\[[^\]]+\][^.]*?)(?:\.|Total of)/i);   // 「that you entered」被讀壞時的備援
    if (!m) m = t.match(/(\[[^\]]{2,40}\]\s*[A-Za-z0-9' :\-]{2,50})/);                // 最後備援：找 [分類] 名稱
    return m ? m[1].trim() : null;
  }

  // 價格欄 OCR 文字 → 數字陣列。只留數字，忽略逗點；長度 4~12 才算金額
  function parsePrices(text) {
    return text.split(/\n/).map(l => l.replace(/[^0-9]/g, '')).filter(s => s.length >= 4 && s.length <= 12).map(Number);
  }

  // 多次辨識投票。每次辨識各有容易讀錯的數字，而且有時會整列漏掉：
  // 1) 列數取「至少兩次辨識都讀到」的最大值（漏列比多列常見）
  // 2) 列數不足的那幾次，用相似度依序對回完整的列（價格由低到高排，所以對應是單調的）
  // 3) 逐列：位數取最多票（平手取較長），再逐位數字取最多票（平手取前面那次）
  function vote(runs, maxRows) {
    runs = runs.filter(r => r.length);
    if (!runs.length) return [];
    const cnt = {}; runs.forEach(r => cnt[r.length] = (cnt[r.length] || 0) + 1);
    let n = Math.max(...Object.keys(cnt).map(Number).filter(k => cnt[k] >= 2 && (!maxRows || k <= maxRows)), 0);
    if (!n) n = Math.max(...Object.keys(cnt).map(Number));
    const ref = runs.find(r => r.length === n).map(String);
    const rows = Array.from({ length: n }, () => []);
    runs.forEach(r => {
      if (r.length > n) return;
      if (r.length === n) { r.forEach((v, i) => rows[i].push(String(v))); return; }
      let from = 0;                                               // 短的那次：每個值對到最像的參考列（只往下找）
      r.forEach((v, i) => {
        const left = r.length - i - 1;                            // 後面還有幾個值要放，不能把位置用光
        let best = from, bd = Infinity;
        for (let j = from; j <= n - 1 - left; j++) { const d = lev(String(v), ref[j]); if (d < bd) { bd = d; best = j; } }
        rows[best].push(String(v)); from = best + 1;
      });
    });
    const mode = (arr, tieHigh) => {
      const t = {}; arr.forEach(v => t[v] = (t[v] || 0) + 1);
      const top = Math.max(...Object.values(t));
      const best = arr.filter(v => t[v] === top);
      return tieHigh ? Math.max(...best) : best[0];
    };
    return rows.map(strs => {
      const len = mode(strs.map(x => x.length), true);
      const same = strs.filter(x => x.length === len);
      let out = '';
      for (let k = 0; k < len; k++) out += mode(same.map(x => x[k]), false);
      return Number(out);
    });
  }

  function judge(prices) {
    const best = prices[0] ?? null, second = prices[1] ?? null;
    const ratio = best && second ? second / best : null;
    const warning = ratio !== null && ratio >= RATIO_LIMIT
      ? `⚠ 第二低價 ${second.toLocaleString()} 是最低價 ${best.toLocaleString()} 的 ${ratio.toFixed(1)} 倍，價差很大，請確認最低價是否正常。`
      : null;
    return { best, second, ratio, warning };
  }

  // ---------- 主流程 ----------
  async function analyze(source, opts) {
    opts = opts || {};
    const env = opts.env || browserEnv;
    const Tess = opts.Tesseract || (typeof Tesseract !== 'undefined' ? Tesseract : null);
    if (!Tess) throw new Error('找不到 Tesseract.js');
    const notes = [];
    const img = await env.loadImage(source);
    const worker = opts.worker || await Tess.createWorker('eng', 1, opts.workerOptions);
    try {
      // 第一階段：整張圖，找商品名稱與表頭位置
      const full = preprocess(env, img);
      await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
      const r1 = await worker.recognize(env.toInput(full.canvas), {}, { blocks: true });
      const item = parseItem(r1.data.text);
      if (!item) notes.push('找不到商品名稱（Search results for … 那行）');

      // 第二階段：用 PRICE 表頭的位置裁出價格欄，只認數字
      const ws = wordsOf(r1.data);
      // 灰色表頭常被讀歪（PRICE→FRICE），所以用編輯距離容錯
      const find = (name, tol) => ws.find(w => lev(w.text.replace(/[^A-Za-z]/g, '').toUpperCase(), name) <= tol);
      const hP = find('PRICE', 1);
      let prices = [];
      const toX = (v) => (v - full.pad) / SCALE, toY = (v) => (v - full.pad) / SCALE;
      let crop = null;
      if (hP) {
        // 價格是靠右對齊的數字，位於 PRICE 表頭附近：左界略往 PRICE 左邊拉（排除 BUNDLE 的數字），右界取 PRICE 表頭右緣再多 22px（不依賴數量欄）
        const left = Math.max(0, toX(hP.bbox.x0) - 24);
        const right = Math.min(img.width, toX(hP.bbox.x1) + 22);
        const top = toY(hP.bbox.y1) + 2;
        crop = { x: left, y: top, w: right - left, h: img.height - top };
      } else {
        // 表頭沒讀到時：用第一階段讀到的「像金額的字」（6~10 位數字）定位。金額靠右對齊，取右緣中位數，往左 68px 當欄寬
        const cand = ws.filter(w => { const n = w.text.replace(/\D/g, '').length; return n >= 6 && n <= 10 && /^[\d.,]+$/.test(w.text); });
        if (cand.length) {
          const rights = cand.map(w => toX(w.bbox.x1)).sort((p, q) => p - q);
          const right = Math.min(img.width, rights[rights.length >> 1] + 3);
          const left = Math.max(0, right - 68);
          const top = Math.max(0, Math.min(...cand.map(w => toY(w.bbox.y0))) - 5);
          const bottom = Math.min(img.height, Math.max(...cand.map(w => toY(w.bbox.y1))) + 5);
          crop = { x: left, y: top, w: right - left, h: bottom - top };
          notes.push('沒讀到 PRICE 表頭，改用金額位置定位價格欄');
        }
      }
      if (crop) {
        // 不同放大倍數各有容易讀錯的數字（9/3、5/3），所以讀三次、逐列投票
        await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '0123456789,' });
        const runs = [];
        for (const sc of COL_SCALES) {
          const col = preprocess(env, img, crop, sc);
          const r2 = await worker.recognize(env.toInput(col.canvas));
          runs.push(parsePrices(r2.data.text));
        }
        const tm0 = r1.data.text.match(/Total of\s*(\d+)\s*results?/i);
        prices = vote(runs, tm0 ? +tm0[1] : 0);
      }
      if (!prices.length) notes.push('沒有讀到任何金額');

      // 與 "Total of N results" 交叉檢查
      const tm = r1.data.text.match(/Total of\s*(\d+)\s*results?/i);
      if (tm && +tm[1] !== prices.length) notes.push(`畫面寫共 ${tm[1]} 筆，但只讀到 ${prices.length} 筆金額，請人工確認`);

      return { item, prices, ...judge(prices), notes };
    } finally {
      if (!opts.worker) await worker.terminate();
    }
  }

  // 從剪貼簿貼上圖片（Ctrl+V）。回傳取消監聽的函式
  function onPaste(target, cb) {
    const h = (e) => {
      const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (!it) return;
      e.preventDefault();
      cb(it.getAsFile());
    };
    target.addEventListener('paste', h);
    return () => target.removeEventListener('paste', h);
  }

  return { analyze, onPaste, parseItem, parsePrices, vote, judge, RATIO_LIMIT };
});
