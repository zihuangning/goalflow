/* v8.22 公共 UI 壳：弹窗 / 折叠 / 空态抽出
   （v8.21 已被并行会话占用：设置扩充+去 todayBrief+全局多段空闲）
   ① modalHeadHtml / modalFootHtml / buildModalHtml / openModalMask
   ② foldSectionHtml / emptyStateHtml
   ③ confirmModal / showAIResultModal / showAIErrorModal / openArchiveCelebrate / openCommitCard 接入
   ④ 空态与今日已完成折叠改走 helper；导出供 unit
   运行：node scripts/checks/verify-v822.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');

console.log('== v8.22 核查 ==');

// ① 公共壳存在
L.assertContains('modalHeadHtml', 'function modalHeadHtml', L.APP_JS);
L.assertContains('modalFootHtml', 'function modalFootHtml', L.APP_JS);
L.assertContains('buildModalHtml', 'function buildModalHtml', L.APP_JS);
L.assertContains('openModalMask', 'function openModalMask', L.APP_JS);
L.assertContains('foldSectionHtml', 'function foldSectionHtml', L.APP_JS);
L.assertContains('emptyStateHtml', 'function emptyStateHtml', L.APP_JS);
L.assertContains('v8.21/22 注释', '公共 UI 壳', L.APP_JS);

// ② 高频弹窗接入
L.assertFnContains('confirm 走 buildModalHtml', 'confirmModal', 'buildModalHtml');
L.assertFnContains('confirm 走 openModalMask', 'confirmModal', 'openModalMask');
L.assertFnContains('AI 结果走 buildModalHtml', 'showAIResultModal', 'buildModalHtml');
L.assertFnContains('AI 结果走 openModalMask', 'showAIResultModal', 'openModalMask');
L.assertFnContains('AI 失败走 buildModalHtml', 'showAIErrorModal', 'buildModalHtml');
L.assertFnContains('AI 失败走 openModalMask', 'showAIErrorModal', 'openModalMask');
L.assertFnContains('归档庆祝走 buildModalHtml', 'openArchiveCelebrate', 'buildModalHtml');
L.assertFnContains('归档庆祝走 openModalMask', 'openArchiveCelebrate', 'openModalMask');
L.assertFnContains('承诺卡走 buildModalHtml', 'openCommitCard', 'buildModalHtml');
L.assertFnContains('承诺卡走 openModalMask', 'openCommitCard', 'openModalMask');

// ③ 空态 / 折叠接入
L.assertContains('空态 helper 调用', 'emptyStateHtml({', L.APP_JS);
L.assertContains('折叠 helper 调用', 'foldSectionHtml({', L.APP_JS);
L.assertFnContains('今日无流走 emptyStateHtml', 'renderTodayPanel', 'emptyStateHtml');
L.assertFnContains('已完成走 foldSectionHtml', 'renderTodayPanel', 'foldSectionHtml');

// ④ 导出
L.assertContains('导出 buildModalHtml', 'buildModalHtml,', L.APP_JS);
L.assertContains('导出 emptyStateHtml', 'emptyStateHtml,', L.APP_JS);
L.assertContains('导出 confirmModal', 'confirmModal,', L.APP_JS);

// ⑤ 行为冒烟：helper 真 require
const app = require('../tests/lib.cjs').requireApp();
const head = app.modalHeadHtml({ icon: '⚠️', title: '确认', closeId: 'tClose' });
(/mh-tt/.test(head) && /id="tClose"/.test(head) && /aria-label="关闭"/.test(head) ? L.ok : L.bad)('modalHeadHtml 含标题与关闭钮', head.slice(0, 120));
const modal = app.buildModalHtml({
  icon: '✅', title: '完成', sub: '副标题', closeId: 'x1',
  body: '<p>body</p>',
  buttons: [{ id: 'ok', label: '确定', primary: true }]
});
(/class="modal"/.test(modal) && /id="ok"/.test(modal) && /wfm-body/.test(modal) ? L.ok : L.bad)('buildModalHtml 结构完整', modal.slice(0, 160));
const fold = app.foldSectionHtml({ fold: 'done', title: '已完成', body: 'rows', open: false, cls: 'today-done-fold' });
(/data-fold="done"/.test(fold) && /today-done-fold/.test(fold) && !/\sopen/.test(fold) ? L.ok : L.bad)('foldSectionHtml 默认收起', fold.slice(0, 120));
const empty = app.emptyStateHtml({ icon: '🎯', title: '空', hint: '去规划', btnLabel: '去', btnOnclick: "switchView('plan')" });
(/empty-hint/.test(empty) && /switchView\('plan'\)/.test(empty) ? L.ok : L.bad)('emptyStateHtml 含按钮 onclick', empty.slice(0, 160));

// 滚动版本（不硬编码版号，避免升版必红）
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v822') ? 1 : 0);
