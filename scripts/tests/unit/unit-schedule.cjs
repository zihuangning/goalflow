/* 单元测试 · 时间安排与期限族：recomputeSchedule 跨天重算 / setNodeDeadline 五字段写入口 /
   convertDuePlanDate 到期转换 / habitDueToday / habitTarget / habitRecurrence /
   isRecurringTask / recurringTaskDueToday（v8.10 新增导出）
   运行：node scripts/tests/unit/unit-schedule.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 时间安排与期限族 ==');

// ---- recomputeSchedule：按「今天」重算期限派生值（跨天自适应） ----
let nodes = [{ id: 'r', text: '根', deadline: '明天' }];
app.recomputeSchedule(nodes);
L.eq('重算 相对标签「明天」daysLeft=1', nodes[0].daysLeft, 1);
L.eq('重算 「明天」不逾期', nodes[0].overdue, false);
L.truthy('重算 「明天」deadlineText 同步', nodes[0].deadlineText === nodes[0].deadline && !!nodes[0].deadlineText);

const yDk = L.dkOf(L.daysAgo(1)), tDk = L.dkOf(L.daysAgo(-1));   // daysAgo(-1)=明天
nodes = [{ id: 'r', text: '根', deadline: yDk }];
app.recomputeSchedule(nodes);
L.eq('重算 昨天绝对日期 daysLeft=-1', nodes[0].daysLeft, -1);
L.eq('重算 昨天绝对日期 逾期', nodes[0].overdue, true);

nodes = [{ id: 'r', text: '根', deadline: tDk }];
app.recomputeSchedule(nodes);
L.eq('重算 明天绝对日期 daysLeft=1', nodes[0].daysLeft, 1);

nodes = [{ id: 'r', text: '根', deadlineDate: L.daysAgo(-1) }];
app.recomputeSchedule(nodes);
L.eq('重算 仅日期无标签 daysLeft=1', nodes[0].daysLeft, 1);
L.eq('重算 仅日期无标签 补 label', nodes[0].deadline, tDk);

nodes = [{ id: 'r', text: '根' }];
app.recomputeSchedule(nodes);
L.truthy('重算 无期限 null 三件套', nodes[0].deadlineDate === null && nodes[0].daysLeft === null && nodes[0].overdue === false);

// 锚定标签：'第2周' + anchor → 日期不随重算日漂移（锚点的存在意义）
const anchorDk = L.dkOf(L.daysAgo(3));
nodes = [{ id: 'r', text: '根', deadline: '第2周', deadlineAnchor: anchorDk }];
app.recomputeSchedule(nodes);
const expectAnchorDate = L.daysAgo(3); expectAnchorDate.setDate(expectAnchorDate.getDate() + 13);
L.eq('重算 「第2周」锚定不漂移', L.dkOf(nodes[0].deadlineDate), L.dkOf(expectAnchorDate));

// ---- setNodeDeadline：期限五字段唯一写入口 ----
let n = {};
app.setNodeDeadline(n, '明天');
L.eq('写期限 「明天」daysLeft=1', n.daysLeft, 1);
L.eq('写期限 「明天」label', n.deadline, '明天');
L.truthy('写期限 五字段同步（date/text/overdue）', n.deadlineDate instanceof Date && n.deadlineText === '明天' && n.overdue === false);

n = { deadline: '旧', deadlineText: '旧', deadlineDate: new Date(), daysLeft: 5, overdue: true, deadlineAnchor: '2026-01-01' };
app.setNodeDeadline(n, '');
L.truthy('清期限 六字段全清', !n.deadline && !n.deadlineText && n.deadlineDate === null && n.daysLeft === null && n.overdue === false && n.deadlineAnchor === null);

n = {};
app.setNodeDeadline(n, '第2周');
L.eq('写期限 「第2周」留锚=今天', n.deadlineAnchor, L.dkOf(L.daysAgo(0)));

n = {};
app.setNodeDeadline(n, '2026-12-31');
L.eq('写期限 绝对日期不留锚', n.deadlineAnchor, null);

n = {};
app.setNodeDeadline(n, L.daysAgo(-2));
L.eq('写期限 Date 对象 → 后天', n.daysLeft, 2);

// ---- convertDuePlanDate：到期 planDate 转 time（跨天进今日） ----
const y19 = L.dkOf(L.daysAgo(1)) + 'T19:00';
const t08 = L.dkOf(L.daysAgo(0)) + 'T08:00';
const m09 = L.dkOf(L.daysAgo(-1)) + 'T09:00';

n = { planDate: y19, time: '' };
L.truthy('排期 昨天到期 → 转换', app.convertDuePlanDate(n) === true);
L.eq('排期 昨天到期 → time 19:00', [n.time, n.planDate], ['19:00', '']);

n = { planDate: t08, time: '' };
app.convertDuePlanDate(n);
L.eq('排期 今天到期 → 转换', [n.time, n.planDate], ['08:00', '']);

n = { planDate: m09, time: '' };
L.truthy('排期 明天 → 不动', app.convertDuePlanDate(n) === false && n.planDate === m09);

n = { planDate: y19, time: '', done: true };
L.truthy('排期 已完成 → 不动', app.convertDuePlanDate(n) === false && n.planDate === y19);

n = { planDate: L.dkOf(L.daysAgo(1)), time: '' };
app.convertDuePlanDate(n);
L.eq('排期 无时间部分 → 清 planDate 不塞 time', [n.time, n.planDate], ['', '']);

n = { planDate: y19, time: '08:00' };
app.convertDuePlanDate(n);
L.eq('排期 已有 time 不覆盖', n.time, '08:00');

// ---- habitDueToday / habitTarget / habitRecurrence：周期判定 ----
const MON = new Date(2026, 10, 23), TUE = new Date(2026, 10, 24), WED = new Date(2026, 10, 25), SAT = new Date(2026, 10, 28), SUN = new Date(2026, 10, 29);
L.truthy('到期 每天型 任意日', app.habitDueToday({ recurrence: { type: 'daily' } }, MON));

const wkd = { recurrence: { type: 'weekdays' } };
L.eq('到期 工作日 周一✓周六✗', [app.habitDueToday(wkd, MON), app.habitDueToday(wkd, SAT)], [true, false]);
L.eq('目标 工作日 =5', app.habitTarget(wkd), 5);

const wke = { recurrence: { type: 'weekends' } };
L.eq('到期 周末 六✓日✓一✗', [app.habitDueToday(wke, SAT), app.habitDueToday(wke, SUN), app.habitDueToday(wke, MON)], [true, true, false]);

const wk135 = { recurrence: { type: 'weekly', days: [1, 3, 5] } };
L.eq('到期 每周一三五 周三✓周二✗', [app.habitDueToday(wk135, WED), app.habitDueToday(wk135, TUE)], [true, false]);
L.eq('目标 每周一三五 =3', app.habitTarget(wk135), 3);

const mon15 = { recurrence: { type: 'monthly', dayOfMonth: 15 } };
L.eq('到期 每月15号 15✓16✗', [app.habitDueToday(mon15, new Date(2026, 10, 15)), app.habitDueToday(mon15, new Date(2026, 10, 16))], [true, false]);

const iv3 = { recurrence: { type: 'interval', interval: 3, anchorDate: L.dkOf(L.daysAgo(0)) } };
L.eq('到期 每3天 今✓明✗后✗+3✓', [
  app.habitDueToday(iv3, L.daysAgo(0)),
  app.habitDueToday(iv3, L.daysAgo(-1)),
  app.habitDueToday(iv3, L.daysAgo(-2)),
  app.habitDueToday(iv3, L.daysAgo(-3)),
], [true, false, false, true]);

const tpw = { timesPerWeek: 3 };
L.truthy('到期 每周3次 每天可打', app.habitDueToday(tpw, MON) && app.habitDueToday(tpw, SUN));
L.eq('目标 每周3次 =3', app.habitTarget(tpw), 3);
L.eq('目标 每天型 =7', app.habitTarget({ recur: true }), 7);

L.eq('兼容 旧 timesPerWeek → timesPerWeek 型', app.habitRecurrence({ timesPerWeek: 2 }).type, 'timesPerWeek');
L.eq('兼容 普通 recur → daily 型', app.habitRecurrence({ recur: true }).type, 'daily');

// ---- isRecurringTask / recurringTaskDueToday：循环任务（非习惯） ----
L.eq('循环判定 recurrence 非习惯 ✓', app.isRecurringTask({ recurrence: { type: 'daily' } }), true);
L.eq('循环判定 recur 旧习惯 ✗', app.isRecurringTask({ recur: true, recurrence: { type: 'daily' } }), false);
L.eq('循环判定 role=habit ✗', app.isRecurringTask({ role: 'habit', recurrence: { type: 'daily' } }), false);
L.eq('循环判定 无 recurrence ✗', app.isRecurringTask({}), false);

const todayDk = L.dkOf(L.daysAgo(0));
L.eq('循环到期 今天已完成 → 不再到期', app.recurringTaskDueToday({ recurrence: { type: 'daily' }, lastRecDone: todayDk }), false);
L.eq('循环到期 昨天完成 → 今天仍到期', app.recurringTaskDueToday({ recurrence: { type: 'daily' }, lastRecDone: L.dkOf(L.daysAgo(1)) }), true);
L.eq('循环到期 从未完成 → 到期', app.recurringTaskDueToday({ recurrence: { type: 'daily' }, lastRecDone: '' }), true);

// ---- resolveTimeConflicts：叶子时间冲突纠偏（v8.11：AI 给两个 9:00 也必须被网页层纠开） ----
let tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '09:00', estimateMinutes: 30 }];
let tr = app.resolveTimeConflicts(tc);
L.eq('纠偏 两个 9:00 → 09:00/09:40', [tc[0].time, tc[1].time], ['09:00', '09:40']);
L.eq('纠偏 changed=1', tr.changed, 1);
L.eq('纠偏 moves 记录 from/to', [tr.moves[0].id, tr.moves[0].from, tr.moves[0].to], ['b', '09:00', '09:40']);

tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '09:00', estimateMinutes: 30 }, { id: 'c', time: '09:00', estimateMinutes: 30 }];
app.resolveTimeConflicts(tc);
L.eq('纠偏 链式三个 → 09:00/09:40/10:20', tc.map(n => n.time), ['09:00', '09:40', '10:20']);

tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '10:30', estimateMinutes: 30 }];
tr = app.resolveTimeConflicts(tc);
L.eq('纠偏 不重叠不动（占用尾 09:40 + 缓冲 ≤ 10:30）', tr.changed, 0);

tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '09:20', estimateMinutes: 30 }];
app.resolveTimeConflicts(tc);
L.eq('纠偏 缓冲带内也算撞（09:20 < 09:40）→ 顺到 09:40', tc[1].time, '09:40');

tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '09:00', estimateMinutes: 30, done: true }, { id: 'c', estimateMinutes: 30 }];
tr = app.resolveTimeConflicts(tc);
L.truthy('纠偏 done/无 time 跳过', tr.changed === 0 && tc[1].time === '09:00' && !tc[2].time);

tc = [{ id: 'a', time: '23:50', estimateMinutes: 30 }, { id: 'b', time: '23:55', estimateMinutes: 30 }];
tr = app.resolveTimeConflicts(tc);
L.truthy('纠偏 顺延出日界 → 保持原样（比逆序强）', tr.changed === 0 && tc[1].time === '23:55');

tc = [{ id: 'a', time: '09:00', estimateMinutes: 30 }, { id: 'b', time: '09:00', estimateMinutes: 30 }];
app.resolveTimeConflicts(tc, { gapMinutes: 0 });
L.eq('纠偏 自定义间隔 0 → 09:00/09:30', [tc[0].time, tc[1].time], ['09:00', '09:30']);

tc = [{ id: 'a', time: '09:00' }, { id: 'b', time: '09:00' }];
app.resolveTimeConflicts(tc);
L.eq('纠偏 缺省估时按 30′ → 09:40', tc[1].time, '09:40');

let wrapped = [{ node: { id: 'a', time: '09:00', estimateMinutes: 60 } }, { node: { id: 'b', time: '09:30', estimateMinutes: 30 } }];
tr = app.resolveTimeConflicts(wrapped);
L.eq('纠偏 {node} 包装也认 → b 顺到 10:10', [tr.changed, wrapped[1].node.time], [1, '10:10']);

process.exit(L.summary('unit-schedule') ? 1 : 0);
