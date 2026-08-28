'use strict';
/* 多语平行语料对齐工作台 —— 文件导入
 * 支持 .txt / .md（自动识别 UTF-8 / GBK / Big5 编码）与 .docx（内置迷你 ZIP 解包器，
 * 依赖浏览器 DecompressionStream，无需任何外部库）。
 */
PA.Import = (function () {

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  PA.crc32 = crc32;

  /* ---------- 迷你 ZIP 读取器（支持 STORE 与 DEFLATE） ---------- */
  async function unzipEntry(buffer, wantedName) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 ZIP/DOCX 文件');
    const count = dv.getUint16(eocd + 10, true);
    let ptr = dv.getUint32(eocd + 16, true);
    let found = null;
    for (let n = 0; n < count && ptr + 46 <= u8.length; n++) {
      if (dv.getUint32(ptr, true) !== 0x02014b50) break;
      const method = dv.getUint16(ptr + 10, true);
      const compSize = dv.getUint32(ptr + 20, true);
      const nameLen = dv.getUint16(ptr + 28, true);
      const extraLen = dv.getUint16(ptr + 30, true);
      const cmtLen = dv.getUint16(ptr + 32, true);
      const lho = dv.getUint32(ptr + 42, true);
      const name = new TextDecoder().decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
      if (name === wantedName) found = { method: method, compSize: compSize, lho: lho };
      ptr += 46 + nameLen + extraLen + cmtLen;
    }
    if (!found) throw new Error('ZIP 中未找到 ' + wantedName);
    const ln = dv.getUint16(found.lho + 26, true);
    const le = dv.getUint16(found.lho + 28, true);
    const dataStart = found.lho + 30 + ln + le;
    const data = u8.subarray(dataStart, dataStart + found.compSize);
    if (found.method === 0) return data;
    if (found.method === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('当前浏览器不支持解压 DOCX，请改用 Chrome / Edge / Safari 16.4+，或将文档另存为 TXT');
      }
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error('不支持的压缩方式');
  }

  /* ---------- DOCX → 纯文本（保留段落，段落间以空行分隔以启用段落锚定） ---------- */
  function xmlUnescape(s) {
    return String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&amp;/g, '&');
  }

  function paraText(pXml) {
    let out = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>/g;
    let m;
    while ((m = re.exec(pXml))) {
      if (m[1] !== undefined) out += xmlUnescape(m[1]);
      else if (m[0].indexOf('tab') >= 0) out += '\t';
      else out += '\n';
    }
    return out;
  }

  async function readDocxText(file) {
    const buf = await file.arrayBuffer();
    const xmlU8 = await unzipEntry(buf, 'word/document.xml');
    const xml = new TextDecoder('utf-8').decode(xmlU8);
    const lines = [];
    const pRe = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
    let m;
    while ((m = pRe.exec(xml))) {
      lines.push(paraText(m[0]).replace(/\u00a0/g, ' ').trim());
    }
    if (!lines.length) throw new Error('未能从 DOCX 中提取到正文');
    return lines.join('\n\n');
  }

  /* ---------- TXT 编码识别 ---------- */
  function decodeText(buffer) {
    const u8 = new Uint8Array(buffer);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8);
    } catch (e) { /* 继续 */ }
    // BOM 检查
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
      try { return new TextDecoder('utf-16le').decode(u8); } catch (e2) { /* 继续 */ }
    }
    for (const enc of ['gbk', 'big5', 'shift_jis', 'euc-kr']) {
      try { return new TextDecoder(enc, { fatal: true }).decode(u8); } catch (e) { /* 尝试下一个 */ }
    }
    return new TextDecoder('utf-8').decode(u8);
  }

  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    return decodeText(buf);
  }

  async function readAny(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.docx')) return { text: await readDocxText(file), type: 'docx' };
    if (name.endsWith('.doc')) throw new Error('暂不支持旧版 .doc，请在 Word 中另存为 .docx 或 .txt');
    return { text: await readTextFile(file), type: 'txt' };
  }

  return { readAny, readDocxText, readTextFile, decodeText, unzipEntry };
})();
