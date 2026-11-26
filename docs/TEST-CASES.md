# GoalFlow 测试用例清单

用例总览：模块 × 覆盖层。生成于 2026-11-25（测试基建落地），随套件增删手动同步。
运行方式见 [TESTING.md](TESTING.md)。

**总量**：tests 14 套件 317 例（unit 242 + flow 75）+ checks 20 环节 493 项 = **810 项断言**。

## 覆盖矩阵

| 模块 | 关键行为 | unit | flow | smoke | verify |
|---|---|---|---|---|---|
| 期限解析 `parseDeadline` | 今天/明天/后天、YYYY-MM-DD、X月X日跨年回落、下周三=下自然周、N天后、两周内、第N周锚点、逾期、无期限 | ✅ 15 例 | | | |
| 尺度/重复/估时推断 | `inferScale` 日周月年、`inferRecur` 每天/每周N次、`parseEstimateMinutes` 小时/分钟/半天 | ✅ 11 例 | | | |
| 文本→树 `parseText` | 树形/id 序列/缩进挂父/单根收敛/分支尺度重推/空输入 | ✅ 7 例 | | ✅ v8.9 | |
| VE 价值精力 `ensureVE` | 默认/紧急≥4/「只需5分钟」/「深度重构」/clamp 1-5 | ✅ 6 例 | | | |
| 四象限 `category` | now/core/distract/noise 互斥 | ✅ 5 例 | | | |
| 树构建 `computeTree`/`treeOrder` | _children/depth/孤儿不挂/DFS 序 | ✅ 4 例 | ✅ 生命周期 | | |
| 进度 `subtreeProgress`/`metricProgress`/`paceStatus` | 50%/100%、超额 pct 封顶+pctReal、无 target、节奏结构、无期限 null | ✅ 7 例 | | | |
| 序列化 `serializeNodes` | 时间戳化/不含 daysLeft/tags 兜底 | ✅ 3 例 | | | |
| 停放谓词 | waiting/blocked/parked | ✅ 3 例 | | | |
| 焦点分 `focusScore(Parts)` | 完成 -1000/im×10/逾期+30/daysLeft 阶梯/阻塞 -60/等待 -45/长期主线加分/钉槽无数据 +0 | ✅ 13 例 | | | |
| 优先级 `pickRanked` | Top2 排序/limit=1 单对象/完成退出/阻塞退出/回落根/根完成 null | ✅ 6 例 | | | |
| 完成分 `scoreDoneItem` | 基础/期限内/逾期/时长达标三档/习惯+5 | ✅ 7 例 | | | |
| 番茄分 `scorePomoItem` | 25′=20/im5 90′=34/深潜标记/长专注标记 | ✅ 4 例 | | | |
| 等级 `scoreGrade` | S/A/B/C/— + 边界 119/79/39 | ✅ 3 例 | | | |
| 时间键 `weekKey`/`periodKey` | 周三→周一/周日同一周一/周一当天、月/季/周 | ✅ 6 例 | | | |
| 停滞 `stagnantDays` | 999/0/3 | ✅ 3 例 | | | |
| 习惯强度 `habitStrength` | 连打/封顶/samples 上限/漏打净+3%/低频 freqDecay/空记录 | ✅ 6 例 | ✅ 30 天之旅 | | |
| 精力时段 `energyBucketNow` | am/pm/eve 三桶 | ✅ 1 例 | | | |
| SMART `smartEval`/`smartQuestions` | 模糊 3gap/完整 smart=true/AI 优先 fromAI/提问必含指标+期限+拆解 | ✅ 10 例 | | | |
| 拆解建议 `decomposeSuggestions` | 读书/销售/运动/默认关键词路由 | ✅ 4 例 | | | |
| 项目生命周期 | doParse→加引用→模板整树替换清引用→deleteNode 级联+撤销→deleteWorkflow 重建→clearAll+撤销 | | ✅ 7 例 | ✅ v8.8/v8.9 | ✅ v8.8/v8.9 |
| 今日执行 | promoteNodeToToday 自动排时/撤回还原/clarifyInbox 入树/撤回/adoptPendingAction 同流刷新/跨流往返 | | ✅ 6 例 | ✅ v8.8/v8.9 | ✅ v8.8 |
| 收件箱 | captureInboxFromText 时间词→提醒/过去时间不设提醒/澄清五分支/目标流不存在容错 | | ✅ 10 例 | | |
| AI 排期回填 | 多窗口/顺排 bump/窗口满换次日/recur 补窗口/anchor 容忍 | | | ✅ v8.2 15 例 | ✅ v8.2 |
| 提醒系统 | 默认回填/换天重置/手动关不回填/三通道告警 | | ✅ 时间旅行 | | ✅ v8.3/v8.10 |
| 跨天 streak | 连续/中断/防重/取消回退 cur-1（v8.10 修复） | | ✅ 时间旅行 | | ✅ v8.10 |
| 跨天分桶 | executionLog/打卡 log/dailyCompletions 按 dk 隔离、取消只动当天桶 | | ✅ 时间旅行 | ✅ v8.10 | ✅ v8.10 |
| 期限重算 | recomputeSchedule 跨天自适应/「第2周」锚定不漂移/setNodeDeadline 五字段 | ✅ unit-schedule | | | ✅ v8.10 |
| 排期过夜 | planDate 到期转 time/未来不动/已完成不动/已有 time 不覆盖 | ✅ unit-schedule | ✅ 时间旅行 | ✅ v8.10 | ✅ v8.10 |
| 周期判定 | habitDueToday 七型/interval 锚点推算/recurringTask 当天完成不再到期 | ✅ unit-schedule | | | |
| 今日池 | planDate 排除规则/planDate=今天不排除/逾期补救/快赢未来排除 | | | ✅ v8.7 10 例 | ✅ v8.7 |
| 今日池预算 | budgetCap 截断/默认 dayCap/保底首任务/习惯不占预算/聚合层全局递减 | | ✅ 7 例 | | ✅ v8.11 |
| 时间冲突纠偏 | 两个 9:00 顺开/链式/缓冲带/出日界保持/{node} 包装/backfill 全局避让+本批纠偏 | ✅ 11 例 | ✅ 7 例 | | ✅ v8.11 |
| 仪式历史聚合 | morningPlans 打开快照/晚回顾 key 并集/周计划 committedAt 回落/回顾三存储合并/dkWeekLabel/openHistory 四 tab 入口 | ✅ 34 例 | | | ✅ v8.12 |
| 英雄卡去重 ② 次重要 | pickNextTopId 排除 MIT/done/溢出/并列取先/阻塞让位；renderHero 移除 + topId 归一 syncTop；MIT 区承接番茄时长/取消固定/得分折叠 | ✅ 14 例 | | | ✅ v8.13 |
| 今日页三连修 | metricsStrip 迁 zoneStatus/heroWrap 空闲零高度；② 行算法分可见；已完成区完成时刻+单项得分（scoreOfDoneEntry 倒序取最新/pomo 不算/脏数据安全）；❓ 帮助按钮化可点击 | ✅ 13 例 | | | ✅ v8.14 |
| 自动排时 `nextFreeTimeToday` | 跨项目占用/10 分钟缓冲/不排过去/窗口满 null | | | ✅ v8.8 | ✅ v8.8 |
| 项目删除级联 | rocks/pendingActions/tomorrowMit/planShare/capacity/habitStreaks/topWfId/番茄钟 | | ✅ 生命周期 | ✅ v8.8/v8.9 | ✅ v8.8/v8.9 |
| 节点删除级联 | 子树删除/topId/topPin/番茄钟解绑/引用备份还原 | | ✅ 生命周期 | ✅ v8.9 35 例 | ✅ v8.9 |
| 引用清理三级体系 | purgeNodeRefs/purgeCurrentTreeRefs/purgeWorkflowRefs | | ✅ 生命周期 | ✅ v8.9 | ✅ v8.9 |
| 弹窗/通知 | confirmModal/sysNotify/AI 结果弹窗/失败弹窗 | | | | ✅ v8.4-v8.8/v8.10 |
| 勾选对称回滚 | setNodeDone 取消 → executionLog/计数/习惯回滚 + 出口统一 saveMeta | | | ✅ v8.10 17 例 | ✅ v8.10 |
| 跨午夜自愈 | refreshTodayIfNeeded 换天刷 TODAY/全流 planDate 转 time/同一天不动 | | | ✅ v8.10 | ✅ v8.10 |
| 恢复后引用清理 | reconcileRefsAfterRestore 清孤儿 rocks/tomorrowMit/habitStreaks；快照/备份确认+取消路径 | | | ✅ v8.10 | ✅ v8.10 |
| 今日删除级联 | deleteTodayNode 统一走 deleteNode（跨流临时切换/根保护） | | | ✅ v8.10 | ✅ v8.10 |
| 晚总结期限 | 明天继续/改期走 setNodeDeadline 唯一写入口 | | | | ✅ v8.10 |
| 版本号一致性 | index.html 4 处 ?v= 同步 | | | | ✅ run.cjs |

