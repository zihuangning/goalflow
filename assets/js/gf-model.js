"use strict";

/* ============ 主题 / 常量（见 assets/js/gf-tokens.js）============ */
const GF = typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : {};
const PALETTE_UR = GF.PALETTE_UR || ['#5e6ad2', '#3fb9b3', '#4cb782', '#e09a4f', '#eb5757'];
/* v8.18: 项目侧栏色条调色板（无自定义色时按 id 稳定取色，保证不同项目一眼可辨） */
const WF_COLORS = ['#5e6ad2', '#3fb9b3', '#e09a4f', '#eb5757', '#4cb782', '#9b6bff', '#2f9eef', '#e85d75'];
function workflowColor(w) {
  if (w && w.color) return w.color;
  const id = (w && w.id) || '';
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return WF_COLORS[h % WF_COLORS.length];
}
const CAT = GF.CAT || {
  now: { key: 'now', label: '立即做 · 重要且紧急', color: PALETTE_UR[4] },
  core: { key: 'core', label: '核心投入 · 重要不紧急', color: PALETTE_UR[0] },
  distract: { key: 'distract', label: '干扰枝干 · 紧急不重要', color: PALETTE_UR[3] },
  noise: { key: 'noise', label: '噪音 · 不重要不紧急', color: (GF.CAT && GF.CAT.noise && GF.CAT.noise.color) || 'var(--muted)' },
};
const COLORS = GF.COLORS || {};
const svgGold = () => COLORS.gold || 'var(--gold)';
const svgGoldSoft = () => COLORS.goldSoft || 'var(--gold-soft)';
const svgNoise = () => (CAT.noise && CAT.noise.color) || 'var(--muted)';
const svgMuted = () => 'var(--muted-2)';
const svgOverdue = () => 'var(--ur5)';
const cssVar = (name, fb) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  } catch (e) { return fb; }
};
const STORAGE = GF.STORAGE || {};
const BTN = GF.BTN || {};
const LS_KEY = STORAGE.nodes || 'goalfocus.v4';
const LS_KEY_LEGACY = STORAGE.nodesLegacy || 'goalfocus.v3';
const LS_META = STORAGE.meta || 'goalfocus.meta.v1';
const LS_WORKFLOWS = 'goalfocus.workflows.v2';
const LS_WORKFLOWS_BAK = 'goalfocus.workflows.bak';
const LS_BAK_INTERVAL = 5 * 60 * 1000;
const LLM_KEY_STORAGE = STORAGE.llmKey || 'gf_llm_key';
const SCALES = [
  { key: 'day', label: '每日', short: '今日' },
  { key: 'week', label: '每周', short: '本周' },
  { key: 'month', label: '每月', short: '本月' },
  { key: 'year', label: '年度', short: '年度' }
];
const SCALE_LABEL = { all: '当下', day: '今日', week: '本周', month: '本月', year: '年度' };
const QUAD = {
  now: { key: 'now', label: '重要且紧急 · 立即做', icon: '🔴', val: { im: 5, ur: 5 } },
  core: { key: 'core', label: '重要不紧急 · 核心投入', icon: '🔵', val: { im: 5, ur: 2 } },
  distract: { key: 'distract', label: '紧急不重要 · 干扰', icon: '🟠', val: { im: 2, ur: 5 } },
  noise: { key: 'noise', label: '不重要不紧急 · 噪音', icon: '⚪', val: { im: 2, ur: 2 } },
};
const QUAD_ORDER = ['now', 'core', 'distract', 'noise'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const urColor = ur => PALETTE_UR[clamp(Math.round(ur), 1, 5) - 1];
function inferRecur(text, scale) {
  const t = text || '';
  if (/每天|每日|天天|日课|日更|晨间|晚间习惯/.test(t)) return true;
  if (/每周|周报|周会|每星期|双周|周\s*\d+\s*次/.test(t)) return true;
  if (scale === 'day' && /固定\s*\d|时段|集中回复/.test(t)) return true;
  return scale === 'week' && /例行|周期/.test(t);
}
function parseTimesPerWeek(text) {
  const m = (text || '').match(/每周\s*(\d+)\s*次|一周\s*(\d+)\s*次/);
  return m ? clamp(+(m[1] || m[2]) || 0, 0, 7) : 0;
}
function ensureVE(n) {
  if (n.val == null) n.val = clamp(n.im, 1, 5);
  if (n.eff == null) {
    let e = 3;
    if (/只需|顺手|简单|5分钟|十分钟/.test(n.text || '')) e = 2;
    else if (/复杂|深度|重构|搭建|体系/.test(n.text || '')) e = 4;
    else if (n.ur >= 4) e = 4;
    else if (n.ur <= 2) e = 2;
    n.eff = clamp(e, 1, 5);
  }
  n.val = clamp(n.val, 1, 5); n.eff = clamp(n.eff, 1, 5);
}
function isQuickWin(n) { return n.val >= 4 && n.eff <= 2; }
function veKey(val, eff) {
  const v = val >= 4, e = eff >= 3;
  if (v && !e) return 'quick';
  if (v && e) return 'major';
  if (!v && !e) return 'easy';
  return 'trap';
}
const VE = {
  quick: { label: '快速赢 · 高价值低费力', icon: '⚡', color: PALETTE_UR[2] },
  major: { label: '主战役 · 高价值高费力', icon: '🏔', color: PALETTE_UR[0] },
  easy: { label: '顺手活 · 低价值低费力', icon: '🍃', color: svgMuted() },
  trap: { label: '陷阱 · 低价值高费力', icon: '🕳', color: PALETTE_UR[3] },
};
const VE_ORDER = ['quick', 'major', 'easy', 'trap'];
const DAY_CAPACITY_MIN = 480; // 日视图可做完性：默认 8 小时容量（⚙ 设置可改）
/* ============ 时间预算（基础设置：每周 N 天 × 每天 M 小时） ============ */
/* v8.21: 全局空闲时段（可多段）——基础设置里「空闲时长」改为时间段；
   小时数由时段 mins 汇总派生，兼容旧 globalWorkdayHours / globalWeekendHours。 */
function globalTimeWindows(kind) {
  const c = (state.meta && state.meta.capacity) || {};
  const key = kind === 'weekend' ? 'globalWeekendWins' : 'globalWorkdayWins';
  const raw = Array.isArray(c[key]) ? c[key] : [];
  const out = [];
  raw.forEach(w => {
    const st = parseAIStart(w && w.start);
    const mins = clamp(+(w && w.mins) || 0, 15, 720);
    if (st && mins) out.push({ start: st, mins, end: minToHm(hmToMin(st) + mins) });
  });
  if (!out.length) {
    const hrs = +(kind === 'weekend' ? c.globalWeekendHours : c.globalWorkdayHours) || 0;
    if (hrs > 0) {
      const mins = Math.round(hrs * 60);
      out.push({ start: '09:00', mins, end: minToHm(9 * 60 + mins) });
    }
  }
  return out;
}
function winsTotalHours(wins) {
  return Math.round(((wins || []).reduce((s, w) => s + (w.mins || 0), 0) / 60) * 10) / 10;
}
/** 将项目时段裁剪为落在全局空闲窗口内的片段；globalWins 空 = 不裁剪。 */
function clipWinsToGlobal(wins, globalWins) {
  const globals = (globalWins || []).map(g => {
    const st = parseAIStart(g && g.start);
    const gs = st ? hmToMin(st) : NaN;
    const ge = g && g.end ? hmToMin(g.end) : gs + (+(g && g.mins) || 0);
    return (!st || !(ge > gs)) ? null : { gs, ge };
  }).filter(Boolean);
  if (!globals.length) {
    return (wins || []).map(w => {
      const st = parseAIStart(w && w.start);
      const mins = clamp(+(w && w.mins) || 0, 15, 720);
      return st && mins ? { start: st, mins } : null;
    }).filter(Boolean);
  }
  const out = [];
  (wins || []).forEach(w => {
    const st = parseAIStart(w && w.start);
    const wm = clamp(+(w && w.mins) || 0, 15, 720);
    if (!st || !wm) return;
    const ws = hmToMin(st);
    const we = ws + wm;
    globals.forEach(g => {
      const is = Math.max(ws, g.gs);
      const ie = Math.min(we, g.ge);
      if (ie - is >= 15) out.push({ start: minToHm(is), mins: clamp(ie - is, 15, 720) });
    });
  });
  return out;
}
function clipProjectWinsToGlobals(wins) {
  let out = wins || [];
  const gWd = globalTimeWindows('workday');
  const gWe = globalTimeWindows('weekend');
  if (gWd.length) out = clipWinsToGlobal(out, gWd);
  if (gWe.length) out = clipWinsToGlobal(out, gWe);
  return out;
}
function capacitySettings() {
  const c = (state.meta && state.meta.capacity) || {};
  // v8.21: 优先读多段时段汇总；无时段时回落旧小时字段（globalTimeWindows 已内嵌迁移）
  const globalWorkday = winsTotalHours(globalTimeWindows('workday'));
  const globalWeekend = winsTotalHours(globalTimeWindows('weekend'));

  // 如果有全局设定，使用全局设定减去其他项目占用
  if (globalWorkday > 0 || globalWeekend > 0) {
    const otherUsage = getOtherProjectsTimeUsage();
    const workday = Math.max(0, globalWorkday - otherUsage.workdayPerDay);
    const weekend = Math.max(0, globalWeekend - otherUsage.weekendPerDay);
    const avgPerDay = (workday * 5 + weekend * 2) / 7;
    return {
      daysPerWeek: 7,
      hoursPerDay: Math.max(0.5, avgPerDay),
      workdayHours: workday,
      weekendHours: weekend,
      globalWorkdayHours: globalWorkday,
      globalWeekendHours: globalWeekend,
      otherUsage: otherUsage,
    };
  }

  // v7.0 兼容：从项目级别读取（旧逻辑）
  const projCap = c[state.activeWorkflowId] || {};
  if (projCap.workdayHours || projCap.weekendHours) {
    const workday = projCap.workdayHours || 0;
    const weekend = projCap.weekendHours || 0;
    const avgPerDay = (workday * 5 + weekend * 2) / 7;
    return {
      daysPerWeek: 7,
      hoursPerDay: Math.max(0.5, avgPerDay),
      workdayHours: workday,
      weekendHours: weekend,
    };
  }

  return {
    daysPerWeek: clamp(+c.daysPerWeek || 5, 1, 7),
    hoursPerDay: clamp(+c.hoursPerDay || 8, 0.5, 16),
    workdayHours: 0,
    weekendHours: 0,
  };
}

// v7.5: 计算其他项目已占用的时间
function getOtherProjectsTimeUsage() {
  const currentWfId = state.activeWorkflowId;
  let workdayTotal = 0, weekendTotal = 0;

  // 遍历所有项目，累加其他项目的时间预算
  (state.workflows || []).forEach(wf => {
    if (wf.id === currentWfId) return; // 跳过当前项目
    const wfCap = (state.meta && state.meta.capacity && state.meta.capacity[wf.id]) || {};
    workdayTotal += wfCap.workdayHours || 0;
    weekendTotal += wfCap.weekendHours || 0;
  });

  // 计算每天平均占用
  const workdayPerDay = workdayTotal;
  const weekendPerDay = weekendTotal;

  return {
    workdayTotal,
    weekendTotal,
    workdayPerDay,
    weekendPerDay,
    weekTotal: workdayTotal * 5 + weekendTotal * 2,
  };
}
function dayCap() { return Math.round(capacitySettings().hoursPerDay * 60); }
/* v8.2: AI start 字段解析扩展 —— 除 'HH:MM' 外兼容「19点」「19点30」「7:30 pm」「19.30」「19」。 */
function parseAIStart(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{1,2})[:：.](\d{2})\s*([ap]\.?m\.?)?$/i);
  if (m) {
    let h = +m[1];
    if (m[3] && /p/i.test(m[3]) && h < 12) h += 12;
    if (m[3] && /^a/i.test(m[3]) && h === 12) h = 0;
    return pad2(clamp(h, 0, 23)) + ':' + pad2(clamp(+m[2], 0, 59));
  }
  m = s.match(/^(\d{1,2})\s*点\s*(?:(\d{1,2})\s*分?)?$/);
  if (m) return pad2(clamp(+m[1], 0, 23)) + ':' + pad2(clamp(+(m[2] || 0), 0, 59));
  m = s.match(/^(\d{1,2})$/);
  if (m) return pad2(clamp(+m[1], 0, 23)) + ':00';
  return '';
}
function hmToMin(hm) { const p = String(hm || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
function minToHm(mins) { mins = Math.round(mins); return pad2(clamp(Math.floor(mins / 60), 0, 23)) + ':' + pad2(clamp(mins % 60, 0, 59)); }
/* v8.2: 项目「每日可安排窗口」支持多段（meta.capacity[wfId].wins:[{start,mins}]）；
   兼容旧 winStart/winEnd。返回 [{start,end,mins}]；
   v8.21: 项目未设 → 回落全局空闲时段；仍空 = 调用方按全天可排处理。 */
function wfTimeWindows(wfId) {
  const cap = (state.meta && state.meta.capacity && state.meta.capacity[wfId]) || {};
  const out = [];
  if (Array.isArray(cap.wins)) {
    cap.wins.forEach(w => {
      const st = parseAIStart(w && w.start);
      const mins = clamp(+(w && w.mins) || 0, 15, 720);
      if (st && mins) out.push({ start: st, mins, end: minToHm(hmToMin(st) + mins) });
    });
  }
  if (!out.length && cap.winStart && cap.winEnd) {
    const mins = hmToMin(cap.winEnd) - hmToMin(cap.winStart);
    if (mins > 0) out.push({ start: cap.winStart, mins, end: cap.winEnd });
  }
  if (!out.length) {
    // 用 today0() 而非模块 TODAY，便于 smoke/grabFn stub
    const d = today0();
    const kind = (d.getDay() === 0 || d.getDay() === 6) ? 'weekend' : 'workday';
    return globalTimeWindows(kind);
  }
  return out;
}
/* 项目今天是否已开始（startDate 在未来的项目不进入今日行动/英雄卡） */
function wfStarted(wf) {
  if (!wf || !wf.startDate) return true;
  const sd = new Date(wf.startDate + 'T00:00:00');
  if (isNaN(sd.getTime())) return true;
  return sd.getTime() <= today0().getTime();
}
/* v7.9: 全局英雄卡候选 —— 跨全部「已开始+未归档」项目，保证今日行动里
   从任何项目进入看到的「当下最重要」都相同（不再随当前项目切换而变）。
   v8.2: 候选池与今日清单同源（todayExecutionPoolFor）—— 原先只走 buildView('day')，
   会漏掉 daysLeft<=1 / 逾期 / time到期 等非 day 尺度叶子（表现为「清单第一项没当选 MIT」）。 */
function heroGlobalCandidates() {
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  activeWorkflows().forEach(wf => {
    if (_wfOnly && wf.id !== state.activeWorkflowId) return;  // v8.7: 「只看当前项目」过滤
    if (!wfStarted(wf)) return;
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    todayExecutionPoolFor(nodes).filter(n => !n._overflow).forEach(n => out.push({ node: n, wfId: wf.id, wfName: wf.name || '' }));
  });
  out.sort((a, b) => focusScore(b.node) - focusScore(a.node) || b.node.im - a.node.im
    || ((a.node.daysLeft == null ? 999 : a.node.daysLeft) - (b.node.daysLeft == null ? 999 : b.node.daysLeft)));
  return out;
}
function weekCap() {
  const c = capacitySettings();
  // v7.0: 如果有工作日/周末分别设置，按实际计算
  if (c.workdayHours > 0 || c.weekendHours > 0) {
    return Math.round((c.workdayHours * 5 + c.weekendHours * 2) * 60);
  }
  return Math.round(c.daysPerWeek * c.hoursPerDay * 60);
}
function fmtHours(min) { return (Math.round(min / 60 * 10) / 10) + ''; }
/* v7.7: 容量分母可能为 0（其他项目把全局预算占满）—— 直接相除会得到 NaN/Infinity 写进 style */
function pctOf(a, b) { return b > 0 ? clamp(Math.round(a / b * 100), 0, 100) : (a > 0 ? 100 : 0); }
function goldChainIds(topId) {
  const ids = new Set();
  let c = topId ? byId(topId) : null;
  while (c) { ids.add(c.id); c = c.parentId ? byId(c.parentId) : null; }
  return ids;
}
function isUnderTopNode(n, topId) {
  if (!n || !topId) return false;
  const top = byId(topId); if (!top) return false;
  return (function walk(x) { if (x.id === n.id) return true; return (x._children || []).some(walk); })(top);
}
function parseEstimateMinutes(text) {
  const t = text || '';
  let m = t.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (m) return clamp(Math.round(parseFloat(m[1]) * 60), 1, 999);
  m = t.match(/(\d+)\s*分钟|(\d+)\s*min\b/i);
  if (m) return clamp(+(m[1] || m[2]), 1, 999);
  if (/半天/.test(t)) return 240;
  if (/5\s*分钟|五分钟/.test(t)) return 5;
  return null;
}
function ensureEstimate(n, isLeaf) {
  if (n.estimateMinutes == null) {
    const p = parseEstimateMinutes(n.text);
    if (p != null) n.estimateMinutes = p;
    else if (isLeaf) n.estimateMinutes = 30;
  }
  if (n.estimateMinutes != null) n.estimateMinutes = clamp(+n.estimateMinutes || 0, 0, 999) || null;
  if (n.actualMinutes != null) n.actualMinutes = clamp(+n.actualMinutes || 0, 0, 9999) || null;
}
function ensureAllEstimates() {
  if (_estTick === _tickN) return;
  getCachedTree(state.nodes);
  state.nodes.forEach(n => {
    const leaf = n.parentId && n._children.length === 0;
    ensureEstimate(n, leaf);
  });
  _estTick = _tickN;
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function dateKey(d) {
  if (!d) {
    const at = TODAY.getTime();
    if (_dkCache.at !== at) {
      const t = today0();
      _dkCache = { at, key: t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) };
    }
    return _dkCache.key;
  }
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function parseMetrics(text, node) {
  const t = text || '';
  if (/^O[:：\s]|Objective/i.test(t)) node.role = 'O';
  if (/^KR[:：\s]|关键结果/.test(t)) node.role = 'KR';
  if (/习惯|打卡|日课|日更/.test(t)) node.role = node.role || 'habit';
  let m = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) { node.targetDone = +m[1]; node.targetNum = +m[2]; return; }
  m = t.match(/目标\s*(\d+)|共\s*(\d+)\s*次|×\s*(\d+)/);
  if (m) node.targetNum = +(m[1] || m[2] || m[3]);
}
function ensureMetrics(n) {
  if (!n.role) n.role = '';
  if (n.targetNum != null) n.targetNum = clamp(+n.targetNum || 0, 0, 9999) || null;
  if (n.targetDone == null) n.targetDone = 0;
  else n.targetDone = clamp(+n.targetDone || 0, 0, 9999);
}
function metricProgress(n) {
  if (!n) return null;
  if (n.targetNum > 0) {
    const done = n.targetDone || 0, pct = Math.round(done / n.targetNum * 100);
    // v7.7: 超额完成时 pct 会 >100，写进 style.width 或刻度条没有意义；封顶展示、另给 over 标记
    return { done, tgt: n.targetNum, pct: clamp(pct, 0, 100), pctReal: pct, over: pct > 100 };
  }
  if (n.role === 'O') {
    const p = subtreeProgress(n);
    return p ? { done: p.done, tgt: p.total, pct: p.pct, kind: 'leaf' } : null;
  }
  return null;
}
function paceStatus(n) {
  const m = metricProgress(n);
  if (!m || !n.deadlineDate) return null;
  const start = today0();
  const end = new Date(n.deadlineDate); end.setHours(23, 59, 59, 999);
  const total = Math.max(1, end.getTime() - start.getTime());
  const elapsed = clamp(Date.now() - start.getTime(), 0, total);
  const expect = Math.round(m.tgt * elapsed / total);
  const ahead = (m.done || 0) - expect;
  return { expect, done: m.done || 0, ahead, m };
}
function bumpDailyCompletion() {
  if (!state.meta) state.meta = {};
  if (!state.meta.dailyCompletions) state.meta.dailyCompletions = {};
  const dk = dateKey();
  state.meta.dailyCompletions[dk] = (state.meta.dailyCompletions[dk] || 0) + 1;
}
/* ============ 自动评分（每项工作 + 今日总评分） ============ */
function ensureScoreMeta() {
  if (!state.meta) state.meta = {};
  if (!state.meta.scoreLog) state.meta.scoreLog = {};
  if (!state.meta.dayNotes) state.meta.dayNotes = {};
  if (!state.meta.ritual) state.meta.ritual = { morning: '08:30', evening: '21:30', on: true };
  if (!state.meta.pendingActions) state.meta.pendingActions = [];
  if (!state.meta.weekPlans) state.meta.weekPlans = {};
  if (!state.meta.energyLog) state.meta.energyLog = {};
  if (!state.meta.inbox) state.meta.inbox = [];
  if (!state.meta.planShare) state.meta.planShare = {};
  if (!state.meta.eveningDispo) state.meta.eveningDispo = {};
  if (!state.meta.goodThings) state.meta.goodThings = {};
  // v8.12 仪式历史：晨计划打开快照（每天一条，dk 键）
  if (!state.meta.morningPlans) state.meta.morningPlans = {};
  // v8.20: 全局资料（显示名等）
  if (!state.meta.profile || typeof state.meta.profile !== 'object') state.meta.profile = {};
  if (state.meta.profile.displayName == null) state.meta.profile.displayName = '';
  if (!state.meta.prefs || typeof state.meta.prefs !== 'object') state.meta.prefs = {};
  if (!state.meta.prefs.pomoMinutes) state.meta.prefs.pomoMinutes = 25;
  if (state.meta.prefs.simpleMode == null) state.meta.prefs.simpleMode = true;
  // v8.23: 今日清单用户置顶（按日）；跨日标记
  if (!state.meta.todayListPins || typeof state.meta.todayListPins !== 'object') state.meta.todayListPins = {};
  if (state.meta.lastTodayDk == null) state.meta.lastTodayDk = '';
}

/* v7.7: 期限措辞的唯一出口。旧代码两处各写一份「剩余 N 天 / 已逾期 N 天」，
   daysLeft=0 时显示「剩余 0 天」，两处还会因 fallback 字段不同步而给出不同答案。 */
function deadlineBadge(n, emptyText) {
  if (!n) return emptyText || '无期限';
  if (n.deadlineDate instanceof Date && !isNaN(n.deadlineDate)) {
    const d = n.daysLeft;
    if (n.overdue) return `已逾期 ${-d} 天`;
    if (d === 0) return '今天到期';
    if (d === 1) return '明天到期';
    if (d <= 14) return `剩余 ${d} 天`;
    return `${dateKey(n.deadlineDate)}（剩 ${d} 天）`;
  }
  return n.deadlineText || n.deadline || emptyText || '无期限';
}

/* v6.3 折叠子块（时间审计 / 停滞 / 精力，状态记忆） */
const FOLD_KEY = 'goalflow.folds';
const FOLD_DEFAULT = { audit: false, stale: false, energy: false, done: false }; // false=默认折叠（v8.18 起「今日已完成」默认收起）
function foldState() { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) { return {}; } }
function foldOpen(name) { const s = foldState(); return name in s ? !!s[name] : (FOLD_DEFAULT[name] !== false); }
function bindFoldPersist(box, name) {
  const d = box.querySelector('details.fold');
  if (!d) return;
  const syncAria = () => {
    const sum = d.querySelector('summary');
    if (sum) sum.setAttribute('aria-expanded', d.open ? 'true' : 'false');
  };
  syncAria();
  d.addEventListener('toggle', () => {
    syncAria();
    const s = foldState(); s[name] = d.open;
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(s)); } catch (e) { }
  });
}

/* ============ v6.3 撤销 toast（危险操作 10 秒可撤销） ============ */
let undoTimer = null;
function showUndoToast(msg, restore) {
  const t = document.getElementById('toast'); if (!t) { restore && 0; return; }
  clearTimeout(undoTimer);
  t.innerHTML = `<span>${esc(msg)}</span><button type="button" id="toastUndo">撤销</button>`;
  t.classList.add('show');
  t.querySelector('#toastUndo').onclick = () => {
    clearTimeout(undoTimer); t.classList.remove('show');
    try { restore(); } catch (e) { }
  };
  undoTimer = setTimeout(() => t.classList.remove('show'), 10000);
}
// v6.9 普通 toast（可自动消失或手动关闭）
let toastTimer = null;
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return { remove: () => {} };
  clearTimeout(toastTimer);
  t.innerHTML = `<span>${esc(msg)}</span>`;
  t.classList.add('show');
  if (duration > 0) {
    toastTimer = setTimeout(() => t.classList.remove('show'), duration);
  }
  return { remove: () => { clearTimeout(toastTimer); t.classList.remove('show'); } };
}
function scoreGrade(t) { return t >= 120 ? 'S' : t >= 80 ? 'A' : t >= 40 ? 'B' : t > 0 ? 'C' : '—'; }
function scoreDoneItem(n) {
  let s = (n.im || 3) * 10;
  const reasons = [`重要${n.im || 3} → ${(n.im || 3) * 10}`];
  if (n.deadlineDate) {
    if (n.overdue) { s -= 8; reasons.push('逾期 -8'); }
    else { s += 12; reasons.push('期限内完成 +12'); }
  }
  const est = n.estimateMinutes, act = n.actualMinutes;
  if (est && act != null) {
    if (act <= est) { s += 15; reasons.push('时长达标 +15'); }
    else if (act <= est * 1.5) { s += 6; reasons.push('略超时 +6'); }
    else { reasons.push('超时较多 +0'); }
  }
  if (isHabitLike(n)) { s += 5; reasons.push('习惯打卡 +5'); }
  return { score: clamp(Math.round(s), 0, 100), reason: reasons.join(' · ') };
}
function scorePomoItem(n, minutes) {
  const m = minutes || 25;
  let s = 10 + (n ? (n.im || 3) * 2 : 6);
  if (m >= 25) s += 4;
  if (m >= 50) s += 4;   // v6.5 长专注加权
  if (m >= 90) s += 6;   // v6.5 深潜块（BRAC 完整周期）加权
  const tag = m >= 90 ? '深潜' : (m >= 50 ? '长专注' : '专注');
  return { score: clamp(Math.round(s), 0, 40), reason: `完整${tag} ${m}′${n ? ` · 重要${n.im || 3}` : ''}` };
}
function appendScore(n, kind, extra) {
  if (!n) return;
  ensureScoreMeta();
  const dk = dateKey();
  const log = state.meta.scoreLog[dk] || { entries: [] };
  const sc = kind === 'pomo' ? scorePomoItem(n, (extra && extra.minutes) || 25) : scoreDoneItem(n);
  log.entries.push({ t: Date.now(), kind, nodeId: n.id, text: n.text, wfId: state.activeWorkflowId || '', score: sc.score, reason: sc.reason });
  state.meta.scoreLog[dk] = log;
  saveMeta();
}
function removeTodayScore(nodeId, kind) {
  ensureScoreMeta();
  const dk = dateKey();
  const log = state.meta.scoreLog[dk];
  if (!log) return;
  log.entries = log.entries.filter(e => !(e.nodeId === nodeId && e.kind === kind));
  saveMeta();
}
/* v8.14: 「✅ 今日已完成」行的单项得分——从当日 scoreLog 倒序找该节点最新一条 done 记录（pomo 不算）。
   纯函数：entry 需含 nodeId（executionLog 条目）；dayScoreLog = state.meta.scoreLog[dk]（可空）。
   返回 {score, reason} 或 null（找不到/脏数据安全）。 */
function scoreOfDoneEntry(entry, dayScoreLog) {
  if (!entry || !entry.nodeId || !dayScoreLog || !Array.isArray(dayScoreLog.entries)) return null;
  for (let i = dayScoreLog.entries.length - 1; i >= 0; i--) {
    const e = dayScoreLog.entries[i];
    if (e && e.kind === 'done' && e.nodeId === entry.nodeId) return { score: e.score, reason: e.reason || '' };
  }
  return null;
}
/* v8.12: 评分聚合抽成纯函数——晚回顾历史（historyEveningDays）按任意 dk 复用同一口径 */
function summarizeScoreEntries(entries) {
  entries = entries || [];
  const total = entries.reduce((a, e) => a + (e.score || 0), 0);
  const pomos = entries.filter(e => e.kind === 'pomo').length;
  const dones = entries.filter(e => e.kind === 'done').length;
  return { total, count: dones, pomos, focusMin: pomos * 25, entries, grade: scoreGrade(total) };
}
function scoreForDk(dk) {
  ensureScoreMeta();
  return summarizeScoreEntries((state.meta.scoreLog[dk] || { entries: [] }).entries);
}
function todayScore() { return scoreForDk(dateKey()); }
function setNodeDone(n, checked) {
  if (checked && isRecurringTask(n)) {
    if (n.estimateMinutes && n.actualMinutes == null) n.actualMinutes = n.estimateMinutes;
    bumpDailyCompletion();
    appendExecutionLog(state.activeWorkflowId, n);
    appendScore(n, 'done');
    n.lastRecDone = dateKey();
    if (n.recurrence.type === 'interval') n.recurrence.anchorDate = dateKey(addDays(today0(), n.recurrence.interval || 1));
    n.done = false; n.doneAt = null;
    return;
  }
  n.done = !!checked;
  n.doneAt = checked ? Date.now() : null;
  if (checked) {
    if (n.estimateMinutes && n.actualMinutes == null) n.actualMinutes = n.estimateMinutes;
    if (state.topId && isUnderTopNode(n, state.topId)) n.touchedAt = Date.now();
    const chain = goldChainIds(state.topId);
    if (chain.has(n.id)) n.touchedAt = Date.now();
    getCachedTree(state.nodes);
    const isLeaf = n.parentId && n._children.length === 0;
    if (isLeaf) {
      bumpDailyCompletion();
      if ((n.recur || n.role === 'habit' || n.role === 'KR') && n.targetNum > 0 && !(n.timesPerWeek > 0)) n.targetDone = (n.targetDone || 0) + 1;
      appendExecutionLog(state.activeWorkflowId, n);
      appendScore(n, 'done');
      updateHabitStreak(n, state.activeWorkflowId, true);
      logHabitCheck(n, state.activeWorkflowId, true);
    }
  } else {
    removeTodayScore(n.id, 'done');
    removeExecutionLogEntry(n.id);
    updateHabitStreak(n, state.activeWorkflowId, false);
    logHabitCheck(n, state.activeWorkflowId, false);
  }
  // v8.10: 统一在出口落盘 meta —— 此前 updateHabitStreak/logHabitCheck 写在 appendScore/removeTodayScore
  // 内部的 saveMeta 之后，调用方又只 save()，习惯打卡的连续天数与强度日志刷新页面即回滚。
  saveMeta();
}
function category(im, ur) {
  if (im >= 4 && ur >= 4) return CAT.now;
  if (im >= 4 && ur < 4) return CAT.core;
  if (im < 4 && ur >= 4) return CAT.distract;
  return CAT.noise;
}
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DAY_SLOTS = [
  ['', '未钉时段'], ['h0', '清晨'], ['h1', '上午'], ['h2', '中午'], ['h3', '午后'],
  ['h4', '下午'], ['h5', '傍晚'], ['h6', '夜间']
];

