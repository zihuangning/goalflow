/* 单元测试 · 时间/习惯/SMART 族：weekKey / periodKey / stagnantDays / habitStrength /
   energyBucketNow / smartEval / smartQuestions / decomposeSuggestions
   运行：node scripts/tests/unit/unit-time.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 时间与习惯族 ==');

// ---- weekKey：周一为一周起点 ----
L.eq('weekKey 周三 → 本周一', app.weekKey(new Date(2026, 10, 25)), '2026-11-23');
L.eq('weekKey 周日 → 同一个周一', app.weekKey(new Date(2026, 10, 29)), '2026-11-23');
L.eq('weekKey 周一 → 当天', app.weekKey(new Date(2026, 10, 30)), '2026-11-30');

// ---- periodKey ----
L.eq('periodKey month', app.periodKey('month', new Date(2026, 10, 25)), '2026-11');
L.eq('periodKey quarter', app.periodKey('quarter', new Date(2026, 10, 25)), '2026-Q4');
L.eq('periodKey week = weekKey', app.periodKey('week', new Date(2026, 10, 25)), '2026-11-23');

// ---- stagnantDays ----
L.eq('停滞 从未激活 → 999', app.stagnantDays({}), 999);
L.eq('停滞 今天动过 → 0', app.stagnantDays({ touchedAt: Date.now() }), 0);
L.eq('停滞 3 天前 → 3', app.stagnantDays({ createdAt: Date.now() - 3 * 86400000 }), 3);

// ---- habitStrength：做 +5% 漏 -freqDecay（净 +3%），30 天窗口，不清零 ----
const log10 = {};
for (let i = 0; i < 10; i++) log10[L.dkOf(L.daysAgo(i))] = true;
L.eq('习惯 连打 10 天 → 50%', app.habitStrength({ log: log10 }).pct, 50);

const log30 = {};
for (let i = 0; i < 30; i++) log30[L.dkOf(L.daysAgo(i))] = true;
const s30 = app.habitStrength({ log: log30 });
L.eq('习惯 连打 30 天 → 100 封顶', s30.pct, 100);
L.eq('习惯 samples 上限 30', s30.samples, 30);

// 5 打（近）+ 5 漏（远）：按 i 升序结算 → .05×5 + (.05-.02)×5 = .40
const logMix = {};
for (let i = 0; i < 5; i++) logMix[L.dkOf(L.daysAgo(i))] = true;
for (let i = 5; i < 10; i++) logMix[L.dkOf(L.daysAgo(i))] = false;
L.eq('习惯 5 打 5 漏 → 40%', app.habitStrength({ log: logMix }).pct, 40);
L.eq('低频 freqDecay=0.012 漏扣更少 → 44%', app.habitStrength({ log: logMix, freqDecay: 0.012 }).pct, 44);
L.truthy('习惯 空记录/null → 0', app.habitStrength({ log: {} }).pct === 0 && app.habitStrength(null).pct === 0);

// ---- energyBucketNow：与本地小时一致 ----
const h = new Date().getHours();
const expectB = (h >= 5 && h < 12) ? 'am' : (h >= 12 && h < 18) ? 'pm' : 'eve';
L.eq('精力时段桶（5-12=am / 12-18=pm / 其余=eve）', app.energyBucketNow(), expectB);

// ---- smartEval 规则路径 ----
let ev = app.smartEval({ text: '提升业绩' });
L.eq('SMART 模糊目标 smart=false', ev.smart, false);
L.eq('SMART 模糊 → s=1 m=1', [ev.s, ev.m], [1, 1]);
L.truthy('SMART 模糊 → 3 个 gap + 规则来源', ev.gaps.length === 3 && ev.fromAI === false);
ev = app.smartEval({ text: '12月31日前签下3家客户', im: 4, deadline: '12月31日' });
L.eq('SMART 完整目标 smart=true', ev.smart, true);
L.eq('SMART 完整 → s3 m3 r3 t3', [ev.s, ev.m, ev.r, ev.tb], [3, 3, 3, 3]);
// AI 评估对象优先
ev = app.smartEval({ text: '随便', smartEval: { s: 1, m: 3, a: 2, r: 3, t: 3 } });
L.eq('SMART AI 路径优先 + fromAI', [ev.fromAI, ev.s], [true, 1]);
L.truthy('SMART AI s=1 → 不具体 gap', ev.gaps.some(g => g.includes('不具体')));

// ---- smartQuestions：短板触发对应提问 ----
const qs = app.smartQuestions({ text: '提升业绩' });
L.truthy('提问 含衡量指标', qs.some(q => q.includes('指标')));
L.truthy('提问 含完成时间', qs.some(q => q.includes('什么时候完成')));
L.truthy('提问 总是追问拆解步骤', qs.some(q => q.includes('2-3 个具体小步骤')));

// ---- decomposeSuggestions：关键词路由到行业模板 ----
L.truthy('拆解建议 读书类', app.decomposeSuggestions({ text: '读完 5 本书' }).some(s => s.includes('书单')));
L.truthy('拆解建议 销售类', app.decomposeSuggestions({ text: '跟进客户签合同' }).some(s => s.includes('意向清单')));
L.truthy('拆解建议 运动类', app.decomposeSuggestions({ text: '每天锻炼 30 分钟' }).some(s => s.includes('固定每日时段')));
L.truthy('拆解建议 默认类', app.decomposeSuggestions({ text: '整理房间' }).some(s => s.includes('可交付')));

process.exit(L.summary('unit-time') ? 1 : 0);
