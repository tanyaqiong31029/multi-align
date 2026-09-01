#!/usr/bin/env node
'use strict';
/* MultiAlign 金标准对齐基准
 * 用法：node benchmark/run_benchmark.js [--min-f1 0.95] [--json] [--verbose] [工具目录]
 *
 * 流程：每个用例由人工标注的句子序列 + 金标准句对珠（bead）构成；
 *  1. 按段落/句子重建文本（CJK 无空格、其他补空格，段落间空行）；
 *  2. 用生产分句器重新分句，断言与标注句序列一致（不一致记 segmentation 失败）；
 *  3. 用生产对齐器（与 app.js 相同的参数策略）对齐，得到预测珠；
 *  4. 与金标准珠集合对比，按用例与总体计算 Precision / Recall / F1。
 * --min-f1 低于阈值时以退出码 1 结束（供 CI 使用）。
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function argVal(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? parseFloat(args[i + 1]) : dflt;
}
const MIN_F1 = args.includes('--min-f1') ? argVal('--min-f1', 0.95) : null;
const AS_JSON = args.includes('--json');
const VERBOSE = args.includes('--verbose');
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-f1') { i++; continue; }
  if (args[i].startsWith('--')) continue;
  positional.push(args[i]);
}
const TOOL_DIR = path.resolve(positional[0] || path.join(__dirname, '..'));
const JS = f => path.join(TOOL_DIR, 'js', f);

global.window = global;
['util.js', 'segmenter.js', 'aligner.js', 'merge.js', 'docximport.js', 'exporters.js', 'sample.js']
  .forEach(f => require(JS(f)));
const U = PA.util, Seg = PA.Seg, Aligner = PA.Aligner;

/* 与 app.js 相同的对齐参数策略（基准在此定义上调用生产逻辑） */
function alignOptions(c) {
  const gS = Seg.langGroup(c.source.lang), gT = Seg.langGroup(c.target.lang);
  return {
    usePara: true,
    variance: Seg.autoVariance(gS, gT),
    lexWeight: Seg.lexCompatible(gS, gT) ? 40 : 0,
    numWeight: 60,
    srtWeight: (c.srt && c.source.timing && c.target.timing) ? 80 : 0,
    sameScript: Seg.lexCompatible(gS, gT)
  };
}

/* 由标注句序列重建文本（模拟用户输入形态） */
function buildText(sentences, lang, paraGroups, linesMode) {
  if (linesMode) return sentences.join('\n'); // 每句一行：标题/有序列表的真实粘贴形态
  const sep = Seg.isCJKText(sentences.join('')) ? '' : ' ';
  if (!paraGroups) return sentences.join(sep);
  return paraGroups.map(idx => idx.map(i => sentences[i]).join(sep)).join('\n\n');
}

function beadKey(a, b) { return a.slice().sort((x, y) => x - y).join('+') + '>' + b.slice().sort((x, y) => x - y).join('+'); }

const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'gold', 'alignment_gold.json'), 'utf8'));
const results = [];
let sumP = 0, sumR = 0, nScored = 0;

