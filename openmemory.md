# GoalFlow（目标流）

## Overview
单文件纯前端工具（`index.html`）：年度目标树 → 桑基精力图 → 算法选出「当下最重要」→ 四象限校准。数据仅存浏览器 localStorage，可选 DeepSeek 拆解。

**project_id:** zihuangning/goalflow

## Architecture
- **入口:** `index.html` + `assets/css/main.css` + `assets/js/{gf-tokens,gf-demos,app}.js`
- **设计系统:** `gf-` 前缀组件；`docs/DESIGN-SYSTEM.md`
- **状态:** `state.workflows[]` **项目**（目标流）：`id/name/tags[]/startDate/endDate/description/color + nodes/topId`；`state.activeWorkflowId`；`state.nodes` 为当前流镜像；`state.meta` 周回顾等
- **持久化:** `goalfocus.workflows.v2` 主键 + `goalfocus.workflows.bak` 镜像（每次 save 双写）；加载顺序 v2→bak→v1→单树；`console` 有诊断（`goalflowStorageReport()`）；`beforeunload` 兜底保存；`meta.lastSavedAt` 显示于侧栏 `#wsStore`；`goalfocus.meta.v1`（回顾/执行/评分）
- **核心算法:** `parseText` → `focusScore` / `pickRanked` → `buildView` + `sankeyLayout`
- **测试钩子:** `module.exports` 导出纯函数

## User Defined Namespaces
- （留空）

## Components
**三视图 v6.0（`switchView`）**：`.main-scroll` 内三个 `section.view`（单显 `.on`）——`#view-today`（默认主页：hero-wrap+metricsStrip+pomoBar → `#todayPanel` → `#focusPanel`）、`#view-plan`（panelInput/panelTree/panelSmart 纵向堆叠）、`#view-insights`（canvasPanel/quadPanel）；rail+侧栏用 `[data-nav]` 按钮切换（`VIEWS` 映射 crumb）；记忆 `localStorage goalflow.view`；深链 `#/today|plan|insights`，旧 `#day` 等尺度深链设 scale 并跳 insights；切到 insights 时 rAF 重绘 `renderCanvas/renderQuadrant`；侧栏增「仪式」组（sideMorning/sideEvening/sideWeekPlan/sideWeekReview）；双列 `.wrap` grid 已废弃

