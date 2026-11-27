# GoalFlow Agent Guide

**目标流（GoalFlow）** — 纯前端单页应用：年度目标树 → 桑基精力图 → 算法选出「当下最重要」→ 今日执行闭环。数据仅存浏览器 `localStorage`，无账号、无云端、无构建。

> **栈边界**：`index.html` + `assets/css/**` + `assets/js/{gf-tokens,gf-demos,gf-model,gf-ui,app}.js`（顺序见 `scripts/app-scripts.cjs`）。禁止引入 React/Vue/打包器作为主路径。文档冲突时以 **本文件 + `docs/preflight/goalflow.md` + `.cursor/rules/00-project-core.mdc`** 为准。

## 快速入口

| 文档 | 用途 |
|------|------|
| [`docs/preflight/goalflow.md`](docs/preflight/goalflow.md) | 产品边界、不做清单、发版门禁 |
| [`docs/preflight/six-stage-workflow.md`](docs/preflight/six-stage-workflow.md) | 从想法到发布的六阶段 |
| [`docs/dev/agent-scenario-workflows.md`](docs/dev/agent-scenario-workflows.md) | 新功能 / Bug / 测试 / UI 场景流程 |
| [`docs/dev/project-skills-guide.md`](docs/dev/project-skills-guide.md) | Skill 索引与闭环出口 |
| [`docs/TESTING.md`](docs/TESTING.md) | 四层测试体系 |
| [`docs/TEST-CASES.md`](docs/TEST-CASES.md) | 覆盖矩阵 |
| [`docs/PRODUCT-FLOW.md`](docs/PRODUCT-FLOW.md) | 产品全景 |
| [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | `gf-` 设计系统 |
| [`openmemory.md`](openmemory.md) | 项目活索引（改码必读/必更） |

## 推荐流程（大功能）

对齐知行仓「六阶段」，去掉上架商店，换成 **版本 bump + 备份提醒**：

1. **Preflight** — 读 `docs/preflight/goalflow.md`（边界、存储键、不做清单）
2. **Specify** — 写清 what/why（可落 `docs/superpowers/specs/` 或对话确认）
3. **Plan / Tasks** — 技术切点、影响函数、要写哪层测试
4. **Implement** — 最小 diff；新节点走 `newNode()`；弹窗走 `buildModalHtml`/`openModalMask`
5. **用例评审** — `@goalflow-test-case-generator`（含 **需求依据 / 待确认**）
6. **Verify** — `node scripts/tests/run.cjs --with-checks`；改静态资源 bump `?v=`
7. **Retro** — 更新 `openmemory.md` / `TEST-CASES.md`；必要时补 verify/smoke

小改动可跳过 2–3，直接实现 + 对应层测试。

## gstack（本机全局，可选）

安装于 `~/.cursor/skills/gstack`（或本机 Cursor skills）。网页浏览优先 `/browse`。

| 阶段 | Skills |
|------|--------|
| Think | `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review` |
| Build | `/autoplan`, `/investigate` |
| Review | `/review`, `/cso`, `/design-review` |
| Test | `/qa`, `/qa-only` |
| Ship | `/ship`, `/retro` |

## 项目硬约束（摘要）

- **纯本地**：禁止默认要求账号/云同步/服务端权威状态
- **版本串**：改 `assets/**` 或 `index.html` 引用资源时，**六处** `?v=`（css + 五 script）必须同步 bump
- **节点工厂**：所有新节点走 `newNode(partial)`，禁止散落字面量漏字段
- **期限唯一写入口**：`deadline/deadlineDate/daysLeft/overdue/deadlineText` 只经 `setNodeDeadline`
- **删除级联**：删节点/项目/整树替换必须走 `purgeNodeRefs` / `purgeWorkflowRefs` / `purgeCurrentTreeRefs`
- **确认框**：用户确认用 `confirmModal`，禁止依赖原生 `confirm()`（WebView 会吞）
- **测试**：逻辑变更至少落一层（unit / flow / smoke / verify）；改 bug 先复现测试再修
- **OpenMemory**：`project_id: zihuangning/goalflow`；改码遵循三阶段（搜 → 做 → 存）；MCP 不可用时只维护 `openmemory.md`

## 默认验证命令

```powershell
node --check assets/js/app.js
node scripts/checks/run.cjs
node scripts/tests/run.cjs
node scripts/tests/run.cjs --with-checks   # 发版/大改前
```

## 文本编码

源文件与文档：**UTF-8 无 BOM**。Windows PowerShell 读写含中文的脚本/报告时注意控制台编码，勿用默认 ANSI 覆盖文件。

## Skill 桥接

| 场景 | 用 |
|------|-----|
| 改业务逻辑 / 今日池 / 存储 | `@goalflow-engineering` |
| 生成可评审用例 | `@goalflow-test-case-generator` |
| PRD → 脑图大纲 | 本机 `@prd-to-xmind-testcases`（若已装） |
| UI / demo 视觉 | `docs/DESIGN-SYSTEM.md` + 用户前端设计规则；HTML demo 可 `@hallmark` / `@frontend-design` |
| 质量门禁设计 | 本机 `@ai-quality-governance`（若已装） |

完整对照与「勿整包引入平行流程」见 [`docs/dev/project-skills-guide.md`](docs/dev/project-skills-guide.md)。