for (const c of gold.cases) {
  const r = { id: c.id, note: c.note || '' };
  let segS, segT;
  if (c.srt) {
    // 字幕用例：台词即句子并携带时间轴，不经分句器
    segS = c.source.sentences.map((t, i) => ({ text: t, para: 0, t0: c.source.timing[i][0], t1: c.source.timing[i][1] }));
    segT = c.target.sentences.map((t, i) => ({ text: t, para: 0, t0: c.target.timing[i][0], t1: c.target.timing[i][1] }));
  } else {
    const textS = buildText(c.source.sentences, c.source.lang, c.paraGroups, c.lines);
    const textT = buildText(c.target.sentences, c.target.lang, c.paraGroups, c.lines);
    segS = Seg.segmentRich(textS, c.source.lang, { usePara: true });
    segT = Seg.segmentRich(textT, c.target.lang, { usePara: true });
  }

  if (segS.length !== c.source.sentences.length || segT.length !== c.target.sentences.length) {
    r.status = 'segmentation-fail';
    r.detail = `分句数不符：源 ${segS.length}/${c.source.sentences.length}，目标 ${segT.length}/${c.target.sentences.length}`;
    if (VERBOSE) {
      r.detail += '\n  源分句: ' + JSON.stringify(segS.map(s => s.text), null, 0);
      r.detail += '\n  目标分句: ' + JSON.stringify(segT.map(s => s.text), null, 0);
    }
    results.push(r);
    continue;
  }

  const prep = segs => segs.map(s => ({
    text: s.text, para: s.para,
    len: U.weightedLen(s.text), nums: Seg.extractNums(s.text), tokens: Seg.simTokens(s.text),
    t0: s.t0, t1: s.t1
  }));
  const beads = Aligner.alignTexts(prep(segS), prep(segT), alignOptions(c));

  const predicted = new Set(beads.map(b => beadKey(b.a, b.b)));
  const goldSet = new Set(c.gold.map(g => beadKey(g[0].map(Number), g[1].map(Number))));
  let correct = 0;
  for (const k of predicted) if (goldSet.has(k)) correct++;
  const P = predicted.size ? correct / predicted.size : 0;
  const R = goldSet.size ? correct / goldSet.size : 0;
  const F1 = P + R ? 2 * P * R / (P + R) : 0;
  const missed = [...goldSet].filter(k => !predicted.has(k));
  const spurious = [...predicted].filter(k => !goldSet.has(k));

  Object.assign(r, {
    status: 'ok', srcSents: segS.length, tgtSents: segT.length,
    predicted: predicted.size, gold: goldSet.size, correct,
    precision: P, recall: R, f1: F1
  });
  if (missed.length) r.missed = missed;
  if (spurious.length) r.spurious = spurious;
  // xfail：已知局限用例。当前做不到（F1<1）= 符合预期；意外通过 = XPASS，提示移除标注
  if (c.xfail) {
    r.xfail = true;
    r.xpass = F1 >= 0.999;
  } else {
    sumP += P; sumR += R; nScored++;
  }
  results.push(r);
}

const overall = nScored ? { precision: sumP / nScored, recall: sumR / nScored, f1: 0 } : null;
/* 宏平均 F1 以各用例 F1 为主 */
let sumF1 = 0; for (const r of results) if (r.status === 'ok' && !r.xfail) sumF1 += r.f1;
if (overall) overall.f1 = sumF1 / nScored;
const segFails = results.filter(r => r.status !== 'ok').length;

if (AS_JSON) {
  console.log(JSON.stringify({ overall, cases: results }, null, 2));
} else {
  console.log(`\n══ MultiAlign 金标准对齐基准（${gold.cases.length} 个用例）══\n`);
  for (const r of results) {
    if (r.status !== 'ok') {
      console.log(`✗ ${r.id.padEnd(22)} [分句失败] ${r.detail}`);
    } else if (r.xfail && !r.xpass) {
      console.log(`⊘ ${r.id.padEnd(22)} [xfail 预期内] F1=${(r.f1 * 100).toFixed(1)}% — ${r.note || ''}`);
    } else if (r.xfail && r.xpass) {
      console.log(`⚡ ${r.id.padEnd(22)} [XPASS！已能解决，请移除 xfail 标注] F1=100.0%`);
    } else {
      const flag = r.f1 >= 0.999 ? '✓' : (r.f1 >= 0.9 ? '~' : '✗');
      console.log(`${flag} ${r.id.padEnd(22)} P=${(r.precision * 100).toFixed(1)}%  R=${(r.recall * 100).toFixed(1)}%  F1=${(r.f1 * 100).toFixed(1)}%  (${r.correct}/${r.predicted} 预测命中 ${r.gold} 金标)`);
      if (VERBOSE) {
        if (r.missed) console.log('    漏检:', r.missed.join('  '));
        if (r.spurious) console.log('    多检:', r.spurious.join('  '));
      }
    }
  }
  const xfailN = results.filter(r => r.xfail && !r.xpass).length;
  const xpassN = results.filter(r => r.xpass).length;
  console.log(`\n总体（宏平均，不含 xfail）：P=${(overall.precision * 100).toFixed(1)}%  R=${(overall.recall * 100).toFixed(1)}%  F1=${(overall.f1 * 100).toFixed(1)}%  |  分句失败 ${segFails} 例  xfail 预期内 ${xfailN} 例` + (xpassN ? `  XPASS ${xpassN} 例 ⚡` : ''));
  if (MIN_F1 !== null) console.log(`阈值：F1 ≥ ${(MIN_F1 * 100).toFixed(1)}% → ${overall.f1 >= MIN_F1 && segFails === 0 ? '通过' : '未通过'}`);
  console.log('');
}

process.exit(segFails > 0 || (MIN_F1 !== null && overall.f1 < MIN_F1) ? 1 : 0);
