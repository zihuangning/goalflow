/* v8.5 两项修复 —— 常驻字符串核查。
   ① v8.4 回归：保存项目后无法 AI 分解 —— 根因是 #workflowMetaModal 复用，
      overlay.dataset.tpl 不随 innerHTML 清除，上次点过模板后残留劫持后续所有创建。
      修复：openWorkflowMetaModal 打开即 delete overlay.dataset.tpl + 再点已选 chip 可取消。
   ② 分解完成后弹窗展示输出+今日安排：showAIResultModal（真实排期结果=backfill 后节点，
      非 AI 原始输出）；autoDecomposeGoal / btnAIDecompose / applyWorkflowTemplate 三处成功分支接入。
   运行：node scripts/checks/verify-v85.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.5 核查 ==');

// ① dataset.tpl 残留回归
L.assertFnContains('打开弹窗即清 dataset.tpl（v8.5 修复）', 'openWorkflowMetaModal', 'delete overlay.dataset.tpl');
L.assertFnContains('再点已选 chip 可取消模板', 'openWorkflowMetaModal', "chip.classList.contains('on')");
L.assertFnContains('取消后回到 AI 分解路径提示', 'openWorkflowMetaModal', '已取消模板——创建后可用 AI 分解或手动规划');

// ② 结果弹窗
L.assertFnContains('showAIResultModal 存在', 'showAIResultModal', 'smartModal');
L.assertFnContains('排期预览读真实节点（time/planDate 归一）', 'showAIResultModal', "String(n.planDate).slice(11, 16)");
L.assertFnContains('今日安排走今日执行池', 'showAIResultModal', 'todayExecutionPoolFor(nodes)');
L.assertFnContains('今日安排按 time 排序滤 _overflow', 'showAIResultModal', '!n._overflow && n.time');
L.assertFnContains('弹窗按钮跳任务树', 'showAIResultModal', "switchView('plan')");
L.assertFnContains('弹窗按钮跳今日', 'showAIResultModal', "switchView('today')");
L.assertFnContains('autoDecomposeGoal 成功弹窗（替代 toast+跳转）', 'autoDecomposeGoal', "showAIResultModal(rootNode.id, { title: '✅ AI 分解完成' })");
L.assertContains('btnAIDecompose 成功弹窗', "showAIResultModal(rootNode.id, { title: '✅ AI 分解完成' })");
L.assertFnContains('applyWorkflowTemplate 成功弹窗', 'applyWorkflowTemplate', 'showAIResultModal(root.id');
L.assertContains('air-row 弹窗样式', '.air-when', features);

process.exit(L.summary('verify-v85') ? 1 : 0);
