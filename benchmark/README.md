# 金标准对齐基准（Gold Alignment Benchmark）

衡量「分句 → 句对齐」核心流水线的正确性，作为回归防线与质量名片。与 `agent-skill/scripts/pipeline_test.js`（工程断言）互补：回归测试保证**不坏**，基准回答**多好**。

## 运行

```bash
node benchmark/run_benchmark.js                # 打开报告
node benchmark/run_benchmark.js --min-f1 0.97  # 低于阈值退出码 1（CI 用）
node benchmark/run_benchmark.js --verbose      # 显示漏检/多检珠
node benchmark/run_benchmark.js --json         # 机器可读输出
```

## 数据集

`gold/alignment_gold.json`，当前 6 个用例、5 组语言对、69 句：

| 用例 | 语言 | 考察点 |
|---|---|---|
| zh-en-basic | 中↔英 | 基础 1-1；中英长度比例失衡下的鲁棒性 |
| zh-en-merge | 中↔英 | 2-1 合并（英文把中文两句译成一句） |
| en-fr-split | 英↔法 | 1-2 拆分（法文把英文一句译成两句） |
| en-de-numbers | 英↔德 | 数字锚点：全部句子含数字/年份，含德语小数逗号 `1,2` ↔ 英语 `1.2` |
| zh-ja-kanji | 中↔日 | 共享汉字词汇相似度通道 |
| en-es-paragraphs | 英↔西 | 段落锚定（三段，段数一致） |

**标注格式**：`sentences` 为人工切定的句子序列（脚本会拼回文本、用生产分句器重切并断言一致——分句器改坏会在这里直接暴露）；`gold` 为珠（bead）标注 `[[[源下标...],[目标下标...]], ...]`；`paraGroups` 可选，声明分段以触发段落锚定。

**指标**：珠级 Precision / Recall / F1（预测珠与金标珠的集合匹配），总体取用例宏平均。新增用例请保持每类句对变换至少一例覆盖。

## 当前结果

6/6 用例 F1 = 100%（宏平均 100.0%）。CI 阈值设为 **F1 ≥ 97%**：任何使对齐质量产生实质性退化的改动都会被拒绝合并。

## 已知局限（路线图）

- **孤立的句中漏译/增译（1-0/0-1）不可靠**：纯长度统计模型下，删除珠的长度失配代价过高、且错配路径（2-1 + 位移）几乎总是更便宜——这是 Gale-Church 类算法的**原理性边界**，不是实现缺陷。经典解法是补充词汇/同源词锚点（hunalign、Champollion 路线）或句向量（LaBSE/Vecalign 路线）；两者均在路线图中，前者还受跨文种（如中↔英）无共享词汇的制约。
- 现有珠型罚分沿用 Gale-Church (1993) Table 5 标定，未针对多语（>2 版本）场景重标定。

修改 `js/aligner.js` 的代价函数或罚分表时，务必同时跑本基准与回归测试，并检查每个用例的逐珠差异（`--verbose`）。
