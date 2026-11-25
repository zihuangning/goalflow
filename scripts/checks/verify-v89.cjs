/* v8.9 模块间增删同步审计修复 —— 常驻字符串核查。
   审计「删除/替换」链路，共修 8 处模块间不同步：
   ① purgeNodeRefs/restoreNodeRefs：节点级级联清理助手（大石头/明晚预选/习惯打卡，带备份供 undo 还原）
   ② deleteNode：级联清理（先备份）+ 番茄钟解绑 + undo 一并还原
   ③ purgeCurrentTreeRefs：整树替换前置清理（doParse / autoDecomposeGoal / applyWorkflowTemplate 三处共用）
   ④ purgeWorkflowRefs：项目级清理助手（v8.8 deleteWorkflow 内联块抽出，补番茄钟解绑，与 clearAll 共用）
   ⑤ removeWizardNodes：向导重生成删子树不走 deleteNode → 补级联清理
   ⑥ clearAll：确认改 confirmModal（原生 confirm 会被吞）+ meta 快照 + 清全部流引用 + undo 还原 meta
   ⑦ adoptPendingAction：同流采纳补 afterChange（此前只有跨流路径经 switchWorkflow 刷新）
   ⑧ deleteNode/doParse/整树替换路径的番茄钟 nodeId 解绑
   运行：node scripts/checks/verify-v89.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');

console.log('== v8.9 核查 ==');

// ① purgeNodeRefs / restoreNodeRefs
L.assertFnContains('purgeNodeRefs 清大石头', 'purgeNodeRefs', 'droppedIds.has(r.nodeId)');
L.assertFnContains('purgeNodeRefs 备份大石头', 'purgeNodeRefs', 'bak.rocks[wk] = dead');
L.assertFnContains('purgeNodeRefs 清明晚预选', 'purgeNodeRefs', 'delete state.meta.tomorrowMit');
L.assertFnContains('purgeNodeRefs 备份明晚预选', 'purgeNodeRefs', 'bak.tomorrowMit = tm');
L.assertFnContains('purgeNodeRefs 习惯打卡按 wfId| 前缀', 'purgeNodeRefs', "const prefix = wfId + '|'");
L.assertFnContains('purgeNodeRefs 清习惯打卡', 'purgeNodeRefs', 'delete hs[k]');
L.assertFnContains('restoreNodeRefs 还原大石头', 'restoreNodeRefs', '.concat(bak.rocks[wk])');
L.assertFnContains('restoreNodeRefs 还原明晚预选', 'restoreNodeRefs', 'state.meta.tomorrowMit = bak.tomorrowMit');
L.assertFnContains('restoreNodeRefs 还原习惯打卡', 'restoreNodeRefs', 'hs[k] = bak.streaks[k]');

// ② deleteNode 级联 + undo 还原
L.assertFnContains('deleteNode 级联清理（带备份）', 'deleteNode', 'purgeNodeRefs(state.activeWorkflowId, drop, true)');
L.assertFnContains('deleteNode undo 还原引用', 'deleteNode', 'restoreNodeRefs(refBackup)');
L.assertFnContains('deleteNode 番茄钟解绑', 'deleteNode', 'if (state.pomo && drop.has(state.pomo.nodeId)) state.pomo.nodeId = null;');
L.assertFnContains('deleteNode 保存 meta', 'deleteNode', 'saveMeta(); afterChange();');

// ③ purgeCurrentTreeRefs 三处整树替换共用
L.assertFnContains('purgeCurrentTreeRefs 清旧树引用', 'purgeCurrentTreeRefs', 'purgeNodeRefs(state.activeWorkflowId, oldIds)');
L.assertFnContains('purgeCurrentTreeRefs 清失效置顶', 'purgeCurrentTreeRefs', 'if (state.topPin && oldIds.has(state.topPin)) state.topPin = null;');
L.assertFnContains('purgeCurrentTreeRefs 番茄钟解绑', 'purgeCurrentTreeRefs', 'if (state.pomo && oldIds.has(state.pomo.nodeId)) state.pomo.nodeId = null;');
L.assertFnContains('doParse 替换前清引用', 'doParse', 'purgeCurrentTreeRefs();');
L.assertFnContains('AI 分解替换前清引用', 'autoDecomposeGoal', 'purgeCurrentTreeRefs();');
L.assertFnContains('模板应用替换前清引用', 'applyWorkflowTemplate', 'purgeCurrentTreeRefs();');
L.assertFnContains('doParse 保存 meta', 'doParse', 'save(); saveMeta(); afterChange();');

// ④ purgeWorkflowRefs（deleteWorkflow/clearAll 共用）
L.assertFnContains('purgeWorkflowRefs 番茄钟解绑', 'purgeWorkflowRefs', 'if (state.pomo && state.pomo.wfId === wfId)');
L.assertFnContains('purgeWorkflowRefs 清大石头', 'purgeWorkflowRefs', 'wp[wk].rocks.filter(r => r.wfId !== wfId)');
L.assertFnContains('purgeWorkflowRefs 清待办行动', 'purgeWorkflowRefs', 'pendingActions.filter(a => a.wfId !== wfId)');
L.assertFnContains('purgeWorkflowRefs 清习惯打卡', 'purgeWorkflowRefs', "k.indexOf(wfId + '|') === 0");

// ⑤ removeWizardNodes 级联
L.assertFnContains('向导重生成级联清理', 'removeWizardNodes', 'purgeNodeRefs(state.activeWorkflowId, doomed)');

// ⑥ clearAll：页内确认 + meta 快照 + 清引用 + undo 还原
L.assertFnContains('clearAll 用 confirmModal', 'clearAll', 'await confirmModal({');
L.assertFnNotContains('clearAll 不再原生 confirm', 'clearAll', "if (!confirm(");
L.assertFnContains('clearAll 快照含 meta', 'clearAll', 'meta: state.meta');
L.assertFnContains('clearAll 清全部流引用', 'clearAll', '(state.workflows || []).forEach(w => purgeWorkflowRefs(w.id))');
L.assertFnContains('clearAll undo 还原 meta', 'clearAll', 'state.meta = snap.meta;');
L.assertFnContains('clearAll 保存 meta', 'clearAll', 'save(); saveMeta(); afterChange();');

// ⑦ adoptPendingAction 同流补刷新
L.assertFnContains('adoptPendingAction 同流 afterChange', 'adoptPendingAction', 'else afterChange();');

// 回归护栏：番茄钟死引用双层兜底仍在
L.assertFnContains('renderPomoBar 跨项目兜底', 'renderPomoBar', 'nodeInWorkflow(state.pomo.wfId, state.pomo.nodeId)');

// 版本号断言由最新版 verify 承担（v8.10 起）

process.exit(L.summary('verify-v89') ? 1 : 0);
