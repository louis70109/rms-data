/*
 * quiz-ocr.js — 讀取遊戲截圖並對照站內資料。目前認兩種：
 *   1. Shanks「安全冒險」(Safe Adventures) 題目 → 乖寶寶題庫的答案
 *   2. Reuel「Search for the Elixir of Life」HP 任務對話 → 是哪個地區的任務、要打哪幾隻怪物
 *
 * 瀏覽器：<script src="tesseract.min.js"></script><script src="quiz-ocr.js"></script>
 *         const bank = QuizOCR.parseBank(乖寶寶題庫頁的 HTML);
 *         const quests = QuizOCR.parseQuests(Reuel HP 任務頁的 HTML);
 *         const r = await QuizOCR.analyze(blobOrCanvasOrImg, { worker, bank, quests });
 * Node：  const r = await QuizOCR.analyze(path, { worker, bank, quests, env })  （env 見 test-quiz.js）
 *
 * 回傳：{ type: 'quiz' | 'quest' | 'none', ok, lines[], width, height, ... }
 *   type 'quiz'  → item { n, qEn, qZh, aEn, aZh }、qScore、aScore、answerBox（答案選項在原圖的位置，找不到是 null）、candidates[]
 *   type 'quest' → quest { id, region, place, minutes, items[], mobs[] }、itemsHit、mobsHit、itemBoxes[]
 *   type 'none'  → 都不像；candidates[] 是最像的前三題（讓使用者自己挑）
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

  // ---------- Reuel HP 任務 ----------
  // Reuel HP 任務頁（gen_elixir.py 產生）每張卡片：
  // <div class="elx-card" id="elx-west-minar-forest"><div class="elx-reg">Leafre</div><h4>West Minar Forest</h4>
  //   道具 <span class="elx-item"><img src="…" alt="Rash Twig"><span class="elx-cnt">×30</span></span> …
  //   怪物 <span class="elx-item elx-mob"><img src="…" alt="Hobi"><span class="elx-mn">Hobi</span></span> …
  //   <div class="elx-time">約 9 分鐘（不含移動）</div></div>
  function parseQuests(html) {
    const out = [];
    const parts = String(html).split('<div class="elx-card"').slice(1);
    for (const part of parts) {
      const id = (part.match(/^\s*id="([^"]+)"/) || [])[1];
      if (!id) continue;
      const region = strip((part.match(/<div class="elx-reg">([\s\S]*?)<\/div>/) || [])[1]);
      const place = strip((part.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1]);
      const minutes = +((part.match(/約\s*(\d+)\s*分鐘/) || [])[1]) || 0;
      const items = [], mobs = [];
      const re = /<span class="elx-item( elx-mob)?"><img src="([^"]*)" alt="([^"]*)"[^>]*>(?:<span class="elx-cnt">×(\d+)<\/span>)?/g;
      let m;
      while ((m = re.exec(part))) {
        const o = { name: decode(m[3]), img: m[2] };
        if (m[1]) mobs.push(o); else items.push(Object.assign(o, { count: m[4] ? +m[4] : 0 }));
      }
      if (items.length) out.push({ id, region, place, minutes, items, mobs });
    }
    return out;
  }

  // 一段文字裡有沒有這個名字：先看整段（空白拿掉後）是否包含；OCR 有錯字時，用同長度的滑動視窗比相似度。
  function findIn(hay, name) {
    const t = compact(name);
    if (t.length < 3) return hay.includes(t);
    if (hay.includes(t)) return true;
    const L = t.length;
    if (L < 6) return false;               // 太短的名字不做模糊比對，免得亂中
    for (let i = 0; i + L - 2 <= hay.length; i++) {
      if (dice(t, hay.slice(i, i + L)) >= 0.8) return true;
    }
    return false;
  }

  function matchQuest(lines, quests) {
    const hay = compact(lines.map((l) => l.text).join(' '));
    const wins = windows(lines.filter((l) => compact(l.text).length >= 2).slice(0));
    const flines = lines.filter((l) => compact(l.text).length >= 2);
    const scored = quests.map((q) => {
      const itemHits = q.items.map((it) => {
        const b = best(wins, compact(it.name));
        return { it, ok: findIn(hay, it.name) || b.s >= 0.8, box: b.s >= 0.8 && b.w ? boxOf(flines, b.w) : null };
      });
      const mobsHit = q.mobs.filter((m) => findIn(hay, m.name)).length;
      const itemsHit = itemHits.filter((x) => x.ok).length;
      return { q, itemsHit, mobsHit, score: itemsHit + 0.7 * mobsHit, itemBoxes: itemHits.filter((x) => x.ok && x.box).map((x) => ({ name: x.it.name, box: x.box })) };
    }).sort((a, b) => b.score - a.score);
    const top = scored[0];
    const titled = /elixir\s*of\s*life/.test(hay) || /searchfortheelixir/.test(hay);
    const ok = !!top && (top.itemsHit >= 2 || (top.itemsHit >= 1 && top.mobsHit >= 2) || top.mobsHit >= 3 || (titled && top.score >= 1));
    // 兩個任務同分（例如共用怪物）就不敢確定
    const tie = ok && scored[1] && scored[1].score >= top.score - 0.01 && scored[1].itemsHit === top.itemsHit && top.itemsHit < 2;
    return { ok: ok && !tie, titled, top, candidates: scored.slice(0, 3) };
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
    const quiz = opts.bank && opts.bank.length ? match(lines, opts.bank) : { ok: false, qScore: 0, aScore: 0, candidates: [], lines };
    const quest = opts.quests && opts.quests.length ? matchQuest(lines, opts.quests) : { ok: false, top: null, candidates: [] };
    // 兩種都像時，取信心高的：題目用題目相似度，HP 任務用命中比例
    const questConf = quest.top ? quest.top.score / (quest.top.q.items.length + 0.7 * quest.top.q.mobs.length) : 0;
    let res;
    if (quest.ok && (!quiz.ok || questConf > quiz.qScore)) {
      res = { type: 'quest', ok: true, quest: quest.top.q, itemsHit: quest.top.itemsHit, mobsHit: quest.top.mobsHit, itemBoxes: quest.top.itemBoxes, titled: quest.titled, lines };
    } else if (quiz.ok) {
      res = Object.assign({ type: 'quiz' }, quiz);
    } else {
      res = Object.assign({ type: 'none' }, quiz, { ok: false, questCandidates: quest.candidates.filter((c) => c.itemsHit >= 1 && (c.mobsHit >= 1 || quest.titled)).map((c) => c.q) });
    }
    res.width = img.width; res.height = img.height;
    return res;
  }

  return { parseBank, parseQuests, match, matchQuest, analyze, dice, compact, SCALE };
});
