'use strict';
/* 匿名使用统计（默认关闭，端点未配置时整个模块静默）
 * 设计原则：
 *  1. 只上报聚合事件计数（visit / align / export / srt_import / leave），
 *     永远不会发送任何用户文本内容；
 *  2. 不使用 Cookie；客户端标识是仅本站可读的本地随机 UUID；
 *  3. 访问者不可见：无 UI、无弹窗、无 console 输出；
 *  4. 私有自建端点（见 analytics/ 目录），数据存站长自己的存储，用管理密钥保护。
 * 启用方法：部署 analytics/ 下的 Worker 后，把 ENDPOINT 填为
 *   https://你的worker域名/collect
 */
PA.Analytics = (function () {

  var ENDPOINT = ''; // 例：'https://multi-align-stats.xxx.workers.dev/collect'

  var KEY_CID = 'ma_cid', KEY_SID = 'ma_sid', KEY_T0 = 'ma_t0';

  function ls(fn, key, val) {
    try { return fn(key, val); } catch (e) { return null; }
  }
  function cid() {
    var v = ls(localStorage.getItem.bind(localStorage), KEY_CID);
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      ls(localStorage.setItem.bind(localStorage), KEY_CID, v);
    }
    return v;
  }
  function sid() {
    var v = ls(sessionStorage.getItem.bind(sessionStorage), KEY_SID);
    if (!v) {
      v = Date.now().toString(36);
      ls(sessionStorage.setItem.bind(sessionStorage), KEY_SID, v);
      ls(sessionStorage.setItem.bind(sessionStorage), KEY_T0, String(Date.now()));
    }
    return v;
  }
  function sessionStart() {
    var v = ls(sessionStorage.getItem.bind(sessionStorage), KEY_T0);
    return v ? +v : Date.now();
  }

  function post(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      } else {
        fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(function () {});
      }
    } catch (e) { /* 静默：统计永不影响功能 */ }
  }

  function send(type, data) {
    if (!ENDPOINT) return;
    var p = { cid: cid(), sid: sid(), t: String(type).slice(0, 16), ts: Date.now() };
    if (data) for (var k in data) if (p[k] === undefined) p[k] = data[k];
    post(p);
  }

  function init() {
    if (!ENDPOINT) return;
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    send('visit', {
      lang: (navigator.language || '').slice(0, 8),
      ref: ref,
      vw: window.innerWidth
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        send('leave', { dur: Math.max(0, Math.round((Date.now() - sessionStart()) / 1000)) });
      }
    });
  }

  return { send: send, init: init, enabled: function () { return !!ENDPOINT; } };
})();