let TODAY = new Date();                 // 渲染时使用"今天"
const today0 = () => { const d = new Date(TODAY); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nextWeekday = (from, wd) => { const x = new Date(from); let diff = (wd - x.getDay() + 7) % 7; if (diff === 0) diff = 7; x.setDate(x.getDate() + diff); return x; };
const endOfWeek = d => { const x = new Date(d); x.setDate(x.getDate() + ((7 - x.getDay()) % 7)); return x; };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* ============ 日期 / 排期解析 ============ */
const WK = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
/* v7.7: 「两周后」「十天内」这类中文数字原先解析不出来 —— 期限标签写得进、日期算不出，
   于是同一条期限在得分档（剩余 X 天）、逾期判定、徽章文案三处各说各话。统一先转成数字。 */
const CN_N = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNum(tok) {
  if (/^\d+$/.test(tok)) return +tok;
  if (tok === '半') return 0.5;
  let n = 0, cur = -1;
  for (const ch of tok) {
    if (CN_N[ch] !== undefined) cur = (cur < 0 ? 0 : cur * 10) + CN_N[ch];
    else if (ch === '十') { n += (cur < 0 ? 1 : cur) * 10; cur = 0; }
    else return NaN;
  }
  return n + Math.max(cur, 0);
}
function parseDeadline(text, anchor) {
  const t = text || '';
  const base = today0();                                    // daysLeft 永远以「今天」为基准
  const a0 = anchor ? startOfDay(new Date(anchor)) : base;  // 相对周期标签（第X周）的锚点：项目开始日
  const mk = (label, date) => { const d = startOfDay(date); const dl = Math.round((d - base) / 86400000); return { label, date: d, daysLeft: dl, overdue: dl < 0 }; };
  let m;
  if (/今天|今日/.test(t)) return mk('今天', base);
  if (/明天/.test(t)) return mk('明天', addDays(base, 1));
  if (/后天/.test(t)) return mk('后天', addDays(base, 2));
  // v7.6: 支持 YYYY-MM-DD 格式
  m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { let yr = +m[1], mo = +m[2], da = +m[3]; let d = new Date(yr, mo - 1, da); return mk(`${yr}-${pad2(mo)}-${pad2(da)}`, d); }
  m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (m) { let mo = +m[1], da = +m[2]; let yr = base.getFullYear(); let d = new Date(yr, mo - 1, da); if (d < base) d = new Date(yr + 1, mo - 1, da); return mk(`${mo}月${da}日`, d); }
  m = t.match(/(下)?\s*(周|星期)\s*([一二三四五六日天])/);
  if (m) {
    const wd = WK[m[3]];
    // v7.7: 「下周X」= 下自然周（下一起算）的第 X 天，不再用「下个X + 7」，避免今天已过周X时多算一周
    let d;
    if (m[1]) { const nextMon = addDays(base, 7 - ((base.getDay() + 6) % 7)); d = addDays(nextMon, (wd === 0 ? 6 : wd - 1)); }
    else d = nextWeekday(base, wd);
    return mk(`${m[1] || ''}周${m[3]}`, d);
  }
  if (/本周\s*内?/.test(t)) return mk('本周内', endOfWeek(base));
  if (/下周/.test(t)) return mk('下周', endOfWeek(addDays(base, 7)));
  if (/下月底|下月末/.test(t)) return mk('下月底', new Date(base.getFullYear(), base.getMonth() + 2, 0));
  if (/本月底|月底|月末/.test(t)) return mk('月底', new Date(base.getFullYear(), base.getMonth() + 1, 0));
  if (/本月/.test(t)) return mk('本月', new Date(base.getFullYear(), base.getMonth() + 1, 0));
  // v7.6: 支持 "第X周" 格式（v7.7: 以项目开始日为锚点，第 N 周 = 锚点起第 N×7 天）
  m = t.match(/第\s*(\d+)\s*周/);
  if (m) { let weeks = clamp(+m[1], 1, 52); let d = addDays(a0, weeks * 7 - 1); return mk(`第${weeks}周`, d); }
  // v7.7: 「3 天后 / 两周内 / 20 天」原先掉到最后返回 date:null ——
  //   标签存得下、日期算不出，得分和逾期判定就都不认这条期限。补齐相对天 / 周 / 月。
  m = t.match(/(\d+|[一二两三四五六七八九十半]+)\s*(个)?\s*(天|日|周|星期|月)\s*(?:以?后|之?内)?/);
  if (m && !(m[3] === '日' && !/(?:后|内)/.test(m[0]))) {
    const n = cnNum(m[1]) || 0;
    if (n > 0) {
      if (m[3] === '天' || m[3] === '日') return mk(`${m[1]}天后`, addDays(base, clamp(n, 1, 365)));
      if (m[3] === '周' || m[3] === '星期') return mk(`${m[1]}周后`, addDays(base, Math.round(clamp(n, 1, 52) * 7)));
      if (n >= 1) return mk(`${m[1]}个月后`, new Date(base.getFullYear(), base.getMonth() + Math.floor(Math.min(n, 24)) + 1, 0));
      return mk(`${m[1]}个月`, addDays(base, Math.round(n * 30)));   // 半个月 = 15 天
    }
  }
  return { label: '', date: null, daysLeft: null, overdue: false };
}

/* v7.7: 期限唯一写入口 —— 修掉「parseDeadline 返回对象却被当成 Date 赋值」的类型错乱，
   并保证 deadline（标签）/ deadlineText（可编辑标签）/ deadlineDate / daysLeft / overdue 五个字段永远同步。
   val 可以是：Date、'YYYY-MM-DD'、自然语言（周五 / 月底 / 第2周）、或空值（清除）。 */
function setNodeDeadline(node, val, anchor) {
  if (!node) return;
  if (val instanceof Date) { const d = startOfDay(val); val = dateKey(d); anchor = anchor || null; }
  else if (typeof val === 'object' && val) val = val.date || val.label || '';
  if (typeof val === 'string') val = val.trim();
  if (!val) {
    node.deadline = ''; node.deadlineText = ''; node.deadlineDate = null;
    node.daysLeft = null; node.overdue = false; node.deadlineAnchor = null;
    return;
  }
  const dl = parseDeadline(val, anchor);
  node.deadline = dl.label || val;
  node.deadlineText = node.deadline;
  node.deadlineDate = dl.date;
  node.daysLeft = dl.daysLeft;
  node.overdue = dl.overdue;
  // 只有「第X周」这类相对标签才需要锚点；绝对日期每年重算结果一致，锚点留空
  node.deadlineAnchor = (/第\s*\d+\s*周/.test(node.deadline) && dl.date) ? dateKey(anchor ? startOfDay(new Date(anchor)) : today0()) : null;
}

/* ============ 时间尺度嗅探 ============ */
function inferScale(text, deadlineDate, daysLeft, hasChildren) {
  if (/每天|每日|天天|日课|日更|每天/.test(text)) return 'day';
  if (/每周|一周|周会|周报|每星期|双周/.test(text)) return 'week';
  if (/每月|月度|月报|每个月|月更|半月/.test(text)) return 'month';
  if (/今年|年度|这一年|全年|年底|本年|长期|主线|一辈子|终身|一直|战略|核心|关键|目标/.test(text)) return 'year';
  if (deadlineDate) {
    if (daysLeft <= 1) return 'day';
    if (daysLeft <= 7) return 'week';
    return 'month';
  }
  return hasChildren ? 'year' : 'month';
}
function deadlineUrgency(dl) {
  if (!dl || dl.date == null) return null;
  if (dl.overdue) return 5;
  const d = dl.daysLeft;
  if (d <= 2) return 5;
  if (d <= 7) return 4;   // v7.7: 删掉与上一档同值的 d<=4 死分支
  if (d <= 14) return 3;
  return 2;
}

/* ============ 解析层 ============ */
/* 节点工厂：所有新节点走这里，字段一处维护（避免 5 处字面量同步漏字段） */
function newNode(partial) {
  const n = {
    id: partial.id || 'n0', text: partial.text || '', im: 3, ur: 3, val: null, eff: null, role: '',
    targetNum: null, targetDone: 0, deadline: '', deadlineText: '', deadlineDate: null, deadlineAnchor: null, daysLeft: null, overdue: false,
    done: false, doneAt: null, touchedAt: null, createdAt: partial.createdAt || Date.now(),
    estimateMinutes: null, actualMinutes: null, recur: false, scale: null, slot: '', time: '', timeDk: '', tags: [], lastRecDone: '',
    ifThen: '', premortem: '', status: '', waitNote: '', followUp: '', followUpAt: null, timesPerWeek: 0, recurrence: null,
    conf: 0, confNote: '', confAt: null, source: '', dropped: false,
    _manualIm: false, _manualUr: false,
  };
  Object.assign(n, partial || {});
  return n;
}
/* 文本变更后重推断：保留手动调过的 im/ur（_manualIm/_manualUr） */
function applySuggestions(node, text, opts) {
  opts = opts || {};
  const imWords = ['核心', '关键', '战略', '主线', '长期', '目标', '健康', '家庭', '成长', '收入', '客户', '重要', '年度', '学习', '复盘', '体系', '沉淀'];
  const urWords = ['紧急', '今天', '本周', '马上', '立刻', '立即', '尽快', '截止', '催', 'deadline', '周五', '敲定', '给方案', '催办'];
  const noiseWords = ['噪音', '刷', '无目的', '闲', '随便', '摸鱼'];
  let im = 3, ur = 3;
  const negUr = text.includes('不紧急');
  imWords.forEach(w => { if (text.includes(w)) im++; });
  urWords.forEach(w => { if (text.includes(w)) { if (w === '紧急' && negUr) return; ur++; } });
  noiseWords.forEach(w => { if (text.includes(w)) { im = 1; ur = 1; } });
  if (text.includes('不重要')) im = Math.min(im, 2);
  const dl = parseDeadline(text);
  node.deadline = dl.label; node.deadlineDate = dl.date; node.daysLeft = dl.daysLeft; node.overdue = dl.overdue;
  const dur = deadlineUrgency(dl);
  if (dur != null) ur = Math.max(ur, dur);
  // 手动调过的 im/ur 不被文本推断覆盖（_manualIm/_manualUr 由 UI 拖拽/四象限/树形编辑设置）
  if (!node._manualIm) node.im = clamp(im, 1, 5);
  if (!node._manualUr) node.ur = clamp(ur, 1, 5);
  if (node.scale == null) node.scale = inferScale(text, dl.date, dl.daysLeft, false);
  node.recur = inferRecur(text, node.scale);
  if (node.timesPerWeek == null || !node.timesPerWeek) node.timesPerWeek = parseTimesPerWeek(text);
  ensureVE(node);
  const est = parseEstimateMinutes(text);
  if (est != null && !node.estimateMinutes) node.estimateMinutes = est;
  parseMetrics(text, node);
  ensureMetrics(node);
}
function parseText(raw, today) {
  if (today) TODAY = today;
  const lines = raw.split(/\r?\n/).map(s => s.replace(/\s+$/, '')).filter(l => l.trim().length);
  if (!lines.length) return [];
  const nodes = []; let idc = 0; const stack = [];
  lines.forEach((line, i) => {
    const indent = line.length - line.trimStart().length;
    const content = line.trim();
    const clean = content.replace(/^([-*•·]|\d+[.、])\s+/, '');
    const node = newNode({ id: 'n' + (idc++), text: clean, source: 'parse' });
    applySuggestions(node, clean);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    node.parentId = (i > 0) ? (stack.length ? stack[stack.length - 1].node.id : nodes[0].id) : null;
    nodes.push(node);
    stack.push({ node, indent });
  });
  computeTree(nodes);
  // 二次推断：有子节点的分支按 hasChildren 重判尺度
  nodes.forEach(n => { if (n._children.length) { const dl = n.deadlineDate ? { date: n.deadlineDate, daysLeft: n.daysLeft } : null; n.scale = inferScale(n.text, dl ? dl.date : null, dl ? dl.daysLeft : null, true); } });
  return nodes;
}
function computeTree(nodes) {
  nodes.forEach(n => { n._children = []; });
  const byId = {}; nodes.forEach(n => byId[n.id] = n);
  nodes.forEach(n => { if (n.parentId && byId[n.parentId]) byId[n.parentId]._children.push(n); });
  function walk(n, d) { n.depth = d; n._children.forEach(c => walk(c, d + 1)); }
  if (nodes[0]) walk(nodes[0], 0);
  beginTick();
}
function recomputeSchedule(nodes) {
  const base = today0();
  nodes.forEach(n => {
    const label = n.deadline || n.deadlineText;
    if (label) {
      const dl = parseDeadline(label, n.deadlineAnchor || null);
      n.deadline = dl.label || label; n.deadlineText = n.deadline;
      n.deadlineDate = dl.date; n.daysLeft = dl.daysLeft; n.overdue = dl.overdue;
    } else if (n.deadlineDate instanceof Date && !isNaN(n.deadlineDate)) {
      // 只写了日期、没写标签（例如直接取项目结束日）：保留日期，按今天刷新剩余天数
      const d = startOfDay(n.deadlineDate);
      n.deadlineDate = d; n.daysLeft = Math.round((d - base) / 86400000); n.overdue = n.daysLeft < 0;
      n.deadline = dateKey(d); n.deadlineText = n.deadline;
    } else { n.deadlineDate = null; n.daysLeft = null; n.overdue = false; }
  });
  computeTree(nodes);
}
function treeOrder(nodes) {
  const out = []; const root = nodes[0];
  (function w(n) { out.push(n); n._children.forEach(w); })(root || { _children: [] });
  return out;
}

/* ============ 渲染缓存与防抖 ============ */
let _treeCache = null;
let _treeCacheNodes = null;
let _afterChangeTimer = null;
let _saveTimer = null;
let _savePending = false;

function getCachedTree(nodes) {
  if (_treeCacheNodes === nodes && _treeCache) return _treeCache;
  computeTree(nodes);
  _treeCache = nodes;
  _treeCacheNodes = nodes;
  return _treeCache;
}

function invalidateTreeCache() {
  _treeCache = null;
  _treeCacheNodes = null;
  // 结构（parentId/scale/done）可能已变，而 nodes.length 不变：tick 级派生缓存一起作废，
  // 否则 buildView 会用旧 key 命中上一轮的 vis/_vc 图。
  beginTick();
}

/* ===== tick 级计算缓存：一次重绘内 buildView/pickRanked/estimates 只算一遍 =====
   _viewSlot 故意只存一格：不同 scale 会互相顶掉，保留原来「最后一次 buildView 的
   _vc/_val 注解生效」的语义，避免跨尺度复用导致读到别的尺度的子树价值。 */
let _tickN = 0;
let _viewSlot = null;
let _rankSlot = null;
let _estTick = -1;
let _dkCache = { at: -1, key: '' };
function beginTick() {
  _tickN++;
  _viewSlot = null;
  _rankSlot = null;
  _estTick = -1;
}

function debouncedAfterChange() {
  if (_afterChangeTimer) cancelAnimationFrame(_afterChangeTimer);
  _afterChangeTimer = requestAnimationFrame(() => {
    _afterChangeTimer = null;
    afterChange();
  });
}

function throttledSave(delay) {
  delay = delay || 1000;
  _savePending = true;
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (_savePending) {
      _savePending = false;
      save();
    }
  }, delay);
}

/* ============ 优先级打分 ============ */
function isNodeBlocked(n) { return !!(n && n.status === 'blocked'); }
function isNodeWaiting(n) { return !!(n && n.status === 'waiting'); }
function isNodeParked(n) { return isNodeBlocked(n) || isNodeWaiting(n); }
function followUpDue(n) { return !!(n && n.status === 'waiting' && n.followUp && n.followUp <= dateKey()); }
/* v7.7: 精力高峰加权抽成单一函数 —— 原先 focusScore 里加 6 分、focusScoreParts 不列这条，
   「逐项分解之和 ≠ 总分」，英雄卡的「为什么是它」和实际排序对不上。
   峰值时段一 tick 只算一次：pickRanked 排序里每个节点都会调用，避免重复扫 energyLog。 */
let _epbTick = -1, _epbBucket = null;
function energyPeakBucketNow() {
  if (_epbTick === _tickN) return _epbBucket;
  _epbTick = _tickN; _epbBucket = null;
  try {
    const curve = energyCurve();
    if (curve && curve.peak) {
      const bucket = ENERGY_BUCKETS.find(b => b[0] === curve.peak);
      if (bucket && bucket[0] === energyBucketNow()) _epbBucket = bucket;
    }
  } catch (e) { }
  return _epbBucket;
}
function energyPeakBonus(n) {
  if (!n || !n.slot || (n.eff || 3) < 4) return 0;
  if (typeof state === 'undefined' || !state.meta || !state.meta.energyLog) return 0;
  const bucket = energyPeakBucketNow();
  return (bucket && (bucket[2] || []).includes(n.slot)) ? 6 : 0;
}
/* 得分分解：唯一算分入口。hero 卡逐条展示，focusScore 只做取值，两者不可能再背离。 */
function focusScoreParts(n) {
  if (n.done) return { total: -1000, parts: [{ label: '已完成', pts: -1000 }] };
  const parts = [];
  const im = clamp(+n.im || 3, 1, 5);
  parts.push({ label: `重要${im}`, pts: im * 10 });
  if (n.deadlineDate) {
    if (n.overdue) parts.push({ label: '已逾期', pts: 30 });
    else if (n.daysLeft <= 1) parts.push({ label: '1天内到期', pts: 26 });
    else if (n.daysLeft <= 3) parts.push({ label: '3天内到期', pts: 20 });
    else if (n.daysLeft <= 7) parts.push({ label: '本周到期', pts: 13 });
    else if (n.daysLeft <= 14) parts.push({ label: '两周内', pts: 7 });
    else parts.push({ label: '有期限', pts: 3 });
  } else if (im >= 4) {
    parts.push({ label: '长期主线', pts: im >= 5 ? 4 : 2 });
  }
  if (isNodeBlocked(n)) parts.push({ label: '阻塞中', pts: -60 });
  else if (isNodeWaiting(n)) parts.push({ label: '等待中', pts: -45 });
  const eb = energyPeakBonus(n);
  if (eb) parts.push({ label: '钉在精力高峰', pts: eb });
  const sd = stagnantDays(n);
  if (sd > 0 && sd < 999 && im >= 4) parts.push({ label: `停滞${sd}天`, pts: 0, note: true });
  return { parts, total: parts.reduce((a, p) => a + p.pts, 0) };
}
function focusScore(n) { return focusScoreParts(n).total; }
/* v8.13 英雄卡去重：清单内「② 次重要」= 今日执行池里算法分最高的一条（排除 MIT 自身、已完成、溢出沉底）。
   纯函数：入参 [{node,...}]，返回 node.id 或 null；并列取先出现者（与按时间/时段排序后的视觉顺序一致）。 */
function pickNextTopId(entries, excludeId) {
  let best = -Infinity, id = null;
  (entries || []).forEach(ent => {
    const n = ent && ent.node; if (!n || n.done) return;
    if (excludeId && n.id === excludeId) return;
    if (n._overflow) return;
    const s = focusScore(n);
    if (s > best) { best = s; id = n.id; }
  });
  return id;
}
function pickRanked(pool, limit) {
  pool = pool || state.nodes;
  if (_rankSlot && _rankSlot.pool === pool && _rankSlot.limit === limit && _rankSlot.tick === _tickN) return _rankSlot.out;
  let cand = pool.filter(n => n.parentId && !n.done && n._children.length === 0 && !isNodeParked(n));
  if (!cand.length) cand = pool.filter(n => n.parentId && !n.done && !isNodeParked(n));
  if (!cand.length) {
    const root = pool[0];
    let early;
    if (root && !root.done) early = limit > 1 ? [root] : root; else early = limit > 1 ? [] : null;
    _rankSlot = { pool, limit, tick: _tickN, out: early };
    return early;
  }
  cand.sort((a, b) => focusScore(b) - focusScore(a) || b.im - a.im || ((a.daysLeft == null ? 999 : a.daysLeft) - (b.daysLeft == null ? 999 : b.daysLeft)));
  const out = limit > 1 ? cand.slice(0, limit) : cand[0];
  _rankSlot = { pool, limit, tick: _tickN, out };
  return out;
}
function pickTop(pool) { return pickRanked(pool, 1); }

function leafProgress() {
  getCachedTree(state.nodes);
  const leaves = state.nodes.filter(n => n.parentId && n._children.length === 0);
  if (!leaves.length) return null;
  const done = leaves.filter(n => n.done).length;
  return { done, total: leaves.length, pct: Math.round(done / leaves.length * 100) };
}
function subtreeProgress(n) {
  if (!n) return null;
  getCachedTree(state.nodes);
  const collect = [];
  (function w(x) { collect.push(x); (x._children || []).forEach(w); })(n);
  const leaves = collect.filter(x => x._children.length === 0);
  if (!leaves.length) return null;
  const done = leaves.filter(x => x.done).length;
  return { done, total: leaves.length, pct: Math.round(done / leaves.length * 100) };
}

/* ============ SMART 评估 + 对话拆解 ============ */
function smartEval(n) {
  // v7.2: 优先使用 AI 生成的 SMART 评估
  if (n.smartEval && typeof n.smartEval === 'object') {
    const se = n.smartEval;
    const s = se.s || 2, m = se.m || 2, a = se.a || 2, r = se.r || 2, tb = se.t || 2;
    const avg = (s + m + a + r + tb) / 5;
    const gaps = [];
    if (s <= 1) gaps.push('不具体：缺少可衡量的动作或产出对象');
    if (m <= 1) gaps.push('不可衡量：没有量化指标（数字 / 百分比 / 件数）');
    if (tb <= 1) gaps.push('无限期：没有时间节点');
    if (gaps.length === 0 && avg < 2.4) gaps.push('整体仍偏模糊：建议补一个量化指标或更具体的动作');
    return { s, m, a, r, tb, avg, gaps, smart: gaps.length === 0 && avg >= 2.4, fromAI: true };
  }

  const t = n.text || '';
  // S 具体
  let s = 2;
  if (/提升|提高|优化|加强|改善|更好|增强|完善|推进|做好|一些|相关|尽量|努力|处理|关注/.test(t) && !/\d/.test(t)) s = 1;
  if (t.length >= 10 && /\d/.test(t)) s = 3;
  if (t.length >= 12) s = Math.max(s, 3);
  // M 可衡量
  let m = 1;
  if (/\d/.test(t) || /%|倍|万|个|篇|本|次|名|家|元|小时|天|周|月|%.|百分比/.test(t)) m = 3;
  // A 可达（中性，留待用户判断）
  let a = 2;
  // R 相关（重要分支默认高）
  let r = (n.im >= 4) ? 3 : 2;
  // T 有期限（基于显式期限或文本中明确的时间节奏，避免被自动默认的 month/year 尺度误判）
  let tb = 1;
  if (n.deadline) tb = 3;
  else if (/每天|每日|每周|每星期|一周|每月|月度|本月底|月底|月末|下周|本周|周[一二三四五六日天]|下?周[一二三四五六日天]|\d+\s*月|\d+\s*日/.test(t)) tb = 2;
  const avg = (s + m + a + r + tb) / 5;
  const gaps = [];
  if (s <= 1) gaps.push('不具体：缺少可衡量的动作或产出对象');
  if (m <= 1) gaps.push('不可衡量：没有量化指标（数字 / 百分比 / 件数）');
  if (tb <= 1) gaps.push('无限期：没有时间节点');
  if (gaps.length === 0 && avg < 2.4) gaps.push('整体仍偏模糊：建议补一个量化指标或更具体的动作');
  return { s, m, a, r, tb, avg, gaps, smart: gaps.length === 0 && avg >= 2.4, fromAI: false };
}
function smartQuestions(n) {
  const ev = smartEval(n); const qs = [];
  if (ev.m <= 1) qs.push('用什么指标判断这个目标达成了？给我一个可量化的数字或标准（如「签下 3 单」「读完 5 本」）。');
  if (ev.tb <= 1) qs.push('希望什么时候完成？给个具体日期或周期（如「3月15日」「本月底」）。');
  if (ev.s <= 1) qs.push('具体要做什么、对谁做、产出是什么？把它写成一个明确的动作。');
  qs.push('可以拆成哪 2-3 个具体小步骤？每个步骤最好也能衡量。');
  return qs;
}
function decomposeSuggestions(n) {
  const t = n.text;
  if (/读|书|学|课|知识/.test(t)) return ['列出具体书单 / 课程（3 项）', '每周固定 X 小时投入并做笔记', '月底产出 1 份复盘'];
  if (/客户|合同|销售|跟进|谈|方案/.test(t)) return ['列出本周意向清单（带状态）', '每天推进 1 个关键节点', '准备标准化方案 / 话术模板'];
  if (/写|文章|报告|书|文档|稿/.test(t)) return ['拆成 大纲→初稿→修订 3 步', '设定每周写作字数 / 页数', '找 1 位反馈人定期评审'];
  if (/锻炼|运动|健康|体重|睡|饮食/.test(t)) return ['固定每日时段（如晨间 30 分）', '记录每日数据', '设定月度达标线'];
  if (/钱|收入|存|理财|月入|赚/.test(t)) return ['拆成 收入来源 A / B / C', '设定每月具体金额目标', '每周复盘转化与漏斗'];
  return ['明确可交付的产出物', '拆成 3 个周里程碑', '安排一次进度复盘'];
}
/* 可选 LLM（DeepSeek） */
let LLM_KEY = '';
function getLLMKey() { if (LLM_KEY) return LLM_KEY; try { LLM_KEY = localStorage.getItem(LLM_KEY_STORAGE) || ''; } catch (e) { } return LLM_KEY; }
/* v7.9: 失败要区分原因 —— 没额度(402/余额不足) / key无效(401) / 限流(429) / 网络断，
   而不是一律 return null 让上层猜。调用方用 lastLLMError() 拿人类可读原因。 */
let _llmLastError = '';
function lastLLMError() { return _llmLastError; }
async function callLLM(system, user) {
  _llmLastError = '';
  const key = getLLMKey(); if (!key) { _llmLastError = '未配置 API Key'; return null; }
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 })
    });
    if (!r.ok) {
      let msg = '';
      try { const ej = await r.json(); msg = (ej && ej.error && (ej.error.message || ej.error.code)) || ''; } catch (e) { }
      if (r.status === 401) _llmLastError = 'API Key 无效或已过期（401）';
      else if (r.status === 402 || /balance|quota|余额|insufficient/i.test(msg)) _llmLastError = 'DeepSeek 账户余额不足 / 额度已用尽（402）';
      else if (r.status === 429) _llmLastError = '触发限流，请稍后再试（429）';
      else _llmLastError = `HTTP ${r.status}${msg ? '：' + msg : ''}`;
      return null;
    }
    const d = await r.json();
    const content = d.choices && d.choices[0] && d.choices[0].message.content;
    if (!content) { _llmLastError = 'AI 返回了空内容'; return null; }
    return content;
  } catch (e) { _llmLastError = '网络异常：' + (e && e.message || e); return null; }
}

/* ============ v7.8 AI 排期上下文 ============ */
/* AI 拆解必须产出「逐日逐时」的安排，且不能和已有工作流撞车：
   这里把全局预算、本项目净可用、每个工作流已排的时间块、每日占用合计
   拼成纯文本喂给模型（同时也在 AI 页展示，方便用户核对）。 */
function aiWeekday(d) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]; }
function aiFmtDur(min) {
  min = Math.round(+min || 0);
  if (min < 60) return min + '分';
  const h = Math.floor(min / 60), m = min % 60;
  return h + 'h' + (m ? m + '分' : '');
}
function aiEndTime(start, mins) {
  const p = String(start || '').split(':');
  if (p.length < 2 || isNaN(+p[0]) || isNaN(+p[1])) return '';
  let t = clamp(+p[0], 0, 23) * 60 + clamp(+p[1], 0, 59) + (Math.round(+mins || 0));
  t = ((t % 1440) + 1440) % 1440;
  return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
}
function aiScheduleContext() {
  ensureWorkflows(); flushActiveWorkflow();
  const c = capacitySettings();
  const today = today0();
  const curId = state.activeWorkflowId;
  const wfs = (state.workflows || []).filter(w => !w.archived && (w.nodes || []).length);
  const dayLoad = {}; // 'YYYY-MM-DD' -> {cur, other} 分钟
  const blocks = []; // {wfId, wfName, text, dk, time, mins}
  wfs.forEach(wf => {
    const nodes = wf.nodes || [];
    computeTree(nodes);
    nodes.filter(n => n.parentId && !n.done && n._children.length === 0 && !n.recur && n.role !== 'habit').forEach(n => {
      if (!n.time && !n.deadlineDate) return;
      const dk = n.deadlineDate ? dateKey(new Date(n.deadlineDate)) : '未定日期';
      const mins = n.estimateMinutes || 30;
      blocks.push({ wfId: wf.id, wfName: wf.name || '目标流', text: n.text, dk, time: n.time || '', mins });
      if (dk !== '未定日期') {
        const rec = dayLoad[dk] = dayLoad[dk] || { cur: 0, other: 0 };
        if (wf.id === curId) rec.cur += mins; else rec.other += mins;
      }
    });
  });
  // 每日占用合计：只列今天起 21 天内有占用的日期
  const dayLines = Object.keys(dayLoad).sort().filter(dk => {
    const d = new Date(dk + 'T00:00:00');
    const diff = Math.round((d - today) / 86400000);
    return diff >= 0 && diff <= 21;
  }).map(dk => {
    const r = dayLoad[dk], d = new Date(dk + 'T00:00:00');
    return `  · ${dk}（${aiWeekday(d)}）已占 ${aiFmtDur(r.cur + r.other)}（本项目 ${aiFmtDur(r.cur)} + 其他 ${aiFmtDur(r.other)}）`;
  });
  // 每个工作流已排时间块（最多 18 条，按日期+时间排序）
  const wfSections = wfs.map(wf => {
    const rows = blocks.filter(b => b.wfId === wf.id)
      .sort((a, b) => a.dk.localeCompare(b.dk) || (a.time || '99').localeCompare(b.time || '99'));
    const curTag = wf.id === curId ? '【当前项目】' : '【其他工作流】';
    const period = (wf.startDate || wf.endDate) ? `${wf.startDate || '未设置'} ~ ${wf.endDate || '未设置'}` : '未设置';
    const head = `▶ ${curTag}「${wf.name || '目标流'}」 周期 ${period}`;
    if (!rows.length) return head + '\n   （暂无已排时间块）';
    const shown = rows.slice(0, 18).map(b => {
      if (!b.time) return `   · ${b.dk === '未定日期' ? '未定日期' : b.dk}（仅期限，未定开始时间） ${aiFmtDur(b.mins)} · ${b.text}`;
      return `   · ${b.dk} ${b.time}–${aiEndTime(b.time, b.mins)}（${aiFmtDur(b.mins)}） ${b.text}`;
    });
    if (rows.length > 18) shown.push(`   · ……另有 ${rows.length - 18} 个已排时间块未列出`);
    return head + '\n' + shown.join('\n');
  });
  const globalWorkday = c.globalWorkdayHours != null ? c.globalWorkdayHours : 0;
  const globalWeekend = c.globalWeekendHours != null ? c.globalWeekendHours : 0;
  const splitMode = (c.workdayHours > 0 || c.weekendHours > 0);
  const budgetLine = splitMode
    ? `本项目净可用（已扣除其他项目申报预算）：工作日 ${fmtHours(c.workdayHours * 60)}h/天，周末 ${fmtHours(c.weekendHours * 60)}h/天`
    : `本项目每日可投入：约 ${fmtHours(dayCap())}h/天（未区分工作日/周末）`;
  const globalLine = (globalWorkday > 0 || globalWeekend > 0)
    ? `全局预算：工作日 ${globalWorkday}h/天，周末 ${globalWeekend}h/天；`
    : '';
  const lines = [
    `今天：${dateKey(today)}（${aiWeekday(today)}）`,
    `${globalLine}每周总容量约 ${fmtHours(weekCap())} 小时`,
    budgetLine,
    '',
    '【各工作流已排时间（新安排不得与这些时间块重叠）】',
    wfSections.join('\n') || '（暂无任何工作流）',
    '',
    '【每日已占合计（今天起 21 天）】',
    dayLines.join('\n') || '  （近期没有已排时间）',
  ];
  return lines.join('\n');
}
/* AI 输入统一入口：目标 + 项目周期 + 时间偏好 + 所有工作流既有排期 */
function buildAIDecomposeInput(goal, opts) {
  opts = opts || {};
  const c = capacitySettings();
  const wf = workflowById(state.activeWorkflowId) || {};
  const startDate = opts.startDate || wf.startDate || '未设置';
  const endDate = opts.endDate || wf.endDate || '未设置';
  const timePrefText = opts.timePrefText || '不限（自动安排）';
  const splitMode = (c.workdayHours > 0 || c.weekendHours > 0);
  const budgetText = splitMode
    ? `工作日 ${fmtHours(c.workdayHours * 60)}h/天 × 5 + 周末 ${fmtHours(c.weekendHours * 60)}h/天 × 2 = 每周 ${fmtHours(weekCap())} 小时`
    : `每天约 ${fmtHours(dayCap())} 小时 × 5 = 每周 ${fmtHours(weekCap())} 小时`;
  // v7.9/v8.2: 每日可安排窗口（可多段）—— 有的项目只能休息时间做（副业 19:00-22:00），AI 排期必须落进窗口
  const wins = wfTimeWindows(opts.wfId || state.activeWorkflowId);
  const winText = wins.length
    ? `⚠️ 每日可安排窗口（共 ${wins.length} 段）：${wins.map(w => `${w.start}–${w.end}`).join('、')}。本项目所有 start 必须落在其中某一段之内（用户只能在这些时段做本项目），窗口外一律不排。`
    : '每日可安排窗口：全天';
  return `目标：${goal}
当前项目：${opts.projectName || wf.name || '未命名'}
项目周期：${startDate} ~ ${endDate}
时间预算：${budgetText}
时间偏好：${timePrefText}
${winText}

${aiScheduleContext()}

请把目标拆成可检验的子任务，并为每个叶子任务排出具体的「日期 + 开始时间 + 时长」，严格避让上面列出的所有已排时间，单日不要超过本项目当日剩余容量。`;
}

/* ============ AI 智能拆解（v7.8 逐日排期 skill） ============ */
// 固定 skill prompt：产出必须精确到「日期 + 开始时间 + 时长」，并避让输入里的既有排期
const AI_DECOMPOSE_SYSTEM = `你是资深的目标拆解与日程排期专家。用户会给你目标、项目周期、时间预算，以及【所有工作流已有的时间安排】。你的产出必须是一份可直接执行的逐日日程表，精确到具体哪天、几点开始、做多久。

一、拆解
1. 分析目标类型和复杂度，拆成 3-7 个可检验的子任务（每个都有明确产出物）；太粗就拆 children（最多 2 层）。
2. 叶子任务 = 一次坐下来的时间块，建议 25-90 分钟；超过 90 分钟必须拆成多个叶子。
3. 同一件事要分几天做时，拆成多个叶子，文案加「（1/3）」「（2/3）」或「（续）」。

二、排期（硬性要求，违反即视为不合格）
4. 每个叶子任务必须给出：date（YYYY-MM-DD，具体到天）、start（HH:MM，24 小时制）、duration（分钟）。三者缺一不可（纯习惯任务除外，见第 9 条）。
5. 必须逐天核对输入里的【各工作流已排时间】和【每日已占合计】：
   - 新时间块不得与任何已有时间块重叠（包括其他工作流）；
   - 同一天内你新排的块之间也不能重叠，相邻块至少间隔 10 分钟；
   - 当天新排时长不得超过「本项目当日剩余」＝ 当日净可用 − 当日已占；建议只排到 80%，留缓冲。
6. 从今天（或项目开始日，取较晚者）开始顺排，填满一天再排下一天；工作日与周末预算不同，预算不足时跳过周末。
7. 若输入给出了「时间偏好」，所有时间块必须落在该时间窗内（如上午 = 08:00-12:00）。
8. date 必须落在项目周期内且不早于今天；容量不足的日期直接跳过。
9. 习惯类任务：everyday 设为 true，date 留空，start 固定在同一时间，duration 为每次时长；不要为习惯重复生成多天条目。

三、字段
10. 每个任务对象：
   - text：任务描述（含产出标准）
   - im：1-5 重要度（5 最重要）
   - ur：1-5 紧急度（5 最紧急）
   - date："YYYY-MM-DD"（习惯留空）
   - start："HH:MM"
   - duration：分钟（25-180）
   - everyday：布尔，习惯任务为 true
   - timeSlot：可选 morning/afternoon/evening，仅供兼容；日期时间以 date/start 为准
   - smart：{s,m,a,r,t} 各 1-3
   - children：子任务数组（可选；父任务不需要 date/start，排期落在叶子上）

四、JSON 示例（假设输入里 12-03 的 09:00-10:30 已被其他项目占用）
{
  "tasks": [
    {
      "text": "整理客户案例清单（产出：20 条 Excel）",
      "im": 5, "ur": 4,
      "date": "2026-12-03", "start": "10:40", "duration": 90,
      "smart": {"s":3,"m":3,"a":3,"r":3,"t":3},
      "children": [
        {"text": "导出 CRM 全部成交客户（1/2）", "im":4, "ur":4, "date":"2026-12-03", "start":"10:40", "duration":50, "smart":{"s":3,"m":3,"a":3,"r":3,"t":2}},
        {"text": "按行业标注并补全字段（2/2）", "im":4, "ur":3, "date":"2026-12-04", "start":"09:00", "duration":60, "smart":{"s":3,"m":3,"a":3,"r":3,"t":2}}
      ]
    },
    {
      "text": "每天 20:00 复盘客户跟进（15 分钟）",
      "im": 4, "ur": 2, "date": "", "start": "20:00", "duration": 15, "everyday": true,
      "smart": {"s":3,"m":3,"a":3,"r":3,"t":3}
    }
  ]
}

五、输出
11. 只返回严格 JSON（形如 {"tasks":[...]}），不要解释、不要 Markdown。
12. im / ur 不要全相同；smart 评分必须客观（s=具体性, m=可衡量性, a=可达性, r=相关性, t=时限性）。
13. 除习惯任务外，任何叶子缺少 date / start / duration 都视为失败，必须补齐。`;

async function aiDecompose(nodeId) {
  const n = byId(nodeId);
  if (!n) return;
  const wp = weekPlanFeasibility();
  const user = buildAIDecomposeInput(n.text) + `
本项目本周已安排：${fmtHours(wp.projEst)} 小时；本周剩余可用约 ${fmtHours(Math.max(0, wp.cap - wp.est))} 小时。`;

  // 显示加载状态
  const loadingToast = showToast('🤖 AI 正在拆解目标...', 0);

  const result = await callLLM(AI_DECOMPOSE_SYSTEM, user);
  loadingToast.remove();

  if (!result) {
    // AI 不可用，显示降级引导（v7.9: 带上具体失败原因——没额度/key无效要明说）
    showDecomposeGuide(n, lastLLMError());
    return;
  }

  try {
    // 解析 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) throw new Error('Invalid format');

    // 生成子任务
    insertAITasks(nodeId, parsed.tasks);
    showToast(`✅ AI 已生成 ${parsed.tasks.length} 个子任务`);
  } catch (e) {
    console.error('AI decompose parse error:', e);
    showDecomposeGuide(n);
  }
}

/* v7.7: 「第X周」类相对期限的锚点 = 当前项目开始日；没填就用今天。 */
function aiDeadlineAnchor() {
  const wf = (state.workflows || []).find(w => w.id === state.activeWorkflowId);
  const sd = wf && wf.startDate;
  if (sd) { const d = new Date(sd); if (!isNaN(d.getTime())) return d; }
  return today0();
}

function insertAITasks(parentId, tasks, anchor, _collected) {
  const parent = byId(parentId);
  if (!parent) return;
  const collected = _collected || [];  // v8.2: 收集全批新节点（含递归子层），最外层统一兜底排期
  // v8.6 修复：anchor 常是 'YYYY-MM-DD' 字符串（autoDecomposeGoal/btnAIDecompose/模板都传字符串），
  // 不归一化会让 backfillAISchedule 的 anchorD.getTime() 抛 TypeError（以前项目没填开始日期才没暴露）
  let anchorD = anchor || aiDeadlineAnchor();
  if (!(anchorD instanceof Date)) { const d = new Date(anchorD); anchorD = isNaN(d.getTime()) ? today0() : d; }
  const idx = state.nodes.findIndex(n => n.id === parentId);
  let maxId = state.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);

  const newNodes = tasks.map(t => {
    const isLeaf = !t.children || !t.children.length;
    const node = newNode({
      id: 'n' + (++maxId),
      text: t.text,
      im: clamp(t.im || 3, 1, 5),
      ur: clamp(t.ur || 3, 1, 5),
      parentId: parentId,
      scale: isLeaf ? 'day' : parent.scale, // v7.6: 叶子任务默认为"每日"尺度，自动进入今日行动
      source: 'ai-decompose'
    });
    if (t.estimate || t.duration) node.estimateMinutes = clamp(+(t.duration || t.estimate), 1, 999);
    // v7.8: AI 产出的「具体到天+几点开始」：date 落到 deadline，start 落到 time（日历/ICS/今日排序共用）
    // v7.9: 但只有「排到的那天」才挂 time —— 未来日期的 time 会让任务凭「有 time」混进今天
    const taskDate = String(t.date || t.deadline || '').trim();
    const hm = parseAIStart(t.start);  // v8.2: 兼容「19点」「7:30 pm」「19.30」等格式
    if (hm) {
      if (taskDate && taskDate === dateKey()) node.time = hm;          // 排期=今天 → 挂 time 参与今日排序
      else if (taskDate) node.planDate = taskDate + 'T' + hm;           // 排期=未来 → 存计划日，到当天再转 time
      else node.time = hm;                                              // 无日期（习惯等）→ 直接挂 time
    }
    // v7.7: AI 的 timeSlot 必须落到节点真正的时段词表（DAY_SLOTS: h0…h6）。
    // 旧代码写成 'am'/'pm'/'eve'（那是 energyLog 的词表），结果排期/日历/今日分组认不出、
    // 精力高峰加权永远命中不了，卡片上还显示「未排期」。
    const AISlotMap = { morning: 'h1', afternoon: 'h4', evening: 'h6', midnight: 'h6' };
    if (t.timeSlot && AISlotMap[t.timeSlot]) node.slot = AISlotMap[t.timeSlot];
    // v7.2: 保存 SMART 评估
    if (t.smart && typeof t.smart === 'object') {
      node.smartEval = {
        s: clamp(t.smart.s || 2, 1, 3),
        m: clamp(t.smart.m || 2, 1, 3),
        a: clamp(t.smart.a || 2, 1, 3),
        r: clamp(t.smart.r || 2, 1, 3),
        t: clamp(t.smart.t || 2, 1, 3),
      };
    }
    applySuggestions(node, t.text);
    if (t.everyday) node.recur = true;
    // v7.7: 期限必须在 applySuggestions 之后写 —— applySuggestions 会按文本重算 deadline，
    // 「第X周」这类相对标签还要用项目开始日作锚点，否则期限会每天往后滑、永远不逾期。
    setNodeDeadline(node, t.date || t.deadline || '', anchorD);
    // v7.8: 叶子尺度决定哪天进「今日行动」——只有今天/明天到期的排成 day，
    // 更远的归 week/month，到了当天再自动进入今日清单，避免一次把未来两周的任务全灌进今天。
    if (isLeaf) {
      if (node.recur || t.everyday) node.scale = 'day';
      else if (node.daysLeft == null) node.scale = 'day';
      else node.scale = node.daysLeft <= 1 ? 'day' : node.daysLeft <= 7 ? 'week' : 'month';
    } else node.scale = parent.scale;
    // 时段标签只服务「今日」分组：未来日期不挂 slot，避免提前混进今天
    if (node.daysLeft != null && node.daysLeft > 1) node.slot = '';
    return node;
  });

  collected.push(...newNodes);
  state.nodes.splice(idx + 1, 0, ...newNodes);

  // v7.2: 递归插入子任务
  newNodes.forEach((node, i) => {
    const taskDef = tasks[i];
    if (taskDef.children && Array.isArray(taskDef.children) && taskDef.children.length > 0) {
      insertAITasks(node.id, taskDef.children, anchorD, collected);
    }
  });

  // v8.2: 最外层统一兜底排期 —— LLM 常只给第一个叶子 start，其余缺 date/start 的本地补齐
  // v8.3 修复：保存/超支提醒/成功提醒只在最外层执行一次（递归调用时 _collected 存在，跳过），
  // 否则每个含 children 的节点都会触发一次 warnIfOverCapacity → alert 排队，用户要点多次确定
  if (!_collected) {
    backfillAISchedule(collected, anchorD);

    recomputeSchedule(state.nodes);
    save();
    afterChange();
    warnIfOverCapacity(`AI 为「${parent.text.slice(0, 18)}」生成的 ${collected.length} 个子任务`);

    // v7.6: 显示成功提醒
    // v8.7: 「已加入今日清单」只数真正挂了 time 的叶子——planDate 排到未来的叶子当天才进清单
    const leafCount = collected.filter(n => n.time).length;
    if (leafCount > 0) {
      showTodayAlarm(`✅ AI 已生成 ${collected.length} 个任务，其中 ${leafCount} 个叶子任务已加入今日行动清单`, 'success');
    }
  }
}