## 单元测试明细（242 例）

### unit-done-score.cjs · 已完成区单项得分（13，v8.14）
scoreOfDoneEntry：命中唯一 done/多条取最新/reason 随最新/pomo 不参与/无匹配 null；dayScoreLog null/undefined/entries 非数组/空 entries 安全；entry null/缺 nodeId 安全；reason 缺省空串；null 条目跳过。

### unit-nexttop.cjs · ② 次重要（14，v8.13）
pickNextTopId：空/null/undefined 池→null、单条当选、多条取 focusScore 最高、排除 MIT 自身后取次高、排除不存在 id 不影响、done 跳过、溢出跳过（分再高不当 ②）、全 done/全溢出→null、并列取先出现者、ent 缺 node 安全、阻塞 -60 压分后让位。

### unit-schedule.cjs · 时间安排与期限族（55）
recomputeSchedule 跨天重算：相对标签「明天」恒 daysLeft=1、昨天绝对日期逾期、仅日期无标签刷新+补 label、无期限 null 三件套、「第2周」锚定不漂移。
setNodeDeadline：「明天」五字段同步、清空六字段、「第2周」留锚=今天、绝对日期不留锚、Date 对象输入。
convertDuePlanDate：昨天/今天到期转 time、明天不动、已完成不动、无时间部分清 planDate 不塞 time、已有 time 不覆盖。
habitDueToday/habitTarget：daily、weekdays（一✓六✗，目标 5）、weekends（六日✓）、weekly 一三五（目标 3）、monthly 15 号、interval 每 3 天锚点推算、timesPerWeek 每天可打（目标 N）、旧 recur/timesPerWeek 兼容。
isRecurringTask/recurringTaskDueToday：recurrence 非习惯✓、recur/role=habit✗、今天已完成不再到期、昨天完成仍到期、从未完成到期。
resolveTimeConflicts（v8.11）：两个 9:00→09:00/09:40、链式三个、不重叠不动、缓冲带内也算撞、done/无 time 跳过、顺延出日界保持原样、自定义 gap、缺省估时 30′、{node} 包装也认。

