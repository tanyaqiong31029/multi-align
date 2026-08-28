'use strict';
/* SRT / VTT 字幕：解析、生成、翻译单元时间轴附着
 * 时间轴是字幕对齐的天然锚点：解析出的 start/end（毫秒）会作为句子特征
 * 参与对齐打分（见 aligner.js 的 srtWeight）。
 */
PA.SRT = (function () {

  /* "00:01:02,500" / "00:01:02.500" / VTT 的 "01:02.500" → 毫秒 */
  function tsToMs(tok) {
    const m = String(tok).trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
    if (!m) return null;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const ms = parseInt((m[4] + '00').slice(0, 3), 10);
    return ((h * 60 + parseInt(m[2], 10)) * 60 + parseInt(m[3], 10)) * 1000 + ms;
  }

  function msToTs(ms) {
    ms = Math.max(0, Math.round(ms));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms / 60000) % 60;
    const s = Math.floor(ms / 1000) % 60;
    const x = ms % 1000;
    const p = (n, w) => String(n).padStart(w, '0');
    return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(x, 3);
  }

  /* 去除 <i> <font> 等 HTML 标签与 {\an8} 位置标签 */
  function cleanText(line) {
    return String(line)
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeSrt(text) {
    const t = String(text || '');
    return /-->\s*(?:\d{1,3}:)?\d{1,2}:\d{2}[.,]\d{1,3}/.test(t) || /^\uFEFF?WEBVTT/i.test(t.trim());
  }

  /* 宽容解析：序号行可有可无，支持 VTT 头、毫秒点/逗号、无小时时间戳 */
  function parse(text) {
    const src = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const tsRe = /((?:\d{1,3}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
    const cues = [];
    for (const block of src.split(/\n{2,}/)) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (!lines.length) continue;
      let ti = -1, m = null;
      for (let i = 0; i < lines.length; i++) {
        m = lines[i].match(tsRe);
        if (m) { ti = i; break; }
      }
      if (ti < 0) continue; // WEBVTT 头 / NOTE / 空块
      const t0 = tsToMs(m[1]), t1 = tsToMs(m[2]);
      if (t0 === null || t1 === null) continue;
      const body = lines.slice(ti + 1).map(cleanText).filter(x => x !== '').join(' ');
      if (!body || t1 <= t0) continue;
      cues.push({ start: t0, end: t1, text: body });
    }
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  function fmtCue(idx, t0, t1, lines) {
    return idx + '\n' + msToTs(t0) + ' --> ' + msToTs(t1) + '\n' + lines.filter(l => l !== '').join('\n');
  }

  /* groups: [{t0, t1, lines:[各行文本]}] → 标准多语 SRT */
  function formatGroups(groups) {
    return groups
      .filter(g => g.t0 !== undefined && g.t1 !== undefined && g.lines.some(l => l !== ''))
      .map((g, i) => fmtCue(i + 1, g.t0, g.t1, g.lines))
      .join('\n\n') + '\n';
  }

  /* 对齐完成后为每个翻译单元附基准语时间轴。
   * 原理：TU 的基准语单元格按序由 1..n 条 cue 拼接而成，用指针顺序消费；
   * 去除空白后比对以兼容 CJK 无连接符 / 西文空格两种拼接方式。
   * 无法匹配的 TU（人工改乱）回退为上一条结束时间 +3s，保证 SRT 时间轴单调。
   */
  function attachTiming(tus, pivotId, pivotSegs) {
    if (!tus || !tus.length || !pivotSegs || !pivotSegs.length) return;
    if (pivotSegs[0].t0 === undefined) return; // 基准语无时间轴
    const norm = s => String(s).replace(/\s+/g, '');
    let j = 0, prevEnd = 0;
    for (const tu of tus) {
      const cell = tu.cells[pivotId] || '';
      const target = norm(cell);
      let t0 = null, t1 = null;
      if (target) {
        let acc = '';
        for (let k = j; k < pivotSegs.length; k++) {
          acc += pivotSegs[k].text;
          if (norm(acc) === target) {
            t0 = pivotSegs[j].t0;
            t1 = pivotSegs[k].t1;
            j = k + 1;
            break;
          }
          if (norm(acc).length > target.length) break; // 拼过头了：不匹配
        }
      }
      if (t0 === null) { t0 = prevEnd; t1 = prevEnd + 3000; }
      tu.t0 = t0; tu.t1 = t1;
      prevEnd = t1;
    }
  }

  return { parse, formatGroups, looksLikeSrt, attachTiming, tsToMs, msToTs };
})();