/* v8.2: AI 产出兜底排期 —— LLM 常只给第一个叶子 start，其余缺 date/start。
   本地补齐：缺 date 从 max(今天, 项目开始日) 顺排（当日窗口排满换次日）；
   缺 start 在当日窗口内顺接（间隔 10 分钟，避让本批已排块）。
   保证「每个叶子都有具体时间」，不再依赖 LLM 输出完整性。 */
function backfillAISchedule(collected, anchorD) {
  // v8.6：anchor 可能是 'YYYY-MM-DD' 字符串（防御——insertAITasks 已归一化，此处双保险）
  if (!(anchorD instanceof Date)) { const d = new Date(anchorD); anchorD = isNaN(d.getTime()) ? null : d; }
  const wins = wfTimeWindows(state.activeWorkflowId);
  const winS = wins.length ? wins[0].start : '09:00';
  const winE = wins.length ? wins[0].end : '22:00';
  const winSM = hmToMin(winS), winEM = Math.max(hmToMin(winE), winSM + 30);
  const isLeaf = n => !collected.some(x => x.parentId === n.id);
  const leaves = collected.filter(n => n.parentId && isLeaf(n));
  // 习惯：固定同一时间；缺 start 补窗口起点
  leaves.filter(n => n.recur).forEach(n => { if (!n.time) { n.time = winS; stampNodeTimeDk(n); } });
  const tasks = leaves.filter(n => !n.recur);
  if (!tasks.length) return;
  // ① 本批已排（AI 给了 date+start）计入每日占用终点
  const dayNext = {}; // dk -> 下一块开始分钟
  const bump = (dk, s, dur) => { if (dk) dayNext[dk] = Math.max(dayNext[dk] || winSM, s + dur + 10); };
  tasks.forEach(n => {
    let dk = n.planDate ? String(n.planDate).slice(0, 10) : (n.deadlineDate ? dateKey(n.deadlineDate) : '');
    const hm = n.time || (String(n.planDate || '').length >= 16 ? String(n.planDate).slice(11, 16) : '');
    // v8.3: 有 start 无 date 视为今天（time 本就只表今日）——否则不参与占用，后续顺排块会与它重叠
    if (!dk && hm) dk = dateKey();
    if (dk && hm) bump(dk, hmToMin(hm), n.estimateMinutes || 30);
  });
  // v8.11: 全局避让 —— 项目里已存在的今日 time / 各日 planDate 占用也计入，
  // 否则新批次（第二次 AI 拆解）的顺排块会与旧任务撞车（两个 9:00 的来源之一）。
  const batchIds = new Set(collected.map(n => n.id));
  (state.nodes || []).forEach(n => {
    if (!n || n.done || batchIds.has(n.id)) return;
    if (n.time) bump(dateKey(), hmToMin(n.time), n.estimateMinutes || 30);
    const pd = String(n.planDate || '');
    if (pd.length >= 16) bump(pd.slice(0, 10), hmToMin(pd.slice(11, 16)), n.estimateMinutes || 30);
  });
  // ② 缺 date / 缺 start 同一遍处理：先定日（缺则从 max(今天,anchor) 顺排，当日窗口装不下换次日），
  //    再放进当日窗口（顺接已排块；塞不下贴窗口尾，优先保证「有时间」），每块只 bump 一次避免二次避让。
  let cursor = new Date(Math.max((anchorD && !isNaN(anchorD.getTime())) ? anchorD.getTime() : 0, today0().getTime()));
  tasks.forEach(n => {
    if (n.time || String(n.planDate || '').length >= 16) return;  // 已有 date+start（① 已计入占用）
    const dur = n.estimateMinutes || 30;
    let dk = n.planDate ? String(n.planDate).slice(0, 10) : (n.deadlineDate ? dateKey(n.deadlineDate) : '');
    if (!dk) {
      dk = dateKey(cursor);
      let next = dayNext[dk] || winSM, guard = 0;
      while (next + dur > winEM && guard++ < 60) {
        cursor.setDate(cursor.getDate() + 1);
        dk = dateKey(cursor); next = dayNext[dk] || winSM;
      }
      setNodeDeadline(n, dk, anchorD);
      // scale 重判（与 insertAITasks 同规则）
      n.scale = n.daysLeft == null ? 'day' : n.daysLeft <= 1 ? 'day' : n.daysLeft <= 7 ? 'week' : 'month';
    }
    let s = Math.max(dayNext[dk] || winSM, winSM);
    if (s + dur > winEM) s = Math.max(winSM, winEM - dur);
    const hm = minToHm(s);
    if (dk === dateKey()) { n.time = hm; n.planDate = ''; stampNodeTimeDk(n); }
    else { n.planDate = dk + 'T' + hm; n.time = ''; n.timeDk = ''; }
    bump(dk, s, dur);
  });
  // ③ slot 清理（与正常路径一致：>1 天不挂 slot）
  tasks.forEach(n => { if (n.daysLeft != null && n.daysLeft > 1) n.slot = ''; });
  // ④ v8.11: 本批今日块冲突纠偏 —— AI 直接给多个叶子相同 start 时（① 只记账不改它），
  // 在写库前把重叠块顺延开；未来日期的 planDate 由到当天的 ensureTodayTimeResolved 兜底。
  resolveTimeConflicts(tasks.filter(n => n.time));
}

// 降级方案：AI 不可用时显示引导
function showDecomposeGuide(node, reason) {
  const c = capacitySettings();
  const wc = weekCap();
  const dc = dayCap();
  const wp = weekPlanFeasibility();
  const remaining = Math.max(0, wc - wp.projEst);
  const hasKey = !!getLLMKey();
  if (!document.getElementById('smartModal')) return;

  const body = `
      <div class="guide-section">
        <h4>🎯 当前目标</h4>
        <div class="guide-target">${esc(node.text)}</div>
      </div>
      ${reason ? `<div class="guide-section"><div class="hint" style="color:var(--ur4,#e08080)">⚠️ ${esc(reason)}${/余额|额度|402/.test(reason) ? '——请到 platform.deepseek.com 充值后重试' : ''}${/无效|401/.test(reason) ? '——请检查 API Key 是否填错或已过期' : ''}</div></div>` : ''}
      ${!hasKey ? `<div class="guide-section">
        <h4>🔑 配置 AI（推荐）</h4>
        <div class="guide-ai-setup">
          <div class="hint">配置 DeepSeek API Key 后，AI 可以自动帮你拆解目标、生成任务树。</div>
          <label class="wfm-row" style="margin-top:8px">
            <span>DeepSeek API Key</span>
            <input type="password" class="gf-input" id="guideApiKey" placeholder="sk-...">
          </label>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="guideSaveKey" style="margin-top:8px">💾 保存并重新拆解</button>
        </div>
      </div>` : ''}
      <div class="guide-section">
        <h4>⏱ 你的时间预算</h4>
        <div class="guide-budget">
          <div class="budget-row">
            <span>每周可投入</span>
            <b>${c.workdayHours > 0 ? `工作日 ${c.workdayHours}h × 5 + 周末 ${c.weekendHours}h × 2 = ` : ''}${fmtHours(wc)} 小时</b>
          </div>
          <div class="budget-row">
            <span>每天可投入</span>
            <b>${fmtHours(dc)} 小时</b>
          </div>
          <div class="budget-row warn">
            <span>本周已安排</span>
            <b>${fmtHours(wp.projEst)} 小时</b>
          </div>
          <div class="budget-row ok">
            <span>剩余可用</span>
            <b>${fmtHours(remaining)} 小时</b>
          </div>
        </div>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="guideOpenSettings">⚙ 调整时间预算</button>
      </div>
      <div class="guide-section">
        <h4>📝 手动拆解建议</h4>
        <div class="guide-tips">
          <div class="tip-item">1. 把这个目标拆成 <b>3-7 个具体步骤</b></div>
          <div class="tip-item">2. 每个步骤应该是 <b>可执行、可衡量</b> 的</div>
          <div class="tip-item">3. 给每个步骤估算 <b>所需时间</b></div>
          <div class="tip-item">4. 设定 <b>期限</b>（本周/下周/月底）</div>
        </div>
      </div>
      <div class="guide-section">
        <h4>⚡ 快速模板</h4>
        <div class="guide-templates">
          ${decomposeSuggestions(node).map(s => `<button type="button" class="gf-btn gf-btn--sm" data-add-tip="${esc(s)}">+ ${esc(s)}</button>`).join('')}
        </div>
      </div>`;
  const html = buildModalHtml({
    icon: '🤖',
    title: 'AI 拆解不可用',
    sub: reason ? ('原因：' + reason) : '选择手动拆解或配置 AI',
    closeId: 'guideClose',
    bodyClass: 'guide-body',
    body,
    buttons: [{ id: 'guideDone', label: '知道了', primary: true }],
  });
  const api = openModalMask('smartModal', html, { closeId: 'guideClose' });
  if (!api) return;
  const { overlay, close } = api;
  overlay.querySelector('#guideDone').onclick = close;
  const setBtn = overlay.querySelector('#guideOpenSettings');
  if (setBtn) setBtn.onclick = () => { close(); openSettingsModal(); };

  // 保存 API Key
  const saveKeyBtn = overlay.querySelector('#guideSaveKey');
  if (saveKeyBtn) {
    saveKeyBtn.onclick = () => {
      const key = overlay.querySelector('#guideApiKey').value.trim();
      if (!key) { alert('请输入 API Key'); return; }
      LLM_KEY = key;
      try { localStorage.setItem(LLM_KEY_STORAGE, key); } catch (e) {}
      close();
      aiDecompose(node.id);
    };
  }

  // 模板按钮
  overlay.querySelectorAll('[data-add-tip]').forEach(btn => {
    btn.onclick = () => {
      insertChildren(node.id, [btn.dataset.addTip]);
      close();
    };
  });
}

/* ============ v7.1 创建项目后自动分解目标 ============ */
/* v8.2: AI 分解全屏遮罩（创建项目 / AI 视图共用）—— 原先创建项目流程用底部 toast，
   容易被忽略且不像「正在处理」；统一为居中全屏遮罩，调用方负责 remove()。 */
/* v8.2 全屏遮罩；v8.4 升级为「分步流程演出」——请求期间逐步展示处理阶段（纯演出，
   与真实 API 进度无关），比干等 spinner 更专业、缓解等待焦虑。
   调用方仍 overlay.remove() 即可（内部定时器一并清理）。 */
function showAIOverlay(text) {
  const steps = [
    '🧠 理解目标与约束条件',
    '🪓 拆解里程碑与子任务',
    '⏱ 估算每一步耗时',
    '📅 落入每日可安排时段',
    '✅ 校验任务树完整性',
  ];
  const overlay = document.createElement('div');
  overlay.className = 'ai-analyzing-overlay';
  overlay.innerHTML = `
    <div class="ai-analyzing-content">
      <div class="ai-analyzing-spinner"></div>
      <div class="ai-analyzing-text">${esc(text || '🤖 AI 正在分析目标...')}</div>
      <ol class="ai-steps">${steps.map((s, i) => `<li class="ai-step" data-step="${i}"><i></i><span>${s}</span></li>`).join('')}</ol>
      <div class="ai-analyzing-hint">请勿关闭页面或进行其他操作</div>
    </div>`;
  document.body.appendChild(overlay);
  // 逐步点亮：当前步 working（转点），已完成 done（✓）
  let cur = 0;
  const lis = overlay.querySelectorAll('.ai-step');
  const paint = () => lis.forEach((li, i) => {
    li.classList.toggle('done', i < cur);
    li.classList.toggle('working', i === cur);
  });
  paint();
  const timer = setInterval(() => {
    cur++;
    if (cur >= steps.length) { cur = steps.length - 1; clearInterval(timer); }  // 停最后一步等真实返回
    paint();
  }, 1100);
  const _remove = overlay.remove.bind(overlay);
  overlay.remove = () => { clearInterval(timer); _remove(); };
  return overlay;
}

/* v8.5: 分解/模板完成后的结果弹窗 —— 展示「真实排期结果」（backfill 兜底后的节点，非 AI 原始输出）+
   今日安排（今日执行池有 time 的按时间排）。按钮跳任务树/今日。 */
function showAIResultModal(rootId, opts) {
  const overlay = document.getElementById('smartModal');
  if (!overlay) return;
  opts = opts || {};
  const nodes = state.nodes || [];
  const leaves = nodes.filter(n => n.parentId && !nodes.some(x => x.parentId === n.id));
  const habits = leaves.filter(n => n.recur);
  const dkToday = dateKey();
  // 排期预览：time（今日）/ planDate（未来 'YYYY-MM-DDTHH:MM'）/ deadline 归一为 (date, hm) 排序
  const scheduled = leaves.map(n => ({
    n,
    date: n.time ? dkToday : (n.planDate ? String(n.planDate).slice(0, 10) : (n.deadlineDate ? dateKey(n.deadlineDate) : '')),
    hm: n.time || (String(n.planDate || '').length >= 16 ? String(n.planDate).slice(11, 16) : ''),
  })).filter(x => x.date || x.hm)
    .sort((a, b) => (a.date + a.hm).localeCompare(b.date + b.hm));
  const rowHtml = (when, n) => `<div class="air-row"><span class="air-when">${when}</span><b>${esc(n.text.slice(0, 26))}</b><span class="air-est">${n.estimateMinutes ? n.estimateMinutes + '′' : ''}${n.recur ? ' 🔁' : ''}</span></div>`;
  const rows = scheduled.slice(0, 10).map(x =>
    rowHtml(`${x.date ? x.date.slice(5).replace('-', '/') : '未定'}${x.hm ? ' ' + x.hm : ''}`, x.n)).join('');
  let todayRows = '';
  try {
    todayRows = todayExecutionPoolFor(nodes)
      .filter(n => !n._overflow && n.time)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)))
      .map(n => rowHtml(esc(n.time), n)).join('');
  } catch (e) { }
  const subLine = `${leaves.length} 个叶子任务 · ${habits.length} 个每日习惯 · ${scheduled.length} 个已排时间`;
  const body = `${rows ? `<div class="air-sec"><h4>📅 排期预览${scheduled.length > 10 ? `（前 10 条 / 共 ${scheduled.length} 条）` : ''}</h4><div class="air-list">${rows}</div></div>` : '<div class="hint">未排期——可在任务树手动设置期限与计划时间，AI 分解时会自动落入每日可安排时段。</div>'}
      ${todayRows ? `<div class="air-sec"><h4>☀ 今日安排</h4><div class="air-list">${todayRows}</div></div>` : ''}`;
  const html = buildModalHtml({
    icon: '✅',
    title: opts.title || '分解完成',
    sub: subLine,
    closeId: 'airClose',
    body,
    buttons: [
      { id: 'airGoPlan', label: '📋 查看任务树', primary: true },
      { id: 'airGoToday', label: '☀ 今日行动', ghost: true }
    ]
  });
  const api = openModalMask('smartModal', html, { closeId: 'airClose' });
  if (!api) return;
  api.overlay.querySelector('#airGoPlan').onclick = () => { api.close(); switchView('plan'); };
  api.overlay.querySelector('#airGoToday').onclick = () => { api.close(); switchView('today'); };
  // v8.8: 系统通知镜像 —— 页面在后台时分解完成也能看到；未授权给 opt-in 按钮
  const airTitle = opts.title || '分解完成';
  sysNotify('✅ ' + airTitle, `${leaves.length} 个叶子任务 · ${scheduled.length} 个已排时间`);
  sysNotifyOptIn(api.overlay.querySelector('.modal-foot'), '✅ ' + airTitle, `${leaves.length} 个叶子任务 · ${scheduled.length} 个已排时间`);
}

/* v8.6: AI 分解失败弹窗 —— toast 6 秒消失看不到，失败必须弹窗（用户要求）。
   opts: { cancelledProject='已回滚删除的项目名', fallbackTpl=已自动回落的模板 } */
function showAIErrorModal(reason, rawSnippet, opts) {
  opts = opts || {};
  const body = `<div class="aierr-reason">⚠️ ${esc(reason || '未知错误')}</div>
      ${opts.cancelledProject ? `<div class="hint">项目「${esc(opts.cancelledProject)}」已自动取消（空项目不留垃圾）。可重新创建后重试。</div>` : ''}
      ${opts.fallbackTpl ? `<div class="aierr-fallback">${opts.fallbackTpl.icon} 已自动改用「${esc(opts.fallbackTpl.name)}」模板生成任务树——不耗 API 额度，可直接在「目标规划」查看调整。</div>` : ''}
      ${rawSnippet ? `<details class="ai-history-raw"><summary>🔍 AI 原始返回片段（诊断用）</summary><pre>${esc(rawSnippet)}</pre></details>` : ''}
      <div class="hint">常见原因：API Key 无效/过期（401）、账户余额不足（402）、触发限流（429）、网络异常。配置见「AI 视图 → AI 配置」。</div>`;
  const html = buildModalHtml({
    icon: '❌',
    title: 'AI 分解失败',
    sub: '已记入「AI 视图 · 使用历史」，可随时回看',
    closeId: 'aierrClose',
    body,
    buttons: [
      { id: 'aierrGoHistory', label: '📜 查看 AI 使用历史', primary: true },
      { id: 'aierrDone', label: '关闭', ghost: true }
    ]
  });
  const api = openModalMask('smartModal', html, { closeId: 'aierrClose' });
  if (!api) return;
  api.overlay.querySelector('#aierrDone').onclick = api.close;
  api.overlay.querySelector('#aierrGoHistory').onclick = () => { api.close(); switchView('ai'); };
  // v8.8: 系统通知镜像 —— 失败更要让系统层可见；未授权给 opt-in 按钮
  sysNotify('❌ AI 分解失败', reason || '未知错误');
  sysNotifyOptIn(api.overlay.querySelector('.modal-foot'), '❌ AI 分解失败', reason || '未知错误');
}

async function autoDecomposeGoal(goalText, projectMeta, opts) {
  opts = opts || {};  // v8.6: { fallbackTpl } —— 模板创建的项目 AI 失败时自动回落模板任务树
  const hasKey = !!getLLMKey();

  if (!hasKey) {
    // 没有 API Key，弹出输入框
    showApiKeyPrompt(goalText, projectMeta);
    return;
  }

  // 有 API Key，直接调用 AI
  const aiContext = buildAIDecomposeInput(goalText, {
    projectName: projectMeta.name || '新项目',
    startDate: projectMeta.startDate || '未设置',
    endDate: projectMeta.endDate || '未设置',
  });

  const overlay = showAIOverlay('🤖 AI 正在分解目标...');
  const result = await callLLM(AI_DECOMPOSE_SYSTEM, aiContext);
  overlay.remove();

  // v8.4：新建项目流程也写 AI 使用历史（此前只有 AI 视图写）——「分解失败后哪儿能看到报错」的答案统一在 AI 视图历史里
  const historyEntry = {
    timestamp: Date.now(),
    projectName: projectMeta.name || '新项目',
    projectPeriod: projectMeta.startDate ? `${projectMeta.startDate} ~ ${projectMeta.endDate || '未设置'}` : '未设置',
    timeBudget: '',
    timePreference: '',
    goal: goalText,
    success: false,
    taskCount: 0,
    tasks: [],
    error: null,
    via: 'create',
  };

  // v7.9: 失败（没额度/key无效/格式错）→ 回滚刚创建的空项目，明确告知原因，不留垃圾项目
  // v8.5: 失败改弹窗展示（toast 6 秒消失看不见）；v8.6: 模板项目失败自动回落模板任务树
  const failAndRollback = (reason) => {
    historyEntry.error = reason;
    if (!historyEntry.rawSnippet && result) historyEntry.rawSnippet = String(result).slice(0, 300);
    try { addAIHistoryEntry(historyEntry); renderAIHistory(); } catch (e) { }
    // v8.6：模板兜底——AI 失败不删项目，直接用模板任务树（用户已选模板=接受这套骨架）
    if (opts.fallbackTpl) {
      applyWorkflowTemplate(opts.fallbackTpl, projectMeta, { silent: true });
      showAIErrorModal(reason, historyEntry.rawSnippet, { fallbackTpl: opts.fallbackTpl });
      return;
    }
    const wf = workflowById(state.activeWorkflowId);
    let cancelled = false;
    if (wf && !(wf.nodes || []).length && state.workflows.length > 1) {
      state.workflows = state.workflows.filter(x => x.id !== wf.id);
      state.activeWorkflowId = state.workflows[0].id;
      applyActiveWorkflow();
      save(); afterChange();
      cancelled = wf.name;
    }
    showAIErrorModal(reason, historyEntry.rawSnippet, { cancelledProject: cancelled });
    switchView('plan');
  };

  if (result) {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 未返回有效 JSON（目标可能无法分解，请描述得更具体）');
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.tasks || !Array.isArray(parsed.tasks) || !parsed.tasks.length) throw new Error('AI 未能从该目标拆出任务——请把目标描述得更具体可衡量');

      // 生成根节点
      const rootNode = newNode({
        id: 'n1',
        text: goalText,
        im: 4,
        ur: 3,
        scale: 'month',
        source: 'ai-decompose'
      });
      // v8.9: 防御——当前流若有旧树，整树替换前清旧引用（新建流为空集 no-op）
      purgeCurrentTreeRefs();
      state.nodes = [rootNode];
      // v7.7: 用统一入口写期限（旧写法把 Date 直接塞字段、没有 daysLeft/overdue，树里显示「无期限」）
      setNodeDeadline(rootNode, projectMeta.endDate, projectMeta.startDate);

      // 插入 AI 生成的子任务
      insertAITasks(rootNode.id, parsed.tasks, projectMeta.startDate);

      save();
      afterChange();
      historyEntry.success = true;
      historyEntry.taskCount = parsed.tasks.length;
      historyEntry.tasks = parsed.tasks.map(t => ({
        text: t.text, im: t.im, ur: t.ur, estimate: t.duration || t.estimate,
        date: t.date || t.deadline, start: t.start, deadline: t.date || t.deadline,
        everyday: !!t.everyday, timeSlot: t.timeSlot,
      }));
      try { addAIHistoryEntry(historyEntry); renderAIHistory(); } catch (e) { }
      // v8.5：成功后弹窗展示真实排期结果 + 今日安排（替代原 toast+静默跳转）
      showAIResultModal(rootNode.id, { title: '✅ AI 分解完成' });
    } catch (e) {
      console.error('AI decompose error:', e);
      historyEntry.rawSnippet = String(result).slice(0, 300);
      failAndRollback(e.message);
    }
  } else {
    failAndRollback(lastLLMError() || 'AI 调用失败，请检查 API Key');
  }
}

function showApiKeyPrompt(goalText, projectMeta) {
  const html = buildModalHtml({
    icon: '🔑',
    title: '配置 AI 分解',
    sub: '需要 DeepSeek API Key 来自动分解目标',
    closeId: 'apiKeyClose',
    body: `
      <div class="guide-section">
        <h4>🎯 目标描述</h4>
        <div class="guide-target">${esc(goalText)}</div>
      </div>
      <div class="guide-section">
        <h4>🔑 DeepSeek API Key</h4>
        <div class="guide-ai-setup">
          <div class="hint">DeepSeek API 可以自动帮你分解目标、生成任务树、评估 SMART。</div>
          <div class="hint" style="margin-top:4px">获取方式：访问 <a href="https://platform.deepseek.com" target="_blank" style="color:var(--accent)">platform.deepseek.com</a> 注册并创建 API Key。</div>
          <label class="wfm-row" style="margin-top:10px">
            <span>API Key</span>
            <input type="password" class="gf-input" id="apiKeyInput" placeholder="sk-..." autofocus>
          </label>
        </div>
      </div>
      <div class="guide-section">
        <h4>💡 不使用 AI？</h4>
        <div class="hint">你也可以跳过 AI 分解，手动在「目标规划」页面输入目标。</div>
      </div>`,
    buttons: [
      { id: 'apiKeySave', label: '💾 保存并开始分解', primary: true },
      { id: 'apiKeySkip', label: '跳过，手动输入', ghost: true },
    ],
  });
  const api = openModalMask('workflowMetaModal', html, { closeId: 'apiKeyClose' });
  if (!api) return;
  const { overlay, close } = api;
  overlay.querySelector('#apiKeySkip').onclick = () => { close(); switchView('plan'); };
  overlay.querySelector('#apiKeySave').onclick = () => {
    const key = overlay.querySelector('#apiKeyInput').value.trim();
    if (!key) { alert('请输入 API Key'); return; }
    LLM_KEY = key;
    try { localStorage.setItem(LLM_KEY_STORAGE, key); } catch (e) {}
    close();
    autoDecomposeGoal(goalText, projectMeta);
  };
}

/* ============ 桑基布局 ============ */
const NODEW = 15, COLGAP = 214, UH = 12.5, MINH = 22, LGAP = 15, SX = 46, SY = 58, LBL = 196, MAXLABEL = 13;
function wrapLabel(t) {
  const lines = []; let buf = '';
  for (const ch of (t || '')) { buf += ch; if (buf.length >= MAXLABEL) { lines.push(buf); buf = ''; if (lines.length === 2) break; } }
  if (buf && lines.length < 2) lines.push(buf);
  if (lines.length > 2) return [lines[0], lines[1].slice(0, MAXLABEL - 1) + '…'];
  return lines.length ? lines : [t];
}
/* 构建可见视图（应用聚焦/隐藏噪音/按尺度过滤），并计算每节点"价值"（= 子树重要性之和） */
function buildView(nodes, scale) {
  scale = scale || 'all';
  // 噪音开关合并为单一「显示噪音」： unchecked = 隐去噪音（原聚焦模式语义）
  const noiseEl = document.getElementById('showNoise');
  const showNoise = !!(noiseEl && noiseEl.checked);
  const focus = false;
  const key = scale + '|' + (focus ? 1 : 0) + '|' + (showNoise ? 1 : 0) + '|' + nodes.length + '|' + _tickN;
  if (_viewSlot && _viewSlot.key === key && _viewSlot.nodes === nodes) return _viewSlot.out;
  const out = buildViewRaw(nodes, scale, focus, showNoise);
  _viewSlot = { key, nodes, out };
  return out;
}
function buildViewRaw(nodes, scale, focus, showNoise) {
  const localById = {}; nodes.forEach(n => localById[n.id] = n);
  nodes.forEach(n => { n._vc = []; n._hidden = false; });
  let vis;
  if (scale === 'all') {
    vis = nodes.filter(n => {
      const c = category(n.im, n.ur);
      if ((focus || !showNoise) && c.key === 'noise') { n._hidden = true; return false; }
      return true;
    });
  } else {
    // 选中尺度的节点 + 它们的祖先链（保留话题上下文）
    const keep = new Set();
    nodes.filter(n => n.scale === scale).forEach(n => { let c = n; while (c) { keep.add(c.id); c = c.parentId ? localById[c.parentId] : null; } });
    vis = nodes.filter(n => keep.has(n.id));
  }
  const visSet = new Set(vis.map(n => n.id));
  if (!vis.length) return vis;
  vis.forEach(n => { if (n.parentId && visSet.has(n.parentId)) localById[n.parentId]._vc.push(n); });
  (function val(n) { if (!n._vc.length) { n._val = n.im; return n._val; } let s = 0; n._vc.forEach(c => s += val(c)); n._val = s; return n._val; })(vis.find(n => !n.parentId) || vis[0]);
  return vis;
}
function sankeyLayout(vis) {
  if (!vis.length) return 0;
  let cursor = SY;
  (function place(n) {
    if (!n._vc.length) {
      n._h = Math.max(MINH, n._val * UH);
      n._y = cursor; cursor += n._h + LGAP;
    } else {
      n._vc.forEach(place);
      const first = n._vc[0], last = n._vc[n._vc.length - 1];
      n._y = first._y; n._h = (last._y + last._h) - first._y;
    }
  })(vis.find(n => !n.parentId) || vis[0]);
  let maxD = 0; vis.forEach(n => maxD = Math.max(maxD, n.depth));
  vis.forEach(n => { n._x = SX + n.depth * (NODEW + COLGAP); });
  return maxD;
}

/* ============ 渲染 SVG（桑基流图） ============ */
let state = {
  nodes: [], topId: null, topPin: null, scale: 'all', viewMode: 'sankey', quadQuickWin: false,
  workflows: [], activeWorkflowId: null,
  pomo: { active: false, endAt: 0, nodeId: null, minutes: 25, wfId: null },
  meta: { weekReviews: [], monthReviews: [], quarterReviews: [], bannerDismissedWeek: '', dailyCompletions: {}, alarmFired: {}, executionLog: {}, habitStreaks: {} }
};
const byId = id => state.nodes.find(n => n.id === id);
function nodeHabitKey(n, wfId) {
  if (!n) return '';
  return (wfId || '') + '|' + (n.id || '');
}
function isHabitLike(n) {
  return !!(n && (n.recur || n.role === 'habit'));
}
function appendExecutionLog(wfId, n, patch) {
  if (!state.meta) state.meta = {};
  if (!state.meta.executionLog) state.meta.executionLog = {};
  const dk = dateKey();
  const dayLog = state.meta.executionLog[dk] || { entries: [], byWorkflow: {}, completedCount: 0 };
  const entry = {
    t: Date.now(), wfId: wfId || '', wfName: (workflowById(wfId) || {}).name || '',
    nodeId: n.id, text: n.text, slot: n.slot || '',
    im: n.im || 3, ur: n.ur || 3,
    est: n.estimateMinutes ?? null, act: n.actualMinutes ?? null,
    habit: isHabitLike(n),
    ...patch,
  };
  dayLog.entries.push(entry);
  const key = wfId || '_';
  dayLog.byWorkflow[key] = (dayLog.byWorkflow[key] || 0) + 1;
  dayLog.completedCount = (dayLog.completedCount || 0) + 1;
  state.meta.executionLog[dk] = dayLog;
}
/* v8.10: 取消勾选的对称回滚 —— 删掉今日执行记录里该节点最新一条，计数同步回退。
   此前 executionLog 只增不减：取消勾选后「✅今日已完成」/顶栏 X/Y/时间审计/planVsActual 全部虚报
   （scoreLog 一侧早有 removeTodayScore 对称回滚，executionLog 没有对应物）。 */
function removeExecutionLogEntry(nodeId) {
  if (!state.meta || !state.meta.executionLog) return;
  const dk = dateKey();
  const dayLog = state.meta.executionLog[dk];
  if (!dayLog || !Array.isArray(dayLog.entries)) return;
  for (let i = dayLog.entries.length - 1; i >= 0; i--) {
    if (dayLog.entries[i].nodeId !== nodeId) continue;
    const en = dayLog.entries.splice(i, 1)[0];
    const key = en.wfId || '_';
    dayLog.byWorkflow[key] = Math.max(0, (dayLog.byWorkflow[key] || 1) - 1);
    dayLog.completedCount = Math.max(0, (dayLog.completedCount || 1) - 1);
    if (state.meta.dailyCompletions && (state.meta.dailyCompletions[dk] || 0) > 0) state.meta.dailyCompletions[dk]--;
    break; // 只回滚最新一条（同一天可能勾了取消再勾）
  }
}
function updateHabitStreak(n, wfId, checked) {
  if (!isHabitLike(n)) return;
  if (!state.meta) state.meta = {};
  if (!state.meta.habitStreaks) state.meta.habitStreaks = {};
  const key = nodeHabitKey(n, wfId);
  const rec = state.meta.habitStreaks[key] || { cur: 0, best: 0, lastDate: '' };
  const today = dateKey();
  if (checked) {
    if (rec.lastDate !== today) {
      const yest = new Date(today0()); yest.setDate(yest.getDate() - 1);
      rec.cur = (rec.lastDate === dateKey(yest)) ? (rec.cur || 0) + 1 : 1;
      rec.best = Math.max(rec.best || 0, rec.cur);
      rec.lastDate = today;
    }
  } else {
    if (rec.lastDate === today) {
      // v8.10: 取消打卡回退到「截至昨天的连续数」，不是清零 —— 此前连续 N 天的习惯误点取消 🔥N 直接归 0。
      // cur 的语义是「含今天的连续数」，勾时 cur=昨天连续数+1，故取消时 cur-1、lastDate 回昨天即还原。
      const prev = (rec.cur || 1) - 1;
      if (prev > 0) {
        const yest = new Date(today0()); yest.setDate(yest.getDate() - 1);
        rec.cur = prev;
        rec.lastDate = dateKey(yest);
      } else {
        rec.cur = 0;
        rec.lastDate = '';
      }
    }
  }
  state.meta.habitStreaks[key] = rec;
}
function habitStreakOf(n, wfId) {
  if (!state.meta || !state.meta.habitStreaks) return null;
  const rec = state.meta.habitStreaks[nodeHabitKey(n, wfId)];
  if (!rec || !rec.cur) return null;
  return rec;
}
/* ---- 习惯分轨（v7：每周几次 / 计数 / 强度衰减，不跟大石头抢 Top1） ---- */
/* v7.7 灵活周期：recurrence = {type, days[], interval, anchorDate, dayOfMonth, times}
   旧习惯（recur + timesPerWeek）无 recurrence 时按 timesPerWeek / 每天 兜底 */