### unit-history.cjs · 仪式历史聚合族（34）
聚合总分/完成数（pomo 不算）/番茄数/专注时长/92 分 A 与 todayScore 同口径/空与 null 安全。
dkWeekLabel：周一/周日/垃圾输入原样/空输入。
晨计划历史：倒序/字段携带/dk 注入/空 null 安全。晚回顾：key 并集倒序/聚合评分/三件好事过滤/总结携带/处置计数/仅处置也入列/空串返空。
周计划：倒序/rocks 携带/committedAt 回落 savedAt/intent 缺省/空安全。
回顾合并：三存储合并/savedAt 倒序/cycle 标记/字段保留/null 安全。

### unit-parse.cjs · 解析族（33）
期限：今天 0 天、明天 1 天、后天 2 天、label 归一、不逾期、YYYY-MM-DD label+daysLeft、12月31日跨年到未来最近一次、下周三=下自然周周三、3天后、两周内 14 天、第2周=锚点+13 天、过去日期逾期、无期限 null 三件套。
推断：尺度 每天/每周/每月/目标→day/week/month/year，recur 每天/每周N次/普通任务 false，估时 2小时=120/45分钟/半天=240/无信息 null。
parseText：节点数、id 序列、首行为根、缩进挂父、第二顶级行收敛到根、有子分支按文本重推尺度、空输入 []。