| 区域 | 作用 |
|------|------|
| 今日行动 `#todayPanel` | **跨工作流**汇总 MIT/时段/微习惯/清单；叶子 `remindAt` 桌面提醒、行内预估时长；`#todayAlarmBar` |
| 多项目 `#wfBar` | **手风琴列表**（v6.2）：独立区块（非 side-ws 内），可多展开；展开 = 项目本地概览（标签/时间段/叶子进度条/树预览/今日待办数），不含视图链接——视图归下方「视图」导航（项目选哪个目标，视图选怎么看）；✎ 设置；＋新建；底部 **项目关系**（共享标签 × 时间段重叠）；展开状态存 `meta.wfExpanded` |
| 英雄卡 + 执行栈 | Top1 + #2/#3 候选 |
| 精力流向图 | 年/月/周/日缩放、聚焦模式 |
| 四象限 + V/E 矩阵 | 拖拽校准；价值/费力；⚡快速赢筛选；叶子：时段、微动作、SMART |
| 精力图多视角 | `viewMode`: 桑基/关系/看板/脑图/365热力 |
| 回顾 v5.3 | `openReview` 周·月·季 + OKR 进度块 |
| 度量 | `role` O/KR/习惯 · `targetNum`/`targetDone` · pace line · `metricsStrip` |
| 番茄钟 v5.4 | 英雄卡 🍅 25′ 绑定 Top1 · `#pomoBar` 进度条+% · `#pomoTopLine` 顶部金线（body.focus-timer-on） |
| 自动评分 | `scoreDoneItem`/`scorePomoItem` → `meta.scoreLog[dk]`；`todayScore()` 汇总；`#todayScore` 总评分块（S/A/B/C，日目标 100） |
| 早晚仪式闹钟 | `meta.ritual{morning,evening,on}`；`tickRitualAlarms` 30s 检查到点弹 `#ritualModal`（晨=MIT+容量+调整入口，晚=逐项得分+未完成+dayNotes 总结）；`#todayAlarmBar` 时间设置+手动打开 |
| 时间审计 v5.5 | `timeAudit(7)` 聚合 executionLog → `#todayAudit`（按工作流/象限 bars）；估/实偏差 `bias=pairAct/pairEst`；`applyCalibratedBuffer` 一键缓冲今日预估 |
| 回顾→Act | ritual 模板 `next` 字段 → `meta.pendingActions[]`；晨计划「采纳」`adoptPendingAction` 插入当前流根（scale=day）/「跳过」 |
| WOOP 执行意图 | 叶子 `ifThen` 字段（序列化 v5.5+）；今日行 🛡 行内编辑；晨计划 MIT 缺预案时提示补全 |
| 周计划仪式 | `meta.weekPlans[wk].rocks[]`；`openWeekPlan` 候选=跨流 im≥4 叶子 top12 选≤5；`#todayRocks` 石头条可勾完成；周一晨自动弹（`weekplan\|wk`） |
| 停滞预警 v5.6 | `stagnationAlerts(7)`：`stagnantDays`=今−(touchedAt\|\|createdAt)，双 null=999；跨流 im≥4 叶 → `#todayStale` 条+晨计划区；「⚡激活到今日」`activateStale` |
| 事前验尸 | 根节点 `premortem`；`#premortemCard`（SMART 面板顶，`renderSmart` 调用）存档/重审 |
| 精力曲线 | `meta.energyLog{dk:{am,pm,eve}}` 3 桶（5-12/12-18/其余）；`#todayEnergy` 五级打卡；近 14 天 `energyCurve()` → 高峰桶映射 DAY_SLOTS 建议重任务排程 |
| 树形维护 | 内联编辑、估时、同步到文本框 |
| Backlog 泳道 | 聚焦清单：上周未完成 / 下月预告（不进 Top3） |
| ICS 导出 | 仅 `deadlineDate` 叶子，顶栏本地下载 |
| 聚焦清单 | Top3 + 立即做 / 核心投入 |
| 顶栏 | 进度、备份/恢复、周回顾 |

## Visual (v6.0 · app shell + 三视图导航 + 主题×明暗)
- 布局：参考 demos/01-linear — `.app-shell` = 52px 图标轨 `.rail`（logo/☀今日·🎯规划·📊洞察 [data-nav]/周回顾◔/demos 链接）+ 230px 侧栏 `.side`（「视图」3 项 [data-nav] +「仪式」4 项 + 目标树 `#sideTree`+`#sideProg`）+ 主区 `.main`（顶栏含 `.topbar-theme` = `#themeSelect`+`#modeToggle` ☾/☀，+ `.main-scroll`）；`body{overflow:hidden}` 仅主区滚动；≤900px 隐藏 rail/side；选中态 `.ric.on`/`.si.on`
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
- meta 字段：`scoreLog{dk:{entries[{kind,nodeId,score,reason}]}}`、`dayNotes{dk:str}`、`ritual{morning,evening,on}`；取消勾选回滚当日 done 分（`removeTodayScore`）
- meta 字段 v5.5：`pendingActions[{id,text,fromCycle,period,status}]`、`weekPlans{wk:{rocks[{wfId,nodeId,text}]}}`；executionLog entries 增 `im/ur`（审计象限分布用）；节点字段增 `ifThen`（WOOP）
- v5.6：节点增 `createdAt`（新解析起）与 `premortem`；meta 增 `energyLog`；新节点字面量三处需同步（parseText/insertChildren/adoptPendingAction）
- v6.0 视图拆分：`scrollToToday()`=转发 `switchView('today')`；视图切换时 main-scroll 回顶 + `history.replaceState('#/'+name)`；隐藏视图内 SVG 布局无常量外尺寸依赖（sankey 用固定 layout），但切回 insights 仍 rAF 重绘保险
- 备份 JSON v9：`{ workflows, activeWorkflowId, nodes, meta }`（v7 仅单树可导入）
- **执行闭环（v5.7）**：`meta.executionLog[dateKey]` 每日勾选日志（含 wfId/估/实/习惯）；`meta.habitStreaks[wf|nodeId]` 习惯连续；周回顾草稿自动带「执行/偏差反馈」；度量条近 7 天动量 + 估/实
- 今日行动行内：**时段下拉** 钉 `slot`（When）、`🔥 streak` 习惯连续天数