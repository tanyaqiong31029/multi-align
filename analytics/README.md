# MultiAlign 私有使用统计（可选功能）

为 MultiAlign 提供站长专属的匿名使用统计：访问人数（UV/PV）、复访率、平均停留时长、对齐/导出/字幕导入等事件计数。**只统计事件计数，不收集任何文本内容，不使用 Cookie，数据存在你自己的 Cloudflare KV 里，查看需要管理密钥。**

默认状态：**关闭**。`js/analytics.js` 的 `ENDPOINT` 为空时，页面不会发出任何统计请求（保持"零网络请求"行为）。完成下面的部署并把地址填入后才启用。

## 部署（一次性，约 10 分钟，免费额度足够）

前提：一个 Cloudflare 账号（免费）。

```bash
# 1. 安装并登录 Wrangler（Cloudflare 官方 CLI）
npm install -g wrangler
wrangler login

# 2. 创建 KV 存储桶，把输出的 id 填入本目录 wrangler.toml 的 REPLACE_WITH_YOUR_KV_NAMESPACE_ID
wrangler kv namespace create STATS

# 3. 设置管理密钥（自己生成一个长随机串，例如：openssl rand -hex 24）
wrangler secret put ADMIN_KEY

# 4. 部署
wrangler deploy
```

部署成功后会得到地址：`https://multi-align-stats.<你的子域>.workers.dev`

## 启用页面统计

编辑 `js/analytics.js`，把第一行配置改为：

```js
var ENDPOINT = 'https://multi-align-stats.<你的子域>.workers.dev/collect';
```

提交并推送（GitHub Pages 会自动更新）。此后页面开始匿名上报。

## 查看数据（仅你可见）

两种方式，均需管理密钥：

1. **仪表盘（推荐）**：本地打开本目录的 `dashboard.html`，填入 Worker 地址和管理密钥。密钥只保存在你自己浏览器的 localStorage，不会发送给第三方。
2. **原始 JSON**：

```bash
curl "https://multi-align-stats.<你的子域>.workers.dev/stats?key=你的管理密钥"
```

## 统计了什么（完整清单）

| 事件 | 字段 | 说明 |
|---|---|---|
| visit | lang（浏览器语言）、ref（来源域名）、vw（视口宽） | 每次打开页面 |
| leave | dur（停留秒数） | 标签页切后台时上报一次 |
| align | versions（版本数）、srt（是否含字幕时间轴） | 每次自动对齐成功 |
| export | fmt（导出格式） | 每次导出成功 |
| srt_import | — | 每次导入字幕文件 |

客户端标识 `cid` 是访客浏览器 localStorage 里的随机 UUID（仅本站可读，不跨站追踪）。**用户粘贴/导入的任何文本内容永远不会被发送。**

## 数据保留与清理

按天存为 KV 键 `d:YYYY-MM-DD`。想清空历史：`wrangler kv key delete "d:2026-01-01" --namespace-id=<id>`，或直接删除整个 namespace 重建。