function habitRecurrence(n) {
  if (n && n.recurrence && n.recurrence.type) return n.recurrence;
  if (n && n.timesPerWeek > 0) return { type: 'timesPerWeek', times: n.timesPerWeek };
  return { type: 'daily' };
}
function habitTarget(n) {
  if (!n) return 7;
  const r = habitRecurrence(n);
  switch (r.type) {
    case 'timesPerWeek': return r.times || n.timesPerWeek || 7;
    case 'weekdays': return 5;
    case 'weekends': return 2;
    case 'weekly': return (r.days && r.days.length) || 7;
    case 'interval': return Math.max(1, Math.round(7 / (r.interval || 1)));
    case 'monthly': return 1;
    case 'daily': return 7;
    default: return n.timesPerWeek > 0 ? n.timesPerWeek : 7;
  }
}
/* 今天是否到期（固定日程型只在到期日出现；每周N次型每天都可打卡，按周计数） */
function habitDueToday(n, date) {
  const r = habitRecurrence(n);
  const d = date || today0();
  const wd = d.getDay();
  switch (r.type) {
    case 'weekdays': return wd >= 1 && wd <= 5;
    case 'weekends': return wd === 0 || wd === 6;
    case 'weekly': return (r.days || []).indexOf(wd) >= 0;
    case 'monthly': return d.getDate() === (r.dayOfMonth || 1);
    case 'interval': {
      const iv = r.interval || 1;
      const anchor = r.anchorDate ? new Date(r.anchorDate + 'T00:00:00') : (n.createdAt ? new Date(n.createdAt) : d);
      const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
      return diff >= 0 && diff % iv === 0;
    }
    case 'timesPerWeek': return true;
    case 'daily':
    default: return true;
  }
}
/* 循环任务（非习惯）：当天已完成本次则不再出现，否则按周期判定到期 */
function isRecurringTask(n) { return !!(n.recurrence && n.recurrence.type && !n.recur && n.role !== 'habit'); }
function recurringTaskDueToday(n, date) {
  const d = date || today0();
  const dk = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  if (n.lastRecDone === dk) return false;
  return habitDueToday(n, d);
}
const WD_LABEL = ['日', '一', '二', '三', '四', '五', '六'];
function recurrenceLabel(n) {
  const r = habitRecurrence(n);
  switch (r.type) {
    case 'weekdays': return '工作日';
    case 'weekends': return '周末';
    case 'weekly': return '每周' + ((r.days || []).slice().sort((a, b) => a - b).map(d => WD_LABEL[d]).join('') || '…');
    case 'monthly': return '每月' + (r.dayOfMonth || 1) + '号';
    case 'interval': return '每' + (r.interval || 1) + '天';
    case 'timesPerWeek': return '每周' + (r.times || n.timesPerWeek || 7) + '次';
    case 'daily':
    default: return '每天';
  }
}
/* Loop 式习惯强度：做到 +5，漏做按频率衰减（漏几天不清零） */
function habitStrength(rec) {
  if (!rec) return { pct: 0, samples: 0 };
  const days = Math.min(30, Object.keys(rec.log || {}).length);
  let score = 0, k = 0;
  const t = today0();
  for (let i = 0; i < 30 && k < 30; i++) {
    const d = new Date(t); d.setDate(d.getDate() - i);
    const dk = dateKey(d);
    if ((rec.log || {})[dk] == null) continue;
    k++;
    score = Math.min(1, score + 0.05);
    if (!rec.log[dk]) score = Math.max(0, score - (rec.freqDecay || 0.02));
  }
  return { pct: Math.round(score * 100), samples: days };
}
function habitWeekLog(n, wfId) {
  const rec = (state.meta && state.meta.habitStreaks || {})[nodeHabitKey(n, wfId)];
  const { start, end } = weekRange();
  let done = 0, minutes = 0;
  Object.keys((rec && rec.log) || {}).forEach(dk => {
    const t = new Date(dk + 'T00:00:00').getTime();
    if (t >= start.getTime() && t < end.getTime() && rec.log[dk]) { done++; minutes += rec.log[dk].act || 0; }
  });
  return { done, minutes, target: habitTarget(n), left: Math.max(0, habitTarget(n) - done), rec };
}
/* 勾选：写入习惯日期日志（含计数值） */
function logHabitCheck(n, wfId, checked) {
  if (!isHabitLike(n)) return;
  ensureScoreMeta();
  const key = nodeHabitKey(n, wfId);
  const rec = state.meta.habitStreaks[key] || { cur: 0, best: 0, lastDate: '', log: {}, freqDecay: (habitTarget(n) >= 7 ? 0.02 : 0.012) };
  if (!rec.log) rec.log = {};
  rec.freqDecay = (habitTarget(n) >= 7 ? 0.02 : 0.012);
  const dk = dateKey();
  if (checked) {
    const prev = rec.log[dk];
    rec.log[dk] = { done: true, act: (prev && prev.act || 0) + (n.actualMinutes || n.estimateMinutes || 0) };
    // 计数型习惯（每周N次）：完成一次 → targetDone 本周内 +1，周日重置由展示层按周统计
    if (n.timesPerWeek > 0 && n.targetNum > 0 && (!prev || !prev.done)) n.targetDone = (n.targetDone || 0) + 1;
  } else {
    if (rec.log[dk]) delete rec.log[dk];
    // 取消勾选回滚本周计数（计数型习惯）
    if (n.timesPerWeek > 0 && n.targetNum > 0 && (n.targetDone || 0) > 0) n.targetDone = (n.targetDone || 0) - 1;
  }
  state.meta.habitStreaks[key] = rec;
}
function newWorkflowId() { return 'wf_' + Math.random().toString(36).slice(2, 11); }
function workflowById(id) { return (state.workflows || []).find(w => w.id === id); }
function normalizeWorkflowMeta(w) {
  if (!w || typeof w !== 'object') return;
  w.name = (w.name == null ? '' : String(w.name));
  if (!Array.isArray(w.tags)) w.tags = [];
  else w.tags = w.tags.map(t => String(t).trim()).filter(Boolean);
  w.startDate = w.startDate != null ? String(w.startDate) : '';
  w.endDate = w.endDate != null ? String(w.endDate) : '';
  w.description = w.description != null ? String(w.description) : '';
  w.color = w.color != null ? String(w.color) : '';
  // v8.18: 无自定义色时写入稳定默认色（侧栏色条 / 项目点共用），避免全是灰点
  if (!w.color) w.color = workflowColor({ id: w.id, color: '' });
  w.topPin = w.topPin || null;
}
function ensureWorkflows() {
  if (!state.workflows || !state.workflows.length) {
    const wf = { id: newWorkflowId(), name: '默认目标', nodes: state.nodes || [], topId: state.topId || null, tags: [], startDate: '', endDate: '', description: '' };
    normalizeWorkflowMeta(wf);
    state.workflows = [wf];
    state.activeWorkflowId = state.workflows[0].id;
  }
  state.workflows.forEach(w => {
    if (w.nodes === undefined) w.nodes = [];
    normalizeWorkflowMeta(w);
  });
  if (!state.activeWorkflowId) state.activeWorkflowId = state.workflows[0].id;
  if (!workflowById(state.activeWorkflowId)) state.activeWorkflowId = state.workflows[0].id;
}
function parseTagsInput(str) {
  return String(str || '').split(/[，,\s]+/).map(s => s.trim()).filter(Boolean);
}
function flushActiveWorkflow() {
  ensureWorkflows();
  const w = workflowById(state.activeWorkflowId);
  if (!w) return;
  // state.nodes 即当前流的引用，不再拷贝——任何修改直接落在 wf.nodes 上
  if (w.nodes !== state.nodes) w.nodes = state.nodes;
  w.topId = state.topId;
  w.topPin = state.topPin;
}
function applyActiveWorkflow() {
  ensureWorkflows();
  const w = workflowById(state.activeWorkflowId);
  if (!w) return;
  state.nodes = w.nodes || [];
  state.topId = w.topId || null;
  state.topPin = w.topPin || null;
  if (state.nodes.length) recomputeSchedule(state.nodes);
}
function switchWorkflow(id) {
  if (!id || id === state.activeWorkflowId) return;
  flushActiveWorkflow();
  state.activeWorkflowId = id;
  applyActiveWorkflow();
  syncTreeToInput();
  save();
  afterChange();
}
function createWorkflow(meta) {
  flushActiveWorkflow();
  meta = meta || {};
  const wf = {
    id: newWorkflowId(),
    name: (String(meta.name || '新项目').trim()) || '新项目',
    tags: Array.isArray(meta.tags) ? meta.tags : parseTagsInput(meta.tags),
    startDate: String(meta.startDate || ''),
    endDate: String(meta.endDate || ''),
    description: String(meta.description || ''),
    color: meta.color || '',
    nodes: [], topId: null,
  };
  normalizeWorkflowMeta(wf);
  state.workflows.push(wf);
  state.activeWorkflowId = wf.id;
  state.nodes = [];
  state.topId = null;
  state.topPin = null;
  save();
  afterChange();
  syncTreeToInput();
}
function updateWorkflowMeta(id, meta) {
  const w = workflowById(id);
  if (!w) return;
  meta = meta || {};
  if (meta.name != null) w.name = String(meta.name).trim() || w.name;
  if (meta.tags != null) w.tags = Array.isArray(meta.tags) ? meta.tags : parseTagsInput(meta.tags);
  if (meta.startDate != null) w.startDate = String(meta.startDate);
  if (meta.endDate != null) w.endDate = String(meta.endDate);
  if (meta.description != null) w.description = String(meta.description);
  if (meta.color != null) w.color = String(meta.color);
  normalizeWorkflowMeta(w);
  save();
  afterChange();
}
/* v6.5 目标归档与庆祝：100% 叶子完成的工作流可归档（只读、不进今日汇总） */
function activeWorkflows() { return (state.workflows || []).filter(w => !w.archived); }
function wfLeafCountsAll(nodes) {
  const leaves = (nodes || []).filter(n => n.parentId && !((nodes || []).some(c => c.parentId === n.id)));
  return { d: leaves.filter(n => n.done).length, t: leaves.length };
}
function isWorkflowComplete(w) {
  const k = wfLeafCountsAll(w && w.nodes);
  return k.t > 0 && k.d === k.t;
}
function archiveWorkflow(id) {
  const w = workflowById(id);
  if (!w) return;
  if (!isWorkflowComplete(w)) { alert('该项目叶子尚未全部完成，暂不能归档。'); return; }
  w.archived = true;
  w.archivedAt = Date.now();
  if (state.activeWorkflowId === id) {
    const next = (state.workflows || []).find(x => !x.archived && x.id !== id);
    if (next) { state.activeWorkflowId = next.id; applyActiveWorkflow(); }
  }
  save(); afterChange();
  openArchiveCelebrate(w);
}
function unarchiveWorkflow(id) {
  const w = workflowById(id);
  if (!w) return;
  w.archived = false;
  save(); afterChange();
}
function openArchiveCelebrate(w) {
  const k = wfLeafCountsAll(w.nodes);
  const html = buildModalHtml({
    icon: '🎉',
    title: `${w.name || '未命名项目'} · 完成！`,
    sub: `${k.t} 个叶子全部落地`,
    closeId: 'archX',
    modalClass: 'gf-modal',
    style: 'max-width:440px',
    bodyClass: '',
    body: `<div style="text-align:center;padding:18px">
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px">完成仪式的闭环，会强化「我能做成事」的自我效能。项目已移入归档区（侧栏底部），只读可查，不再进入今日汇总。</p>
      <button type="button" class="gf-btn gf-btn--primary" id="archClose">收下这份完成</button>
    </div>`,
    footHtml: ''
  });
  // weekReviewModal 用 display:block 而非 .show
  const api = openModalMask('weekReviewModal', html, {
    closeId: 'archX',
    displayBlock: true,
    backdrop: false
  });
  if (!api) return;
  api.overlay.querySelector('#archClose').onclick = api.close;
}
/* v8.4 项目模板：新建项目时一键应用 —— 预填表单（名称/标签/周期/时间预算/窗口/带宽）+
   创建后直接生成模板任务树（走 insertAITasks → v8.2 兜底排期自动落进窗口）。
   tasks 兼容 insertAITasks 格式：{text, im, ur, estimate, everyday, children[]}（不带 date/start，由 backfill 顺排）。 */
const WF_TEMPLATES = [
  {
    id: 'study', icon: '📚', name: '学习考试', hint: '考证 / 备考 / 系统学一门技能',
    preset: { tags: '学习,成长', days: 90, workdayHours: 1.5, weekendHours: 3, share: 30, wins: [{ start: '19:00', mins: 120 }] },
    desc: '如：3 个月通过 XX 考试，每天投入 1.5 小时',
    tasks: [
      { text: '第 1 轮：通读教材/课程，搭知识框架', im: 5, ur: 4, children: [
        { text: '列出全部章节与考纲要点', im: 4, ur: 4, estimate: 45 },
        { text: '每周完成 2 章学习 + 思维导图笔记', im: 4, ur: 4, estimate: 90 },
      ] },
      { text: '第 2 轮：刷题 + 整理错题本', im: 5, ur: 4, estimate: 90 },
      { text: '每周 1 次模拟自测 + 复盘薄弱点', im: 4, ur: 3, estimate: 120 },
      { text: '每日背记 30 分钟（碎片时间）', im: 3, ur: 3, estimate: 30, everyday: true },
    ],
  },
  {
    id: 'fitness', icon: '💪', name: '健康健身', hint: '减脂 / 增肌 / 体能习惯',
    preset: { tags: '健康', days: 90, workdayHours: 1, weekendHours: 1.5, share: 20, wins: [{ start: '07:00', mins: 90 }] },
    desc: '如：3 个月体脂降到 20%，每周 3 练',
    tasks: [
      { text: '做一次体测记录基线（体重/体脂/围度）', im: 4, ur: 4, estimate: 30 },
      { text: '每周 3 次力量或有氧训练', im: 5, ur: 3, estimate: 60, everyday: false },
      { text: '准备一周健康餐单并采购', im: 3, ur: 3, estimate: 45 },
      { text: '每日步行 8000 步', im: 3, ur: 2, estimate: 40, everyday: true },
      { text: '每 2 周复测对比，调整计划', im: 4, ur: 3, estimate: 20 },
    ],
  },
  {
    id: 'sidebiz', icon: '💼', name: '副业产品', hint: 'MVP / 上线 / 第一批用户',
    preset: { tags: '副业,工作', days: 120, workdayHours: 2, weekendHours: 4, share: 40, wins: [{ start: '19:00', mins: 180 }, { start: '12:30', mins: 60 }] },
    desc: '如：4 个月上线副业产品并获 100 个用户',
    tasks: [
      { text: 'MVP：最小可行产品', im: 5, ur: 5, children: [
        { text: '写下目标用户与核心场景（1 页纸）', im: 5, ur: 4, estimate: 60 },
        { text: '搭建核心功能最小闭环', im: 5, ur: 5, estimate: 240 },
        { text: '找 3 个目标用户试用并记录反馈', im: 4, ur: 4, estimate: 90 },
      ] },
      { text: '上线发布（落地页 + 支付/联系方式）', im: 4, ur: 4, estimate: 120 },
      { text: '每周发布 1 篇内容获客', im: 4, ur: 3, estimate: 90, everyday: false },
      { text: '每周复盘数据并迭代一个方向', im: 4, ur: 3, estimate: 60 },
    ],
  },
  {
    id: 'write', icon: '📖', name: '读书写作', hint: '读完 N 本 / 持续输出',
    preset: { tags: '成长,创作', days: 90, workdayHours: 1, weekendHours: 2, share: 20, wins: [{ start: '21:00', mins: 90 }] },
    desc: '如：3 个月读完 6 本书并写 12 篇笔记',
    tasks: [
      { text: '列出主题书单（6 本）并备齐', im: 3, ur: 3, estimate: 30 },
      { text: '每日阅读 30 分钟', im: 4, ur: 2, estimate: 30, everyday: true },
      { text: '每本书读完写 1 篇笔记/书评', im: 4, ur: 3, estimate: 60 },
      { text: '每周回顾摘抄，沉淀 1 张知识卡', im: 3, ur: 2, estimate: 30 },
    ],
  },
];
/* v8.7: 模板是否自带「已安排好的具体时间」（任一任务含 date/start，含嵌套 children）。
   有 → 创建时直接套用模板（排期已定，不必再过 AI）；无 → 走 AI 分解，模板作失败兜底骨架。 */
function templateHasSchedule(tpl) {
  const walk = ts => (ts || []).some(t => !!(t.date || t.start) || walk(t.children));
  return walk(tpl && tpl.tasks);
}
/* v8.4: 应用项目模板 —— 建根节点 + insertAITasks 生成模板任务树（v8.2 兜底排期自动落窗口）。
   v8.6: opts.silent = 不弹结果窗（AI 失败回落时由错误弹窗统一说明，避免双弹窗叠放） */
function applyWorkflowTemplate(tpl, meta, opts) {
  ensureWorkflows();
  const root = newNode({
    id: 'n1',
    text: meta.name || (tpl.icon + ' ' + tpl.name),
    im: 4, ur: 3,
    scale: 'month',
    source: 'template'
  });
  // v8.9: 防御——当前流若有旧树，整树替换前清旧引用（新建流为空集 no-op）
  purgeCurrentTreeRefs();
  state.nodes = [root];
  setNodeDeadline(root, meta.endDate, meta.startDate);
  insertAITasks(root.id, tpl.tasks, meta.startDate);
  // v8.5：模板生成后同样弹窗展示排期结果（替代原 toast+静默跳转）
  if (!opts || !opts.silent) showAIResultModal(root.id, { title: `${tpl.icon} 模板已应用：${tpl.name}` });
}
/* v8.8: 页内确认弹窗（Promise<boolean>）—— 替代原生 confirm。
   根因：部分 WebView/嵌入浏览器（微信 H5、未实现 JsConfirm 的 Android WebView、kiosk 模式）
   会静默吞掉 window.confirm（返回 false 或抛错），表现为「点了没反应」——
   v8.4 放开了最后一个项目的删除逻辑，但原生 confirm 在这些环境里根本弹不出来。 */

/* ============ v8.22 公共 UI 壳（弹窗 / 折叠块 / 空态）============
   盘点：app.js 内 20+ 处弹窗手写同一套 modal-head + mh-x + show/遮罩关闭；
   fold/empty-state 也多处复制。抽出壳后新弹窗只填内容，关闭行为统一。
   （v8.21 并行会话占用：设置扩充 / 去 todayBrief / 全局多段空闲） */
function modalHeadHtml(opts) {
  opts = opts || {};
  const closeId = opts.closeId || 'modalClose';
  const sub = opts.subHtml != null ? opts.subHtml
    : (opts.sub ? `<div class="mh-sub">${esc(opts.sub)}</div>` : '');
  return `<div class="modal-head">
    ${opts.icon != null && opts.icon !== '' ? `<div class="mh-ic">${opts.icon}</div>` : ''}
    <div><div class="mh-tt">${opts.titleHtml != null ? opts.titleHtml : esc(opts.title || '')}</div>${sub}</div>
    <button type="button" class="mh-x" id="${esc(closeId)}" aria-label="关闭">×</button>
  </div>`;
}
function modalFootHtml(buttons) {
  if (!buttons || !buttons.length) return '';
  const html = buttons.map(b => {
    const cls = ['gf-btn', b.primary ? 'gf-btn--primary' : '', b.ghost ? 'gf-btn--ghost' : '', b.danger ? 'gf-btn--danger' : '', b.sm ? 'gf-btn--sm' : '']
      .filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" id="${esc(b.id)}">${b.html != null ? b.html : esc(b.label || '')}</button>`;
  }).join('');
  return `<div class="modal-foot">${html}</div>`;
}
function buildModalHtml(opts) {
  opts = opts || {};
  const closeId = opts.closeId || 'modalClose';
  const wide = opts.wide ? ' modal-wide' : '';
  const extra = opts.modalClass ? ' ' + opts.modalClass : '';
  const body = opts.body != null ? opts.body : '';
  const foot = opts.footHtml != null ? opts.footHtml : modalFootHtml(opts.buttons);
  const bodyCls = opts.bodyClass != null ? opts.bodyClass : 'wfm-body';
  const styleAttr = opts.style ? ` style="${esc(opts.style)}"` : '';
  return `<div class="modal${wide}${extra}" role="dialog"${styleAttr}>${modalHeadHtml({
    icon: opts.icon, title: opts.title, titleHtml: opts.titleHtml, sub: opts.sub, subHtml: opts.subHtml, closeId
  })}${bodyCls ? `<div class="${bodyCls}">${body}</div>` : body}${foot}</div>`;
}
/* 打开遮罩弹窗：写入 HTML、绑定关闭钮与点遮罩关闭。返回 {overlay, close}。 */
function openModalMask(maskId, html, opts) {
  opts = opts || {};
  const overlay = document.getElementById(maskId || 'smartModal');
  if (!overlay) return null;
  overlay.innerHTML = html;
  if (opts.displayBlock) overlay.style.display = 'block';
  else overlay.classList.add('show');
  const close = () => {
    overlay.classList.remove('show');
    if (opts.displayBlock) overlay.style.display = 'none';
    overlay.innerHTML = '';
    if (typeof opts.onClose === 'function') opts.onClose();
  };
  const closeId = opts.closeId || 'modalClose';
  const x = overlay.querySelector('#' + closeId);
  if (x) x.onclick = close;
  if (opts.backdrop !== false) {
    overlay.onclick = e => { if (e.target === overlay) close(); };
  }
  return { overlay, close };
}
/* 折叠块：审计/停滞/已完成等共用 */
function foldSectionHtml(opts) {
  opts = opts || {};
  const openAttr = opts.open ? ' open' : '';
  const ariaExp = opts.open ? 'true' : 'false';
  const fold = opts.fold || '';
  const cls = ['fold', opts.warn ? 'warn' : '', opts.cls || ''].filter(Boolean).join(' ');
  const sumExtra = opts.sumHtml || '';
  return `<details class="${cls}"${fold ? ` data-fold="${esc(fold)}"` : ''}${openAttr}>
    <summary aria-expanded="${ariaExp}">${opts.titleHtml != null ? opts.titleHtml : esc(opts.title || '')}${sumExtra}</summary>
    <div class="fold-body">${opts.body || ''}</div>
  </details>`;
}
/* 空态：今日/规划等共用（btnOnclick 由调用方控制，不 esc） */
function emptyStateHtml(opts) {
  opts = opts || {};
  let btn = opts.btnHtml || '';
  if (!btn && opts.btnLabel) {
    const attrs = ['type="button"', 'class="gf-btn gf-btn--primary"'];
    if (opts.btnId) attrs.push(`id="${esc(opts.btnId)}"`);
    if (opts.btnOnclick) attrs.push(`onclick="${opts.btnOnclick}"`);
    btn = `<button ${attrs.join(' ')}>${esc(opts.btnLabel)}</button>`;
  }
  return `<div class="empty-state" style="text-align:center;padding:24px 16px;color:var(--muted)">
    ${opts.icon ? `<div style="font-size:32px;margin-bottom:8px">${opts.icon}</div>` : ''}
    ${opts.title ? `<div style="font-size:14px;font-weight:500;margin-bottom:4px">${esc(opts.title)}</div>` : ''}
    ${opts.hint ? `<div class="empty-hint">${esc(opts.hint)}</div>` : ''}
    ${btn}
  </div>`;
}
/* 行壳：勾选 + 标题 + meta + 更多（Things 式清单行共用） */
function rowChrome(opts) {
  opts = opts || {};
  const cls = ['gf-row', opts.cls || ''].filter(Boolean).join(' ');
  const id = opts.id ? ` id="${esc(opts.id)}"` : '';
  const attrs = opts.attrs ? ' ' + opts.attrs.trim() : '';
  let check = '';
  if (opts.checkHtml != null) check = opts.checkHtml;
  else if (opts.checked !== undefined || opts.checkAttrs) {
    const checked = opts.checked ? ' checked' : '';
    check = `<label class="gf-row-check${opts.checkLabelCls ? ' ' + opts.checkLabelCls : ''}"><input type="checkbox"${checked}${opts.checkAttrs || ''}></label>`;
  }
  const titleBlock = opts.titleHtml != null
    ? `<div class="gf-row-title">${opts.titleHtml}</div>`
    : (opts.title ? `<div class="gf-row-title">${esc(opts.title)}</div>` : '');
  const meta = opts.metaHtml ? `<div class="gf-row-meta">${opts.metaHtml}</div>` : '';
  const extra = opts.extraHtml || '';
  let more = '';
  if (opts.moreHtml) {
    const moreCls = ['gf-row-more', opts.moreCls || ''].filter(Boolean).join(' ');
    const moreAttr = opts.moreAttrs ? ' ' + opts.moreAttrs.trim() : '';
    more = `<div class="${moreCls}"${moreAttr}>${opts.moreHtml}</div>`;
  }
  return `<div class="${cls}"${id}${attrs}>${check}${titleBlock}${meta}${extra}${more}</div>`;
}

