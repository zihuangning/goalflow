# GoalFlow（目标流）

## Overview
单文件纯前端工具（`index.html`）：年度目标树 → 桑基精力图 → 算法选出「当下最重要」→ 四象限校准。数据仅存浏览器 localStorage，可选 DeepSeek 拆解。

**project_id:** zihuangning/goalflow

## Architecture
- **入口:** `index.html` + `assets/css/main.css` + `assets/js/{gf-tokens,gf-demos,app}.js`
- **设计系统:** `gf-` 前缀组件；`docs/DESIGN-SYSTEM.md`
- **状态:** `state.workflows[]` **项目**（目标流）：`id/name/tags[]/startDate/endDate/description/color + nodes/topId`；`state.activeWorkflowId`；`state.nodes` 为当前流镜像；`state.meta` 周回顾等
- **持久化:** `goalfocus.workflows.v2`（全部项目含元信息；自动迁移 v1 与单树）；`goalfocus.v4`（当前流节点兼容）；`goalfocus.meta.v1`
- **核心算法:** `parseText` → `focusScore` / `pickRanked` → `buildView` + `sankeyLayout`
- **测试钩子:** `module.exports` 导出纯函数

## User Defined Namespaces
- （留空）

## Components
| 区域 | 作用 |
|------|------|
| 今日行动 `#todayPanel` | **跨工作流**汇总 MIT/时段/微习惯/清单；叶子 `remindAt` 桌面提醒、行内预估时长；`#todayAlarmBar` |
| 多项目 `#wfBar` | 切换/＋新建/**✎ 项目设置**（名称、标签、起止日期、备注、删除）；树维护与解析仅作用于当前项目；`#workflowMetaModal` |
| 英雄卡 + 执行栈 | Top1 + #2/#3 候选 |
| 精力流向图 | 年/月/周/日缩放、聚焦模式 |
| 四象限 + V/E 矩阵 | 拖拽校准；价值/费力；⚡快速赢筛选；叶子：时段、微动作、SMART |
| 精力图多视角 | `viewMode`: 桑基/关系/看板/脑图/365热力 |
| 回顾 v5.3 | `openReview` 周·月·季 + OKR 进度块 |
| 度量 | `role` O/KR/习惯 · `targetNum`/`targetDone` · pace line · `metricsStrip` |
| 番茄钟 | 英雄卡 🍅 25′ 绑定 Top1 · `#pomoBar` |
| 树形维护 | 内联编辑、估时、同步到文本框 |
| Backlog 泳道 | 聚焦清单：上周未完成 / 下月预告（不进 Top3） |
| ICS 导出 | 仅 `deadlineDate` 叶子，顶栏本地下载 |
| 聚焦清单 | Top3 + 立即做 / 核心投入 |
| 顶栏 | 进度、备份/恢复、周回顾 |

## Visual (v5.1 · app shell + 主题×明暗)
- 布局：参考 demos/01-linear — `.app-shell` = 52px 图标轨 `.rail`（logo/锚点/周回顾◔/demos 链接）+ 230px 侧栏 `.side`（工作流 1-4 锚点、目标树 `#sideTree`+`#sideProg`）+ 主区 `.main`（顶栏含 `.topbar-theme` = `#themeSelect`+`#modeToggle` ☾/☀，+ `.main-scroll`）；`body{overflow:hidden}` 仅主区滚动；≤900px 隐藏 rail/side
- 主题机制（双维度）：`<html data-theme data-mode>`；存储 `goalflow.theme` + `goalflow.mode`；`tokens.css` `:root`=linear dark，`[data-theme]`=各主题 dark，`[data-theme][data-mode='light']`=各主题 light；`gf-tokens.js` `THEMES[t].dark/.light` 双套色板摊平到顶层（app.js 零感知）；head bootstrap 防闪烁写两个 attr；app.js 绑定带旧缓存兜底；资源引用带 `?v=` 版本串破缓存（inline-bundle.mjs 正则已兼容）
- 视觉：实体面板 `#131417`+1px 边、iris `#5e6ad2`、金 `#e8b84a`（light 下 `#d4a017`）；Inter + JetBrains Mono；步骤 1-4 `.idx` iris 描边徽章；英雄卡 2px 金左边线；zoombar 选中白底黑字
- 进入：body `.is-ready` 淡入；尊重 `prefers-reduced-motion`

## Visual Demos (`demos/`)
- **索引:** `demos/index.html` — 十套独立 HTML 风格实验室 v2（仅壳层 + 内联 SVG 桑基 mock，无业务逻辑）
- **v2 方向（参考真实产品）:** 01 Linear 深色工作台 / 02 Things Mac 纯净 / 03 Notion 文档 / 04 Sunsama 日计划 / 05 Stripe 落地页 / 06 Raycast 命令面板 / 07 Amie 日历时间块 / 08 Kinfolk 杂志 / 09 Vercel bento / 10 RPG 游戏化
- **教训:** 用户否掉 v1「风格实验」方向（太丑），要求参考成熟个人管理产品的真实布局；文件名语义化（`NN-产品名.html`）

## Patterns
- **示例主题库:** `assets/js/gf-demos.js` → `GoalFlowDemos.list`（10 条）；`#demoSelect` +「载入示例」调用 `loadDemo()`
- 叶子任务优先进入 `pickRanked`；进度 rollup 见 `docs/PROGRESS-ROLLUP.md`
- 节点字段：`val`/`eff`/`recur`/`doneAt`（v4.2）
- 例行任务在无期限时按尺度展开到节奏条 + 日 slot
- 微动作子节点默认 `scale: day`、可选 `slot`（h0–h6）
- 节点字段补充：`remindAt`（今日提醒时间戳）
- 备份 JSON v8：`{ workflows, activeWorkflowId, nodes, meta }`（v7 仅单树可导入）