## 1. 采用的系统与工具

- **纯静态、零构建**：没有 Sass/Less/PostCSS/Webpack，只有原生 `*.css`（通过 CSS `@import` 聚合）、原生 JS、原生 HTML。构建脚本仅用于把资源内联（`scripts/inline-bundle.mjs`）。
- **样式方案**：CSS Custom Properties（设计令牌，design tokens）+ BEM 命名（`gf-btn`, `gf-btn--primary`, `gf-btn--sm`）。无框架、无 CSS-in-JS。
- **字体**：Google Fonts Inter + JetBrains Mono（由 index.html `<head>` 中直接注入 `preconnect`）。`demos/*.html` 可按视觉风格各自替换字体。
- **响应式**：原生 `@media` 断点 + CSS Grid/Flexbox；桌面端主入口采用三栏布局（rail / side / main），mobile 单栏由 `assets/css/components/mobile.css` 控制。

## 2. 关键文件与包

- `assets/css/main.css` — 唯一 CSS 入口，按依赖顺序 `@import` tokens → base → components → mobile。
- `assets/css/tokens.css` — **单一颜色源**：`:root` 定义结构 token（`--radius`, `--space-*`, `--font-ui`, `--ease-out`）和默认 theme「linear」的全部语义色（`--body-bg`, `--panel`, `--ink`, `--accent`, `--ur1..5`, `--gold` …）。
- `assets/css/base.css` — 全局 reset、页面壳、噪点纹理 `body::before`、过渡动画、通用工具类（`.gf-hint`, `.gf-btns`, `.gf-kbd`）。
- `assets/css/components/` — 原子级组件：`button.css` / `chip.css` / `forms.css` / `layout.css` / `features.css` / `mobile.css`。
- `assets/js/gf-tokens.js` — JS 侧设计令牌：`THEMES.linear/raycast/rpg` × (`dark` | `light`) 二维映射，输出 `GoalFlowTheme.THEMES / PALETTE_UR / CAT / COLORS / STORAGE / BTN`。
- `index.html` — 启动壳：首行 `<script>` 同步写入 `document.documentElement.dataset.theme / dataset.mode`，再加载 CSS，避免闪烁。
- `demos/01-09,10-*.html` — 以同一内核渲染的十个外部视觉风格演示页，每个文件自带独立 `<style>` 块覆盖 `:root` 变量。

## 3. 架构与设计约定

### 3.1 设计令牌（tokens）双源 + 同步契约

`assets/css/tokens.css` 头部注释明确声明：**“JS 侧请同步 assets/js/gf-tokens.js”**。CSS 层负责颜色展示，JS 层负责运行时计算（PALETTE_UR 色板、CAT 分类颜色、SVG/图形用色、localStorage key 名）。

新增主题的规范路径是：

1. 在 `tokens.css` 追加 `[data-theme="x"]` 覆盖块。
2. 在 `gf-tokens.js` 的 `THEMES` 对象注册同名键，提供 `label`、`dark`、`light` 两套色板。

运行期通过 `<html data-theme="…" data-mode="…">` 同时表达主题与明暗模式。

### 3.2 主题机制（二维配置）

```text
theme ∈ { linear (default), raycast (preview), rpg (preview) }
mode  ∈ { dark (default), light }
```

`gf-tokens.js` 在每个 `<html>` 上立即写入 `data-theme` / `data-mode`，并保存于 localStorage key `goalflow.theme` / `goalflow.mode`。切换 `setTheme()` / `setMode()` / `toggleMode()` 后 `location.reload()`，因此无需动态 CSS。

### 3.3 组件库（BEM）

所有可复用 UI 以 `.gf-` 前缀组织：

- 按钮：`.gf-btn` + modifier（`--primary`, `--ghost`, `--ai`, `--cool`, `--sm`, `--pill`），JS 端通过常量 `BTN.{primary,ghost,ai,...}` 拼接 class 字符串（见 `GF_BTS` / `GoalFlowTheme.BTN`），避免模板中散落 class 片段。
- Chip、表单、布局、features、mobile 同理，全部位于 `assets/css/components/` 下并由 `main.css` 统一引用。

