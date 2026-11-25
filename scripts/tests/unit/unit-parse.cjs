/* 单元测试 · 解析族：parseDeadline / inferScale / inferRecur / parseEstimateMinutes / parseText
   运行：node scripts/tests/unit/unit-parse.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 解析族 ==');

// ---- parseDeadline：daysLeft 以今天为基准（断言相对值，与运行日期无关） ----
const today = new Date(); today.setHours(0, 0, 0, 0);

let dl = app.parseDeadline('今天');
L.eq('期限 今天 → 0 天', dl.daysLeft, 0);
L.eq('期限 今天 label', dl.label, '今天');
L.truthy('期限 今天不逾期', !dl.overdue);
L.eq('期限 明天 → 1 天', app.parseDeadline('明天').daysLeft, 1);
L.eq('期限 后天 → 2 天', app.parseDeadline('后天').daysLeft, 2);

dl = app.parseDeadline('2027-01-15');
L.eq('期限 YYYY-MM-DD label 归一', dl.label, '2027-01-15');
L.eq('期限 YYYY-MM-DD daysLeft', dl.daysLeft, Math.round((new Date(2027, 0, 15) - today) / 86400000));

// X月X日：今年已过则取明年（永远落在未来最近的一次）
dl = app.parseDeadline('12月31日');
const expYear = new Date(today.getFullYear(), 11, 31) >= today ? today.getFullYear() : today.getFullYear() + 1;
L.eq('期限 12月31日 落在未来最近一次', dl.date.getTime(), new Date(expYear, 11, 31).getTime());

// 下周X = 下自然周的第 X 天（v7.7 语义，不用「下个X+7」）
dl = app.parseDeadline('下周三');
const nextMon = new Date(today); nextMon.setDate(nextMon.getDate() + (7 - ((today.getDay() + 6) % 7)));
const expWed = new Date(nextMon); expWed.setDate(expWed.getDate() + 2);
L.eq('期限 下周三 label', dl.label, '下周三');
L.eq('期限 下周三 = 下自然周周三', dl.date.getTime(), expWed.getTime());

// 相对天 / 周（v7.7 补齐）
L.eq('期限 3天后', app.parseDeadline('3天后').daysLeft, 3);
L.eq('期限 两周内 → 14 天', app.parseDeadline('两周内').daysLeft, 14);

// 第N周：以项目开始日为锚点，第 N 周 = 锚点起第 N×7 天
dl = app.parseDeadline('第2周', '2026-01-01');
L.eq('期限 第2周 = 锚点 + 13 天', dl.date.getTime(), new Date(2026, 0, 14).getTime());

// 逾期与无期限
dl = app.parseDeadline('2020-01-01');
L.truthy('期限 过去日期逾期', dl.overdue && dl.daysLeft < 0);
dl = app.parseDeadline('随便一句没有期限的话');
L.eq('期限 无期限 → null 三件套', [dl.date, dl.daysLeft, dl.overdue], [null, null, false]);

// ---- inferScale：关键词 → 尺度 ----
L.eq('尺度 每天 → day', app.inferScale('每天晨跑'), 'day');
L.eq('尺度 每周 → week', app.inferScale('每周复盘'), 'week');
L.eq('尺度 每月 → month', app.inferScale('每月账单'), 'month');
L.eq('尺度 目标 → year', app.inferScale('年度目标'), 'year');

// ---- inferRecur：重复任务嗅探 ----
L.truthy('recur 每天', app.inferRecur('每天喝水') === true);
L.truthy('recur 每周N次', app.inferRecur('每周 3 次训练') === true);
L.truthy('recur 普通任务 → false', app.inferRecur('写一份方案') === false);

// ---- parseEstimateMinutes：文本估时 ----
L.eq('估时 2小时 → 120', app.parseEstimateMinutes('约2小时'), 120);
L.eq('估时 45分钟', app.parseEstimateMinutes('45分钟'), 45);
L.eq('估时 半天 → 240', app.parseEstimateMinutes('半天'), 240);
L.eq('估时 无信息 → null', app.parseEstimateMinutes('没什么时间信息'), null);

// ---- parseText：树形解析 ----
const nodes = app.parseText('目标A\n  子任务1\n    孙任务\n  子任务2\n兄弟B');
L.eq('parseText 节点数', nodes.length, 5);
L.eq('parseText id 序列', nodes.map(n => n.id), ['n0', 'n1', 'n2', 'n3', 'n4']);
L.eq('parseText 首行为根', nodes[0].parentId, null);
L.eq('parseText 缩进挂父', [nodes[1].parentId, nodes[2].parentId, nodes[3].parentId], ['n0', 'n1', 'n0']);
L.eq('parseText 第二顶级行收敛到根（单根树）', nodes[4].parentId, 'n0');
L.eq('parseText 有子节点的分支按文本重推尺度（目标→year）', nodes[0].scale, 'year');
L.eq('parseText 空输入 → []', app.parseText('  \n  \n'), []);

process.exit(L.summary('unit-parse') ? 1 : 0);
