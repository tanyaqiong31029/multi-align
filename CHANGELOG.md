# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循语义化版本。

## [1.1.0] - 2026-08

### 新增
- SRT/VTT 字幕对齐：时间轴锚点 + 多语字幕导出
- 可选私有使用统计（匿名聚合计数，默认关闭，负载不含文本）
- 金标准对齐基准 + GitHub Actions CI
- E2E 测试（端口动态分配、trap 统一清理）与 UI 编排层测试

### 修复
- SRT 导出 ReferenceError
- 外部审查意见整改（安全边界说明、Issue 模板脱敏要求）

## [1.0.0] - 2026-08

### 新增
- 多语平行语料句对齐工作台首发：5–10 语种自动句对齐 + 审校 + TMX/Excel 导出
- 纯前端实现（index.html 单页，无外部依赖），GitHub Pages 可直接托管
