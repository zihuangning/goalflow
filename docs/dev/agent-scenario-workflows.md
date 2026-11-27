# Agent 场景工作流（GoalFlow）

> 改编自 wechat_fitness `docs/dev/agent-scenario-workflows.md`。  
> **栈**：纯前端 SPA · **Skill 索引**：[`project-skills-guide.md`](./project-skills-guide.md) · **权威**：[`AGENTS.md`](../../AGENTS.md) → `00-project-core.mdc` → preflight

规则（`.cursor/rules/*.mdc`）始终生效；Skill 需 `@名` 触发。

---

## 0. 改代码共通底座

### 0.1 冲突裁决（高 → 低）

`docs/preflight/goalflow.md` → `00-project-core.mdc` → `10-frontend.mdc`（命中 UI 时）→ `AGENTS.md` / `openmemory.md` → on-demand skills

### 0.2 始终遵守

| 规则 | 作用 |
|------|------|
| `openmemory.mdc` | 改码前检索 + 读索引；结束后更新 |
| `00-project-core.mdc` | 栈边界、验证命令、版本 bump、工厂/级联 |
| `10-frontend.mdc` | 设计系统、弹窗、移动端（改 UI 时） |

### 0.3 改码三阶段

1. **前**：读 `openmemory.md` + 相关函数；2+ 次记忆检索（MCP 可用时）  
2. **中**：新建/写函数/决策/报错前再检索模式  
3. **后**：跑验证；更新 `openmemory.md`；非 trivial 记 Patterns  

### 0.4 默认验证

```powershell
node --check assets/js/app.js
node scripts/checks/run.cjs
node scripts/tests/run.cjs
# 发版/大改：
node scripts/tests/run.cjs --with-checks
```

### 0.5 提交前可选

- `.cursor/hooks/RULES_CHECKLIST.md`（关键词：`前端检查` / `测试检查`）  
- `@goalflow-test-case-generator` 用例评审  
- 本机 `/review` 或 `@chinese-code-review`（若已装）  

---

## 1. 新功能

### 1.1 大功能（跨视图 / 新 meta 字段 / 多模块）

走 [`six-stage-workflow.md`](../preflight/six-stage-workflow.md)。

| 步骤 | 动作 |
|------|------|
| 边界 | 读 preflight；确认不做清单 |
| 规格 | what/why + 失败态 |
| 方案 | 列出函数、存储键、测试层 |
| 实现 | `@goalflow-engineering` |
| 用例 | `@goalflow-test-case-generator` → 人审后再写 unit/flow/verify |
| 验证 | `--with-checks` + bump `?v=` |

**示例**：「基础设置每周天数×每天小时，超支警告」

1. Preflight：本地 capacity 存 `meta.capacity`，无云端  
2. 方案：`dayCap`/`weekCap`/`warnIfOverCapacity`；今日条 + 设置弹窗  
3. 接线：doParse / 规划向导 / insertChildren  
4. 测试：unit 容量计算 + verify 结构 + 手动打开设置  

### 1.2 小功能（单函数、无 schema）

1. `@goalflow-engineering` + 读同类实现  
2. 补一层测试  
3. bump `?v=` + `checks/run.cjs`  

---

## 2. 修 Bug

| 步骤 | 动作 |
|------|------|
| 1 | 复现（浏览器或写红测试） |
| 2 | 查 `openmemory.md` Patterns 是否已知坑 |
| 3 | 根因在一处修；grep 所有 caller |
| 4 | 最小 diff + 复现测试变绿 |
| 5 | 行为变更 → 重定向旧 verify 断言 |

**高频根因清单**（本仓）：原生 confirm 被吞；删除未级联；全局/单项目口径错配；`planDate` 与 `deadlineDate` 语义混用；渲染单点抛错中断整组；跨午夜 `TODAY` 未刷。

---

## 3. 测试

### 3.1 四层（真源 `docs/TESTING.md`）

| 层 | 何时 |
|----|------|
| verify | 结构/关键调用点防误删 |
| smoke | 版本修复场景实跑 |
| unit | 纯函数（require app.js） |
| flow | 跨函数用户旅程 |

### 3.2 用例设计门

1. `@goalflow-test-case-generator` 出表（**需求依据 / 待确认**）  
2. 人审  
3. 再改 `TEST-CASES.md` 与自动化套件  

### 3.3 手工 / 浏览器

- 渲染层、真实 LLM、Notification 权限：手工 + smoke 兜底  
- 可选本机 `/qa`；勿另建平行驾驶舱  

---

## 4. UI / 视觉

1. 读 `docs/DESIGN-SYSTEM.md` + `10-frontend.mdc`  
2. App 内改动走现有 token/`gf-`；`demos/` 可用 `@hallmark` / `@frontend-design` 做实验室  
3. 移动端触控与溢出规则见 frontend 规则  

---

## 5. 闭环出口

| 出口 | 真源 |
|------|------|
| 范围可读 | preflight + 任务说明 |
| 用例可审 | `@goalflow-test-case-generator` |
| 实现可验 | `scripts/tests` + `scripts/checks` |
| 交付可签 | `?v=` 同步 + `--with-checks` 绿 |
| 知识可传 | `openmemory.md` 更新 |

**勿整包引入**第二套 Spec/测试平台索引；思想对齐即可（见 project-skills-guide §闭环）。
