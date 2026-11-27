---
name: goalflow-engineering
description: GoalFlow 纯前端工程桥接：改 app.js/存储/今日池/删除级联/容量口径时使用。约束 newNode、setNodeDeadline、purge*、confirmModal、?v= bump 与四层测试。
when_to_use: 实现功能、修 Bug、动 localStorage schema、改今日执行或项目生命周期时。
disable-model-invocation: false
---

# GoalFlow · 工程桥接

## 先读

1. [`AGENTS.md`](../../../AGENTS.md)  
2. [`openmemory.md`](../../../openmemory.md) 相关 Components / Patterns  
3. [`.cursor/rules/00-project-core.mdc`](../../rules/00-project-core.mdc)  
4. 动 UI 时再读 [`10-frontend.mdc`](../../rules/10-frontend.mdc) + [`docs/DESIGN-SYSTEM.md`](../../../docs/DESIGN-SYSTEM.md)

## 硬约束

| 主题 | 要求 |
|------|------|
| 新节点 | 一律 `newNode(partial)`，设 `source` |
| 期限 | 只经 `setNodeDeadline` |
| 删除/整树替换 | `purgeNodeRefs` / `purgeWorkflowRefs` / `purgeCurrentTreeRefs` + undo 备份 |
| 确认 | `confirmModal`，不用原生 confirm 当唯一路径 |
| 弹窗 | 优先 `buildModalHtml` + `openModalMask` |
| 容量 | 全局 vs 单项目分子分母同口径；`dayCap`/`weekCap`/`dayCapGlobal` |
| 排期 | `planDate`≠`deadlineDate`；今日池排除条款放最前并注释 |
| 版本 | bump `index.html` 全部 `?v=` |
| 并行会话 | 改前 Read/Grep；勿回滚他人更高版本文件 |

## 实现顺序

1. 定位现有函数（Grep），读调用方  
2. 最小 diff；共享逻辑一处修  
3. 选测试层：纯计算 → `scripts/tests/unit/`；旅程 → `flow/`；版本修复 → `smoke-v*`；结构 → `verify-v*`  
4. 跑：

```powershell
node --check assets/js/app.js
node scripts/checks/run.cjs
node scripts/tests/run.cjs
```

5. 更新 `openmemory.md`；同步 `docs/TEST-CASES.md`（若新覆盖）

## 禁止

- 引入构建链/框架作为主路径  
- 把推断需求写成已定产品规则（用例用 `@goalflow-test-case-generator` 标待确认）  
- 静默吞错；拆掉 `afterChange`/`renderViewGroup` 容错  
- 存储 secrets 进仓或 OpenMemory  

## 相关

- 场景流程：`docs/dev/agent-scenario-workflows.md`  
- 测试约定：`docs/TESTING.md`  
