---
name: goalflow-test-case-generator
description: 根据需求/页面/函数描述生成可评审测试用例（正常、异常、边界、数据安全四类）；每条标注需求依据与「明确/待确认」。当用户提到「生成测试用例」「测试覆盖」「用例评审」「补矩阵」时使用。
when_to_use: 功能测试/回归设计阶段；输出供人工评审，再决定是否写入 docs/TEST-CASES.md 或 scripts/tests|checks。
disable-model-invocation: false
---

# GoalFlow · 测试用例生成

改编自知行 `@zhixing-test-case-generator`：去掉 App/Go/权限矩阵，改为 **本地 SPA + 四层测试** 对齐。

## 角色

资深测试工程师；输出**可评审**用例表，与 [`docs/TESTING.md`](../../../docs/TESTING.md) / [`docs/TEST-CASES.md`](../../../docs/TEST-CASES.md) 对齐。

## 与脑图 Skill 分工

- **`@prd-to-xmind-testcases`**（若本机已装）：PRD → XMind Markdown 大纲  
- **本 Skill**：可评审表格（需求依据 / 待确认 / P0–P2）→ 评审后再写 unit/flow/smoke/verify  

## 与四层测试的关系

| 层 | 真源 | 本 Skill 标注 |
|----|------|----------------|
| 人工评审 | 本表 | 通过后可选写入 TEST-CASES |
| unit | `scripts/tests/unit/` | `automation: unit` |
| flow | `scripts/tests/flow/` | `automation: flow` |
| smoke/verify | `scripts/checks/` | `automation: smoke` / `verify` |
| 手工 | 浏览器渲染 / LLM / Notification | `automation: manual-only` |

## 硬规则

1. **四类场景**：正常、异常、边界、**数据安全**（误删、级联孤儿、备份恢复、容量错配、跨天串桶）。无账号体系时「权限」改为数据安全/隔离。  
2. **每条字段**：编号、测试场景、**需求依据**、**依据置信度**（`明确`|`待确认`）、前置条件、测试步骤、预期结果、优先级（P0–P2）、自动化建议。  
3. **需求追溯**：指向 `PRODUCT-FLOW` / specs / `openmemory` Patterns / 具体函数路径；无出处标 `待确认`，预期写「待产品确认：…」。  
4. **编号**：`GF-{模块}-{TYPE}-{序号}`，例 `GF-TODAY-NORMAL-001`、`GF-CAP-BOUND-002`。TYPE=`NORMAL|ERROR|BOUND|DATA`。  
5. **异常至少含**：空输入、非法日期/时长、重复操作、WebView 吞 confirm、localStorage 缺失/损坏兜底（若相关）。  
6. **输出**：仅用 `references/test-case-template.md` 表格；回复末列出 **待确认** 条数。  
7. **禁止**生成后直接改 CSV/代码套件（须用户确认）。

## 执行顺序

1. 读需求；Grep 相关实现  
2. 查 `docs/TEST-CASES.md` 是否已有行  
3. 读 `references/goalflow-domain-rules.md` + `references/scoring-checklist.md`  
4. 按模板出表；数据安全单独小节  
5. 自检评分 ≥80 再交付  

## 触发示例

- 「今日池预算截断，生成评审用例」  
- 「删除项目级联，补 DATA 类用例」  
- 「周预算全局口径，对齐 TEST-CASES」  

## 参考

- `references/test-case-template.md`  
- `references/goalflow-domain-rules.md`  
- `references/scoring-checklist.md`  