function confirmModal(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const overlay = document.getElementById('smartModal');
    if (!overlay) { try { resolve(window.confirm(opts.text || '确定？')); } catch (e) { resolve(false); } return; }
    let settled = false;
    const html = buildModalHtml({
      icon: opts.icon || '⚠️',
      title: opts.title || '确认操作',
      closeId: 'cfmClose',
      body: `<div class="cfm-text">${esc(opts.text || '')}</div>${opts.sub ? `<div class="hint">${esc(opts.sub)}</div>` : ''}`,
      buttons: [
        { id: 'cfmOk', label: opts.okText || '确定', primary: true, danger: !!opts.danger },
        { id: 'cfmCancel', label: opts.cancelText || '取消', ghost: true }
      ]
    });
    const api = openModalMask('smartModal', html, { closeId: 'cfmClose', backdrop: false });
    if (!api) { resolve(false); return; }
    const done = v => {
      if (settled) return;
      settled = true;
      api.overlay.classList.remove('show');
      api.overlay.innerHTML = '';
      resolve(v);
    };
    api.overlay.querySelector('#cfmOk').onclick = () => done(true);
    api.overlay.querySelector('#cfmCancel').onclick = () => done(false);
    api.overlay.querySelector('#cfmClose').onclick = () => done(false);
    api.overlay.onclick = e => { if (e.target === api.overlay) done(false); };
  });
}
async function deleteWorkflow(id) {
  if (!id) return;
  ensureWorkflows();
  const w = workflowById(id);
  if (!w) return;
  const isLast = state.workflows.length <= 1;
  // v8.8：原生 confirm 改页内确认弹窗（任何环境都可点，根治「最后一个项目点删除没反应」）
  const okDel = await confirmModal({
    icon: '🗑', title: '删除项目', danger: true, okText: '删除',
    text: `确定删除项目「${w.name}」？其目标树也会删除，且不可撤销。`,
    sub: isLast ? '这是最后一个项目，删除后将回到空白初始状态。' : '',
  });
  if (!okDel) return;
  state.workflows = state.workflows.filter(x => x.id !== id);
  // v8.8：同步清理引用该项目的散落数据（原只删 workflow 本体，留下一堆孤儿引用）
  // v8.9：抽成 purgeWorkflowRefs 与 clearAll 共用（含番茄钟解绑）
  purgeWorkflowRefs(id);
  // v8.4：允许删除最后一个项目 —— 删空后重建空白项目（回到初始空态，可新建/用模板/载入示例）
  if (!state.workflows.length) {
    state.nodes = []; state.topId = null; state.topPin = null;
    const wf = { id: newWorkflowId(), name: '默认目标', nodes: [], topId: null, tags: [], startDate: '', endDate: '', description: '' };
    normalizeWorkflowMeta(wf);
    state.workflows = [wf];
  }
  if (state.activeWorkflowId === id || !workflowById(state.activeWorkflowId)) {
    state.activeWorkflowId = state.workflows[0].id;
    applyActiveWorkflow();
  }
  save();
  saveMeta();
  afterChange();
  syncTreeToInput();
  showToast(`🗑 已删除项目「${esc((w.name || '').slice(0, 16))}」`);
  sysNotify('🗑 项目已删除', w.name || '');
}
function openWorkflowMetaModal(mode, wfId) {
  const overlayPre = document.getElementById('workflowMetaModal');
  if (!overlayPre) return;
  // v8.5 修复：overlay 是复用元素，dataset.tpl 不随 innerHTML 清除——
  // 残留会导致「上次点过模板，之后每次创建都走模板分支、AI 分解永远不触发」
  delete overlayPre.dataset.tpl;
  ensureWorkflows();
  const isNew = mode === 'create';
  const w = isNew ? null : workflowById(wfId || state.activeWorkflowId);
  const name = isNew ? '' : (w && w.name || '');
  const tags = isNew ? '' : ((w && w.tags) || []).join(', ');
  const sd = isNew ? '' : (w && w.startDate || '');
  const ed = isNew ? '' : (w && w.endDate || '');
  const desc = isNew ? '' : (w && w.description || '');
  const body = `
      ${isNew ? `<div class="wfm-tpl" id="wfmTpl">
        <div class="wfm-tpl-h">📋 从模板快速开始 <span class="hint" style="display:inline">（可选——点一下预填表单，创建时 AI 按模板方向分解，失败自动用模板骨架）</span></div>
        <div class="wfm-tpl-chips">
          ${WF_TEMPLATES.map(t => `<button type="button" class="wfm-tpl-chip" data-tpl="${t.id}" title="${esc(t.hint)}">${t.icon} ${esc(t.name)}</button>`).join('')}
        </div>
      </div>` : ''}
      <label class="wfm-row"><span>项目名称</span><input id="wfmName" class="gf-input" value="${esc(name)}" placeholder="如：副业收入 / 2026 健康"></label>
      <label class="wfm-row"><span>标签（逗号分隔）</span><input id="wfmTags" class="gf-input" value="${esc(tags)}" placeholder="工作, 成长, 家庭"></label>
      <div class="wfm-2col">
        <label class="wfm-row"><span>开始日期</span><input id="wfmStart" type="date" class="gf-input" value="${esc(sd)}"></label>
        <label class="wfm-row"><span>结束日期</span><input id="wfmEnd" type="date" class="gf-input" value="${esc(ed)}"></label>
      </div>
      <div class="wfm-wins">
        <div class="wfm-wins-h"><span>本项目可安排（须落在我的空闲内）</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="wfmWinAdd">＋ 添加时段</button></div>
        <div id="wfmWinsList"></div>
        <div class="hint">人有空闲时段；项目可再收窄。保存时超出「我的空闲」的时段会自动裁掉；留空 = 沿用我的空闲（不设项目级收窄）。</div>
      </div>
      <label class="wfm-row"><span>目标描述</span><textarea id="wfmDesc" class="gf-input" rows="2" placeholder="想达成什么？达到什么水平？">${esc(desc)}</textarea></label>

      <div class="wfm-section">
        <h4>⏱ 时间预算（每周可投入多少时间）</h4>
        <div class="wfm-2col">
          <label class="wfm-row"><span>工作日（每天）</span><input id="wfmWorkdayHours" type="number" min="0" max="16" step="0.5" class="gf-input" value="${isNew ? '' : ((state.meta.capacity || {})[wfId || state.activeWorkflowId] || {}).workdayHours ?? ''}" placeholder="如 1.5"></label>
          <label class="wfm-row"><span>周末（每天）</span><input id="wfmWeekendHours" type="number" min="0" max="16" step="0.5" class="gf-input" value="${isNew ? '' : ((state.meta.capacity || {})[wfId || state.activeWorkflowId] || {}).weekendHours ?? ''}" placeholder="如 3"></label>
        </div>
        <div class="hint">系统会自动计算每周可用时间 = 工作日×5 + 周末×2</div>
      </div>

      <label class="wfm-row"><span>计划带宽（% 精力）</span><input id="wfmShare" type="number" min="0" max="100" class="gf-input" value="${isNew ? '' : (state.meta.planShare || {})[wfId || state.activeWorkflowId] ?? ''}" placeholder="如 40 = 打算投 40% 精力"></label>
      <div class="hint" style="margin:-4px 0 0">计划带宽 = 你「打算」投入的精力占比，桑基图上会与近 7 天实际投入对比。</div>`;
  const wfmFoot = [
    { id: 'wfmSave', label: isNew ? '创建项目' : '保存', primary: true },
    ...(!isNew && w ? [{ id: 'wfmDelete', label: '删除项目', ghost: true }] : []),
    { id: 'wfmCancel', label: '取消', ghost: true },
  ];
  const html = buildModalHtml({
    icon: '📁',
    title: isNew ? '新建项目' : '项目设置',
    sub: '项目 = 一棵目标树 / 一个工作流，可长期维护',
    closeId: 'wfmClose',
    bodyClass: 'wfm-body',
    body,
    footHtml: modalFootHtml(wfmFoot),
  });
  const api = openModalMask('workflowMetaModal', html, { closeId: 'wfmClose' });
  if (!api) return;
  const overlay = api.overlay;
  const close = api.close;
  overlay.querySelector('#wfmCancel').onclick = close;
  // v8.2: 每日可安排时段（多段：开始 + 时长）—— 行渲染 / 添加 / 删除
  const winsList = overlay.querySelector('#wfmWinsList');
  const winRowHtml = (w) => `<div class="wfm-win-row">
    <input type="time" class="gf-input wfm-win-s" value="${esc(w.start || '')}" title="时段开始时间">
    <span class="wfm-win-sep">起</span>
    <input type="number" class="gf-input wfm-win-m" min="0.5" max="12" step="0.5" value="${w.mins ? (w.mins / 60) : ''}" placeholder="时长" title="时段长度（小时）">
    <span class="wfm-win-sep">小时</span>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost wfm-win-del" title="删除该时段">✕</button>
  </div>`;
  const bindWinRows = () => {
    winsList.querySelectorAll('.wfm-win-del').forEach(b => b.onclick = () => { b.closest('.wfm-win-row').remove(); });
  };
  {
    const capId = wfId || state.activeWorkflowId;
    const cap = (state.meta.capacity || {})[capId] || {};
    const initWins = isNew ? [] : (Array.isArray(cap.wins) ? cap.wins : []);
    winsList.innerHTML = initWins.map(winRowHtml).join('');
    bindWinRows();
  }
  overlay.querySelector('#wfmWinAdd').onclick = () => {
    winsList.insertAdjacentHTML('beforeend', winRowHtml({}));
    bindWinRows();
    const inp = winsList.querySelector('.wfm-win-row:last-child .wfm-win-s');
    if (inp) inp.focus();
  };
  // v8.4 模板 chips：点一下预填表单（名称/标签/周期/预算/窗口/带宽），创建时生成模板任务树
  if (isNew) {
    overlay.querySelectorAll('.wfm-tpl-chip').forEach(chip => {
      chip.onclick = () => {
        const tpl = WF_TEMPLATES.find(t => t.id === chip.dataset.tpl);
        if (!tpl) return;
        // v8.5：再点已选中的 chip = 取消模板（回到「创建后可 AI 分解」路径）
        if (chip.classList.contains('on')) {
          chip.classList.remove('on');
          delete overlay.dataset.tpl;
          showToast('已取消模板——创建后可用 AI 分解或手动规划');
          return;
        }
        overlay.querySelectorAll('.wfm-tpl-chip').forEach(c => c.classList.toggle('on', c === chip));
        overlay.dataset.tpl = tpl.id;
        const set = (id, val) => { const el = overlay.querySelector(id); if (el && !el.value.trim()) el.value = val; };
        const setForce = (id, val) => { const el = overlay.querySelector(id); if (el) el.value = val; };
        set('#wfmName', tpl.icon + ' ' + tpl.name);
        set('#wfmTags', tpl.preset.tags);
        const today = dateKey();
        const endD = new Date(); endD.setDate(endD.getDate() + (tpl.preset.days || 90));
        setForce('#wfmStart', today);
        setForce('#wfmEnd', dateKey(endD));
        setForce('#wfmWorkdayHours', String(tpl.preset.workdayHours || ''));
        setForce('#wfmWeekendHours', String(tpl.preset.weekendHours || ''));
        setForce('#wfmShare', String(tpl.preset.share || ''));
        const descEl = overlay.querySelector('#wfmDesc');
        if (descEl && !descEl.value.trim()) descEl.placeholder = tpl.desc;
        winsList.innerHTML = (tpl.preset.wins || []).map(winRowHtml).join('');
        bindWinRows();
        showToast(`${tpl.icon} 已预填「${tpl.name}」模板——创建时 AI 将按此方向分解（失败自动用模板骨架）`);
      };
    });
  }
  const readWins = () => {
    const out = [];
    let bad = false;
    winsList.querySelectorAll('.wfm-win-row').forEach(row => {
      const s = row.querySelector('.wfm-win-s').value.trim();
      const h = parseFloat(row.querySelector('.wfm-win-m').value) || 0;
      if (!s && h <= 0) return;  // 空行跳过
      if (!s || h <= 0) { bad = true; return; }
      out.push({ start: s, mins: clamp(Math.round(h * 60), 15, 720) });
    });
    return bad ? null : out;
  };
  overlay.querySelector('#wfmSave').onclick = () => {
    const v = (id) => overlay.querySelector(id) ? overlay.querySelector(id).value.trim() : '';
    const meta = { name: v('#wfmName'), tags: parseTagsInput(v('#wfmTags')), startDate: v('#wfmStart'), endDate: v('#wfmEnd'), description: v('#wfmDesc') };
    const shareRaw = v('#wfmShare');
    const workdayHours = parseFloat(v('#wfmWorkdayHours')) || 0;
    const weekendHours = parseFloat(v('#wfmWeekendHours')) || 0;
    let wins = readWins();
    if (wins === null) { alert('本项目可安排时段：每行都要填「开始时间 + 时长」，不用的行请删掉'); return; }
    const rawWinN = wins.length;
    wins = clipProjectWinsToGlobals(wins);
    if (rawWinN > 0 && !wins.length) {
      alert('本项目时段须落在「我的空闲时段」内——与全局无交集，请调整后再保存。');
      return;
    }
    ensureScoreMeta();
    if (isNew) {
      createWorkflow(meta);
      if (shareRaw !== '') state.meta.planShare[state.activeWorkflowId] = clamp(+shareRaw || 0, 0, 100);
      // 保存时间预算 + 每日可安排时段（多段）
      if (!state.meta.capacity) state.meta.capacity = {};
      if (workdayHours > 0 || weekendHours > 0 || wins.length) {
        state.meta.capacity[state.activeWorkflowId] = { workdayHours, weekendHours, wins };
      }
      saveMeta();
      // v8.7：选模板也进 AI 分析 —— 模板=预填表单+方向+失败兜底骨架；
      //       例外：模板自带「已安排好具体时间」的任务（含 date/start）时直接套用，无需 AI。
      const tplId = overlay.dataset.tpl || '';
      close();
      if (tplId) {
        const tpl = WF_TEMPLATES.find(t => t.id === tplId);
        if (tpl) {
          if (templateHasSchedule(tpl)) { applyWorkflowTemplate(tpl, meta); return; }
          // 无描述时用「模板名+方向+骨架」合成目标文本，AI 按模板方向分解；
          // AI 失败自动回落模板任务树（failAndRollback 的 fallbackTpl 分支），不耗第二次额度
          const goalText = meta.description
            || `${tpl.name}项目。方向参考：${tpl.desc}。模板骨架（可按需调整）：${tpl.tasks.map(t => t.text).join('；')}`;
          autoDecomposeGoal(goalText, meta, { fallbackTpl: tpl });
          return;
        }
      }
      // v7.1: 创建后自动调用 AI 分解目标
      if (meta.description) {
        autoDecomposeGoal(meta.description, meta);
      } else {
        setTimeout(async () => {
          const ok = await confirmModal({
            icon: '🎯', title: '去目标规划', okText: '去规划',
            text: '项目已创建。现在去「目标规划」手动输入目标？',
          });
          if (ok) switchView('plan');
        }, 50);
      }
      return;
    }
    const id = wfId || state.activeWorkflowId;
    updateWorkflowMeta(id, meta);
    if (shareRaw === '') delete state.meta.planShare[id];
    else state.meta.planShare[id] = clamp(+shareRaw || 0, 0, 100);
    // 保存时间预算 + 每日可安排时段（多段）
    if (!state.meta.capacity) state.meta.capacity = {};
    if (workdayHours > 0 || weekendHours > 0 || wins.length) {
      state.meta.capacity[id] = { workdayHours, weekendHours, wins };
    } else {
      delete state.meta.capacity[id];
    }
    saveMeta();
    close();
  };
  const del = overlay.querySelector('#wfmDelete');
  if (del && w) del.onclick = () => { close(); deleteWorkflow(w.id); };
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
/* ============ 项目总览（点项目名打开） ============ */
function wfExecStats(wfId) {
  let done = 0, est = 0, act = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today0()); d.setDate(d.getDate() - i);
    const log = ((state.meta && state.meta.executionLog) || {})[dateKey(d)];
    if (log) (log.entries || []).forEach(en => { if (en.wfId === wfId) { done++; est += en.est || 0; act += en.act || 0; } });
  }
  return { done, est, act };
}
function wfHabitStreaks(wf) {
  const out = [];
  const hs = (state.meta && state.meta.habitStreaks) || {};
  Object.keys(hs).forEach(k => {
    const parts = k.split('|'); if (parts[0] !== wf.id) return;
    const rec = hs[k]; if (!rec || !rec.cur) return;
    const node = (wf.nodes || []).find(n => n.id === parts[1]);
    if (node) out.push({ text: node.text, cur: rec.cur, best: rec.best || rec.cur });
  });
  return out.sort((a, b) => b.cur - a.cur);
}
function openProjectOverview(wfId) {
  if (!document.getElementById('projectModal')) return;
  ensureWorkflows();
  const w = workflowById(wfId || state.activeWorkflowId);
  if (!w) return;
  const nodes = w.nodes || [];
  computeTree(nodes);
  const root = nodes.find(n => !n.parentId) || nodes[0];
  const k = root ? wfLeafCounts(nodes, root) : { t: 0, d: 0 };
  const pct = k.t ? Math.round(k.d / k.t * 100) : 0;
  const tagChips = (w.tags || []).map(t => `<span class="wf-tagchip">${esc(t)}</span>`).join(' ');
  const range = (w.startDate || w.endDate) ? `📅 ${esc(w.startDate || '…')} → ${esc(w.endDate || '…')}` : '';
  const branches = root ? (root._children || []).map(c => {
    const ck = wfLeafCounts(nodes, c);
    const cp = ck.t ? Math.round(ck.d / ck.t * 100) : 0;
    return `<div class="po-branch"><span class="po-bname" title="${esc(c.text)}">${esc(c.text.length > 16 ? c.text.slice(0, 16) + '…' : c.text)}</span>
      <span class="po-bbar"><i style="width:${cp}%"></i></span><span class="po-bnum">${ck.d}/${ck.t}</span></div>`;
  }).join('') : '';
  const st = wfExecStats(w.id);
  const streaks = wfHabitStreaks(w);
  let todayN = 0; try { todayN = todayExecutionPoolFor(nodes).length; } catch (e) { }
  // v8.17: 真 KR（role===KR）迁入项目总览——从今日状态剥离；信心打卡仍可点
  const krs = projectKrNodes(nodes);
  const krHtml = krs.length ? krs.slice(0, 12).map(n => {
    const mp = metricProgress(n);
    const pace = paceStatus(n);
    const conf = n.conf ? `💪${n.conf}` : '💪';
    return `<div class="po-kr"><span class="po-kr-t" title="${esc(n.text)}">${esc((n.text || '').slice(0, 22))}</span>
      <span class="po-kr-m">${mp ? `${mp.done}/${mp.tgt} · ${mp.pct}%` : '—'}${pace ? ` · Δ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}` : ''}</span>
      <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost po-kr-conf" data-confkr="${n.id}" title="KR 信心打卡 1–5">${conf}</button></div>`;
  }).join('') : '';
  const html = buildModalHtml({
    wide: true,
    icon: '📁',
    title: w.name || '未命名项目',
    subHtml: `${tagChips || ''} ${range} ${w.description ? (' · ' + esc(w.description)) : ''}`,
    closeId: 'poClose',
    bodyClass: 'po-body',
    body: `
      <div class="po-row"><span>整体完成</span><div class="wf-prog po-prog"><i style="width:${pct}%"></i><span>${pct}%</span></div><span class="po-num">${k.d}/${k.t} 叶</span></div>
      <div class="po-row"><span>今日待办</span><b>${todayN}</b><span class="po-dim">项（在今日行动执行）</span></div>
      <div class="po-row"><span>近 7 天执行</span><b>${st.done}</b><span class="po-dim">项 · 预估 ${st.est}′ / 实计 ${st.act}′${st.est ? ` · 偏差 ${st.act - st.est >= 0 ? '+' : ''}${st.act - st.est}′` : ''}</span></div>
      ${streaks.length ? `<div class="po-sec">习惯连续</div>${streaks.map(s => `<div class="po-streak">🔥 ${esc(s.text)} <b>${s.cur} 天</b><span class="po-dim">最佳 ${s.best}</span></div>`).join('')}` : ''}
      ${krHtml ? `<div class="po-sec">关键结果 KR <span class="po-dim">（项目级指标 · 非今日完成）</span></div>${krHtml}` : ''}
      ${branches ? `<div class="po-sec">分支进度</div>${branches}` : '<div class="hint">还没有目标树——点「重新规划」按必经步骤自动生成。</div>'}`,
    buttons: [
      { id: 'poPlan', html: '🗺 重新规划（必经步骤向导）', primary: true },
      { id: 'poEdit', html: '✎ 项目设置', ghost: true },
      { id: 'poCancel', label: '关闭', ghost: true },
    ],
  });
  const api = openModalMask('projectModal', html, { closeId: 'poClose' });
  if (!api) return;
  const { overlay, close } = api;
  overlay.querySelector('#poCancel').onclick = close;
  overlay.querySelector('#poEdit').onclick = () => { close(); openWorkflowMetaModal('edit', w.id); };
  overlay.querySelector('#poPlan').onclick = () => { close(); openPlanWizard(w.id); };
  overlay.querySelectorAll('[data-confkr]').forEach(b => b.onclick = () => {
    const n = (w.nodes || []).find(x => x.id === b.dataset.confkr); if (!n) return;
    const v = prompt(`「${(n.text || '').slice(0, 24)}」\n当前信心 1–5（5 = 稳了，1 = 悬）：`, n.conf || '');
    if (v === null) return;
    const c = clamp(Math.round(+v) || 0, 0, 5);
    if (!c) return;
    const note = prompt('一句话：为什么是这个信心？（可选）', n.confNote || '') || '';
    n.conf = c; n.confNote = note.trim(); n.confAt = Date.now();
    save(); openProjectOverview(w.id);
  });
}
/* 项目切换器：移动端的项目列表入口（切换 / 总览 / 编辑 / 新建） */
function openProjectSwitcher() {
  if (!document.getElementById('projectsModal')) return;
  ensureWorkflows();
  flushActiveWorkflow();
  const rows = state.workflows.map(w => {
    const nodes = w.nodes || [];
    const active = w.id === state.activeWorkflowId;
    let pct = 0, leafTxt = '';
    if (nodes.length) {
      computeTree(nodes);
      const root = nodes.find(n => !n.parentId) || nodes[0];
      const k = wfLeafCounts(nodes, root);
      if (k.t) { pct = Math.round(k.d / k.t * 100); leafTxt = `${k.d}/${k.t} 叶`; }
    }
    let todayN = 0; try { todayN = todayExecutionPoolFor(nodes).length; } catch (e) { }
    return `<div class="ps-item${active ? ' active' : ''}">
      <div class="ps-main">
        <span class="wf-dot" style="background:${workflowColor(w)}"></span>
        <div class="ps-tt"><b>${esc(w.name || '未命名')}</b>${active ? '<span class="ps-badge">当前</span>' : ''}
          <div class="ps-meta">${nodes.length} 节点${leafTxt ? ` · ${pct}%（${leafTxt}）` : ''} · ☀ 今日 ${todayN}</div>
        </div>
      </div>
      <div class="ps-acts">
        ${active ? '' : `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-ps-switch="${w.id}">切换</button>`}
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ps-view="${w.id}">总览</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ps-edit="${w.id}" title="项目设置">✎</button>
      </div>
    </div>`;
  }).join('');
  const html = buildModalHtml({
    wide: true,
    icon: '🗂',
    title: '项目',
    sub: '切换当前编辑项目 · 今日行动跨项目聚合',
    closeId: 'psClose',
    bodyClass: 'ps-body',
    body: rows || '<div class="hint">还没有项目——点下方「新建项目」开始。</div>',
    buttons: [
      { id: 'psAdd', html: '＋ 新建项目', primary: true },
      { id: 'psCancel', label: '关闭', ghost: true },
    ],
  });
  const api = openModalMask('projectsModal', html, { closeId: 'psClose' });
  if (!api) return;
  const { overlay, close } = api;
  overlay.querySelector('#psCancel').onclick = close;
  overlay.querySelector('#psAdd').onclick = () => { close(); openWorkflowMetaModal('create'); };
  overlay.querySelectorAll('[data-ps-switch]').forEach(b => b.onclick = () => {
    switchWorkflow(b.dataset.psSwitch);
    close();
    const w = workflowById(b.dataset.psSwitch);
    showToast(`已切换到「${(w && w.name) || '项目'}」`);
  });
  overlay.querySelectorAll('[data-ps-view]').forEach(b => b.onclick = () => { close(); openProjectOverview(b.dataset.psView); });
  overlay.querySelectorAll('[data-ps-edit]').forEach(b => b.onclick = () => { close(); openWorkflowMetaModal('edit', b.dataset.psEdit); });
}
/* ============ 必经步骤规划向导（建目标 → 自动生成规划/清单/今日行动） ============ */
function planStepsSuggestion(root, w) {
  const steps = [];
  // 从目标文本提取数字/期限，让里程碑带上量化指标
  const goalText = root.text || '';
  const dl = parseDeadline(goalText);
  const numMatch = goalText.match(/(\d+(?:\.\d+)?)\s*(万|千|百|%|元|个|本|次|名|家|小时|天|周|月)/);
  const quant = numMatch ? numMatch[0] : '';
  const base = decomposeSuggestions(root);
  // 里程碑按依赖顺序：第1个最近，依次递进（不是均匀撒）
  base.forEach((s, i) => {
    let text = s;
    if (i === 0 && quant && !/\d/.test(s)) text = s + '（' + quant + '）';
    steps.push({ type: '里程碑', text, order: i });
  });
  steps.push({ type: '例行', text: '每周复盘进度，调整下周重点' });
  steps.push({ type: '习惯', text: '每天推进一点点（10 分钟打卡）' });
  steps.push({ type: '行动', text: '今天可完成的第一步（约 30 分钟）' });
  return steps;
}
function openPlanWizard(wfId) {
  if (!document.getElementById('planWizardModal')) return;
  if (wfId && wfId !== state.activeWorkflowId) switchWorkflow(wfId);
  ensureWorkflows();
  const w = workflowById(state.activeWorkflowId);
  const nodes = w ? (w.nodes || []) : [];
  computeTree(nodes);
  const root = nodes.find(n => !n.parentId) || nodes[0];
  if (!root) { alert('请先在「目标规划」里解析目标文本，生成目标树后再规划。'); return; }
  const steps = planStepsSuggestion(root, w);
  const lines = steps.map(s => `【${s.type}】${s.text}`).join('\n');
  const tgt = (w && w.endDate) || '';
  const html = buildModalHtml({
    icon: '🗺',
    title: '必经步骤向导 · ' + (w ? w.name : ''),
    sub: '按「里程碑 → 例行 → 习惯 → 今日行动」自动生成规划；每行一条，可删改，前缀决定类型',
    closeId: 'pwClose',
    body: `
      <label class="wfm-row"><span>总目标</span><input id="pwGoal" class="gf-input" value="${esc(root.text)}"></label>
      <label class="wfm-row"><span>目标达成日期（里程碑将均匀排期）</span><input id="pwDate" type="date" class="gf-input" value="${esc(tgt)}"></label>
      <label class="wfm-row"><span>必经步骤（【里程碑】【例行】【习惯】【行动】+ 内容）</span><textarea id="pwSteps" class="gf-input" rows="8">${esc(lines)}</textarea></label>
      <div class="hint">生成后：里程碑→按月排期进规划；例行→每周节奏；习惯→今日打卡；行动→今日行动清单。</div>`,
    buttons: [
      { id: 'pwGen', html: '✨ 生成规划', primary: true },
      { id: 'pwCancel', label: '取消', ghost: true },
    ],
  });
  const api = openModalMask('planWizardModal', html, { closeId: 'pwClose' });
  if (!api) return;
  const overlay = api.overlay;
  const close = api.close;
  overlay.querySelector('#pwCancel').onclick = close;
  overlay.querySelector('#pwGen').onclick = () => {
    const goalTxt = overlay.querySelector('#pwGoal').value.trim();
    if (goalTxt && goalTxt !== root.text) { root.text = goalTxt; applySuggestions(root, goalTxt); }
    const dateStr = overlay.querySelector('#pwDate').value;
    const raw = overlay.querySelector('#pwSteps').value.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const items = raw.map((line, idx) => {
      const m = line.match(/^【(里程碑|例行|习惯|行动)】\s*(.+)$/);
      const it = m ? { type: m[1], text: m[2].trim() } : { type: '行动', text: line };
      it.order = idx;
      return it;
    }).filter(x => x.text);
    if (!items.length) { close(); return; }
    // 重新规划 = 先清掉上次向导生成的节点，再追加（否则越滚越多）
    const removed = removeWizardNodes(root);
    generatePlanFromSteps(w, root, items, dateStr);
    close();
    save(); afterChange();
    const over = warnIfOverCapacity(`「${(w && w.name) || '项目'}」规划`);
    if (!over) alert(`已生成 ${items.length} 条规划步骤${removed ? `（清掉上次 ${removed} 条）` : ''}：里程碑进规划、习惯进今日打卡、行动进今日清单。`);
  };
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
/* 清掉某分支下由向导生成的节点（重新规划时调用，避免越滚越多） */
function removeWizardNodes(root) {
  if (!root) return 0;
  const before = state.nodes.length;
  const doomed = new Set();
  (function walk(n) {
    if (n.source === 'wizard') { doomed.add(n.id); }
    (n._children || []).forEach(walk);
  })(root);
  // 向导节点的整棵子树都清掉
  const keep = state.nodes.filter(n => {
    if (doomed.has(n.id)) return false;
    let p = n.parentId ? byId(n.parentId) : null;
    while (p) { if (doomed.has(p.id)) return false; p = p.parentId ? byId(p.parentId) : null; }
    return true;
  });
  // v8.9: 向导重生成删子树不走 deleteNode → 级联清引用（大石头/预选/打卡可能指向被再生节点）
  purgeNodeRefs(state.activeWorkflowId, doomed);
  state.nodes = keep;
  saveMeta();
  return before - keep.length;
}
function generatePlanFromSteps(w, root, items, dateStr) {
  let maxId = state.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);
  const today = today0();
  let end = dateStr ? new Date(dateStr + 'T23:59:59') : null;
  if (!end || isNaN(+end) || end <= today) { end = new Date(today); end.setDate(end.getDate() + 90); }
  const spanDays = Math.max(7, Math.round((end - today) / 86400000));
  const milestones = items.filter(x => x.type === '里程碑');
  const newNodes = items.map(x => {
    const node = newNode({ id: 'n' + (++maxId), text: x.text, im: Math.min(5, root.im || 4), ur: 2, parentId: root.id, source: 'wizard' });
    if (x.type === '里程碑') {
      node.scale = 'month'; node.ur = 3;
      // 按依赖顺序排：第 1 个里程碑最近，依次递进（前置先到期）
      const idx = typeof x.order === 'number' ? x.order : milestones.indexOf(x);
      const frac = (idx + 1) / (milestones.length + 1);
      const dd = new Date(today); dd.setDate(dd.getDate() + Math.round(spanDays * frac));
      setNodeDeadline(node, dateKey(dd));
    } else if (x.type === '例行') {
      node.scale = 'week'; node.recur = true; node.ur = 3;
    } else if (x.type === '习惯') {
      node.scale = 'day'; node.role = 'habit'; node.slot = 'h1'; node.estimateMinutes = 10; node.ur = 2;
    } else {
      node.scale = 'day'; node.estimateMinutes = 30; node.ur = 4;
    }
    return node;
  });
  state.nodes.push(...newNodes);
  recomputeSchedule(state.nodes);
  flushActiveWorkflow();
}
function nodeInWorkflow(wfId, nodeId) {
  const w = workflowById(wfId);
  if (!w || !w.nodes) return null;
  return w.nodes.find(n => n.id === nodeId) || null;
}
function setNodeDoneInWorkflow(wfId, nodeId, checked) {
  const w = workflowById(wfId);
  if (!w) return;
  const n = w.nodes && w.nodes.find(x => x.id === nodeId);
  if (!n) return;
  // state.nodes 已是当前流引用；跨流勾选时临时切过去再切回
  const bakWf = state.activeWorkflowId;
  if (wfId !== state.activeWorkflowId) switchWorkflow(wfId);
  setNodeDone(n, checked);
  if (wfId !== bakWf) switchWorkflow(bakWf);
  save();
}
function todayRemindValue(n) {
  if (!n || !n.remindAt) return '';
  const d = new Date(+n.remindAt);
  if (dateKey(d) !== dateKey()) return '';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function setNodeRemind(wfId, nodeId, timeStr) {
  const n = nodeInWorkflow(wfId, nodeId);
  if (!n) return;
  if (!timeStr) { n.remindAt = null; n._remindOff = dateKey(); n._remindManual = false; save(); return; }  // v8.2: 手动清空当天不再自动回填
  const p = String(timeStr).split(':');
  const hh = +p[0] || 0, mm = +p[1] || 0;
  const d = today0();
  d.setHours(clamp(hh, 0, 23), clamp(mm, 0, 59), 0, 0);
  n.remindAt = d.getTime();
  n._remindOff = '';
  n._remindManual = true;  // v8.18: 用户手改提醒 → 改开始时间时不再被自动覆盖
  save();
}
/* v8.18: 由「计划开始时间」推导默认提醒时间戳（开始前 5 分钟；早于 00:05 则落在当天 00:00）。
   纯函数：day0 = 当天 0 点 Date；无 time / 非法 → null。供 ensureRemindDefaults 与单测共用。 */
function remindAtFromTime(timeStr, day0) {
  if (!timeStr) return null;
  // 只认 HH:MM / H:MM；非法串不落默认提醒（hmToMin('xx') 会静默变 0）
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hm = (+m[1]) * 60 + (+m[2]);
  if (!Number.isFinite(hm) || hm < 0 || hm >= 24 * 60) return null;
  const mins = Math.max(0, hm - 5);
  const d = new Date(day0 instanceof Date ? day0.getTime() : +day0);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}
/* v8.2 / v8.18: 有「计划时间」就一定有「开始前 5 分钟」提醒（MIT 与清单同口径）。
   - 缺 remindAt → 补 time−5
   - 有 remindAt 且非手动（!_remindManual）→ 随 time 同步（改开始时间提醒跟着走）
   - 手动改过提醒（_remindManual）或当天清空（_remindOff）→ 尊重用户，不覆盖 */
function ensureRemindDefaults(nodes) {
  const dk = dateKey();
  const day0 = today0();
  let dirty = false;
  (nodes || []).forEach(n => {
    if (!n) return;
    if (n._remindOff && n._remindOff !== dk) { n._remindOff = ''; dirty = true; }  // 换天重置
    if (n.done || !n.time || n._remindOff) return;
    const expect = remindAtFromTime(n.time, day0);
    if (expect == null) return;
    if (!n.remindAt) {
      n.remindAt = expect; n._remindManual = false; dirty = true; return;
    }
    if (!n._remindManual && n.remindAt !== expect) {
      n.remindAt = expect; dirty = true;
    }
  });
  if (dirty) save();
}
/* v8.11: 时间冲突纠偏 —— AI 可能给多个叶子相同的 start（两个 9:00），手动改时间也会撞。
   网页层兜底：按 time 升序扫描，当前块与前一块占用区间 [s, s+dur+GAP) 重叠则顺延到占用尾，
   链式传导（09:00/09:00/09:00 各30′ → 09:00/09:40/10:20）。直接改入参 node.time，
   调用方决定 save。返回 {changed, moves:[{id,from,to}]}。 */
function resolveTimeConflicts(nodes, opts) {
  opts = opts || {};
  const GAP = opts.gapMinutes != null ? opts.gapMinutes : 10;
  const list = (nodes || []).map(x => (x && x.node) || x).filter(n => n && !n.done && n.time);
  list.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const moves = [];
  let occEnd = -1; // 前一块占用尾（分钟，含间隔）
  list.forEach(n => {
    const s = hmToMin(n.time);
    const dur = Math.max(+(n.estimateMinutes) || 30, 5);
    if (occEnd >= 0 && s < occEnd) {
      if (occEnd + dur > 24 * 60) { occEnd = Math.max(occEnd, s + dur + GAP); return; }  // 顺延出日界：保持原样（比逆序强）
      const ns = occEnd;
      moves.push({ id: n.id, from: n.time, to: minToHm(ns) });
      n.time = minToHm(ns);
      occEnd = ns + dur + GAP;
    } else {
      occEnd = s + dur + GAP;
    }
  });
  return { changed: moves.length, moves };
}
/* v8.11: 渲染前 ensure 式纠偏（像 ensureRemindDefaults）——只在真改了时间时 save。
   须在 ensureRemindDefaults 之前跑（提醒时间以纠偏后的 time 为准）。 */
function ensureTodayTimeResolved(pool) {
  const r = resolveTimeConflicts((pool || []).map(x => x.node));
  if (r.changed) save();
  return r;
}
function requestAlarmPermission() {
  // v6.2 移动端/微信内：无桌面通知 API，静默降级（页面内弹窗式闹钟不依赖它）
  if (typeof Notification === 'undefined') { return Promise.resolve(false); }
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') { alert('通知已被拒绝，请在浏览器站点设置中允许通知'); return Promise.resolve(false); }
  return Notification.requestPermission().then(p => p === 'granted');
}
/* v8.8: 系统通知镜像 —— 重要页内弹窗（AI 结果/失败、删除项目等）同步发一条 OS 通知，
   页面在后台/最小化也能看到。仅 granted 时发；default 由弹窗内 opt-in 按钮授权
   （Chrome 要求 requestPermission 必须来自用户手势，不能弹窗打开时自动请求）。
   tag 固定 'gf-sys'：新通知替换旧的，避免通知栏堆叠。 */
function sysNotify(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    new Notification(String(title || 'GoalFlow'), { body: String(body || '').replace(/<[^>]+>/g, '').slice(0, 120), tag: 'gf-sys' });
    return true;
  } catch (e) { return false; }
}
/* 弹窗底部的「🔔 开启系统通知」opt-in 按钮（permission=default 时才出现）；授权成功立刻补发本条 */
function sysNotifyOptIn(footEl, title, body) {
  if (!footEl || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'gf-btn gf-btn--sm gf-btn--ghost sys-notify-optin';
  b.textContent = '🔔 开启系统通知';
  b.title = '授权后重要弹窗会同步发系统通知——页面在后台/最小化也能看到';
  b.onclick = () => {
    requestAlarmPermission().then(ok => {
      if (ok) { sysNotify(title, body); b.remove(); showToast('🔔 系统通知已开启，重要弹窗会同步推送'); }
    });
  };
  footEl.appendChild(b);
}
function tickReminders() {
  // v7.7: 「到点提醒」关掉后，任务到点的系统通知也不再发（页面内状态照常显示，只是不打扰）
  if (!remindersOn()) return;
  ensureWorkflows();
  flushActiveWorkflow();
  const now = Date.now();
  const dk = dateKey();
  if (!state.meta) state.meta = {};
  if (!state.meta.alarmFired) state.meta.alarmFired = {};
  let dirty = false;
  state.workflows.forEach(wf => {
    (wf.nodes || []).forEach(n => {
      if (!n.remindAt || n.done) return;
      const ra = +n.remindAt;
      if (ra > now || now - ra > 120000) return;
      const key = dk + '|' + wf.id + '|' + n.id;
      if (state.meta.alarmFired[key]) return;
      state.meta.alarmFired[key] = true;
      dirty = true;
      // v8.3 修复：到点提醒走 showTodayAlarm 三通道 —— 已授权→系统通知+toast+页头横幅；
      // 未授权/不支持（Chrome 从未点过允许）时仍有 toast+横幅兜底，不再完全静默
      const msg = '⏰ ' + n.text + ' — ' + (wf.name ? '[' + wf.name + '] ' : '') + (n.estimateMinutes ? ('约 ' + n.estimateMinutes + ' 分钟') : '该行动了');
      showTodayAlarm(msg, 'info');
    });
  });
  if (dirty) saveMeta();
}

/* v7.9: planDate 到期（今天）→ 转为今日 time，进入按时间排序。
   v8.10 抽成独立函数：load 时 normalizeNode 调，跨午夜 refreshTodayIfNeeded 也要对全流补一遍——
   否则页面挂着过夜，排到今天的任务一直躺在未来排期里不出现。 */
function convertDuePlanDate(n) {
  if (!n || !n.planDate || n.done) return false;
  const pd = String(n.planDate);
  const dk = pd.slice(0, 10);
  if (dk > dateKey()) return false;
  if (!n.time && pd.length >= 16) n.time = pd.slice(11, 16);
  n.planDate = '';
  if (n.time) n.timeDk = dateKey();  // v8.23: 今日时钟盖章，跨日 scrub 不误清
  return true;
}
/* v8.23: 盖章「这个 time 属于哪一天」—— time 本身无日期，跨日后必须靠 timeDk 判定陈旧。 */
function stampNodeTimeDk(n, dk) {
  if (!n) return;
  dk = dk || dateKey();
  if (n.time) n.timeDk = dk;
  else n.timeDk = '';
}
/* v8.23: 清掉不属于「今天」的计划时间。
   根因：未完成任务的 n.time（如昨天 14:00）隔夜仍在，今日清单按时间排序时就像「上一天内容乱序」。
   习惯/循环的 time 是日程模板，保留并盖章今天；普通任务 timeDk≠今天（或旧数据无 timeDk）则清空。 */
function scrubStaleTodayTimes(nodes, dk) {
  dk = dk || dateKey();
  let dirty = false;
  (nodes || []).forEach(n => {
    if (!n || n.done || !n.time) return;
    if (n.recur || n.role === 'habit' || (typeof isRecurringTask === 'function' && isRecurringTask(n))) {
      if (n.timeDk !== dk) { n.timeDk = dk; dirty = true; }
      return;
    }
    if (n.timeDk === dk) return;
    n.time = '';
    n.timeDk = '';
    if (n.remindAt && !n._remindManual) n.remindAt = null;
    dirty = true;
  });
  return dirty;
}
/* v8.23: 今日执行排序（MIT 之外）——用户置顶 → 有 time 升序 → 未设时间 → 逾期补做 → 溢出沉底 */
function sortTodayExecEntries(entries, opts) {
  opts = opts || {};
  const pins = opts.pins || [];
  const pinIdx = k => { const i = pins.indexOf(k); return i >= 0 ? i : 9999; };
  const keyOf = ent => String(ent.wfId || '') + '|' + String((ent.node && ent.node.id) || '');
  const slotRank = s => { const m = /^h(\d)$/.exec(s || ''); return m ? +m[1] : 99; };
  const isOd = n => !!(n && (n.overdue || (n.daysLeft != null && n.daysLeft < 0)));
  const overflowed = (entries || []).filter(e => e && e.node && e.node._overflow);
  const inPool = (entries || []).filter(e => e && e.node && !e.node._overflow);
  const pinned = inPool.filter(e => pinIdx(keyOf(e)) < 9999).sort((a, b) => pinIdx(keyOf(a)) - pinIdx(keyOf(b)));
  const rest = inPool.filter(e => pinIdx(keyOf(e)) >= 9999);
  const timed = rest.filter(e => e.node.time).sort((a, b) => String(a.node.time).localeCompare(String(b.node.time)));
  const untimed = rest.filter(e => !e.node.time);
  const plain = untimed.filter(e => !isOd(e.node))
    .sort((a, b) => slotRank(a.node.slot) - slotRank(b.node.slot) || focusScore(b.node) - focusScore(a.node));
  const overdue = untimed.filter(e => isOd(e.node))
    .sort((a, b) => focusScore(b.node) - focusScore(a.node));
  return pinned.concat(timed).concat(plain).concat(overdue).concat(overflowed);
}
function todayListPinKey(wfId, nodeId) { return String(wfId || '') + '|' + String(nodeId || ''); }
function todayListPinsFor(dk) {
  ensureScoreMeta();
  dk = dk || dateKey();
  if (!Array.isArray(state.meta.todayListPins[dk])) state.meta.todayListPins[dk] = [];
  return state.meta.todayListPins[dk];
}
function isTodayListPinned(wfId, nodeId) {
  return todayListPinsFor().indexOf(todayListPinKey(wfId, nodeId)) >= 0;
}
function toggleTodayListPin(wfId, nodeId) {
  const pins = todayListPinsFor();
  const k = todayListPinKey(wfId, nodeId);
  const i = pins.indexOf(k);
  if (i >= 0) pins.splice(i, 1);
  else pins.unshift(k);  // 新置顶排在置顶组最前
  // 只留近 14 天的 pin 桶，避免 meta 膨胀
  try {
    const keys = Object.keys(state.meta.todayListPins || {}).sort();
    while (keys.length > 14) {
      const old = keys.shift();
      delete state.meta.todayListPins[old];
    }
  } catch (e) { }
  saveMeta();
  afterChange();
}
/* v8.23: 换日 / 启动时统一：到期 planDate→time，再 scrub 陈旧 time，更新 lastTodayDk。
   首次升级（lastTodayDk 空）：不误清无 timeDk 的现有 time，先盖章为今天。 */
function rolloverTodayState() {
  ensureScoreMeta();
  const dk = dateKey();
  const firstBoot = !state.meta.lastTodayDk;
  let dirty = false;
  const touch = nodes => {
    (nodes || []).forEach(n => { if (convertDuePlanDate(n)) dirty = true; });
    if (firstBoot) {
      (nodes || []).forEach(n => {
        if (n && n.time && !n.timeDk) { n.timeDk = dk; dirty = true; }
      });
    } else if (scrubStaleTodayTimes(nodes || [], dk)) dirty = true;
  };
  (state.workflows || []).forEach(w => touch(w.nodes || []));
  if (state.nodes && state.nodes.length && !(state.workflows || []).some(w => w.nodes === state.nodes)) {
    touch(state.nodes);
  }
  if (state.meta.lastTodayDk !== dk) {
    state.meta.lastTodayDk = dk;
    saveMeta();
  }
  if (dirty) save();
  return dirty;
}
/* v8.10: 跨午夜自愈 —— TODAY 此前只在启动时赋值，页面挂着过夜后「今日」面板/清单/MIT/日期全停在昨天，
   勾选完成还会记进昨天的日志。30s 轮询与唤醒补跑时检查，换天即刷新 TODAY、把到期 planDate 转 time 并重渲染。
   v8.23: 同时 scrub 陈旧 time（昨日排程不再冒充今日）。 */
function refreshTodayIfNeeded() {
  const now = new Date();
  const sameClock = dateKey(now) === dateKey();
  ensureScoreMeta();
  if (sameClock && state.meta.lastTodayDk === dateKey()) return false;
  TODAY = now;
  rolloverTodayState();
  afterChange();
  return true;
}
function normalizeNode(n) {
  if (n.slot == null) n.slot = '';
  if (n.time == null) n.time = '';
  if (n.timeDk == null) n.timeDk = '';  // v8.23: time 所属日期；跨日 scrub 依据
  if (n.planDate == null) n.planDate = '';  // v7.9: 未来排期日（'YYYY-MM-DDTHH:MM'），到当天自动转 time
  convertDuePlanDate(n);
  if (!Array.isArray(n.tags)) n.tags = typeof n.tags === 'string' ? n.tags.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
  if (typeof n.lastRecDone !== 'string') n.lastRecDone = '';
  // v7.7: 历史脏数据修复 —— 旧版曾把 parseDeadline() 的返回对象整体塞进 deadlineDate
  if (n.deadlineDate && typeof n.deadlineDate === 'object' && !(n.deadlineDate instanceof Date)) {
    const legacy = n.deadlineDate;
    if (legacy.label && !n.deadline) n.deadline = legacy.label;
    n.deadlineDate = legacy.date || null;
  }
  if (n.deadlineDate && typeof n.deadlineDate === 'string') n.deadlineDate = new Date(n.deadlineDate);
  if (!(n.deadlineDate instanceof Date) || isNaN(n.deadlineDate)) n.deadlineDate = null;
  if (n.deadlineAnchor == null) n.deadlineAnchor = null;
  if (n.deadlineText == null) n.deadlineText = n.deadline || '';
  if (n.doneAt != null && typeof n.doneAt === 'string') n.doneAt = +new Date(n.doneAt);
  if (n.recur == null) n.recur = inferRecur(n.text, n.scale);
  if (n.touchedAt != null && typeof n.touchedAt === 'string') n.touchedAt = +new Date(n.touchedAt);
  if (n.remindAt != null && typeof n.remindAt === 'string') n.remindAt = +new Date(n.remindAt);
  if (n._remindOff == null) n._remindOff = '';
  if (n._remindManual == null) n._remindManual = false;
  if (n.ifThen == null) n.ifThen = '';
  if (n.premortem == null) n.premortem = '';
  if (n.createdAt == null) n.createdAt = null;
  if (n.status == null) n.status = '';
  if (n.waitNote == null) n.waitNote = '';
  if (typeof n.followUp !== 'string') n.followUp = '';
  if (n.followUpAt == null) n.followUpAt = null;
  if (n.timesPerWeek == null) n.timesPerWeek = parseTimesPerWeek(n.text);
  if (n.conf == null) n.conf = 0;
  if (n.confNote == null) n.confNote = '';
  if (n.confAt != null && typeof n.confAt === 'string') n.confAt = +new Date(n.confAt);
  if (n.confAt == null) n.confAt = null;
  ensureVE(n);
  ensureMetrics(n);
  return n;
}
function serializeNodes(nodes) {
  return nodes.map(n => ({
    id: n.id, text: n.text, im: n.im, ur: n.ur, val: n.val, eff: n.eff, role: n.role || '', targetNum: n.targetNum ?? null, targetDone: n.targetDone || 0,
    deadline: n.deadline || '',
    deadlineDate: n.deadlineDate ? n.deadlineDate.getTime() : null,
    // daysLeft / overdue 是 recomputeSchedule 每次载入都会重算的纯派生值，不再占用存储
    done: !!n.done, doneAt: n.doneAt || null,
    touchedAt: n.touchedAt || null, estimateMinutes: n.estimateMinutes ?? null, actualMinutes: n.actualMinutes ?? null,
    remindAt: n.remindAt ?? null,
    ifThen: n.ifThen || '', premortem: n.premortem || '', createdAt: n.createdAt || null,
    anchor: n.anchor || '',
    status: n.status || '', waitNote: n.waitNote || '', followUp: n.followUp || '', followUpAt: n.followUpAt || null, timesPerWeek: n.timesPerWeek || 0, recurrence: n.recurrence || null,
    conf: n.conf || 0, confNote: n.confNote || '', confAt: n.confAt || null,
    recur: !!n.recur, scale: n.scale || null,
    parentId: n.parentId, slot: n.slot || '', time: n.time || '', timeDk: n.timeDk || '', planDate: n.planDate || '', tags: Array.isArray(n.tags) ? n.tags : [], lastRecDone: n.lastRecDone || '',
    _remindOff: n._remindOff || '',
    _remindManual: !!n._remindManual
  }));
}
function monthRange(offset) {
  const t = today0();
  const start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  const end = new Date(t.getFullYear(), t.getMonth() + offset + 1, 1);
  return { start, end };
}
function backlogLanes() {
  const { start } = weekRange();
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
  const nextMo = monthRange(1);
  getCachedTree(state.nodes);
  const leaves = state.nodes.filter(n => n.parentId && n._children.length === 0 && !n.done);
  const vis = state.nodes.length ? buildView(state.nodes, state.scale) : [];
  const topIds = new Set(pickRanked(vis, 3).map(n => n.id));
  const lastWeek = leaves.filter(n => {
    if (topIds.has(n.id)) return false;
    if (n.deadlineDate) {
      const ms = n.deadlineDate.getTime();
      if (ms >= prevStart.getTime() && ms < start.getTime()) return true;
      if (ms < start.getTime() && (n.overdue || n.daysLeft < 0)) return true;
    }
    return n.overdue && n.daysLeft != null && n.daysLeft <= -3;
  }).sort((a, b) => focusScore(b) - focusScore(a)).slice(0, 12);
  const nextMonth = leaves.filter(n => {
    if (topIds.has(n.id)) return false;
    if (n.deadlineDate) {
      const ms = n.deadlineDate.getTime();
      return ms >= nextMo.start.getTime() && ms < nextMo.end.getTime();
    }
    return n.scale === 'month' && !n.deadlineDate;
  }).sort((a, b) => (a.daysLeft == null ? 999 : a.daysLeft) - (b.daysLeft == null ? 999 : b.daysLeft)).slice(0, 12);
  return { lastWeek, nextMonth };
}
function dayPlanFeasibility() {
  getCachedTree(state.nodes);
  const leaves = state.nodes.filter(n => n.parentId && !n.done && n._children.length === 0);
  const dayLeaves = leaves.filter(n => n.scale === 'day' || (n.deadlineDate && n.daysLeft != null && n.daysLeft <= 1));
  let est = 0, act = 0;
  dayLeaves.forEach(n => { ensureEstimate(n); est += (n.estimateMinutes || 0); act += (n.actualMinutes || 0); });
  return { est, act, count: dayLeaves.length, over: est > dayCap(), cap: dayCap() };
}
function nodesToIndentedText() {
  if (!state.nodes.length) return '';
  getCachedTree(state.nodes);
  return treeOrder(state.nodes).map(n => {
    if (n.depth === 0) return n.text;
    return '  '.repeat(n.depth) + '- ' + n.text;
  }).join('\n');
}

const VIZ_HTML = new Set(['kanban', 'heatmap', 'mindmap', 'calendar']);
function renderCanvas() {
  const svg = document.getElementById('diagram-svg');
  const alt = document.getElementById('vizAlt');
  if (!state.nodes.length) {
    const emptyOpts = {
      icon: '🌊', title: '还没有可展示的目标树', hint: '在「目标规划」粘贴计划或新建项目后，这里会出现精力流向图',
      btnLabel: '去规划', btnOnclick: "switchView('plan')"
    };
    if (VIZ_HTML.has(state.viewMode) && alt) {
      if (svg) svg.style.display = 'none';
      alt.style.display = 'block';
      alt.innerHTML = emptyStateHtml(emptyOpts);
    } else showCanvasEmpty(emptyOpts);
    return;
  }
  if (svg) svg.style.display = VIZ_HTML.has(state.viewMode) ? 'none' : '';
  if (alt) {
    alt.style.display = VIZ_HTML.has(state.viewMode) ? 'block' : 'none';
    if (VIZ_HTML.has(state.viewMode)) {
      if (state.viewMode === 'kanban') renderKanban(alt);
      else if (state.viewMode === 'heatmap') renderHeatmap365(alt);
      else if (state.viewMode === 'calendar') renderCalendar(alt);
      else renderMindMap(alt);
      return;
    }
  }
  if (state.viewMode === 'network') renderNetwork();
  else render();
}
function renderKanban(box) {
  getCachedTree(state.nodes);
  const nodes = quadNodes();
  const buckets = { now: [], core: [], distract: [], noise: [] };
  nodes.forEach(n => { (buckets[category(n.im, n.ur).key] || buckets.noise).push(n); });
  let html = '<div class="kanban">';
  QUAD_ORDER.forEach(q => {
    html += `<div class="kb-col" data-q="${q}"><div class="kb-h">${QUAD[q].icon} ${QUAD[q].label.split('·')[0]}</div><div class="kb-cards">`;
    const list = buckets[q].slice(0, 24);
    list.forEach(n => {
      const mp = metricProgress(n);
      const pace = paceStatus(n);
      html += `<div class="kb-card" data-id="${n.id}"><b>${esc(n.text.length > 36 ? n.text.slice(0, 36) + '…' : n.text)}</b>`;
      if (mp) html += `<span class="kb-m">${mp.done}/${mp.tgt} · ${mp.pct}%</span>`;
      if (pace) html += `<span class="kb-m pace">节奏 ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}</span>`;
      html += `</div>`;
    });
    if (!list.length) html += '<div class="kb-empty">—</div>';
    html += `</div></div>`;
  });
  html += '</div>';
  box.innerHTML = html;
  box.querySelectorAll('.kb-card').forEach(c => {
    const id = c.dataset.id;
    c.onclick = () => { if (!VIZ_HTML.has(state.viewMode)) return; highlightQuad(id, true); };
  });
}
function completionByDay() {
  const map = {};
  if (state.meta && state.meta.dailyCompletions) Object.assign(map, state.meta.dailyCompletions);
  getCachedTree(state.nodes);
  state.nodes.forEach(n => {
    if (!n.doneAt) return;
    const dk = dateKey(new Date(n.doneAt));
    map[dk] = (map[dk] || 0) + 1;
  });
  return map;
}
function renderHeatmap365(box) {
  const map = completionByDay();
  const t = today0();
  const cells = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(t); d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const c = map[k] || 0;
    const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4;
    cells.push(`<i class="hm c${lvl}" title="${k} · ${c} 叶子完成"></i>`);
  }
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  box.innerHTML = `<div class="heatmap365"><div class="hm-head"><b>365 天叶子完成热力</b><span>${total} 次 · 越深越多</span></div><div class="hm-grid">${cells.join('')}</div></div>`;
}
function completionStreaks() {
  const map = completionByDay();
  const t = today0();
  let d = new Date(t);
  if (!(map[dateKey(d)] > 0)) d = addDays(d, -1);
  let cur = 0;
  while (map[dateKey(d)] > 0) { cur++; d = addDays(d, -1); }
  const keys = Object.keys(map).filter(k => map[k] > 0).sort();
  let longest = 0, run = 0, prev = null;
  keys.forEach(k => {
    const dd = new Date(k + 'T00:00:00');
    run = (prev && Math.round((dd - prev) / 86400000) === 1) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = dd;
  });
  let last7 = 0;
  for (let i = 0; i < 7; i++) last7 += map[dateKey(addDays(t, -i))] || 0;
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return { cur, longest, last7, total };
}
function renderCompletionHistory() {
  const stats = document.getElementById('histStats');
  const heat = document.getElementById('histHeat');
  const tl = document.getElementById('histTimeline');
  if (!stats && !heat && !tl) return;
  const s = completionStreaks();
  if (stats) stats.innerHTML = `<div class="hs-cell"><b>${s.total}</b><span>累计完成</span></div><div class="hs-cell"><b>${s.cur}</b><span>当前连续·天</span></div><div class="hs-cell"><b>${s.longest}</b><span>最长连续·天</span></div><div class="hs-cell"><b>${s.last7}</b><span>近7天完成</span></div>`;
  if (heat) {
    const map = completionByDay(); const t = today0(); const cells = [];
    for (let i = 89; i >= 0; i--) {
      const k = dateKey(addDays(t, -i)); const c = map[k] || 0;
      const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4;
      cells.push(`<i class="hh-cell hh-c${lvl}" title="${k} · ${c} 项完成"></i>`);
    }
    heat.innerHTML = `<div class="hh-grid">${cells.join('')}</div><div class="hh-lbl">近 90 天完成热力 · 越深越多</div>`;
  }
  if (tl) {
    const log = (state.meta && state.meta.executionLog) || {};
    const days = Object.keys(log).sort().reverse().slice(0, 14);
    const html = days.map(dk => {
      const entries = ((log[dk] || {}).entries || []).slice().sort((a, b) => b.t - a.t);
      if (!entries.length) return '';
      const rows = entries.slice(0, 12).map(e => {
        const tm = new Date(e.t); const hh = pad2(tm.getHours()) + ':' + pad2(tm.getMinutes());
        return `<li class="ht-row"><span class="ht-time">${hh}</span><span class="ht-txt">${e.habit ? '🔁 ' : ''}${esc(e.text || '')}</span>${e.wfName ? `<span class="ht-wf">${esc(e.wfName)}</span>` : ''}</li>`;
      }).join('');
      const lbl = dk === dateKey() ? '今天' : dk === dateKey(addDays(today0(), -1)) ? '昨天' : dk.slice(5);
      return `<div class="ht-day"><div class="ht-day-h">${lbl} · ${entries.length} 项</div><ul class="ht-list">${rows}</ul></div>`;
    }).join('');
    tl.innerHTML = html || emptyStateHtml({
      title: '还没有完成记录', hint: '在今日清单勾选任务后，这里会出现时间线与近 90 天热力',
      btnLabel: '去今日', btnOnclick: "switchView('today')"
    });
  }
}
/* ============ 日历视角（月 / 周 / 年网格 + 加权热力 + 每日详情联动跳转） ============ */
// 热力 = 加权合成：完成量 40% + 投入时长 30% + 习惯打卡 15% + 主观能量 15%
// 每个子信号各自归一化到 0~1（分母 = 满分线），当天没有记录的信号不计入分母（不因未自评而扣分）
const HEAT_SIGNALS = [
  { key: 'cnt', label: '完成量', w: 0.40, cap: 6, unit: '项', full: '6 项' },
  { key: 'min', label: '投入时长', w: 0.30, cap: 0, unit: '分', full: '' },   // cap 运行时取 dayCap()
  { key: 'hb', label: '习惯打卡', w: 0.15, cap: 3, unit: '次', full: '3 次' },
  { key: 'eng', label: '主观能量', w: 0.15, cap: 5, unit: '/5', full: '5 分' },
];
const CAL_WD = ['一', '二', '三', '四', '五', '六', '日'];
const mondayIdx = d => (d.getDay() + 6) % 7;
const slotLabelOf = s => (DAY_SLOTS.find(x => x[0] === s) || ['', ''])[1];
const heatFromScore = sc => sc <= 0 ? 0 : sc < 0.25 ? 1 : sc < 0.5 ? 2 : sc < 0.75 ? 3 : 4;
let calMonth = null;    // 日历游标（月首日）；null = 跟随今天
let calSelDk = '';      // 选中日 key
let calWeekOff = 0;     // 周视图相对本周的偏移
function ensureCalCursor() {
  if (!calMonth) calMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  if (!calSelDk) calSelDk = dateKey();
}
function syncZoombar() {
  document.querySelectorAll('#zoombar button').forEach(b => b.classList.toggle('on', b.dataset.scale === state.scale));
}
function dkOfDate(d) { return dateKey(d instanceof Date ? d : new Date(d)); }
/* 某一天的全部可用信号（历史天同样可回放） */
let _calCache = null;     // 单次渲染内的热力缓存（年视角要遍历 365 天，避免重复扫全量 meta）
let _calNodeIdx = null;
function resetCalCache() { _calCache = Object.create(null); _calNodeIdx = null; }
function calNodeById(wfId, nodeId) {
  if (!_calNodeIdx) {
    _calNodeIdx = Object.create(null);
    (state.workflows || []).forEach(w => (w.nodes || []).forEach(n => { _calNodeIdx[(w.id || '') + '|' + n.id] = n; }));
  }
  return _calNodeIdx[(wfId || '') + '|' + nodeId] || byId(nodeId);
}
function daySignals(dk) {
  ensureScoreMeta();
  const log = (state.meta.executionLog || {})[dk];
  const entries = (log && Array.isArray(log.entries)) ? log.entries.slice() : [];
  const cnt = entries.length || (+((state.meta.dailyCompletions || {})[dk]) || 0);
  let min = 0;
  entries.forEach(e => { min += (+e.act || +e.est || 0); });
  const habits = [];
  Object.keys(state.meta.habitStreaks || {}).forEach(key => {
    const rec = state.meta.habitStreaks[key] || {};
    if (!rec.log || !rec.log[dk]) return;
    const i = String(key).indexOf('|');
    const wfId = i > 0 ? key.slice(0, i) : '';
    const nodeId = i > 0 ? key.slice(i + 1) : key;
    const n = calNodeById(wfId, nodeId);
    habits.push({ wfId, nodeId, text: n ? n.text : '（该习惯节点已删除）', act: +rec.log[dk].act || 0, cur: +rec.cur || 0, best: +rec.best || 0 });
  });
  if (!min) habits.forEach(h => { min += h.act || 0; });
  const en = (state.meta.energyLog || {})[dk] || {};
  const engVals = ['am', 'pm', 'eve'].map(k => +en[k] || 0).filter(v => v > 0);
  const eng = engVals.length ? +(engVals.reduce((a, b) => a + b, 0) / engVals.length).toFixed(1) : 0;
  const scoreEntries = ((state.meta.scoreLog || {})[dk] || {}).entries || [];
  const score = scoreEntries.reduce((a, x) => a + (+x.score || 0), 0);
  const pomos = scoreEntries.filter(x => x.kind === 'pomo').length;
  return { dk, cnt, min, hb: habits.length, habits, eng, engParts: en, entries, score, pomos, note: (state.meta.dayNotes || {})[dk] || '', goods: (state.meta.goodThings || {})[dk] || [] };
}
/* 加权热力：返回 { score 0~1, lvl 0~4, parts[]（含权重与原始值）, sig } */
function dayHeat(dk) {
  if (_calCache && _calCache[dk]) return _calCache[dk];
  const sig = daySignals(dk);
  // v7.7: daySignals().min 汇总的是全部项目的执行日志，分母必须用全局容量而不是当前项目净余量
  const cap = dayCapGlobal();
  let acc = 0, wsum = 0;
  const parts = HEAT_SIGNALS.map(s => {
    const denom = s.key === 'min' ? cap : s.cap;
    const rawv = sig[s.key];
    const has = rawv > 0;
    const norm = has ? clamp(rawv / (denom || 1), 0, 1) : 0;
    if (has) { acc += s.w * norm; wsum += s.w; }
    return { key: s.key, label: s.label, w: s.w, raw: rawv, norm, has, unit: s.unit, full: s.key === 'min' ? fmtHours(cap) + 'h' : s.full };
  });
  const score = wsum > 0 ? acc / wsum : 0;
  // 没有产出的日子（无完成 / 无时长 / 无打卡）一律 L0：主观精力自评不能单独撑起热力
  const active = sig.cnt > 0 || sig.min > 0 || sig.hb > 0;
  const out = { score: active ? score : 0, lvl: active ? heatFromScore(score) : 0, parts, cap, sig, active };
  if (_calCache) _calCache[dk] = out;
  return out;
}
function calDeadlineMap() {
  const m = {};
  getCachedTree(state.nodes);
  state.nodes.forEach(n => {
    if (!n.deadlineDate) return;
    const k = dkOfDate(n.deadlineDate);
    (m[k] || (m[k] = [])).push(n);
  });
  return m;
}
/* 月网格：周一开头的完整行 */
function calMonthCells() {
  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const lead = mondayIdx(first);
  const days = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const total = Math.max(35, Math.ceil((lead + days) / 7) * 7);
  const start = addDays(first, -lead);
  const cells = [];
  for (let i = 0; i < total; i++) {
    const d = addDays(start, i);
    cells.push({ date: d, dk: dateKey(d), inMonth: d.getMonth() === calMonth.getMonth(), future: d.getTime() > today0().getTime() });
  }
  return { cells, rows: total / 7 };
}
function calWeekCells() {
  const base = addDays(weekRange().start, calWeekOff * 7);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(base, i);
    cells.push({ date: d, dk: dateKey(d), inMonth: true, future: d.getTime() > today0().getTime() });
  }
  return { cells, rows: 1 };
}
/* ── 格子 HTML（月/周共用）── */
function calCellHtml(c, h, dlMap, mode) {
  const isToday = c.dk === dateKey();
  const dls = dlMap[c.dk] || [];
  const cls = ['cal-d', 'c' + h.lvl];
  if (!c.inMonth) cls.push('out');
  if (isToday) cls.push('today');
  if (c.dk === calSelDk) cls.push('sel');
  if (c.future) cls.push('fut');
  if (!h.lvl && !dls.length) cls.push('blank');
  const meta = [];
  if (h.sig.cnt) meta.push(`<em>✓${h.sig.cnt}</em>`);
  if (h.sig.min) meta.push(`<em>⏱${fmtHours(h.sig.min)}h</em>`);
  if (h.sig.hb) meta.push(`<em>🔥${h.sig.hb}</em>`);
  const title = `${c.dk} 星期${CAL_WD[mondayIdx(c.date)]} · 热力 ${Math.round(h.score * 100)}（L${h.lvl}）· 完成 ${h.sig.cnt} 项 · ${fmtHours(h.sig.min)}h · 打卡 ${h.sig.hb} · 评分 ${h.sig.score}${dls.length ? ` · 到期 ${dls.length}` : ''}`;
  const big = mode === 'week';
  return `<button type="button" class="${cls.join(' ')}" data-dk="${c.dk}" title="${esc(title)}">` +
    `<b class="cal-n">${big ? '周' + CAL_WD[mondayIdx(c.date)] + ' ' : ''}${c.date.getDate()}</b>` +
    (big ? `<span class="cal-hint">${h.sig.note ? '📝 有总结' : ''}</span>` : '') +
    `<span class="cal-h">${meta.join('')}</span>` +
    (dls.length ? `<span class="cal-dl">●${dls.length}</span>` : '') +
    `</button>`;
}
/* 周行左侧汇总槽 */
function calWeekGutter(rowCells) {
  let cnt = 0, min = 0, heat = 0, hn = 0;
  rowCells.forEach(c => {
    const h = dayHeat(c.dk);
    cnt += h.sig.cnt; min += h.sig.min;
    if (h.score > 0) { heat += h.score; hn++; }
  });
  const avg = hn ? Math.round(heat / hn * 100) : 0;
  const s = rowCells[0].date, e = rowCells[rowCells.length - 1].date;
  const lbl = `${s.getMonth() + 1}/${s.getDate()}–${e.getMonth() + 1}/${e.getDate()}`;
  return `<span class="cal-gut" title="${esc(lbl)} 合计：完成 ${cnt} 项 · ${fmtHours(min)}h · 平均热力 ${avg}">${esc(lbl)}<i>${cnt}</i></span>`;
}
function renderCalendar(box) {
  ensureCalCursor();
  resetCalCache();
  const dlMap = calDeadlineMap();
  if (state.scale === 'all') { renderCalendarYear(box, dlMap); return; }
  const { cells, rows } = state.scale === 'week' ? calWeekCells() : calMonthCells();
  const heats = cells.map(c => dayHeat(c.dk));
  // 概览统计（只算当月 / 当周）
  let cnt = 0, min = 0, hb = 0, active = 0, heatAcc = 0, hn = 0;
  let best = { dk: '', score: -1 };
  cells.forEach((c, i) => {
    if (state.scale !== 'week' && !c.inMonth) return;
    const h = heats[i];
    cnt += h.sig.cnt; min += h.sig.min; hb += h.sig.hb;
    if (h.sig.cnt || h.sig.hb) active++;
    if (h.score > 0) { heatAcc += h.score; hn++; }
    if (h.score > best.score) best = { dk: c.dk, score: h.score };
  });
  const avg = hn ? Math.round(heatAcc / hn * 100) : 0;
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const title = state.scale === 'week'
    ? (() => { const s = addDays(weekRange().start, calWeekOff * 7), e = addDays(s, 6); return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 → ${e.getMonth() + 1}月${e.getDate()}日`; })()
    : `${y} 年 ${mo + 1} 月`;
  let html = `<div class="gf-cal">` +
    `<div class="cal-bar"><div class="cal-nav">` +
    `<button type="button" class="cal-arrow" data-calm="-1" title="${state.scale === 'week' ? '上一周' : '上一月'}">‹</button>` +
    `<b class="cal-title">${esc(title)}</b>` +
    `<button type="button" class="cal-arrow" data-calm="1" title="${state.scale === 'week' ? '下一周' : '下一月'}">›</button>` +
    `<button type="button" class="gf-btn gf-btn--sm cal-today" data-caltoday>今天</button>` +
    `</div><div class="cal-sum">` +
    `<span class="cal-chip" title="该${state.scale === 'week' ? '周' : '月'}完成叶子数">✓ ${cnt} 项</span>` +
    `<span class="cal-chip" title="投入时长（实际优先，回退预估）">⏱ ${fmtHours(min)}h</span>` +
    `<span class="cal-chip" title="习惯打卡命中天数合计">🔥 ${hb} 次</span>` +
    `<span class="cal-chip" title="有执行记录的天数">活跃 ${active} 天</span>` +
    `<span class="cal-chip hot" title="加权热力均值（0~100）">热力 ${avg}</span>` +
    (best.dk && best.score > 0 ? `<button type="button" class="cal-chip best" data-dk="${best.dk}" title="点选最佳日">★ 最佳 ${best.dk.slice(5)}</button>` : '') +
    `</div><div class="cal-legend">` +
    `<span>热力</span><i class="c0"></i><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><span>加权：完成40 / 时长30 / 打卡15 / 能量15</span>` +
    `</div></div>`;
  html += `<div class="cal-main"><div class="cal-grid">` +
    `<div class="cal-wkh"><span class="cal-gut cal-gut-h">周</span>` + CAL_WD.map(w => `<span>${w}</span>`).join('') + `</div>`;
  for (let r = 0; r < rows; r++) {
    const rc = cells.slice(r * 7, r * 7 + 7);
    const rh = heats.slice(r * 7, r * 7 + 7);
    html += `<div class="cal-wk">` + (state.scale === 'week' ? '' : calWeekGutter(rc)) +
      rc.map((c, i) => calCellHtml(c, rh[i], dlMap, state.scale)).join('') + `</div>`;
  }
  html += `</div><div class="cal-detail" id="calDetail">${calDetailHtml(dlMap)}</div></div></div>`;
  box.innerHTML = html;
  bindCalendar(box);
}
function renderCalendarYear(box, dlMap) {
  ensureCalCursor();
  const y = calMonth.getFullYear();
  const cards = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    let cnt = 0, min = 0, heatAcc = 0, hn = 0, active = 0;
    const cells = [];
    for (let d = 1; d <= days; d++) { const dd = new Date(y, m, d); cells.push({ date: dd, dk: dateKey(dd), future: dd.getTime() > today0().getTime() }); }
    cells.forEach(c => {
      const h = dayHeat(c.dk);
      cnt += h.sig.cnt; min += h.sig.min;
      if (h.sig.cnt || h.sig.hb) active++;
      if (h.score > 0) { heatAcc += h.score; hn++; }
    });
    const avg = hn ? heatAcc / hn : 0;
    const lvl = heatFromScore(avg);
    cards.push(`<button type="button" class="cal-mo c${lvl}${m === new Date().getMonth() && y === new Date().getFullYear() ? ' cur' : ''}" data-calmo="${m}" title="${m + 1} 月：完成 ${cnt} 项 · ${fmtHours(min)}h · 活跃 ${active} 天 · 平均热力 ${Math.round(avg * 100)}">` +
      `<b>${m + 1} 月</b><span class="cm-n">✓${cnt}</span><span class="cm-m">${fmtHours(min)}h</span>` +
      `<span class="cm-strip">${cells.slice(-14).map(c => `<i class="c${dayHeat(c.dk).lvl}${c.future ? ' fut' : ''}"></i>`).join('')}</span></button>`);
  }
  let html = `<div class="gf-cal cal-year">` +
    `<div class="cal-bar"><div class="cal-nav">` +
    `<button type="button" class="cal-arrow" data-calm="-1" title="上一年">‹</button><b class="cal-title">${y} 年 · 12 个月热力</b>` +
    `<button type="button" class="cal-arrow" data-calm="1" title="下一年">›</button>` +
    `<button type="button" class="gf-btn gf-btn--sm cal-today" data-calyear>回到今年</button>` +
    `</div><div class="cal-sum"><span class="cal-chip">点月份 → 进入月视图</span><span class="cal-chip hot">条带 = 该月后 14 天逐日热力</span></div>` +
    `<div class="cal-legend"><span>热力</span><i class="c0"></i><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i></div></div>` +
    `<div class="cal-year-grid">${cards.join('')}</div>` +
    `<div class="cal-detail" id="calDetail">${calDetailHtml(dlMap)}</div></div>`;
  box.innerHTML = html;
  bindCalendar(box);
}
/* 日详情：热力分解 + 完成清单 + 习惯 + 到期 + 总结（全部可跳转定位） */
function calDetailHtml(dlMap) {
  const dk = calSelDk;
  const h = dayHeat(dk);
  const sig = h.sig;
  const parts = h.parts.map(p => `<div class="cal-part${p.has ? '' : ' nodata'}" title="${p.label}：原始 ${p.raw}${p.unit} · 满分线 ${p.full} · 权重 ${Math.round(p.w * 100)}%">` +
    `<span class="cp-l">${p.label}</span>` +
    `<span class="cp-bar"><i style="width:${Math.round(p.norm * 100)}%"></i></span>` +
    `<span class="cp-v">${p.has ? `${p.key === 'eng' ? p.raw : Math.round(p.raw)}${p.unit}` : '未记录'} · ${Math.round(p.w * 100)}%</span></div>`).join('');
  const wd = '星期' + CAL_WD[mondayIdx(new Date(dk + 'T00:00:00'))];
  const dp = dk.split('-').map(Number);
  const dTitle = `${dp[1]}月${dp[2]}日`;
  const isToday = dk === dateKey();
  const rows = (sig.entries.length ? sig.entries : []).map(e =>
    `<div class="cal-row" data-wf="${esc(e.wfId || '')}" data-node="${esc(e.nodeId || '')}" title="点击定位到规划树 · 执行于 ${new Date(e.t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}">` +
    `<span class="cr-t">${esc(e.text)}</span>` +
    (e.wfName ? `<span class="cr-wf">${esc(e.wfName)}</span>` : '') +
    (e.act ? `<span class="cr-m">⏱${e.act}′</span>` : (e.est ? `<span class="cr-m">预${e.est}′</span>` : '')) +
    (e.slot ? `<span class="cr-m">${esc(slotLabelOf(e.slot))}</span>` : '') +
    `<span class="cr-act"><button type="button" class="cal-mini" data-jump>定位</button></span></div>`).join('');
  const hbRows = sig.habits.map(x => `<div class="cal-row hb" data-wf="${esc(x.wfId || '')}" data-node="${esc(x.nodeId || '')}" title="点击定位到规划树"><span class="cr-t">🔁 ${esc(x.text)}</span><span class="cr-m">连击 ${x.cur} · 纪录 ${x.best}</span>${x.act ? `<span class="cr-m">⏱${x.act}′</span>` : ''}<span class="cr-act"><button type="button" class="cal-mini" data-jump>定位</button></span></div>`).join('');
  const dlRows = (dlMap[dk] || []).map(n => {
    const on = state.topPin === n.id;
    return `<div class="cal-row dl" data-wf="${esc(state.activeWorkflowId)}" data-node="${esc(n.id)}" title="点击定位到规划树"><span class="cr-t">🎯 ${esc(n.text)}</span><span class="cr-m">${n.done ? '已完成' : '到期'}</span><span class="cr-m">重${n.im}·急${n.ur}</span><span class="cr-act"><button type="button" class="cal-mini" data-jump>定位</button><button type="button" class="cal-mini star${on ? ' on' : ''}" data-top="${esc(n.id)}" title="${on ? '取消固定，交回算法排序' : '钉为「当下最重要」，英雄卡与流图金线都跟着走'}">${on ? '📌' : '★ 钉为Top1'}</button></span></div>`;
  }).join('');
  const goods = (sig.goods || []).filter(Boolean);
  const future = new Date(dk + 'T00:00:00').getTime() > today0().getTime();
  return `<div class="cal-det-h"><b>${isToday ? '今天 · ' : ''}${dTitle}</b><span>${wd}</span>` +
    `<span class="cal-lvl c${h.lvl}" title="加权热力 = Σ(权重×归一化子分)/Σ权重">L${h.lvl} · ${Math.round(h.score * 100)} 分</span></div>` +
    `<div class="cal-parts-wrap">${parts}</div>` +
    (sig.score || sig.pomos ? `<div class="cal-score">评分 <b>${sig.score}</b>（${scoreGrade(sig.score)}）${sig.pomos ? ` · 🍅 ${sig.pomos} 个专注 25′` : ''}</div>` : '') +
    (future && !dlRows ? `<div class="hint">这一天还在未来——先在规划视图给它配上期限（如「${dk.slice(8)}日」/「下周」），热力会自动回填。</div>` : '') +
    (dlRows ? `<div class="cal-sec">🎯 到期 ${ (dlMap[dk] || []).length } 项</div>${dlRows}` : '') +
    (rows ? `<div class="cal-sec">✓ 完成 ${sig.entries.length} 项</div>${rows}` : (future ? '' : `<div class="cal-sec">✓ 完成 0 项</div><div class="hint">${isToday ? '今天还没有完成记录——去今日清单勾掉一项，或点下方「☀ 去今日」。' : '这一天没有执行记录（热力 0）。'}</div>`)) +
    (hbRows ? `<div class="cal-sec">🔁 习惯打卡 ${sig.habits.length} 次</div>${hbRows}` : '') +
    (sig.eng ? `<div class="cal-sec">⚡ 精力自评</div><div class="cal-eng">${['am', 'pm', 'eve'].map(k => { const v = +sig.engParts[k] || 0; return `<span class="ce${v ? ' has' : ''}">${k === 'am' ? '🌅' : k === 'pm' ? '🌞' : '🌙'} ${v || '—'}</span>`; }).join('')}</div>` : '') +
    (sig.note || goods.length ? `<div class="cal-sec">📝 当日记录</div>${sig.note ? `<div class="cal-note">${esc(sig.note)}</div>` : ''}${goods.length ? `<ul class="cal-goods">${goods.filter(Boolean).map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}` : '') +
    `<div class="cal-acts">` +
    (isToday
      ? `<button type="button" class="gf-btn gf-btn--sm" data-caltoday>☀ 去今日</button><button type="button" class="gf-btn gf-btn--sm" data-rit="morning">🌅 晨计划</button><button type="button" class="gf-btn gf-btn--sm" data-rit="evening">🌙 晚总结</button>`
      : `<button type="button" class="gf-btn gf-btn--sm" data-caldim="${dateKey()}" title="切回今天">☀ 回今日</button>` +
        `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-rit="evening" title="仪式写入的是今天，与所选日期无关">🌙 今日仪式</button>`) +
    `<span class="cal-hint2">点条目 = 跳到规划树并高亮；到期项的「★ 钉为Top1」= 手工固定当下最重要（再点 📌 取消）</span></div>`;
}
function bindCalendar(box) {
  box.querySelectorAll('[data-calm]').forEach(b => b.onclick = () => {
    const d = +b.dataset.calm;
    if (state.scale === 'week') { calWeekOff += d; }
    else if (state.scale === 'all') { calMonth = new Date(calMonth.getFullYear() + d, calMonth.getMonth(), 1); }
    else { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + d, 1); }
    renderCanvas();
  });
  box.querySelectorAll('[data-caltoday]').forEach(tb => tb.onclick = () => {
    calMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); calWeekOff = 0; calSelDk = dateKey();
    if (state.scale === 'all') { state.scale = 'month'; syncZoombar(); }
    switchView('today');
  });
  const yb = box.querySelector('[data-calyear]');
  if (yb) yb.onclick = () => { calMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); renderCanvas(); };
  box.querySelectorAll('[data-calmo]').forEach(b => b.onclick = () => {
    calMonth = new Date(calMonth.getFullYear(), +b.dataset.calmo, 1);
    calSelDk = dateKey(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0));
    state.scale = 'month'; syncZoombar(); afterChange(); renderCanvas();
  });
  box.querySelectorAll('.cal-d[data-dk], .cal-chip.best[data-dk]').forEach(b => b.onclick = () => {
    calSelDk = b.dataset.dk;
    renderCanvas();
  });
  box.querySelectorAll('[data-caldim]').forEach(b => b.onclick = () => { calSelDk = b.dataset.caldim; calMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); calWeekOff = 0; renderCanvas(); });
  box.querySelectorAll('[data-rit]').forEach(b => b.onclick = () => openRitualModal(b.dataset.rit));
  box.querySelectorAll('.cal-row').forEach(r => {
    r.onclick = e => {
      if (e.target && e.target.dataset && e.target.dataset.top != null) return;
      focusGoalNode(r.dataset.wf, r.dataset.node);
    };
    const top = r.querySelector('[data-top]');
    if (top) top.onclick = e => {
      e.stopPropagation();
      const id = top.dataset.top || r.dataset.node;
      if (state.topPin === id) {
        state.topPin = null; save(); afterChange(); renderCanvas();
        showUndoToast('已取消固定，交回算法排序', () => { state.topPin = id; save(); afterChange(); renderCanvas(); });
        return;
      }
      if (r.dataset.wf && r.dataset.wf !== state.activeWorkflowId) switchWorkflow(r.dataset.wf);
      const n = byId(id); if (!n) { alert('该节点已不在当前项目里'); return; }
      const prev = state.topPin;
      state.topPin = n.id; save(); afterChange(); renderCanvas();
      showUndoToast('📌 已钉为「当下最重要」：' + n.text, () => { state.topPin = prev; save(); afterChange(); renderCanvas(); });
    };
  });
}
/* 跳转定位：切到规划视图 → 滚动到该节点行并高亮 1.6s */
function focusGoalNode(wfId, nodeId) {
  if (!nodeId) return;
  if (wfId && wfId !== state.activeWorkflowId) switchWorkflow(wfId);
  const n = byId(nodeId);
  if (!n) { alert('该节点已不在任何项目里（可能已被删除）'); return; }
  switchView('plan');
  const apply = () => {
    const inp = document.querySelector('.trow .trow-txt[data-id="' + nodeId + '"]');
    if (!inp) return false;
    const tr = inp.closest('.trow');
    tr.scrollIntoView({ block: 'center' });
    tr.classList.add('trow-hl');
    setTimeout(() => tr.classList.remove('trow-hl'), 1600);
    return true;
  };
  // 树已同步渲染，直接命中；万一刚切流尚未重绘，再补试一次
  if (!apply()) setTimeout(apply, 90);
}
function renderMindMap(box) {
  if (!state.nodes.length) { box.innerHTML = '<div class="hint">暂无目标树</div>'; return; }
  getCachedTree(state.nodes);
  const root = state.nodes.find(n => !n.parentId) || state.nodes[0];
  function branch(n, depth) {
    const kids = n._children || [];
    const mp = metricProgress(n);
    const badge = mp ? ` <em>${mp.pct}%</em>` : '';
    let h = `<div class="mm-node" style="--d:${depth}"><span class="mm-t">${esc(n.text)}${badge}</span>`;
    if (kids.length) h += `<div class="mm-kids">${kids.map(c => branch(c, depth + 1)).join('')}</div>`;
    return h + '</div>';
  }
  box.innerHTML = `<div class="mindmap">${branch(root, 0)}</div>`;
}

