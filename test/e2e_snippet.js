/* 导出编排 E2E 页面侧脚本（由 test/run_e2e.sh 注入 index.html 副本后无头执行）
 * 流程：进工作台 → 新建两版 → 粘贴中英 SRT（走真实字幕导入路径）→ 对齐 →
 *       第四步 → 打桩 download → 依次真实点击 TMX / SRT / SRT ZIP → 结果写入 #e2e-result
 * 覆盖回归点：srtGroups 作用域缺陷（曾致 SRT 导出 ReferenceError）、
 *             btnSearchRun 缺失（曾致 bindExport/bindGlobal 从未运行）。
 */
(function () {
  window.__downloads = [];
  window.__errors = [];
  window.addEventListener('error', function (e) {
    window.__errors.push(String(e.message || e) + ' @' + (e.filename || '?').split('/').pop() + ':' + e.lineno + ':' + e.colno);
  });
  function result(o) {
    var d = document.createElement('div');
    d.id = 'e2e-result';
    d.setAttribute('data-result', JSON.stringify(o));
    document.body.appendChild(d);
  }
  function paste(ta, text) {
    var ev = new Event('paste', { bubbles: true, cancelable: true });
    ev.clipboardData = { getData: function () { return text; } };
    ta.dispatchEvent(ev);
  }
  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        PA.util.download = function (name, blob) {
          window.__downloads.push({ name: String(name), size: blob && blob.size || 0 });
        };
        var zhSrt = '1\n00:00:01,000 --> 00:00:03,500\n会议定在周一上午九点。\n\n2\n00:00:03,600 --> 00:00:05,500\n请所有人准时参加。\n\n3\n00:00:05,600 --> 00:00:07,500\n会议室在三楼东侧。';
        var enSrt = zhSrt
          .replace('会议定在周一上午九点。', 'The meeting is set for Monday morning.')
          .replace('请所有人准时参加。', 'Everyone please be on time.')
          .replace('会议室在三楼东侧。', 'The meeting room is on the third floor, east side.');

        document.querySelector('[data-goto="work"]').click();
        setTimeout(function () {
          document.getElementById('addVersionBtn').click();
          setTimeout(function () {
            document.getElementById('addVersionBtn').click();
            setTimeout(function () {
              var cards = document.querySelectorAll('.vcard');
              paste(cards[0].querySelector('.vtext'), zhSrt);
              paste(cards[1].querySelector('.vtext'), enSrt);
              setTimeout(function () {
                document.getElementById('toStep2Btn').click();
                setTimeout(function () {
                  document.getElementById('runAlignBtn').click();
                  setTimeout(function () {
                    document.getElementById('toStep4Btn').click();
                    setTimeout(function () {
                      document.querySelector('[data-export="tmx"]').click();
                      document.querySelector('[data-export="srt"]').click();
                      document.querySelector('[data-export="srtzip"]').click();
                      setTimeout(function () {
                        var names = window.__downloads.map(function (d) { return d.name; });
                        result({
                          count: window.__downloads.length,
                          tmx: names.some(function (n) { return /\.tmx$/.test(n); }) ? 'ok' : 'missing',
                          srt: names.some(function (n) { return /_多语字幕\.srt$/.test(n); }) ? 'ok' : 'missing',
                          srtzip: names.some(function (n) { return /_字幕SRT\.zip$/.test(n); }) ? 'ok' : 'missing',
                          rows: document.querySelectorAll('#eTbody tr.trow').length,
                          errors: window.__errors,
                          errToasts: document.querySelectorAll('.toast-err').length
                        });
                      }, 600);
                    }, 1600);
                  }, 300);
                }, 300);
              }, 300);
            }, 150);
          }, 150);
        }, 250);
      } catch (e) {
        result({ fatal: String(e && e.message || e), errors: window.__errors });
      }
    }, 400);
  });
})();
