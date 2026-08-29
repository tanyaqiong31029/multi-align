/* MultiAlign 私有使用统计端点 —— Cloudflare Worker + KV
 *
 * 只接收匿名聚合事件计数（cid 是访客浏览器内的随机 UUID），
 * 不存在、也永远不会接收任何用户文本内容。
 *
 * 路由：
 *   POST /collect            事件上报（204，无响应体）
 *   GET  /stats?key=ADMIN_KEY   站长专属统计（JSON），密钥错误返回 403
 *
 * 部署步骤见同目录 README.md。
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method === 'POST' && url.pathname === '/collect') return collect(request, env);
    if (request.method === 'GET' && url.pathname === '/stats') return stats(url, env);
    return new Response('Not Found', { status: 404 });
  },
};

function today() { return new Date().toISOString().slice(0, 10); }

async function dayData(env, date) {
  const raw = await env.STATS.get('d:' + date);
  return raw ? JSON.parse(raw) : { views: 0, uv: [], ev: {}, langs: {}, durS: 0, durN: 0 };
}

async function collect(request, env) {
  try {
    const d = await request.json();
    if (!d || typeof d.cid !== 'string' || typeof d.t !== 'string' || d.t.length > 16 ||
        JSON.stringify(d).length > 600) {
      return new Response(null, { status: 204, headers: CORS }); // 静默丢弃异常负载
    }
    const day = await dayData(env, today());
    if (d.t === 'visit') {
      day.views++;
      if (day.uv.indexOf(d.cid) < 0 && day.uv.length < 3000) day.uv.push(d.cid);
      const lang = String(d.lang || '').slice(0, 8);
      if (lang) day.langs[lang] = (day.langs[lang] || 0) + 1;
    } else if (d.t === 'leave') {
      day.durS += Math.max(0, Math.min(86400, d.dur | 0));
      day.durN++;
    } else {
      day.ev[d.t] = (day.ev[d.t] || 0) + 1;
    }
    await env.STATS.put('d:' + today(), JSON.stringify(day));
  } catch (e) { /* 统计端不因异常负载报错 */ }
  return new Response(null, { status: 204, headers: CORS });
}

async function stats(url, env) {
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
  const days = Math.min(365, parseInt(url.searchParams.get('days') || '90', 10) || 90);
  const list = await env.STATS.list({ prefix: 'd:' });
  const out = [];
  const uvAll = new Set(), evAll = {}, langAll = {};
  let views = 0, durS = 0, durN = 0;
  for (const k of list.keys) {
    const raw = await env.STATS.get(k.name);
    if (!raw) continue;
    const d = JSON.parse(raw);
    out.push({
      date: k.name.slice(2),
      views: d.views, uv: d.uv.length, ev: d.ev, langs: d.langs,
      avgDur: d.durN ? Math.round(d.durS / d.durN) : 0,
      _uvList: d.uv,
    });
    views += d.views;
    d.uv.forEach(u => uvAll.add(u));
    for (const t in d.ev) evAll[t] = (evAll[t] || 0) + d.ev[t];
    for (const l in d.langs) langAll[l] = (langAll[l] || 0) + d.langs[l];
    durS += d.durS; durN += d.durN;
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  const seen = {};
  for (const x of out) for (const u of x._uvList) seen[u] = (seen[u] || 0) + 1;
  let repeat = 0;
  for (const u in seen) if (seen[u] > 1) repeat++;
  const perDay = out.slice(0, days).map(x => {
    const c = { ...x }; delete c._uvList; return c;
  });
  return new Response(JSON.stringify({
    totals: {
      views,
      uv: uvAll.size,
      repeat,
      repeatRate: uvAll.size ? +(repeat / uvAll.size * 100).toFixed(1) : 0,
      avgDur: durN ? Math.round(durS / durN) : 0,
      events: evAll,
      langs: langAll,
    },
    days: perDay,
  }), { headers: { 'Content-Type': 'application/json', ...CORS } });
}