### unit-node.cjs · 节点族（30）
ensureVE：默认 val=im/eff=3、紧急≥4→eff4、「只需/5分钟」→eff2、「深度/重构/体系」→eff4、clamp 1-5。
category：四象限互不相同+四种组合归位。isQuickWin：val4eff2 是/eff3 否。
computeTree：_children 数量/depth/孤儿不挂树。treeOrder：DFS 序。
进度：子树 1/2=50%、1/1=100%、指标 5/10、超额 pct=100+pctReal=150+over、无 target null、paceStatus 结构+无期限 null。
serializeNodes：时间戳化/不含 daysLeft/tags 兜底 []。停放：waiting/blocked/正常否。

### unit-score.cjs · 评分族（33）
focusScoreParts：完成 -1000、im4 无期限 42（40+2 长期主线）、im3=30、逾期+30、daysLeft ≤1/3/7/14/远期 阶梯 +26/20/13/7/3、阻塞 -60、等待 -45、钉槽无精力数据高峰 +0、focusScore 同源。
pickRanked：Top2=im5+im4 叶子（分支不竞选）、limit=1 单对象、完成退出、阻塞退出、空池回落根（单/多）、根完成 null。
scoreDoneItem：im3 基础 30、期限内+12、逾期 -8、时长达标+15/略超+6/超较多+0、习惯+5。
scorePomoItem：无节点 25′=20、im5 90′=34、90′ 深潜、50′ 长专注。
scoreGrade：S/A/B/C/— + 边界 119/79/39。

### unit-time.cjs · 时间与习惯族（30）
weekKey：周三→本周一/周日→同一周一/周一→当天。periodKey：月/季/周=weekKey。
stagnantDays：999/0/3。
habitStrength：连打 10 天 50、连打 30 天 100 封顶、samples 上限 30、5 打 5 漏 40、低频 freqDecay=0.012→44、空/null→0。
energyBucketNow：5-12=am/12-18=pm/其余 eve。
smartEval：模糊 smart=false+s1m1+3gap 规则来源、完整 smart=true+s3m3r3t3、AI 路径优先 fromAI、AI s=1 不具体 gap。
smartQuestions：含衡量指标/完成时间/必追拆解。decomposeSuggestions：读书/销售/运动/默认。

## 流程测试明细（75 例）

### flow-today-pool.cjs · 今日池容量与时间纠偏（7，v8.11）
A 池预算：budget=60 两任务各 60′→一进一溢出、不传默认 dayCap(240) 全进、budget=0 首个保底进、习惯不占预算。
B backfill 全局避让：旧任务占今日 09:00+60′→新批缺省任务顺到 10:10、旧任务占「明天」→今天顺排不受影响。
C backfill 本批纠偏：AI 直给两个 9:00→写库前纠成 09:00/09:40。

### flow-time-travel.cjs · 时间旅行·跨天（39）
可控时钟 `__now` 模拟跨午夜。A 习惯 streak：d0 打卡→d1 连打 cur=2→重复勾防重→**d1 取消 cur 回退 1/lastDate 回昨天（v8.10 bug 修复验证：原实现直接清零）**→再勾恢复→断 2 天打卡重置 cur=1/best 保留→cur=1 取消归零+重复取消 no-op。B 打卡日志跨天分桶+d4/d5 各自独立、计数型 targetDone 跨天累积+同日防重+取消对称回退、低频 freqDecay=0.012。C _remindOff：当天关不回填→换天重置+自动回填开始前 5 分钟、00:03 边界（前 5 分钟是昨天不设置）、已有提醒不覆盖、已完成不回填。D 执行日志跨天：取消昨天勾的任务只查当天桶——昨天历史保留不建空桶、节点状态仍复位、换天重勾两天计数各自独立。E 排期任务过夜：明天排期今天不转换→过夜自动转 time 进今日。

