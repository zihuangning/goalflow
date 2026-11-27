/* v8.26：rowChrome 行壳 + 洞察空态 + 今日区默认折叠 + 版本号
   运行：node scripts/checks/verify-v826.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');

console.log('== v8.26 核查 ==');

L.assertContains('rowChrome 定义', 'function rowChrome', L.APP_JS);
L.assertContains('todayRowHtml 走 rowChrome', 'return rowChrome({', L.grabFn('todayRowHtml') || '');
L.assertFnContains('收件箱行走 rowChrome', 'renderInboxPanel', 'rowChrome({');
L.assertFnContains('四象限空态 emptyStateHtml', 'renderQuadrant', 'emptyStateHtml({');
L.assertFnContains('桑基空态 showCanvasEmpty', 'render', 'showCanvasEmpty()');
L.assertFnContains('洞察画布空态', 'renderCanvas', 'emptyStateHtml(emptyOpts)');

L.assertFnContains('zoneStatus 默认折叠', 'updateTodayZones', "zoneOpenPref('zoneStatus', false)");
L.assertFnContains('zoneAttention 默认折叠', 'updateTodayZones', "zoneOpenPref('zoneAttention', false)");
L.assertContains('zone 记忆键', "goalflow.zone.", L.APP_JS);

L.assertContains('gf-row CSS', '.gf-row {', fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8'));
L.assertContains('gf-row-check', '.gf-row-check', fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8'));

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
(parseFloat(curV) >= 8.26 ? L.ok : L.bad)('index.html 版本 ≥8.26（当前 ' + curV + '）', '实际 ' + curV);
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 6 ? L.ok : L.bad)('index.html ≥6 处 ?v=（当前 ' + curV + '）', '实际 ' + vCount);

L.assertContains('导出 rowChrome', 'rowChrome,', fs.readFileSync(path.join(L.ROOT, 'assets/js/app.js'), 'utf8'));

const app = require('../tests/lib.cjs').requireApp();
(typeof app.rowChrome === 'function' ? L.ok : L.bad)('requireApp 导出 rowChrome');
const row = app.rowChrome({ cls: 'today-row', title: '测', metaHtml: '<span>m</span>', checkAttrs: ' data-x="1"' });
(/class="gf-row today-row"/.test(row) && /gf-row-meta/.test(row) && /gf-row-check/.test(row) ? L.ok : L.bad)('rowChrome 结构', row.slice(0, 120));

process.exit(L.summary('verify-v826') ? 1 : 0);