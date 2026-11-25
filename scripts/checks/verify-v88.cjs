/* v8.8 五项修复 —— 常驻字符串核查。
   ① 备选/Backlog 提到今天：nextFreeTimeToday 自动分配空闲时间 + showUndoToast 撤回（promoteNodeToToday + clarifyInbox 双路径）
   ② 删除项目同步清理：weekPlans rocks / pendingActions / tomorrowMit / planShare / capacity / habitStreaks / topWfId
   ③ 最后一个项目删除没反应：原生 confirm 改 confirmModal 页内弹窗（部分 WebView 静默吞 confirm）
   ④ 系统弹窗：sysNotify 镜像 + sysNotifyOptIn 授权按钮（AI 结果/失败弹窗接入）
   ⑤ 渲染容错：VIEW_GROUP 函数数组逐个 try；afterChange 全链 safe 包装
   运行：node scripts/checks/verify-v88.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.8 核查 ==');

// ① 提到今天 + 自动排时间 + 撤回
L.assertFnContains('nextFreeTimeToday 存在（跨项目收集占用）', 'nextFreeTimeToday', '(state.workflows || []).forEach');
L.assertFnContains('nextFreeTimeToday 用项目窗口', 'nextFreeTimeToday', 'wfTimeWindows(wfId)');
L.assertFnContains('nextFreeTimeToday 块间 10 分钟缓冲', 'nextFreeTimeToday', 'be + 10');
L.assertFnContains('nextFreeTimeToday 不排过去时间', 'nextFreeTimeToday', 'Math.max(ws, nowM)');
L.assertFnContains('promoteNodeToToday 自动分配时间', 'promoteNodeToToday', 'nextFreeTimeToday(state.activeWorkflowId');
L.assertFnContains('promoteNodeToToday 字段快照', 'promoteNodeToToday', 'const snap = {');
L.assertFnContains('promoteNodeToToday 撤回 toast', 'promoteNodeToToday', 'showUndoToast(');
L.assertFnContains('promoteNodeToToday 撤回恢复快照', 'promoteNodeToToday', 'Object.assign(n, snap)');
L.assertFnContains('promoteNodeToToday 窗口满提示', 'promoteNodeToToday', '今日窗口已满，未自动排时间');
L.assertFnContains('clarifyInbox 备选也自动排时间', 'clarifyInbox', 'nextFreeTimeToday(targetWf');
L.assertFnContains('clarifyInbox 撤回=移除叶子+回待澄清', 'clarifyInbox', "it.status = 'inbox'; it.clarifiedAt = null;");

// ② 删除项目同步清理（v8.9 起抽成 purgeWorkflowRefs 与 clearAll 共用）
L.assertFnContains('deleteWorkflow 调共用清理', 'deleteWorkflow', 'purgeWorkflowRefs(id)');
L.assertFnContains('清理本周大石头 rocks', 'purgeWorkflowRefs', 'wp[wk].rocks = wp[wk].rocks.filter(r => r.wfId !== wfId)');
L.assertFnContains('清理 pendingActions', 'purgeWorkflowRefs', 'state.meta.pendingActions.filter(a => a.wfId !== wfId)');
L.assertFnContains('清理 tomorrowMit', 'purgeWorkflowRefs', 'delete state.meta.tomorrowMit');
L.assertFnContains('清理 planShare', 'purgeWorkflowRefs', 'delete state.meta.planShare[wfId]');
L.assertFnContains('清理 capacity', 'purgeWorkflowRefs', 'delete state.meta.capacity[wfId]');
L.assertFnContains('清理 habitStreaks', 'purgeWorkflowRefs', "k.indexOf(wfId + '|') === 0");
L.assertFnContains('清理 topWfId', 'purgeWorkflowRefs', 'state.topWfId = null');

// ③ confirm 改页内弹窗
L.assertFnContains('confirmModal 存在（Promise 弹窗）', 'confirmModal', 'new Promise(resolve');
L.assertFnContains('confirmModal 用 smartModal', 'confirmModal', "getElementById('smartModal')");
L.assertFnContains('deleteWorkflow 用 confirmModal', 'deleteWorkflow', 'await confirmModal({');
L.assertFnNotContains('deleteWorkflow 不再原生 confirm', 'deleteWorkflow', 'if (!confirm(');
L.assertContains('确认弹窗样式', '.cfm-text', features);
L.assertContains('危险按钮样式', '.gf-btn--danger', features);
L.assertFnContains('删除结果系统通知', 'deleteWorkflow', "sysNotify('🗑 项目已删除'");

// ④ 系统通知
L.assertFnContains('sysNotify 存在（granted 才发）', 'sysNotify', "Notification.permission !== 'granted'");
L.assertFnContains('sysNotify tag 固定防堆叠', 'sysNotify', "tag: 'gf-sys'");
L.assertFnContains('sysNotifyOptIn 存在（default 才显示）', 'sysNotifyOptIn', "Notification.permission !== 'default'");
L.assertFnContains('AI 结果弹窗系统通知', 'showAIResultModal', "sysNotify('✅ ' + airTitle");
L.assertFnContains('AI 结果弹窗 opt-in', 'showAIResultModal', 'sysNotifyOptIn(');
L.assertFnContains('AI 失败弹窗系统通知', 'showAIErrorModal', "sysNotify('❌ AI 分解失败'");
L.assertFnContains('AI 失败弹窗 opt-in', 'showAIErrorModal', 'sysNotifyOptIn(');

// ⑤ 渲染容错
L.assertContains('VIEW_GROUP today 为函数数组', 'today: () => [renderHero, renderFocus');
L.assertFnContains('renderViewGroup 逐个 try', 'renderViewGroup', "console.error('[renderViewGroup]'");
L.assertFnContains('afterChange 全链容错', 'afterChange', "console.error('[afterChange]'");
L.assertFnContains('afterChange safe 包装 syncTop', 'afterChange', "safe('syncTop', syncTop)");

process.exit(L.summary('verify-v88') ? 1 : 0);
