---
name: multi-align-skill
description: 多语平行语料对齐工具（MultiAlign）的构建、测试、维护与扩展规范。只要用户提到平行语料/句句对齐/句对齐/语料库构建/TMX 导出/多语对照表/multi-align，或要求修改、扩展、修复、重建一个多版本（5-10 语种）自动句对齐工具——即使没说"MultiAlign"这个名字——都应使用本技能。包含算法规格、架构约定、无头回归测试与浏览器截图验证流程。
---

# Multi-Align-Skill：多语平行语料对齐工具规范

本技能封装一套**已验证可工作**的纯前端多语平行语料对齐工具（MultiAlign）的完整知识：算法、架构、测试方法。用于继续开发、修复、扩展，或在别处重建同类工具。

## 工具实例位置

本工具实例就是本仓库根目录（`index.html` + `js/` + `css/`，零依赖、双击即用）。

若路径不存在或用户指向别处，先确认目标目录里有 `index.html` 且其脚本使用 `window.PA` 命名空间；都没有则按 references/architecture.md 从零重建。

## 立即执行：回归测试

动手改代码**之前和之后**都先跑无头回归（不需要浏览器，约 1 秒）：

```bash
node agent-skill/scripts/pipeline_test.js <工具目录>
# 省略参数时默认测试本仓库根目录
```

全绿（分句 17 项断言、6 版本对齐 14 TU、导出器 ZIP/XML 校验）才继续。测试失败的排查顺序见下文"已知陷阱"。

## 架构速览

流水线：**文本 → 分句 → 两两对齐（各版本 × 基准语）→ 并查集合并 → 翻译单元（TU）表 → 审校 → 导出**。

```
js/util.js        字符类别 / 加权长度（汉字≈2.3 西文字符）/ 下载 / 杂项
js/segmenter.js   多语分句（缩写库、小数、引号闭合）、语言检测、数字与词汇特征
js/aligner.js     Gale-Church 动态规划对齐（1-1/1-2/2-1/2-2/1-0/0-1）+ 段落锚定 + 滑窗分块
js/merge.js       基准语枢纽 + 并查集连通分量 → 多语 TU
js/docximport.js  迷你 ZIP 读取器 + DOCX 正文提取 + TXT 编码识别（UTF-8/GBK/Big5）
js/exporters.js   TMX / 两两 TMX ZIP / XLSX（内置 ZIP 写入器）/ CSV / TSV / TXT / JSON
js/sample.js      内置 6 语示例（自创文本，英文含 1-2 对齐演示）
js/app.js         UI 状态机：四步流程（导入→对齐→审校→导出）、编辑器、搜索替换、撤销、自动保存
```

UI 是参考 tmxmall 的四步式流程，工作台视图路由用 hash（`#/home` `#/work` `#/docs` `#/about`）。TU 数据结构：

```js
{ cells: { versionId: '文本' }, conf: 0.95, locked: false, modified: false }
```

工程 JSON（`Ctrl+S` 导出 / localStorage 键 `multialign_autosave_v1`）：`{ app:'multialign', versions:[{id,name,lang,text}], pivotId, settings, tus }`。加载时必须校验 `data.app === 'multialign'`。

## 常见任务与做法

**加一种语言**：只在 `js/segmenter.js` 的 `LANGS` 加条目（code/name/group）。`group` 决定三件事——长度方差（同组 6.8 / 跨组 9.0，见 `autoVariance`）、词汇相似度是否启用（`lexCompatible`，仅同组或中↔日）、合并句子的连接符（CJK 无空格）。`util.js` 的 `charClass`/`weightedLen` 若遇新文字（如天城文、希腊文）需同步加权重。

**调对齐质量**：三个旋钮在 app.js `state.settings`——`numWeight`（数字锚点，跨语种最可靠）、`lexWeight`（同文种词汇）、`variance`（0=自动）。整句不匹配率过高先确认两版本段落数是否一致（段落锚定 `usePara` 要求段数完全相等才生效）。长度比例异常（如中↔英）是预期行为，靠加权长度吸收，不要去改方差公式。

