# GoalFlow 设计系统

前缀 **`gf-`**（GoalFlow）。样式与 JS 令牌需保持同步。

**视觉方向（锁定）**：**Linear 工作台**（Inter 系、克制留白、弱面板感）。demos 回灌以 Things 极简间距为准。  
**废弃叙事**：River Observatory（衬线 + 金人文风）不再作为主应用方向；demos 可保留实验，主产品不混两套。

## 主题机制（主题 × 明暗）

默认主题 **Linear**（`linear`）+ 预留 `raycast` / `rpg`；**每个主题都有 dark / light 两套色板**。

- 两个独立维度：`<html data-theme="linear" data-mode="dark">`，存储键 `goalflow.theme` + `goalflow.mode`
- CSS：`:root` = 结构 token + `linear` dark；`[data-theme="x"]` 覆盖各主题 dark；`[data-theme="x"][data-mode="light"]` 覆盖各主题 light
- JS：`gf-tokens.js` 的 `THEMES[t].dark/.light`；桑基/导出/条形一律走 `PALETTE_UR` / `COLORS`，禁止硬编码 hex
- 切换：顶栏 `#themeSelect` / `#modeToggle`；资源 `?v=` **六处**同步 bump（css + 五 script）
- light：gold 调深保对比；走查 SVG/导出是否仍写死深底金线

## 布局（三视图 · 非英雄卡）

参考 `demos/01-linear` / Things 极简：左侧 **52px `.rail`** + **230px `.side`** + `.main`（顶栏 + `.main-scroll`）。`body{overflow:hidden}`，仅主区滚动；≤900px 隐藏 rail/side，底部 `.mtab`。

**三视图**（`switchView`，记忆 `goalflow.view`）：

| 视图 | 容器 | 主内容 |
|------|------|--------|
| 今日 | `#view-today` | 问候/进度 · MIT pin · 今日清单；其余进 zone 折叠 |
| 规划 | `#view-plan` | 输入 / 树 / SMART 纵向堆叠 |
| 洞察 | `#view-insights` | 桑基 / 四象限等 |
| AI | `#view-ai` | 历史 / 配置 / SMART（可选第四栏） |

**MIT pin（v8.13+）**：Top1 钉住 + 番茄档位 + 得分折叠；清单内 ② 次重要高亮。英雄卡 / 执行栈已移除，勿再写回文档或 UI。

**Zone 折叠**：`#zoneStatus` / `#zoneAttention` / `#zoneFocus`（及 fold `goalflow.folds` / `goalflow.zone.*`）。简洁模式默认只留问候·MIT·清单。

## 组件目录（`gf-`）

| 路径 | 说明 |
|------|------|
| `assets/css/tokens.css` | CSS 变量 |
| `assets/css/base.css` | 页面壳、进入动效 |
| `assets/css/components/button.css` | `.gf-btn` |
| `assets/css/components/chip.css` | `.gf-chip`、进度条 |
| `assets/css/components/forms.css` | `.gf-input`、`.hint` |
| `assets/css/components/layout.css` | 顶栏、rail/side、视图壳（无英雄卡网格） |
| `assets/css/components/features.css` | 桑基、四象限、弹窗、今日行、`.gf-row` |
| `assets/js/gf-tokens.js` | `GoalFlowTheme` |

### 公共 UI 壳（JS）

- **Modal**：`buildModalHtml` + `openModalMask` + `modalHeadHtml` / `modalFootHtml`；新弹窗禁止手写 `modal-head`。特例：`openSmart`（多轮重渲）、`openGlobalSearch`（`gs-bar`）只统一关闭行为。
- **Fold**：`foldSectionHtml` / `<details class="fold">` + `goalflow.folds`
- **Empty**：`emptyStateHtml` / `.empty-state`
- **Row**：`rowChrome`（勾选 + 文案 + meta + ⋯）——今日/收件箱/大石头（`button.rock-chip` 包内层 `.gf-row`）；树编辑器手写 DOM 但顺序对齐 gf-row；主导航图标用静态 `.gf-icon` SVG 或运行时 `gfIcon()`

## 按钮

```html
<button type="button" class="gf-btn">默认</button>
<button type="button" class="gf-btn gf-btn--primary">主操作</button>
<button type="button" class="gf-btn gf-btn--ghost">弱化</button>
<button type="button" class="gf-btn gf-btn--sm">小号</button>
```

JS 动态按钮优先 `GoalFlowTheme.BTN.*`。

## 快捷键

输入框 / 弹窗打开时全局快捷键不生效（Esc 除外）。

| 键 | 行为 |
|----|------|
| `1` / `2` / `3` / `4` | 今日 / 规划 / 洞察 / AI |
| `t` | 回今日 |
| `c` | 快速捕捉（收件箱） |
| `/` 或 `Ctrl/Cmd+K` | 全局搜索 |
| `Space` | 番茄进行中：暂停/继续 |
| `Esc` | 关闭当前 `.modal-mask` |

设置 → 关于 展示同表。

## 存储键规范

| 类别 | 前缀 / 键 | 用途 |
|------|-----------|------|
| **权威·数据** | `goalfocus.workflows.v2` | 项目树主键 |
| | `goalfocus.workflows.bak` | 每次 save 镜像 |
| | `goalfocus.meta.v1` | 回顾 / 执行 / prefs |
| | `goalfocus.v4` | 当前单树镜像 |
| | `goalfocus.snapshots.v1` | 滚动快照 |
| **权威·UI prefs** | `goalflow.theme` / `goalflow.mode` | 主题与明暗 |
| | `goalflow.view` / `goalflow.folds` / `goalflow.zone.*` | 视图与折叠 |
| | `goalflow.todayWfOnly` 等 | 其它界面偏好 |
| **遗留只读** | `goalfocus.workflows.v1`、`goalfocus.v3` | 加载回退，禁止新写 |
| **特例** | `gf_llm_key` | API Key（本机，不进仓库/记忆） |

**禁止**新建第三套前缀。数据 = `goalfocus.*`，界面偏好 = `goalflow.*`。

## 颜色同步

改配色时三处同步：`tokens.css` ↔ `gf-tokens.js` ↔ 派生 `CAT`。  
内联 SVG/条形禁止硬编码 `#hex`。

## 单文件分发

```bash
node scripts/inline-bundle.mjs
```

输出 `dist/index-standalone.html`。开发多 script：`gf-tokens` → `gf-demos` →（`gf-model` → `gf-ui`）→ `app`，顺序由 `APP_SCRIPT_PARTS` 统一。
