/* v8.13 英雄卡去重 —— 常驻字符串核查。
   起因：英雄卡「★ 当下最重要」与今日行动 MIT pin 展示同一节点，执行栈 #2/#3 又与清单重复，用户反馈「两边重复怪怪的」。
   ① renderHero 整函数移除；index.html 移除 #hero（heroWrap 保留 pomoBar/metricsStrip）
   ② topId 裁定归一 syncTop（VIEW_GROUP.today 首位，替代原 renderHero 的副作用）
   ③ 番茄启动器承接：MIT pin 头部 #pomoLen 时长下拉（25/50/90）+ 行内 🍅 读下拉值（不再写死 25）
   ④ 📌 取消固定承接：topPin 命中时 MIT pin 头部出 btnUnpinTop（原英雄卡唯一取消入口）
   ⑤ 📊 得分分解承接：MIT pin 下 mit-score-fold 折叠（prog/mp/pace/sprint pills + 正负分明细）
   ⑥ 清单「② 次重要」：pickNextTopId 纯函数（排除 MIT/done/溢出，并列取先）+ todayRowHtml opts.nextTop 徽章高亮
   运行：node scripts/checks/verify-v813.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.13 核查 ==');

// ① 英雄卡移除
L.assertNotContains('renderHero 函数已移除', 'function renderHero()');
L.assertNotContains('英雄卡番茄按钮已移除', 'btnPomo25');
L.assertNotContains('英雄卡编辑表单已移除', 'heroEditForm');
L.assertNotContains('英雄卡执行栈已移除', 'hero-stack');
L.assertNotContains('index.html 无 #hero 元素', 'id="hero"', html);
L.assertContains('heroWrap 保留（pomoBar/metricsStrip 容器）', 'id="heroWrap"', html);
L.assertContains('番茄进度条保留', 'id="pomoBar"', html);
L.assertContains('度量条保留', 'id="metricsStrip"', html);
L.assertFnNotContains('startPomo 不再回渲英雄卡', 'startPomo', 'renderHero');
L.assertFnNotContains('finishPomo 不再回渲英雄卡', 'finishPomo', 'renderHero');

// ② topId 裁定归一
L.assertContains('VIEW_GROUP today 以 syncTop 开头', 'today: () => [syncTop, renderFocus');
L.assertFnContains('syncTop 仍用全局候选', 'syncTop', 'heroGlobalCandidates()');

// ③ 番茄启动器承接
L.assertContains('MIT 区时长下拉', 'id="pomoLen"');
L.assertContains('90′ 深潜选项保留', '<option value="90">🌊 90′</option>');
L.assertFnContains('行内 🍅 读下拉时长', 'bindTodayPanel', "getElementById('pomoLen')");
L.assertFnNotContains('行内 🍅 不再写死 25', 'bindTodayPanel', 'startPomo(25)');
L.assertContains('🍅 按钮提示时长来源', '时长取 MIT 区下拉');

// ④ 取消固定承接
L.assertContains('MIT 区取消固定按钮', 'id="btnUnpinTop"');
L.assertFnContains('btnUnpinTop 绑定在 renderTodayPanel', 'renderTodayPanel', '已取消固定，交回算法排序');

// ⑤ 得分分解承接
L.assertContains('MIT 得分折叠', 'mit-score-fold');
L.assertFnContains('得分分解复用 focusScoreParts', 'renderTodayPanel', 'focusScoreParts(mitN)');
L.assertFnContains('冲刺 pill 迁移', 'renderTodayPanel', 'pill-sprint');
L.assertFnContains('节奏 pill 迁移', 'renderTodayPanel', 'paceStatus(mitN)');

// ⑥ ② 次重要高亮
L.assertFnContains('pickNextTopId 排除溢出', 'pickNextTopId', 'n._overflow');
L.assertFnContains('pickNextTopId 排除 MIT 自身', 'pickNextTopId', 'excludeId');
L.assertFnContains('pickNextTopId 按算法分取最高', 'pickNextTopId', 'focusScore(n)');
L.assertFnContains('todayRowHtml 支持 nextTop 选项', 'todayRowHtml', "opts.nextTop ? ' next-top' : ''");
L.assertFnContains('todayRowHtml ② 徽章', 'todayRowHtml', 'next-top-badge');
L.assertFnContains('renderTodayPanel 计算 nextTopId', 'renderTodayPanel', 'pickNextTopId(inPool, mitId)');
L.assertFnContains('renderTodayPanel 行传 nextTop', 'renderTodayPanel', '{ nextTop: true }');

// ⑦ 样式 + 导出 + 版本
L.assertContains('next-top 行样式', '.today-row.next-top {', css);
L.assertContains('② 徽章样式', '.next-top-badge {', css);
L.assertContains('MIT 头行样式', '.mit-pin-head {', css);
L.assertContains('得分折叠样式', '.mit-score-fold {', css);
L.assertContains('时长下拉样式', '.mit-pomo-len {', css);
L.assertContains('取消固定样式', '.mit-unpin {', css);
L.assertContains('导出 pickNextTopId', 'pickNextTopId,');
// 滚动版本守卫：跟随 index.html 当前版本（v8.14 升版教训：写死 8.13 必红——与 verify-v810 同模式）
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount === 4 ? L.ok : L.bad)('index.html 4 处版本号（当前滚动版 ' + curV + '）', '实际 ' + vCount + ' 处');

process.exit(L.summary('verify-v813') ? 1 : 0);
