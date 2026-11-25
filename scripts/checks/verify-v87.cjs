/* v8.7 四项修复 —— 常驻字符串核查。
   ① 选模板也进 AI 分析（除非模板自带 date/start 具体时间）：templateHasSchedule + 合成目标文本
   ② 今日视图「只看当前项目」过滤：_wfOnly 持久化 + heroGlobalCandidates/todayAggregatedPool 双过滤 + 头部开关
   ③ 今日执行混入明天任务：todayExecutionPoolFor 最前排除 planDate > 今天的节点
   ④ 顶栏计数口径：renderAppTitle 改 todayAggregatedPool + executionLog 完成数（原只算当前项目且 done 恒 0）
   运行：node scripts/checks/verify-v87.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.7 核查 ==');

// ① 模板 × AI
L.assertFnContains('templateHasSchedule 存在（递归查 children）', 'templateHasSchedule', 'walk(t.children)');
L.assertFnContains('模板自带时间直接套用', 'openWorkflowMetaModal', 'if (templateHasSchedule(tpl)) { applyWorkflowTemplate(tpl, meta); return; }');
L.assertFnContains('模板无描述合成目标文本', 'openWorkflowMetaModal', '模板骨架（可按需调整）');
L.assertFnContains('模板走 AI 带兜底', 'openWorkflowMetaModal', 'autoDecomposeGoal(goalText, meta, { fallbackTpl: tpl })');
L.assertContains('弹窗模板区提示 AI 分解', '创建时 AI 按模板方向分解');

// ② 工作流过滤
L.assertContains('_wfOnly 持久化读取', "localStorage.getItem('goalflow.todayWfOnly')");
L.assertFnContains('toggleTodayWfOnly 写持久化', 'toggleTodayWfOnly', "localStorage.setItem('goalflow.todayWfOnly'");
L.assertFnContains('toggleTodayWfOnly 触发重渲染', 'toggleTodayWfOnly', 'afterChange()');
L.assertFnContains('英雄卡候选过滤', 'heroGlobalCandidates', 'if (_wfOnly && wf.id !== state.activeWorkflowId) return;');
L.assertFnContains('今日汇总池过滤', 'todayAggregatedPool', 'if (_wfOnly && wf.id !== state.activeWorkflowId) return;');
L.assertContains('头部过滤开关按钮', 'id="todayWfOnlyBtn"');
L.assertContains('开关接线（重绑）', 'wfOnlyEl.onclick = () => toggleTodayWfOnly()');
L.assertContains('开关样式', '.today-wfonly.on', features);

// ③ planDate 未来排除
L.assertFnContains('今日池排除未来 planDate', 'todayExecutionPoolFor', "if (pdk && pdk > dateKey()) return false;");
L.assertFnContains('排除判断在其他纳入条款之前', 'todayExecutionPoolFor', '拉回今天，表现为「今日执行混进明天/后天的任务且没有时间」');
L.assertFnContains('成功提醒只数有 time 的叶子', 'insertAITasks', 'collected.filter(n => n.time).length');

// ④ 顶栏计数口径
L.assertFnContains('顶栏用全局汇总池', 'renderAppTitle', 'todayAggregatedPool()');
L.assertFnContains('顶栏完成数取 executionLog', 'renderAppTitle', "executionLog || {})[dateKey()]");
L.assertFnNotContains('顶栏不再只算当前项目', 'renderAppTitle', 'pool = todayExecutionPoolFor(state.nodes)');
L.assertFnNotContains('顶栏完成数不再恒 0', 'renderAppTitle', 'pool.filter(n => n.done)');

process.exit(L.summary('verify-v87') ? 1 : 0);
