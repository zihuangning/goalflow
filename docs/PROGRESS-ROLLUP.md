# GoalFlow 进度 Rollup 规则

GoalFlow 采用与业界常见任务树一致的约定：**只有叶子节点（`parentId` 存在且无子节点）计入完成进度**；分支/父节点上的勾选不参与顶栏百分比。

## 定义

| 概念 | 判定 |
|------|------|
| **叶子** | `parentId` 非空，且 `_children.length === 0` |
| **全树叶子进度** | `leafProgress()` → `done / total`（顶栏「叶子 xx%」） |
| **子树叶子进度** | `subtreeProgress(node)` → 以该节点为根的子树内叶子完成比（英雄卡「子树 xx%」） |

## 不计入项

- 根节点（年度总目标）
- 任意有子节点的中间层
- 被「聚焦模式」隐藏、但仍在树中的节点：**仍计入**叶子统计（统计基于完整 `state.nodes`，与桑基图过滤无关）

## 完成时间戳

- 勾选完成叶子时写入 `doneAt`（毫秒时间戳）
- 取消完成时清空 `doneAt`
- **周回顾「本周完成」**仅统计：`done === true` 且 `doneAt` 落在本周一 0:00 ~ 下周一 0:00 的叶子
- 历史数据中已勾选但无 `doneAt` 的项：不计入「本周完成」，重新勾选会补记时间戳

## 与 Value / Effort 的关系

快速赢（价值 ≥ 4、费力 ≤ 2）用于筛选与周回顾叙述，**不改变** rollup 分母（仍为全部叶子）。

## 时长字段（v4.3）

- `estimateMinutes` / `actualMinutes` 仅用于日容量与周回顾「预估 vs 实计」，**不参与**叶子完成百分比。
- 叶子默认预估 30 分钟（可在树形维护中改）；文案中的「30分钟 / 1小时」会在解析时写入预估。

## 实现位置

- `assets/js/app.js`：`leafProgress`、`subtreeProgress`、`setNodeDone`、`computeWeekStats`