/* v8.2 行为冒烟：grabFn 从 app.js 提取真实函数 + stub DOM/状态依赖后实跑。
   覆盖：parseAIStart 格式兼容 / wfTimeWindows 多段+旧字段兼容 / backfillAISchedule 兜底排期
   （含「定 date 与放 start 必须同一遍 bump 一次」的二次避让回归场景）。
   运行：node scripts/checks/smoke-v82.cjs */
const L = require('./lib.cjs');

console.log('== v8.2 冒烟 ==');

const TODAY = new Date(2026, 10, 25); // 固定“今天” 2026-11-25（周三）
const dkOf = d => {
  const x = d ? new Date(d) : TODAY;
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

const stubs = {
  pad2: n => String(n).padStart(2, '0'),
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  hmToMin: hm => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); },
  minToHm: m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
  today0: () => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()),
  dateKey: d => dkOf(d),
  // stub 必须含 activeWorkflowId + meta.capacity，否则 wfTimeWindows 拿默认窗口导致结果偏移
  state: { activeWorkflowId: 'wf1', meta: { capacity: { wf1: { wins: [{ start: '19:00', mins: 180 }] } } } },
  setNodeDeadline: (n, dk) => { n.deadlineDate = new Date(dk + 'T00:00:00'); n.daysLeft = dk === dkOf() ? 0 : 1; },
  // v8.23: backfill 写今日 time 后盖章 timeDk
  stampNodeTimeDk: (n, dk) => { if (!n) return; if (n.time) n.timeDk = dk || dkOf(); else n.timeDk = ''; },
  save: () => {},
};

// v8.11 时间纠偏接入 backfillAISchedule 尾部（④ 写库前冲突顺延）——提取列表必须带上，
// 否则 eval 上下文里 resolveTimeConflicts 未定义（v8.9 教训：抽共用助手要同步更新提取列表）
// v8.21: wfTimeWindows 无项目窗口时回落 globalTimeWindows——提取列表必须带上
const ctx = L.buildCtx(['parseAIStart', 'wfTimeWindows', 'backfillAISchedule', 'resolveTimeConflicts', 'globalTimeWindows', 'winsTotalHours'], stubs);

// ---- parseAIStart 格式兼容 ----
const cases = { '19点': '19:00', '19点30分': '19:30', '7:30pm': '19:30', '19.30': '19:30', '19:30': '19:30', '7': '07:00', '': '' };
Object.entries(cases).forEach(([input, want]) => {
  const got = ctx.parseAIStart(input);
  got === want ? L.ok(`parseAIStart('${input}') = '${got}'`) : L.bad(`parseAIStart('${input}')`, `期望 '${want}' 实得 '${got}'`);
});

// ---- wfTimeWindows ----
const wins = ctx.wfTimeWindows('wf1');
(wins.length === 1 && wins[0].start === '19:00' && wins[0].end === '22:00' && wins[0].mins === 180)
  ? L.ok('wfTimeWindows 读 wins 数组 → 19:00–22:00')
  : L.bad('wfTimeWindows wins', JSON.stringify(wins));
stubs.state.meta.capacity.wf2 = { winStart: '12:30', winEnd: '13:30' }; // 旧字段兼容
const wins2 = ctx.wfTimeWindows('wf2');
(wins2.length === 1 && wins2[0].start === '12:30' && wins2[0].end === '13:30')
  ? L.ok('wfTimeWindows 兼容旧 winStart/winEnd')
  : L.bad('wfTimeWindows 旧字段', JSON.stringify(wins2));
(ctx.wfTimeWindows('wf-none').length === 0) ? L.ok('wfTimeWindows 无配置 → 空数组（全天可排）') : L.bad('wfTimeWindows 空');

// ---- backfillAISchedule ----
const leaf = (id, extra) => Object.assign({ id, parentId: 'p1', text: 't' + id }, extra || {});

// 场景 A：3 个叶子全无 date/start → 从 max(今天,anchor) 顺排，窗口 19:00 起，间隔 10min
// 期望 19:00 / 19:40 / 20:20 —— v8.2 曾因「定 date 与放 start 分两遍」二次避让导致 b=21:15，本场景即回归测试
{
  const nodes = [leaf('a'), leaf('b'), leaf('c')];
  ctx.backfillAISchedule(nodes, new Date(TODAY));
  const got = nodes.map(n => n.time);
  const want = ['19:00', '19:40', '20:20'];
  JSON.stringify(got) === JSON.stringify(want)
    ? L.ok('场景A 顺排同一遍 bump → ' + got.join('/'))
    : L.bad('场景A 顺排', `期望 ${want.join('/')} 实得 ${got.join('/')}`);
}

// 场景 B：首块 AI 已给今天 20:00（30min），缺的从已排块顺接 → b=20:40, c=21:20（间隔 10min，无二次避让）
{
  const nodes = [leaf('a', { time: '20:00', estimateMinutes: 30 }), leaf('b'), leaf('c')];
  ctx.backfillAISchedule(nodes, new Date(TODAY));
  const got = [nodes[1].time, nodes[2].time];
  const want = ['20:40', '21:20'];
  JSON.stringify(got) === JSON.stringify(want)
    ? L.ok('场景B 顺接已排块 → ' + got.join('/'))
    : L.bad('场景B 顺接', `期望 ${want.join('/')} 实得 ${got.join('/')}`);
}

// 场景 C：当日窗口装不下 → 换次日（planDate = 明天）
{
  const nodes = [leaf('a', { estimateMinutes: 170 }), leaf('b', { estimateMinutes: 170 })]; // 窗口 180min，两块装不下
  ctx.backfillAISchedule(nodes, new Date(TODAY));
  const tomorrowD = new Date(TODAY); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const okA = nodes[0].time === '19:00';
  const okB = nodes[1].planDate === dkOf(tomorrowD) + 'T19:00';
  (okA && okB)
    ? L.ok('场景C 窗口满换次日 → a=今天19:00, b=' + nodes[1].planDate)
    : L.bad('场景C 换次日', `a=${nodes[0].time} b=${nodes[1].planDate}`);
}

// 场景 D：习惯（recur）固定窗口起点
{
  const nodes = [leaf('h', { recur: true })];
  ctx.backfillAISchedule(nodes, new Date(TODAY));
  nodes[0].time === '19:00' ? L.ok('场景D recur 补窗口起点 19:00') : L.bad('场景D recur', nodes[0].time);
}

// 场景 E（v8.6 回归）：anchor 为 'YYYY-MM-DD' 字符串不炸——生产环境三个调用方都传字符串，
// 旧版 backfillAISchedule 直接 anchorD.getTime() 抛 TypeError（insertAITasks v8.6 已归一化，此处锁 backfill 容忍度）
{
  const nodes = [leaf('a')];
  let threw = null;
  try { ctx.backfillAISchedule(nodes, '2026-11-25'); } catch (e) { threw = e; }
  // backfill 本身要求 Date（insertAITasks 已负责归一）；字符串时抛错则断言失败防回归
  (!threw && nodes[0].time === '19:00')
    ? L.ok('场景E anchor 字符串容忍 → ' + nodes[0].time)
    : L.bad('场景E anchor 字符串', threw ? threw.message : 'time=' + nodes[0].time);
}

process.exit(L.summary('smoke-v82') ? 1 : 0);
