/* v8.16 今日页四连修 —— 常驻字符串核查。
   起因（用户四点反馈）：
   ① 「上面分析的优化点需要优化」→ 遗留项：逾期任务静默沉在 Backlog（「剩 -3 天」）不进需要关注
      → overdueLeaves（全活跃项目逾期叶子，排除 recur/habit）+ splitStaleOverdue 纯函数（逾期优先去重）
        → renderTodayStale 改「⚠️ 停滞·逾期」双组同区；角标/title 构成同步加 🚨逾期；空态文案补逾期
   ② 「周预算统计不对，和单个项目一样了」→ 根因：weekPlanFeasibility 的 est 是全部项目合计，
      但无全局容量配置时 weekCapGlobal() 回落 weekCap()（当前项目净额）→ 全局 est vs 单项目 cap
      口径错配 → 假超支（渲染行 + warnIfOverCapacity 弹窗同根因）
      → 修复：渲染层 wk.global 分支（有全局配置才显示「本周总预算」行，否则引导⚙设置）；
        summary 无全局时改用本项目口径判定；warnIfOverCapacity 全局分支加 f.global 守卫
   ③ 「备选里都需要能进入今日，现在只有下月的能」→ 实因：renderFocus 的 li() 第三参 showToday
      只有 backlogLanes 两条 lane 传 true（top3/立即做/核心投入都没传）
      → 三区全传 true；已在今日的（time/planDate 今日/daysLeft=0）显示「✓ 今日」标记防重复点击
       （promoteNodeToToday 会重排时间，非幂等）
   ④ 「今日状态里的指标缺乏说明，且是重复的」→ metricsStrip 叶子% 与页头 progressChip 同数据
      → 条内移除叶子 pill（页头常驻）；本周动量 title 写明「跨全部项目·近 7 天」与页头口径区分；
        「指标 N▾」summary 加 title；KR pill title 写明 Δ 口径（与时间进度的差）
   运行：node scripts/checks/verify-v816.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.16 核查 ==');

// ② 周预算口径修复（todayCapacity 渲染宿主 = renderTodayPanel）
L.assertFnContains('周预算 summary 按 global 分支', 'renderTodayPanel', 'wk.global ?');
L.assertFnContains('无全局配置显示引导行', 'renderTodayPanel', 'dc-no-global');
L.assertFnContains('引导行指向⚙设置', 'renderTodayPanel', '全局周预算未设置');
L.assertFnContains('无全局时改用本项目口径判定', 'renderTodayPanel', '⚠ 本项目超支');
L.assertFnContains('弹窗全局分支加 global 守卫', 'warnIfOverCapacity', 'f.over && f.global');
L.assertContains('引导行样式', '.dc-no-global {', css);

// ③ 备选区全部可入今日
L.assertFnContains('Top3 行传 showToday', 'renderFocus', 'top3.map((n, i) => li(n, i + 1, true))');
L.assertFnContains('立即做行传 showToday', 'renderFocus', 'now.map(n => li(n, null, true))');
L.assertFnContains('核心投入行传 showToday', 'renderFocus', 'core.map(n => li(n, null, true))');
L.assertFnContains('已在今日显示标记而非按钮', 'renderFocus', 'fitem-in-today');
L.assertFnContains('在今日判定含已排时间', 'renderFocus', 'n.time || n.planDate === dateKey() || n.daysLeft === 0');
L.assertContains('在今日标记样式', '.fitem-in-today {', css);

// ④ metricsStrip 去重（v8.17 起 KR 整块迁出今日 → 只断言「本周完成」仍在；KR 相关改 verify-v817）
L.assertFnNotContains('条内不再有叶子 pill（页头常驻）', 'renderMetricsStrip', '叶子 <b>${lp.pct}%</b>');
L.assertFnContains('本周动量仍在今日状态', 'renderMetricsStrip', '本周完成');
L.assertFnContains('本周动量 title 写明跨项目口径', 'renderMetricsStrip', '跨全部项目 · 近 7 天');
L.assertFnNotContains('v8.17 起今日不再展指标折叠', 'renderMetricsStrip', 'ms-kr-fold');

// ① 逾期并入需要关注
L.assertFnContains('overdueLeaves 排除 recur/habit', 'overdueLeaves', "!n.recur && n.role !== 'habit' && n.overdue");
L.assertFnContains('overdueLeaves 跨活跃项目', 'overdueLeaves', 'activeWorkflows().forEach');
L.assertFnContains('splitStaleOverdue 逾期优先去重', 'splitStaleOverdue', 'ids.has(a.node.id)');
L.assertFnContains('splitStaleOverdue 脏数据防御', 'splitStaleOverdue', 'a && a.node');
L.assertFnContains('组合函数供两处同口径', 'attentionStaleOverdue', 'splitStaleOverdue(stagnationAlerts(STALE_DAYS), overdueLeaves())');
L.assertFnContains('停滞区改「停滞·逾期」', 'renderTodayStale', '⚠️ 停滞·逾期');
L.assertFnContains('逾期行显示逾期天数', 'renderTodayStale', '已逾期 ${-a.node.daysLeft} 天');
L.assertFnContains('停滞区两组都空才清空', 'renderTodayStale', 'if (!od.length && !stale.length)');
L.assertFnContains('角标计入逾期', 'updateTodayZones', 'odN + staleN + parkedN + inboxN + tipN');
L.assertFnContains('角标 title 构成含逾期', 'updateTodayZones', '🚨逾期 ${odN}');
L.assertFnContains('空态文案补逾期', 'updateTodayZones', '逾期 / 停滞 / 暂停 / 待澄清都已清空');
L.assertContains('逾期行样式', '.stale-row.od .stale-m', css);

// 导出 + 版本
L.assertContains('导出 splitStaleOverdue', 'splitStaleOverdue,');
L.assertContains('导出 overdueLeaves', 'overdueLeaves,');
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v816') ? 1 : 0);