function showCanvasEmpty(altMsg) {
  const svg = document.getElementById('diagram-svg');
  const alt = document.getElementById('vizAlt');
  if (svg) { svg.innerHTML = ''; svg.style.display = 'none'; svg.setAttribute('viewBox', '0 0 100 100'); svg.removeAttribute('width'); svg.removeAttribute('height'); }
  if (alt) {
    alt.style.display = 'block';
    alt.innerHTML = emptyStateHtml(altMsg || {
      icon: '🌊', title: '还没有可展示的目标树', hint: '在「目标规划」粘贴计划或新建项目后，这里会出现精力流向图',
      btnLabel: '去规划', btnOnclick: "switchView('plan')"
    });
  }
}
function render() {
  const svg = document.getElementById('diagram-svg');
  const alt = document.getElementById('vizAlt');
  const nodes = state.nodes;
  if (!nodes.length) { showCanvasEmpty(); return; }
  if (svg) svg.style.display = '';
  if (alt && !VIZ_HTML.has(state.viewMode)) { alt.style.display = 'none'; alt.innerHTML = ''; }
  const vis = buildView(nodes, state.scale);
  const maxD = sankeyLayout(vis);
  const topId = state.topId;
  // 金线：top 的祖先链（目标→…→任务）
  const goldEdges = new Set();
  if (topId) {
    let cur = byId(topId); const chain = [];
    while (cur) { chain.push(cur.id); cur = cur.parentId ? byId(cur.parentId) : null; }
    for (let i = 0; i < chain.length - 1; i++) goldEdges.add(chain[i + 1] + '>' + chain[i]); // 父>子
  }
  const map = {}; vis.forEach(n => map[n.id] = n);

  let maxX = 0, maxY = 0;
  vis.forEach(n => { if (n._x + NODEW + LBL > maxX) maxX = n._x + NODEW + LBL; if (n._y + n._h > maxY) maxY = n._y + n._h; });
  const W = maxX + SX, H = maxY + SY + 10;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  // defs：金色发光 + 每条带渐变
  let defs =`<defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${svgGold()}" flood-opacity="0.95"/>
    </filter>
    <filter id="softglow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${COLORS.svgGlow || 'var(--accent)'}" flood-opacity="0.5"/>
    </filter>`;
  vis.forEach(n => {
    if (!n.parentId) return;
    const p = map[n.parentId]; if (!p) return;
    const id = 'g_' + n.id;
    const isGold = goldEdges.has(p.id + '>' + n.id);
    if (isGold) {
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${svgGold()}"/><stop offset="1" stop-color="${svgGoldSoft()}"/></linearGradient>`;
    } else {
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${urColor(p.ur)}"/><stop offset="1" stop-color="${urColor(n.ur)}"/></linearGradient>`;
    }
  });
  defs += `</defs>`;

  // 条带
  let ribbons = '', nodesSvg = '';
  const colBottom = {};   // 同列分支标签的已占用底部 y（防碰撞）
  vis.forEach(n => {
    if (!n.parentId) return;
    const p = map[n.parentId]; if (!p) return;
    const id = 'g_' + n.id;
    const isGold = goldEdges.has(p.id + '>' + n.id);
    const sibs = p._vc.slice().sort((a, b) => a._y - b._y);
    const used = sibs.reduce((s, c) => s + c._h, 0) + (sibs.length - 1) * LGAP;
    let off = p._y + (p._h - used) / 2;
    let si = sibs.indexOf(n);
    for (let k = 0; k < si; k++) off += sibs[k]._h + LGAP;
    const x0 = p._x + NODEW, x1 = n._x, cx = (x0 + x1) / 2, h = n._h, oy0 = off, oy1 = n._y;
    const d = `M${x0},${oy0} C${cx},${oy0} ${cx},${oy1} ${x1},${oy1} L${x1},${oy1 + h} C${cx},${oy1 + h} ${cx},${oy0 + h} ${x0},${oy0 + h} Z`;
    const isNoise = (category(n.im, n.ur).key === 'noise') && !isGold;
    const op = n.done ? 0.12 : (isGold ? 0.92 : (isNoise ? 0.28 : 0.45));
    ribbons += `<path class="ribbon${isGold ? ' hot' : ''}" data-p="${p.id}" data-c="${n.id}" d="${d}"
      fill="${isNoise ? svgNoise() : `url(#${id})`}" opacity="${op}" ${isGold ? 'filter="url(#glow)"' : ''}></path>`;
  });

  // 节点 + 标签
  vis.forEach(n => {
    const isRoot = (!n.parentId);
    const isTop = (n.id === topId);
    const inGold = topId && (function () { let c = byId(topId); while (c) { if (c.id === n.id) return true; c = c.parentId ? byId(c.parentId) : null; } return false; })();
    const c = category(n.im, n.ur);
    const isNoiseNode = !inGold && category(n.im, n.ur).key === 'noise';
    let barFill = isRoot ? 'rgba(255,255,255,.55)' : (inGold ? 'url(#g_' + n.id + ')' : (isNoiseNode ? 'rgba(150,158,180,.5)' : urColor(n.ur)));
    let stroke = isTop ? 'var(--gold)' : (inGold ? 'rgba(245,196,81,.7)' : 'rgba(255,255,255,.25)');
    let sw = isTop ? 2.4 : (inGold ? 1.8 : 1);
    let filt = (isTop || inGold) ? 'filter="url(#glow)"' : '';
    const scaleTag = (n.scale && n.scale !== 'long') ? { t: SCALE_LABEL[n.scale] || '', cls: 'nlabel sub', col: COLORS.scaleLabel || 'var(--accent)' } : null;
    nodesSvg += `<g class="node${isTop ? ' hot' : ''}" data-id="${n.id}">
      <rect class="nbar" x="${n._x}" y="${n._y}" width="${NODEW}" height="${n._h}" rx="5"
        fill="${barFill}" stroke="${stroke}" stroke-width="${sw}" ${filt}
        opacity="${n.done ? 0.35 : 1}"></rect>`;
    const lines = wrapLabel(n.text);
    const isLeaf = (n._vc.length === 0);
    const dlLine = (n.deadline && !n.done) ? (n.overdue ? `逾期${-n.daysLeft}天` : `${n.deadline}·剩${n.daysLeft}天`) : null;
    const all = [{ t: (n.done ? '✓ ' : '') + lines[0], cls: 'nlabel' }];
    for (let i = 1; i < lines.length; i++) all.push({ t: lines[i], cls: 'nlabel' });
    if (dlLine) all.push({ t: '⏱ ' + dlLine, cls: 'nlabel sub', col: n.overdue ? svgOverdue() : svgMuted() });
    if (scaleTag) all.push(scaleTag);
    const LH = 16;
    let tx, ty;
    if (isLeaf) { tx = n._x + NODEW + 10; ty = n._y + n._h / 2 - (all.length - 1) * LH / 2 + 4.5; }
    else {
      // 分支标签放条上方；若与同列上一个标签碰撞则退到右侧
      const topNeed = n._y - 8 - (all.length - 1) * LH;
      const d = n.depth;
      if (colBottom[d] != null && topNeed < colBottom[d]) { tx = n._x + NODEW + 10; ty = n._y + n._h / 2 - (all.length - 1) * LH / 2 + 4.5; }
      else { tx = n._x; ty = topNeed; }
      colBottom[d] = Math.max(colBottom[d] || 0, ty + all.length * LH);
    }
    let txt = '';
    all.forEach(L => { txt += `<tspan x="${tx}" y="${ty}" class="${L.cls}"${L.col ? ` fill="${L.col}"` : ''}>${esc(L.t)}</tspan>`; ty += LH; });
    nodesSvg += `<text>${txt}</text></g>`;
  });

  svg.innerHTML = defs + ribbons + nodesSvg;
  bindDiagramHover();
}

/* ============ 网络 / 关系图（桑基之外的第二视角） ============ */
function renderNetwork() {
  const svg = document.getElementById('diagram-svg');
  const nodes = state.nodes;
  if (!nodes.length) { showCanvasEmpty(); return; }
  if (svg) svg.style.display = '';
  const vis = buildView(nodes, state.scale);
  getCachedTree(state.nodes);
  sankeyLayout(vis);
  const topId = state.topId;
  const map = {}; vis.forEach(n => map[n.id] = n);
  let maxX = 0, maxY = 0;
  vis.forEach(n => {
    const cx = n._x + NODEW / 2, cy = n._y + n._h / 2;
    if (cx + 20 > maxX) maxX = cx + 20;
    if (cy + 20 > maxY) maxY = cy + 20;
  });
  const W = maxX + SX + 40, H = maxY + SY + 40;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  let edges = '', dots = '';
  vis.forEach(n => {
    if (!n.parentId) return;
    const p = map[n.parentId]; if (!p) return;
    const x0 = p._x + NODEW / 2, y0 = p._y + p._h / 2, x1 = n._x + NODEW / 2, y1 = n._y + n._h / 2;
    const isTopChain = (function () { let c = byId(topId); while (c) { if (c.id === n.id || c.id === p.id) return true; c = c.parentId ? byId(c.parentId) : null; } return false; })();
    const stroke = isTopChain ? svgGold() : urColor(n.ur);
    const sw = isTopChain ? 2.4 : 1.2;
    const op = n.done ? 0.2 : 0.55;
    edges += `<line class="net-edge${isTopChain ? ' hot' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${op}"/>`;
  });
  vis.forEach(n => {
    const cx = n._x + NODEW / 2, cy = n._y + n._h / 2;
    const r = Math.max(7, Math.min(16, 6 + n.im * 1.6));
    const isTop = (n.id === topId);
    const inGold = topId && (function () { let c = byId(topId); while (c) { if (c.id === n.id) return true; c = c.parentId ? byId(c.parentId) : null; } return false; })();
    const fill = inGold ? svgGold() : (category(n.im, n.ur).color);
    const stroke = isTop ? 'var(--ink)' : (inGold ? svgGoldSoft() : 'rgba(255,255,255,.35)');
    const sw = isTop ? 2 : 1;
    dots += `<g class="node${isTop ? ' hot' : ''}" data-id="${n.id}">
      <circle class="nbar" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${n.done ? 0.35 : 0.92}" stroke="${stroke}" stroke-width="${sw}" ${isTop || inGold ? 'filter="url(#glow)"' : ''}/>
      <text class="nlabel" x="${cx + r + 8}" y="${cy + 4}" font-size="12">${esc(wrapLabel(n.text)[0])}</text>
    </g>`;
  });
  const defs =`<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${svgGold()}" flood-opacity="0.9"/></filter></defs>`;
  svg.innerHTML = defs + edges + dots;
  bindDiagramHover();
}

/* ============ 四象限校准（拖拽归位） ============ */
function quadNodes() {
  // 只取「当前缩放尺度可见」的非根节点（与精力流向图尺度过滤一致）
  let list = state.nodes.filter(n => n.parentId);
  if (state.scale !== 'all') list = list.filter(n => n.scale === state.scale);
  if (state.quadQuickWin) list = list.filter(n => isQuickWin(n));
  return list;
}
function vePanelNodes() {
  let list = state.nodes.filter(n => n.parentId && !n.done);
  if (state.scale !== 'all') list = list.filter(n => n.scale === state.scale);
  return list;
}
const _quadExpanded = new Set();
function makeQuadCard(n) {
  const c = category(n.im, n.ur);
  const isTop = (n.id === state.topId);
  const expanded = _quadExpanded.has(n.id);
  const card = document.createElement('div'); card.className = 'qcard' + (isTop ? ' istop' : '') + (expanded ? ' expanded' : ''); card.dataset.id = n.id;
  card.style.borderLeftColor = isTop ? 'var(--gold)' : c.color;
  const h = document.createElement('div'); h.className = 'qh'; h.draggable = true; h.dataset.id = n.id; h.title = n.text; h.textContent = (isTop ? '★ ' : '') + n.text;
  const scaleOpts = ['', 'day', 'week', 'month', 'year', 'long'].map(k => `<option value="${k}"${n.scale === k ? ' selected' : ''}>${k === 'day' ? '每日' : k === 'week' ? '每周' : k === 'month' ? '每月' : k === 'year' ? '年度' : k === 'long' ? '长期' : '尺度'}</option>`).join('');
  const slotOpts = DAY_SLOTS.map(([k, l]) => `<option value="${k}"${(n.slot || '') === k ? ' selected' : ''}>${l}</option>`).join('');
  const isLeaf = !n._children.length;
  const body = document.createElement('div'); body.className = 'qbody';
  if (isQuickWin(n)) card.classList.add('qcard-qw');
  // 默认仅 重/急 步进 + ✓ + ⋯；价值/费力/尺度/时段/拆解收进卡展开
  body.innerHTML =`
    <span class="qstep">重<button data-k="im" data-d="-1">−</button><b>${n.im}</b><button data-k="im" data-d="1">+</button></span>
    <span class="qstep">急<button data-k="ur" data-d="-1">−</button><b>${n.ur}</b><button data-k="ur" data-d="1">+</button></span>
    <label class="qdone"><input type="checkbox" ${n.done ? 'checked' : ''}>✓</label>
    <button class="qmore-btn" data-qmore="${n.id}" title="展开：价值 / 费力 / 尺度 / 时段 / 拆解" aria-expanded="${expanded}">${expanded ? '▲' : '⋯'}</button>
    <div class="qmore">
    <span class="qstep" title="价值">值<button data-k="val" data-d="-1">−</button><b>${n.val}</b><button data-k="val" data-d="1">+</button></span>
    <span class="qstep" title="费力">力<button data-k="eff" data-d="-1">−</button><b>${n.eff}</b><button data-k="eff" data-d="1">+</button></span>
    <select class="qscale">${scaleOpts}</select>
      ${isLeaf ? `<select class="qslot" title="日视图时段">${slotOpts}</select>` : ''}
      ${isLeaf ? '<button class="qmicro" title="拆出 5 分钟微动作">🫳</button>' : ''}
      <button class="qai" title="SMART 对话拆解">🤖</button>
    </div>`;
  card.appendChild(h); card.appendChild(body);
  return card;
}
/* 容器级事件委托：卡片可能上百张，逐张绑监听会让一次重绘挂出上千个 handler */
let _quadBound = false;
function bindQuadDelegation() {
  if (_quadBound) return;
  const wrap = document.getElementById('quadGrid'); if (!wrap) return;
  _quadBound = true;
  const cardOf = t => (t && t.closest) ? t.closest('.qcard') : null;
  const dropOf = t => (t && t.closest) ? t.closest('.qdrop') : null;
  let hiId = null;
  wrap.addEventListener('dragstart', e => {
    const h = e.target.closest ? e.target.closest('.qh') : null; if (!h || !e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', h.dataset.id); e.dataTransfer.effectAllowed = 'move';
    const card = cardOf(h); if (card) card.classList.add('dragging');
  });
  wrap.addEventListener('dragend', e => { const card = cardOf(e.target); if (card) card.classList.remove('dragging'); });
  wrap.addEventListener('mouseover', e => {
    const card = cardOf(e.target); const id = card ? card.dataset.id : null;
    if (id === hiId) return;
    if (hiId) highlightNode(hiId, false);
    hiId = id; if (id) highlightNode(id, true);
  });
  wrap.addEventListener('mouseleave', () => { if (hiId) { highlightNode(hiId, false); hiId = null; } });
  wrap.addEventListener('dragover', e => { const d = dropOf(e.target); if (!d) return; e.preventDefault(); d.classList.add('over'); });
  wrap.addEventListener('dragleave', e => { const d = dropOf(e.target); if (d && !d.contains(e.relatedTarget)) d.classList.remove('over'); });
  wrap.addEventListener('drop', e => {
    const d = dropOf(e.target); if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    applyQuadDrop(e.dataTransfer.getData('text/plain'), d.dataset.q);
  });
  wrap.addEventListener('click', e => {
    const card = cardOf(e.target); if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('button[data-qmore]')) {
      const on = !_quadExpanded.has(id);
      if (on) _quadExpanded.add(id); else _quadExpanded.delete(id);
      card.classList.toggle('expanded', on);
      const b = card.querySelector('.qmore-btn'); if (b) { b.textContent = on ? '▲' : '⋯'; b.setAttribute('aria-expanded', on); }
      return;
    }
    const step = e.target.closest('button[data-k]');
    if (step) {
      const nd = byId(id); if (!nd) return;
      nd[step.dataset.k] = clamp((+nd[step.dataset.k]) + (+step.dataset.d), 1, 5);
      if (step.dataset.k === 'im') nd.val = Math.max(nd.val, nd.im);
      save(); afterChange(); return;
    }
    if (e.target.closest('.qmicro')) addMicroAction(id);
    else if (e.target.closest('.qai')) openSmart(id);
  });
  wrap.addEventListener('change', e => {
    const card = cardOf(e.target); if (!card) return;
    const id = card.dataset.id, t = e.target;
    if (t.matches('.qdone input')) { const nd = byId(id); if (nd) { setNodeDone(nd, t.checked); save(); afterChange(); } }
    else if (t.matches('.qscale')) { byId(id).scale = t.value || null; save(); afterChange(); }
    else if (t.matches('.qslot')) { byId(id).slot = t.value || ''; byId(id).scale = byId(id).scale || 'day'; save(); afterChange(); }
  });
  bindScrollMemory(wrap);
}
/* 重建列表容器时要还原滚动位置，但读 scrollTop 会触发强制同步布局（400 卡片实测多花 30ms）。
   改成在 scroll 事件里记账，重建后只做一次写入。 */
function bindScrollMemory(el) {
  if (!el || el.__scrollMem) return;
  el.__scrollMem = true; el.__scrollY = {};
  el.addEventListener('scroll', e => {
    const d = e.target && e.target.closest ? e.target.closest('[data-q]') : null;
    const src = d || el;
    el.__scrollY[d ? d.dataset.q : ''] = src.scrollTop;
  }, true);
}
function renderQuadrant() {
  const wrap = document.getElementById('quadGrid'); if (!wrap) return;
  bindQuadDelegation();
  getCachedTree(state.nodes);
  const nodes = quadNodes();
  if (!nodes.length) {
    wrap.innerHTML = emptyStateHtml({
      icon: '◫', title: '还没有可校准的叶子', hint: '缩小尺度或先在规划页生成子任务，再拖拽到四象限',
      btnLabel: '去规划', btnOnclick: "switchView('plan')"
    });
    return;
  }
  const buckets = { now: [], core: [], distract: [], noise: [] };
  nodes.forEach(n => { const k = category(n.im, n.ur).key; (buckets[k] || buckets.noise).push(n); });
  const keep = wrap.__scrollY || {};
  wrap.innerHTML = '';
  QUAD_ORDER.forEach(q => {
    const cell = document.createElement('div'); cell.className = 'quad-cell'; cell.dataset.q = q;
    const head = document.createElement('div'); head.className = 'quad-head'; head.innerHTML = QUAD[q].icon + ' ' + QUAD[q].label; cell.appendChild(head);
    const drop = document.createElement('div'); drop.className = 'qdrop'; drop.dataset.q = q;
    if (!buckets[q].length) {
      const e = document.createElement('div');
      e.className = 'qempty';
      e.innerHTML = emptyStateHtml({ icon: QUAD[q].icon, title: '暂无任务', hint: `拖叶子到「${QUAD[q].label.split('·')[0]}」` });
      drop.appendChild(e);
    }
    buckets[q].forEach(n => drop.appendChild(makeQuadCard(n)));
    drop.scrollTop = keep[q] || 0;
    cell.appendChild(drop); wrap.appendChild(cell);
  });
  renderVeMatrix();
}
const _veExpanded = {};
let _veBound = false;
function renderVeMatrix() {
  const wrap = document.getElementById('veGrid'); if (!wrap) return;
  const nodes = vePanelNodes();
  const buckets = { quick: [], major: [], easy: [], trap: [] };
  nodes.forEach(n => { (buckets[veKey(n.val, n.eff)] || buckets.trap).push(n); });
  const toggle = document.getElementById('btnQuickWin');
  if (toggle) toggle.classList.toggle('on', !!state.quadQuickWin);
  const panel = document.getElementById('vePanel');
  if (panel) {
    if (!panel._zoneBound) { panel.open = zoneOpenPref('vePanel', false); bindZonePersist(panel); }
    const sum = document.getElementById('veSum');
    if (sum) sum.textContent = `快速赢 ${buckets.quick.length}`;
  }
  if (!_veBound) {
    _veBound = true;
    wrap.addEventListener('click', e => {
      const m = e.target.closest('.ve-more'); if (!m) return;
      const cell = m.closest('.ve-cell'); if (!cell) return;
      _veExpanded[cell.dataset.ve] = !_veExpanded[cell.dataset.ve];
      renderVeMatrix();
    });
  }
  wrap.innerHTML = '';
  VE_ORDER.forEach(k => {
    const cell = document.createElement('div'); cell.className = 've-cell'; cell.dataset.ve = k;
    const head = document.createElement('div'); head.className = 've-head';
    head.innerHTML = `${VE[k].icon} ${VE[k].label} <span class="ve-cnt">${buckets[k].length}</span>`;
    head.style.borderLeftColor = VE[k].color;
    cell.appendChild(head);
    const list = document.createElement('div'); list.className = 've-list';
    if (!buckets[k].length) { const e = document.createElement('div'); e.className = 've-empty'; e.textContent = '—'; list.appendChild(e); }
    const shown = _veExpanded[k] ? buckets[k] : buckets[k].slice(0, 6);
    shown.forEach(n => {
      const row = document.createElement('div'); row.className = 've-row' + (isQuickWin(n) ? ' qw' : '');
      row.textContent = n.text.length > 28 ? n.text.slice(0, 28) + '…' : n.text;
      row.title = `值 ${n.val} · 力 ${n.eff}`;
      list.appendChild(row);
    });
    if (buckets[k].length > 6) {
      const more = document.createElement('button'); more.className = 've-more';
      more.textContent = _veExpanded[k] ? '▴ 收起' : `▾ 展开全部 ${buckets[k].length} 项`;
      list.appendChild(more);
    }
    cell.appendChild(list); wrap.appendChild(cell);
  });
}
function applyQuadDrop(id, q) {
  const n = byId(id); if (!n) return;
  const v = QUAD[q].val;
  n.im = v.im; n.ur = v.ur;
  n._manualIm = true; n._manualUr = true; // 手动拖拽后，文本重推断不再覆盖
  save(); afterChange();
}
function highlightNode(id, on) {
  const g = document.getElementById('diagram-svg').querySelector('g.node[data-id="' + id + '"]');
  const svg = document.getElementById('diagram-svg');
  if (g) {
    svg.classList.add('hovering'); g.classList.add('hot');
    svg.querySelectorAll('.ribbon[data-c="' + id + '"],.ribbon[data-p="' + id + '"]').forEach(r => r.classList.add('hot'));
  }
  if (!on) {
    svg.classList.remove('hovering'); g && g.classList.remove('hot');
    svg.querySelectorAll('.ribbon.hot').forEach(r => r.classList.remove('hot'));
  }
  highlightQuad(id, on);
}
function highlightQuad(id, on) { const c = document.querySelector('.qcard[data-id="' + id + '"]'); if (c) c.classList.toggle('hl', on); }
function bindDiagramHover() {
  document.querySelectorAll('#diagram-svg g.node').forEach(g => {
    const id = g.dataset.id;
    g.addEventListener('mouseenter', () => {
      const svg = document.getElementById('diagram-svg');
      svg.classList.add('hovering'); g.classList.add('hot');
      svg.querySelectorAll('.ribbon[data-c="' + id + '"],.ribbon[data-p="' + id + '"]').forEach(r => r.classList.add('hot'));
      highlightQuad(id, true);
    });
    g.addEventListener('mouseleave', () => {
      const svg = document.getElementById('diagram-svg');
      svg.classList.remove('hovering'); g.classList.remove('hot');
      svg.querySelectorAll('.ribbon.hot').forEach(r => r.classList.remove('hot'));
      highlightQuad(id, false);
    });
  });
}

/* ============ 番茄钟 · 绑定 Top1 ============ */
let pomoTimer = null;
function pomoRemainMs() {
  if (!state.pomo.active) return 0;
  if (state.pomo.paused) return Math.max(0, state.pomo.remainMs || 0);
  return Math.max(0, state.pomo.endAt - Date.now());
}
function togglePomoPause() {
  if (!state.pomo.active) return;
  if (state.pomo.paused) {
    state.pomo.paused = false;
    state.pomo.endAt = Date.now() + (state.pomo.remainMs || 0);
    if (pomoTimer) clearInterval(pomoTimer);
    pomoTimer = setInterval(() => { if (pomoRemainMs() <= 0) finishPomo(true); else renderPomoBar(); }, 1000);
  } else {
    state.pomo.paused = true;
    state.pomo.remainMs = Math.max(0, state.pomo.endAt - Date.now());
    if (pomoTimer) clearInterval(pomoTimer);
  }
  renderPomoBar();
}
function startPomo(minutes) {
  const id = state.topId;
  if (!id) { alert('请先载入目标，选出当下最重要'); return; }
  minutes = minutes || 25;
  // v7.9: topId 可能属于其他项目 —— 带上 wfId，完成时按流归账
  state.pomo = { active: true, paused: false, endAt: Date.now() + minutes * 60000, nodeId: id, wfId: state.topWfId || state.activeWorkflowId, minutes };
  document.body.classList.add('focus-timer-on');
  if (pomoTimer) clearInterval(pomoTimer);
  pomoTimer = setInterval(() => { if (pomoRemainMs() <= 0) finishPomo(true); else renderPomoBar(); }, 1000);
  renderPomoBar();
}
function stopPomo() { finishPomo(false); }
function finishPomo(credit) {
  if (credit && state.pomo.nodeId) {
    // v7.9: 优先按 pomo.wfId 跨项目找（全局 MIT 可能不属当前项目）
    const n = (state.pomo.wfId ? nodeInWorkflow(state.pomo.wfId, state.pomo.nodeId) : null) || byId(state.pomo.nodeId);
    if (n) { n.actualMinutes = (n.actualMinutes || 0) + Math.round(state.pomo.minutes || 25); n.touchedAt = Date.now(); appendScore(n, 'pomo', { minutes: state.pomo.minutes || 25 }); save(); }
  }
  state.pomo.active = false;
  state.pomo.paused = false;
  document.body.classList.remove('focus-timer-on');
  if (pomoTimer) clearInterval(pomoTimer);
  renderPomoBar(); afterChange();
}
function renderPomoBar() {
  const el = document.getElementById('pomoBar'); if (!el) return;
  let tl = document.getElementById('pomoTopLine');
  if (!tl) { tl = document.createElement('div'); tl.id = 'pomoTopLine'; document.body.appendChild(tl); }
  if (!state.pomo.active) { el.classList.remove('show'); el.innerHTML = ''; tl.style.width = '0%'; return; }
  const ms = pomoRemainMs();
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  const total = Math.max(1, (state.pomo.minutes || 25) * 60000);
  const pct = clamp(Math.round((total - ms) / total * 100), 0, 100);
  tl.style.width = pct + '%';
  const n = (state.pomo.wfId ? nodeInWorkflow(state.pomo.wfId, state.pomo.nodeId) : null) || byId(state.pomo.nodeId);
  el.classList.add('show');
  const paused = !!state.pomo.paused;
  const pomoMode = (state.pomo.minutes || 25) >= 90 ? '🌊 深潜' : ((state.pomo.minutes || 25) >= 50 ? '🍅 长专注' : '🍅 专注');
  // v8.17: 图标旁一律带中文（暂停/继续/提前结束/剩余/进度），避免纯 emoji 不知所云
  el.innerHTML = `<div class="pomo-inner">
    <b title="${paused ? '计时已暂停' : '番茄钟进行中'}">${paused ? '⏸ 已暂停' : pomoMode}</b>
    <span class="pomo-task" title="当前专注任务">${esc((n && n.text) || '（未绑定任务）')}</span>
    <span class="pomo-t" title="剩余时间">${pad2(m)}:${pad2(s)}</span>
    <span class="pomo-pct" title="已完成进度">进度 ${pct}%</span>
    <div class="pomo-prog" title="进度条" aria-hidden="true"><i style="width:${pct}%"></i></div>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pomoPause" title="${paused ? '继续计时' : '暂停计时'}">${paused ? '▶ 继续' : '⏸ 暂停'}</button>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pomoStop" title="提前结束本轮（已计时部分仍计分）">⏹ 结束</button>
  </div>`;
  const pause = el.querySelector('#pomoPause');
  if (pause) pause.onclick = () => togglePomoPause();
  const stop = el.querySelector('#pomoStop');
  if (stop) stop.onclick = () => stopPomo();
}
function weeklyMomentum() {
  ensureWorkflows();
  flushActiveWorkflow();
  let done = 0, est = 0, act = 0;
  const days = 7;
  const byDay = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today0()); d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const log = (state.meta && state.meta.executionLog && state.meta.executionLog[key]) || null;
    const c = log ? (log.completedCount || 0) : 0;
    done += c;
    if (log) {
      (log.entries || []).forEach(en => { est += (en.est || 0); act += (en.act || 0); });
    }
    byDay.unshift({ key, count: c });
  }
  const habitsDone = Object.keys(state.meta.habitStreaks || {}).length;
  return { done, est, act, byDay, habitsDone, days };
}