**加导出格式**：在 `js/exporters.js` 加 builder（返回 string 或 Blob），在 `js/app.js` `doExport()` 加分支，在 index.html 导出卡片加按钮（`data-export="xxx"`）。ZIP 类产物必须复用 `Exp.makeZip`。

**改 UI**：改 index.html 结构后，核对 app.js `init()` 的 `E('id')` 清单——所有 `el.xxx` 都必须在页面里存在，否则 `bind` 阶段直接抛错、整页瘫痪（无框架无守卫，这是最大的单点故障）。

## 测试方法

**无头（改动必跑）**：`scripts/pipeline_test.js`，直接 require 各 js（它们挂在 `window.PA` 上，脚本里 `global.window = global` 即可）。断言基准：6 语示例 → 14 TU、全 1-1、英文对允许 1 个 1-2；XLSX 用 Python `zipfile`+`minidom` 校验所有 XML 部件。

**浏览器视觉（改 UI 必做）**：本地起 `python3 -m http.server 8765`，用无头 Chrome 截图（IAB 截图在本环境不稳定，优先此法）：

```bash
# 复制 index.html 并在 app.js 的 <script> 后追加自动执行脚本，再截图后删除
sed 's|<script src="js/app.js"></script>|<script src="js/app.js"></script><script>window.addEventListener("load",function(){setTimeout(function(){document.querySelector("[data-goto=work]").click();setTimeout(function(){document.getElementById("btnSample").click();setTimeout(function(){document.getElementById("toStep2Btn").click();setTimeout(function(){document.getElementById("runAlignBtn").click();},1800);},300);},400);},400);});</script>|' index.html > _demo.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot=/tmp/editor.png --window-size=1440,900 --virtual-time-budget=9000 --hide-scrollbars "http://localhost:8765/_demo.html"
```

用 Read 工具查看 `/tmp/editor.png`，确认四步状态、表格列、置信度圆点，然后**删除 `_demo.html`**。

**浏览器 DOM 断言（ Playwright evaluate 可用时）**：关键断言点——`.stepper li.step-on` 的 id、`#eTbody tr.trow` 行数、`#editorInfo` 文本、`#alignLog .log-line` 条数。

## 已知陷阱（每条都真实踩过）

1. **`segmenter.js` 的 `ENDERS` 必须含 ASCII 句点 `.`**——漏掉会导致英文完全不切分（中文仍正常，极易漏测）。回归测试覆盖此项。
2. **XLSX 属性引号**：`<c r="A2 t="...">` 这种漏引号会让 Excel/openpyxl 报 invalid token，但 `unzip -t` 仍通过——XML 校验必须用 minidom/openpyxl，不能只测 ZIP 完整性。
3. **Node 环境 vs 浏览器 API**：`DOMParser`、`Blob.arrayBuffer`（写入 fs 时需先转 Buffer）、`DecompressionStream` 都不能在无头测试里直接用；docximport 的 DOCX 解析故意用正则而非 DOMParser 就是为了双端可跑。不要"顺手"改回 DOM API。
4. **`require` 相对路径**：无头脚本放 /tmp 时 require 必须用绝对路径（CJS 以脚本文件位置解析）。
5. **`aligner.js` DP 表**：`(n+1)*(m+1)` 超 260 万元素自动切滑窗模式；滑窗的 `bConsumed` 去重逻辑依赖 bead 有序，改对齐类型集合时要重验长文本路径。
6. **IAB（内置浏览器）截图**可能报 `guest not attached` / `screenshot surface timed out`，标签页也可能变 about:blank——重试前先 `tabs.list()` 重新拿 id；截图验证一律优先无头 Chrome 方案。

## 详细参考

- 模块级 API、数据结构、算法参数与公式：读 `references/architecture.md`
