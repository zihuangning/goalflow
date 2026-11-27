# Rules checklist（关键词触发）

本仓库不在每次改文件时自动注入 Gate。对话里输入关键词即可触发对照检查：

| 关键词 | 触发内容 |
|--------|----------|
| `前端检查` / `UI检查` / `设计检查` | 对照 `10-frontend.mdc` + `docs/DESIGN-SYSTEM.md`：`gf-` 组件、token、弹窗壳、`?v=`、移动端触控 |
| `测试检查` / `回归检查` | 对照 `docs/TESTING.md`：是否补 unit/flow/smoke/verify；`TEST-CASES.md` 是否需同步；跑 `node scripts/tests/run.cjs` 或 `--with-checks` |
| `核心检查` / `工程检查` | 对照 `00-project-core.mdc`：`newNode` / `setNodeDeadline` / `purge*` / `confirmModal` / 无 secrets |

## 前端

1. 读 `.cursor/rules/10-frontend.mdc`  
2. 新 UI 走 `gf-btn` / modal helper；关闭钮可点  
3. 确认 `index.html` 四处 `?v=` 同号  

## 测试

1. 读 `docs/TESTING.md`  
2. 逻辑变更至少一层自动化；bug 先红后绿  
3. 给出真实命令输出证据（或说明未跑原因）  

## 工程

1. 读 `.cursor/rules/00-project-core.mdc`  
2. 删除/整树路径是否级联；容量口径是否全局一致  
3. 更新 `openmemory.md`（非 trivial）  
