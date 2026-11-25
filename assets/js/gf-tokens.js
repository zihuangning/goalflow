/**
 * GoalFlow 设计令牌（JS · 与 assets/css/tokens.css 同步）
 * @see docs/DESIGN-SYSTEM.md
 *
 * 主题机制（v5.1）：主题(theme) × 明暗模式(mode) 二维配置。
 *   THEMES[t].dark / THEMES[t].light 各注册一套 JS 色板（桑基/关系图/四象限颜色由此出）。
 *   本文件在 <head> 同步加载：读 localStorage → 写 <html data-theme data-mode> →
 *   把当前色板摊平到顶层（PALETTE_UR / CAT / COLORS），app.js 零改动。
 *   GoalFlowTheme.setTheme(name) / setMode(m) / toggleMode() 切换后刷新页面。
 */
(function (global) {
  'use strict';

  const THEME_STORAGE = 'goalflow.theme';
  const MODE_STORAGE = 'goalflow.mode';

  /* 每主题 × 每模式：PALETTE_UR(冷→暖 5 级) + noise + COLORS */
  const THEMES = {
    linear: {
      label: 'Linear',
      dark: {
        PALETTE_UR: ['#5e6ad2', '#3fb9b3', '#4cb782', '#e09a4f', '#eb5757'],
        noise: '#7c8295',
        COLORS: {
          accent: '#5e6ad2', accent2: '#3fb9b3',
          gold: '#e8b84a', goldSoft: '#f5d78a',
          svgGlow: '#5e6ad2', scaleLabel: '#8a93e6',
          smartGap: '#c5d0f5', gradSmartDot: ['#f5d78a', '#5e6ad2'],
        },
      },
      light: {
        PALETTE_UR: ['#5a64d0', '#2ea8a0', '#3da06e', '#d08a35', '#e04848'],
        noise: '#9aa0ae',
        COLORS: {
          accent: '#5e6ad2', accent2: '#2ea8a0',
          gold: '#d4a017', goldSoft: '#e8c558',
          svgGlow: '#5e6ad2', scaleLabel: '#5e6ad2',
          smartGap: '#4a5468', gradSmartDot: ['#d4a017', '#5e6ad2'],
        },
      },
    },
    raycast: {
      label: 'Raycast 玻璃（预览）',
      dark: {
        PALETTE_UR: ['#8a63ff', '#63b3ff', '#63dc96', '#e8b84a', '#ff6363'],
        noise: '#8e8e9a',
        COLORS: {
          accent: '#ff6363', accent2: '#8a63ff',
          gold: '#e8b84a', goldSoft: '#f5d78a',
          svgGlow: '#8a63ff', scaleLabel: '#b39aff',
          smartGap: '#e5d9ff', gradSmartDot: ['#f5d78a', '#8a63ff'],
        },
      },
      light: {
        PALETTE_UR: ['#7a52e8', '#4a9ae8', '#35b578', '#d4a017', '#e04848'],
        noise: '#a5a2b2',
        COLORS: {
          accent: '#e04848', accent2: '#7a52e8',
          gold: '#d4a017', goldSoft: '#e8c558',
          svgGlow: '#8a63ff', scaleLabel: '#7a52e8',
          smartGap: '#5a5470', gradSmartDot: ['#d4a017', '#8a63ff'],
        },
      },
    },
    rpg: {
      label: 'RPG 游戏（预览）',
      dark: {
        PALETTE_UR: ['#a78bfa', '#60a5fa', '#4ade80', '#fb923c', '#f87171'],
        noise: '#8a7fa0',
        COLORS: {
          accent: '#a78bfa', accent2: '#4ade80',
          gold: '#f5c518', goldSoft: '#ffe27a',
          svgGlow: '#a78bfa', scaleLabel: '#c4b5fd',
          smartGap: '#e9d5ff', gradSmartDot: ['#ffe27a', '#a78bfa'],
        },
      },
      light: {
        PALETTE_UR: ['#8a6ae0', '#4a8ae0', '#2fa35c', '#e07830', '#e04848'],
        noise: '#a89cc0',
        COLORS: {
          accent: '#7c5cd6', accent2: '#2fa35c',
          gold: '#d4a017', goldSoft: '#e8c558',
          svgGlow: '#a78bfa', scaleLabel: '#7c5cd6',
          smartGap: '#5c5470', gradSmartDot: ['#d4a017', '#a78bfa'],
        },
      },
    },
  };

  const DEFAULT_THEME = 'linear';
  const DEFAULT_MODE = 'dark';

  function read(key, fallback, valid) {
    try {
      const v = localStorage.getItem(key);
      return valid(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  let theme = read(THEME_STORAGE, DEFAULT_THEME, (v) => !!THEMES[v]);
  let mode = read(MODE_STORAGE, DEFAULT_MODE, (v) => v === 'dark' || v === 'light');

  let palette = THEMES[theme][mode] || THEMES[theme].dark;

  /* 立即写入 <html data-theme data-mode>，抢在首次渲染前避免闪烁 */
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = mode;
  }

  function store(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  /* 就地刷新当前色板（PALETTE_UR / CAT / COLORS 均为副本，app.js 持有同一引用） */
  function refreshPalette() {
    palette = THEMES[theme][mode] || THEMES[theme].dark;
    PALETTE_UR.splice(0, PALETTE_UR.length, ...palette.PALETTE_UR);
    CAT.now.color = PALETTE_UR[4];
    CAT.core.color = PALETTE_UR[0];
    CAT.distract.color = PALETTE_UR[3];
    CAT.noise.color = palette.noise;
    Object.keys(COLORS).forEach((k) => delete COLORS[k]);
    Object.assign(COLORS, palette.COLORS);
  }
  /* 即时应用（不刷新页面）：先落地 dataset + 色板，保证即使 reload 被 WebView 拦截也能看到切换 */
  function applyTheme(name) {
    if (!THEMES[name]) return false;
    theme = name;
    store(THEME_STORAGE, name);
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = name;
    refreshPalette();
    return true;
  }
  function applyMode(m) {
    if (m !== 'dark' && m !== 'light') return false;
    mode = m;
    store(MODE_STORAGE, m);
    if (typeof document !== 'undefined') document.documentElement.dataset.mode = m;
    refreshPalette();
    return true;
  }
  function setTheme(name) {
    if (!applyTheme(name)) return;
    location.reload();
  }
  function setMode(m) {
    if (!applyMode(m)) return;
    location.reload();
  }
  function toggleMode() {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }

  const PALETTE_UR = palette.PALETTE_UR.slice();

  const CAT = {
    now: { key: 'now', label: '立即做 · 重要且紧急', color: PALETTE_UR[4] },
    core: { key: 'core', label: '核心投入 · 重要不紧急', color: PALETTE_UR[0] },
    distract: { key: 'distract', label: '干扰枝干 · 紧急不重要', color: PALETTE_UR[3] },
    noise: { key: 'noise', label: '噪音 · 不重要不紧急', color: palette.noise },
  };

  const COLORS = Object.assign({}, palette.COLORS);

  const STORAGE = {
    nodes: 'goalfocus.v4',
    nodesLegacy: 'goalfocus.v3',
    meta: 'goalfocus.meta.v1',
    llmKey: 'gf_llm_key',
    theme: THEME_STORAGE,
    mode: MODE_STORAGE,
  };

  const BTN = {
    primary: 'gf-btn gf-btn--primary',
    primarySm: 'gf-btn gf-btn--primary gf-btn--sm',
    cool: 'gf-btn gf-btn--primary gf-btn--cool',
    coolSm: 'gf-btn gf-btn--primary gf-btn--cool gf-btn--sm',
    ghost: 'gf-btn gf-btn--ghost',
    ghostSm: 'gf-btn gf-btn--ghost gf-btn--sm',
    ai: 'gf-btn gf-btn--ai',
    aiSm: 'gf-btn gf-btn--ai gf-btn--sm',
    sm: 'gf-btn gf-btn--sm',
    smPill: 'gf-btn gf-btn--sm gf-btn--pill',
    default: 'gf-btn',
  };

  global.GoalFlowTheme = {
    THEMES,
    theme,
    mode,
    setTheme,
    setMode,
    toggleMode,
    applyTheme,
    applyMode,
    PALETTE_UR,
    CAT,
    COLORS,
    STORAGE,
    BTN,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
