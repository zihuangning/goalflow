/* v8.15 今日页数字口径澄清 + 需要关注计数修正 —— 常驻字符串核查。
   起因（用户三连问）：
   ① 「数字关系是否正确合理」→ 盘点发现三种「分」同名异义：
      优先级分（focusScore，算法排序：决定先做谁）/ 今日表现分（todayScore，完成累计，日目标 100）/ 单项完成加分（scoreDoneItem）
      关系本身正确（表现分 = Σ 完成加分 + 番茄分），但都叫「分」无法分辨
      → 改名：MIT「📊 得分 N」→「📊 优先级 N · 为什么排最前」；②「N分」→「② 优先 N」；
        「今日总评分」→「今日表现分」（ts-label + 晚安总结 + statusSum 摘要），关键处 title 写明口径互指
   ② 「需要隐藏/专家级/加问号」→ 分层已在 v8.13/8.14 完成（metricsStrip/KR/审计等在 zoneStatus 折叠区），
      本轮补 title 说明链：statusSum / ts-label / MIT fold summary / attn chips / 需要关注角标全部可悬停看口径
   ③ 「需要关注点掉后还有数字但看不到」→ 实锤 bug：
      badge 旧算法数「非空子区块」而非条目——收件箱 pend=0 但 someday 有货时 inboxPanel 仍渲染
      「已清空」占位（innerHTML 非空）→ 角标 +1 但展开找不到内容；
      且 onboard 欢迎卡/备份提示等混入计数 → 「关注的东西不对」
      → 新算法：停滞 + 暂停 + 待澄清（条目数）+ 备份/倦怠/周回顾（提示各计 1），onboard 不计；
        badge title 写明构成；全清空时 zone-body 给明确空态
   运行：node scripts/checks/verify-v815.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.15 核查 ==');

// ③-1 需要关注角标：数实际条目而非非空区块
// （v8.16 重定向：停滞改经 attentionStaleOverdue 逾期优先去重后计数）
L.assertFnContains('角标数停滞条目（v8.16 起经去重组合）', 'updateTodayZones', 'attentionStaleOverdue()');
L.assertFnContains('角标数暂停条目', 'updateTodayZones', 'parkedEntries().length');
L.assertFnContains('角标数待澄清条目', 'updateTodayZones', 'inboxPending().length');
L.assertFnContains('提示类只留备份/倦怠（周回顾单独算）', 'updateTodayZones', "['todayBackupBar', 'todayBurnout']");
L.assertNotContains('角标不再把 onboard 欢迎卡计入', "'onboardCard', 'todayBackupBar'");
L.assertFnContains('角标 title 写明构成（v8.16 起含🚨逾期）', 'updateTodayZones', '需要关注 ${n} 项 = 🚨逾期');

// ③-2 全清空空态（不再是一片空白）
L.assertFnContains('全清空插入空态节点', 'updateTodayZones', 'attentionEmpty');
L.assertFnContains('空态文案', 'updateTodayZones', '✨ 没有需要关注的事');
L.assertContains('空态样式', '.attention-empty {', css);
L.assertContains('角标悬停提示手势', '.zone-badge[title]', css);

// ① 三种「分」改名 + 口径互指
L.assertFnContains('MIT 折叠改「优先级」', 'renderTodayPanel', '📊 优先级 ${mitFs.total} · 为什么排最前');
L.assertNotContains('MIT 折叠不再叫「得分」', '📊 得分 ${mitFs.total}');
L.assertFnContains('MIT 折叠 summary 带口径 title', 'renderTodayPanel', '优先级分：算法排序用，决定「先做谁」');
L.assertFnContains('② 行改「优先 N」', 'todayRowHtml', '② 优先 ${fsp.total}');
L.assertFnContains('② 行 title 写明非完成评价', 'todayRowHtml', '不是完成评价');
L.assertFnContains('ts-label 改「今日表现分」', 'renderTodayScore', '今日表现分');
L.assertFnContains('ts-label title 与优先级分互指', 'renderTodayScore', '是两回事');
L.assertNotContains('ts-label 不再叫「今日总评分」', '<span class="ts-label">今日总评分</span>');
L.assertContains('晚安总结同步改「今日表现分」', '>今日表现分</span><b>${ts.total}</b>');
L.assertFnContains('statusSum 摘要改「表现分」', 'updateTodayZones', '${ts.total} 表现分');
L.assertFnContains('statusSum title 说口径', 'updateTodayZones', 'sum.title');

// ② 悬停说明链：attn chips 口径 + 「等」
L.assertFnContains('催办 chip title 说口径', 'renderTodayAttnPill', '到期的跟进：暂停事项里设了跟进时间且到点了');
L.assertFnContains('停滞 chip title 说口径', 'renderTodayAttnPill', '停滞：重要但 ${STALE_DAYS} 天没碰过的叶子');
L.assertFnContains('chip 超 3 条补「等」', 'renderTodayAttnPill', "due.length > 3 ? ' 等' : ''");

// ② index.html 需要关注 summary 带构成说明
L.assertContains('需要关注 summary 带 title', '角标 = 实际事项数（悬停看构成）', html);

// 版本滚动守卫：跟随 index.html 当前版本（升版不再改这里）
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount === 4 ? L.ok : L.bad)('index.html 4 处版本号（当前滚动版 ' + curV + '）', '实际 ' + vCount + ' 处');

process.exit(L.summary('verify-v815') ? 1 : 0);