/* ============ 时间审计 + 计划谬误校准 ============ */
function timeAudit(days) {
  days = days || 7;
  const byWf = {}, byCat = { now: 0, core: 0, distract: 0, noise: 0 };
  let estSum = 0, actSum = 0, pairEst = 0, pairAct = 0, entries = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today0()); d.setDate(d.getDate() - i);
    const log = (state.meta && state.meta.executionLog && state.meta.executionLog[dateKey(d)]) || null;
    if (!log) continue;
    (log.entries || []).forEach(en => {
      const mins = en.act != null ? en.act : (en.est || 0);
      if (!mins) return;
      entries++;
      estSum += (en.est || 0); actSum += (en.act || 0);
      if (en.est > 0 && en.act != null) { pairEst += en.est; pairAct += en.act; }
      const wf = en.wfName || '未分组';
      byWf[wf] = (byWf[wf] || 0) + mins;
      let im = en.im, ur = en.ur;
      if ((im == null || ur == null) && en.nodeId) {
        const n = nodeInWorkflow(en.wfId, en.nodeId);
        if (n) { im = n.im; ur = n.ur; }
      }
      if (im != null && ur != null) { const k = category(im, ur).key; byCat[k] = (byCat[k] || 0) + mins; }
    });
  }
  const bias = pairEst > 0 ? pairAct / pairEst : null;
  return {
    days, entries, estSum, actSum, pairEst, pairAct, bias, byWf, byCat,
    catTotal: Object.values(byCat).reduce((a, b) => a + b, 0)
  };
}
function renderTimeAudit() {
  const box = document.getElementById('todayAudit'); if (!box) return;
  const a = timeAudit(7);
  if (!a.entries) {
    box.innerHTML = '';
    return;
  }
  const maxWf = Math.max(1, ...Object.values(a.byWf));
  const wfBars = Object.entries(a.byWf).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([name, mins]) =>
    `<div class="ta-row"><span class="ta-lbl" title="${esc(name)}">${esc(name.length > 8 ? name.slice(0, 8) + '…' : name)}</span><div class="ta-bar"><i style="width:${Math.round(mins / maxWf * 100)}%;background:var(--accent)"></i></div><span class="ta-num">${mins}′</span></div>`).join('');
  const catMeta = [['core', '核心', PALETTE_UR[0]], ['now', '救火', PALETTE_UR[4]], ['distract', '干扰', PALETTE_UR[3]], ['noise', '噪音', svgNoise()]];
  const catBars = catMeta.map(([k, lbl, col]) => {
    const mins = a.byCat[k] || 0;
    const pct = a.catTotal ? Math.round(mins / a.catTotal * 100) : 0;
    return `<div class="ta-row"><span class="ta-lbl">${lbl}</span><div class="ta-bar"><i style="width:${pct}%;background:${col}"></i></div><span class="ta-num">${pct}% · ${mins}′</span></div>`;
  }).join('');
  let biasHtml = '';
  if (a.bias != null) {
    const pct = Math.round((a.bias - 1) * 100);
    const over = a.bias > 1.1;
    biasHtml = `<div class="ta-bias${over ? ' warn' : ''}">估/实偏差 <b>${pct >= 0 ? '+' : ''}${pct}%</b>（预估 ${a.pairEst}′ → 实际 ${a.pairAct}′）${over ? ` · 新任务建议 ×${a.bias.toFixed(1)} 缓冲` : ''}
      ${over ? '<button type="button" class="gf-btn gf-btn--sm" id="btnCalBuffer" title="把今日未完成叶子的预估时长按偏差系数放大">一键缓冲今日剩余</button>' : ''}</div>`;
  } else {
    biasHtml = '<div class="ta-bias dim">记录 ≥3 条带预估的完成后，给出你的计划谬误系数。</div>';
  }
  const biasSum = a.bias != null ? `估/实偏差 ${a.bias > 1 ? '+' : ''}${Math.round((a.bias - 1) * 100)}%` : '样本不足';
  // v6.4 Q2（重要不紧急）投入目标线：四象限分类的意义最终落到时间分配
  const q2Target = (state.meta && state.meta.q2Target) || 50;
  const q2Pct = a.catTotal ? Math.round((a.byCat.core || 0) / a.catTotal * 100) : 0;
  const q2Html = a.catTotal ? `<div class="ta-q2${q2Pct >= q2Target ? ' ok' : ' low'}">
    <span>🔵 Q2 核心投入 <b>${q2Pct}%</b> / 目标 ${q2Target}%</span>
    <span class="ta-q2-tag">${q2Pct >= q2Target ? '达成 ✓' : (q2Pct >= q2Target - 15 ? '偏低 · 下周多排核心任务' : '严重不足 · 你被紧急的事牵着走')}</span>
    <span class="ta-q2-set" title="调整目标线">目标<input type="number" class="ta-q2-in" id="q2TargetIn" min="10" max="90" step="5" value="${q2Target}">%</span>
  </div>` : '';
  const q2Sum = a.catTotal ? ` · Q2 ${q2Pct}%` : '';
  box.innerHTML = `<details class="fold" data-fold="audit"${foldOpen('audit') ? ' open' : ''}>
    <summary>🔍 时间审计 · 近 7 天<span class="fold-sum">${a.entries} 项 · ${biasSum}${q2Sum}</span></summary>
    <div class="fold-body"><div class="today-audit">
      ${biasHtml}
      ${q2Html}
      <div class="ta-cols"><div class="ta-col"><div class="ta-col-h">实际投入 · 按工作流</div>${wfBars}</div>
      <div class="ta-col"><div class="ta-col-h">实际投入 · 按象限</div>${catBars}</div></div>
    </div></div>
  </details>`;
  const q2in = box.querySelector('#q2TargetIn');
  if (q2in) q2in.onchange = () => { ensureScoreMeta(); state.meta.q2Target = clamp(+q2in.value || 50, 10, 90); saveMeta(); renderTimeAudit(); };
  bindFoldPersist(box, 'audit');
  const bb = box.querySelector('#btnCalBuffer');
  if (bb) bb.onclick = () => applyCalibratedBuffer(a.bias);
}
function applyCalibratedBuffer(bias) {
  if (!bias || bias <= 1.05) return;
  const f = Math.min(2, bias);
  let n = 0;
  ensureWorkflows(); flushActiveWorkflow();
  state.workflows.forEach(wf => {
    (wf.nodes || []).forEach(node => {
      if (node.done || !node.parentId) return;
      const isToday = node.scale === 'day' || (node.deadlineDate && node.daysLeft != null && node.daysLeft <= 1);
      if (!isToday || !node.estimateMinutes) return;
      node.estimateMinutes = Math.max(node.estimateMinutes + 5, Math.round(node.estimateMinutes * f / 5) * 5);
      n++;
    });
  });
  save(); afterChange();
  alert(n ? `已按 ×${f.toFixed(1)} 缓冲 ${n} 项今日预估` : '今日没有需要缓冲的预估项');
}
/* ============ 停滞预警（重要目标 N 天无动静） ============ */
const STALE_DAYS = 7;
function stagnantDays(n) {
  const base = n.touchedAt || n.createdAt || null;
  if (!base) return 999; // 旧数据从未激活
  return Math.floor((Date.now() - base) / 86400000);
}
function stagnationAlerts(days) {
  days = days || STALE_DAYS;
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  activeWorkflows().forEach(wf => {  // v6.5: 归档项目不做停滞预警
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    nodes.filter(n => n.parentId && !n.done && n._children.length === 0 && n.im >= 4).forEach(n => {
      const d = stagnantDays(n);
      if (d >= days) out.push({ wfId: wf.id, wfName: wf.name || '', node: n, days: d, _s: focusScore(n) });
    });
  });
  return out.sort((a, b) => b._s - a._s);
}
function activateStale(wfId, nodeId) {
  const n = nodeInWorkflow(wfId, nodeId);
  if (!n) return;
  n.scale = 'day'; n.touchedAt = Date.now();
  save(); afterChange();
}
/* v8.16: 全部活跃项目的逾期叶子（过了期限没完成）——「需要关注」新类别；
   排除 recur/habit（循环型按节奏到期，不积累逾期语义）。与 stagnationAlerts 同遍历模式 */
