/* v8.11 「排期纠偏 + 容量口径」修复 —— 常驻字符串核查。
   用户报告：晨计划 4 项进今日行动只剩 1 项（18:00 任务被吞）+ 两个 9:00 + 「超负荷」困惑。共修 6 处：
   ① resolveTimeConflicts/ensureTodayTimeResolved 新增 —— 叶子时间冲突纠偏（AI 给两个 9:00 也被
      网页层顺延开）；renderToday 渲染前 ensure 式调用（ensureRemindDefaults 之前，提醒以纠偏后 time 为准）
   ② backfillAISchedule 全局避让 —— 项目里已存在的今日 time / 各日 planDate 占用计入 dayNext，
      第二次 AI 拆解不再与旧任务撞车；尾部对本批今日块跑一次纠偏（① 只记账不改的盲区）
   ③ todayExecutionPoolFor 预算参数 + todayAggregatedPool 全局递减分配 —— 每项目不再各自吃满
      dayCap（N 项目合计 N×dayCap 必超全局容量的结构性「超负荷」）；当前项目优先
   ④ 溢出任务留在池里（_overflow 降权 + 「🌊 溢出」行标记 + 沉底分区）—— 此前直接丢弃，
      是「任务被吞」感知的一部分；MIT 候选排除溢出；晨计划预览只列预算内
   ⑤ 「被吞」可见性 —— 排到明/后天（≤+3 天）的叶子在今日清单头部给顺排提示条
   ⑥ 「超负荷」说人话 —— todayCapacity 卡 / 晨计划副标题 / 状态摘要都带超出分钟数与行动建议
   运行：node scripts/checks/verify-v811.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.11 核查 ==');

// ① 时间冲突纠偏
L.assertFnContains('resolveTimeConflicts 占用尾+间隔模型', 'resolveTimeConflicts', 'occEnd = ns + dur + GAP;');
L.assertFnContains('resolveTimeConflicts 重叠判定', 'resolveTimeConflicts', 'if (occEnd >= 0 && s < occEnd)');
L.assertFnContains('resolveTimeConflicts 出日界保持原样', 'resolveTimeConflicts', 'if (occEnd + dur > 24 * 60)');
L.assertFnContains('resolveTimeConflicts 返回 moves', 'resolveTimeConflicts', 'return { changed: moves.length, moves };');
L.assertFnContains('ensureTodayTimeResolved dirty 才落盘', 'ensureTodayTimeResolved', 'if (r.changed) save();');
L.assertFnContains('renderToday 渲染前纠偏', 'renderTodayPanel', 'ensureTodayTimeResolved(pool);');
// v8.18: MIT 可能跨项目，改为 remindNodes（池 + MIT）再 ensureRemindDefaults
L.assertFnContains('renderToday 提醒默认值仍在', 'renderTodayPanel', 'ensureRemindDefaults(remindNodes)');

// ② backfill 全局避让 + 尾部纠偏
L.assertFnContains('backfill 避让项目已占用', 'backfillAISchedule', 'const batchIds = new Set(collected.map(n => n.id));');
L.assertFnContains('backfill 旧 time 计入占用', 'backfillAISchedule', "if (n.time) bump(dateKey(), hmToMin(n.time), n.estimateMinutes || 30);");
L.assertFnContains('backfill 旧 planDate 计入占用', 'backfillAISchedule', "if (pd.length >= 16) bump(pd.slice(0, 10), hmToMin(pd.slice(11, 16)), n.estimateMinutes || 30);");
L.assertFnContains('backfill 尾部本批纠偏', 'backfillAISchedule', 'resolveTimeConflicts(tasks.filter(n => n.time));');

// ③ 池预算全局口径
L.assertFnContains('todayExecutionPoolFor 预算参数', 'todayExecutionPoolFor', 'let budget = (budgetCap != null) ? budgetCap : dayCap();');
L.assertFnContains('todayAggregatedPool 全局预算递减', 'todayAggregatedPool', 'let budgetLeft = dayCapGlobal();');
L.assertFnContains('todayAggregatedPool 当前项目优先', 'todayAggregatedPool', 'if (a.id === state.activeWorkflowId) return -1;');
L.assertFnContains('todayAggregatedPool 池内占用扣减', 'todayAggregatedPool', "if (!n._overflow && !(n.recur || n.role === 'habit')) budgetLeft -= (n.estimateMinutes || 0);");
L.assertFnContains('todayAggregatedPool 预算传入池', 'todayAggregatedPool', 'todayExecutionPoolFor(nodes, budgetLeft)');

// ④ 溢出留池 + 渲染分区
L.assertFnContains('溢出任务留在池里', 'todayExecutionPoolFor', 'if (!habit && est > budget && out.length) { n._overflow = true; out.push(n); return; }');
L.assertFnContains('renderToday MIT 排除溢出', 'renderTodayPanel', 'pool.find(x => x.isWfTop && !x.node._overflow)');
// v8.23: 排序抽到 sortTodayExecEntries，溢出仍沉底
L.assertFnContains('renderToday 走统一排序', 'renderTodayPanel', 'sortTodayExecEntries');
L.assertContains('溢出沉底在 sortTodayExecEntries', '.concat(overflowed)', L.APP_JS);
L.assertFnContains('renderToday 溢出分隔行', 'renderTodayPanel', '🌊 溢出 · 超出今日可投入，建议顺延或删减');
L.assertFnContains('todayRowHtml 溢出行 class', 'todayRowHtml', "n._overflow ? 'is-overflow'");
L.assertFnContains('todayRowHtml 溢出标记', 'todayRowHtml', '🌊 溢出');
L.assertContains('晨计划预览只列预算内', 'pool.filter(ent => !ent.node._overflow).slice(0, 6)');
L.assertContains('CSS 溢出降权', '.today-row.is-overflow { opacity: .62; }', css);
L.assertContains('CSS 顺排提示条样式', '.today-shifted-hint', css);

// ⑤ 顺排提示条（「被吞」可见性）
L.assertFnContains('renderToday 顺排提示条', 'renderTodayPanel', '🗓 ${tmrw.length} 项排在今后几天');
L.assertFnContains('顺排提示条只要叶子', 'renderTodayPanel', "if ((wf.nodes || []).some(x => x.parentId === n.id)) return;  // 只要叶子");

// ⑥ 文案说人话
L.assertContains('todayCapacity 超出分钟数', "`超出 ${d.est - d.cap}′`");
L.assertContains('晨计划副标题带超出数', '（超出 ${d.est - d.cap}′，建议删减或顺延）');
L.assertContains('状态摘要带超出数', "`超出预算 ${d.est - d.cap}′`");
L.assertContains('todayCapacity title 说清口径', '全部项目今日候选任务预估合计 vs 你在⚙设置里的每日可投入');

// 导出
L.assertContains('导出 resolveTimeConflicts', 'resolveTimeConflicts, ensureTodayTimeResolved, todayExecutionPoolFor, backfillAISchedule,');

process.exit(L.summary('verify-v811') ? 1 : 0);
