/* v8.29：简洁模式误伤修复 + 项目时段单轨 + 今日脉搏 / 洞察折叠 / AI 枢纽
   运行：node scripts/checks/verify-v829.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const featCss = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const uiJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/gf-ui.js'), 'utf8');
const modelJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/gf-model.js'), 'utf8');
const agents = fs.readFileSync(path.join(L.ROOT, 'AGENTS.md'), 'utf8');
const core = fs.readFileSync(path.join(L.ROOT, '.cursor/rules/00-project-core.mdc'), 'utf8');

console.log('== v8.29 核查 ==');

// 简洁模式：不整藏 heroWrap / 不藏 inboxCapture
L.assertNotContains('简洁模式不藏 inboxCapture', 'body.simple-mode #inboxCapture', featCss);
L.assertNotContains('简洁模式不整藏 heroWrap', 'body.simple-mode #heroWrap,', featCss);
L.assertNotContains('简洁模式不整藏 heroWrap 单行', 'body.simple-mode #heroWrap {', featCss);
L.assertContains('空 hero 才藏（保留进行中番茄）', 'body.simple-mode #heroWrap:not(:has(.pomo-bar.show))', featCss);
L.assertContains('仍藏次级 zone', 'body.simple-mode #zoneStatus', featCss);

// 项目设置：去掉小时双轨
L.assertFnNotContains('项目设置无工作日小时输入', 'openWorkflowMetaModal', 'wfmWorkdayHours');
L.assertFnNotContains('项目设置无周末小时输入', 'openWorkflowMetaModal', 'wfmWeekendHours');
L.assertFnContains('项目预算由 wins 派生', 'openWorkflowMetaModal', 'winsTotalHours(wins)');
L.assertFnContains('模板不再填小时字段', 'openWorkflowMetaModal', "setForce('#wfmShare'");

// 工程文档：六处 ?v= + 五 script
(/六处/.test(agents) && /gf-model/.test(agents) ? L.ok : L.bad)('AGENTS.md 六处 ?v= + 拆分脚本');
(/六处/.test(core) && /gf-model/.test(core) ? L.ok : L.bad)('00-project-core 六处 ?v= + 拆分脚本');

// —— 今日脉搏 / 洞察折叠 / AI 枢纽（用户三问）——
L.assertContains('今日脉搏 DOM', 'id="todayPulse"', html);
L.assertContains('renderTodayPulse 定义', 'function renderTodayPulse', uiJs);
L.assertContains('脉搏含进度/下一项', 'pulse-next', uiJs);
L.assertContains('简洁模式仍显脉搏', 'body.simple-mode #todayPulse', featCss);
L.assertContains('renderTodayPanel 调脉搏', 'renderTodayPulse()', uiJs);

L.assertContains('四象限 details', '<details class="panel quad-panel" id="quadPanel"', html);
L.assertContains('历史 details', '<details class="panel history-panel" id="historyPanel"', html);
L.assertContains('洞察折叠 summary 类', 'ins-fold-sum', html);
L.assertContains('四象限默认折叠绑定', "zoneOpenPref('quadPanel', false)", modelJs);
L.assertContains('历史默认折叠绑定', "zoneOpenPref('historyPanel', false)", modelJs);

L.assertContains('AI 枢纽面板', 'id="panelAIHub"', html);
L.assertContains('AI 使用条', 'id="aiUsageStrip"', html);
L.assertContains('AI 新建项目 CTA', 'id="aiOpenNewProject"', html);
L.assertContains('AI SMART 建议位', 'id="aiSmartSuggest"', html);
L.assertContains('AI 上下文位', 'id="aiContextInfo"', html);
L.assertContains('renderAIView 填 usage strip', 'aiUsageStrip', uiJs);
L.assertContains('AI CTA 打开新建项目', "openWorkflowMetaModal('create')", uiJs);

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 6 ? L.ok : L.bad)('index.html ≥6 处 ?v=（当前 ' + curV + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v829') ? 1 : 0);