function overdueLeaves() {
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  activeWorkflows().forEach(wf => {
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    nodes.filter(n => n.parentId && !n.done && n._children.length === 0 && !n.recur && n.role !== 'habit' && n.overdue).forEach(n => {
      out.push({ wfId: wf.id, wfName: wf.name || '', node: n, _s: focusScore(n) });
    });
  });
  return out.sort((a, b) => b._s - a._s);
}
/* v8.16: 逾期优先去重（纯函数）——同一节点同时「逾期」与「停滞」时只归逾期组（更严重），
   返回 {od, stale} 两组互不重叠；供需要关注区块渲染与角标计数同口径 */
function splitStaleOverdue(alerts, od) {
  const odList = od || [];
  const ids = new Set(odList.map(o => o && o.node && o.node.id));
  return { od: odList, stale: (alerts || []).filter(a => !(a && a.node && ids.has(a.node.id))) };
}
function attentionStaleOverdue() {
  return splitStaleOverdue(stagnationAlerts(STALE_DAYS), overdueLeaves());
}
function renderTodayStale() {
  const box = document.getElementById('todayStale'); if (!box) return;
  // v8.16: 逾期并入——同一节点只归一组（逾期优先），与角标计数同口径（attentionStaleOverdue）
  const { od, stale } = attentionStaleOverdue();
  if (!od.length && !stale.length) { box.innerHTML = ''; return; }
  const odRows = od.slice(0, 2).map(a =>
    `<div class="stale-row od"><span class="stale-t" title="${esc(a.node.text)}">${esc(a.node.text.length > 18 ? a.node.text.slice(0, 18) + '…' : a.node.text)}</span>
     <span class="stale-m">已逾期 ${-a.node.daysLeft} 天 · ${esc(a.wfName)}</span>
     <button type="button" class="gf-btn gf-btn--sm" data-stale="${a.node.id}" data-wf="${a.wfId}" title="提到今日清单（期限不变，今日区里可改期/完成）">⚡ 激活到今日</button></div>`).join('');
  const staleRows = stale.slice(0, 2).map(a =>
    `<div class="stale-row"><span class="stale-t" title="${esc(a.node.text)}">${esc(a.node.text.length > 18 ? a.node.text.slice(0, 18) + '…' : a.node.text)}</span>
     <span class="stale-m">${a.days >= 999 ? '从未激活' : a.days + ' 天无动静'} · ${esc(a.wfName)}</span>
     <button type="button" class="gf-btn gf-btn--sm" data-stale="${a.node.id}" data-wf="${a.wfId}" title="钉入今日清单并标记激活">⚡ 激活到今日</button></div>`).join('');
  box.innerHTML = `<details class="fold warn" data-fold="stale"${foldOpen('stale') ? ' open' : ''}>
    <summary>⚠️ 停滞·逾期<span class="fold-sum">${od.length + stale.length} 项（🚨逾期 ${od.length} · ⏸停滞 ${stale.length}）</span></summary>
    <div class="fold-body"><div class="today-stale">${odRows}${staleRows}</div></div>
  </details>`;
  bindFoldPersist(box, 'stale');
  box.querySelectorAll('[data-stale]').forEach(b => b.onclick = () => activateStale(b.dataset.wf, b.dataset.stale));
}

/* ============ v6.3 备份提醒 / 倦怠预警 / 新手引导卡 ============ */
function renderBackupTip() {
  const box = document.getElementById('todayBackupBar'); if (!box) return;
  ensureScoreMeta();
  const t = state.meta.lastBackupAt;
  const days = t ? Math.floor((Date.now() - t) / 86400000) : 999;
  if (days < 7) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="soft-tip tip-backup">💾 <span>${t ? `已经 <b>${days} 天</b>没备份了` : '还<b>从未备份</b>过'}——你的目标数据只存在这个浏览器里，建议每周备份一次。</span>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="btnBkNow">立即备份 JSON</button></div>`;
  const b = box.querySelector('#btnBkNow');
  if (b) b.onclick = () => { exportBackup(); renderBackupTip(); };
}
function burnoutSignal() {
  ensureScoreMeta();
  let lowDays = 0, checked = 0;
  for (let i = 1; i <= 3; i++) { // 昨天起往前 3 天
    const d = new Date(today0()); d.setDate(d.getDate() - i);
    const dk = dateKey(d);
    const e = state.meta.energyLog[dk] || {};
    const entries = (state.meta.scoreLog[dk] || { entries: [] }).entries;
    if (!entries.length && !(e.am || e.pm || e.eve)) continue; // 无数据天不计
    checked++;
    const vals = [e.am, e.pm, e.eve].filter(v => v > 0);
    const avgE = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
    const total = entries.reduce((a, x) => a + (x.score || 0), 0);
    if (avgE <= 2.4 && total < 40) lowDays++;
  }
  return { warn: checked >= 2 && lowDays >= 2, lowDays };
}
function renderBurnoutTip() {
  const box = document.getElementById('todayBurnout'); if (!box) return;
  const b = burnoutSignal();
  box.innerHTML = b.warn
    ? `<div class="soft-tip tip-burnout">🌿 <span>连续 ${b.lowDays} 天低能量 × 低产出——<b>恢复也是表现的一部分</b>。建议今天降低容量、只保 MIT，或干脆安排一个恢复日。</span></div>`
    : '';
}
function renderOnboard() {
  const box = document.getElementById('onboardCard'); if (!box) return;
  ensureScoreMeta();
  if (state.meta.onboarded) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="ob-card">
    <div class="ob-tt">👋 欢迎使用目标流——已为你载入一套示例数据，可以随便点、随便改</div>
    <div class="ob-steps">
      <div class="ob-step"><b>1</b><span>每天只住「☀ 今日」：从 MIT 开始 → 🍅 番茄 → 勾选完成，评分自动累积。</span></div>
      <div class="ob-step"><b>2</b><span>想换自己的目标？去「🎯 规划」视图把整段计划粘进文本框，一键解析成目标树。</span></div>
      <div class="ob-step"><b>3</b><span>在今日面板顶部设好 🌅晨计划 / 🌙晚总结 时间，仪式每天到点来找你。</span></div>
    </div>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="btnObOk">知道了，开始</button>
  </div>`;
  box.querySelector('#btnObOk').onclick = () => { state.meta.onboarded = true; saveMeta(); renderOnboard(); };
}

/* ============ 事前验尸（Premortem · 目标级风险） ============ */
function renderPremortemCard() {
  const box = document.getElementById('premortemCard'); if (!box) return;
  const root = state.nodes[0];
  if (!root) { box.innerHTML = ''; return; }
  const has = !!(root.premortem && root.premortem.trim());
  box.innerHTML = `<div class="premortem-card${has ? ' has' : ''}">
    <div class="pm-h">🪦 事前验尸 <span class="pm-sub">假设「${esc(root.text.length > 16 ? root.text.slice(0, 16) + '…' : root.text)}」半年后失败了——最可能因为什么？</span></div>
    <div class="pm-body" id="pmBody" style="display:${has ? 'none' : 'flex'}">
      <textarea id="pmText" rows="2" placeholder="例：客户跟进断档；核心方法一直没落地成文档；精力被救火掏空……">${esc(root.premortem || '')}</textarea>
      <button type="button" class="gf-btn gf-btn--sm" id="pmSave">${has ? '更新' : '存档'}</button>
    </div>
    ${has ? `<div class="pm-saved"><span class="pm-txt">${esc(root.premortem)}</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pmEdit">✎ 重审</button></div>` : ''}
  </div>`;
  const saveBtn = box.querySelector('#pmSave');
  if (saveBtn) saveBtn.onclick = () => {
    const ta = box.querySelector('#pmText');
    root.premortem = ta ? ta.value.trim() : '';
    save(); renderPremortemCard();
  };
  const editBtn = box.querySelector('#pmEdit');
  if (editBtn) editBtn.onclick = () => { const b = box.querySelector('#pmBody'); if (b) b.style.display = 'flex'; };
}

/* ============ 精力曲线匹配（主观精力 → 高峰时段排程） ============ */
const ENERGY_BUCKETS = [['am', '🌅 上午', ['h0', 'h1', 'h2']], ['pm', '🌞 下午', ['h3', 'h4', 'h5']], ['eve', '🌙 晚上', ['h6']]];
function energyBucketNow() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'am';
  if (h >= 12 && h < 18) return 'pm';
  return 'eve';
}
function logEnergy(level) {
  ensureScoreMeta();
  const dk = dateKey();
  const day = state.meta.energyLog[dk] || {};
  day[energyBucketNow()] = clamp(Math.round(level), 1, 5);
  state.meta.energyLog[dk] = day;
  saveMeta();
}
function energyCurve() {
  ensureScoreMeta();
  const acc = { am: [], pm: [], eve: [] };
  const now = Date.now();
  Object.keys(state.meta.energyLog || {}).forEach(dk => {
    const parts = dk.split('-').map(Number);
    const t = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    if (now - t > 14 * 86400000) return; // 只看近 14 天
    const day = state.meta.energyLog[dk] || {};
    ENERGY_BUCKETS.forEach(([k]) => { if (day[k]) acc[k].push(day[k]); });
  });
  const avg = {}, samples = acc.am.length + acc.pm.length + acc.eve.length;
  let peak = null, peakAvg = 0;
  ENERGY_BUCKETS.forEach(([k]) => {
    avg[k] = acc[k].length ? +(acc[k].reduce((a, b) => a + b, 0) / acc[k].length).toFixed(1) : null;
    if (avg[k] != null && avg[k] > peakAvg) { peakAvg = avg[k]; peak = k; }
  });
  return { avg, samples, peak: samples >= 3 ? peak : null };
}
function renderEnergyWidget() {
  const box = document.getElementById('todayEnergy'); if (!box) return;
  ensureScoreMeta();
  const bucket = energyBucketNow();
  const today = state.meta.energyLog[dateKey()] || {};
  const cur = today[bucket] || 0;
  const curve = energyCurve();
  const faces = ['😫', '🥱', '😐', '🙂', '🔥'];
  const bucketLbl = (ENERGY_BUCKETS.find(b => b[0] === bucket) || [])[1] || '';
  const checkin = faces.map((f, i) =>
    `<button type="button" class="e-btn${cur === i + 1 ? ' on' : ''}" data-energy="${i + 1}" title="${i + 1} 分">${f}</button>`).join('');
  let curveHtml = '';
  if (curve.samples >= 3) {
    const bars = ENERGY_BUCKETS.map(([k, lbl]) => {
      const v = curve.avg[k];
      const pct = v != null ? Math.round(v / 5 * 100) : 0;
      const isPeak = curve.peak === k;
      return `<div class="e-col${isPeak ? ' peak' : ''}"><div class="e-bar"><i style="height:${pct}%"></i></div><span class="e-lbl">${lbl}</span><span class="e-v">${v != null ? v : '—'}</span></div>`;
    }).join('');
    const peakMeta = ENERGY_BUCKETS.find(b => b[0] === curve.peak);
    curveHtml = `<div class="e-curve" title="近 14 天主观精力均值">${bars}</div>
      <span class="e-hint">你的高峰在 <b>${peakMeta ? peakMeta[1] : ''}</b> · 重任务（≥60′ / 高费力）建议钉 ${peakMeta ? peakMeta[2].map(s => (DAY_SLOTS.find(x => x[0] === s) || ['', ''])[1]).join('/') : ''}</span>`;
  } else {
    curveHtml = `<span class="e-hint dim">记录 ${3 - curve.samples} 次后生成你的精力曲线，自动建议重任务排程时段。</span>`;
  }
  const curFace = cur ? faces[cur - 1] : '—';
  const peakLbl = curve.peak ? (ENERGY_BUCKETS.find(b => b[0] === curve.peak) || [])[1] : '';
  box.innerHTML = `<details class="fold" data-fold="energy"${foldOpen('energy') ? ' open' : ''}>
    <summary>🔥 精力打卡<small style="color:var(--muted-2)">${bucketLbl}</small>
      <span class="fold-keep" style="display:inline-flex" onclick="event.preventDefault();event.stopPropagation();">${checkin}</span>
      <span class="fold-sum">当前 ${curFace}${peakLbl ? ` · 高峰 ${peakLbl}` : ''}</span></summary>
    <div class="fold-body"><div class="today-energy">${curveHtml}</div></div>
  </details>`;
  bindFoldPersist(box, 'energy');
  // v8.10: 打卡后走 afterChange 全链 —— 精力曲线的高峰桶变了会影响 focusScore 的 ±6 分加权，
  // MIT/今日清单顺序应当场重排（此前只重画精力卡，排序要等下次任意操作才突变）
  box.querySelectorAll('[data-energy]').forEach(b => b.onclick = () => { logEnergy(+b.dataset.energy); afterChange(); });
}
/* ---- 计划带宽 vs 近 7 天实际投入（叠到桑基/度量条上方） ---- */
function planVsActual() {
  ensureWorkflows(); flushActiveWorkflow(); ensureScoreMeta();
  const act = {}; let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today0()); d.setDate(d.getDate() - i);
    const log = (state.meta.executionLog || {})[dateKey(d)];
    if (!log) continue;
    (log.entries || []).forEach(en => {
      const k = en.wfId || '_';
      const m = en.act || en.est || 0;
      act[k] = (act[k] || 0) + m; total += m;
    });
  }
  const rows = (state.workflows || []).filter(w => (w.nodes || []).length).map(w => {
    const plan = (state.meta.planShare || {})[w.id];
    const actPct = total ? Math.round((act[w.id] || 0) / total * 100) : 0;
    return { wf: w, plan: plan == null ? null : plan, actPct, actMin: act[w.id] || 0 };
  });
  return { rows, total };
}
function renderPlanShareStrip() {
  const box = document.getElementById('planShare'); if (!box) return;
  const { rows, total } = planVsActual();
  const withPlan = rows.filter(r => r.plan != null);
  if (!rows.length || (!withPlan.length && !total)) { box.innerHTML = ''; return; }
  const chips = rows.map(r => {
    const has = r.plan != null;
    const gap = has ? (r.actPct - r.plan) : 0;
    const gapTag = has ? (Math.abs(gap) <= 8 ? '<span class="ps-gap ok">≈ 对齐</span>' : gap > 0 ? `<span class="ps-gap over">实际超 ${gap}%</span>` : `<span class="ps-gap under">投入不足 ${-gap}%</span>`) : '';
    return `<div class="ps-chip" title="${esc(r.wf.name || '')} · 近 7 天实投 ${r.actMin}′">
      <span class="ps-name">${esc((r.wf.name || '项目').slice(0, 10))}</span>
      <span class="ps-bars">
        <span class="ps-bar plan" style="width:${has ? r.plan : 0}%" title="计划 ${has ? r.plan + '%' : '未设'}"></span>
        <span class="ps-bar act" style="width:${r.actPct}%" title="实际 ${r.actPct}%"></span>
      </span>
      <span class="ps-num">${has ? `计划${r.plan}% ` : ''}实际${r.actPct}%</span>${gapTag}
    </div>`;
  }).join('');
  box.innerHTML = `<div class="plan-share"><div class="ps-h">📐 计划带宽 vs 近 7 天实际 <span class="muted">（设了计划带宽的项目，才会出现上对齐/不足提示）</span></div>${chips}</div>`;
}

/* v8.17: 真 KR 节点（仅 role===KR，未完成）——不再把文案「(1/2)」解析出的 targetNum 当指标。
   今日状态不再展示（那是项目级进度，不是今日完成）；项目总览 / 规划侧复用此纯筛选。 */
function projectKrNodes(nodes) {
  return (nodes || []).filter(n => n && n.role === 'KR' && n.parentId && !n.done);
}
function renderMetricsStrip() {
  const el = document.getElementById('metricsStrip'); if (!el) return;
  const mom = weeklyMomentum();
  if (!state.nodes.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  const spark = mom.byDay.map(d => {
    const h = Math.min(14, 2 + d.count * 3);
    return `<span class="ms-spark" title="${d.key}：完成 ${d.count} 项" style="height:${h}px"></span>`;
  }).join('');
  // v8.17: 今日状态只留「本周完成」执行动量——「指标 N」是项目级 KR/带分数目标进度，
  // 与「今日完成」无关；旧过滤把文案「(1/2)」也当指标 → 8 个雷同 pill，且删项目后仍挂在当前树里。
  // 真 KR 改放到项目总览（openProjectOverview）。
  el.innerHTML = `<div class="metrics-strip"><span class="ms-pill ms-mom" title="跨全部项目 · 近 7 天勾选完成的叶子数与估/实时长（今日相关）· 项目级 KR 指标请点侧栏项目名看总览">本周完成 <b>${mom.done}</b> · 估 ${mom.est}′ / 实 ${mom.act}′ <span class="ms-sparks">${spark}</span></span></div>`;
}

/* ============ 英雄卡：当下最重要（按尺度 · 习惯不竞选） ============ */
function pickHeroTop(vis, ranked) {
  const list = ranked || pickRanked(vis, 8);
  // 英雄卡只放「能推动主线」的候选：习惯（打卡型）退出竞选，留在今日面板打卡
  const noHabit = list.filter(n => !(n.recur || n.role === 'habit'));
  if (state.topPin) {
    const pinned = (vis || []).find(n => n.id === state.topPin) || state.nodes.find(n => n.id === state.topPin && !n.done);
    if (pinned) return pinned;
  }
  return noHabit[0] || list[0] || null;
}
/* ============ 顶部比例尺（随尺度缩放切换） ============ */
// 把当前尺度映射成一组时间桶（像地图比例尺一样随缩放换单位）
function timeBuckets(scale, today) {
  const t = today ? new Date(today) : new Date(TODAY);
  if (scale === 'all') {
    const y = t.getFullYear();
    const bs = [];
    for (let m = 0; m < 12; m++) { const s = new Date(y, m, 1), e = new Date(y, m + 1, 1); bs.push({ key: 'm' + m, label: (m + 1) + '月', sub: '', start: s, end: e }); }
    return { title: '年度精力节奏', sub: `${y} 年 · 12 个月`, buckets: bs };
  }
  if (scale === 'month') {
    const y = t.getFullYear(), m = t.getMonth();
    const start = new Date(y, m, 1), end = new Date(y, m + 1, 1);
    const bs = []; let wk = 0; let d = new Date(start);
    while (d < end) {
      const ws = new Date(d);
      const dow = (d.getDay() + 6) % 7; const span = 6 - dow;
      let we = new Date(d); we.setDate(we.getDate() + span + 1);
      if (we > end) we = end;
      bs.push({ key: 'w' + wk, label: '第' + (wk + 1) + '周', sub: ws.getDate() + '日', start: new Date(ws), end: new Date(we) });
      d = new Date(we); wk++;
    }
    return { title: '本月精力节奏', sub: `${m + 1} 月 · ${bs.length} 周`, buckets: bs };
  }
  if (scale === 'week') {
    const d = new Date(t); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
    const wn = ['一', '二', '三', '四', '五', '六', '日']; const bs = [];
    for (let i = 0; i < 7; i++) { const day = new Date(d); day.setDate(d.getDate() + i); const s = new Date(day); s.setHours(0, 0, 0, 0); const e = new Date(day); e.setHours(24, 0, 0, 0); bs.push({ key: 'd' + i, label: '周' + wn[i], sub: day.getDate() + '日', start: s, end: e }); }
    return { title: '本周精力节奏', sub: '7 天', buckets: bs };
  }
  if (scale === 'day') {
    const blocks = [['清晨', 0, 6], ['上午', 6, 9], ['中午', 9, 12], ['午后', 12, 15], ['下午', 15, 18], ['傍晚', 18, 21], ['夜间', 21, 24]];
    const bs = blocks.map((b, i) => { const s = new Date(t); s.setHours(b[1], 0, 0, 0); const e = new Date(t); e.setHours(b[2], 0, 0, 0); return { key: 'h' + i, label: b[0], sub: '', start: s, end: e }; });
    return { title: '今日精力节奏', sub: '一天 · 7 个时段', buckets: bs };
  }
  return { title: '', sub: '', buckets: [] };
}
function bucketOfDate(date, buckets) {
  for (const b of buckets) { if (date >= b.start && date < b.end) return b; }
  return null;
}
const scaleUnit = s => s === 'all' ? '月' : s === 'month' ? '周' : s === 'week' ? '天' : s === 'day' ? '时段' : '期';

function renderRhythm() {
  const box = document.getElementById('rhythm'); if (!box) return;
  let capHtml = '';
  if (state.scale === 'day' && state.nodes.length) {
    const d = dayPlanFeasibility();
    const pct = Math.min(100, Math.round(d.est / d.cap * 100));
    const ok = !d.over;
    capHtml = `<div class="day-capacity${ok ? '' : ' over'}" title="今日待办叶子预估合计 vs 默认 ${d.cap} 分钟容量">
      <span>今日可做完性</span>
      <span class="dc-bar"><i style="width:${pct}%"></i></span>
      <span class="dc-num">预估 ${d.est} 分${d.act ? ` / 已计 ${d.act} 分` : ''} · ${d.count} 项</span>
      <span class="dc-tag">${ok ? '可承载' : '超负荷'}</span>
    </div>`;
  }
  const { title, sub, buckets } = timeBuckets(state.scale, TODAY);
  const load = buckets.map(() => ({ val: 0, ur: 0, cnt: 0 }));
  let anyDeadline = false;
  state.nodes.forEach(n => { if (n.deadlineDate) anyDeadline = true; });
  // 1) 带具体期限的节点 → 落入对应桶
  state.nodes.forEach(n => {
    if (!n.deadlineDate) return;
    const b = bucketOfDate(n.deadlineDate, buckets);
    if (b) { const i = buckets.indexOf(b); load[i].val += n.im; load[i].ur += n.ur; load[i].cnt++; }
  });
  // 2) 例行 / 周期性节点（无具体期限、尺度与当前视图一致）→ 平摊到各桶，呈现“基线节奏”
  if (state.scale !== 'all') {
    state.nodes.forEach(n => {
      if (n.deadlineDate) return;
      const routine = n.recur || inferRecur(n.text, n.scale);
      const scaleMatch = n.scale === state.scale;
      const crossRoutine = (state.scale === 'week' && n.scale === 'day' && routine) || (state.scale === 'day' && n.scale === 'week' && routine);
      if (!scaleMatch && !crossRoutine) return;
      const each = n.im / buckets.length;
      buckets.forEach((b, i) => { load[i].val += each; load[i].cnt++; if (load[i].cnt === 1) load[i].ur = n.ur; else load[i].ur = (load[i].ur + n.ur) / 2; });
    });
  }
  const anyLoad = load.some(l => l.val > 0);
  if (state.scale === 'all' && !anyDeadline) {
    box.innerHTML = capHtml + '<div class="rhint">给目标加上「3月15日 / 本月底 / 周五前」这类期限，这里会显示全年精力节奏——看清精力在哪几个月扎堆。</div>'; return;
  }
  if (!anyLoad && state.scale !== 'all') {
    box.innerHTML = `<div class="rhint">当前「${SCALE_LABEL[state.scale]}」尺度下还没有带期限的精力投入；切到「年度总览」可看全年节奏，或在目标里加上「${state.scale === 'day' ? '今天/每天' : state.scale === 'week' ? '本周内/每周' : '本月底/每月'}」这样的时间词。</div>`;
    // 仍渲染空比例尺，让用户看到尺度已切换
    const max = 1; const tnow = new Date(TODAY);
    let hint = `<div class="rtitle">📊 ${title}（条高 = 该${scaleUnit(state.scale)}的重要度之和 · 红=越急）<span class="rsub2">${sub}</span></div><div class="rbars">`;
    buckets.forEach(b => { const isCur = (tnow >= b.start && tnow < b.end); hint += `<div class="rcol${isCur ? ' cur' : ''}" title="${b.label}"><div class="rbar" style="height:5px;background:rgba(255,255,255,.10)"></div><div class="rmo">${b.label}</div>${b.sub ? `<div class="rsub">${b.sub}</div>` : ''}</div>`; });
    hint += '</div>';
    box.innerHTML = capHtml + hint; return;
  }
  const max = Math.max(1, ...load.map(l => l.val));
  const tnow = new Date(TODAY);
  let html = capHtml + `<div class="rtitle">📊 ${title}（条高 = 该${scaleUnit(state.scale)}的重要度之和 · 红=越急）<span class="rsub2">${sub}</span></div><div class="rbars">`;
  const slotTasks = {};
  if (state.scale === 'day') {
    state.nodes.filter(n => n.parentId && !n.done).forEach(n => {
      let slot = n.slot || '';
      if (!slot && (n.recur || n.scale === 'day') && !n.deadlineDate) slot = 'h1';
      if (!slot) return;
      if (!slotTasks[slot]) slotTasks[slot] = [];
      const label = (n.recur && !n.slot ? '🔁 ' : '') + n.text;
      slotTasks[slot].push(label);
    });
  }
  if (state.scale === 'week') {
    state.nodes.filter(n => n.parentId && !n.done && (n.recur || (n.scale === 'week' && !n.deadlineDate))).forEach(n => {
      buckets.forEach((b, i) => { if (!slotTasks[b.key]) slotTasks[b.key] = []; slotTasks[b.key].push('🔁 ' + n.text); });
    });
  }
  buckets.forEach((b, i) => {
    const l = load[i];
    const h = Math.max(5, l.val / max * 64);
    const ur = l.cnt ? clamp(Math.round(l.ur / l.cnt), 1, 5) : (l.val > 0 ? 3 : 1);
    const col = l.val > 0 ? urColor(ur) : 'rgba(255,255,255,.10)';
    const isCur = (tnow >= b.start && tnow < b.end);
    const tasks = slotTasks[b.key] ? `<div class="rhythm-tasks" title="${esc(slotTasks[b.key].join(' · '))}">${esc(slotTasks[b.key].slice(0, 2).join(' · '))}${slotTasks[b.key].length > 2 ? '…' : ''}</div>` : '';
    html += `<div class="rcol${isCur ? ' cur' : ''}" title="${b.label}：重要度 ${l.val.toFixed(1)}${l.cnt ? ' · 平均紧急 ' + (l.ur / l.cnt).toFixed(1) : ''}">
      <div class="rbar" style="height:${h}px;background:${col};box-shadow:0 0 10px ${col}55"></div>
      <div class="rmo">${b.label}</div>${b.sub ? `<div class="rsub">${b.sub}</div>` : ''}${tasks}</div>`;
  });
  html += '</div>';
  box.innerHTML = html;
}

/* ============ 今日行动（执行台 · 跨工作流聚合） ============ */
/* v8.11: budgetCap 可传——聚合层按全局日容量 dayCapGlobal() 逐项目递减分配，
   避免「N 个项目各排满各自 dayCap → 合计 N×dayCap 必超全局」的结构性超负荷。 */
function todayExecutionPoolFor(nodes, budgetCap) {
  if (!nodes || !nodes.length) return [];
  computeTree(nodes);
  const leaves = nodes.filter(n => n.parentId && n._children.length === 0 && !n.done && !isNodeParked(n));
  if (!leaves.length) return [];
  const vis = buildView(nodes, 'day');
  const topIds = new Set(pickRanked(vis, 5).map(n => n.id));
  const pool = leaves.filter(n => {
    // v8.7：排到未来的任务（planDate 日期 > 今天）一律不进今日池 —— backfill 顺排到次日/更远的
    // 任务会带 deadlineDate=排期日（daysLeft>=1），否则被下方 daysLeft<=1 / scale=day / 快赢条款
    // 拉回今天，表现为「今日执行混进明天/后天的任务且没有时间」。到当天 normalizeNode 自动
    // planDate→time 转换后再正常进入（此判断必须放最前，先于其他所有纳入条款）。
    const pdk = n.planDate ? String(n.planDate).slice(0, 10) : '';
    if (pdk && pdk > dateKey()) return false;
    if (isRecurringTask(n)) return recurringTaskDueToday(n);
    if (n.recur || n.role === 'habit') return habitDueToday(n);
    if (topIds.has(n.id)) return true;
    if (n.scale === 'day') return true;
    if (n.daysLeft != null && n.daysLeft <= 1) return true;
    if (n.overdue) return true;
    if (n.slot) return true;
    // v7.8: 未来日期的计划时间不再把任务拉进今天——只在排到的那天（或未设期限时）出现
    if (n.time && (n.deadlineDate == null || n.daysLeft == null || n.daysLeft <= 0)) return true;
    if ((n.estimateMinutes || 99) <= 10) return true;
    if (isQuickWin(n)) return true;
    return false;
  });
  const seen = new Set();
  const sorted = [];
  pool.sort((a, b) => {
    const at = topIds.has(a.id) ? 0 : 1, bt = topIds.has(b.id) ? 0 : 1;
    if (at !== bt) return at - bt;
    const ah = a.recur || a.role === 'habit', bh = b.recur || b.role === 'habit';
    if (ah !== bh) return ah ? -1 : 1;
    return focusScore(b) - focusScore(a);
  }).forEach(n => { if (!seen.has(n.id)) { seen.add(n.id); sorted.push(n); } });
  // 今日容量硬约束：估时累计超「每天可投入」后，后续任务标「溢出」降权显示
  let budget = (budgetCap != null) ? budgetCap : dayCap();
  const out = [];
  sorted.forEach(n => {
    ensureEstimate(n, true);
    const est = n.estimateMinutes || 0;
    const habit = n.recur || n.role === 'habit';
    // 习惯不计容量（打卡型），其余计
    // v8.11: 溢出任务留在池里（_overflow 降权 + 「🌊 溢出」行标记），不再无声丢弃——
    // 丢弃会让用户觉得「任务被吞」；消费方按需过滤（heroGlobalCandidates / ICS 已 filter）
    if (!habit && est > budget && out.length) { n._overflow = true; out.push(n); return; }
    n._overflow = false;
    if (!habit) budget -= est;
    out.push(n);
  });
  return out;
}
/* 习惯分轨候选：习惯只作为「今日到期打卡」进入执行台，不竞选 MIT/英雄卡 */
function isHabitEntry(ent) { const n = ent.node || ent; return !!(n.recur || n.role === 'habit'); }
function todayAggregatedPool() {
  ensureWorkflows();
  flushActiveWorkflow();
  const items = [];
  // v8.11: 全局日预算递减分配 —— 当前项目优先，后续项目用剩余预算；
  // 合计天然 ≤ dayCapGlobal()，「超负荷」只在单项目就排不下时出现（真超载）。
  let budgetLeft = dayCapGlobal();
  const wfs = activeWorkflows().slice().sort((a, b) => {  // v6.5: 归档项目不进今日汇总
    if (a.id === state.activeWorkflowId) return -1;
    if (b.id === state.activeWorkflowId) return 1;
    return 0;
  });
  wfs.forEach(wf => {
    if (_wfOnly && wf.id !== state.activeWorkflowId) return;  // v8.7: 「只看当前项目」过滤
    if (!wfStarted(wf)) return;  // v7.9: 未开始的项目（startDate 在未来）不进今日
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    recomputeSchedule(nodes);
    const vis = buildView(nodes, 'day');
    let wfTop = pickTop(vis) || pickTop(nodes);
    // 习惯不抢各流 Top1：若 Top1 是习惯，改取第一个非习惯候选
    if (wfTop && (wfTop.recur || wfTop.role === 'habit')) {
      const alt = pickRanked(vis, 8).find(n => !(n.recur || n.role === 'habit'));
      if (alt) wfTop = alt;
    }
    // 手动固定（日历/英雄卡「📌」）优先于算法排序，仅作用于当前项目
    if (wf.id === state.activeWorkflowId && state.topPin) {
      const pinned = nodes.find(n => n.id === state.topPin && !n.done);
      if (pinned) wfTop = pinned;
    }
    const pool = todayExecutionPoolFor(nodes, budgetLeft);
    pool.forEach(n => {
      // 池内实际占用的预算从全局余量扣减（习惯/溢出不计）
      if (!n._overflow && !(n.recur || n.role === 'habit')) budgetLeft -= (n.estimateMinutes || 0);
      items.push({
        node: n, wfId: wf.id, wfName: wf.name || '目标流',
        isWfTop: !!(wfTop && n.id === wfTop.id),
      });
    });
    // topId 由 syncTop 统一裁定（全页 MIT 同源），这里只标记各流 Top1，不回写
  });
  const seen = new Set();
  const out = [];
  items.sort((a, b) => {
    if (a.isWfTop !== b.isWfTop) return a.isWfTop ? -1 : 1;
    return focusScore(b.node) - focusScore(a.node);
  }).forEach(x => {
    const k = x.wfId + '|' + x.node.id;
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  });
  return out;
}
function dayPlanFeasibilityAll() {
  ensureWorkflows();
  flushActiveWorkflow();
  let est = 0, count = 0;
  // 与今日池同口径：用 todayExecutionPoolFor 的集合算负荷（不再只算 scale=day）
  activeWorkflows().forEach(wf => {  // v7.9: 归档+未开始项目不计
    if (!wfStarted(wf)) return;
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    todayExecutionPoolFor(nodes).forEach(n => {
      if (n.recur || n.role === 'habit') return; // 习惯不计容量
      ensureEstimate(n, true);
      est += (n.estimateMinutes || 0);
      count++;
    });
  });
  // v7.7: 分子是「全部项目」，分母必须同为「全部项目容量」——原先用本项目净余量 dayCap() 会虚报超负荷
  const capAll = dayCapGlobal();
  return { est, act: 0, count, over: est > capAll, cap: capAll };
}
/* v7.7: 全局容量（扣其他项目之前）。跨全部项目汇总估时时必须用它，
   否则「分子=所有项目、分母=当前项目净余量」会天天误报超支。 */
function weekCapGlobal() {
  const g = globalCapacityHours();
  if (g) return Math.round((g.workday * 5 + g.weekend * 2) * 60);
  return weekCap();
}
function dayCapGlobal() {
  const g = globalCapacityHours();
  if (g) return Math.round((g.workday * 5 + g.weekend * 2) / 7 * 60);
  return dayCap();
}
function globalCapacityHours() {
  // v8.21: 从多段空闲时段汇总小时（无时段时 globalTimeWindows 回落旧小时字段）
  const wd = winsTotalHours(globalTimeWindows('workday'));
  const we = winsTotalHours(globalTimeWindows('weekend'));
  return (wd > 0 || we > 0) ? { workday: wd, weekend: we } : null;
}

/* 本周时间预算：跨全部项目统计「本周承诺」估时（日/周尺度、例行、本周到期叶子）。
   est  → 全部项目本周承诺；cap → 全局每周容量（同口径）
   projEst / projCap → 当前项目本周承诺 vs 当前项目净可投入（= 全局 − 其他项目占用） */
function weekPlanFeasibility() {
  ensureWorkflows();
  flushActiveWorkflow();
  const { start, end } = weekRange();
  const inWeek = n => n.scale === 'day' || n.scale === 'week' || n.recur ||
    (n.deadlineDate && n.deadlineDate >= start && n.deadlineDate < end);
  let est = 0, count = 0, projEst = 0, projCount = 0;
  activeWorkflows().forEach(wf => {  // v6.5: 归档项目不进本周承诺
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    const isProj = wf.id === state.activeWorkflowId;
    nodes.filter(n => n.parentId && !n.done && n._children.length === 0).forEach(n => {
      if (!inWeek(n)) return;
      ensureEstimate(n, true);
      const e = n.estimateMinutes || 0;
      est += e; count++;
      if (isProj) { projEst += e; projCount++; }
    });
  });
  const cap = weekCapGlobal(), projCap = weekCap();
  return {
    est, count, cap, over: est > cap, free: cap - est,
    projEst, projCount, projCap, projOver: projEst > projCap, projFree: projCap - projEst,
    global: !!globalCapacityHours(),
  };
}
function warnIfOverCapacity(context) {
  const f = weekPlanFeasibility();
  const c = capacitySettings();
  // 先看当前项目自己的净预算（最贴近用户刚做的动作），再看全局
  if (f.projOver) {
    alert(`⚠️ 本项目本周预算已超支\n\n${context || '当前计划'}所在项目本周承诺约 ${fmtHours(f.projEst)} 小时，而本项目可投入只有 ${fmtHours(f.projCap)} 小时（全局减去其他项目占用后），超出 ${fmtHours(f.projEst - f.projCap)} 小时。\n\n建议：删减/推迟任务、延长项目周期，或在 ⚙ 设置中调整每周投入。`);
    return true;
  }
  // v8.16: 全局分支仅在有全局容量配置时走——无配置时 weekCapGlobal 回落单项目容量，
  // est（全部项目合计）vs cap（单项目）口径错配会假超支弹窗（与今日状态区周预算同根因）
  if (f.over && f.global) {
    const g = globalCapacityHours() || {};
    const wdH = g.workday != null ? g.workday : (c.globalWorkdayHours || c.hoursPerDay || 0);
    const weH = g.weekend != null ? g.weekend : (c.globalWeekendHours || 0);
    alert(`⚠️ 全局本周时间预算已超支\n\n全部项目本周合计约 ${fmtHours(f.est)} 小时，而每周可投入 ${fmtHours(f.cap)} 小时（工作日空闲合计 ${wdH}h × 5 + 周末空闲合计 ${weH}h × 2），超出 ${fmtHours(f.est - f.cap)} 小时。\n\n建议：删减/推迟任务、延长项目周期，或在 ⚙ 设置中调整空闲时段。`);
    return true;
  }
  return false;
}
