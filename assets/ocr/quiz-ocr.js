/*
 * quiz-ocr.js — 讀取遊戲裡 Shanks「安全冒險」(Safe Adventures) 題目截圖，對照乖寶寶題庫找出答案。
 *
 * 瀏覽器：<script src="tesseract.min.js"></script><script src="quiz-ocr.js"></script>
 *         const bank = QuizOCR.parseBank(乖寶寶題庫頁的 HTML);
 *         const r = await QuizOCR.analyze(blobOrCanvasOrImg, { worker, bank });
 * Node：  const r = await QuizOCR.analyze(path, { worker, bank, env })  （env 見 test-quiz.js）
 *
 * 回傳：{ ok, item, qScore, aScore, answerBox, candidates[], lines[], width, height }
 *   item        題庫那題 { n, qEn, qZh, aEn, aZh }
 *   answerBox   答案選項在原圖裡的位置 { x0, y0, x1, y1 }（原圖像素），找不到時是 null
 *   candidates  最像的前三題（ok 為 false 時讓使用者自己挑）
 *
 * 做法：整張圖 OCR → 把相鄰幾行合成「視窗」→ 用字元三連詞 Dice 相似度比對題目與答案。
 * 題目文字和選項不必逐字相同；OCR 把 I 讀成 | 、漏掉空白都沒關係。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuizOCR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCALE = 3;          // 放大倍數：遊戲字小，放大後辨識率高很多
  const MAXWIN = 4;         // 一題或一個選項最多折成幾行

  const browserEnv = {
    async loadImage(src) {
      if (src && src.getContext) return src;
      if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) return src;
      const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
      return await createImageBitmap(blob);
    },
    createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
    toInput(canvas) { return canvas; },
  };

  // ---------- 題庫 ----------
  const decode = (s) => s
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const strip = (s) => decode(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const afterColon = (s) => strip(s).replace(/^[^:：]*[:：]\s*/, '');

  // 乖寶寶題庫頁的結構：<div class="qa"><div class="q">Q1（英文）: …<br>問1（中文）: …</div><div class="a">A1（英文）: …<br>答1（中文）: …</div></div>
  function parseBank(html) {
    const out = [];
    const re = /<div class="qa"><div class="q">([\s\S]*?)<\/div><div class="a">([\s\S]*?)<\/div><\/div>/g;
    let m;
    while ((m = re.exec(html))) {
      const [qe, qz] = m[1].split(/<br\s*\/?>/i);
      const [ae, az] = m[2].split(/<br\s*\/?>/i);
      const n = +((strip(qe).match(/^Q\s*(\d+)/i) || [])[1]) || out.length + 1;
      out.push({ n, qEn: afterColon(qe), qZh: afterColon(qz), aEn: afterColon(ae), aZh: afterColon(az) });
    }
    return out;
  }

  // ---------- 相似度 ----------
  // 全部轉小寫、只留英數；OCR 常把 I 讀成 | ，空白也常被吃掉或多出來，所以連空白都拿掉再比。
  const compact = (s) => String(s).replace(/\|/g, 'i').replace(/[’‘`´']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  function grams(s) {
    const m = new Map();
    for (let i = 0; i + 3 <= s.length; i++) { const g = s.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); }
    return m;
  }
  function dice(a, b) {
    if (a.length < 3 || b.length < 3) return a && a === b ? 1 : 0;
    const A = grams(a), B = grams(b);
    let inter = 0, na = 0, nb = 0;
    for (const [g, c] of A) { na += c; inter += Math.min(c, B.get(g) || 0); }
    for (const c of B.values()) nb += c;
    return (2 * inter) / (na + nb);
  }

  function windows(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      let text = '';
      for (let len = 1; len <= MAXWIN && i + len <= lines.length; len++) {
        text += (len > 1 ? ' ' : '') + lines[i + len - 1].text;
        out.push({ i, j: i + len - 1, c: compact(text) });
      }
    }
    return out;
  }
  const overlap = (a, b) => a.i <= b.j && b.i <= a.j;
  function best(wins, target, avoid) {
    let top = { s: 0, w: null };
    for (const w of wins) {
      if (avoid && overlap(w, avoid)) continue;
      const s = dice(target, w.c);
      if (s > top.s) top = { s, w };
    }
    return top;
  }
  function boxOf(lines, w) {
    const b = lines.slice(w.i, w.j + 1).map((l) => l.bbox);
    return { x0: Math.min(...b.map((x) => x.x0)), y0: Math.min(...b.map((x) => x.y0)), x1: Math.max(...b.map((x) => x.x1)), y1: Math.max(...b.map((x) => x.y1)) };
  }

  // lines: [{ text, bbox:{x0,y0,x1,y1} }]（座標隨便，只要統一）；bank 來自 parseBank
  function match(lines, bank) {
    lines = lines.filter((l) => compact(l.text).length >= 2);
    const wins = windows(lines);
    const scored = bank.map((item) => {
      const q = best(wins, compact(item.qEn));
      const a = best(wins, compact(item.aEn), q.w);
      return { item, qScore: q.s, aScore: a.s, ansWin: a.w, qWin: q.w };
    }).sort((x, y) => (y.qScore + y.aScore) - (x.qScore + x.aScore));
    const top = scored[0] || { qScore: 0, aScore: 0 };
    // 答案框左邊界不要比題目文字更靠左（NPC 名牌、頭像的雜訊會被 OCR 當成行首文字）
    const answerBox = (() => {
      if (!(top.item && top.ansWin && top.aScore >= 0.5)) return null;
      const b = boxOf(lines, top.ansWin);
      if (top.qWin) b.x0 = Math.max(b.x0, boxOf(lines, top.qWin).x0 - 14);
      return b;
    })();
    const ok = !!top.item && (top.qScore >= 0.6 || (top.qScore >= 0.4 && top.aScore >= 0.6) || (top.qScore >= 0.3 && top.aScore >= 0.75));
    return {
      ok,
      item: ok ? top.item : null,
      qScore: top.qScore, aScore: top.aScore,
      answerBox: ok ? answerBox : null,
      candidates: scored.slice(0, 3).map((x) => ({ item: x.item, score: +(x.qScore + x.aScore).toFixed(2) })),
      lines,
    };
  }

  // ---------- 影像前處理與 OCR ----------
  // 放大 + 取三個色版的最小值當灰階：藍色、紅色、黑色字都變深色，白底和淺灰底還是亮的。
  function preprocess(env, img) {
    const c = env.createCanvas(img.width * SCALE, img.height * SCALE), g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const v = Math.min(a[i], a[i + 1], a[i + 2]); a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return c;
  }

  async function analyze(src, opts) {
    const env = opts.env || browserEnv, worker = opts.worker;
    const img = await env.loadImage(src);
    const canvas = preprocess(env, img);
    await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
    const r = await worker.recognize(env.toInput(canvas), {}, { blocks: true });
    const raw = (r.data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    const lines = raw.map((l) => ({
      text: l.text.replace(/\s+/g, ' ').trim(),
      bbox: { x0: l.bbox.x0 / SCALE, y0: l.bbox.y0 / SCALE, x1: l.bbox.x1 / SCALE, y1: l.bbox.y1 / SCALE },
    })).filter((l) => l.text);
    const res = match(lines, opts.bank);
    res.width = img.width; res.height = img.height;
    return res;
  }

  return { parseBank, match, analyze, dice, compact, SCALE };
});
