/* v8.4 五项修复 —— 常驻字符串核查。
   ① AI 报错可见：autoDecomposeGoal（新建流程）也写 AI 历史；btnAIDecompose 失败用 lastLLMError 具体原因；
      空 tasks 抛错；rawSnippet 原始片段进详情；历史失败行内联错误
   ② AI 分解假流程展示：showAIOverlay 分步演出（ai-steps + 定时推进，remove 清理定时器）
   ③ 最后一个项目可删 + wf-item.active 框统一（灰框+左竖条，不再整圈 accent）
   ④ 项目设置删除按钮被遮挡：.wfm-body flex:1 + overflow:auto（modal-foot 不再被裁）
   ⑤ 创建项目一键模板：WF_TEMPLATES + chips 预填 + applyWorkflowTemplate 生成任务树
   运行：node scripts/checks/verify-v84.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const layout = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/layout.css'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');

console.log('== v8.4 核查 ==');

// ① AI 报错可见
L.assertFnContains('autoDecomposeGoal 写 AI 历史（via:create）', 'autoDecomposeGoal', "via: 'create'");
L.assertFnContains('autoDecomposeGoal 失败也落历史', 'autoDecomposeGoal', 'addAIHistoryEntry(historyEntry)');
// v8.6 起失败改弹窗（showAIErrorModal 内含「已记入 AI 视图 · 使用历史」），不再 toast
L.assertFnContains('autoDecomposeGoal 失败指引看历史（v8.6 起为弹窗）', 'autoDecomposeGoal', 'showAIErrorModal(reason, historyEntry.rawSnippet');
L.assertContains('btnAIDecompose 失败用 lastLLMError 具体原因', "historyEntry.error = lastLLMError() || 'AI 调用失败");
L.assertContains('空 tasks 抛错（不再无声成功 0 个任务）', 'AI 未能从该目标拆出任务——请把目标描述得更具体可衡量');
L.assertContains('parse 失败附原始返回片段', "historyEntry.rawSnippet = String(result).slice(0, 300)");
L.assertContains('历史失败行内联错误摘要', 'ai-history-err');
L.assertContains('详情弹窗展示原始片段', 'ai-history-raw');

// ② 假流程展示
L.assertFnContains('showAIOverlay 分步演出', 'showAIOverlay', 'ai-steps');
L.assertFnContains('演出停最后一步等真实返回', 'showAIOverlay', 'cur = steps.length - 1');
L.assertFnContains('remove 清理定时器', 'showAIOverlay', 'clearInterval(timer); _remove()');
L.assertContains('ai-step 样式（working/done/spin）', '.ai-step.working i', mobile);
L.assertContains('ai-step 完成勾', ".ai-step.done i::after", mobile);

// ③ 最后一个项目可删 + 框统一
L.assertFnContains('deleteWorkflow 无「至少保留一个」拦截', 'deleteWorkflow', 'v8.4：允许删除最后一个项目');
L.assertFnNotContains('不再 alert 至少保留', 'deleteWorkflow', '至少保留一个项目');
L.assertFnContains('删空重建空白项目', 'deleteWorkflow', "name: '默认目标', nodes: []");
L.assertContains('active 框 = 灰框+左竖条', 'box-shadow: inset 3px 0 0 var(--accent)', layout);
L.assertNotContains('active 不再整圈 accent', 'box-shadow: 0 0 0 1px var(--accent) inset', layout);

// ④ 删除按钮遮挡修复
{
  const m = features.match(/\.wfm-body\s*\{([\s\S]*?)\}/);
  (m && /overflow:\s*auto/.test(m[1]) && /flex:\s*1/.test(m[1]) && /min-height:\s*0/.test(m[1]))
    ? L.ok('.wfm-body flex:1+overflow:auto（modal-foot 不再被裁）')
    : L.bad('.wfm-body 滚动修复', m ? m[1].slice(0, 120) : '未找到');
}

// ⑤ 模板
L.assertContains('WF_TEMPLATES 常量存在', 'const WF_TEMPLATES = [');
L.assertContains('模板含学习考试', "id: 'study'");
L.assertContains('模板含健康健身', "id: 'fitness'");
L.assertContains('模板含副业产品', "id: 'sidebiz'");
L.assertContains('模板含读书写作', "id: 'write'");
L.assertFnContains('新建弹窗模板区（仅 isNew）', 'openWorkflowMetaModal', 'wfm-tpl-chips');
L.assertFnContains('chips 点击预填表单', 'openWorkflowMetaModal', 'overlay.dataset.tpl = tpl.id');
L.assertFnContains('chips 预填窗口段', 'openWorkflowMetaModal', '(tpl.preset.wins || []).map(winRowHtml)');
L.assertFnContains('保存分支模板优先于 AI', 'openWorkflowMetaModal', 'applyWorkflowTemplate(tpl, meta)');
L.assertFnContains('applyWorkflowTemplate 走 insertAITasks（兜底排期生效）', 'applyWorkflowTemplate', 'insertAITasks(root.id, tpl.tasks, meta.startDate)');
L.assertContains('模板 chips 样式', '.wfm-tpl-chip.on', features);

process.exit(L.summary('verify-v84') ? 1 : 0);
