# GoalFlow 设计系统

前缀 **`gf-`**（GoalFlow）。样式与 JS 令牌需保持同步。

## 主题机制（v5.1 · 主题 × 明暗双维度）

默认主题 **Linear**（`linear`）+ 预留 `raycast` / `rpg`；**每个主题都有 dark / light 两套色板**。

- 两个独立维度：`<html data-theme="linear" data-mode="dark">`，存储键 `goalflow.theme` + `goalflow.mode`
- CSS：`:root` = 结构 token + `linear` dark；`[data-theme="x"]` 覆盖各主题 dark；`[data-theme="x"][data-mode="light"]` 覆盖各主题 light（只改颜色 token，结构 token 不动）
- JS：`gf-tokens.js` 的 `THEMES[t].dark/.light` 双套色板（`PALETTE_UR` / `COLORS` / `noise`），加载时按 theme+mode 摊平到顶层，`app.js` 零感知
- 切换：顶栏 `.topbar-theme` 内 `#themeSelect` → `setTheme()`、`#modeToggle`（☾/☀）→ `toggleMode()`；均写存储后 reload（app.js 绑定含旧缓存兜底，无 GF 方法时直接写 localStorage 后 reload）
- 缓存破除：资源引用带 `?v=版本` 查询串（inline-bundle.mjs 正则已兼容），改版本号即可强制刷新
- 防闪烁：`<head>` 内联 bootstrap 提前写入 `data-theme` + `data-mode`（打包脚本依赖尾部三 script 连续，勿拆分）
- 新增主题：`tokens.css` 加 dark + light 两个覆盖块、`gf-tokens.js` `THEMES` 加双套色板、`index.html` 下拉加 option，四处即可
- light 模式注意：gold 调深（如 `#d4a017`）保对比；`body` 去纹理仅渐变

## 布局（v5.1 · app shell）

参考 `demos/01-linear`：左侧 **52px 图标轨 `.rail`**（logo / 锚点导航 / 周回顾◔ / demos 链接）+ **230px 侧栏 `.side`**（工作流 1-4 锚点、目标树 `#sideTree` + 进度 `#sideProg`）+ 主区 `.main`（顶栏含 `.topbar-theme` 主题/明暗控件 + `.main-scroll` 滚动容器）。`body{overflow:hidden}`，仅主区滚动；≤900px 隐藏 rail/side。面板锚点 id：`panelInput/panelTree/panelSmart/canvasPanel/quadPanel/focusPanel`。

## 目录

| 路径 | 说明 |
|------|------|
| `assets/css/tokens.css` | CSS 变量（颜色、间距、字体） |
| `assets/css/base.css` | 页面壳、进入动效、`gf-hint` / `gf-btns` |
| `assets/css/components/button.css` | `.gf-btn` 及修饰符 |
| `assets/css/components/chip.css` | `.gf-chip`、`.today-chip`、`.progress-chip` |
| `assets/css/components/forms.css` | `.gf-input`、`textarea`、`.hint` |
| `assets/css/components/layout.css` | 顶栏、英雄卡、面板网格 |
| `assets/css/components/features.css` | 桑基、四象限、弹窗、SMART 等 |
| `assets/js/gf-tokens.js` | `GoalFlowTheme`（色板、存储键、按钮 class 串） |

## 按钮

```html
<button type="button" class="gf-btn">默认</button>
<button type="button" class="gf-btn gf-btn--primary">主操作（金）</button>
<button type="button" class="gf-btn gf-btn--primary gf-btn--cool">次要主色（蓝）</button>
<button type="button" class="gf-btn gf-btn--ghost">弱化</button>
<button type="button" class="gf-btn gf-btn--ai">AI</button>
<button type="button" class="gf-btn gf-btn--sm">小号</button>
<button type="button" class="gf-btn gf-btn--sm gf-btn--pill">顶栏胶囊</button>
```

JS 动态按钮请使用 `GoalFlowTheme.BTN.primary` 等，避免硬编码 class。

**兼容**：旧版 `button.primary` / `.ghost` / `.small` / `.ai` 仍有效（见 `button.css`）。

## 颜色同步

改某个主题某个模式的配色时三处同步：

1. `tokens.css` 对应 `[data-theme]`（dark）或 `[data-theme][data-mode='light']` 块中的 `--ur*` / `--accent` / `--gold`
2. `gf-tokens.js` 对应 `THEMES[x].dark/.light` 的 `PALETTE_UR` 与 `COLORS`
3. `CAT.*.color` 由 `PALETTE_UR` 派生（无需单独改）

JS 内联样式（桑基/周回顾条形/VE 矩阵）一律引用 `PALETTE_UR` / `CAT` / `COLORS`，禁止硬编码 hex。

## 扩展新页面

```html
<link rel="stylesheet" href="assets/css/main.css">
<script src="assets/js/gf-tokens.js"></script>
```

仅样式时可只引 `main.css`。

## 单文件分发

开发用多文件结构；发布单 HTML：

```bash
node scripts/inline-bundle.mjs
```

输出 `dist/index-standalone.html`（内联全部 CSS + JS，仍依赖 Google Fonts CDN）。