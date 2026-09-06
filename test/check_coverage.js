#!/usr/bin/env node
'use strict';
/* 核心模块覆盖率门槛检查（配合 c8 的 json-summary 报告）
 * 用法：npx c8 --reporter=json-summary --include "js/…" <测试命令> && node test/check_coverage.js
 * 阈值标定于 2026-09（回归 43 断言 + 基准 16 用例合并运行），低于阈值即失败。
 * 注意：app.js / sample.js / analytics.js 不在门槛内（前者为 UI 层，由 E2E 覆盖）。
 */
const fs = require('fs');

const THRESHOLDS = {
  // 行覆盖最低百分比（实测：aligner 96.0 / exporters 100 / merge 85.8 / segmenter 96.2 / srt 100）
  'aligner.js': 90,
  'exporters.js': 95,
  'merge.js': 80,
  'segmenter.js': 90,
  'srt.js': 95,
};

const summaryFile = 'coverage/coverage-summary.json';
if (!fs.existsSync(summaryFile)) {
  console.error('未找到 coverage/coverage-summary.json —— 请先用 c8 生成：');
  console.error('  npx c8 --reporter=json-summary \\');
  console.error('    --include "js/aligner.js" --include "js/segmenter.js" --include "js/exporters.js" \\');
  console.error('    --include "js/srt.js" --include "js/merge.js" \\');
  console.error('    bash -c "node agent-skill/scripts/pipeline_test.js && node benchmark/run_benchmark.js --min-f1 0"');
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));

let failed = 0;
console.log('\n== 覆盖率门槛（行覆盖）==');
for (const [file, min] of Object.entries(THRESHOLDS)) {
  const entry = Object.entries(summary).find(([k]) => k.endsWith('/' + file));
  if (!entry) {
    console.error(`  ✗ ${file} 未出现在覆盖率报告中（是否被测试加载？）`);
    failed++;
    continue;
  }
  const pct = entry[1].lines.pct;
  if (pct >= min) {
    console.log(`  ✓ ${file.padEnd(16)} ${pct.toFixed(1)}% ≥ ${min}%`);
  } else {
    console.error(`  ✗ ${file.padEnd(16)} ${pct.toFixed(1)}% < ${min}% —— 新增分支缺少回归保护，请补断言或用例`);
    failed++;
  }
}

if (failed) {
  console.error(`\n覆盖率门槛：${failed} 个模块未达标`);
  process.exit(1);
}
console.log('覆盖率门槛：全部达标\n');
