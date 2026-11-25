/* 单元测试 · 评分族：focusScoreParts / focusScore / pickRanked / scoreDoneItem / scorePomoItem / scoreGrade
   运行：node scripts/tests/unit/unit-score.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 评分族 ==');

// ---- focusScoreParts：逐项加分语义 ----
L.eq('完成 → -1000', app.focusScoreParts({ done: true }).total, -1000);
L.eq('im4 无期限 → 40+2 长期主线', app.focusScoreParts({ im: 4 }).total, 42);
L.eq('im3 无期限 → 30（无主线加分）', app.focusScoreParts({ im: 3 }).total, 30);
L.eq('逾期 +30', app.focusScoreParts({ im: 3, deadlineDate: new Date(), overdue: true }).total, 60);
L.eq('1天内到期 +26', app.focusScoreParts({ im: 3, deadlineDate: new Date(), daysLeft: 1 }).total, 56);
L.eq('3天内到期 +20', app.focusScoreParts({ im: 3, deadlineDate: new Date(), daysLeft: 3 }).total, 50);
L.eq('本周到期 +13', app.focusScoreParts({ im: 3, deadlineDate: new Date(), daysLeft: 7 }).total, 43);
L.eq('两周内 +7', app.focusScoreParts({ im: 3, deadlineDate: new Date(), daysLeft: 14 }).total, 37);
L.eq('远期有期限 +3', app.focusScoreParts({ im: 3, deadlineDate: new Date(), daysLeft: 30 }).total, 33);
L.eq('阻塞 -60', app.focusScoreParts({ im: 3, status: 'blocked' }).total, -30);
L.eq('等待 -45', app.focusScoreParts({ im: 3, status: 'waiting' }).total, -15);
L.eq('钉槽但无精力数据 → 高峰 +0', app.focusScoreParts({ im: 3, slot: 'h1', eff: 4 }).total, 30);
L.eq('focusScore 与分解总分同源', app.focusScore({ im: 4 }), 42);

// ---- pickRanked：叶子竞选 / 排序 / 排除（注意：每次改节点后要 computeTree 刷新缓存） ----
const pool = [
  { id: 'r', text: '根', im: 3 },
  { id: 'l1', parentId: 'r', im: 5 },
  { id: 'l2', parentId: 'r', im: 4 },
  { id: 'l3', parentId: 'r', im: 2 },
  { id: 'br', parentId: 'r', im: 5 },
  { id: 'brleaf', parentId: 'br', im: 3 },
];
app.computeTree(pool);
L.eq('Top2 = im5+im4 叶子（分支不竞选）', app.pickRanked(pool, 2).map(n => n.id), ['l1', 'l2']);
L.eq('limit=1 返回单对象', app.pickRanked(pool, 1).id, 'l1');
pool.find(n => n.id === 'l1').done = true; app.computeTree(pool);
L.eq('完成退出竞选', app.pickRanked(pool, 1).id, 'l2');
pool.find(n => n.id === 'l2').status = 'blocked'; app.computeTree(pool);
L.eq('阻塞退出竞选', app.pickRanked(pool, 1).id, 'brleaf');
const onlyRoot = [{ id: 'r', text: '根', im: 3 }];
app.computeTree(onlyRoot);
L.eq('无候选回落根（单）', app.pickRanked(onlyRoot, 1).id, 'r');
L.eq('无候选回落根（多）', app.pickRanked(onlyRoot, 3).map(n => n.id), ['r']);
onlyRoot[0].done = true; app.computeTree(onlyRoot);
L.eq('根完成 → null', app.pickRanked(onlyRoot, 1), null);

// ---- scoreDoneItem：完成评分 ----
L.eq('完成分 基础 im3 → 30', app.scoreDoneItem({ im: 3 }).score, 30);
L.eq('完成分 期限内 +12', app.scoreDoneItem({ im: 4, deadlineDate: new Date(), overdue: false }).score, 52);
L.eq('完成分 逾期 -8', app.scoreDoneItem({ im: 4, deadlineDate: new Date(), overdue: true }).score, 32);
L.eq('完成分 时长达标 +15', app.scoreDoneItem({ im: 3, estimateMinutes: 30, actualMinutes: 30 }).score, 45);
L.eq('完成分 略超时 +6', app.scoreDoneItem({ im: 3, estimateMinutes: 30, actualMinutes: 40 }).score, 36);
L.eq('完成分 超时较多 +0', app.scoreDoneItem({ im: 3, estimateMinutes: 30, actualMinutes: 100 }).score, 30);
L.eq('完成分 习惯打卡 +5', app.scoreDoneItem({ im: 3, recur: true }).score, 35);

// ---- scorePomoItem：番茄评分（25/50/90 加权） ----
L.eq('番茄 无节点 25′ → 20', app.scorePomoItem(null, 25).score, 20);
L.eq('番茄 im5 90′ → 34', app.scorePomoItem({ im: 5 }, 90).score, 34);
L.truthy('番茄 90′ 标记深潜', app.scorePomoItem({ im: 5 }, 90).reason.includes('深潜'));
L.truthy('番茄 50′ 标记长专注', app.scorePomoItem(null, 50).reason.includes('长专注'));

// ---- scoreGrade：等级边界 ----
L.eq('评分等级 S/A/B/C/—', [app.scoreGrade(120), app.scoreGrade(80), app.scoreGrade(40), app.scoreGrade(1), app.scoreGrade(0)], ['S', 'A', 'B', 'C', '—']);
L.eq('评分等级边界 119/79/39', [app.scoreGrade(119), app.scoreGrade(79), app.scoreGrade(39)], ['A', 'B', 'C']);

process.exit(L.summary('unit-score') ? 1 : 0);
