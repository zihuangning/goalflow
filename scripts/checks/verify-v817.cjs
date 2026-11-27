/* v8.17 指标迁出今日 + 番茄中文 + 移动端溢出整顿 —— 常驻字符串核查。
   起因（用户四点）：
   ① 「8 个指标不是今日完成的，为什么显示在这里」→ metricsStrip 旧过滤把文案「(1/2)」当指标，
      塞进今日状态；与「今日完成」无关 → 今日只留「本周完成」执行动量，KR 整块迁出
   ② 「指标对应的项目早删除了」→ ① 的误收 + planShare/capacity 孤儿键未清
      → projectKrNodes 纯筛选（仅 role===KR）+ 项目总览承接；reconcileRefsAfterRestore
        清已删项目 planShare/capacity；启动 load 后即 reconcile
   ③ 「点开番茄后图标要有中文」→ 🍅→「🍅 专注」、⏸/▶/⏹ 带中文、进度标「进度 N%」、
      时长下拉「25′ 标准/50′ 长专注/90′ 深潜」、行内 ⋯/微动作/预案/等待/阻塞/标签/删除 全带中文
   ④ 「移动版图标超出边框」→ mobile.css §46：main/zone/today-row/pomo/fitem/acts 全面
      max-width:100% + min-width:0 + flex-wrap；番茄条任务名截断
   运行：node scripts/checks/verify-v817.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');

console.log('== v8.17 核查 ==');

// ①② 指标迁出今日 + 真 KR 筛选
L.assertFnContains('projectKrNodes 仅 role===KR', 'projectKrNodes', "n.role === 'KR'");
L.assertFnContains('projectKrNodes 排除已完成', 'projectKrNodes', '!n.done');
L.assertFnContains('今日 metrics 只留本周完成', 'renderMetricsStrip', '本周完成');
L.assertFnNotContains('今日不再有指标折叠', 'renderMetricsStrip', 'ms-kr-fold');
L.assertFnNotContains('今日不再扫 targetNum 当指标', 'renderMetricsStrip', 'n.targetNum > 0');
L.assertFnContains('项目总览承接 KR', 'openProjectOverview', 'projectKrNodes(nodes)');
L.assertFnContains('总览 KR 区标题', 'openProjectOverview', '关键结果 KR');
L.assertFnContains('总览说明非今日', 'openProjectOverview', '非今日完成');
L.assertFnContains('总览信心打卡仍可点', 'openProjectOverview', 'data-confkr');

// ② 孤儿清理
L.assertFnContains('reconcile 清 planShare 孤儿', 'reconcileRefsAfterRestore', 'planShare');
L.assertFnContains('reconcile 建 aliveWf 集', 'reconcileRefsAfterRestore', 'aliveWf');
L.assertContains('启动即 reconcile', 'reconcileRefsAfterRestore();');

// ③ 番茄/动作中文
L.assertFnContains('行内番茄带「专注」', 'todayRowHtml', '🍅 专注');
L.assertFnContains('更多按钮带中文', 'todayRowHtml', '⋯ 更多');
L.assertFnContains('微动作带中文', 'todayRowHtml', '🫳 微动作');
L.assertFnContains('预案带中文', 'todayRowHtml', '🛡 预案');
L.assertFnContains('等待带中文', 'todayRowHtml', '⏳ 等待');
L.assertFnContains('阻塞带中文', 'todayRowHtml', '🚫 阻塞');
L.assertFnContains('标签带中文', 'todayRowHtml', '🏷 标签');
L.assertFnContains('删除带中文', 'todayRowHtml', '🗑 删除');
L.assertFnContains('番茄条进度中文', 'renderPomoBar', '进度 ${pct}%');
L.assertFnContains('番茄条结束带⏹', 'renderPomoBar', '⏹ 结束');
L.assertFnContains('时长下拉标准', 'renderTodayPanel', '🍅 25′ 标准');
L.assertFnContains('时长下拉长专注', 'renderTodayPanel', '🍅 50′ 长专注');
L.assertFnContains('时长下拉深潜', 'renderTodayPanel', '🌊 90′ 深潜');

// ④ 移动端溢出
L.assertContains('mobile §46 溢出整顿', 'v8.17 移动端溢出整顿', mobile);
L.assertContains('main/zone 防横向溢出', 'overflow-x: hidden', mobile);
L.assertContains('番茄条任务名 100% 折行', '.pomo-task { flex: 1 1 100%; max-width: 100%; }', mobile);
L.assertContains('今日行 min-width:0', '.today-row { max-width: 100%; min-width: 0; }', mobile);
L.assertContains('动作按钮可折行', '.today-acts {\n    max-width: 100%;\n    flex-wrap: wrap;', mobile);
L.assertContains('桌面 pomo-task 截断', '.pomo-task { flex: 1 1 120px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }', css);
L.assertContains('项目总览 KR 行样式', '.po-kr {', css);

// 导出 + 版本
L.assertContains('导出 projectKrNodes', 'projectKrNodes,');
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v817') ? 1 : 0);
