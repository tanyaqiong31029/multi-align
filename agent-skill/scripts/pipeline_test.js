#!/usr/bin/env node
'use strict';
/* MultiAlign 无头回归测试
 * 用法：node pipeline_test.js [工具目录]
 * 覆盖：多语分句（缩写/小数/引号/省略号）、6 版本对齐合并、TMX/XLSX/CSV 导出、
 *       ZIP 与 XML 完整性（借 Python zipfile/minidom）、DOCX 导入与编码识别。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const JS = f => path.join(TOOL_DIR, 'js', f);
let passed = 0, failed = 0, skipped = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}
function skip(name) { skipped++; console.log('  - 跳过 ' + name + '（环境缺少依赖）'); }
function pythonHas(mod) {
  try { execFileSync('python3', ['-c', 'import ' + mod], { stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

global.window = global;
[ 'util.js','segmenter.js','aligner.js','merge.js','docximport.js','exporters.js','sample.js' ]
  .forEach(f => require(JS(f)));
const U = PA.util, Seg = PA.Seg, Aligner = PA.Aligner, Merge = PA.Merge, Exp = PA.Export;

console.log('== 1. 分句 ==');
const zhS = Seg.segmentPlain('他说："今天天气很好。"然后我们去了公园。全书共3.14万册，例如e.g.这样的缩写不切分。Mr. Smith回来了！真的吗？', 'zh-CN', {});
ok(zhS.length === 5, `中文 5 句（引号内句号不切、小数/缩写保留）→ 实际 ${zhS.length}`);
ok(zhS[0] === '他说："今天天气很好。"', '闭引号归前句：' + zhS[0]);
const enS = Seg.segmentPlain('Dr. Smith arrived at 3.30 p.m. on Jan. 5th. He said "This is great!" Then he left. Nobody knows... The end.', 'en', {});
ok(enS.length === 5, `英文 5 句（Dr./p.m./Jan. 不切，...后切）→ 实际 ${enS.length}`);
const jaS = Seg.segmentPlain('これはペンです。そうですね！「行きましょう。」と彼は言った。', 'ja', {});
ok(jaS.length === 4, `日文 4 句（「」内句号不切）→ 实际 ${jaS.length}`);
ok(Seg.segmentPlain('第一段。\n\n第二段开始。', 'zh-CN', {}).length === 2, '空行分段');
ok(Seg.detectLang('これはペンです。') === 'ja' && Seg.detectLang('Hello world.') === 'en', '语言检测 ja/en');

console.log('== 2. 六版本对齐 ==');
const versions = PA.SAMPLE.versions.map(v => ({ id: v.name, name: v.name, lang: v.lang, text: v.text }));
ok(versions.length === 6, '示例含 6 个版本');
const settings = { usePara: true, splitSemi: false, lexWeight: 40, numWeight: 60, variance: 0 };
const segs = {};
for (const v of versions) segs[v.id] = Seg.segmentRich(v.text, v.lang, settings);
const prep = id => segs[id].map(s => ({ text: s.text, para: s.para, len: U.weightedLen(s.text), nums: Seg.extractNums(s.text), tokens: Seg.simTokens(s.text) }));
const pivot = versions[0], pS = prep(pivot.id), gP = Seg.langGroup(pivot.lang);
const pairResults = versions.slice(1).map(v => {
  const g = Seg.langGroup(v.lang);
  return { vid: v.id, beads: Aligner.alignTexts(pS, prep(v.id), { usePara: settings.usePara, variance: Seg.autoVariance(gP, g), lexWeight: Seg.lexCompatible(gP, g) ? settings.lexWeight : 0, numWeight: settings.numWeight, sameScript: Seg.lexCompatible(gP, g) }) };
});
const enBeads = pairResults.find(p => p.vid === 'English').beads;
ok(enBeads.filter(b => b.type === '1-1').length === 13, '英文对 13 个 1-1');
ok(enBeads.filter(b => b.type === '1-2').length === 1, '英文对 1 个 1-2（长句拆分演示）');
pairResults.filter(p => p.vid !== 'English').forEach(p =>
  ok(p.beads.every(b => b.type === '1-1'), `${p.vid} 全部 1-1`));
const tus = Merge.buildTUs(versions, pivot.id, segs, pairResults);
ok(tus.length === 14, `合并为 14 个翻译单元 → 实际 ${tus.length}`);
ok(tus.every(t => versions.every(v => (t.cells[v.id] || '').trim().length > 0)), '所有 TU 六语俱全');
ok(tus[8].cells['English'].includes('split or merged'), '1-2 句对拼入同一单元格');

console.log('== 3. 对齐退化场景（无段落锚定） ==');
const zhT = Seg.segmentRich('今天天气很好。\n我们一起去公园散步吧。\n公园里有很多漂亮的花。\n小明买了一个冰淇淋。\n他觉得很开心。', 'zh-CN', {});
const enT = Seg.segmentRich('The weather is nice today.\nWe went for a walk in the park together, and there are many beautiful flowers in it.\nHe was very happy about it.', 'en', {});
const tBeads = Aligner.alignTexts(
  zhT.map(s => ({ text: s.text, para: s.para, len: U.weightedLen(s.text), nums: Seg.extractNums(s.text), tokens: Seg.simTokens(s.text) })),
  enT.map(s => ({ text: s.text, para: s.para, len: U.weightedLen(s.text), nums: Seg.extractNums(s.text), tokens: Seg.simTokens(s.text) })),
  { usePara: true, variance: 9, lexWeight: 0, numWeight: 60, sameScript: false });
ok(tBeads.some(b => b.type === '2-1'), '出现 2-1 合并对');
ok(tBeads.reduce((s, b) => s + b.a.length, 0) === zhT.length && tBeads.reduce((s, b) => s + b.b.length, 0) === enT.length, '所有句子均被覆盖（无丢失）');

console.log('== 4. 导出器 ==');
const rows = tus.map((tu, idx) => ({ idx, tu }));
const tmx = Exp.buildTMX(versions, rows, { srclang: 'zh-CN', includeConf: true, filename: 'demo' });
ok((tmx.match(/<tu /g) || []).length === 14 && (tmx.match(/<tuv /g) || []).length === 84, 'TMX 14 tu / 84 tuv');
const tmpZip = path.join(require('os').tmpdir(), 'ma_test_pair.zip');
const tmpX = path.join(require('os').tmpdir(), 'ma_test.xlsx');
(async () => {
  fs.writeFileSync(tmpX, Buffer.from(await Exp.buildXLSX(versions, rows, { includeConf: true }).arrayBuffer()));
  fs.writeFileSync(tmpZip, Buffer.from(await Exp.buildPairwiseZip(versions, pivot.id, rows, { includeConf: true, filename: 'demo' }).arrayBuffer()));
  const py = `import zipfile,sys,xml.dom.minidom as md
for f in sys.argv[1:]:
    z=zipfile.ZipFile(f); assert z.testzip() is None, 'CRC fail '+f
    for n in z.namelist():
        if n.endswith(('.xml','.rels')): md.parseString(z.read(n))
print('ZIP/XML OK', len(sys.argv)-1, 'files')`;
  try {
    execFileSync('python3', ['-c', py, tmpX, tmpZip], { stdio: 'pipe' });
    ok(true, 'XLSX 与两两 TMX ZIP：CRC 与全部 XML 部件校验通过');
  } catch (e) { ok(false, 'ZIP/XML 校验失败: ' + e.message); }
  if (pythonHas('openpyxl')) {
    try {
      execFileSync('python3', ['-c', 'import openpyxl,sys; wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.active; assert ws.max_row==15 and ws.max_column==8, (ws.max_row,ws.max_column)', tmpX], { stdio: 'pipe' });
      ok(true, 'openpyxl 可打开（15 行 8 列）');
    } catch (e) { ok(false, 'openpyxl 校验失败: ' + e.message.split('\n')[0]); }
  } else skip('openpyxl 打开校验');
  const csv = Exp.buildDelimited(versions, rows, { sep: ',', includeConf: true });
  ok(csv.split('\r\n').length === 15, `CSV 15 行 → 实际 ${csv.split('\r\n').length}`);
  ok(csv.includes('"'), 'CSV 含引号转义字段（含逗号的句子被引号包裹）');
  ok(Exp.buildTXT(versions, rows).split('\n').length === 14, 'TXT 14 行');

  console.log('== 5. DOCX 导入 ==');
  const docxTmp = path.join(require('os').tmpdir(), 'ma_test.docx');
  if (pythonHas('docx')) {
    try {
      execFileSync('python3', ['-c', `from docx import Document
d=Document(); d.add_paragraph('这是第一段第一句。这是第一段第二句。'); d.add_paragraph('This is paragraph two. It has two sentences!'); d.save('${docxTmp.replace(/'/g, "\\'")}'); print('ok')`], { stdio: 'pipe' });
      const buf = fs.readFileSync(docxTmp);
      const text = await PA.Import.readDocxText(new File([buf], 't.docx'));
      ok(text.split('\n\n').length === 2 && text.includes('这是第一段第一句'), 'DOCX 两段提取（空行分隔）');
    } catch (e) { ok(false, 'DOCX 测试失败: ' + e.message.split('\n')[0]); }
  } else skip('DOCX 两段提取（需 python-docx）');
  const gbk = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);
  ok(PA.Import.decodeText(gbk.buffer.slice(gbk.byteOffset, gbk.byteOffset + gbk.byteLength)) === '中文', 'GBK 编码识别');

  console.log(`\n结果：${passed} 通过 / ${failed} 失败` + (skipped ? ` / ${skipped} 跳过` : ''));
  process.exit(failed ? 1 : 0);
})();