### 3.4 布局策略

主应用壳遵循三栏结构（`rail` / `side` / `main`），在 `base.css` 中以 CSS Grid 实现；`components/mobile.css` 使用 `@media (max-width: ...)` 把侧栏与轨道折叠为单列。

### 3.5 视觉风格演示层

`demos/index.html` 作为入口，逐个 `.html` 文件模拟 Linear / Things / Notion / Sunsama / Stripe / Raycast / Amie / Kinfolk / Vercel / RPG 十大效率产品的“同款内核、不同外观”。每个 demo 页自建一个覆盖 `:root` 变量的局部 `<style>` 块，不侵入主 `tokens.css`——这样同一份目标数据可在不同视觉语言下预览。

### 3.6 动效与无障碍

- `prefers-reduced-motion: reduce` → 强制 `animation-duration: 0.01ms !important`。
- `color-scheme: dark` + `meta name="color-scheme" content="light dark"` 保证滚动条/表单控件随浏览器深色模式着色。
- 初始过渡通过 `body.is-ready` 从 `opacity: 0; transform: translateY(10px)` 淡入（`.wrap` / `.hero-wrap` / `header.topbar`）。

## 4. 约定与约束（描述性）

| 层面 | 观察到的约定 / 约束 | 依据 |
|---|---|---|
| 颜色管理 | 语义色只允许通过 CSS var（如 `var(--accent)`, `var(--bg1)`, `var(--stroke)`）使用，硬编码十六进制仅出现在 tokens 文件中 | `tokens.css` 中 `--accent` / `--body-bg` 等集中声明，组件 CSS 全部解引用 |
| 主题扩展 | 新增主题需在 `tokens.css` 添加 `[data-theme="x"]` 并同时在 `gf-tokens.js` 注册相同 key | `tokens.css` 顶部注释 + `gf-tokens.js` `const THEMES = { … }` 校验逻辑（`read(..., (v) => !!THEMES[v])`） |
| 明暗模式 | 值只能是 `dark` 或 `light`，否则回退默认 | `gf-tokens.js` 中 `valid(v) => v === 'dark' || v === 'light'` |
| 持久化 | theme/mode/key 使用统一 STORAGE 常量，key 名以 `goalflow.*` / `goalfocus.*` 命名空间隔离 | `GoalFlowTheme.STORAGE` 暴露 `STORAGE.theme`, `STORAGE.mode`, `STORAGE.nodes` 等 |
| CSS 入口 | 新增样式模块必须通过 `@import url('./components/...');` 加入 `assets/css/main.css` | `main.css` 是唯一被 `<link rel="stylesheet">` 引用的文件 |
| 组件命名 | 组件类一律 `.gf-` 前缀 + BEM modifier | 全仓 grep 可见 `gf-btn`, `gf-chip`, `gf-input` 等 |
| 响应式 | 移动端规则集中在 `components/mobile.css`，主 CSS 文件本身不做大量断点 | `main.css` 末行导入 `mobile.css` |
| 字体 | 主应用固定使用 Inter + JetBrains Mono；demo 可自插字体 | `index.html` Google Fonts 链接 vs `demos/*.html` 各自 style |
| 构建产物 | 无编译产物，版本哈希由 `?v=7.6` 这类查询参数实现缓存更新 | `index.html` 中 `<link rel="stylesheet" href="assets/css/main.css?v=7.6">` |

**未发现的系统**：本仓库不使用 Tailwind/Sass/SCSS/Tailwind config、不存在 PostCSS/autoprefixer 配置、没有 design-token JSON/YAML 管线；主题切换以“换 HTML attribute + 重载”而非运行时替换 stylesheet 的方式实现。以上结论基于对 `assets/css/*`、`assets/js/gf-tokens.js`、`index.html` 及若干 `demos/*.html` 的直接审查。