### flow-goal-lifecycle.cjs · 项目全生命周期（7）
① doParse 树就位 → ② 手工加引用（石头/打卡/置顶）→ ③ applyWorkflowTemplate 整树替换旧引用全清 → ④ deleteNode 级联清石头+undo 一并还原 → ⑤ deleteWorkflow 最后项目重建空白默认+石头清空 → ⑥ clearAll 清空+引用全清+undo 全量还原。

### flow-today-execution.cjs · 今日执行（6）
① promoteNodeToToday→scale=day+自动排 19:00+planDate 清 → ② 撤回字段全还原 → ③ clarifyInbox 叶子入树+排时+clarified → ④ 撤回澄清回 inbox → ⑤ adoptPendingAction 同流 adopted+afterChange 不切流 → ⑥ 采纳到 wf2 切流往返回原流。

### flow-inbox.cjs · 收件箱（10）
① 捕获「明天下午3点」→ 明天 15:00 提醒+入箱 → ②「今天上午8点」过去时间不设提醒 → ③ 澄清为任务入树+排 19:00 → ④ 撤回回 inbox → ⑤ someday/restore/snooze 24h/trash 四分支 → ⑥ 目标项目不存在提示+条目不动。

### flow-habit-strength.cjs · 习惯强度 30 天（6）
① 连打 10 天→50% → ② +5 天漏打→65%（净+3% 不清零）→ ③ 再加更早 5 连→90%（历史贡献在）→ ④ 低频 freqDecay=0.012→94% → ⑤ 未记录日不参与 samples=10 → ⑥ 30 天全勤 100 封顶。

## checks 明细（493 项）

| 套件 | 项数 | 守什么 |
|---|---|---|
| verify-v8.2 | 19 | AI 排期回填/提醒默认值/英雄卡候选/多窗口 |
| verify-v8.3 | 12 | 收集防重/字号迁移/提醒三通道 |
| verify-v8.4 | 30 | AI 历史/失败原因/删空重建/模板区 |
| verify-v8.5 | 13 | dataset.tpl 清理/AI 结果弹窗 |
| verify-v8.6 | 22 | 模板走 AI/错误弹窗/面板精简 |
| verify-v8.7 | 20 | 模板时间检测/今日池过滤/顶栏全局池 |
| verify-v8.8 | 37 | 自动排时/项目删除级联/confirmModal/通知/容错链 |
| verify-v8.9 | 33 | 三级引用清理/删除级联/整树替换/clearAll |
| verify-v8.10 | 47 | 勾选回滚/跨午夜/恢复清理/精力全链/删除统一/期限入口/streak 回退/滚动版本守卫 |
| verify-v8.11 | 32 | 时间冲突纠偏/backfill 全局避让/池预算全局口径/溢出留池沉底/顺排提示条/文案说人话 |
| verify-v8.12 | 37 | 仪式历史：快照/聚合纯函数/openHistory 弹窗/入口/样式/导出 |
| verify-v8.13 | 38 | 英雄卡移除/topId 归一 syncTop/MIT 区承接番茄时长+取消固定+得分折叠/② 次重要高亮/版本号 |
| verify-v8.14 | 25 | metricsStrip 迁位/heroWrap 空态/② 行分数/已完成时刻+得分/❓ 按钮化/滚动版本守卫 |
| smoke-v8.2 | 15 | 排期回填 5 场景实跑 |
| smoke-v8.7 | 10 | 今日池 6 场景实跑 |
| smoke-v8.8 | 17 | 自动排时 5 场景+删除级联实跑 |
| smoke-v8.9 | 35 | 删除级联/undo/整树替换/clearAll/采纳实跑 |
| smoke-v8.10 | 49 | 勾选对称/换天/删除统一/清孤儿/快照与备份取消确认实跑 |
| node --check | 1 | app.js 语法 |
| 版本号一致 | 1 | index.html ?v= 同步 |
