# GoalFlow · 项目 Skill 用法指南

> 改编自 wechat_fitness `docs/dev/project-skills-guide.md`：只保留与本仓栈匹配的入口；Flutter/Go/商店技能标为「勿用」。  
> 真源：`.cursor/skills/*/SKILL.md` · 摘要 [`AGENTS.md`](../../AGENTS.md)  
> 场景流程：[`agent-scenario-workflows.md`](./agent-scenario-workflows.md)

Skill **不会**自动全量加载，需 `@skill名` 或关键词触发。规则 `.cursor/rules/*.mdc` 始终生效。

---

## 0. 文档权威

冲突时：**preflight `goalflow.md`** → **`00-project-core.mdc`** → **`AGENTS.md` / `openmemory.md`** → 本指南 → 单个 Skill。

| 任务 | 先读 |
|------|------|
| 改业务 / 存储 / 今日池 | `@goalflow-engineering` + `openmemory.md` |
| 改 UI / CSS / 弹窗 | `10-frontend.mdc` + `docs/DESIGN-SYSTEM.md` |
| 测 / 补覆盖 | `docs/TESTING.md` + `@goalflow-test-case-generator` |
| 勿误用 | Flutter/Go/Firebase/uni-app 全套；第二套 QA 驾驶舱 |

---

## 1. 怎么用 Skill

| 方式 | 示例 |
|------|------|
| **@ 引用** | `@goalflow-engineering 修周预算口径错配` |
| **斜杠** | gstack `/review` `/qa`（本机已装时） |
| **规则** | `.cursor/rules/*.mdc` |

---

## 2. 桥接入口（本仓）

| Skill | 何时 | 路径 |
|-------|------|------|
| **`goalflow-engineering`** | 改 `assets/js/app.js`、存储、算法、今日执行 | `.cursor/skills/goalflow-engineering/` |
| **`goalflow-test-case-generator`** | 生成可评审用例表 | `.cursor/skills/goalflow-test-case-generator/` |
| **规则 `00-project-core`** | 每条对话 | `.cursor/rules/00-project-core.mdc` |
| **规则 `10-frontend`** | 改 HTML/CSS/渲染 | `.cursor/rules/10-frontend.mdc` |

---

## 3. 测试与质量

| Skill / 文档 | 用途 |
|--------------|------|
| `@goalflow-test-case-generator` | 正常/异常/边界/数据安全；**需求依据** + **待确认** |
| 本机 `@prd-to-xmind-testcases` | PRD → XMind Markdown 大纲（可选） |
| 本机 `@ai-quality-governance` | 大 diff 影响面与测试分层（可选） |
| `docs/TESTING.md` | 四层命令与约定 |
| `docs/TEST-CASES.md` | 覆盖矩阵 |

自动化真源：**`node scripts/tests/run.cjs`** / **`node scripts/checks/run.cjs`**，不另部署平台。

---

## 4. UI / 设计（可选本机 Skill）

| Skill | 本仓用法 |
|-------|----------|
| `@hallmark` / `@frontend-design` | **仅** `demos/` 或营销 HTML；App 内先映射到 `gf-` token |
| `@bmad-ux` | 信息架构评审；真源仍是 `PRODUCT-FLOW` + 现有三视图 |
| 用户前端设计规则 | 落地页/品牌页；App shell 保持 Linear 工作台气质 |

---

## 5. gstack（本机全局）

Think → Build → Review → Test → Ship/Retro。脚本级验证仍以本仓 node 命令为准。

---

## 6. 闭环出口（默认）

| 出口 | 做什么 |
|------|--------|
| 范围可读 | Preflight / 任务能答「改哪、不改哪」 |
| 用例可审 | 用例表明确 vs 待确认分开 |
| 实现可验 | `tests` + `checks` 绿 |
| 交付可签 | `?v=` 同步 |
| 知识可传 | 更新 `openmemory.md` |

### 外部方法论 vs 本仓

| 外部叙事 | 结论 |
|----------|------|
| vibe-coding「功法」整包 | **勿再装平行索引**；用本指南 + AGENTS |
| 统一测试驾驶舱 Web | **不部署**；用 scripts + TEST-CASES |
| 知行 Flutter/Go skills | **勿用**于本仓实现路径 |

---

## 7. 维护

| 项 | 路径 |
|----|------|
| 本指南 | 本文件 |
| Agent 入口 | `AGENTS.md` |
| 场景流程 | `agent-scenario-workflows.md` |
| 新增 skill | 在 §2/§3 补一行，并链到 AGENTS |

更新原则：只记录**本仓会用到的**；栈外 skill 写在「勿用」一行即可。
