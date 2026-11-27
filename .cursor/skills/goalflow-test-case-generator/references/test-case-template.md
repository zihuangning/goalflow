# 用例输出模板（复制表头，填行）

| 编号 | 测试场景 | 需求依据 | 依据置信度 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 自动化建议 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GF-TODAY-NORMAL-001 | （示例）勾选叶子记入 executionLog | `openmemory` 执行闭环 · `setNodeDone` | 明确 | 已解析目标树，今日池有未完成叶子 | 今日视图勾选一项 | executionLog 当日多一条；表现分增加；取消可回滚 | P0 | unit + flow-today-execution |
| GF-TODAY-ERROR-001 | （示例）原生 confirm 删除项目 | v8.8 Patterns · `confirmModal` | 明确 | 多项目 | 在吞 confirm 的环境点删除 | 仍弹出页内确认；取消不删 | P0 | smoke / manual-only |
| GF-CAP-BOUND-001 | （示例）无全局周容量时不假超支 | v8.16 · `weekPlanFeasibility` | 明确 | 未配置全局 capacity | 打开今日看本周预算条 | 无全局时不拿单项目 cap 对比全局 est | P0 | unit + verify |
| GF-CAP-BOUND-002 | （示例）每周可投入上限 | （规格未写死默认值） | **待确认** | 打开⚙设置 | 将每天小时调到 0.5 与 16 | **待产品确认**：是否允许 0.5；超范围是否 clamp | P1 | manual-only |
| GF-DATA-NORMAL-001 | （示例）删项目清 rocks | `purgeWorkflowRefs` | 明确 | 周计划含该 wf 石头 | 删除项目 | rocks/pending/tomorrowMit/habitStreaks 无孤儿 | P0 | flow-goal-lifecycle |

**需求依据**：PRD/PRODUCT-FLOW 段落、`docs/superpowers/specs/**`、`openmemory.md` Patterns、函数名路径。

**依据置信度**：`明确` = 可核对文档或代码；`待确认` = 推断，评审必问。

**自动化建议取值**：`unit` / `flow` / `smoke` / `verify` / `manual-only` / 组合（如 `unit + verify`）
