# 番茄钟评分 + 早晚仪式闹钟 · 设计规格（v5.4)

日期：2026-11-23 · 状态：已获用户批准
基于：工作区 v5.3 WIP（今日行动面板 / pomo 25′ / tickReminders / 多工作流）

## 1. 目标

| # | 需求 | 用户原话 |
|---|------|---------|
| G1 | 番茄钟进行中页面可见进度 | 「番茄闹钟应该在页面显示进度」 |
| G2 | 每个番茄完成自动评分 | 「每项工作自动评分」 |
| G3 | 今日总评分常驻可见 | 「今日总评分」 |
| G4 | 可设置早、晚两个闹钟，到点弹窗 | 「支持设置早上和晚上闹钟弹窗」 |
| G5 | 晚间弹窗做今日总结 | 「晚上负责总结」 |
| G6 | 晨间弹窗制订/调整今日活动（含自定义新增） | 「早上负责制订或调整今日活动」+「自定义新增活动」 |

已澄清决策：
- 闹钟 = **页面内弹窗 + 错过补弹**（不用系统通知；页面没开时下次打开补弹）
- 评分 = **重要度加权**：完成 = 10 分 × 权重，提前结束 = 0 分
- 进度形态 = **悬浮进度条**（环形 + 倒计时 + 任务名），不做全屏遮罩
- 晚间弹窗 = **自动统计 + 一句反思**（可选输入）
- 晨间弹窗 = **勾选叶子（默认 Top3）+ 容量提示 + 自定义新增活动**

## 2. 非目标（YAGNI)

- 不做系统通知（已有 `requestAlarmPermission` 体系保留给叶子 remindAt，与本特性正交）
- 不做全屏专注遮罩、不做排行榜/ streak、不做声音提醒
- 不改动既有 tickReminders 叶子级提醒逻辑

## 3. 数据模型（`goalfocus.meta.v1` 扩展；备份版本 v7 → v8)

```js
meta.ritual = {
  morning: '08:00',      // HH:mm，可改
  evening: '21:00',
  on: true,
  lastMorningDone: '',   // dateKey，防重复补弹
  lastEveningDone: ''
}
meta.pomoLog = [
  { day: '2026-11-23', nodeId, wfId, minutes: 25, score: 15, finishedAt: 1732... }
]
meta.dayPlans = { '2026-11-23': [{ nodeId } | { custom: '读 20 页书', minutes: 30 }] }
meta.reflectLog = { '2026-11-23': '今天状态…' }
```

- 读取时缺省补默认值（与 `loadMeta` 现有模式一致）
- `pomoLog` 只增不减；跨零点番茄计入**完成日**
- 备份 `exportBackup` 版本号 7→8，导入旧版时缺省字段自动补齐

## 4. 评分引擎（纯函数，挂 module.exports)

```js
calcPomoScore(node)        // 完成: 10 × 权重; 权重: im>=4 →1.5, im 2-3 →1.0, im<=1 →0.6
dayScoreTotal(pomoLog, dayKey)   // 当日求和
ritualDue(ritual, now, lastDone) // → 'morning'|'evening'|null（含错过补弹判定）
```

- `finishPomo(credit=true)` 时：`pomoLog.push({...score: calcPomoScore(n)})` + `saveMeta()`
- `finishPomo(false)`（提前结束）：不记分、不记 actualMinutes（维持 v5.3 行为）
- 今日总评分 = `dayScoreTotal(meta.pomoLog, dateKey())`，每次 afterChange 重算

## 5. UI 落点

### 5.1 顶栏
- **⏰ 仪式设置钮**（`#btnRitual`，置于 .topbar-theme 左侧）：小弹层含早/晚 time input + 开关，存 `meta.ritual`
- **今日总分 chip**（`#scoreChip`，紧随 progressChip）：`🍅×3 · 42分`；完成番茄瞬间 CSS 跳动动画；点击展开当日明细小弹层（每条：任务名 +N）

### 5.2 番茄悬浮条（升级现有 `#pomoBar`）
- 结构：SVG 环形进度（剩余/总时长）+ `mm:ss` + 任务名（截断 20 字）+「结束」钮
- 位置：`.main-scroll` 顶部居中 sticky pill，z-index 低于 modal
- 完成瞬间：变金色显示 `✓ +N分` 1.5s 后淡出；`scoreChip` 同步更新

### 5.3 晨间弹窗（`#morningModal`，复用 .modal-mask 体系）
- 候选叶子列表：算法（focusScore）排序前 10，checkbox 默认勾 Top3；每行显示预估时长
- 底部「+ 自定义活动」：文本输入 + 分钟数，回车/按钮加入列表（标记 custom）
- 合计条：已选 Σ分钟 vs 480min 容量，超标红色警告但不拦截
- 「确定今日计划」→ 写 `meta.dayPlans[day]` + `ritual.lastMorningDone=day` → 聚焦清单面板置顶「今日计划」分组渲染（custom 项灰底区分）

### 5.4 晚间弹窗（`#eveningModal`）
- 自动统计：番茄数、今日总评分、完成叶子清单、未完成叶子（提示已顺延/可明天见）
- 反思输入框（可选，存 `meta.reflectLog[day]`）
- 「收下今天」→ `ritual.lastEveningDone=day` 关闭

### 5.5 触发与补弹
- `setInterval` 30s（并入现有 tick 循环或独立）：到点且当日未 done → 弹对应 modal
- 打开页面时：若当前时间已过 morning 且 `lastMorningDone≠today` → 弹晨间；若昨天 `lastEveningDone≠yesterday` 且现在已过昨天 evening → 先弹昨日总结，再（如适用）弹今日晨间（排队，关一弹一）

## 6. 实现文件映射

| 文件 | 改动 |
|------|------|
| `assets/js/app.js` | 评分纯函数、pomoLog 写入、pomoBar 升级渲染、ritual 设置/触发/补弹、两个 modal、聚焦清单「今日计划」分组、导出新增纯函数、备份 v8 |
| `index.html` | 顶栏 #btnRitual + #scoreChip；#morningModal / #eveningModal 容器；版本号 ?v=5.6 |
| `assets/css/components/features.css` | pomo 环、scoreChip 跳动、仪式弹层、晨间列表样式 |
| `docs/DESIGN-SYSTEM.md`、`openmemory.md` | 同步 |

## 7. 错误处理与边界

- ritual 时间输入非法 → 回退默认 08:00/21:00
- 补弹每日每类最多一次（lastXxxDone 标记）
- 晨间弹窗「确定」时 0 勾选 → 视为「今日不计划」，同样写 lastMorningDone 防反复弹
- 番茄进行中刷新页面：v5.3 的 `save()` 不持久化 pomo（已核实）→ 新增 `meta.pomoActive={endAt,nodeId,wfId,minutes}`，startPomo 写入、finishPomo 清除；load 时恢复：endAt 已过 → 按完成补记分与时长；未过 → 恢复倒计时
- localStorage 写失败静默降级（沿用现有 try/catch 模式）

## 8. 测试

- `node --check` + `module.exports` 新增纯函数（calcPomoScore / dayScoreTotal / ritualDue）node 断言冒烟
- `node scripts/inline-bundle.mjs` 打包验证
- CDP 驱动真实 Edge：模拟完成番茄验证 scoreChip 增量；改系统时间不可行 → 用 `ritual.morning=当前时间+1min` 验证到点弹窗；清空 lastDone 验证补弹

## 9. 风险

- v5.3 WIP 未提交：实现前先将工作区现状 commit 为基线（已与用户确认其为合法前序工作）
- 两个 setInterval（pomo 1s / ritual 30s）并存注意清理，避免泄漏
