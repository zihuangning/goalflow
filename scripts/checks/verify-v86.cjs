/* v8.6 四项修复 —— 常驻字符串核查。
   ① 模板创建不进 AI：模板分支改为「填了描述照常 autoDecomposeGoal（fallbackTpl 兜底）」
   ② anchorD.getTime is not a function：insertAITasks + backfillAISchedule 双层归一化字符串日期
   ③ 报错弹窗显示：showAIErrorModal（原因+原始片段+回滚/兜底说明+去 AI 历史），替代 6 秒 toast
   ④ AI 视图移除「AI 分解目标」模块：panelAIDecompose 不存在；reuseHistoryEntry 降级为剪贴板
   运行：node scripts/checks/verify-v86.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.6 核查 ==');

// ① 模板 + AI 共存（v8.7 语义更新：模板无具体时间也走 AI，仅自带 date/start 的模板直接套用）
L.assertFnContains('模板走 AI 分解（带 fallbackTpl）', 'openWorkflowMetaModal', 'autoDecomposeGoal(goalText, meta, { fallbackTpl: tpl })');
L.assertFnContains('模板自带具体时间才直接套用', 'openWorkflowMetaModal', 'if (templateHasSchedule(tpl)) { applyWorkflowTemplate(tpl, meta); return; }');
L.assertFnContains('autoDecomposeGoal 第三参 opts', 'autoDecomposeGoal', 'opts = opts || {}');
L.assertFnContains('失败回落模板（silent 不双弹窗）', 'autoDecomposeGoal', "applyWorkflowTemplate(opts.fallbackTpl, projectMeta, { silent: true })");
L.assertFnContains('applyWorkflowTemplate 支持 silent', 'applyWorkflowTemplate', 'opts.silent');

// ② anchorD 归一化
L.assertFnContains('insertAITasks 字符串 anchor 归一化', 'insertAITasks', 'anchorD instanceof Date');
L.assertFnContains('backfillAISchedule 防御归一化', 'backfillAISchedule', 'anchorD instanceof Date');

// ③ 报错弹窗
L.assertFnContains('showAIErrorModal 存在', 'showAIErrorModal', 'AI 分解失败');
L.assertFnContains('错误弹窗含原始片段', 'showAIErrorModal', 'ai-history-raw');
L.assertFnContains('错误弹窗去 AI 历史按钮', 'showAIErrorModal', "switchView('ai')");
L.assertFnContains('错误弹窗回滚说明', 'showAIErrorModal', 'cancelledProject');
L.assertFnContains('错误弹窗模板兜底说明', 'showAIErrorModal', 'fallbackTpl');
L.assertFnContains('failAndRollback 用弹窗替代 toast', 'autoDecomposeGoal', 'showAIErrorModal(reason, historyEntry.rawSnippet');
L.assertFnNotContains('failAndRollback 不再 toast', 'autoDecomposeGoal', 'showToast(`❌ AI 分解失败');
L.assertContains('aierr 样式', '.aierr-reason', features);

// ④ AI 视图移除分解模块
L.assertNotContains('panelAIDecompose 已移除', 'id="panelAIDecompose"', html);
L.assertNotContains('aiGoalInput 已移除', 'id="aiGoalInput"', html);
L.assertNotContains('btnAIDecompose 已移除', 'id="btnAIDecompose"', html);
L.assertContains('panelAIHistory 保留', 'id="panelAIHistory"', html);
L.assertContains('panelAIConfigDetails 保留', 'id="panelAIConfigDetails"', html);
L.assertContains('panelSMART 保留', 'id="panelSMART"', html);
L.assertFnContains('reuseHistoryEntry 无输入框时复制剪贴板', 'reuseHistoryEntry', 'clipboard.writeText');

process.exit(L.summary('verify-v86') ? 1 : 0);
