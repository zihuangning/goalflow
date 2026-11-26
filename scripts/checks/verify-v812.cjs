/* v8.12 仪式历史 —— 常驻字符串核查。
   周计划 / 晚回顾 / 晨计划 / 周期回顾四处仪式记录统一可查（「📜 历史」弹窗四 tab）：
   ① meta.morningPlans 新存储（ensureScoreMeta 兜底）
   ② 晨计划打开即快照留痕（闹钟弹出/手动打开都算），同日重开只刷新
   ③ 评分聚合抽 summarizeScoreEntries/scoreForDk（todayScore 委托，历史按任意 dk 复用同口径）
   ④ 聚合纯函数 historyMorningDays/historyEveningDays/historyWeekPlans/historyReviews + dkWeekLabel
   ⑤ openHistory/closeHistory 弹窗（四 tab 复用 .wr-ctab；大石头履约实时查 nodeInWorkflow）
   ⑥ 入口：侧栏 sideHistory + 闹钟条仪式菜单 btnHistory + #historyModal 容器
   ⑦ 样式 .his-* + module.exports 导出（unit-history 真 require）
   注：v8.11 是并行会话的「排期纠偏 + 容量口径」（verify-v811.cjs），本特性顺延 v8.12。
   运行：node scripts/checks/verify-v812.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.12 核查 ==');

// ① 存储兜底
L.assertFnContains('ensureScoreMeta 兜底 morningPlans', 'ensureScoreMeta', 'state.meta.morningPlans = {};');

// ② 晨计划快照
L.assertFnContains('晨计划打开即快照', 'openRitualModal', 'state.meta.morningPlans[dk] = {');
L.assertFnContains('快照含 MIT 与预选标记', 'openRitualModal', 'pre: !!preMit');
L.assertFnContains('快照含清单/容量/待确认', 'openRitualModal', 'poolN: pool.length, est: d.est, cap: d.cap, pendN: pendings.length');
L.assertFnContains('快照注释说明语义', 'openRitualModal', '仪式历史');

// ③ 评分聚合抽取（同口径复用）
L.assertFnContains('summarizeScoreEntries 纯函数聚合', 'summarizeScoreEntries', 'grade: scoreGrade(total)');
L.assertFnContains('scoreForDk 按 dk 读 scoreLog', 'scoreForDk', 'state.meta.scoreLog[dk]');
L.assertFnContains('todayScore 委托 scoreForDk', 'todayScore', 'return scoreForDk(dateKey());');
L.assertFnNotContains('todayScore 不再自带聚合', 'todayScore', 'reduce(');

// ④ 聚合纯函数
L.assertFnContains('historyMorningDays 倒序', 'historyMorningDays', '.sort().reverse()');
L.assertFnContains('historyEveningDays 并集三日志', 'historyEveningDays', '[meta.scoreLog, meta.dayNotes, meta.goodThings]');
L.assertFnContains('historyEveningDays 回收 eveningDispo 日期前缀', 'historyEveningDays', "split('|')[0]");
L.assertFnContains('historyEveningDays 处置计数三态', 'historyEveningDays', 'continue: 0, defer: 0, drop: 0');
L.assertFnContains('historyWeekPlans 读 weekPlans', 'historyWeekPlans', 'meta.weekPlans');
L.assertFnContains('historyWeekPlans committedAt 回落 savedAt', 'historyWeekPlans', 'committedAt || wp[wk].savedAt');
L.assertFnContains('historyReviews 合并三周期存储', 'historyReviews', 'REVIEW_STORE');
L.assertFnContains('historyReviews 按 savedAt 倒序', 'historyReviews', 'localeCompare');
L.assertFnContains('dkWeekLabel 输出周几', 'dkWeekLabel', "'日一二三四五六'");

// ⑤ 弹窗
L.assertFnContains('openHistory 挂 #historyModal', 'openHistory', "getElementById('historyModal')");
L.assertFnContains('openHistory tab 点击切换', 'openHistory', 'data-htab');
L.assertFnContains('openHistory 大石头履约实时查', 'openHistory', 'nodeInWorkflow(r.wfId, r.nodeId)');
L.assertFnContains('openHistory 已移除石头标注', 'openHistory', '已从树移除');
L.assertFnContains('openHistory 晨计划空态引导', 'openHistory', '还没有晨计划记录');
L.assertFnContains('openHistory 晚回顾展示三件好事', 'openHistory', 'his-goods');
L.assertFnContains('openHistory 回顾仪式问答折叠', 'openHistory', 'his-qa');
L.assertFnContains('closeHistory 清理', 'closeHistory', "classList.remove('show')");

// ⑥ 入口
L.assertContains('侧栏历史按钮', 'id="sideHistory"', html);
L.assertContains('historyModal 容器', 'id="historyModal"', html);
L.assertContains('闹钟菜单历史入口', 'id="btnHistory"');
L.assertContains('bindRit 绑 sideHistory', "bindRit('sideHistory', () => openHistory());");
L.assertContains('闹钟菜单绑定 btnHistory', "getElementById('btnHistory')");

// ⑦ 样式 + 导出
L.assertContains('his-day 卡片样式', '.his-day {', css);
L.assertContains('his-live 进行中标记样式', '.his-live {', css);
L.assertContains('his-quote 引用样式', '.his-quote {', css);
L.assertContains('导出 summarizeScoreEntries', 'summarizeScoreEntries,');
L.assertContains('导出 historyEveningDays', 'historyEveningDays,');
L.assertContains('导出 openHistory', 'openHistory,');

process.exit(L.summary('verify-v812') ? 1 : 0);
