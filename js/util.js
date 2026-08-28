'use strict';
/* 多语平行语料对齐工作台 —— 通用工具 */
window.PA = window.PA || {};

PA.util = (function () {

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function download(filename, blob) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  }

  function fmt(n) { return (n || 0).toLocaleString('zh-CN'); }

  function uid(prefix) { return (prefix || 'v') + Math.random().toString(36).slice(2, 8); }

  function deepClone(obj) {
    try { return structuredClone(obj); } catch (e) { return JSON.parse(JSON.stringify(obj)); }
  }

  function sanitizeName(name) {
    return String(name || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'corpus';
  }

  /* ---------- 字符类别（用于长度加权 / 分句 / 语言检测） ---------- */
  function charClass(cp) {
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
        (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0x20000 && cp <= 0x2FA1F)) return 'han';
    if (cp >= 0x3041 && cp <= 0x309F) return 'hira';
    if (cp >= 0x30A1 && cp <= 0x30FF) return 'kata';
    if ((cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0x3130 && cp <= 0x318F)) return 'hangul';
    if (cp >= 0x0E00 && cp <= 0x0E7F) return 'thai';
    if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0750 && cp <= 0x077F) ||
        (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)) return 'arabic';
    if (cp >= 0x0900 && cp <= 0x097F) return 'deva';
    if (cp >= 0x0400 && cp <= 0x04FF) return 'cyrillic';
    if (cp >= 0x0370 && cp <= 0x03FF) return 'greek';
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A) ||
        (cp >= 0x00C0 && cp <= 0x024F) || (cp >= 0x1E00 && cp <= 0x1EFF) ||
        (cp >= 0x0100 && cp <= 0x017F)) return 'latin';
    if ((cp >= 0x0030 && cp <= 0x0039) || (cp >= 0xFF10 && cp <= 0xFF19)) return 'digit';
    if (cp === 0x20 || cp === 0x09 || cp === 0x3000 || cp === 0x0A) return 'space';
    return 'other';
  }

  /* 加权长度：汉字 2.3 / 假名 1.8 / 谚文 2.1 / 泰文 1.6 / 其他 1.0 —— 使跨文种长度可比较 */
  function weightedLen(text) {
    let w = 0;
    for (const ch of String(text || '')) {
      const c = charClass(ch.codePointAt(0));
      w += c === 'han' ? 2.3 : (c === 'hira' || c === 'kata') ? 1.8 : c === 'hangul' ? 2.1 : c === 'thai' ? 1.6 : 1;
    }
    return w;
  }

  /* 粗略判断文本是否为 CJK 文种（决定合并句子的连接符） */
  function isCJKText(text) {
    const t = String(text || '');
    if (!t) return false;
    let cjk = 0, total = 0;
    for (const ch of t) {
      const c = charClass(ch.codePointAt(0));
      if (c === 'han' || c === 'hira' || c === 'kata') cjk++;
      if (c !== 'space' && c !== 'other' && c !== 'digit') total++;
    }
    return total > 0 && cjk / total > 0.3;
  }

  function tick() { return new Promise(r => setTimeout(r, 0)); }

  return {
    $, $$, escapeHtml, download, timestamp, debounce, fmt, uid, deepClone, sanitizeName,
    charClass, weightedLen, isCJKText, tick
  };
})();
