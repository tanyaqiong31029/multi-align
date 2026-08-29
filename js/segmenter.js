'use strict';
/* 多语平行语料对齐工作台 —— 多语分句 / 语言档案 / 词汇特征 */
PA.Seg = (function () {
  const U = PA.util;

  const LANGS = [
    { code: 'zh-CN', name: '中文（简体）', group: 'zh' },
    { code: 'zh-TW', name: '中文（繁體）', group: 'zh' },
    { code: 'en', name: 'English', group: 'latin' },
    { code: 'ja', name: '日本語', group: 'ja' },
    { code: 'ko', name: '한국어', group: 'ko' },
    { code: 'fr', name: 'Français', group: 'latin' },
    { code: 'de', name: 'Deutsch', group: 'latin' },
    { code: 'es', name: 'Español', group: 'latin' },
    { code: 'pt', name: 'Português', group: 'latin' },
    { code: 'it', name: 'Italiano', group: 'latin' },
    { code: 'ru', name: 'Русский', group: 'latin' },
    { code: 'ar', name: 'العربية', group: 'ar' },
    { code: 'th', name: 'ไทย', group: 'th' },
    { code: 'vi', name: 'Tiếng Việt', group: 'latin' },
    { code: 'id', name: 'Bahasa Indonesia', group: 'latin' },
    { code: 'ms', name: 'Bahasa Melayu', group: 'latin' },
    { code: 'tr', name: 'Türkçe', group: 'latin' },
    { code: 'nl', name: 'Nederlands', group: 'latin' },
    { code: 'pl', name: 'Polski', group: 'latin' },
    { code: 'uk', name: 'Українська', group: 'latin' }
  ];

  function langInfo(code) {
    return LANGS.find(l => l.code === code) || { code: code || 'en', name: code || '未知', group: 'latin' };
  }
  function langGroup(lang) { return langInfo(lang).group; }
  /* 词汇相似度仅在“兼容文种”间启用：同组，或中↔日（共享汉字） */
  function lexCompatible(g1, g2) { return g1 === g2 || (g1 === 'zh' && g2 === 'ja') || (g1 === 'ja' && g2 === 'zh'); }
  /* 同组长度方差 6.8（Gale-Church 经验值），跨组放大到 9 */
  function autoVariance(g1, g2) { return g1 === g2 ? 6.8 : 9.0; }

  /* ---------- 语言自动检测 ---------- */
  function detectLang(text) {
    const t = String(text || '').slice(0, 3000);
    if (!t.trim()) return null;
    const cnt = { han: 0, hira: 0, kata: 0, hangul: 0, thai: 0, arabic: 0, cyrillic: 0, greek: 0, latin: 0 };
    for (const ch of t) {
      const c = U.charClass(ch.codePointAt(0));
      if (cnt[c] !== undefined) cnt[c]++;
    }
    const cjk = cnt.han + cnt.hira + cnt.kata;
    if (cnt.hira + cnt.kata > 0 && cnt.hira + cnt.kata >= cnt.han * 0.25) return 'ja';
    if (cnt.han > 0 && cnt.han > cjk * 0.6) return 'zh-CN';
    if (cnt.hangul > 0) return 'ko';
    if (cnt.thai > 0) return 'th';
    if (cnt.arabic > 0) return 'ar';
    if (cnt.cyrillic > 0) return 'ru';
    if (cnt.greek > 0) return 'en';
    if (cnt.latin > 0) return 'en';
    return null;
  }

  /* ---------- 分句 ---------- */
  const ENDERS = '.。！？‼⁇⁈⁉!?…';
  const CLOSERS = '」』》〉）】〕”’"\'»)]｝｠';
  const ABBREV = new Set(('mr,mrs,ms,dr,prof,sr,jr,st,mt,no,nos,vs,etc,al,inc,ltd,co,corp,dept,univ,approx,apt,appt,' +
    'est,min,max,fig,figs,eq,eqs,ref,refs,vol,vols,pp,p,ed,eds,cf,ca,cca,sec,secs,hrs,hr,' +
    'jan,feb,mar,apr,jun,jul,aug,sep,sept,oct,nov,dec,mon,tue,wed,thu,fri,sat,sun,' +
    'u.s,u.k,u.n,u.s.a,u.k.e,u.n.e,e.g,i.e,a.m,p.m,eg,ie,etc').split(','));

  function isEnder(ch) { return ENDERS.indexOf(ch) >= 0; }
  function isCloser(ch) { return CLOSERS.indexOf(ch) >= 0; }

  function isStartChar(ch) {
    if (!ch) return false;
    const cls = U.charClass(ch.codePointAt(0));
    switch (cls) {
      case 'han': case 'hira': case 'kata': case 'hangul':
      case 'thai': case 'arabic': case 'deva': case 'digit':
        return true;
      case 'latin':
        return !/[a-zà-öø-ÿ]/.test(ch);
      case 'cyrillic': case 'greek':
        return ch.toLowerCase() !== ch && ch.toLowerCase() !== ch.toUpperCase();
      default:
        return /["“‘(\[«《「『【'«]/.test(ch);
    }
  }

  /* 取标点前的词元（字母/数字/点），用于缩写判断 */
  function lastWordToken(line, i) {
    let s = i - 1, e = i;
    while (s >= 0 && /[A-Za-z0-9.\u00C0-\u024F]/.test(line[s])) s--;
    return line.slice(s + 1, e);
  }

  /* 单行分句（统一处理 CJK / 拉丁 / 混排） */
  function segmentLine(line, opts) {
    const res = [];
    const L = line.length;
    let start = 0, i = 0;
    const splitSemi = opts && opts.splitSemi;
    while (i < L) {
      const ch = line[i];
      const semi = splitSemi && (ch === ';' || ch === '；');
      if (isEnder(ch) || semi) {
        // 小数快速跳过：3.14 / 1,000.00
        if (ch === '.' && /[0-9]/.test(line[i - 1] || '') && /[0-9]/.test(line[i + 1] || '')) { i++; continue; }
        let j = i + 1;
        while (j < L && isEnder(line[j])) j++;
        let k = j;
        while (k < L && isCloser(line[k])) k++;
        let m = k;
        while (m < L && /\s/.test(line[m])) m++;

        let boundary = false;
        if (m >= L) boundary = true;
        else if (m > k) boundary = isStartChar(line[m]);
        else boundary = isStartChar(line[k]);

        if (boundary && ch === '.') {
          const tok = lastWordToken(line, i);
          if (tok) {
            if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(tok) || /^[A-Za-z]$/.test(tok)) boundary = false;
            else if (ABBREV.has(tok.toLowerCase().replace(/\.+$/, ''))) boundary = false;
            // 行首 1–2 位数字：有序列表标号（"1. 引言" / "12. Conclusion"），不切。
            // 限行首防误伤句中数字（"He got 3. The game…"），限 2 位防误伤年份（"in 2024. The year…"）。
            else if (/^\d{1,2}$/.test(tok) && line.slice(0, i).trim() === tok) boundary = false;
          }
        }
        if (boundary && semi) {
          // 分号：直接切（不判断下一字符）
          res.push(line.slice(start, i + 1).trim());
          start = i + 1; i = start;
          continue;
        }
        if (boundary) {
          const piece = line.slice(start, k).trim();
          if (piece) res.push(piece);
          start = m; i = m;
          continue;
        }
        i = Math.max(j, i + 1);
        continue;
      }
      i++;
    }
    const tail = line.slice(start).trim();
    if (tail) res.push(tail);
    return res;
  }

  /* 富分句：返回 [{text, para}]，para 为自然段编号（空行分隔） */
  function segmentRich(text, lang, opts) {
    opts = opts || {};
    const out = [];
    const paras = String(text || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/);
    const group = langGroup(lang);
    paras.forEach((para, pi) => {
      if (!para || !para.trim()) return;
      para.split('\n').forEach(line => {
        if (!line.trim()) return;
        let sents;
        if (group === 'th' && !/[.!?。！？]/.test(line)) {
          sents = [line.trim()];
        } else {
          sents = segmentLine(line, opts);
        }
        sents.forEach(s => { if (s) out.push({ text: s, para: pi }); });
      });
    });
    return out;
  }

  function segmentPlain(text, lang, opts) {
    return segmentRich(text, lang, opts).map(s => s.text);
  }

  /* ---------- 对齐用特征 ---------- */
  /* 数字集合（跨语种强锚点）：全角归一、去分隔符 */
  function extractNums(text) {
    const s = new Set();
    const t = String(text || '').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
    const ms = t.match(/[0-9]+(?:[.,][0-9]+)*%?|[０-９]/g) || [];
    for (const m of ms) s.add(m.replace(/[.,]/g, ''));
    return s;
  }

  /* 词汇特征：汉字→二元组，其他→词（同文种相似度用） */
  function simTokens(text) {
    const s = new Set();
    const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    for (const w of words) {
      if (/[\u4e00-\u9fff]/.test(w)) {
        if (w.length === 1) s.add(w);
        else for (let i = 0; i < w.length - 1; i++) s.add(w.slice(i, i + 2));
      } else if (w.length > 1) {
        s.add(w);
      }
    }
    return s;
  }

  function isCJKText(t) { return U.isCJKText(t); }

  return {
    LANGS, langInfo, langGroup, lexCompatible, autoVariance, detectLang,
    segmentRich, segmentPlain, extractNums, simTokens, isCJKText
  };
})();
