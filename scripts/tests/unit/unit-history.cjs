/* 单元测试 · 仪式历史聚合族：summarizeScoreEntries / historyMorningDays / historyEveningDays /
   historyWeekPlans / historyReviews / dkWeekLabel（均为 meta 入参纯函数，不读 state）
   运行：node scripts/tests/unit/unit-history.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 仪式历史聚合 ==');

// ---- summarizeScoreEntries ----
const ent = [
  { kind: 'done', score: 30 }, { kind: 'done', score: 42 }, { kind: 'pomo', score: 20 }
];
const sc = app.summarizeScoreEntries(ent);
L.eq('聚合总分', sc.total, 92);
L.eq('聚合完成数（pomo 不算完成）', sc.count, 2);
L.eq('聚合番茄数', sc.pomos, 1);
L.eq('聚合专注时长 25′/个', sc.focusMin, 25);
L.eq('92 分等级 A（与 todayScore 同口径）', sc.grade, 'A');
L.eq('空数组安全', app.summarizeScoreEntries([]).total, 0);
L.eq('null 安全 + 0 分等级 —', app.summarizeScoreEntries(null).grade, '—');

// ---- dkWeekLabel ----
L.eq('dkWeekLabel 周一', app.dkWeekLabel('2026-11-23'), '11月23日 周一');
L.eq('dkWeekLabel 周日', app.dkWeekLabel('2026-11-29'), '11月29日 周日');
L.eq('dkWeekLabel 垃圾输入原样返回', app.dkWeekLabel('bad'), 'bad');
L.eq('dkWeekLabel 空输入', app.dkWeekLabel(''), '');

// ---- historyMorningDays ----
const metaM = {
  morningPlans: {
    '2026-11-24': { at: 1, mit: { text: '写报告' }, poolN: 5, est: 100, cap: 240, pendN: 2 },
    '2026-11-26': { at: 3, mit: null, poolN: 3, est: 60, cap: 240, pendN: 0 },
    '2026-11-25': { at: 2, mit: { text: '面试' }, poolN: 4, est: 90, cap: 240, pendN: 1 },
  }
};
const md = app.historyMorningDays(metaM);
L.eq('晨计划倒序（新→旧）', md.map(r => r.dk), ['2026-11-26', '2026-11-25', '2026-11-24']);
L.eq('晨计划字段携带', [md[2].poolN, md[2].pendN], [5, 2]);
L.eq('晨计划 dk 注入记录', md[0].dk, '2026-11-26');
L.eq('晨计划空 meta 安全', app.historyMorningDays({}).length, 0);
L.eq('晨计划 null 安全', app.historyMorningDays(null).length, 0);

// ---- historyEveningDays ----
const metaE = {
  scoreLog: { '2026-11-25': { entries: [{ kind: 'done', score: 30 }, { kind: 'pomo', score: 20 }] } },
  dayNotes: { '2026-11-25': '今天不错', '2026-11-24': '' },
  goodThings: { '2026-11-25': ['完成演示', '', '早睡'], '2026-11-24': ['', '', ''] },
  eveningDispo: {
    '2026-11-25|wf1|n1': 'continue', '2026-11-25|wf1|n2': 'defer', '2026-11-25|wf2|n3': 'drop',
    '2026-11-23|wf1|n4': 'continue',
  },
};
const ed = app.historyEveningDays(metaE);
L.eq('晚回顾 key 并集+倒序', ed.map(r => r.dk), ['2026-11-25', '2026-11-24', '2026-11-23']);
L.eq('晚回顾聚合评分', [ed[0].total, ed[0].count, ed[0].pomos], [50, 1, 1]);
L.eq('晚回顾三件好事过滤空串', ed[0].goods, ['完成演示', '早睡']);
L.eq('晚回顾总结携带', ed[0].note, '今天不错');
L.eq('晚回顾处置计数', [ed[0].dispo.continue, ed[0].dispo.defer, ed[0].dispo.drop], [1, 1, 1]);
L.eq('仅处置记录的日期也入列', ed[2].dispo.continue, 1);
L.eq('空串总结返回空', ed[1].note, '');
L.eq('晚回顾 null 安全', app.historyEveningDays(null).length, 0);

// ---- historyWeekPlans ----
const metaW = {
  weekPlans: {
    '2026-11-16': { rocks: [{ wfId: 'w1', nodeId: 'n1', text: '旧石头' }], intent: '旧意图', committedAt: 100 },
    '2026-11-23': { rocks: [{ wfId: 'w1', nodeId: 'n2', text: '新石头' }], intent: '', savedAt: 200 },
  }
};
const wp = app.historyWeekPlans(metaW);
L.eq('周计划倒序', wp.map(r => r.wk), ['2026-11-23', '2026-11-16']);
L.eq('周计划 rocks 携带', wp[0].rocks[0].text, '新石头');
L.eq('committedAt 回落 savedAt', wp[0].committedAt, 200);
L.eq('intent 缺省空串', wp[0].intent, '');
L.eq('周计划空 meta 安全', app.historyWeekPlans({}).length, 0);

// ---- historyReviews ----
const metaR = {
  weekReviews: [
    { period: '2026-11-16', week: '2026-11-16', savedAt: '2026-11-22T13:00:00.000Z', statsSnapshot: { total: 9, corePct: 55 } },
    { period: '2026-11-23', week: '2026-11-23', savedAt: '2026-11-26T13:00:00.000Z', gold: '推进了' },
  ],
  monthReviews: [{ period: '2026-10', savedAt: '2026-11-01T13:00:00.000Z', next: '行动' }],
  quarterReviews: [],
};
const rv = app.historyReviews(metaR);
L.eq('回顾合并三存储', rv.length, 3);
L.eq('回顾按 savedAt 倒序', [rv[0].period, rv[1].period, rv[2].period], ['2026-11-23', '2026-11-16', '2026-10']);
L.eq('回顾带 cycle 标记', rv[2].cycle, 'month');
L.eq('回顾字段保留', rv[0].gold, '推进了');
L.eq('回顾 null 安全', app.historyReviews(null).length, 0);

process.exit(L.summary('unit-history') ? 1 : 0);
