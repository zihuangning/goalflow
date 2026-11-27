/* v8.14 今日页三连修 —— 常驻字符串核查。
   起因（v8.13 英雄卡移除后的用户反馈）：
   ① 「今日行动顶部残留奇怪的指标」= metricsStrip（叶子%/本周完成/指标N▾）孤悬首屏
      → 迁入「📊 今日状态」zoneStatus 折叠区（与容量/评分/精力/审计同区）；heroWrap 只剩 pomoBar，空闲零高度
   ② 「看不到第二项的分数」= ② 行只有徽章没有分数（MIT 有得分折叠对比下更显缺失）
      → todayRowHtml nextTop 时 meta 直接显示「② N分」（title 带分解）；已完成区补「完成时刻+单项得分」
      （scoreOfDoneEntry 纯函数：scoreLog 倒序找该节点最新 done 记录）
   ③ 「今日执行旁边的问号无法点击」= help-icon 只有 hover title（移动端无 hover）
      → span 改 button#todayExecHelp，点击 toggle .today-exec-help 排序规则说明行
   运行：node scripts/checks/verify-v814.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/layout.css'), 'utf8');

console.log('== v8.14 核查 ==');

// ① metricsStrip 迁入 zoneStatus（indexOf 位置断言：必须在 zoneStatus 之后、heroWrap 不再包含它）
const iHero = html.indexOf('id="heroWrap"');
const iZone = html.indexOf('id="zoneStatus"');
const iMs = html.indexOf('id="metricsStrip"');
(iHero >= 0 && iZone > iHero && iMs > iZone ? L.ok : L.bad)('metricsStrip 已迁入 zoneStatus（heroWrap 之后）', `heroWrap@${iHero} zoneStatus@${iZone} metricsStrip@${iMs}`);
L.assertContains('heroWrap 只剩番茄进度条', '<div class="pomo-bar" id="pomoBar" aria-live="polite"></div>\n          </div>', html);
L.assertContains('hero-wrap 空闲零高度（:has 渐进增强）', '.hero-wrap:has(.pomo-bar.show)', layoutCss);

// ② ② 行分数 + 已完成区时刻/得分
L.assertFnContains('② 行显示算法分', 'todayRowHtml', 'next-top-score');
L.assertFnContains('② 分数来自 focusScoreParts', 'todayRowHtml', 'focusScoreParts(n)');
L.assertFnContains('② 分数 title 带分解（v8.15 改名优先级分）', 'todayRowHtml', '② 优先级分：算法排序用');
L.assertFnContains('已完成区查单项得分', 'renderTodayPanel', 'scoreOfDoneEntry(en, scoreLogToday)');
L.assertFnContains('已完成行完成时刻', 'renderTodayPanel', 'done-hm');
L.assertFnContains('已完成行单项得分', 'renderTodayPanel', 'done-score');
L.assertFnContains('scoreOfDoneEntry 只认 done 记录', 'scoreOfDoneEntry', "e.kind === 'done'");
L.assertFnContains('scoreOfDoneEntry 按 nodeId 匹配', 'scoreOfDoneEntry', 'e.nodeId === entry.nodeId');
L.assertFnContains('scoreOfDoneEntry 倒序取最新', 'scoreOfDoneEntry', 'i--');
L.assertFnContains('scoreOfDoneEntry 脏数据安全', 'scoreOfDoneEntry', 'return null');

// ③ ❓ 可点击
L.assertContains('❓ 改为按钮', '<button type="button" class="help-icon" id="todayExecHelp"');
L.assertFnContains('❓ 绑定在 renderTodayPanel', 'renderTodayPanel', "querySelector('#todayExecHelp')");
L.assertFnContains('❓ 点击插入说明行', 'renderTodayPanel', 'today-exec-help');
// v8.23: 帮助文案扩展置顶/跨日，锁关键片段
L.assertFnContains('❓ 说明含排序规则', 'renderTodayPanel', '排序规则：');
L.assertFnContains('❓ 说明含计划时间', 'renderTodayPanel', '计划时间');
L.assertFnContains('❓ 再点收起', 'renderTodayPanel', 'old.remove()');

// ④ 样式 + 导出 + 版本
L.assertContains('② 分数样式', '.next-top-score {', css);
L.assertContains('完成时刻样式', '.done-hm {', css);
L.assertContains('单项得分样式', '.done-score {', css);
L.assertContains('帮助按钮样式', '.help-icon {', css);
L.assertContains('说明行样式', '.today-exec-help {', css);
L.assertContains('导出 scoreOfDoneEntry', 'scoreOfDoneEntry,');
// 滚动版本守卫：跟随 index.html 当前版本（升版不再改这里——verify-v810/v813 同模式）
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v814') ? 1 : 0);
