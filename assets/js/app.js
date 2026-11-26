"use strict";

/* ============ 主题 / 常量（见 assets/js/gf-tokens.js）============ */
const GF = typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : {};
const PALETTE_UR = GF.PALETTE_UR || ['#5e6ad2', '#3fb9b3', '#4cb782', '#e09a4f', '#eb5757'];
const CAT = GF.CAT || {
  now: { key: 'now', label: '立即做 · 重要且紧急', color: PALETTE_UR[4] },
  core: { key: 'core', label: '核心投入 · 重要不紧急', color: PALETTE_UR[0] },
  distract: { key: 'distract', label: '干扰枝干 · 紧急不重要', color: PALETTE_UR[3] },
  noise: { key: 'noise', label: '噪音 · 不重要不紧急', color: '#7c8295' },
};
const COLORS = GF.COLORS || {};
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
  easy: { label: '顺手活 · 低价值低费力', icon: '🍃', color: '#8a93ab' },
  trap: { label: '陷阱 · 低价值高费力', icon: '🕳', color: PALETTE_UR[3] },
};
const VE_ORDER = ['quick', 'major', 'easy', 'trap'];
const DAY_CAPACITY_MIN = 480; // 日视图可做完性：默认 8 小时容量（⚙ 设置可改）
/* ============ 时间预算（基础设置：每周 N 天 × 每天 M 小时） ============ */
function capacitySettings() {
  const c = (state.meta && state.meta.capacity) || {};
  // v7.5: 全局工作日/周末时间设定
  const globalWorkday = c.globalWorkdayHours || 0;
  const globalWeekend = c.globalWeekendHours || 0;

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
   兼容旧 winStart/winEnd。返回 [{start,end,mins}]；空数组 = 全天可排。 */
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
const FOLD_DEFAULT = { audit: false, stale: false, energy: false }; // false=默认折叠
function foldState() { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) { return {}; } }
function foldOpen(name) { const s = foldState(); return name in s ? !!s[name] : (FOLD_DEFAULT[name] !== false); }
function bindFoldPersist(box, name) {
  const d = box.querySelector('details.fold');
  if (!d) return;
  d.addEventListener('toggle', () => {
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
    estimateMinutes: null, actualMinutes: null, recur: false, scale: null, slot: '', time: '', tags: [], lastRecDone: '',
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
  leaves.filter(n => n.recur).forEach(n => { if (!n.time) n.time = winS; });
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
    if (dk === dateKey()) { n.time = hm; n.planDate = ''; }
    else { n.planDate = dk + 'T' + hm; n.time = ''; }
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

  const overlay = document.getElementById('smartModal');
  if (!overlay) return;

  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">🤖</div>
      <div><div class="mh-tt">AI 拆解不可用</div>
      <div class="mh-sub">${reason ? '原因：' + esc(reason) : '选择手动拆解或配置 AI'}</div></div>
      <div class="mh-x" id="guideClose">×</div>
    </div>
    <div class="guide-body">
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
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" onclick="openSettingsModal();document.getElementById('smartModal').classList.remove('show')">⚙ 调整时间预算</button>
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
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="guideDone">知道了</button>
    </div>
  </div>`;

  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#guideClose').onclick = close;
  overlay.querySelector('#guideDone').onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  // 保存 API Key
  const saveKeyBtn = overlay.querySelector('#guideSaveKey');
  if (saveKeyBtn) {
    saveKeyBtn.onclick = () => {
      const key = overlay.querySelector('#guideApiKey').value.trim();
      if (!key) { alert('请输入 API Key'); return; }
      LLM_KEY = key;
      try { localStorage.setItem(LLM_KEY_STORAGE, key); } catch (e) {}
      close();
      // 重新调用 AI 拆解
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
  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">✅</div>
      <div><div class="mh-tt">${esc(opts.title || '分解完成')}</div>
      <div class="mh-sub">${leaves.length} 个叶子任务 · ${habits.length} 个每日习惯 · ${scheduled.length} 个已排时间</div></div>
      <div class="mh-x" id="airClose">×</div>
    </div>
    <div class="wfm-body">
      ${rows ? `<div class="air-sec"><h4>📅 排期预览${scheduled.length > 10 ? `（前 10 条 / 共 ${scheduled.length} 条）` : ''}</h4><div class="air-list">${rows}</div></div>` : '<div class="hint">未排期——可在任务树手动设置期限与计划时间，AI 分解时会自动落入每日可安排时段。</div>'}
      ${todayRows ? `<div class="air-sec"><h4>☀ 今日安排</h4><div class="air-list">${todayRows}</div></div>` : ''}
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="airGoPlan">📋 查看任务树</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="airGoToday">☀ 今日行动</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#airClose').onclick = close;
  overlay.querySelector('#airGoPlan').onclick = () => { close(); switchView('plan'); };
  overlay.querySelector('#airGoToday').onclick = () => { close(); switchView('today'); };
  overlay.onclick = e => { if (e.target === overlay) close(); };
  // v8.8: 系统通知镜像 —— 页面在后台时分解完成也能看到；未授权给 opt-in 按钮
  const airTitle = opts.title || '分解完成';
  sysNotify('✅ ' + airTitle, `${leaves.length} 个叶子任务 · ${scheduled.length} 个已排时间`);
  sysNotifyOptIn(overlay.querySelector('.modal-foot'), '✅ ' + airTitle, `${leaves.length} 个叶子任务 · ${scheduled.length} 个已排时间`);
}

/* v8.6: AI 分解失败弹窗 —— toast 6 秒消失看不到，失败必须弹窗（用户要求）。
   opts: { cancelledProject='已回滚删除的项目名', fallbackTpl=已自动回落的模板 } */
function showAIErrorModal(reason, rawSnippet, opts) {
  const overlay = document.getElementById('smartModal');
  if (!overlay) return;
  opts = opts || {};
  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">❌</div>
      <div><div class="mh-tt">AI 分解失败</div>
      <div class="mh-sub">已记入「AI 视图 · 使用历史」，可随时回看</div></div>
      <div class="mh-x" id="aierrClose">×</div>
    </div>
    <div class="wfm-body">
      <div class="aierr-reason">⚠️ ${esc(reason || '未知错误')}</div>
      ${opts.cancelledProject ? `<div class="hint">项目「${esc(opts.cancelledProject)}」已自动取消（空项目不留垃圾）。可重新创建后重试。</div>` : ''}
      ${opts.fallbackTpl ? `<div class="aierr-fallback">${opts.fallbackTpl.icon} 已自动改用「${esc(opts.fallbackTpl.name)}」模板生成任务树——不耗 API 额度，可直接在「目标规划」查看调整。</div>` : ''}
      ${rawSnippet ? `<details class="ai-history-raw"><summary>🔍 AI 原始返回片段（诊断用）</summary><pre>${esc(rawSnippet)}</pre></details>` : ''}
      <div class="hint">常见原因：API Key 无效/过期（401）、账户余额不足（402）、触发限流（429）、网络异常。配置见「AI 视图 → AI 配置」。</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="aierrGoHistory">📜 查看 AI 使用历史</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="aierrDone">关闭</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#aierrClose').onclick = close;
  overlay.querySelector('#aierrDone').onclick = close;
  overlay.querySelector('#aierrGoHistory').onclick = () => { close(); switchView('ai'); };
  overlay.onclick = e => { if (e.target === overlay) close(); };
  // v8.8: 系统通知镜像 —— 失败更要让系统层可见；未授权给 opt-in 按钮
  sysNotify('❌ AI 分解失败', reason || '未知错误');
  sysNotifyOptIn(overlay.querySelector('.modal-foot'), '❌ AI 分解失败', reason || '未知错误');
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
  const overlay = document.getElementById('workflowMetaModal');
  if (!overlay) return;

  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">🔑</div>
      <div><div class="mh-tt">配置 AI 分解</div>
      <div class="mh-sub">需要 DeepSeek API Key 来自动分解目标</div></div>
      <div class="mh-x" id="apiKeyClose">×</div>
    </div>
    <div class="wfm-body">
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
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="apiKeySave">💾 保存并开始分解</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="apiKeySkip">跳过，手动输入</button>
    </div>
  </div>`;

  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };

  overlay.querySelector('#apiKeyClose').onclick = close;
  overlay.querySelector('#apiKeySkip').onclick = () => {
    close();
    switchView('plan');
  };
  overlay.querySelector('#apiKeySave').onclick = () => {
    const key = overlay.querySelector('#apiKeyInput').value.trim();
    if (!key) { alert('请输入 API Key'); return; }
    LLM_KEY = key;
    try { localStorage.setItem(LLM_KEY_STORAGE, key); } catch (e) {}
    close();
    // 重新调用自动分解
    autoDecomposeGoal(goalText, projectMeta);
  };
  overlay.onclick = e => { if (e.target === overlay) close(); };
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
  const overlay = document.getElementById('weekReviewModal');
  if (!overlay) return;
  const k = wfLeafCountsAll(w.nodes);
  overlay.innerHTML = `<div class="modal gf-modal" style="max-width:440px">
    <div style="text-align:center;padding:26px 18px 18px">
      <div style="font-size:44px;line-height:1">🎉</div>
      <h2 style="margin:12px 0 6px;font-size:19px">${esc(w.name || '未命名项目')} · 完成！</h2>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px">${k.t} 个叶子全部落地。完成仪式的闭环，会强化「我能做成事」的自我效能。</p>
      <p style="color:var(--muted);font-size:12px;margin:0 0 18px">项目已移入归档区（侧栏底部），只读可查，不再进入今日汇总。</p>
      <button type="button" class="gf-btn gf-btn--primary" id="archClose">收下这份完成</button>
    </div>
  </div>`;
  overlay.style.display = 'block';
  overlay.querySelector('#archClose').onclick = () => { overlay.style.display = 'none'; };
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
function confirmModal(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const overlay = document.getElementById('smartModal');
    if (!overlay) { try { resolve(window.confirm(opts.text || '确定？')); } catch (e) { resolve(false); } return; }
    overlay.innerHTML = `<div class="modal" role="dialog">
      <div class="modal-head">
        <div class="mh-ic">${esc(opts.icon || '⚠️')}</div>
        <div><div class="mh-tt">${esc(opts.title || '确认操作')}</div></div>
        <div class="mh-x" id="cfmClose">×</div>
      </div>
      <div class="wfm-body">
        <div class="cfm-text">${esc(opts.text || '')}</div>
        ${opts.sub ? `<div class="hint">${esc(opts.sub)}</div>` : ''}
      </div>
      <div class="modal-foot">
        <button type="button" class="gf-btn gf-btn--primary${opts.danger ? ' gf-btn--danger' : ''}" id="cfmOk">${esc(opts.okText || '确定')}</button>
        <button type="button" class="gf-btn gf-btn--ghost" id="cfmCancel">${esc(opts.cancelText || '取消')}</button>
      </div>
    </div>`;
    overlay.classList.add('show');
    const done = v => { overlay.classList.remove('show'); overlay.innerHTML = ''; resolve(v); };
    overlay.querySelector('#cfmOk').onclick = () => done(true);
    overlay.querySelector('#cfmCancel').onclick = () => done(false);
    overlay.querySelector('#cfmClose').onclick = () => done(false);
    overlay.onclick = e => { if (e.target === overlay) done(false); };
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
  const overlay = document.getElementById('workflowMetaModal');
  if (!overlay) return;
  // v8.5 修复：overlay 是复用元素，dataset.tpl 不随 innerHTML 清除——
  // 残留会导致「上次点过模板，之后每次创建都走模板分支、AI 分解永远不触发」
  delete overlay.dataset.tpl;
  ensureWorkflows();
  const isNew = mode === 'create';
  const w = isNew ? null : workflowById(wfId || state.activeWorkflowId);
  const name = isNew ? '' : (w && w.name || '');
  const tags = isNew ? '' : ((w && w.tags) || []).join(', ');
  const sd = isNew ? '' : (w && w.startDate || '');
  const ed = isNew ? '' : (w && w.endDate || '');
  const desc = isNew ? '' : (w && w.description || '');
  overlay.innerHTML =`<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">📁</div>
      <div><div class="mh-tt">${isNew ? '新建项目' : '项目设置'}</div><div class="mh-sub">项目 = 一棵目标树 / 一个工作流，可长期维护</div></div>
      <div class="mh-x" id="wfmClose">×</div>
    </div>
    <div class="wfm-body">
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
        <div class="wfm-wins-h"><span>每日可安排时段（可多段）</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="wfmWinAdd">＋ 添加时段</button></div>
        <div id="wfmWinsList"></div>
        <div class="hint">有的项目只能在固定碎片时间做（如 副业 19:00 起 3 小时 + 午休 12:30 起 1 小时）——AI 排期只落在这些时段内。留空 = 全天可排。</div>
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
      <div class="hint" style="margin:-4px 0 0">计划带宽 = 你「打算」投入的精力占比，桑基图上会与近 7 天实际投入对比。</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="wfmSave">${isNew ? '创建项目' : '保存'}</button>
      ${!isNew && w ? '<button type="button" class="gf-btn gf-btn--ghost" id="wfmDelete">删除项目</button>' : ''}
      <button type="button" class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="wfmCancel">取消</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#wfmClose').onclick = close;
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
    const initWins = isNew ? [] : wfTimeWindows(capId);
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
    const wins = readWins();
    if (wins === null) { alert('每日可安排时段：每行都要填「开始时间 + 时长」，不用的行请删掉'); return; }
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
        setTimeout(() => {
          if (confirm('项目已创建。现在去「目标规划」手动输入目标？')) switchView('plan');
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
  const overlay = document.getElementById('projectModal');
  if (!overlay) return;
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
  overlay.innerHTML = `<div class="modal modal-wide" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">📁</div>
      <div><div class="mh-tt">${esc(w.name || '未命名项目')}</div>
      <div class="mh-sub">${tagChips || ''} ${range} ${w.description ? (' · ' + esc(w.description)) : ''}</div></div>
      <div class="mh-x" id="poClose">×</div>
    </div>
    <div class="po-body">
      <div class="po-row"><span>整体完成</span><div class="wf-prog po-prog"><i style="width:${pct}%"></i><span>${pct}%</span></div><span class="po-num">${k.d}/${k.t} 叶</span></div>
      <div class="po-row"><span>今日待办</span><b>${todayN}</b><span class="po-dim">项（在今日行动执行）</span></div>
      <div class="po-row"><span>近 7 天执行</span><b>${st.done}</b><span class="po-dim">项 · 预估 ${st.est}′ / 实计 ${st.act}′${st.est ? ` · 偏差 ${st.act - st.est >= 0 ? '+' : ''}${st.act - st.est}′` : ''}</span></div>
      ${streaks.length ? `<div class="po-sec">习惯连续</div>${streaks.map(s => `<div class="po-streak">🔥 ${esc(s.text)} <b>${s.cur} 天</b><span class="po-dim">最佳 ${s.best}</span></div>`).join('')}` : ''}
      ${branches ? `<div class="po-sec">分支进度</div>${branches}` : '<div class="hint">还没有目标树——点「重新规划」按必经步骤自动生成。</div>'}
    </div>
    <div class="modal-foot">
      <button type="button" class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="poPlan">🗺 重新规划（必经步骤向导）</button>
      <button type="button" class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="poEdit">✎ 项目设置</button>
      <button type="button" class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="poCancel">关闭</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#poClose').onclick = close;
  overlay.querySelector('#poCancel').onclick = close;
  overlay.querySelector('#poEdit').onclick = () => { close(); openWorkflowMetaModal('edit', w.id); };
  overlay.querySelector('#poPlan').onclick = () => { close(); openPlanWizard(w.id); };
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
/* 项目切换器：移动端的项目列表入口（切换 / 总览 / 编辑 / 新建） */
function openProjectSwitcher() {
  const overlay = document.getElementById('projectsModal');
  if (!overlay) return;
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
        <span class="wf-dot" style="background:${w.color || 'var(--accent)'}"></span>
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
  overlay.innerHTML = `<div class="modal modal-wide" role="dialog">
    <div class="modal-head"><div class="mh-ic">🗂</div>
      <div><div class="mh-tt">项目</div><div class="mh-sub">切换当前编辑项目 · 今日行动跨项目聚合</div></div>
      <span class="mh-x" id="psClose">×</span>
    </div>
    <div class="ps-body">${rows || '<div class="hint">还没有项目——点下方「新建项目」开始。</div>'}</div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="psAdd">＋ 新建项目</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="psCancel">关闭</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#psClose').onclick = close;
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
  overlay.onclick = e => { if (e.target === overlay) close(); };
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
  const overlay = document.getElementById('planWizardModal');
  if (!overlay) return;
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
  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">🗺</div>
      <div><div class="mh-tt">必经步骤向导 · ${esc(w ? w.name : '')}</div>
      <div class="mh-sub">按「里程碑 → 例行 → 习惯 → 今日行动」自动生成规划；每行一条，可删改，前缀决定类型</div></div>
      <div class="mh-x" id="pwClose">×</div>
    </div>
    <div class="wfm-body">
      <label class="wfm-row"><span>总目标</span><input id="pwGoal" class="gf-input" value="${esc(root.text)}"></label>
      <label class="wfm-row"><span>目标达成日期（里程碑将均匀排期）</span><input id="pwDate" type="date" class="gf-input" value="${esc(tgt)}"></label>
      <label class="wfm-row"><span>必经步骤（【里程碑】【例行】【习惯】【行动】+ 内容）</span><textarea id="pwSteps" class="gf-input" rows="8">${esc(lines)}</textarea></label>
      <div class="hint">生成后：里程碑→按月排期进规划；例行→每周节奏；习惯→今日打卡；行动→今日行动清单。</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="pwGen">✨ 生成规划</button>
      <button type="button" class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="pwCancel">取消</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#pwClose').onclick = close;
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
      node.deadlineDate = dd; node.deadline = `${dd.getMonth() + 1}月${dd.getDate()}日前`;
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
  if (!timeStr) { n.remindAt = null; n._remindOff = dateKey(); save(); return; }  // v8.2: 手动清空当天不再自动回填
  const p = String(timeStr).split(':');
  const hh = +p[0] || 0, mm = +p[1] || 0;
  const d = today0();
  d.setHours(clamp(hh, 0, 23), clamp(mm, 0, 59), 0, 0);
  n.remindAt = d.getTime();
  n._remindOff = '';
  save();
}
/* v8.2: 有「计划时间」的今日任务自动带提醒 = 开始前 5 分钟（可改可清；手动清空当天不回填）。
   挂在 renderToday：AI 排期 / 手动设 time 后，提醒跟着出现，到点弹通知。 */
function ensureRemindDefaults(nodes) {
  const dk = dateKey();
  let dirty = false;
  (nodes || []).forEach(n => {
    if (!n) return;
    if (n._remindOff && n._remindOff !== dk) { n._remindOff = ''; dirty = true; }  // 换天重置
    if (n.done || n.remindAt || !n.time || n._remindOff) return;
    const mins = hmToMin(n.time) - 5;
    if (mins < 0) return;
    const d = today0();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    n.remindAt = d.getTime();
    dirty = true;
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
  return true;
}
/* v8.10: 跨午夜自愈 —— TODAY 此前只在启动时赋值，页面挂着过夜后「今日」面板/清单/MIT/日期全停在昨天，
   勾选完成还会记进昨天的日志。30s 轮询与唤醒补跑时检查，换天即刷新 TODAY、把到期 planDate 转 time 并重渲染。 */
function refreshTodayIfNeeded() {
  const now = new Date();
  if (dateKey(now) === dateKey()) return false;
  TODAY = now;
  (state.workflows || []).forEach(w => (w.nodes || []).forEach(convertDuePlanDate));
  save();
  afterChange();
  return true;
}
function normalizeNode(n) {
  if (n.slot == null) n.slot = '';
  if (n.time == null) n.time = '';
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
    parentId: n.parentId, slot: n.slot || '', time: n.time || '', planDate: n.planDate || '', tags: Array.isArray(n.tags) ? n.tags : [], lastRecDone: n.lastRecDone || '',
    _remindOff: n._remindOff || ''
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
    tl.innerHTML = html || '<div class="ht-empty">还没有完成记录 · 在今日清单勾选任务后，这里会留下时间线</div>';
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

function render() {
  const svg = document.getElementById('diagram-svg');
  const nodes = state.nodes;
  if (!nodes.length) { svg.innerHTML = ''; svg.setAttribute('viewBox', '0 0 100 100'); svg.removeAttribute('width'); svg.removeAttribute('height'); return; }
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
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#f5c451" flood-opacity="0.95"/>
    </filter>
    <filter id="softglow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${COLORS.svgGlow || '#5b9fd4'}" flood-opacity="0.5"/>
    </filter>`;
  vis.forEach(n => {
    if (!n.parentId) return;
    const p = map[n.parentId]; if (!p) return;
    const id = 'g_' + n.id;
    const isGold = goldEdges.has(p.id + '>' + n.id);
    if (isGold) {
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f5c451"/><stop offset="1" stop-color="#ffd97a"/></linearGradient>`;
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
      fill="${isNoise ? '#7c8295' : `url(#${id})`}" opacity="${op}" ${isGold ? 'filter="url(#glow)"' : ''}></path>`;
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
    const scaleTag = (n.scale && n.scale !== 'long') ? { t: SCALE_LABEL[n.scale] || '', cls: 'nlabel sub', col: COLORS.scaleLabel || '#7eb8e0' } : null;
    nodesSvg += `<g class="node${isTop ? ' hot' : ''}" data-id="${n.id}">
      <rect class="nbar" x="${n._x}" y="${n._y}" width="${NODEW}" height="${n._h}" rx="5"
        fill="${barFill}" stroke="${stroke}" stroke-width="${sw}" ${filt}
        opacity="${n.done ? 0.35 : 1}"></rect>`;
    const lines = wrapLabel(n.text);
    const isLeaf = (n._vc.length === 0);
    const dlLine = (n.deadline && !n.done) ? (n.overdue ? `逾期${-n.daysLeft}天` : `${n.deadline}·剩${n.daysLeft}天`) : null;
    const all = [{ t: (n.done ? '✓ ' : '') + lines[0], cls: 'nlabel' }];
    for (let i = 1; i < lines.length; i++) all.push({ t: lines[i], cls: 'nlabel' });
    if (dlLine) all.push({ t: '⏱ ' + dlLine, cls: 'nlabel sub', col: n.overdue ? '#ef5d6b' : '#8a93ab' });
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
  if (!nodes.length) { svg.innerHTML = ''; svg.setAttribute('viewBox', '0 0 100 100'); svg.removeAttribute('width'); svg.removeAttribute('height'); return; }
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
    const stroke = isTopChain ? '#f5c451' : urColor(n.ur);
    const sw = isTopChain ? 2.4 : 1.2;
    const op = n.done ? 0.2 : 0.55;
    edges += `<line class="net-edge${isTopChain ? ' hot' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${op}"/>`;
  });
  vis.forEach(n => {
    const cx = n._x + NODEW / 2, cy = n._y + n._h / 2;
    const r = Math.max(7, Math.min(16, 6 + n.im * 1.6));
    const isTop = (n.id === topId);
    const inGold = topId && (function () { let c = byId(topId); while (c) { if (c.id === n.id) return true; c = c.parentId ? byId(c.parentId) : null; } return false; })();
    const fill = inGold ? '#f5c451' : (category(n.im, n.ur).color);
    const stroke = isTop ? '#fff' : (inGold ? '#ffd97a' : 'rgba(255,255,255,.35)');
    const sw = isTop ? 2 : 1;
    dots += `<g class="node${isTop ? ' hot' : ''}" data-id="${n.id}">
      <circle class="nbar" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${n.done ? 0.35 : 0.92}" stroke="${stroke}" stroke-width="${sw}" ${isTop || inGold ? 'filter="url(#glow)"' : ''}/>
      <text class="nlabel" x="${cx + r + 8}" y="${cy + 4}" font-size="12">${esc(wrapLabel(n.text)[0])}</text>
    </g>`;
  });
  const defs =`<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#f5c451" flood-opacity="0.9"/></filter></defs>`;
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
      e.innerHTML = `<div class="empty-state">
        <div style="font-size:24px;margin-bottom:4px">${QUAD[q].icon}</div>
        <div>拖任务卡到${QUAD[q].label.split('·')[0]}</div>
      </div>`;
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
  el.innerHTML = `<div class="pomo-inner"><b>${paused ? '⏸ 已暂停' : pomoMode}</b><span class="pomo-task">${esc((n && n.text) || '')}</span><span class="pomo-t">${pad2(m)}:${pad2(s)}</span><span class="pomo-pct">${pct}%</span>
    <div class="pomo-prog"><i style="width:${pct}%"></i></div>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pomoPause">${paused ? '▶ 继续' : '⏸ 暂停'}</button>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pomoStop">结束</button></div>`;
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
  const catMeta = [['core', '核心', PALETTE_UR[0]], ['now', '救火', PALETTE_UR[4]], ['distract', '干扰', PALETTE_UR[3]], ['noise', '噪音', '#7c8295']];
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
function renderTodayStale() {
  const box = document.getElementById('todayStale'); if (!box) return;
  const alerts = stagnationAlerts(STALE_DAYS);
  if (!alerts.length) { box.innerHTML = ''; return; }
  const rows = alerts.slice(0, 2).map(a =>
    `<div class="stale-row"><span class="stale-t" title="${esc(a.node.text)}">${esc(a.node.text.length > 18 ? a.node.text.slice(0, 18) + '…' : a.node.text)}</span>
     <span class="stale-m">${a.days >= 999 ? '从未激活' : a.days + ' 天无动静'} · ${esc(a.wfName)}</span>
     <button type="button" class="gf-btn gf-btn--sm" data-stale="${a.node.id}" data-wf="${a.wfId}" title="钉入今日清单并标记激活">⚡ 激活到今日</button></div>`).join('');
  box.innerHTML = `<details class="fold warn" data-fold="stale"${foldOpen('stale') ? ' open' : ''}>
    <summary>⚠️ 停滞预警<span class="fold-sum">${alerts.length} 项 ${STALE_DAYS} 天+ 无动静</span></summary>
    <div class="fold-body"><div class="today-stale">${rows}</div></div>
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

function renderMetricsStrip() {
  const el = document.getElementById('metricsStrip'); if (!el) return;
  const krs = state.nodes.filter(n => (n.role === 'KR' || n.role === 'habit' || n.targetNum > 0) && n.parentId).slice(0, 8);
  const lp = leafProgress();
  const top = state.topId ? byId(state.topId) : null;
  const imp = top ? focusScore(top) : 0;
  const mom = weeklyMomentum();
  if (!state.nodes.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  const spark = mom.byDay.map(d => {
    const h = Math.min(14, 2 + d.count * 3);
    return `<span class="ms-spark" title="${d.key}：完成 ${d.count} 项" style="height:${h}px"></span>`;
  }).join('');
  // v8.0 UX 精简：默认只留 2 个关键 pill（叶子进度 + 本周动量）；KR/目标 pill 收进「指标」折叠
  const corePills = [
    lp ? `<span class="ms-pill">叶子 <b>${lp.pct}%</b> <small>${lp.done}/${lp.total}</small></span>` : '',
    `<span class="ms-pill ms-mom" title="近 7 天勾选叶子 · 写入执行记录 JSON">本周完成 <b>${mom.done}</b> · 估 ${mom.est}′ / 实 ${mom.act}′ <span class="ms-sparks">${spark}</span></span>`,
  ].filter(Boolean);
  const krPills = krs.map(n => {
    const mp = metricProgress(n); if (!mp) return '';
    const pace = paceStatus(n);
    const tag = n.role === 'habit' ? '习惯' : (n.role === 'KR' ? 'KR' : '目标');
    const confBtn = n.role === 'KR'
      ? ` <button type="button" class="ms-conf" data-confkr="${n.id}" title="KR 信心打卡（每周一次）：当前信心 ${n.conf ? n.conf + '/5' : '未评'}${n.confNote ? ' · ' + esc(n.confNote) : ''}">${n.conf ? '💪' + n.conf : '💪'}</button>`
      : '';
    return `<span class="ms-pill" title="${esc(n.text)}${n.role === 'KR' ? ' · 信心 ' + (n.conf || '—') + '/5' : ''}">${tag} ${mp.done}/${mp.tgt} <b>${mp.pct}%</b>${pace ? ` · Δ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}` : ''}${confBtn}</span>`;
  }).filter(Boolean);
  el.innerHTML = `<div class="metrics-strip">${corePills.join('')}${krPills.length ? `<details class="ms-kr-fold"><summary>指标 ${krPills.length} ▾</summary><div class="ms-kr-body">${krPills.join('')}</div></details>` : ''}</div>`;
  // KR 信心打卡：进度数字之外，再问「你有多大把握」
  el.querySelectorAll('[data-confkr]').forEach(b => b.onclick = () => {
    const n = byId(b.dataset.confkr); if (!n) return;
    const v = prompt(`「${n.text.slice(0, 24)}」\n当前信心 1–5（5 = 稳了，1 = 悬）：`, n.conf || '');
    if (v === null) return;
    const c = clamp(Math.round(+v) || 0, 0, 5);
    if (!c) return;
    const note = prompt('一句话：为什么是这个信心？（可选）', n.confNote || '') || '';
    n.conf = c; n.confNote = note.trim(); n.confAt = Date.now();
    save(); renderMetricsStrip();
  });
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
  const c = (state.meta && state.meta.capacity) || {};
  const wd = +c.globalWorkdayHours || 0, we = +c.globalWeekendHours || 0;
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
  if (f.over) {
    alert(`⚠️ 全局本周时间预算已超支\n\n全部项目本周合计约 ${fmtHours(f.est)} 小时，而每周可投入 ${fmtHours(f.cap)} 小时（工作日 ${c.globalWorkdayHours || c.hoursPerDay}h × 5 + 周末 ${c.globalWeekendHours || 0}h × 2），超出 ${fmtHours(f.est - f.cap)} 小时。\n\n建议：删减/推迟任务、延长项目周期，或在 ⚙ 设置中调整每周投入。`);
    return true;
  }
  return false;
}
function openSettingsModal() {
  const overlay = document.getElementById('settingsModal');
  if (!overlay) return;
  const c = capacitySettings();
  const globalC = (state.meta && state.meta.capacity) || {};
  const otherUsage = getOtherProjectsTimeUsage();

  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">⚙</div>
      <div><div class="mh-tt">基础设置 · 时间预算</div>
      <div class="mh-sub">全局设定每周可投入的时间，系统会自动减去其他项目已占用的时间</div></div>
      <div class="mh-x" id="setClose">×</div>
    </div>
    <div class="wfm-body">
      <div class="wfm-section">
        <h4>🌍 全局时间设定</h4>
        <div class="wfm-2col">
          <label class="wfm-row"><span>工作日（每天小时）</span><input id="setGlobalWorkday" type="number" min="0" max="16" step="0.5" class="gf-input" value="${globalC.globalWorkdayHours || ''}" placeholder="如 2"></label>
          <label class="wfm-row"><span>周末（每天小时）</span><input id="setGlobalWeekend" type="number" min="0" max="16" step="0.5" class="gf-input" value="${globalC.globalWeekendHours || ''}" placeholder="如 4"></label>
        </div>
      </div>

      <div class="wfm-section">
        <h4>📊 其他项目占用</h4>
        <div class="set-usage-info">
          <div class="usage-row">
            <span>工作日已占用</span>
            <b>${otherUsage.workdayPerDay} 小时/天</b>
          </div>
          <div class="usage-row">
            <span>周末已占用</span>
            <b>${otherUsage.weekendPerDay} 小时/天</b>
          </div>
          <div class="usage-row total">
            <span>每周总占用</span>
            <b>${fmtHours(otherUsage.weekTotal)} 小时</b>
          </div>
        </div>
      </div>

      <div class="wfm-section">
        <h4>✅ 当前项目可用</h4>
        <div class="set-available-info">
          <div class="usage-row">
            <span>工作日可用</span>
            <b>${c.workdayHours} 小时/天</b>
          </div>
          <div class="usage-row">
            <span>周末可用</span>
            <b>${c.weekendHours} 小时/天</b>
          </div>
          <div class="usage-row total">
            <span>每周可用</span>
            <b>${fmtHours(weekCap())} 小时</b>
          </div>
        </div>
      </div>

      <div class="wfm-section">
        <h4>🧮 口径核对</h4>
        <div class="set-usage-info">
          <div class="usage-row">
            <span>全局每周容量</span>
            <b>${fmtHours(weekCapGlobal())} 小时</b>
          </div>
          <div class="usage-row">
            <span>其他项目占用</span>
            <b>${fmtHours(otherUsage.weekTotal)} 小时</b>
          </div>
          <div class="usage-row total">
            <span>本项目净可投入</span>
            <b>${fmtHours(weekCap())} 小时</b>
          </div>
        </div>
      </div>

      <div class="wfm-section">
        <h4>💾 数据安全 · 自动备份</h4>
        <div class="hint" style="margin-bottom:8px">每次保存自动留滚动快照（最近 ${SNAP_KEEP} 份，每小时一份），可随时回滚。绑定本地文件后还会自动落盘——该文件可交给 Syncthing / 网盘同步，实现多设备 local-first 同步。</div>
        <div class="set-snap-list" id="setSnapList"></div>
        <div class="set-fs-row">
          <span class="set-fs-status" id="setFsStatus">检测中…</span>
          <button type="button" class="gf-btn gf-btn--sm" id="setFsBind">绑定文件</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setFsLoad">从文件恢复</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setFsUnbind">解除</button>
        </div>
      </div>

      <div class="hint">影响：今日「可做完性」与「本周总预算」按全局容量校验（分子同样是全部项目），「本项目预算」按本项目净可投入校验；新增任务超预算会即时警告。</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="setSave">保存设置</button>
      <button type="button" class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="setCancel">取消</button>
    </div>
  </div>`;
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };

  overlay.querySelector('#setClose').onclick = close;
  overlay.querySelector('#setCancel').onclick = close;
  overlay.querySelector('#setSave').onclick = () => {
    if (!state.meta) state.meta = {};
    if (!state.meta.capacity) state.meta.capacity = {};

    const globalWorkday = parseFloat(overlay.querySelector('#setGlobalWorkday').value) || 0;
    const globalWeekend = parseFloat(overlay.querySelector('#setGlobalWeekend').value) || 0;

    state.meta.capacity.globalWorkdayHours = globalWorkday;
    state.meta.capacity.globalWeekendHours = globalWeekend;

    saveMeta(); close(); afterChange();
    showToast('✅ 时间预算已保存');
  };
  // 数据安全：滚动快照列表 + 文件落盘绑定
  const snapBox = overlay.querySelector('#setSnapList');
  const renderSnaps = () => {
    const snaps = listSnapshots();
    snapBox.innerHTML = snaps.length
      ? snaps.map(s => {
        const d = new Date(s.at);
        const cnt = (() => { try { const p = JSON.parse(s.payload); return (p.workflows || []).reduce((a, w) => a + (w.nodes || []).length, 0); } catch (e) { return '?'; } })();
        return `<div class="set-snap-row"><span class="set-snap-t">${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}</span><span class="set-snap-m">${cnt} 节点</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-snap="${s.at}">↩ 恢复</button></div>`;
      }).join('')
      : '<div class="hint">暂无快照（保存后自动生成）。</div>';
    snapBox.querySelectorAll('[data-snap]').forEach(b => b.onclick = () => { restoreSnapshot(+b.dataset.snap); close(); });
  };
  renderSnaps();
  const fsStatus = overlay.querySelector('#setFsStatus');
  fsStatusText().then(t => { if (fsStatus) fsStatus.textContent = t; });
  overlay.querySelector('#setFsBind').onclick = async () => { await chooseBackupFile(); fsStatusText().then(t => { if (fsStatus) fsStatus.textContent = t; }); };
  overlay.querySelector('#setFsLoad').onclick = () => fsLoadFromFile();
  overlay.querySelector('#setFsUnbind').onclick = async () => { await fsUnbind(); fsStatusText().then(t => { if (fsStatus) fsStatus.textContent = t; }); };
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
/* 今日行级 CRUD：直接改目标 wf.nodes，不切换当前流（避免覆盖规划文本框） */
function editTodayNode(wfId, id, text) {
  const w = workflowById(wfId);
  const n = w && (w.nodes || []).find(x => x.id === id);
  const t = String(text || '').trim();
  if (!n || !t || t === n.text) return;
  n.text = t; applySuggestions(n, t);
  const sc = inferScale(t, n.deadlineDate, n.daysLeft, w.nodes.some(x => x.parentId === id));
  // 无关键词的兜底推断（month）不应把今日任务踢出今日清单
  n.scale = (sc === 'month' && !n.deadlineDate && (n.scale === 'day' || n.slot)) ? n.scale : sc;
  recomputeSchedule(w.nodes); save(); afterChange();
}
function deleteTodayNode(wfId, id) {
  const w = workflowById(wfId);
  if (!w || !w.nodes || !w.nodes.length) return;
  const root = w.nodes[0];
  if (id === root.id) return;
  // v8.10: 统一走 deleteNode —— 此前是独立实现，只快照 nodes/topId，删除后大石头/明晚预选/习惯打卡/
  // topPin/番茄钟全部成孤儿引用，undo 也不还原引用（v8.9 审计盲区：只查了 state.nodes= 赋值点，漏了 w.nodes= 直改）
  const prevWf = state.activeWorkflowId;
  if (wfId !== prevWf) switchWorkflow(wfId);
  deleteNode(id);
  if (state.activeWorkflowId !== prevWf && workflowById(prevWf)) switchWorkflow(prevWf);
}
function addTodayNode(wfId, opts) {
  opts = opts || {};
  const w = workflowById(wfId);
  if (!w || !w.nodes || !w.nodes.length) return;
  const root = w.nodes[0];
  let maxId = w.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);
  const text = opts.habit ? '每天新习惯（点文字编辑）' : '新任务（点文字编辑）';
  const node = newNode({ id: 'n' + (++maxId), text, im: Math.min(5, root.im || 3), ur: 3, parentId: root.id, scale: 'day', source: 'insert' });
  if (opts.habit) { node.role = 'habit'; node.slot = 'h1'; node.estimateMinutes = 10; node.ur = 2; }
  else { node.estimateMinutes = 30; if (opts.slot) node.slot = opts.slot; }
  w.nodes.push(node);
  recomputeSchedule(w.nodes); save(); afterChange();
}
/* ============ 习惯编辑器（独立输入 + 灵活周期规划） ============ */
const HABIT_TYPES = [
  ['daily', '每天'],
  ['weekdays', '仅工作日（周一至周五）'],
  ['weekends', '仅周末（周六日）'],
  ['weekly', '每周指定几天'],
  ['interval', '每隔 N 天'],
  ['monthly', '每月指定日'],
  ['timesPerWeek', '每周 N 次（不限哪天）'],
];
function openHabitEditor(wfId, nodeId, taskMode) {
  const overlay = document.getElementById('habitModal'); if (!overlay) return;
  ensureWorkflows();
  const w = workflowById(wfId) || workflowById(state.activeWorkflowId);
  if (!w || !(w.nodes || []).length) { showToast('⚠️ 请先在「目标规划」解析一个目标，再添加习惯'); return; }
  const editing = nodeId ? (w.nodes.find(n => n.id === nodeId) || null) : null;
  const r = editing ? habitRecurrence(editing) : { type: 'daily' };
  const days = r.days || [1, 3, 5];
  const wdChecks = WD_LABEL.map((l, i) => `<label class="hb-wd"><input type="checkbox" data-hbwd="${i}"${days.indexOf(i) >= 0 ? ' checked' : ''}><span>${l}</span></label>`).join('');
  const typeOpts = HABIT_TYPES.map(([k, l]) => `<option value="${k}"${r.type === k ? ' selected' : ''}>${l}</option>`).join('');
  const ttl = taskMode ? '循环周期' : (editing ? '编辑习惯' : '新建习惯');
  const sub = taskMode ? '给任务设循环 · 到期日自动出现在今日清单，完成本次后自动排下次' : '习惯贵在简单重复 · 选一种循环方式，到期日自动出现在今日打卡';
  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><div class="mh-ic">🔁</div>
      <div><div class="mh-tt">${ttl}</div>
      <div class="mh-sub">${sub}</div></div>
      <div class="mh-x" id="hbClose">×</div></div>
    <div class="wfm-body">
      <label class="wfm-row"><span>${taskMode ? '任务名称' : '习惯名称'}</span><input id="hbText" class="gf-input" value="${esc(editing ? editing.text : '')}" placeholder="如：冥想 / 阅读 / 拉伸"></label>
      <label class="wfm-row"><span>循环方式</span><select id="hbType" class="gf-input gf-select">${typeOpts}</select></label>
      <div class="wfm-row hb-sub" id="hbWeekly" style="display:${r.type === 'weekly' ? 'flex' : 'none'}"><span>每周哪几天</span><div class="hb-wds">${wdChecks}</div></div>
      <label class="wfm-row hb-sub" id="hbInterval" style="display:${r.type === 'interval' ? 'flex' : 'none'}"><span>每隔几天</span><input id="hbIntervalN" type="number" min="1" max="60" class="gf-input" value="${r.interval || 2}"></label>
      <label class="wfm-row hb-sub" id="hbMonthly" style="display:${r.type === 'monthly' ? 'flex' : 'none'}"><span>每月几号</span><input id="hbMonthDay" type="number" min="1" max="31" class="gf-input" value="${r.dayOfMonth || 1}"></label>
      <label class="wfm-row hb-sub" id="hbTimes" style="display:${r.type === 'timesPerWeek' ? 'flex' : 'none'}"><span>每周几次</span><input id="hbTimesN" type="number" min="1" max="7" class="gf-input" value="${r.times || (editing && editing.timesPerWeek) || 3}"></label>
      <div class="wfm-2col">
        <label class="wfm-row"><span>计划时间（可选）</span><input id="hbTime" type="time" class="gf-input" value="${(editing && editing.time) || ''}" title="每天几点做 · 今日清单按此排序，不会弹提醒"></label>
        <label class="wfm-row"><span>预计时长（分钟）</span><input id="hbEst" type="number" min="1" max="999" step="5" class="gf-input" value="${editing ? (editing.estimateMinutes || 10) : 10}"></label>
      </div>
      <label class="wfm-row"><span>触发线索（可选 · 习惯叠加）</span><input id="hbAnchor" class="gf-input" value="${esc((editing && editing.anchor) || '')}" placeholder="在[既有行为]之后，如：早餐后 / 通勤后"></label>
      <div class="hb-preview" id="hbPreview"></div>
      <div class="wfm-actions">${taskMode && editing && editing.recurrence ? '<button type="button" class="gf-btn gf-btn--ghost" id="hbClearRec">清除循环</button>' : ''}<button type="button" class="gf-btn gf-btn--ghost" id="hbCancel">取消</button><button type="button" class="gf-btn gf-btn--primary" id="hbSave">${taskMode ? '保存周期' : (editing ? '保存' : '添加习惯')}</button></div>
    </div>
  </div>`;
  overlay.classList.add('show');
  const $ = id => overlay.querySelector('#' + id);
  const subMap = { weekly: 'hbWeekly', interval: 'hbInterval', monthly: 'hbMonthly', timesPerWeek: 'hbTimes' };
  function readRec() {
    const t = $('hbType').value;
    const rec = { type: t };
    if (t === 'weekly') rec.days = [...overlay.querySelectorAll('[data-hbwd]')].filter(c => c.checked).map(c => +c.dataset.hbwd);
    if (t === 'interval') { rec.interval = clamp(+$('hbIntervalN').value || 2, 1, 60); rec.anchorDate = (editing && editing.recurrence && editing.recurrence.anchorDate) || dateKey(); }
    if (t === 'monthly') rec.dayOfMonth = clamp(+$('hbMonthDay').value || 1, 1, 31);
    if (t === 'timesPerWeek') rec.times = clamp(+$('hbTimesN').value || 3, 1, 7);
    return rec;
  }
  const syncSub = () => {
    const t = $('hbType').value;
    Object.keys(subMap).forEach(k => { $(subMap[k]).style.display = 'none'; });
    if (subMap[t]) $(subMap[t]).style.display = 'flex';
    $('hbPreview').textContent = '循环：' + recurrenceLabel({ recurrence: readRec() });
  };
  $('hbType').onchange = syncSub;
  overlay.querySelectorAll('[data-hbwd]').forEach(c => c.onchange = syncSub);
  ['hbIntervalN', 'hbMonthDay', 'hbTimesN'].forEach(id => { $(id).oninput = syncSub; });
  syncSub();
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  $('hbClose').onclick = close; $('hbCancel').onclick = close;
  if ($('hbClearRec')) $('hbClearRec').onclick = () => {
    if (!editing) return;
    const prevWf = state.activeWorkflowId;
    if (w.id !== state.activeWorkflowId) switchWorkflow(w.id);
    editing.recurrence = null; editing.recur = false; editing.timesPerWeek = 0; editing.lastRecDone = '';
    recomputeSchedule(state.nodes); save();
    if (w.id !== prevWf) switchWorkflow(prevWf); else afterChange();
    close(); showToast('已清除循环 · 恢复为普通任务');
  };
  $('hbSave').onclick = () => {
    const text = ($('hbText').value || '').trim();
    if (!text) { showToast(taskMode ? '⚠️ 请填写任务名称' : '⚠️ 请填写习惯名称'); $('hbText').focus(); return; }
    const rec = readRec();
    if (rec.type === 'weekly' && !(rec.days || []).length) { showToast('⚠️ 请至少选择一天'); return; }
    const tpw = rec.type === 'timesPerWeek' ? rec.times
      : rec.type === 'weekly' ? rec.days.length
      : rec.type === 'weekdays' ? 5 : rec.type === 'weekends' ? 2 : rec.type === 'daily' ? 7 : 0;
    const time = $('hbTime').value || '';
    const est = clamp(+$('hbEst').value || 10, 1, 999);
    const anchor = ($('hbAnchor').value || '').trim();
    const prevWf = state.activeWorkflowId;
    if (w.id !== state.activeWorkflowId) switchWorkflow(w.id);
    if (editing) {
      editing.text = text; editing.recurrence = rec; editing.timesPerWeek = tpw; editing.time = time;
      editing.estimateMinutes = est; editing.anchor = anchor;
      if (taskMode) { editing.recur = false; editing.lastRecDone = ''; }
      else { editing.role = 'habit'; editing.recur = true; editing.scale = 'day'; }
    } else {
      const root = state.nodes[0];
      const maxId = state.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);
      state.nodes.push(newNode({
        id: 'n' + (maxId + 1), text, im: Math.min(5, root.im || 3), ur: 2, parentId: root.id, scale: 'day',
        source: 'habit', role: 'habit', recur: true, recurrence: rec, timesPerWeek: tpw, time, estimateMinutes: est, anchor,
      }));
    }
    recomputeSchedule(state.nodes); save();
    if (w.id !== prevWf) switchWorkflow(prevWf); else afterChange();
    close();
    showToast(taskMode ? `已设循环 · ${recurrenceLabel({ recurrence: rec })}「${text.slice(0, 12)}」` : (editing ? '已更新习惯周期' : `已添加习惯 · ${recurrenceLabel({ recurrence: rec })}「${text.slice(0, 12)}」`));
  };
  setTimeout(() => { const t = $('hbText'); if (t) t.focus(); }, 30);
}
/* 行级渐进披露：展开状态跨重渲染保持 */
const _rowExpanded = new Set();
/* 情境标签过滤：'' = 全部；选中某标签后今日执行清单/习惯按此切片 */
let _ctxFilter = '';
/* v8.7: 今日视图工作流过滤 —— 默认关（跨全部项目：MIT/今日执行从任何项目进入都一致）；
   打开「只看当前项目」后，英雄卡候选 / 今日执行池 / 顶栏计数都只算当前项目。选择持久化。
   注意：声明在使用它的函数（heroGlobalCandidates 等）之后——函数定义时不求值，运行时已初始化，安全。 */
let _wfOnly = (function () { try { return localStorage.getItem('goalflow.todayWfOnly') === '1'; } catch (e) { return false; } })();
function toggleTodayWfOnly() {
  _wfOnly = !_wfOnly;
  try { localStorage.setItem('goalflow.todayWfOnly', _wfOnly ? '1' : '0'); } catch (e) { }
  afterChange();
}
function renderTodayCtxBar(entries) {
  const box = document.getElementById('todayCtxBar');
  if (!box) return;
  const counts = {};
  entries.forEach(e => (e.node.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const tags = Object.keys(counts).sort();
  if (!tags.length) { box.innerHTML = ''; if (_ctxFilter) _ctxFilter = ''; return; }
  if (_ctxFilter && !counts[_ctxFilter]) _ctxFilter = '';
  const chip = (label, val, cnt, on) => `<button type="button" class="ctx-chip${on ? ' on' : ''}" data-ctx="${esc(val)}">${esc(label)}${cnt != null ? ` <span class="ctx-n">${cnt}</span>` : ''}</button>`;
  box.innerHTML = `<span class="ctx-bar-lbl">🏷 情境</span>` +
    chip('全部', '', null, !_ctxFilter) +
    tags.map(t => chip(t, t, counts[t], _ctxFilter === t)).join('');
  box.querySelectorAll('[data-ctx]').forEach(b => b.onclick = () => { _ctxFilter = b.dataset.ctx || ''; afterChange(); });
}
function todayRowHtml(entry, opts) {
  opts = opts || {};
  const n = entry.node || entry;
  const wfId = entry.wfId || state.activeWorkflowId || '';
  const wfName = entry.wfName || '';
  const isWfTop = !!entry.isWfTop;
  const habit = n.recur || n.role === 'habit';
  const isMicro = (n.estimateMinutes || 99) <= 10;
  const expanded = _rowExpanded.has(n.id);
  const timeVal = n.time || '';
  const remind = todayRemindValue(n);
  const est = n.estimateMinutes ?? '';
  const streak = habitStreakOf(n, wfId);
  const hw = habit ? habitWeekLog(n, wfId) : null;
  const hs = hw && hw.rec ? habitStrength(hw.rec) : null;
  // v8.0 UX 精简：习惯 meta 合并为一条（详情都在 title 里），不再 4 段连排
  const habitMeta = habit
    ? `<span class="today-meta habit-freq" title="习惯分轨：本周 ${hw.done}/${hw.target}${hw.left ? ` · 差${hw.left}次` : ' · 已达成'}${hs && hs.samples ? ` · 强度${hs.pct}%（漏做按频率衰减不清零）` : ''}${streak ? ` · 连续${streak.cur}天` : ''}">📈 ${hw.done}/${hw.target}${streak ? ` 🔥${streak.cur}` : ''}</span>`
    : '';
  const recurMeta = (habit || (n.recurrence && n.recurrence.type)) ? `<span class="today-meta habit-recur" title="循环周期 · 点行尾「🔁 周期」可编辑">${esc(recurrenceLabel(n))}</span>` : '';
  const waitMeta = isNodeWaiting(n) ? `<span class="today-meta wait-tag" title="${esc(n.waitNote || '等待外部')}">⏳ 等待中${n.waitNote ? ' · ' + esc(n.waitNote) : ''}</span>` : '';
  const blockMeta = isNodeBlocked(n) ? `<span class="today-meta block-tag" title="${esc(n.waitNote || '被阻塞')}">🚫 阻塞${n.waitNote ? ' · ' + esc(n.waitNote) : ''}</span>` : '';
  const anchorMeta = habit && n.anchor ? `<span class="today-meta anchor-tag" title="触发线索：在既有行为之后（习惯叠加）">⚓ ${esc(n.anchor)}后</span>` : '';
  const tagMeta = (n.tags && n.tags.length) ? `<span class="today-meta ctx-tag" title="情境标签">🏷 ${esc(n.tags.join(' '))}</span>` : '';
  const overflowMeta = n._overflow ? `<span class="today-meta overflow-tag" title="超出今日可投入预算（多项目共享同一每日容量），建议删减、顺延到明天或调大⚙每日投入">🌊 溢出</span>` : '';
  // v8.14: ② 次重要行直接显示算法分（用户反馈「看不到第二项的分数」），title 带分解明细
  const nextScoreMeta = opts.nextTop ? (() => {
    const fsp = focusScoreParts(n);
    const brk = fsp.parts.filter(p => p.pts !== 0 && !p.note).slice(0, 4).map(p => `${p.label} ${p.pts > 0 ? '+' : ''}${p.pts}`).join(' · ');
    return `<span class="today-meta next-top-score" title="② 算法分 · 分解：${esc(brk)}">② ${fsp.total}分</span>`;
  })() : '';
  return `<div class="today-row${isWfTop ? ' is-top' : ''}${opts.nextTop ? ' next-top' : ''}${habit ? ' is-habit' : ''}${isNodeParked(n) ? ' is-parked' : ''}${n._overflow ? ' is-overflow' : ''}${expanded ? ' expanded' : ''}" data-id="${n.id}" data-wf="${wfId}" draggable="true">
    <label class="today-check"><input type="checkbox" data-done="${n.id}" data-wf="${wfId}" aria-label="完成"></label>
    <div class="today-txt">
      <span class="today-txt-line">${opts.nextTop ? '<i class="today-pfx next-top-badge" title="② 次重要 · 今日池算法排序仅次于 MIT，值得排进下一段专注">②</i>' : ''}${isWfTop ? '<i class="today-pfx" title="各流最重要">★</i>' : ''}${habit ? '<i class="today-pfx">🔁</i>' : ''}${isMicro ? '<i class="today-pfx">🫳</i>' : ''}<input class="today-txt-in" data-edit="${n.id}" data-wf="${wfId}" value="${esc(n.text)}" title="编辑文案 · 回车或失焦保存" aria-label="任务文案"></span>
      <span class="today-txt-metas">${nextScoreMeta}${wfName ? `<span class="today-meta wf-tag">${esc(wfName)}</span>` : ''}${timeVal ? `<span class="today-meta">🕐 ${esc(timeVal)}</span>` : ''}${recurMeta}${habit ? habitMeta : (streak ? `<span class="today-meta streak" title="习惯连续天数（执行记录驱动）">🔥 ${streak.cur}天</span>` : '')}${anchorMeta}${tagMeta}${n.daysLeft != null ? `<span class="today-meta meta-dleft">${n.overdue ? '逾期' : '剩'}${Math.abs(n.daysLeft)}天</span>` : ''}${waitMeta}${blockMeta}${overflowMeta}</span>
    </div>
    <div class="today-row-quick">
      ${isWfTop || opts.pomo ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-pomo="${n.id}" data-wf="${wfId}" title="番茄钟专注（时长取 MIT 区下拉，默认 25′）">🍅</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost today-rowmore-btn" data-rowmore="${n.id}" title="更多操作：⏰提醒(弹通知) / 估时 / 🕐计划时间(排序用) / 预案 / 等待 / 删除" aria-expanded="${expanded}">${expanded ? '▲' : '⋯'}</button>
    </div>
    <div class="today-row-more">
    <div class="today-timing">
      <label class="today-time-lbl" title="今日闹钟提醒">⏰</label>
      <input type="time" class="today-remind" data-remind="${n.id}" data-wf="${wfId}" value="${remind}" title="到点弹通知提醒你（闹钟，可选）">
      <input type="number" class="today-est" min="1" max="999" step="5" data-est="${n.id}" data-wf="${wfId}" value="${est}" placeholder="分" title="计划时长（分钟）">
      <input type="time" class="today-time" data-time="${n.id}" data-wf="${wfId}" value="${timeVal}" title="计划几点开始做（今日按此排序，不会弹提醒）">
    </div>
    <div class="today-acts">
      ${opts.micro !== false ? `<button type="button" class="gf-btn gf-btn--sm" data-micro="${n.id}" data-wf="${wfId}" title="5分钟微动作">🫳</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm${n.ifThen ? ' woop-on' : ''}" data-woop="${n.id}" data-wf="${wfId}" title="障碍预案（执行意图：如果…就…）">🛡</button>
      ${habit ? `<button type="button" class="gf-btn gf-btn--sm${n.anchor ? ' woop-on' : ''}" data-anchor="${n.id}" data-wf="${wfId}" title="触发线索（习惯叠加：在[既有行为]之后）">⚓</button>` : ''}
      ${habit ? `<button type="button" class="gf-btn gf-btn--sm" data-habitedit="${n.id}" data-wf="${wfId}" title="编辑习惯：循环周期 / 计划时间 / 估时 / 触发线索">🔁 周期</button>` : `<button type="button" class="gf-btn gf-btn--sm${(n.recurrence && n.recurrence.type) ? ' woop-on' : ''}" data-recurredit="${n.id}" data-wf="${wfId}" title="设循环周期：到期日自动出现，完成本次后自动排下次">🔁 循环</button>`}
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'waiting' ? ' wait-on' : ''}" data-wait="${n.id}" data-wf="${wfId}" title="标记等待中（退出今日竞选，写清在等什么）">⏳</button>
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'blocked' ? ' block-on' : ''}" data-block="${n.id}" data-wf="${wfId}" title="标记阻塞（退出今日竞选，写清被什么卡住）">🚫</button>
      <button type="button" class="gf-btn gf-btn--sm${(n.tags && n.tags.length) ? ' woop-on' : ''}" data-tags="${n.id}" data-wf="${wfId}" title="情境标签（@电脑 / @外出 / @低能量 / @15分钟）">🏷</button>
      <button type="button" class="gf-btn gf-btn--sm today-del" data-del="${n.id}" data-wf="${wfId}" title="删除该任务（10 秒内可撤销）">🗑</button>
    </div>
    <div class="today-ifthen" data-ifthenbox="${n.id}" style="display:${n.ifThen ? 'flex' : 'none'}">
      <span class="ti-shield">🛡</span>
      <input class="ti-input" data-ifthen="${n.id}" data-wf="${wfId}" value="${esc(n.ifThen || '')}" placeholder="如果[障碍]，我就[应对] · 回车保存">
    </div>
    ${habit ? `<div class="today-ifthen" data-anchorbox="${n.id}" style="display:${n.anchor ? 'flex' : 'none'}">
      <span class="ti-shield">⚓</span>
      <input class="ti-input" data-anchorin="${n.id}" data-wf="${wfId}" value="${esc(n.anchor || '')}" placeholder="在[既有行为]之后 · 如：早餐后 / 通勤后 / 午饭后 · 回车保存">
    </div>` : ''}
    <div class="today-tags-wrap" data-tagsbox="${n.id}" style="display:${(n.tags && n.tags.length) ? 'flex' : 'none'}">
      <div class="today-ifthen"><span class="ti-shield">🏷</span>
        <input class="ti-input" data-tagsin="${n.id}" data-wf="${wfId}" value="${esc((n.tags || []).join(', '))}" placeholder="情境标签，逗号分隔 · 如 @电脑, @15分钟 · 回车保存">
      </div>
      <div class="today-ctx-presets">${['@电脑', '@外出', '@低能量', '@15分钟'].map(t => `<button type="button" class="ctx-chip" data-ctxadd="${t}" data-node="${n.id}" data-wf="${wfId}">${t}</button>`).join('')}</div>
    </div>
    </div>
  </div>`;
}
function bindTodayPanel(root) {
  if (!root) return;
  root.querySelectorAll('input[data-done]').forEach(cb => {
    cb.onchange = () => { setNodeDoneInWorkflow(cb.dataset.wf, cb.dataset.done, cb.checked); afterChange(); };
  });
  root.querySelectorAll('input[data-remind]').forEach(inp => {
    // v8.3：填入提醒时间时，若系统通知权限还是 default（从未问过），顺势引导授权；
    // 授权失败也不影响 —— tickReminders 到点会走 toast+页头横幅兜底
    inp.onchange = () => {
      if (inp.value && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        requestAlarmPermission();
      }
      setNodeRemind(inp.dataset.wf, inp.dataset.remind, inp.value);
      tickReminders();
    };
  });
  root.querySelectorAll('input[data-est]').forEach(inp => {
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.est);
      if (!n) return;
      n.estimateMinutes = inp.value ? clamp(+inp.value, 1, 999) : null;
      save(); afterChange();
    };
  });
  root.querySelectorAll('input[data-time]').forEach(inp => {
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.time);
      if (!n) return;
      n.time = inp.value || '';
      if (n.time && !n.scale) n.scale = 'day';
      save(); afterChange();
    };
  });
  root.querySelectorAll('input[data-edit]').forEach(inp => {
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
    inp.onchange = () => editTodayNode(inp.dataset.wf, inp.dataset.edit, inp.value);
  });
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteTodayNode(b.dataset.wf, b.dataset.del));
  root.querySelectorAll('[data-rowmore]').forEach(b => b.onclick = () => {
    const id = b.dataset.rowmore;
    const row = b.closest('.today-row');
    const on = !_rowExpanded.has(id);
    if (on) _rowExpanded.add(id); else _rowExpanded.delete(id);
    if (row) row.classList.toggle('expanded', on);
    b.textContent = on ? '▲' : '⋯';
    b.setAttribute('aria-expanded', on ? 'true' : 'false');
  });
  root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    if (b.dataset.add === 'habit') { openHabitEditor(b.dataset.addWf || state.activeWorkflowId, null); return; }
    addTodayNode(b.dataset.addWf || state.activeWorkflowId, { slot: b.dataset.addSlot || '' });
  });
  root.querySelectorAll('[data-habitedit]').forEach(b => b.onclick = () => openHabitEditor(b.dataset.wf, b.dataset.habitedit));
  root.querySelectorAll('[data-recurredit]').forEach(b => b.onclick = () => openHabitEditor(b.dataset.wf, b.dataset.recurredit, true));
  root.querySelectorAll('[data-micro]').forEach(b => b.onclick = () => {
    const prev = state.activeWorkflowId;
    if (b.dataset.wf && b.dataset.wf !== state.activeWorkflowId) switchWorkflow(b.dataset.wf);
    addMicroAction(b.dataset.micro);
    if (prev !== state.activeWorkflowId) switchWorkflow(prev);
  });
  root.querySelectorAll('[data-woop]').forEach(b => b.onclick = () => {
    const row = b.closest('.today-row');
    const boxEl = row && row.querySelector('[data-ifthenbox]');
    if (!boxEl) return;
    const show = boxEl.style.display === 'none';
    boxEl.style.display = show ? 'flex' : 'none';
    if (show) { const inp = boxEl.querySelector('input'); if (inp) inp.focus(); }
  });
  root.querySelectorAll('input[data-ifthen]').forEach(inp => {
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.ifthen);
      if (!n) return;
      n.ifThen = inp.value.trim();
      save(); afterChange();
    };
  });
  // v6.4 习惯触发线索（⚓ 习惯叠加）
  root.querySelectorAll('[data-anchor]').forEach(b => b.onclick = () => {
    const row = b.closest('.today-row');
    const boxEl = row && row.querySelector('[data-anchorbox]');
    if (!boxEl) return;
    const show = boxEl.style.display === 'none';
    boxEl.style.display = show ? 'flex' : 'none';
    if (show) { const inp = boxEl.querySelector('input'); if (inp) inp.focus(); }
  });
  root.querySelectorAll('input[data-anchorin]').forEach(inp => {
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.anchorin);
      if (!n) return;
      n.anchor = inp.value.trim();
      save(); afterChange();
    };
  });
  root.querySelectorAll('[data-pomo]').forEach(b => b.onclick = () => {
    if (b.dataset.wf) state.pomo.wfId = b.dataset.wf;
    if (b.dataset.wf && b.dataset.wf !== state.activeWorkflowId) switchWorkflow(b.dataset.wf);
    state.topId = b.dataset.pomo;
    const w = workflowById(b.dataset.wf); if (w) w.topId = b.dataset.pomo;
    // v8.13: 时长承接自 MIT 区下拉（原英雄卡 25/50/90 选择器），无下拉时默认 25′
    const pl = document.getElementById('pomoLen');
    startPomo(pl ? +pl.value || 25 : 25);
    save();
  });
  const setPark = (wfId, nodeId, status) => {
    const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
    if (n.status === status) { n.status = ''; n.waitNote = ''; n.followUp = ''; save(); afterChange(); return; }
    openParkEditor(wfId, nodeId, status);
  };
  root.querySelectorAll('[data-wait]').forEach(b => b.onclick = () => setPark(b.dataset.wf, b.dataset.wait, 'waiting'));
  root.querySelectorAll('[data-block]').forEach(b => b.onclick = () => setPark(b.dataset.wf, b.dataset.block, 'blocked'));
  // 情境标签：🏷 展开编辑框 + 预设 chips
  root.querySelectorAll('[data-tags]').forEach(b => b.onclick = () => {
    const row = b.closest('.today-row');
    const boxEl = row && row.querySelector('[data-tagsbox]');
    if (!boxEl) return;
    const show = boxEl.style.display === 'none';
    boxEl.style.display = show ? 'flex' : 'none';
    if (show) { const inp = boxEl.querySelector('input'); if (inp) inp.focus(); }
  });
  root.querySelectorAll('input[data-tagsin]').forEach(inp => {
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.tagsin);
      if (!n) return;
      n.tags = inp.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      save(); afterChange();
    };
  });
  root.querySelectorAll('[data-ctxadd]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.node);
    if (!n) return;
    const t = b.dataset.ctxadd;
    if (!Array.isArray(n.tags)) n.tags = [];
    if (!n.tags.includes(t)) n.tags.push(t);
    save(); afterChange();
  });
}
/* 等待 / 阻塞条：今日面板底部可见——不竞选，但提醒去催 / 解锁 */
function parkedEntries() {
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  state.workflows.forEach(wf => {
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    nodes.filter(n => n.parentId && !n.done && isNodeParked(n)).forEach(n => out.push({ node: n, wfId: wf.id, wfName: wf.name || '' }));
  });
  return out;
}
function openParkEditor(wfId, nodeId, status) {
  const overlay = document.getElementById('parkModal'); if (!overlay) return;
  const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
  const waiting = status === 'waiting';
  const ttl = waiting ? '标记等待中' : '标记阻塞';
  const sub = waiting ? '写清在等什么 · 设个催办日期，到期自动提醒你去催' : '写清被什么卡住 · 解锁后再回到今日竞选';
  const presets = waiting ? `<div class="pk-presets">${[['+1天', 1], ['+3天', 3], ['+1周', 7]].map(([l, d]) => `<button type="button" class="ctx-chip" data-pkpre="${d}">${l}</button>`).join('')}<button type="button" class="ctx-chip" data-pkpre="0">清除日期</button></div>` : '';
  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><div class="mh-ic">${waiting ? '⏳' : '🚫'}</div>
      <div><div class="mh-tt">${ttl}</div><div class="mh-sub">${sub}</div></div>
      <div class="mh-x" id="pkClose">×</div></div>
    <div class="wfm-body">
      <div class="pk-task">${esc(n.text)}</div>
      <label class="wfm-row"><span>${waiting ? '在等什么' : '被什么卡住'}</span><input id="pkNote" class="gf-input" value="${esc(n.waitNote || '')}" placeholder="${waiting ? '如：等客户回复报价' : '如：缺设计稿'}"></label>
      ${waiting ? `<label class="wfm-row"><span>催办日期</span><input id="pkDate" type="date" class="gf-input" value="${esc(n.followUp || '')}"></label>${presets}` : ''}
      <div class="wfm-actions">${n.status === status ? '<button type="button" class="gf-btn gf-btn--ghost" id="pkClear">解除标记</button>' : ''}<button type="button" class="gf-btn gf-btn--ghost" id="pkCancel">取消</button><button type="button" class="gf-btn gf-btn--primary" id="pkSave">保存</button></div>
    </div>
  </div>`;
  overlay.classList.add('show');
  const $ = id => overlay.querySelector('#' + id);
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  $('pkClose').onclick = close; $('pkCancel').onclick = close;
  if ($('pkClear')) $('pkClear').onclick = () => { n.status = ''; n.waitNote = ''; n.followUp = ''; save(); afterChange(); close(); showToast('已解除标记 · 回到今日竞选'); };
  overlay.querySelectorAll('[data-pkpre]').forEach(b => b.onclick = () => {
    const d = +b.dataset.pkpre;
    $('pkDate').value = d ? dateKey(addDays(today0(), d)) : '';
  });
  $('pkSave').onclick = () => {
    n.status = status; n.waitNote = ($('pkNote').value || '').trim();
    n.followUp = waiting ? ($('pkDate').value || '') : '';
    save(); afterChange(); close();
    showToast(waiting ? (n.followUp ? `已标记等待 · ${n.followUp} 提醒催办` : '已标记等待中') : '已标记阻塞');
  };
  setTimeout(() => { const t = $('pkNote'); if (t) t.focus(); }, 30);
}
function renderParkedStrip() {
  const box = document.getElementById('todayParked'); if (!box) return;
  const list = parkedEntries();
  if (!list.length) { box.innerHTML = ''; return; }
  list.sort((a, b) => (followUpDue(b.node) ? 1 : 0) - (followUpDue(a.node) ? 1 : 0));
  const dueN = list.filter(ent => followUpDue(ent.node)).length;
  const rows = list.map(ent => {
    const n = ent.node;
    const blocked = isNodeBlocked(n);
    const tag = blocked ? '🚫 阻塞' : '⏳ 等待';
    const due = followUpDue(n);
    const fuMeta = !blocked && n.followUp ? `<span class="pk-fu${due ? ' due' : ''}">${due ? '📣 今天需催办' : '📅 ' + esc(n.followUp.slice(5)) + ' 催办'}</span>` : '';
    const fuBtn = !blocked ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-followup="${n.id}" data-wf="${ent.wfId}" title="已催办 · 自动顺延 3 天后再提醒">📣 已催办</button>` : '';
    return `<div class="pk-row${due ? ' pk-due' : ''}"><span class="pk-tag ${blocked ? 'blk' : 'wt'}">${tag}</span>
      <b>${esc(n.text.length > 22 ? n.text.slice(0, 22) + '…' : n.text)}</b>
      <span class="pk-note">${esc(n.waitNote || '（未注明原因）')}</span>${fuMeta}
      <span class="pk-acts">${fuBtn}<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-parkedit="${n.id}" data-wf="${ent.wfId}" title="编辑原因 / 催办日期">✎</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-unpark="${n.id}" data-wf="${ent.wfId}" title="恢复参与今日竞选">↩ 解除</button></span></div>`;
  }).join('');
  box.innerHTML = `<div class="today-parked"><div class="pk-h">⏸ 已暂停 ${list.length} 项${dueN ? ` · <b class="pk-due-n">${dueN} 项需催办</b>` : ''}（等待/阻塞 —— 退出竞选，但别忘了催）</div>${rows}</div>`;
  box.querySelectorAll('[data-unpark]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.unpark);
    if (n) { n.status = ''; n.waitNote = ''; n.followUp = ''; save(); afterChange(); }
  });
  box.querySelectorAll('[data-parkedit]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.parkedit);
    if (n) openParkEditor(b.dataset.wf, b.dataset.parkedit, n.status || 'waiting');
  });
  box.querySelectorAll('[data-followup]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.followup);
    if (!n) return;
    n.followUpAt = Date.now(); n.followUp = dateKey(addDays(today0(), 3));
    save(); afterChange(); showToast('已催办 · 3 天后再提醒，收到回复就「↩ 解除」');
  });
}

/* ============ 收件箱（GTD：先捕获，再澄清进目标树） ============ */
function inboxItems() { ensureScoreMeta(); return state.meta.inbox || []; }
function addInbox(text, opts) {
  text = String(text || '').trim(); if (!text) return null;
  ensureScoreMeta();
  const dl = parseDeadline(text);
  const it = {
    id: 'ib' + Date.now() + Math.floor(Math.random() * 1000),
    text, status: 'inbox', wfId: '', createdAt: Date.now(),
    deadline: dl.label || '', deadlineDate: dl.date ? dl.date.getTime() : null,
    remindAt: (opts && opts.remindAt) || null, est: (opts && opts.est) || parseEstimateMinutes(text),
    snoozeUntil: null,
  };
  state.meta.inbox.push(it);
  saveMeta();
  return it;
}
function inboxPending() { return inboxItems().filter(i => i.status === 'inbox' && !(i.snoozeUntil && i.snoozeUntil > Date.now())); }
/* 澄清四选一：变叶子 / 挂到目标 / 以后再说 / 丢掉 */
function clarifyInbox(id, action, wfId) {
  ensureScoreMeta();
  const it = (state.meta.inbox || []).find(x => x.id === id); if (!it) return;
  if (action === 'trash') { it.status = 'trashed'; saveMeta(); afterChange(); return; }
  if (action === 'someday') { it.status = 'someday'; saveMeta(); afterChange(); return; }
  if (action === 'restore') { it.status = 'inbox'; it.snoozeUntil = null; saveMeta(); afterChange(); return; }
  if (action === 'snooze') { it.snoozeUntil = Date.now() + 86400000; saveMeta(); afterChange(); return; }
  // task：变成叶子，插到目标树根下（scale=day）
  const targetWf = wfId || it.wfId || state.activeWorkflowId;
  if (!targetWf || !workflowById(targetWf)) { showToast('⚠️ 请选择一个项目再变成任务'); return; }
  const w = workflowById(targetWf);
  const prevWf = state.activeWorkflowId;
  if (targetWf !== state.activeWorkflowId) switchWorkflow(targetWf);
  const root = state.nodes[0];
  if (!root) { showToast('⚠️ 该项目还没有目标树，请先在「目标规划」解析一个目标'); if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  const node = appendActionLeaf(it.text, {
    deadline: it.deadline || '', deadlineDate: it.deadlineDate ? new Date(it.deadlineDate) : today0(),
    est: it.est || null, source: 'inbox',
  });
  if (!node) { if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  // v8.8: 提到今天 = 自动分配今日空闲时间（跨项目占用）+ 支持撤回
  try { ensureEstimate(node, true); } catch (e) { }
  const freeHm = nextFreeTimeToday(targetWf, node.estimateMinutes || 30);
  if (freeHm) { node.time = freeHm; node.planDate = ''; }
  recomputeSchedule(state.nodes);
  flushActiveWorkflow();
  it.status = 'clarified'; it.clarifiedAt = Date.now(); it.wfId = targetWf;
  save(); saveMeta();
  if (targetWf !== prevWf) switchWorkflow(prevWf); else afterChange();
  // 撤回 = 从目标项目移除新建叶子 + 条目回到待澄清（注意目标项目可能不是当前项目，不能直接动 state.nodes）
  showUndoToast(`已加入今天：「${esc((it.text || '').slice(0, 14))}」${freeHm ? ` · 已自动排 ${freeHm}` : ''}`, () => {
    w.nodes = (w.nodes || []).filter(x => x.id !== node.id);
    if (state.activeWorkflowId === targetWf) { state.nodes = w.nodes; try { recomputeSchedule(state.nodes); } catch (e) { } }
    it.status = 'inbox'; it.clarifiedAt = null;
    save(); saveMeta(); afterChange();
  });
}
function captureInboxFromText(v) {
  v = String(v || '').trim(); if (!v) return null;
  // 自然语言里的时间词 → 提醒；其余 → 期限（解析在 addInbox 内做）
  let remindAt = null;
  const tm = v.match(/(今天|明天|后天)?\s*(上午|下午|晚上)?\s*(\d{1,2})[点时:：](\d{2})?/);
  if (tm) {
    const base = tm[1] === '明天' ? addDays(today0(), 1) : tm[1] === '后天' ? addDays(today0(), 2) : today0();
    let h = +tm[3];
    if ((tm[2] === '下午' || tm[2] === '晚上') && h < 12) h += 12;
    const d = new Date(base); d.setHours(h, +(tm[4] || 0), 0, 0);
    if (d.getTime() > Date.now()) remindAt = d.getTime();
  }
  return addInbox(v, { remindAt });
}
/* 常驻细捕获条：留在执行区，零摩擦「想到就丢」（澄清队列不在这里） */
function renderInboxCapture() {
  const box = document.getElementById('inboxCapture'); if (!box) return;
  const pend = inboxPending();
  box.innerHTML = `<div class="cap-bar">
    <span class="cap-ic">📥</span>
    <input class="gf-input cap-in" id="ibQuick" placeholder="先丢进来：如「给 Anna 回电话 明天下午3点」——之后在「需要关注」里澄清">
    <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="ibAdd">捕获</button>
    ${pend.length ? `<button type="button" class="cap-pend" id="capPend" title="去「需要关注 · 收件箱」批量澄清">待澄清 ${pend.length} ›</button>` : '<span class="cap-zero">已清空</span>'}
  </div>`;
  const inp = box.querySelector('#ibQuick');
  const doAdd = () => {
    const item = captureInboxFromText(inp.value);
    if (!item) { if (inp) inp.focus(); return; }
    inp.value = '';
    renderInboxCapture(); renderInboxPanel(); updateTodayZones();
    showToast('📥 已捕获 · 稍后在「需要关注 → 收件箱」里澄清成任务');
  };
  box.querySelector('#ibAdd').onclick = doAdd;
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') doAdd(); };
  const pendBtn = box.querySelector('#capPend');
  if (pendBtn) pendBtn.onclick = () => {
    const z = document.getElementById('zoneAttention'); if (z) z.open = true;
    const ip = document.getElementById('inboxPanel');
    if (ip) { try { ip.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { ip.scrollIntoView(); } }
  };
}
let _inboxAll = false, _somedayOpen = false;
function renderInboxPanel() {
  const box = document.getElementById('inboxPanel'); if (!box) return;
  ensureScoreMeta();
  const pend = inboxPending();
  const somedayItems = inboxItems().filter(i => i.status === 'someday');
  if (!pend.length && !somedayItems.length) { box.innerHTML = ''; return; }
  const wfOpts = (state.workflows || []).map(w => `<option value="${w.id}"${w.id === state.activeWorkflowId ? ' selected' : ''}>${esc(w.name || '项目')}</option>`).join('');
  const ibRow = (it, mode) => {
    const dl = it.deadlineDate ? `<span class="ib-meta">⏱ ${esc(it.deadline || dateKey(new Date(it.deadlineDate)))}</span>` : '';
    const remind = it.remindAt ? `<span class="ib-meta">⏰ ${new Date(it.remindAt).getHours()}:${pad2(new Date(it.remindAt).getMinutes())}</span>` : '';
    const primary = mode === 'someday'
      ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-ibtask="${it.id}" title="把这条备选加入今天任务">→今天</button>`
      : `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-ibtask="${it.id}" title="澄清：变成叶子任务，进今日">→任务</button>`;
    const overflow = mode === 'someday'
      ? `<select class="gf-input gf-select ib-wf" data-ibwf="${it.id}" title="挂到哪个项目">${wfOpts}</select>
         <button type="button" class="gf-btn gf-btn--sm" data-ibrestore="${it.id}" title="收回收件箱，重新澄清">↩ 收回</button>
         <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ibtrash="${it.id}" title="丢掉">× 丢弃</button>`
      : `<select class="gf-input gf-select ib-wf" data-ibwf="${it.id}" title="挂到哪个项目">${wfOpts}</select>
         <button type="button" class="gf-btn gf-btn--sm" data-ibsomeday="${it.id}" title="以后再说（不丢，收进 someday）">☁ 以后</button>
         <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ibsnooze="${it.id}" title="明天再看">💤 明天</button>
         <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ibtrash="${it.id}" title="丢掉">× 丢弃</button>`;
    return `<div class="ib-row" data-ib="${it.id}">
      <div class="ib-txt"><b>${esc(it.text)}</b>${dl}${remind}</div>
      <div class="ib-acts">${primary}<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost ib-morebtn" data-ibmore="${it.id}" title="更多：选项目 / 以后再说 / 明天 / 丢弃" aria-expanded="false">⋯</button></div>
      <div class="ib-overflow" data-ibov="${it.id}" style="display:none">${overflow}</div>
    </div>`;
  };
  const shown = _inboxAll ? pend : pend.slice(0, 6);
  const rows = shown.map(it => ibRow(it)).join('');
  const moreBtn = pend.length > 6
    ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost ib-more" id="ibMore">${_inboxAll ? '▴ 收起' : `▾ 展开全部 ${pend.length} 条`}</button>` : '';
  const somedayHtml = (_somedayOpen && somedayItems.length)
    ? `<div class="ib-someday"><div class="ib-someday-h">☁ 以后再说（${somedayItems.length}）——随时可收回或澄清</div>${somedayItems.map(it => ibRow(it, 'someday')).join('')}</div>` : '';
  box.innerHTML = `<div class="inbox-bar">
      <div class="ib-head"><span class="ib-tt">📥 收件箱 · 待澄清</span><span class="ib-cnt">${pend.length ? `${pend.length} 条` : '已清空'}${somedayItems.length ? ` · <button type="button" class="ib-someday-toggle" id="ibSomedayToggle" title="查看以后再说的条目">☁以后 ${somedayItems.length} ${_somedayOpen ? '▴' : '▾'}</button>` : ''}</span></div>
      ${rows ? `<div class="ib-list">${rows}</div>` : ''}
      ${moreBtn}
      ${somedayHtml}
    </div>`;
  box.querySelectorAll('[data-ibmore]').forEach(b => b.onclick = () => {
    const ov = box.querySelector(`[data-ibov="${b.dataset.ibmore}"]`);
    if (!ov) return;
    const show = ov.style.display === 'none';
    ov.style.display = show ? 'flex' : 'none';
    b.setAttribute('aria-expanded', show ? 'true' : 'false');
  });
  box.querySelectorAll('[data-ibtask]').forEach(b => b.onclick = () => {
    const sel = box.querySelector(`[data-ibwf="${b.dataset.ibtask}"]`);
    clarifyInbox(b.dataset.ibtask, 'task', sel ? sel.value : state.activeWorkflowId);
  });
  box.querySelectorAll('[data-ibsomeday]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibsomeday, 'someday'));
  box.querySelectorAll('[data-ibsnooze]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibsnooze, 'snooze'));
  box.querySelectorAll('[data-ibtrash]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibtrash, 'trash'));
  box.querySelectorAll('[data-ibrestore]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibrestore, 'restore'));
  const more = box.querySelector('#ibMore');
  if (more) more.onclick = () => { _inboxAll = !_inboxAll; renderInboxPanel(); };
  const sdToggle = box.querySelector('#ibSomedayToggle');
  if (sdToggle) sdToggle.onclick = () => { _somedayOpen = !_somedayOpen; renderInboxPanel(); };
}

function renderTodayAlarmBar() {
  const bar = document.getElementById('todayAlarmBar');
  if (!bar) return;
  ensureScoreMeta();
  const r = state.meta.ritual;
  if (r.on === undefined) r.on = true;
  const supported = typeof Notification !== 'undefined';
  const perm = supported ? Notification.permission : 'unsupported';
  // v7.7: 拆成两个互不矛盾的控件 ——
  //   ①「到点提醒」总开关：应用内横幅 + 晨/晚仪式弹窗，任何浏览器都能开关（真正可点、可关）
  //   ②「桌面通知」权限：浏览器安全模型下页面无法自行撤销授权，所以只在能行动时给按钮，
  //      不支持 / 已拒绝时显示说明而不是一个点了没反应的「开启提醒」。
  let permTag, permAct = '';
  if (!supported) permTag = '桌面通知：此浏览器不支持（用页面内横幅提醒即可）';
  else if (perm === 'granted') permTag = '桌面通知：已授权';
  else if (perm === 'denied') permTag = '桌面通知：已被拒绝';
  else permTag = '桌面通知：未授权';
  if (supported && perm === 'default') permAct = `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnEnableAlarm" title="向浏览器申请通知权限">🔔 授权</button>`;
  else if (supported && perm === 'granted') permAct = `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnEnableAlarm" title="浏览器不允许网页自行撤销，点击看关闭步骤">怎么关？</button>`;
  else if (supported && perm === 'denied') permAct = `<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnEnableAlarm" title="去浏览器站点设置里恢复">⚙ 恢复步骤</button>`;

  // v8.0 UX 精简：常驻只留 🌅/🌙 两个时间 + 提醒开关；仪式按钮收进「⏰ 仪式」菜单，权限状态收进菜单说明
  bar.innerHTML = `<label class="alarm-set" title="早上到点弹窗：制订 / 调整今日活动">🌅<input type="time" id="ritualMorning" value="${esc(r.morning || '')}"></label>
    <label class="alarm-set" title="晚上到点弹窗：自动评分与今日总结">🌙<input type="time" id="ritualEvening" value="${esc(r.evening || '')}"></label>
    <label class="alarm-toggle" title="关闭后不再弹晨/晚仪式与页面横幅提醒（不影响任务本身）">
      <input type="checkbox" id="ritualOn" ${r.on !== false ? 'checked' : ''}>
      <span>${r.on !== false ? '🔔' : '🔕'}</span>
    </label>
    <div class="alarm-menu-wrap">
      <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnRitualMenu" title="仪式与回顾：晨计划 / 晚总结 / 周计划 / 周回顾 / 通知设置" aria-expanded="false">⏰ 仪式 ▾</button>
      <div class="alarm-menu" id="ritualMenu" style="display:none">
        <button type="button" class="am-item" id="btnMorningRitual">☀ 晨计划<span class="am-sub">制订 / 调整今日</span></button>
        <button type="button" class="am-item" id="btnEveningRitual">🌙 晚总结<span class="am-sub">评分 + 三件好事</span></button>
        <button type="button" class="am-item" id="btnWeekPlan">🗓 周计划<span class="am-sub">本周大石头</span></button>
        <button type="button" class="am-item" id="btnWeekReviewBar">◔ 周回顾<span class="am-sub">周/月/季统计</span></button>
        <button type="button" class="am-item" id="btnHistory">📜 历史<span class="am-sub">晨/晚/周仪式记录</span></button>
        <div class="am-foot">${permTag} ${permAct}</div>
      </div>
    </div>`;
  const on = document.getElementById('ritualOn');
  if (on) on.onchange = () => {
    state.meta.ritual.on = on.checked; saveMeta();
    renderTodayAlarmBar();
    showToast(on.checked ? '🔔 到点提醒已开启' : '🔕 到点提醒已关闭', 2000);
  };
  // 仪式菜单开合（点击外部关闭）
  const menuBtn = document.getElementById('btnRitualMenu');
  const menu = document.getElementById('ritualMenu');
  if (menuBtn && menu) {
    menuBtn.onclick = e => {
      e.stopPropagation();
      const show = menu.style.display === 'none';
      menu.style.display = show ? 'block' : 'none';
      menuBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
      if (show) setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true }), 0);
    };
  }
  const btn = document.getElementById('btnEnableAlarm');
  if (btn) btn.onclick = () => {
    if (perm === 'default') {
      requestAlarmPermission().then(ok => {
        if (ok) showTodayAlarm('已获得桌面通知授权，到点会弹系统通知', 'success');
        renderTodayAlarmBar();
      });
    } else if (perm === 'granted') {
      alert('桌面通知已授权。\n\n浏览器出于安全考虑，不允许网页自己撤销权限。如需关闭：\n点地址栏左侧的 🔒 图标 → 网站设置 → 通知 → 选「拦截」，然后刷新本页。\n\n只想安静一会儿的话，直接取消勾选左边的「到点提醒」即可，页面内横幅也会一起停掉。');
    } else {
      alert('通知已被拒绝，网页无法自行恢复。\n\n请手动操作：\n点地址栏左侧的 🔒 图标 → 网站设置 → 通知 → 选「允许」，然后刷新本页。\n\n在此期间勾选「到点提醒」仍会使用页面内横幅提醒，不会漏掉晨/晚仪式。');
    }
  };
  const mi = document.getElementById('ritualMorning');
  if (mi) mi.onchange = () => { state.meta.ritual.morning = mi.value || ''; saveMeta(); };
  const ev = document.getElementById('ritualEvening');
  if (ev) ev.onchange = () => { state.meta.ritual.evening = ev.value || ''; saveMeta(); };
  const bm = document.getElementById('btnMorningRitual');
  if (bm) bm.onclick = () => openRitualModal('morning');
  const be = document.getElementById('btnEveningRitual');
  if (be) be.onclick = () => openRitualModal('evening');
  const bw = document.getElementById('btnWeekPlan');
  if (bw) bw.onclick = () => openWeekPlan();
  const br = document.getElementById('btnWeekReviewBar');
  if (br) br.onclick = () => openWeekReview();
  const bh = document.getElementById('btnHistory');
  if (bh) bh.onclick = () => openHistory();
}

// v7.7 需要关注汇总信号外露：执行区头部只放两个可点数字，细节仍在「需要关注」里
function renderTodayAttnPill() {
  const box = document.getElementById('todayAttnPill'); if (!box) return;
  const due = parkedEntries().filter(e => followUpDue(e.node));
  const stale = stagnationAlerts(STALE_DAYS);
  if (!due.length && !stale.length) { box.innerHTML = ''; return; }
  box.innerHTML =
    (due.length ? `<button type="button" class="attn-chip due" data-attn="due" title="${esc(due.slice(0, 3).map(e => e.node.text).join(' / '))}">📣 ${due.length} 需催办</button>` : '') +
    (stale.length ? `<button type="button" class="attn-chip stale" data-attn="stale" title="${esc(stale.slice(0, 3).map(a => a.node.text).join(' / '))}">⚠️ ${stale.length} 停滞</button>` : '');
  box.querySelectorAll('[data-attn]').forEach(b => b.onclick = () => {
    const att = document.getElementById('zoneAttention');
    if (att) att.open = true;
    const target = document.getElementById(b.dataset.attn === 'due' ? 'todayParked' : 'todayStale');
    const inner = target && target.querySelector('details');
    if (inner) inner.open = true;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// v7.6: 显示临时提醒消息（页头顶栏 + toast + 浏览器通知）
/* v7.7: 「到点提醒」总开关的唯一判定入口（state.meta.ritual.on，默认开）。
   以前 alarm bar 显示「不支持通知」却还挂着一个「开启提醒」按钮，且 granted 后没有关闭途径；
   现在开关只管应用内/定时提醒，浏览器授权状态单独一行说明，两者不再互相打脸。 */
function remindersOn() {
  try { ensureScoreMeta(); return state.meta.ritual.on !== false; } catch (e) { return true; }
}
function showTodayAlarm(message, type = 'info') {
  // 1. 显示 toast 通知
  showToast(message, type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info');
  
  // 2. 尝试浏览器桌面通知（已授权 且「到点提醒」总开关开着才发）
  if (remindersOn() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('GoalFlow 目标流', {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🎯</text></svg>',
        tag: 'goalflow-alarm',
      });
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  }
  
  // 3. 在页头显示临时横幅（5秒后自动消失）
  const topbar = document.querySelector('header.topbar');
  if (topbar) {
    const banner = document.createElement('div');
    banner.className = `topbar-banner ${type}`;
    banner.innerHTML = `<span>${esc(message)}</span><button type="button" class="banner-close">✕</button>`;
    topbar.parentNode.insertBefore(banner, topbar.nextSibling);
    banner.querySelector('.banner-close').onclick = () => banner.remove();
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5000);
  }
}
function renderTodayPanel() {
  const mit = document.getElementById('todayMit');
  const slots = document.getElementById('todaySlots');
  const micro = document.getElementById('todayMicro');
  const list = document.getElementById('todayChecklist');
  const cap = document.getElementById('todayCapacity');
  const hint = document.getElementById('todayHint');
  const flowIndicator = document.getElementById('flowIndicator');
  // v6.7 流程指示器：首次显示，点击可隐藏
  if (flowIndicator) {
    const flowSeen = localStorage.getItem('goalflow.flowSeen');
    if (flowSeen === '1') {
      flowIndicator.style.display = 'none';
    } else {
      flowIndicator.style.display = 'flex';
      const closeBtn = document.getElementById('flowIndicatorClose');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          flowIndicator.style.display = 'none';
          try { localStorage.setItem('goalflow.flowSeen', '1'); } catch (e) {}
        };
      }
    }
  }
  if (!mit || !list) return;
  ensureWorkflows();
  flushActiveWorkflow();
  const wfCount = state.workflows.filter(w => (w.nodes || []).length).length;
  if (!wfCount) {
    const wfEmpty = `<div class="empty-state" style="text-align:center;padding:24px 16px;color:var(--muted)">
      <div style="font-size:32px;margin-bottom:8px">🎯</div>
      <div style="font-size:14px;font-weight:500;margin-bottom:4px">还没有目标流</div>
      <div class="empty-hint">去「目标规划」输入并解析你的计划</div>
      <button type="button" class="gf-btn gf-btn--primary" onclick="switchView('plan')">去规划</button>
    </div>`;
    if (slots) slots.innerHTML = wfEmpty; else mit.innerHTML = wfEmpty;
    if (mit && slots) mit.innerHTML = '';
    if (micro) micro.innerHTML = '';
    list.innerHTML = ''; if (cap) cap.innerHTML = '';
    renderTodayScore();
    renderTodayRocks();
    renderTodayStale();
    renderEnergyWidget();
    renderTimeAudit();
    renderInboxCapture();
    renderInboxPanel();
    renderParkedStrip();
    renderTodayAlarmBar();
    renderTodayAttnPill();
    renderBackupTip();
    renderBurnoutTip();
    renderOnboard();
    return;
  }
  const pool = todayAggregatedPool();
  // v8.11: 渲染前时间冲突纠偏 —— 不论来源（AI/手动/导入/跨天转换），今日叶子时间不许重叠；
  // 须在 ensureRemindDefaults 之前（提醒时间以纠偏后的 time 为准）
  ensureTodayTimeResolved(pool);
  // v8.2: 有计划时间的今日任务自动带「开始前 5 分钟」提醒（用户可改可清）
  ensureRemindDefaults(pool.map(x => x.node));
  // MIT 与 syncTop 同源：优先取 syncTop 选出的 Top1，保证「当下最重要」全页一致
  // topId 不在今日池（如周尺度主线）也直接展示，保证两处一致
  // v7.9: MIT 节点可能属于其他项目（全局英雄卡）——byId 只查当前项目会漏，改用跨项目查找
  const topWfId = state.topWfId || state.activeWorkflowId;
  const topNode = state.topId ? (nodeInWorkflow(topWfId, state.topId) || byId(state.topId)) : null;
  const mitEntry = pool.find(x => x.node.id === state.topId)
    || (topNode && !topNode.done ? { node: topNode, wfId: topWfId, wfName: (workflowById(topWfId) || {}).name || '', isWfTop: true } : null)
    || pool.find(x => x.isWfTop && !x.node._overflow) || pool.find(x => !x.node._overflow) || pool[0] || null;  // v8.11: 溢出任务不当 MIT
  const d = dayPlanFeasibilityAll();
  if (cap) {
    const pct = pctOf(d.est, d.cap);
    const wk = weekPlanFeasibility();
    const wpct = pctOf(wk.est, wk.cap);
    const ppg = pctOf(wk.projEst, wk.projCap);
    // v8.0 UX 精简：默认只留「今日可做完性」一条；本周/本项目预算收进折叠
    cap.innerHTML = `<div class="day-capacity${d.over ? ' over' : ''}" title="全部项目今日候选任务预估合计 vs 你在⚙设置里的每日可投入。清单主区已按该预算收敛，超出项标「🌊 溢出」，建议删减或顺延">
      <span>今日可做完性</span><span class="dc-bar"><i style="width:${pct}%"></i></span>
      <span class="dc-num">预估 ${d.est}′ / ${fmtHours(d.cap)}h</span><span class="dc-tag">${d.over ? `超出 ${d.est - d.cap}′` : '可承载'}</span>
    </div>
    <details class="dc-fold"><summary>周预算 ${wk.over ? '<span class="dc-tag over">⚠ 超支</span>' : ''}</summary>
      <div class="day-capacity${wk.over ? ' over' : ''}" title="全部项目本周承诺合计 vs 全局每周容量">
        <span>本周总预算</span><span class="dc-bar"><i style="width:${wpct}%"></i></span>
        <span class="dc-num">已承诺 ${fmtHours(wk.est)}h / ${fmtHours(wk.cap)}h${wk.free >= 0 ? ' · 余 ' + fmtHours(wk.free) + 'h' : ' · 超 ' + fmtHours(-wk.free) + 'h'}</span>
      </div>
      <div class="day-capacity${wk.projOver ? ' over' : ''}" title="仅当前项目本周承诺 vs 当前项目净可投入（全局 − 其他项目占用）">
        <span>本项目预算</span><span class="dc-bar"><i style="width:${ppg}%"></i></span>
        <span class="dc-num">${fmtHours(wk.projEst)}h / ${fmtHours(wk.projCap)}h${wk.projFree >= 0 ? ' · 余 ' + fmtHours(wk.projFree) + 'h' : ' · 超 ' + fmtHours(-wk.projFree) + 'h'}</span>
      </div>
    </details>`;
  }
  renderTodayScore();
  renderTodayRocks();
  renderTodayStale();
  renderEnergyWidget();
  renderTimeAudit();
  renderInboxCapture();
  renderInboxPanel();
  renderBackupTip();
  renderBurnoutTip();
  renderOnboard();
  // 教学条只保留 flowIndicator 一条；有目标后隐藏静态 hint，避免双重 onboarding
  if (hint) hint.style.display = 'none';
  renderTodayAlarmBar();
  renderTodayAttnPill();
  // v7.7 执行区三块合一：MIT 置顶钉住 + 按时间任务 + 习惯子区段，共用一张执行清单
  if (mit) mit.innerHTML = '';
  if (micro) micro.innerHTML = '';
  const isHabitEnt = ent => !!(ent.node.recur || ent.node.role === 'habit');
  const mitId = mitEntry ? mitEntry.node.id : null;
  const matchCtx = ent => !_ctxFilter || (ent.node.tags || []).includes(_ctxFilter);
  const taskPool = pool.filter(ent => !isHabitEnt(ent) && ent.node.id !== mitId && matchCtx(ent));
  const habitPool = pool.filter(ent => isHabitEnt(ent) && ent.node.id !== mitId && matchCtx(ent));
  renderTodayCtxBar(pool.filter(ent => ent.node.id !== mitId));
  if (slots) {
    // 按具体计划时间升序排列；未设时间的按算法重要度排在后面
    // v7.9: 无 time 但有 slot（h0…h6 时段）也参与粗排，排在同时段的无时段任务之前
    const slotRank = s => { const m = /^h(\d)$/.exec(s || ''); return m ? +m[1] : 99; };
    // v8.11: 溢出任务（超今日预算）沉底降权，不与主区按时间混排
    const inPool = taskPool.filter(ent => !ent.node._overflow);
    const overflowed = taskPool.filter(ent => ent.node._overflow);
    const timed = inPool.filter(ent => ent.node.time).sort((a, b) => a.node.time.localeCompare(b.node.time));
    const untimed = inPool.filter(ent => !ent.node.time)
      .sort((a, b) => slotRank(a.node.slot) - slotRank(b.node.slot) || focusScore(b.node) - focusScore(a.node));
    const ordered = timed.concat(untimed).concat(overflowed);
    // v8.13 英雄卡去重：清单内高亮「② 次重要」（算法分仅次于 MIT 的一条），替代原执行栈 #2/#3
    const nextTopId = pickNextTopId(inPool, mitId);
    const execCount = (mitEntry ? 1 : 0) + ordered.length + habitPool.length;
    // v8.7: 工作流过滤开关 —— 默认「🌐 全部项目」（MIT/今日执行跨项目一致）；点开只算当前项目
    const _curWf = workflowById(state.activeWorkflowId);
    const _curWfName = (_curWf && _curWf.name) || '当前项目';
    const wfOnlyBtn = `<button type="button" class="today-wfonly${_wfOnly ? ' on' : ''}" id="todayWfOnlyBtn" title="${_wfOnly ? ('正在只看「' + esc(_curWfName) + '」——点击恢复跨全部项目') : '默认跨全部项目（MIT/今日执行从任何项目进入都一致）——点击只看当前项目'}">${_wfOnly ? '🎯 当前项目' : '🌐 全部项目'}</button>`;
    let sh = `<div class="today-block-h">📋 今日执行 · 按时间 <span class="cnt">${execCount}</span><button type="button" class="help-icon" id="todayExecHelp" title="排序规则 · 点击展开/收起说明">❓</button>${wfOnlyBtn}<span style="flex:1"></span><button type="button" class="today-add" data-add="task" data-add-wf="${state.activeWorkflowId}" title="新增今日任务">＋ 任务</button><button type="button" class="today-add" data-add="habit" data-add-wf="${state.activeWorkflowId}" title="新增每日习惯">＋ 习惯</button></div>`;
    // v8.11: 「被吞」可见性 —— 排到明/后天（≤+3 天）的叶子给提示条，不再无声消失
    {
      const tmrw = [];
      const dk1 = dateKey(new Date(today0().getTime() + 86400000));
      const dk3 = dateKey(new Date(today0().getTime() + 3 * 86400000));
      activeWorkflows().forEach(wf => {
        if (!wfStarted(wf)) return;
        (wf.nodes || []).forEach(n => {
          if (!n || n.done || !n.parentId) return;
          if ((wf.nodes || []).some(x => x.parentId === n.id)) return;  // 只要叶子
          const pd = String(n.planDate || '');
          if (pd.length >= 10 && pd.slice(0, 10) >= dk1 && pd.slice(0, 10) <= dk3) {
            tmrw.push({ n, wfName: wf.name || '', dk: pd.slice(0, 10), hm: pd.length >= 16 ? pd.slice(11, 16) : '' });
          }
        });
      });
      if (tmrw.length) {
        tmrw.sort((a, b) => a.dk.localeCompare(b.dk) || a.hm.localeCompare(b.hm));
        const lbl = dk => dk === dk1 ? '明天' : (dk === dateKey(new Date(today0().getTime() + 2 * 86400000)) ? '后天' : dk.slice(5));
        const tops = tmrw.slice(0, 3).map(t => `${esc(t.n.text.slice(0, 12))}（${lbl(t.dk)}${t.hm ? ' ' + t.hm : ''}）`).join('、');
        sh += `<div class="today-shifted-hint" title="这些叶子排到了今后几天，到当天会自动转入今日清单">🗓 ${tmrw.length} 项排在今后几天：${tops}${tmrw.length > 3 ? ` 等 ${tmrw.length} 项` : ''}</div>`;
      }
    }
    if (!execCount) {
      sh += `<div class="empty-state">📋 暂无任务<br><span class="es-sub">从「目标规划」生成，或点右上「＋ 任务」</span><br><button type="button" class="gf-btn gf-btn--sm" style="margin-top:8px" data-add="task" data-add-wf="${state.activeWorkflowId}">＋ 新增任务</button></div>`;
    } else {
      if (mitEntry) {
        // v8.13 英雄卡去重：番茄时长下拉 / 📌取消固定 / 📊得分分解，从英雄卡迁入 MIT 区（不再整卡重复展示）
        const mitN = mitEntry.node;
        const mitFs = focusScoreParts(mitN);
        const mitParts = mitFs.parts.filter(p => p.pts !== 0 && !p.note).slice(0, 4);
        const mitPartsHtml = mitParts.map(p => `<span class="fs-item${p.pts < 0 ? ' neg' : ''}">${esc(p.label)} <b>${p.pts > 0 ? '+' + p.pts : p.pts}</b></span>`).join('<span class="fs-sep">·</span>');
        const mitProg = subtreeProgress(mitN);
        const mitProgPill = mitProg ? `<span class="pill">📈 子树 ${mitProg.pct}%（${mitProg.done}/${mitProg.total}）</span>` : '';
        const mitSprint = mitProg && mitProg.pct >= 80 && mitProg.pct < 100
          ? `<span class="pill pill-sprint" title="目标梯度效应：越接近完成动力越强">🔥 冲刺 · 还剩 ${mitProg.total - mitProg.done} 个叶子</span>` : '';
        const mitPace = paceStatus(mitN);
        const mitPacePill = mitPace ? `<span class="pill pace" title="相对期限应有进度">节奏 ${mitPace.ahead >= 0 ? '领先' : '落后'} ${Math.abs(mitPace.ahead)}</span>` : '';
        const mitMp = metricProgress(mitN);
        const mitMpPill = mitMp && mitMp.kind !== 'leaf' ? `<span class="pill">📊 ${mitMp.done}/${mitMp.tgt}</span>` : '';
        sh += `<div class="today-mit-pin"><div class="mit-pin-head"><span class="mit-pin-lbl">🎯 MIT · 当下最重要</span>` +
          `<select class="gf-input gf-select mit-pomo-len" id="pomoLen" title="专注时长：25′ 标准 / 50′ 长专注 / 90′ 深潜（BRAC 完整周期，评分加权）——配合行内 🍅 启动"><option value="25" selected>🍅 25′</option><option value="50">🍅 50′</option><option value="90">🌊 90′</option></select>` +
          (state.topPin === mitN.id ? `<button type="button" class="mit-unpin" id="btnUnpinTop" title="你在日历/洞察里手动固定了这件，算法暂不接管">📌 已固定 · 取消</button>` : '') +
          `</div>${todayRowHtml(mitEntry, { micro: true, pomo: true })}` +
          `<details class="mit-score-fold"><summary>📊 得分 ${mitFs.total} · 进度与分解</summary><div class="hero-more">${mitProgPill}${mitMpPill}${mitPacePill}${mitSprint}</div><div class="hero-score" title="为什么选这个：${mitParts.map(p => p.label).join('、')}">${mitPartsHtml}</div></details>` +
          `</div>`;
      }
      if (ordered.length) {
        // v8.11: 溢出区前插分隔行（沉底区块的标题）
        let ovfSplit = false;
        sh += ordered.map(ent => {
          const div = (!ovfSplit && ent.node._overflow)
            ? (ovfSplit = true, `<div class="today-sec-div">🌊 溢出 · 超出今日可投入，建议顺延或删减 <span class="cnt">${overflowed.length}</span></div>`)
            : '';
          return div + todayRowHtml(ent, ent.node.id === nextTopId ? { nextTop: true } : undefined);
        }).join('');
      } else if (!habitPool.length) {
        sh += `<div class="empty-state">📋 暂无其他任务<br><span class="es-sub">专注 MIT 即可，或点右上「＋ 任务」追加</span></div>`;
      }
      if (habitPool.length) {
        // v6.4 按触发线索（⚓ anchor）聚类：有线索的分组在前，未设的沉底提醒
        const groups = {};
        habitPool.forEach(ent => { const k = (ent.node.anchor || '').trim(); (groups[k] = groups[k] || []).push(ent); });
        const aKeys = Object.keys(groups).filter(k => k).sort();
        const una = groups[''] || [];
        sh += `<div class="today-sec-div">🔁 习惯打卡 <span class="cnt">${habitPool.length}</span></div>`;
        sh += aKeys.map(k => `<div class="habit-anchor-h">⚓ ${esc(k)}之后</div>` + groups[k].map(ent => todayRowHtml(ent)).join('')).join('');
        if (una.length) sh += (aKeys.length ? '<div class="habit-anchor-h dim">未设触发线索 · 点行尾 ⚓ 补上，习惯更容易活下来</div>' : '') + una.map(ent => todayRowHtml(ent)).join('');
      }
    }
    slots.innerHTML = sh;
    // v8.7: 工作流过滤开关接线（innerHTML 重建后需重绑）
    const wfOnlyEl = slots.querySelector('#todayWfOnlyBtn');
    if (wfOnlyEl) wfOnlyEl.onclick = () => toggleTodayWfOnly();
    // v8.14: ❓ 可点击展开/收起排序说明（原只有 hover title——移动端无 hover，桌面用户也习惯点击）
    const helpEl = slots.querySelector('#todayExecHelp');
    if (helpEl) helpEl.onclick = () => {
      const old = slots.querySelector('.today-exec-help');
      if (old) { old.remove(); helpEl.classList.remove('on'); return; }
      helpEl.classList.add('on');
      helpEl.closest('.today-block-h').insertAdjacentHTML('afterend',
        `<div class="today-exec-help">排序规则：设了「🕐 计划时间」的任务按时间升序排在最前；未设时间的按算法重要度排在其后；🌊 溢出（超今日预算）沉底。行尾 ⋯ 可设计划时间与估时；🎯 MIT 与 ② 次重要由算法钉选，不参与普通排序。</div>`);
    };
    // v8.13: MIT 区「📌 取消固定」（英雄卡移除后的承接入口）
    const unpinEl = slots.querySelector('#btnUnpinTop');
    if (unpinEl) unpinEl.onclick = () => {
      const prev = state.topPin;
      state.topPin = null; save(); afterChange();
      showUndoToast('已取消固定，交回算法排序', () => { state.topPin = prev; save(); afterChange(); });
    };
  }
  // 等待 / 阻塞区：可见但退出竞选（提醒在等什么）
  renderParkedStrip();
  const todayLog = ((state.meta && state.meta.executionLog) || {})[dateKey()] || null;
  const doneEntries = todayLog ? (todayLog.entries || []) : [];
  // v8.14: 已完成行补「完成时刻 + 单项得分」——用户反馈完成两项后「看不到第 N 项的分数/顺序摸不着头脑」；
  // 列表保持完成时间升序（日志 append 序），时刻戳让顺序自明
  const scoreLogToday = (state.meta && state.meta.scoreLog) ? state.meta.scoreLog[dateKey()] : null;
  if (list) {
    list.innerHTML = `<div class="today-block-h">✅ 今日已完成 <span class="cnt">${doneEntries.length}</span></div>` +
      (doneEntries.length
        ? doneEntries.map(en => {
            const dsc = scoreOfDoneEntry(en, scoreLogToday);
            const hm = en.t ? (() => { const dt = new Date(en.t); return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()); })() : '';
            return `<div class="today-done-row">${hm ? `<span class="today-meta done-hm" title="完成时刻 · 列表按完成先后排序">${hm}</span>` : ''}<b>${esc(en.text)}</b>${en.wfName ? `<span class="today-meta wf-tag">${esc(en.wfName)}</span>` : ''}${en.act ? `<span class="today-meta">实计 ${en.act}′</span>` : ''}${dsc ? `<span class="today-meta done-score" title="完成得分 · ${esc(dsc.reason || '按重要度/期限/时长加权')}">${dsc.score >= 0 ? '+' : ''}${dsc.score}分</span>` : ''}</div>`;
          }).join('')
        : '<div class="empty-state">✅ 完成后会显示在这里</div>');
  }
  bindTodayPanel(mit); bindTodayPanel(micro); bindTodayPanel(slots); bindTodayPanel(list);
}
/* ============ 今日三区：状态摘要 / 提醒角标 / 折叠记忆 ============ */
function zoneOpenPref(id, def) {
  try { const v = localStorage.getItem('goalflow.zone.' + id); if (v === '1') return true; if (v === '0') return false; } catch (e) { }
  return def;
}
function bindZonePersist(el) {
  if (!el || el._zoneBound) return; el._zoneBound = true;
  el.addEventListener('toggle', () => { try { localStorage.setItem('goalflow.zone.' + el.id, el.open ? '1' : '0'); } catch (e) { } });
}
function updateTodayZones() {
  const att = document.getElementById('zoneAttention');
  const st = document.getElementById('zoneStatus');
  const fo = document.getElementById('zoneFocus');
  const ids = ['onboardCard', 'todayBackupBar', 'todayBurnout', 'todayStale', 'todayParked', 'inboxPanel'];
  let n = 0;
  ids.forEach(id => { const el = document.getElementById(id); if (el && el.innerHTML.trim()) n++; });
  const rb = document.getElementById('reviewBanner'); if (rb && rb.classList.contains('show')) n++;
  const badge = document.getElementById('attentionBadge');
  if (badge) badge.textContent = n ? `(${n})` : '';
  if (att) {
    const onboard = document.getElementById('onboardCard');
    att.open = (onboard && onboard.innerHTML.trim()) ? true : zoneOpenPref('zoneAttention', false);
    bindZonePersist(att);
  }
  if (st) {
    st.open = zoneOpenPref('zoneStatus', false);
    bindZonePersist(st);
    const sum = document.getElementById('statusSum');
    if (sum) {
      const ts = todayScore();
      const d = dayPlanFeasibilityAll();
      sum.textContent = `${ts.total} 分 · ${ts.grade || '—'} · ${d.over ? `超出预算 ${d.est - d.cap}′` : '可承载'}`;
    }
  }
  if (fo) { fo.open = zoneOpenPref('zoneFocus', false); bindZonePersist(fo); }
}
/* ============ 多视图导航（今日 / 规划 / 洞察） ============ */
const VIEWS = { today: '今日行动', plan: '目标规划', insights: '归纳洞察', ai: 'AI 分析' };
function currentView() {
  try { const v = localStorage.getItem('goalflow.view'); if (VIEWS[v]) return v; } catch (e) { }
  return 'today';
}
function switchView(name, opts) {
  if (!VIEWS[name]) name = 'today';
  // v6.8 显示加载状态
  const targetView = document.querySelector(`.main-scroll .view[data-view="${name}"]`);
  if (targetView && !opts?.silent) {
    targetView.classList.add('loading');
  }
  document.querySelectorAll('.main-scroll .view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === name));
  const crumb = document.getElementById('crumbSection'); if (crumb) crumb.textContent = VIEWS[name];
  renderAppTitle();
  try { localStorage.setItem('goalflow.view', name); } catch (e) { }
  const ms = document.querySelector('.main-scroll'); if (ms) ms.scrollTop = 0;
  if (!opts || !opts.silent) { try { history.replaceState(null, '', '#/' + name); } catch (e) { } }
  // 此时 .view.on 已切好，补渲染的是可见状态的 DOM，不必再等一帧
  if (_viewStale[name]) renderViewGroup(name);
  // v6.8 渲染完成后移除加载状态
  if (targetView) {
    setTimeout(() => targetView.classList.remove('loading'), 300);
  }
}
function scrollToToday() { switchView('today'); }
// v6.4 快速捕捉入口：切到今日视图并聚焦 inbox 输入框
function quickCapture() {
  switchView('today');
  setTimeout(() => {
    const inp = document.getElementById('ibQuick');
    if (inp) { try { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { inp.scrollIntoView(); } inp.focus(); }
  }, 80);
}

/* ============ 全局搜索 + 快速捕获（跨工作流找回 / 无摩擦捕获） ============ */
function searchNodes(q) {
  ensureWorkflows(); flushActiveWorkflow();
  const ql = String(q || '').toLowerCase();
  if (!ql) return [];
  const out = [];
  (state.workflows || []).forEach(wf => {
    (wf.nodes || []).forEach(n => {
      const hay = [n.text, (n.tags || []).join(' '), n.waitNote || '', n.ifThen || ''].join(' ').toLowerCase();
      if (hay.includes(ql)) {
        const tl = (n.text || '').toLowerCase();
        const rank = tl.startsWith(ql) ? 0 : tl.includes(ql) ? 1 : 2;
        out.push({ node: n, wfId: wf.id, wfName: wf.name || '', rank });
      }
    });
  });
  out.sort((a, b) => a.rank - b.rank || (a.node.done ? 1 : 0) - (b.node.done ? 1 : 0));
  return out.slice(0, 40);
}
function locateNode(wfId, id) {
  if (wfId && wfId !== state.activeWorkflowId) switchWorkflow(wfId);
  switchView('plan');
  afterChange();
  setTimeout(() => {
    const row = document.querySelector(`#treeEditor .trow[data-id="${id}"]`);
    if (row) {
      try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { row.scrollIntoView(); }
      row.classList.add('trow-hl');
      setTimeout(() => row.classList.remove('trow-hl'), 1600);
    }
  }, 80);
}
function openGlobalSearch() {
  const overlay = document.getElementById('searchModal');
  if (!overlay) return;
  overlay.innerHTML = `<div class="modal search-modal" role="dialog" aria-label="全局搜索">
    <div class="gs-bar"><span class="gs-ic">🔍</span><input id="gsInput" class="gs-input" placeholder="搜索任务 / 标签 / 等待备注… 输入新事项回车捕获到收件箱" autocomplete="off"><span class="gs-kbd">Esc</span></div>
    <div class="gs-results" id="gsResults"></div>
    <div class="gs-foot" id="gsFoot"></div>
  </div>`;
  overlay.classList.add('show');
  const inp = overlay.querySelector('#gsInput');
  const results = overlay.querySelector('#gsResults');
  const foot = overlay.querySelector('#gsFoot');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  let active = -1, current = [];
  const paint = () => {
    results.querySelectorAll('.gs-row').forEach((r, i) => r.classList.toggle('on', i === active));
    const on = results.querySelector('.gs-row.on');
    if (on) { try { on.scrollIntoView({ block: 'nearest' }); } catch (e) { } }
  };
  const capture = q => {
    const it = addInbox(q);
    showToast(it ? `⚡ 已捕获到收件箱：「${q.slice(0, 16)}」` : '⚠️ 内容为空');
    afterChange();
  };
  const render = () => {
    const q = inp.value.trim();
    current = searchNodes(q);
    active = current.length ? 0 : -1;
    if (!q) {
      results.innerHTML = `<div class="gs-empty">输入关键词搜索全部项目的任务。<br><span>支持文案 / 情境标签 / 等待备注 · 快捷键 Ctrl+K 或 /</span></div>`;
      foot.innerHTML = '';
      return;
    }
    results.innerHTML = current.length
      ? current.map((e, i) => {
        const n = e.node;
        const meta = [e.wfName, n.deadline ? '⏱ ' + n.deadline : '', (n.tags && n.tags.length) ? n.tags.join(' ') : '', n.done ? '✓ 已完成' : ''].filter(Boolean).join(' · ');
        return `<div class="gs-row${n.done ? ' done' : ''}" data-i="${i}"><span class="gs-txt">${esc(n.text)}</span><span class="gs-meta">${esc(meta)}</span></div>`;
      }).join('')
      : `<div class="gs-empty">没有匹配「${esc(q)}」的任务。</div>`;
    foot.innerHTML = `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="gsCapture">⚡ 捕获「${esc(q.slice(0, 18))}」到收件箱</button><span class="gs-hint">回车打开第一条 · ↑↓ 选择 · Esc 关闭</span>`;
    const cap = foot.querySelector('#gsCapture');
    if (cap) cap.onclick = () => { capture(q); close(); };
    results.querySelectorAll('.gs-row').forEach(r => r.onclick = () => {
      const e = current[+r.dataset.i];
      if (e) { close(); locateNode(e.wfId, e.node.id); }
    });
    paint();
  };
  inp.oninput = render;
  inp.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (current.length) { active = (active + 1) % current.length; paint(); } return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (current.length) { active = (active - 1 + current.length) % current.length; paint(); } return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (current.length && active >= 0) { const e2 = current[active]; close(); locateNode(e2.wfId, e2.node.id); }
      else if (inp.value.trim()) { capture(inp.value.trim()); close(); }
      return;
    }
  };
  overlay.onclick = e => { if (e.target === overlay) close(); };
  render();
  setTimeout(() => inp.focus(), 30);
}

/* ============ 聚焦清单（按尺度过滤） ============ */
function renderFocus() {
  const box = document.getElementById('todayFocus');
  let items = state.nodes.filter(n => n.parentId && !n.done);
  if (state.scale !== 'all') items = items.filter(n => n.scale === state.scale);
  const vis = state.nodes.length ? buildView(state.nodes, state.scale) : [];
  const top3 = pickRanked(vis, 3);
  const now = items.filter(n => n.im >= 4 && n.ur >= 4).sort((a, b) => focusScore(b) - focusScore(a));
  const core = items.filter(n => n.im >= 4 && n.ur < 4).sort((a, b) => focusScore(b) - focusScore(a));
  const li = (n, rank, showToday) => {
    const dl = n.deadline ? (n.overdue ? `<span class="dl">⏰ 逾期${-n.daysLeft}天</span>` : `<span class="dl">⏱ ${esc(n.deadline)}·剩${n.daysLeft}天</span>`) : '';
    const slot = n.slot ? `<span class="dl">🕐 ${esc((DAY_SLOTS.find(s => s[0] === n.slot) || ['', ''])[1])}</span>` : '';
    const est = n.estimateMinutes != null ? `<span class="dl">⏳ ${n.estimateMinutes}分</span>` : '';
    const act = n.actualMinutes != null ? `<span class="dl">✓ ${n.actualMinutes}分</span>` : '';
    const rk = rank != null ? `<span class="dl">#${rank}</span>` : '';
    const todayBtn = showToday ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary fitem-today" data-today="${n.id}" title="把这条加入今天任务">→今天</button>` : '';
    return `<div class="fitem ${n.overdue ? 'overdue' : ''}">${rk}${esc(n.text)}${dl}${slot}${est}${act}${todayBtn}</div>`;
  };
  const sc = state.scale === 'all' ? '全部' : (SCALE_LABEL[state.scale] + '重点');
  const top3Html = top3.length ? `<div class="fgroup top3"><h3>★ 可完成焦点 Top ${top3.length}<span class="cnt">算法排序 · 不含 Backlog</span></h3>${top3.map((n, i) => li(n, i + 1)).join('')}</div>` : '';
  const lanes = backlogLanes();
  const lane = arr => arr.length ? arr.map(n => li(n, null, true)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>';
  box.innerHTML = `<div class="empty-hint">当前视图：${sc}${state.scale === 'all' ? '（含各尺度）' : ''}</div>
    ${top3Html}
    <div class="fgroup now"><h3>🔴 立即做（重要且紧急）<span class="cnt">${now.length} 项</span></h3>${now.length ? now.map(n => li(n)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup core"><h3>🔵 核心投入（重要不紧急）<span class="cnt">${core.length} 项</span></h3>${core.length ? core.map(n => li(n)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup backlog lw"><h3>🌊 上周未完成 Backlog<span class="cnt">${lanes.lastWeek.length} 项</span></h3>${lane(lanes.lastWeek)}</div>
    <div class="fgroup backlog nm"><h3>🔭 下月预告<span class="cnt">${lanes.nextMonth.length} 项</span></h3>${lane(lanes.nextMonth)}</div>`;
  box.querySelectorAll('[data-today]').forEach(b => b.onclick = () => promoteNodeToToday(b.dataset.today));
}
/* v8.8: 今日空闲时间 —— 跨全部项目收集今日已排 time 块（时间是共享资源，不能只看本项目），
   在该项目每日窗口内找第一段能放下 durMin 的空隙（块间 10 分钟缓冲，与 backfill 一致）。
   已过的时间不排（从 max(窗口起点, 现在+5分钟) 起）。找不到返回 null。
   _nowMin 仅供测试注入（分钟数），生产留空用真实当前时间。 */
function nextFreeTimeToday(wfId, durMin, _nowMin) {
  const dur = Math.max(15, +durMin || 30);
  const wins = wfTimeWindows(wfId);
  const spans = wins.length ? wins.map(w => [hmToMin(w.start), hmToMin(w.end)]) : [[9 * 60, 22 * 60]];
  const busy = [];
  (state.workflows || []).forEach(wf => (wf.nodes || []).forEach(n => {
    if (n.done || !n.time) return;
    const s = hmToMin(n.time); if (s == null || isNaN(s)) return;
    busy.push([s, s + (n.estimateMinutes || 30)]);
  }));
  busy.sort((a, b) => a[0] - b[0]);
  const nowM = _nowMin != null ? _nowMin : (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + 5; })();
  for (const [ws, we] of spans) {
    let cur = Math.max(ws, nowM);
    for (const [bs, be] of busy) {
      if (be <= ws || bs >= we) continue;      // 与本窗口不相交
      if (be <= cur) continue;                  // 已过去
      if (bs - cur >= dur) return minToHm(cur); // 空隙够放
      cur = Math.max(cur, be + 10);             // 顺接到该块后 + 10min
    }
    if (we - cur >= dur) return minToHm(cur);   // 窗口尾部空隙
  }
  return null;
}
/* 把一条既有节点（Backlog / 备选）提升为今日任务 —— v8.8: 自动分配今日空闲时间 + 可撤回 */
function promoteNodeToToday(id) {
  const n = byId(id); if (!n) return;
  // 字段级快照用于撤回（不动子树，只恢复本节点的排期相关字段）
  const snap = {
    scale: n.scale, deadline: n.deadline, deadlineText: n.deadlineText, deadlineDate: n.deadlineDate,
    daysLeft: n.daysLeft, overdue: n.overdue, time: n.time, planDate: n.planDate, slot: n.slot,
  };
  n.scale = 'day'; n.deadline = '今天'; n.deadlineText = '今天'; n.deadlineDate = today0(); n.daysLeft = 0; n.overdue = false;
  try { ensureEstimate(n, true); } catch (e) { }
  const hm = nextFreeTimeToday(state.activeWorkflowId, n.estimateMinutes || 30);
  if (hm) { n.time = hm; n.planDate = ''; }
  recomputeSchedule(state.nodes); save(); afterChange();
  const whenTxt = hm ? ` · 已自动排 ${hm}` : ' · 今日窗口已满，未自动排时间';
  showUndoToast(`已加入今天：「${esc((n.text || '').slice(0, 16))}」${whenTxt}`, () => {
    Object.assign(n, snap);
    recomputeSchedule(state.nodes); save(); afterChange();
  });
}

/* ============ 内联树编辑（Planner 式维护） ============ */
const _treeRowExpanded = new Set();

/* v8.9 节点级引用级联清理：节点（或整树）被删后，把指向它们的散落引用一并清掉，
   否则会出现「删了还在 / 点了没反应」的孤儿（大石头、明晚预选、习惯打卡）。
   backup=true 时返回被清内容，供 undo 一并还原。 */
function purgeNodeRefs(wfId, droppedIds, backup) {
  const bak = backup ? { rocks: {}, tomorrowMit: null, streaks: {} } : null;
  if (!droppedIds || !droppedIds.size) return bak;
  try {
    const wp = (state.meta && state.meta.weekPlans) || {};
    Object.keys(wp).forEach(wk => {
      const rocks = (wp[wk] && wp[wk].rocks) || [];
      const dead = rocks.filter(r => r && droppedIds.has(r.nodeId));
      if (dead.length) {
        if (bak) bak.rocks[wk] = dead;
        wp[wk].rocks = rocks.filter(r => !(r && droppedIds.has(r.nodeId)));
      }
    });
    const tm = state.meta && state.meta.tomorrowMit;
    if (tm && droppedIds.has(tm.nodeId)) {
      if (bak) bak.tomorrowMit = tm;
      delete state.meta.tomorrowMit;
    }
    if (wfId) {
      const hs = (state.meta && state.meta.habitStreaks) || {};
      const prefix = wfId + '|';
      Object.keys(hs).forEach(k => {
        if (k.indexOf(prefix) === 0 && droppedIds.has(k.slice(prefix.length))) {
          if (bak) bak.streaks[k] = hs[k];
          delete hs[k];
        }
      });
    }
  } catch (e) { }
  return bak;
}
function restoreNodeRefs(bak) {
  if (!bak) return;
  try {
    const wp = (state.meta && state.meta.weekPlans) || {};
    Object.keys(bak.rocks || {}).forEach(wk => {
      if (wp[wk]) wp[wk].rocks = (wp[wk].rocks || []).concat(bak.rocks[wk]);
    });
    if (bak.tomorrowMit) state.meta.tomorrowMit = bak.tomorrowMit;
    const hs = (state.meta && state.meta.habitStreaks) || {};
    Object.keys(bak.streaks || {}).forEach(k => { hs[k] = bak.streaks[k]; });
  } catch (e) { }
}

/* v8.9 整树替换前置清理：当前流旧节点 id 即将全作废 → 先清掉指向它们的引用。
   新建流/空树时为空集，天然 no-op；doParse / AI 分解 / 模板应用共用。 */
function purgeCurrentTreeRefs() {
  const oldIds = new Set((state.nodes || []).map(x => x.id));
  if (!oldIds.size) return;
  purgeNodeRefs(state.activeWorkflowId, oldIds);
  if (state.topPin && oldIds.has(state.topPin)) state.topPin = null;
  if (state.pomo && oldIds.has(state.pomo.nodeId)) state.pomo.nodeId = null;
  saveMeta();
}

/* v8.9 项目级引用清理：删除/清空工作流时，清掉 meta 里指向它的散落引用
   （大石头/待办行动/明晚预选/计划带宽/时间预算/习惯打卡/全局置顶/番茄钟）。
   deleteWorkflow 与 clearAll 共用；节点级清理用 purgeNodeRefs。 */
function purgeWorkflowRefs(wfId) {
  try {
    const wp = (state.meta && state.meta.weekPlans) || {};
    Object.keys(wp).forEach(wk => {
      if (wp[wk] && Array.isArray(wp[wk].rocks)) wp[wk].rocks = wp[wk].rocks.filter(r => r.wfId !== wfId);
    });
    if (Array.isArray(state.meta && state.meta.pendingActions)) state.meta.pendingActions = state.meta.pendingActions.filter(a => a.wfId !== wfId);
    if (state.meta && state.meta.tomorrowMit && state.meta.tomorrowMit.wfId === wfId) delete state.meta.tomorrowMit;
    if (state.meta && state.meta.planShare) delete state.meta.planShare[wfId];
    if (state.meta && state.meta.capacity) delete state.meta.capacity[wfId];
    const hs = (state.meta && state.meta.habitStreaks) || {};
    Object.keys(hs).forEach(k => { if (k.indexOf(wfId + '|') === 0) delete hs[k]; });
    if (state.topWfId === wfId) state.topWfId = null;
    if (state.pomo && state.pomo.wfId === wfId) { state.pomo.wfId = null; state.pomo.nodeId = null; }
  } catch (e) { }
}

function deleteNode(id) {
  const root = state.nodes[0];
  if (!root || id === root.id) return;
  // v6.3 撤销：删前快照（当前流 nodes + topId）
  const snapNodes = JSON.parse(JSON.stringify(state.nodes));
  const snapTop = state.topId;
  const snapPin = state.topPin;
  const target = state.nodes.find(n => n.id === id);
  const drop = new Set();
  (function w(nid) { drop.add(nid); state.nodes.filter(x => x.parentId === nid).forEach(c => w(c.id)); })(id);
  // v8.9: 级联清理指向被删子树的引用（先备份 → undo 时一并还原，不然撤销会丢大石头/习惯打卡）
  const refBackup = purgeNodeRefs(state.activeWorkflowId, drop, true);
  state.nodes = state.nodes.filter(n => !drop.has(n.id));
  if (drop.has(state.topId)) state.topId = null;
  if (drop.has(state.topPin)) state.topPin = null;
  // v8.9: 番茄钟绑定的任务被删 → 解绑（计时本身保留，显示层已有空兜底）
  if (state.pomo && drop.has(state.pomo.nodeId)) state.pomo.nodeId = null;
  recomputeSchedule(state.nodes); save(); saveMeta(); afterChange();
  showUndoToast(`已删除「${esc((target && target.text || '').slice(0, 14))}」及其子树（${drop.size} 个节点）`, () => {
    state.nodes = snapNodes; state.topId = snapTop; state.topPin = snapPin;
    restoreNodeRefs(refBackup);
    recomputeSchedule(state.nodes); save(); saveMeta(); afterChange();
  });
}
function addTreeChild(pid) {
  const parent = byId(pid); if (!parent) return;
  insertChildren(pid, ['新子任务（可在此编辑）']);
}
function renderTreeEditor() {
  const box = document.getElementById('treeEditor'); if (!box) return;
  const hint = document.getElementById('treeEditorHint');
  if (!state.nodes.length) {
    box.innerHTML = `<div class="empty-state" style="text-align:center;padding:24px 16px;color:var(--muted)">
      <div style="font-size:32px;margin-bottom:8px">🌳</div>
      <div style="font-size:14px;font-weight:500;margin-bottom:4px">还没有目标树</div>
      <div class="empty-hint">在上方文本框粘贴计划后点「解析并生成」</div>
    </div>`;
    return;
  }
  getCachedTree(state.nodes);
  ensureAllEstimates();
  const keepScroll = (box.__scrollY && box.__scrollY['']) || 0;
  box.innerHTML = '';

  // 说明块：首见可关（与今日教学条同一模式）
  let hintSeen = false;
  try { hintSeen = localStorage.getItem('goalflow.treeHintSeen') === '1'; } catch (e) { }
  if (!hintSeen) {
    const hintDiv = document.createElement('div');
    hintDiv.className = 'tree-editor-hint';
    hintDiv.innerHTML = `
      <b>📝 树形维护说明</b><button type="button" class="tree-hint-close" title="不再显示">✕</button><br>
      · <b>文案</b>：直接编辑，回车保存 · <b>⋯</b>：展开 重要/紧急/预估/实际 等高级字段<br>
      · <b>枝/叶</b>：枝=有子任务，叶=最底层任务 · <b>✓</b>：叶子可勾选完成 · 拖拽行可换父
    `;
    hintDiv.querySelector('.tree-hint-close').onclick = () => {
      hintDiv.remove();
      try { localStorage.setItem('goalflow.treeHintSeen', '1'); } catch (e) { }
    };
    box.appendChild(hintDiv);
  }

  treeOrder(state.nodes).forEach(n => {
    const isLeaf = n.parentId && n._children.length === 0;
    const expanded = _treeRowExpanded.has(n.id);
    const row = document.createElement('div');
    row.className = 'trow' + (n.id === state.topId ? ' trow-top' : '') + (expanded ? ' expanded' : '');
    row.draggable = true;
    row.dataset.id = n.id;
    row.style.paddingLeft = (n.depth * 12 + 6) + 'px';
    const txt = document.createElement('input');
    txt.className = 'gf-input trow-txt'; txt.value = n.text; txt.dataset.id = n.id;
    txt.title = n.text;
    const meta = document.createElement('span');
    meta.className = 'trow-meta';
    // v7.8: 叶子直接露出「哪天几点」，AI 排期一眼可核对
    const schedMeta = isLeaf && (n.deadlineDate || n.time)
      ? (n.deadlineDate ? ' 📅' + dateKey(new Date(n.deadlineDate)).slice(5) : '') + (n.time ? ' 🕐' + n.time : '')
      : '';
    meta.textContent = (isLeaf ? '叶' : '枝') + schedMeta;
    row.appendChild(txt); row.appendChild(meta);
    if (isLeaf) {
      const done = document.createElement('label');
      done.className = 'trow-done';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!n.done; cb.dataset.id = n.id;
      done.appendChild(cb); done.appendChild(document.createTextNode('✓'));
      row.appendChild(done);
    }
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button'; moreBtn.className = 'gf-btn gf-btn--sm gf-btn--ghost trow-more-btn';
    moreBtn.dataset.act = 'more'; moreBtn.dataset.id = n.id;
    moreBtn.title = '展开高级字段：重要 / 紧急 / 预估 / 实际 / 子任务';
    moreBtn.textContent = expanded ? '▲' : '⋯';
    row.appendChild(moreBtn);
    // 高级字段：收进行展开（重要/紧急手动后不被文本重推断覆盖）
    const more = document.createElement('div');
    more.className = 'trow-more';
    const imInp = document.createElement('input');
    imInp.type = 'number'; imInp.min = '1'; imInp.max = '5'; imInp.className = 'trow-im';
    imInp.value = n.im; imInp.title = '重要度（1-5，手动后文本推断不再覆盖）'; imInp.dataset.id = n.id;
    const urInp = document.createElement('input');
    urInp.type = 'number'; urInp.min = '1'; urInp.max = '5'; urInp.className = 'trow-ur';
    urInp.value = n.ur; urInp.title = '紧急度（1-5，手动后文本推断不再覆盖）'; urInp.dataset.id = n.id;
    more.appendChild(imInp); more.appendChild(urInp);
    if (isLeaf) {
      const est = document.createElement('input');
      est.type = 'number'; est.min = '0'; est.step = '5'; est.className = 'trow-est';
      est.value = n.estimateMinutes ?? ''; est.placeholder = '分'; est.title = '预估时长'; est.dataset.id = n.id;
      const act = document.createElement('input');
      act.type = 'number'; act.min = '0'; act.step = '5'; act.className = 'trow-act';
      act.value = n.actualMinutes ?? ''; act.placeholder = '实'; act.title = '实际时长'; act.dataset.id = n.id;
      more.appendChild(est); more.appendChild(act);
    }
    const child = document.createElement('button');
    child.type = 'button'; child.className = 'gf-btn gf-btn--sm'; child.textContent = '+子'; child.dataset.act = 'child'; child.dataset.id = n.id;
    more.appendChild(child);
    if (n.parentId) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'gf-btn gf-btn--sm gf-btn--ghost'; del.textContent = '×'; del.dataset.act = 'del'; del.dataset.id = n.id;
      more.appendChild(del);
    }
    row.appendChild(more);
    box.appendChild(row);
  });
  bindTreeEditorDelegation();
  if (hint) hint.textContent = `共 ${state.nodes.length} 节点 · 叶子进度见顶栏（仅叶计完成）· 拖拽行可换父`;
  box.scrollTop = keepScroll;
}
/* 树编辑器的行会整批重建，监听只挂在容器上：一次重绘少挂 O(行数×8) 个 handler */
let _treeBound = false;
function bindTreeEditorDelegation() {
  if (_treeBound) return;
  const box = document.getElementById('treeEditor'); if (!box) return;
  _treeBound = true;
  box.addEventListener('change', e => {
    const t = e.target; const id = t.dataset && t.dataset.id; if (!id) return;
    const n = byId(id); if (!n) return;
    const cl = t.classList;
    if (cl.contains('trow-txt')) {
      n.text = t.value.trim() || n.text; applySuggestions(n, n.text);
      recomputeSchedule(state.nodes); save(); afterChange();
    } else if (cl.contains('trow-im')) { n.im = clamp(+t.value || 3, 1, 5); n._manualIm = true; save(); afterChange(); }
    else if (cl.contains('trow-ur')) { n.ur = clamp(+t.value || 3, 1, 5); n._manualUr = true; save(); afterChange(); }
    else if (cl.contains('trow-est')) { n.estimateMinutes = t.value ? clamp(+t.value, 1, 999) : null; save(); afterChange(); }
    else if (cl.contains('trow-act')) { n.actualMinutes = t.value ? clamp(+t.value, 0, 9999) : null; save(); afterChange(); }
    else if (t.matches('.trow-done input')) { setNodeDone(n, t.checked); save(); afterChange(); }
  });
  box.addEventListener('click', e => {
    const btn = e.target.closest ? e.target.closest('button[data-act]') : null; if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'more') {
      const on = !_treeRowExpanded.has(id);
      if (on) _treeRowExpanded.add(id); else _treeRowExpanded.delete(id);
      const row = btn.closest('.trow');
      if (row) row.classList.toggle('expanded', on);
      btn.textContent = on ? '▲' : '⋯';
    }
    else if (btn.dataset.act === 'child') addTreeChild(id);
    else if (btn.dataset.act === 'del' && confirm('删除该节点及其子树？')) deleteNode(id);
  });
  const rowOf = t => (t && t.closest) ? t.closest('.trow') : null;
  box.addEventListener('dragstart', e => {
    const row = rowOf(e.target); if (!row || !e.dataTransfer) return;
    const inp = row.querySelector('.trow-txt');
    if (inp) e.dataTransfer.setData('text/plain', inp.dataset.id);
  });
  box.addEventListener('dragover', e => { const row = rowOf(e.target); if (!row) return; e.preventDefault(); row.classList.add('drop-target'); });
  box.addEventListener('dragleave', e => { const row = rowOf(e.target); if (row && !row.contains(e.relatedTarget)) row.classList.remove('drop-target'); });
  box.addEventListener('drop', e => {
    const row = rowOf(e.target); if (!row) return;
    e.preventDefault(); row.classList.remove('drop-target');
    const inp = row.querySelector('.trow-txt');
    reparentNode(e.dataTransfer.getData('text/plain'), inp && inp.dataset.id);
  });
  box.addEventListener('dragend', () => box.querySelectorAll('.drop-target').forEach(r => r.classList.remove('drop-target')));
  bindScrollMemory(box);
}
/* 拖拽换父：把 dragId 挂到 targetId 下（含防环与确认） */
function reparentNode(dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return;
  const dragN = byId(dragId), targetN = byId(targetId);
  if (!dragN || !targetN) return;
  let anc = targetN;
  while (anc) { if (anc.id === dragId) { alert('不能挂到自己的子树下'); return; } anc = anc.parentId ? byId(anc.parentId) : null; }
  if (!confirm(`把「${dragN.text}」挂到「${targetN.text}」下？`)) return;
  dragN.parentId = targetN.id;
  if (dragN.scale == null) dragN.scale = targetN.scale;
  getCachedTree(state.nodes);
  save(); afterChange();
}
function syncTreeToInput() {
  const ta = document.getElementById('input');
  if (!ta || !state.nodes.length) return;
  ta.value = nodesToIndentedText();
}

/* ============ SMART 体检面板 ============ */
function renderSmart() {
  renderPremortemCard();
  const box = document.getElementById('smartList'); if (!box) return;
  if (!state.nodes.length) { box.innerHTML = `<div class="empty-state" style="text-align:center;padding:24px 16px;color:var(--muted)">
    <div style="font-size:32px;margin-bottom:8px">📝</div>
    <div style="font-size:14px;font-weight:500;margin-bottom:4px">还没有目标</div>
    <div class="empty-hint">粘贴你的计划，或点「载入示例」</div>
    <button type="button" class="gf-btn gf-btn--primary" onclick="loadDemo()">载入示例</button>
  </div>`; return; }
  const weak = state.nodes.filter(n => !smartEval(n).smart && n.parentId);
  if (!weak.length) { box.innerHTML = `<div class="empty-state" style="text-align:center;padding:24px 16px;color:var(--muted)">
    <div style="font-size:32px;margin-bottom:8px">✅</div>
    <div style="font-size:14px;font-weight:500;margin-bottom:4px">所有目标都够 SMART</div>
    <div class="empty-hint">具体 · 可衡量 · 有期限</div>
  </div>`; return; }
  box.innerHTML = '';
  weak.forEach(n => {
    const ev = smartEval(n);
    // v7.7: 期限措辞统一走 deadlineBadge()，与英雄卡同一口径（含「今天到期」）
    const dl = deadlineBadge(n);
    const est = n.estimateMinutes ? `约 ${n.estimateMinutes} 分钟` : '未估时';
    // v7.7: 时段用节点词表 DAY_SLOTS，不再用 energyLog 的 am/pm/eve
    const slot = n.slot ? ('🕐 ' + slotLabelOf(n.slot)) : '';
    const smartDots = ['s','m','a','r','tb'].map(k => {
      const v = ev[k] || 1;
      const colors = ['var(--err)', 'var(--warn)', 'var(--ok)'];
      return `<span class="smart-dot" style="background:${colors[v-1]}" title="${['具体','可衡量','可达','相关','时限'][['s','m','a','r','tb'].indexOf(k)]}: ${v}/3"></span>`;
    }).join('');
    const item = document.createElement('div'); item.className = 'smart-item';
    item.innerHTML = `<div class="si-tt">
        <span class="dot" style="background:${category(n.im, n.ur).color}"></span>
        <b>${esc(n.text.slice(0, 30))}</b>
        ${ev.fromAI ? '<span class="ai-badge" title="AI 生成">🤖</span>' : ''}
      </div>
      <div class="si-meta">
        <span class="si-tag">📅 ${esc(dl)}</span>
        <span class="si-tag">⏳ ${esc(est)}</span>
        ${slot ? `<span class="si-tag">${slot}</span>` : ''}
        <span class="si-tag">重要 ${n.im} · 紧急 ${n.ur}</span>
        <span class="si-smart">${smartDots}</span>
      </div>
      <div class="si-gaps">⚠ ${ev.gaps.join('；')}</div>
      <div class="si-btns">
        <button class="${BTN.aiSm || 'gf-btn gf-btn--ai gf-btn--sm'}" data-ai-decomp="${n.id}" title="AI 智能拆解（需要 API Key）">🤖 AI 拆解</button>
        <details class="si-more"><summary>更多方式</summary>
          <button class="${BTN.sm || 'gf-btn gf-btn--sm gf-btn--ghost'}" data-smart="${n.id}" title="逐项问答补全，不联网">💬 对话拆解<span class="si-cost">逐项问答 · 本地</span></button>
          <button class="${BTN.sm || 'gf-btn gf-btn--sm gf-btn--ghost'}" data-decomp="${n.id}" title="按内置规则即时生成子任务">⚡ 一键拆解<span class="si-cost">规则引擎 · 即时</span></button>
        </details>
      </div>`;
    box.appendChild(item);
  });
  box.querySelectorAll('button[data-smart]').forEach(b => b.onclick = () => openSmart(b.dataset.smart));
  box.querySelectorAll('button[data-decomp]').forEach(b => b.onclick = () => { const id = b.dataset.decomp; quickDecompose(id); });
  box.querySelectorAll('button[data-ai-decomp]').forEach(b => b.onclick = () => { const id = b.dataset.aiDecomp; aiDecompose(id); });
}
function quickDecompose(id) {
  const n = byId(id); if (!n) return;
  const sugg = decomposeSuggestions(n);
  insertChildren(id, sugg);
}

/* ============ v7.4 AI 分析视图 ============ */
// AI 历史记录管理
const AI_HISTORY_KEY = 'goalflow.aiHistory';
function getAIHistory() {
  try {
    return JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
  } catch (e) { return []; }
}
function saveAIHistory(history) {
  try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
}
function addAIHistoryEntry(entry) {
  const history = getAIHistory();
  history.unshift(entry); // 最新的在前
  if (history.length > 50) history.pop(); // 最多保留 50 条
  saveAIHistory(history);
}

function renderAIView() {
  // 加载 API Key
  const keyInput = document.getElementById('aiApiKey');
  if (keyInput) {
    keyInput.value = getLLMKey() || '';
  }

  // 加载 Skill Prompt
  const skillInput = document.getElementById('aiSkillPrompt');
  if (skillInput) {
    const customSkill = localStorage.getItem('goalflow.aiSkill') || AI_DECOMPOSE_SYSTEM;
    skillInput.value = customSkill;
  }

  // 诊断前置：把最弱的 3 个目标直接推到分解入口旁
  const suggest = document.getElementById('aiSmartSuggest');
  if (suggest) {
    const weak = state.nodes
      .filter(n => n.parentId && !smartEval(n).smart)
      .map(n => ({ n, ev: smartEval(n) }))
      .sort((a, b) => b.ev.gaps.length - a.ev.gaps.length || b.n.im - a.n.im)
      .slice(0, 3);
    if (!weak.length) { suggest.innerHTML = ''; suggest.style.display = 'none'; }
    else {
      suggest.style.display = '';
      suggest.innerHTML = `<div class="ai-suggest-h">🩺 体检发现 ${state.nodes.filter(n => n.parentId && !smartEval(n).smart).length} 个目标不够 SMART，先拆这几个：</div>` +
        weak.map(({ n, ev }) => `<button type="button" class="ai-suggest-item" data-suggest="${n.id}" title="${esc(ev.gaps.join('；'))}">
          <span class="dot" style="background:${category(n.im, n.ur).color}"></span>
          <b>${esc(n.text.slice(0, 22))}${n.text.length > 22 ? '…' : ''}</b>
          <span class="ai-suggest-gap">缺 ${ev.gaps.length} 项</span>
          <span class="ai-suggest-go">🤖 拆解 →</span>
        </button>`).join('');
      suggest.querySelectorAll('[data-suggest]').forEach(b => b.onclick = () => aiDecompose(b.dataset.suggest));
    }
  }

  // 显示上下文信息
  const contextInfo = document.getElementById('aiContextInfo');
  if (contextInfo) {
    const c = capacitySettings();
    const wc = weekCap();
    const wf = workflowById(state.activeWorkflowId);
    // v7.6: 读取时间偏好
    const timePrefEl = document.getElementById('aiTimePreference');
    const timePrefMap = {
      '': '不限（AI 自动安排）',
      'morning': '上午（8:00-12:00）',
      'afternoon': '下午（13:00-18:00）',
      'evening': '晚上（19:00-22:00）',
      'weekday-only': '仅工作日',
      'weekend-only': '仅周末',
    };
    const timePref = timePrefEl ? timePrefMap[timePrefEl.value] || timePrefEl.value : '不限';
    const otherWfs = activeWorkflows().filter(w => w.id !== state.activeWorkflowId);
    const schedCtx = aiScheduleContext();
    const schedBlockCount = (schedCtx.match(/（\d+h?\d*\s*分?）\s/g) || []).length;
    const budgetText = (c.workdayHours > 0 || c.weekendHours > 0)
      ? `工作日 ${fmtHours(c.workdayHours * 60)}h/天 × 5 + 周末 ${fmtHours(c.weekendHours * 60)}h/天 × 2 = 每周${fmtHours(wc)}小时`
      : `每天约 ${fmtHours(dayCap())} 小时 = 每周${fmtHours(wc)}小时`;
    contextInfo.innerHTML = `
      <div class="ai-context-row">
        <span class="ai-context-label">当前项目</span>
        <span class="ai-context-value">${esc(wf ? wf.name : '未选择')}</span>
      </div>
      <div class="ai-context-row">
        <span class="ai-context-label">时间预算</span>
        <span class="ai-context-value">${budgetText}</span>
      </div>
      <div class="ai-context-row">
        <span class="ai-context-label">项目周期</span>
        <span class="ai-context-value">${wf && wf.startDate ? wf.startDate : '未设置'} ~ ${wf && wf.endDate ? wf.endDate : '未设置'}</span>
      </div>
      <div class="ai-context-row">
        <span class="ai-context-label">时间偏好</span>
        <span class="ai-context-value">${esc(timePref)}</span>
      </div>
      <div class="ai-context-row">
        <span class="ai-context-label">其他工作流</span>
        <span class="ai-context-value">${otherWfs.length} 个 · 已排 ${schedBlockCount} 个时间块（会一并发给 AI 避让）</span>
      </div>
      <details class="ai-ctx-sched">
        <summary>👁 查看将发给 AI 的排期上下文</summary>
        <pre>${esc(schedCtx)}</pre>
      </details>
    `;
  }

  // 渲染历史记录
  renderAIHistory();

  const resultBox = document.getElementById('aiDecomposeResult');
  if (resultBox && !resultBox.innerHTML) {
    resultBox.innerHTML = '<div class="hint">输入目标后点击"AI 分解目标"，系统会自动生成完整的任务树。</div>';
  }
}

let _aiHistoryExpanded = false;
function renderAIHistory() {
  const historyBox = document.getElementById('aiHistoryList');
  if (!historyBox) return;

  const history = getAIHistory();
  if (!history.length) {
    historyBox.innerHTML = '<div class="ai-history-empty">还没有 AI 使用记录。第一次分解目标后，记录会显示在这里。</div>';
    return;
  }

  const shown = _aiHistoryExpanded ? history : history.slice(0, 5);
  historyBox.innerHTML = shown.map((entry, idx) => {
    const date = new Date(entry.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    const statusIcon = entry.success ? '✅' : '❌';
    const taskCount = entry.taskCount || 0;

    return `<div class="ai-history-item" data-idx="${idx}">
      <div class="ai-history-head">
        <span class="ai-history-status">${statusIcon}</span>
        <span class="ai-history-date">${dateStr}</span>
        <span class="ai-history-project">${esc(entry.projectName || '未命名项目')}</span>
        <span class="ai-history-tasks">${taskCount} 个任务</span>
      </div>
      <div class="ai-history-goal">${esc(entry.goal.slice(0, 60))}${entry.goal.length > 60 ? '...' : ''}</div>
      ${!entry.success && entry.error ? `<div class="ai-history-err">❌ ${esc(String(entry.error).slice(0, 80))}</div>` : ''}
      <div class="ai-history-meta">
        <span>⏱ ${entry.timeBudget || '未设置'}</span>
        <span>📅 ${entry.projectPeriod || '未设置'}</span>
        ${entry.timePreference ? `<span>🕐 ${entry.timePreference}</span>` : ''}
        ${entry.via === 'create' ? `<span>🌱 新建项目时分解</span>` : ''}
      </div>
      <div class="ai-history-actions">
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-view-history="${idx}">👁 查看</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-reuse-history="${idx}">♻ 复用</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-delete-history="${idx}">🗑 删除</button>
      </div>
    </div>`;
  }).join('');

  if (history.length > 5) {
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'gf-btn gf-btn--sm gf-btn--ghost ai-history-more';
    more.textContent = _aiHistoryExpanded ? '▴ 收起' : `▾ 展开全部 ${history.length} 条`;
    more.onclick = () => { _aiHistoryExpanded = !_aiHistoryExpanded; renderAIHistory(); };
    historyBox.appendChild(more);
  }

  // 绑定事件
  historyBox.querySelectorAll('[data-view-history]').forEach(btn => {
    btn.onclick = () => viewHistoryDetail(parseInt(btn.dataset.viewHistory));
  });
  historyBox.querySelectorAll('[data-reuse-history]').forEach(btn => {
    btn.onclick = () => reuseHistoryEntry(parseInt(btn.dataset.reuseHistory));
  });
  historyBox.querySelectorAll('[data-delete-history]').forEach(btn => {
    btn.onclick = () => deleteHistoryEntry(parseInt(btn.dataset.deleteHistory));
  });
}

function viewHistoryDetail(idx) {
  const history = getAIHistory();
  const entry = history[idx];
  if (!entry) return;

  const overlay = document.getElementById('smartModal');
  if (!overlay) return;

  const date = new Date(entry.timestamp);
  const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  overlay.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">📜</div>
      <div><div class="mh-tt">AI 分解详情</div>
      <div class="mh-sub">${dateStr}</div></div>
      <div class="mh-x" id="historyDetailClose">×</div>
    </div>
    <div class="guide-body">
      <div class="guide-section">
        <h4>🎯 目标描述</h4>
        <div class="guide-target">${esc(entry.goal)}</div>
      </div>

      <div class="guide-section">
        <h4>📋 项目信息</h4>
        <div class="ai-history-detail-row">
          <span>项目名称</span>
          <b>${esc(entry.projectName || '未命名')}</b>
        </div>
        <div class="ai-history-detail-row">
          <span>项目周期</span>
          <b>${esc(entry.projectPeriod || '未设置')}</b>
        </div>
        <div class="ai-history-detail-row">
          <span>时间预算</span>
          <b>${esc(entry.timeBudget || '未设置')}</b>
        </div>
        ${entry.timePreference ? `<div class="ai-history-detail-row">
          <span>时间偏好</span>
          <b>${esc(entry.timePreference)}</b>
        </div>` : ''}
      </div>

      <div class="guide-section">
        <h4>🤖 AI 返回</h4>
        <div class="ai-history-detail-row">
          <span>状态</span>
          <b>${entry.success ? '✅ 成功' : '❌ 失败'}</b>
        </div>
        <div class="ai-history-detail-row">
          <span>任务数量</span>
          <b>${entry.taskCount || 0} 个</b>
        </div>
        ${entry.error ? `<div class="ai-history-detail-row error"><span>错误信息</span><b>${esc(entry.error)}</b></div>` : ''}
        ${entry.rawSnippet ? `<details class="ai-history-raw"><summary>🔍 AI 原始返回片段（诊断用）</summary><pre>${esc(entry.rawSnippet)}</pre></details>` : ''}
      </div>

      ${entry.tasks && entry.tasks.length ? `<div class="guide-section">
        <h4>📝 生成的任务</h4>
        <div class="ai-history-tasks-list">
          ${entry.tasks.map((t, i) => `<div class="ai-history-task-item">
            <span class="task-idx">${i + 1}.</span>
            <span class="task-text">${esc(t.text)}</span>
            <span class="task-meta">重要${t.im} · 紧急${t.ur} · ${t.estimate || '?'}分钟${t.date ? ' · ' + esc(t.date) : ''}${t.start ? ' ' + esc(t.start) : ''}${t.everyday ? ' · 每日' : ''}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="historyDetailDone">关闭</button>
    </div>
  </div>`;

  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  overlay.querySelector('#historyDetailClose').onclick = close;
  overlay.querySelector('#historyDetailDone').onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
}

function reuseHistoryEntry(idx) {
  const history = getAIHistory();
  const entry = history[idx];
  if (!entry) return;

  // v8.6：AI 视图的分解模块已移除——有输入框则填充（旧布局），没有则复制到剪贴板，新建项目时粘贴
  const input = document.getElementById('aiGoalInput');
  if (input) {
    input.value = entry.goal;
    input.focus();
    showToast('♻ 已复用历史记录的目标描述');
    return;
  }
  try { navigator.clipboard.writeText(entry.goal); } catch (e) { }
  showToast('♻ 目标描述已复制——「新建项目」时粘贴到目标描述即可再次分解');
}

function deleteHistoryEntry(idx) {
  const history = getAIHistory();
  const entry = history[idx];
  if (!entry) return;
  history.splice(idx, 1);
  saveAIHistory(history);
  renderAIHistory();
  showUndoToast('🗑 已删除历史记录', () => {
    const h = getAIHistory();
    h.splice(Math.min(idx, h.length), 0, entry);
    saveAIHistory(h);
    renderAIHistory();
  });
}

function initAIDecomposeHandlers() {
  const btnDecompose = document.getElementById('btnAIDecompose');
  const btnClear = document.getElementById('btnAIClear');
  const input = document.getElementById('aiGoalInput');
  const resultBox = document.getElementById('aiDecomposeResult');
  const keyInput = document.getElementById('aiApiKey');
  const btnToggleKey = document.getElementById('btnToggleKey');
  const skillInput = document.getElementById('aiSkillPrompt');
  const btnEditSkill = document.getElementById('btnEditSkill');
  const btnResetSkill = document.getElementById('btnResetSkill');

  // API Key 显示/隐藏
  if (btnToggleKey && keyInput) {
    btnToggleKey.onclick = () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      btnToggleKey.textContent = keyInput.type === 'password' ? '👁' : '🙈';
    };
  }

  // API Key 自动保存
  if (keyInput) {
    keyInput.onchange = () => {
      const key = keyInput.value.trim();
      LLM_KEY = key;
      try { localStorage.setItem(LLM_KEY_STORAGE, key); } catch (e) {}
      showToast(key ? '✅ API Key 已保存' : '🗑 API Key 已清除');
    };
  }

  // Skill Prompt 编辑
  if (btnEditSkill && skillInput) {
    btnEditSkill.onclick = () => {
      if (skillInput.readOnly) {
        skillInput.readOnly = false;
        skillInput.focus();
        btnEditSkill.textContent = '💾 保存';
        btnEditSkill.title = '保存修改';
      } else {
        const newSkill = skillInput.value.trim();
        if (newSkill) {
          try { localStorage.setItem('goalflow.aiSkill', newSkill); } catch (e) {}
          showToast('✅ Skill 已保存');
        }
        skillInput.readOnly = true;
        btnEditSkill.textContent = '✎ 编辑';
        btnEditSkill.title = '编辑 Skill';
      }
    };
  }

  // Skill Prompt 重置
  if (btnResetSkill && skillInput) {
    btnResetSkill.onclick = () => {
      if (confirm('确定要恢复默认的 Skill Prompt 吗？')) {
        skillInput.value = AI_DECOMPOSE_SYSTEM;
        try { localStorage.removeItem('goalflow.aiSkill'); } catch (e) {}
        showToast('↺ 已恢复默认 Skill');
      }
    };
  }

  if (btnDecompose) {
    btnDecompose.onclick = async () => {
      const goal = input.value.trim();
      if (!goal) { showToast('✏️ 请先输入目标描述'); input.focus(); return; }

      const hasKey = !!getLLMKey();
      if (!hasKey) {
        showApiKeyPrompt(goal, { name: 'AI 分解目标' });
        return;
      }

      const c = capacitySettings();
      const wc = weekCap();
      const wf = workflowById(state.activeWorkflowId);
      // v7.6: 读取时间偏好
      const timePrefEl = document.getElementById('aiTimePreference');
      const timePref = timePrefEl ? timePrefEl.value : '';
      const timePrefMap = {
        'morning': '上午（8:00-12:00）',
        'afternoon': '下午（13:00-18:00）',
        'evening': '晚上（19:00-22:00）',
        'weekday-only': '仅工作日',
        'weekend-only': '仅周末',
      };
      const timePrefText = timePref ? timePrefMap[timePref] || timePref : '不限（AI 自动安排）';
      // v7.3: 使用自定义 Skill（如果有）
      const currentSkill = localStorage.getItem('goalflow.aiSkill') || AI_DECOMPOSE_SYSTEM;
      const aiContext = buildAIDecomposeInput(goal, {
        projectName: wf ? wf.name : '未命名',
        startDate: wf && wf.startDate ? wf.startDate : '未设置',
        endDate: wf && wf.endDate ? wf.endDate : '未设置',
        timePrefText,
      });

      // v7.5/v8.2: 显示全屏遮罩，防止误操作（统一 helper）
      const overlay = showAIOverlay('🤖 AI 正在分析目标...');

      resultBox.innerHTML = '<div class="ai-loading">🤖 AI 正在分解目标...</div>';
      const result = await callLLM(currentSkill, aiContext);

      // 移除遮罩
      overlay.remove();

      // 准备历史记录
      const historyEntry = {
        timestamp: Date.now(),
        projectName: wf ? wf.name : '未命名',
        projectPeriod: wf && wf.startDate ? `${wf.startDate} ~ ${wf.endDate || '未设置'}` : '未设置',
        timeBudget: `工作日 ${c.workdayHours || 0}h/天 × 5 + 周末 ${c.weekendHours || 0}h/天 × 2 = 每周${fmtHours(wc)}小时`,
        timePreference: timePrefText,
        goal: goal,
        success: false,
        taskCount: 0,
        tasks: [],
        error: null,
      };

      if (result) {
        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('AI 未返回有效 JSON（目标可能无法分解，请描述得更具体）');
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.tasks || !Array.isArray(parsed.tasks)) throw new Error('AI 返回格式缺少 tasks 数组');
          // v8.4：空数组也算失败（原来会「成功」生成 0 个任务，看起来像无声失败）
          if (!parsed.tasks.length) throw new Error('AI 未能从该目标拆出任务——请把目标描述得更具体可衡量');

          // 生成根节点
          const rootNode = newNode({
            id: 'n1',
            text: goal,
            im: 4,
            ur: 3,
            scale: 'month',
            source: 'ai-decompose'
          });
          state.nodes = [rootNode];
          // v7.7: 统一入口，root 的项目结束日同时给出 daysLeft / overdue
          setNodeDeadline(rootNode, wf && wf.endDate, wf && wf.startDate);

          // 插入 AI 生成的子任务
          insertAITasks(rootNode.id, parsed.tasks, wf && wf.startDate);

          save();
          afterChange();

          // 记录成功
          historyEntry.success = true;
          historyEntry.taskCount = parsed.tasks.length;
          historyEntry.tasks = parsed.tasks.map(t => ({
            text: t.text,
            im: t.im,
            ur: t.ur,
            estimate: t.duration || t.estimate,
            date: t.date || t.deadline,
            start: t.start,
            deadline: t.date || t.deadline,
            everyday: !!t.everyday,
            timeSlot: t.timeSlot,
          }));

          // 结果里直接给出前几个时间块，方便核对「哪天几点做多久」
          const leaves = parsed.tasks.filter(t => !t.children || !t.children.length);
          const schedRows = leaves.filter(t => t.date && t.start).slice(0, 6).map(t =>
            `<div class="ai-sched-row"><span class="ai-sched-when">${esc(String(t.date).slice(5))} ${esc(t.start)}–${esc(aiEndTime(t.start, t.duration || t.estimate || 30))}</span><b>${esc((t.text || '').slice(0, 28))}</b></div>`).join('');
          const habitCount = leaves.filter(t => t.everyday).length;
          resultBox.innerHTML = `<div class="ai-success">
            <div>✅ AI 已生成 ${parsed.tasks.length} 个子任务${schedRows ? '，已排好具体时间' : ''}${habitCount ? `（含 ${habitCount} 个每日习惯）` : ''}</div>
            ${schedRows ? `<div class="ai-sched-preview">${schedRows}${leaves.filter(t => t.date && t.start).length > 6 ? '<div class="ai-sched-more">…更多见任务树</div>' : ''}</div>` : ''}
            <div class="ai-actions">
              <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" onclick="switchView('plan')">📋 查看任务树</button>
              <button type="button" class="gf-btn gf-btn--sm" onclick="switchView('today')">☀ 今日行动</button>
            </div>
          </div>`;
          // v8.5：同步弹窗展示真实排期结果 + 今日安排
          showAIResultModal(rootNode.id, { title: '✅ AI 分解完成' });
        } catch (e) {
          console.error('AI parse error:', e);
          historyEntry.error = e.message;
          // v8.4：附原始返回片段，方便诊断「产出缺必要内容」类问题（详情弹窗可见）
          historyEntry.rawSnippet = String(result).slice(0, 300);
          resultBox.innerHTML = `<div class="ai-error">❌ AI 返回内容不完整或格式错误，请重试。<br><small>${esc(e.message)}</small><br><small style="opacity:.75">💡 失败详情已记入下方「AI 使用历史」，可随时回看。</small></div>`;
        }
      } else {
        // v8.4：用 callLLM 记录的具体原因（401 key 无效 / 402 余额不足 / 429 限流 / 网络），不再笼统
        historyEntry.error = lastLLMError() || 'AI 调用失败，请检查 API Key 或网络连接';
        resultBox.innerHTML = `<div class="ai-error">❌ ${esc(historyEntry.error)}<br><small style="opacity:.75">💡 失败详情已记入下方「AI 使用历史」，可随时回看。</small></div>`;
      }

      // 保存历史记录
      addAIHistoryEntry(historyEntry);
      renderAIHistory(); // 刷新历史列表
    };
  }

  if (btnClear) {
    btnClear.onclick = () => {
      input.value = '';
      resultBox.innerHTML = '<div class="hint">输入目标后点击"AI 分解目标"，系统会自动生成完整的任务树。</div>';
    };
  }
}

/* ============ 插入子任务 ============ */
function insertChildren(pid, texts) {
  const parent = byId(pid); if (!parent) return;
  const idx = state.nodes.findIndex(n => n.id === pid);
  let maxId = state.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);
  const newNodes = texts.map(t => {
    const node = newNode({ id: 'n' + (++maxId), text: t, im: Math.min(5, parent.im), ur: Math.min(5, parent.ur), parentId: pid, scale: parent.scale, source: 'insert' });
    applySuggestions(node, t); node.scale = parent.scale; return node;
  });
  state.nodes.splice(idx + 1, 0, ...newNodes);
  recomputeSchedule(state.nodes); save(); afterChange();
  warnIfOverCapacity(`「${parent.text.slice(0, 18)}」新增的 ${newNodes.length} 个子任务`);
}
function applyEnriched(id, text) {
  const n = byId(id); if (!n) return;
  n.text = text; applySuggestions(n, text); n.scale = inferScale(text, n.deadlineDate, n.daysLeft, n._children.length > 0);
  recomputeSchedule(state.nodes); save(); afterChange();
}

/* ============ SMART 对话弹窗 ============ */
function openSmart(id) {
  const n = byId(id); if (!n) return;
  const overlay = document.getElementById('smartModal');
  const ev = smartEval(n);
  const qs = smartQuestions(n);
  const answers = new Array(qs.length).fill('');
  let qIndex = 0;
  const conv = []; // {role:'ai'|'me', text, qIndex}
  conv.push({ role: 'ai', text: `我看了「${n.text}」，它目前还不够 SMART：<br>${ev.gaps.map(g => '· ' + g).join('<br>')}<br>我来帮你一项项补齐。`, qIndex: 0 });
  conv.push({ role: 'ai', text: qs[0], qIndex: 0 });

  function scoreDots(v) {
    const g = COLORS.gradSmartDot || ['#f5d78a', '#5b9fd4'];
    let s = ''; for (let i = 1; i <= 3; i++) s += `<i style="background:${i <= v ? `linear-gradient(135deg,${g[0]},${g[1]})` : 'rgba(255,255,255,.14)'}"></i>`; return s;
  }
  function render() {
    const mask = document.getElementById('smartModal');
    const ss = ['s', 'm', 'a', 'r', 't'].map((k, i) => {
      const keys = ['具体 S', '可衡量 M', '可达 A', '相关 R', '有期限 T']; const val = ev[['s', 'm', 'a', 'r', 't'][i]] || 1;
      return `<div class="ss"><div class="ss-k">${keys[i]}</div><div class="ss-dots">${scoreDots(val)}</div></div>`;
    }).join('');
    const chatHtml = conv.map(m => {
      if (m.role === 'ai') {
        const tag = (m.qIndex != null && m.text === qs[m.qIndex]) ? `<div class="qtag">助手提问 ${m.qIndex + 1}/${qs.length}</div>` : '';
        return `<div class="bub ai">${tag}${m.text}</div>`;
      }
      return `<div class="bub me">${esc(m.text)}</div>`;
    }).join('');
    const assembled = answers.filter(a => a.trim()).length ? buildAssembled(n, qs, answers) : '';
    const assembledHtml = assembled ? `<div class="assembled">📌 补充后的目标：<br>${esc(assembled)}</div>` : '';
    mask.innerHTML =`
      <div class="modal">
        <div class="modal-head">
          <div class="mh-ic">🤖</div>
          <div><div class="mh-tt">SMART 对话拆解</div><div class="mh-sub">${esc(n.text)}</div></div>
          <div class="mh-x" id="mClose">×</div>
        </div>
        <div class="smartscores">${ss}</div>
        <div class="chat" id="chatBox">${chatHtml}</div>
        <div class="chat-input">
          <input id="chatIn" placeholder="回答助手的问题，或补充任何信息…" ${qIndex >= qs.length ? 'disabled' : ''}>
          <button class="${BTN.primarySm || 'gf-btn gf-btn--primary gf-btn--sm'}" id="chatSend" ${qIndex >= qs.length ? 'disabled' : ''}>${qIndex >= qs.length ? '已问完' : '回答'}</button>
        </div>
        <div class="modal-foot">
          <button class="${BTN.ai || 'gf-btn gf-btn--ai'}" id="mAI">✨ AI 深度拆解${getLLMKey() ? '(已连密钥)' : '(需密钥)'}</button>
          <button class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="mApply" ${assembled ? '' : 'disabled'}>采用补充并替换</button>
          <button id="mDecomp">⚡ 一键拆成子任务</button>
          <button class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="mCancel">关闭</button>
        </div>
        ${assembledHtml ? `<div style="padding:0 20px 14px">${assembledHtml}</div>` : ''}
      </div>`;
    document.getElementById('mClose').onclick = closeSmart;
    document.getElementById('mCancel').onclick = closeSmart;
    document.getElementById('mApply').onclick = () => { if (assembled) applyEnriched(id, assembled); closeSmart(); };
    document.getElementById('mDecomp').onclick = () => { const sugg = decomposeSuggestions(n); insertChildren(id, sugg); closeSmart(); };
    document.getElementById('mAI').onclick = () => aiSmartChatDecompose(id, n);
    const send = () => {
      const inp = document.getElementById('chatIn'); const v = inp.value.trim(); if (!v) return;
      if (qIndex < qs.length) answers[qIndex] = v;
      conv.push({ role: 'me', text: v });
      qIndex++;
      if (qIndex < qs.length) { conv.push({ role: 'ai', text: qs[qIndex], qIndex }); }
      else { conv.push({ role: 'ai', text: '信息已收集齐全 ✅ 下方「补充后的目标」是我帮你整合的版本，可以「采用并替换」，或「一键拆成子任务」付诸行动。' }); }
      render();
      const cb = document.getElementById('chatBox'); if (cb) cb.scrollTop = cb.scrollHeight;
    };
    document.getElementById('chatSend').onclick = send;
    document.getElementById('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    const cb = document.getElementById('chatBox'); if (cb) cb.scrollTop = cb.scrollHeight;
  }
  render();
  overlay.classList.add('show');
}
function buildAssembled(n, qs, answers) {
  const parts = [n.text];
  answers.forEach((a, i) => { if (a.trim()) { const tag = qs[i].slice(0, 2); parts.push((i === 0 ? '指标:' : i === 1 ? '期限:' : i === 2 ? '步骤:' : '补充:') + a.trim()); } });
  return parts.join(' ｜ ');
}
function closeSmart() { document.getElementById('smartModal').classList.remove('show'); document.getElementById('smartModal').innerHTML = ''; }
async function aiSmartChatDecompose(id, n) {
  const box = document.getElementById('chatBox'); if (!box) return;
  const typing = document.createElement('div'); typing.className = 'typing'; typing.textContent = 'AI 正在深度拆解…'; box.appendChild(typing); box.scrollTop = box.scrollHeight;
  const sys = '你是一个目标拆解助手。用户会给你一个目标。请把它拆解成 3 个具体、可衡量、有 owner 感的小步骤，每步一行，以「1. 」开头，不要解释。';
  const out = await callLLM(sys, '目标：' + n.text + (n.deadline ? ' 期限：' + n.deadline : ''));
  typing.remove();
  if (!out) { const t = document.createElement('div'); t.className = 'bub ai'; t.textContent = '未检测到 DeepSeek 密钥或调用失败，已自动改用内置规则引擎拆解。'; box.appendChild(t); box.scrollTop = box.scrollHeight; const sugg = decomposeSuggestions(n); insertChildren(id, sugg); return; }
  const lines = out.split(/\n+/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, 3);
  const sugg = lines.length ? lines : decomposeSuggestions(n);
  const t = document.createElement('div'); t.className = 'bub ai'; t.textContent = '✨ AI 拆解建议（已插入为子任务）：\n' + sugg.join('；'); box.appendChild(t); box.scrollTop = box.scrollHeight;
  insertChildren(id, sugg);
  closeSmart();
}

/* ============ 持久化 ============ */
let _lastSaveAt = 0;
let _bakAt = 0;
let _lastMetaJson = null;
/* meta 落盘走内容比对：节点改动带不动 meta 内容时不写磁盘（原来每次 save 都全文重写一遍） */
function saveMeta() {
  try {
    const json = JSON.stringify(state.meta || {});
    if (json === _lastMetaJson) return;
    _lastMetaJson = json;
    localStorage.setItem(LS_META, json);
  } catch (e) { }
}
function loadMeta() {
  try {
    const s = localStorage.getItem(LS_META);
    if (s) state.meta = { weekReviews: [], monthReviews: [], quarterReviews: [], bannerDismissedWeek: '', dailyCompletions: {}, executionLog: {}, habitStreaks: {}, alarmFired: {}, ...JSON.parse(s) };
  } catch (e) { }
  if (!state.meta) state.meta = { weekReviews: [], monthReviews: [], quarterReviews: [], bannerDismissedWeek: '', dailyCompletions: {} };
  if (!state.meta.executionLog) state.meta.executionLog = {};
  if (!state.meta.habitStreaks) state.meta.habitStreaks = {};
  if (!state.meta.alarmFired) state.meta.alarmFired = {};
  ensureScoreMeta();
  trimLogs();
}
/* 逐日日志按天滚动裁剪：日历/热力最多回溯一年，更早的明细留着只会挤占约 5MB 的配额。
   每天最多裁一次（用 logsTrimmedAt 记账），日记 dayNotes / goodThings 属于用户文本，不裁。 */
const LOG_KEEP_DAYS = 400;
function trimLogs() {
  const m = state.meta; if (!m) return;
  const todayKey = dateKey();
  if (m.logsTrimmedAt === todayKey) return;
  const cut = new Date(TODAY); cut.setDate(cut.getDate() - LOG_KEEP_DAYS);
  const cutoff = dateKey(cut);
  const yd = new Date(TODAY); yd.setDate(yd.getDate() - 1);
  const yk = dateKey(yd);
  let n = 0;
  ['executionLog', 'scoreLog', 'dailyCompletions', 'energyLog'].forEach(k => {
    const map = m[k]; if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(dk => { if (dk < cutoff) { delete map[dk]; n++; } });
  });
  Object.keys(m.habitStreaks || {}).forEach(hk => {
    const log = (m.habitStreaks[hk] || {}).log; if (!log) return;
    Object.keys(log).forEach(dk => { if (dk < cutoff) { delete log[dk]; n++; } });
  });
  // 提醒去重标记只在当天有用，留今昨两天足够跨午夜不误报
  Object.keys(m.alarmFired || {}).forEach(key => {
    const d = key.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < yk) { delete m.alarmFired[key]; n++; }
  });
  m.logsTrimmedAt = todayKey;
  if (n) console.info('[GoalFlow] 滚动裁剪逐日明细 ' + n + ' 条（保留最近 ' + LOG_KEEP_DAYS + ' 天）');
    saveMeta();
}
function workflowsPayload(activeNodes) {
  ensureWorkflows();
  return {
    activeWorkflowId: state.activeWorkflowId,
    workflows: state.workflows.map(w => ({
      id: w.id, name: w.name || '项目', topId: w.topId || null, topPin: w.topPin || null,
      tags: w.tags || [], startDate: w.startDate || '', endDate: w.endDate || '', description: w.description || '',
      color: w.color || '',
      // 活动流的节点已由 save() 序列化过一次，直接复用，别再 map 一遍
      nodes: (activeNodes && w.id === state.activeWorkflowId) ? activeNodes : serializeNodes(w.nodes || []),
    })),
  };
}
function save() {
  try {
    flushActiveWorkflow();
    _lastSaveAt = Date.now();
    const flat = serializeNodes(state.nodes);
    localStorage.setItem(LS_KEY, JSON.stringify(flat));
    const payload = JSON.stringify(workflowsPayload(flat));
    localStorage.setItem(LS_WORKFLOWS, payload);
    // 冗余镜像：主键损坏/被清空时仍可恢复。它和主键同内容，按 5 分钟节流即可
    if (_lastSaveAt - _bakAt >= LS_BAK_INTERVAL) {
      _bakAt = _lastSaveAt;
      try { localStorage.setItem(LS_WORKFLOWS_BAK, payload); } catch (e) { }
    }
    saveMeta();
    pushSnapshot();
    fsWrite();
  } catch (e) {
    console.warn('[GoalFlow] 保存失败', e);
  }
}
function parseWorkflowsJson(raw, source) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data.workflows || !Array.isArray(data.workflows) || !data.workflows.length) return null;
    const wfs = data.workflows.map(w => {
      const wf = {
        id: w.id || newWorkflowId(),
        name: w.name || '目标流',
        topId: w.topId || null, topPin: w.topPin || null,
        tags: w.tags, startDate: w.startDate, endDate: w.endDate, description: w.description, color: w.color,
        nodes: (w.nodes || []).map(normalizeNode),
      };
      normalizeWorkflowMeta(wf);
      return wf;
    });
    return { workflows: wfs, activeWorkflowId: data.activeWorkflowId || null, source };
  } catch (e) {
    console.warn('[GoalFlow] 解析存储失败：' + source, e);
    return null;
  }
}
function applyWorkflowsData(res) {
  state.workflows = res.workflows;
  state.activeWorkflowId = res.activeWorkflowId || state.workflows[0].id;
  applyActiveWorkflow();
}
function storageReport() {
  const keys = [LS_WORKFLOWS, LS_WORKFLOWS_BAK, 'goalfocus.workflows.v1', LS_KEY, LS_KEY_LEGACY, LS_META];
  const rows = keys.map(k => {
    let v = null; try { v = localStorage.getItem(k); } catch (e) { }
    return { key: k, exists: v != null, size: v ? v.length : 0 };
  });
  console.table(rows);
  return rows;
}
function load() {
        loadMeta();
  const sources = [
    [LS_WORKFLOWS, '主存储 v2'],
    [LS_WORKFLOWS_BAK, '镜像备份'],
    ['goalfocus.workflows.v1', '旧版 v1'],
  ];
  for (const [key, label] of sources) {
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { }
    const res = parseWorkflowsJson(raw, label);
    if (res) {
      applyWorkflowsData(res);
      if (key !== LS_WORKFLOWS) save(); // 迁移/恢复到主键
      if (label !== '主存储 v2') console.info('[GoalFlow] 已从「' + label + '」恢复数据');
        return true;
      }
    }
  try {
    let s = localStorage.getItem(LS_KEY);
    if (!s) s = localStorage.getItem(LS_KEY_LEGACY);
    if (s) {
      const n = JSON.parse(s);
      if (Array.isArray(n) && n.length) {
        state.nodes = n.map(normalizeNode);
        state.workflows = [];
        state.activeWorkflowId = null;
        ensureWorkflows();
        recomputeSchedule(state.nodes);
        save();
        console.info('[GoalFlow] 已从单树存储迁移到项目');
        return true;
      }
    }
  } catch (e) { console.warn('[GoalFlow] 单树存储解析失败', e); }
  ensureWorkflows();
  console.info('[GoalFlow] 未找到任何已存数据（若之前在其它浏览器/端口使用，数据在原浏览器里）');
  return false;
}

function weekKey(d) {
  d = d || new Date(TODAY);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
function weekRange(d) {
  const parts = (weekKey(d) || '').split('-').map(Number);
  const start = new Date(parts[0], parts[1] - 1, parts[2]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { start, end, key: weekKey(d) };
}
function periodKey(cycle, d) {
  if (cycle === 'week') return weekKey(d);
  const t = d ? new Date(d) : today0();
  if (cycle === 'month') return t.getFullYear() + '-' + pad2(t.getMonth() + 1);
  const q = Math.floor(t.getMonth() / 3) + 1;
  return t.getFullYear() + '-Q' + q;
}
function periodRange(cycle) {
  if (cycle === 'week') { const r = weekRange(); return { ...r, cycle: 'week', label: '本周' }; }
  const t = today0();
  if (cycle === 'month') {
    const start = new Date(t.getFullYear(), t.getMonth(), 1);
    const end = new Date(t.getFullYear(), t.getMonth() + 1, 1);
    return { start, end, key: periodKey('month'), cycle: 'month', label: '本月' };
  }
  const q = Math.floor(t.getMonth() / 3);
  const start = new Date(t.getFullYear(), q * 3, 1);
  const end = new Date(t.getFullYear(), q * 3 + 3, 1);
  return { start, end, key: periodKey('quarter'), cycle: 'quarter', label: '本季' };
}
const REVIEW_STORE = { week: 'weekReviews', month: 'monthReviews', quarter: 'quarterReviews' };
function computePeriodStats(cycle) {
  cycle = cycle || 'week';
  getCachedTree(state.nodes);
  ensureAllEstimates();
  const { start, end, label } = periodRange(cycle);
  const leaves = state.nodes.filter(n => n.parentId && n._children.length === 0);
  const completed = leaves.filter(n => {
    if (!n.done) return false;
    const at = +(n.doneAt || 0);
    if (!at) return false;
    return at >= start.getTime() && at < end.getTime();
  });
  const byCat = { now: 0, core: 0, distract: 0, noise: 0 };
  completed.forEach(n => { const k = category(n.im, n.ur).key; byCat[k] = (byCat[k] || 0) + 1; });
  const total = completed.length;
  const coreCount = byCat.core || 0;
  const fireCount = (byCat.now || 0) + (byCat.distract || 0);
  const cfTotal = coreCount + fireCount;
  const coreVsFire = {
    core: coreCount, fire: fireCount,
    corePct: cfTotal ? Math.round(coreCount / cfTotal * 100) : 0,
    firePct: cfTotal ? Math.round(fireCount / cfTotal * 100) : 0,
  };
  const corePct = total ? Math.round((byCat.core / total) * 100) : 0;
  const lp = leafProgress();
  const quickWins = leaves.filter(n => !n.done && isQuickWin(n)).length;
  const topId = state.topId;
  const goldCompleted = completed.filter(n => topId && isUnderTopNode(n, topId));
  const goldTouched = state.nodes.filter(n => {
    const t = +(n.touchedAt || 0);
    if (!t || t < start.getTime() || t >= end.getTime()) return false;
    return topId && (goldChainIds(topId).has(n.id) || isUnderTopNode(n, topId));
  });
  const goldMoved = !!(goldCompleted.length || goldTouched.length);
  const goldDetail = goldMoved
    ? `${label}金线有动静：完成 ${goldCompleted.length} 项` + (goldTouched.length ? ` · 触碰 ${goldTouched.length} 次` : '') +
    (goldCompleted.length ? '\n· ' + goldCompleted.map(n => n.text).join('\n· ') : '')
    : (topId ? `金线「${(byId(topId) || {}).text || '—'}」${label}尚无完成/触碰记录。` : '尚未选出金线任务。');
  const completedTexts = completed.map(n => n.text);
  const okrNodes = state.nodes.filter(n => (n.role === 'KR' || n.role === 'O' || n.targetNum) && n.parentId);
  let estSum = 0, actSum = 0;
  completed.forEach(n => { estSum += n.estimateMinutes || 0; actSum += n.actualMinutes || 0; });
  // 「目标前进了没有」：本周期有完成/触碰/指标增长 的目标分支
  const progressed = okrNodes.filter(n => {
    if ((n.targetDone || 0) > 0) {
      // 指标有记录（粗判：本周期内有叶子完成）
    }
    const t = +(n.touchedAt || 0);
    if (t && t >= start.getTime() && t < end.getTime()) return true;
    return completed.some(c => c.id === n.id || isUnderTopNode(c, n.id));
  });
  const stalled = okrNodes.filter(n => !progressed.includes(n));
  return {
    cycle, total, byCat, corePct, coreVsFire, leafProg: lp, quickWins,
    pending: leaves.filter(n => !n.done).length, range: { start, end }, label,
    completedTexts, goldMoved, goldDetail, goldCompleted, goldTouched, estSum, actSum, okrNodes,
    progressed, stalled,
  };
}
function computeWeekStats() { return computePeriodStats('week'); }
function autoWeekDraft(st, last) {
  const wins = last.wins || (st.completedTexts.length ? '· ' + st.completedTexts.join('\n· ') : '');
  const gold = last.gold || (st.goldDetail || '');
  const core = last.core || (st.coreVsFire && st.coreVsFire.core + st.coreVsFire.fire
    ? `计数：核心 ${st.coreVsFire.core} 项 / 救火 ${st.coreVsFire.fire} 项（核心占 ${st.coreVsFire.corePct}%）`
    : '');
  const mom = weeklyMomentum();
  const exec = last.exec || (
    `执行记录：近 7 天完成 ${mom.done} 项叶子 · 预估 ${mom.est} 分 / 实计 ${mom.act} 分` +
    (mom.est ? ` · 估/实偏差 ${mom.act - mom.est >= 0 ? '+' : ''}${mom.act - mom.est} 分` : '') +
    (mom.habitsDone ? ` · 习惯连续中 ${mom.habitsDone} 条` : '')
  );
  return { wins, gold, core, exec };
}
function weekStatsBarsHtml(st) {
  const total = st.total || 1;
  const bars = QUAD_ORDER.map(q => {
    const n = st.byCat[q] || 0;
    const pct = Math.round(n / total * 100);
    const col = QUAD[q].icon ? (CAT[q] ? CAT[q].color : '#7c8295') : '#555';
    return `<div class="wr-bar-row"><span class="wr-lbl">${QUAD[q].label.split('·')[0].trim()}</span>
      <div class="wr-bar"><i style="width:${pct}%;background:${col}"></i></div><span class="wr-num">${n} · ${pct}%</span></div>`;
  }).join('');
  return bars;
}
function hasWeekReviewThisWeek() {
  const wk = weekKey();
  return (state.meta.weekReviews || []).some(r => r.week === wk);
}
function renderProgress() {
  const chip = document.getElementById('progressChip');
  const p = leafProgress();
  if (!p || !state.nodes.length) { chip.style.display = 'none'; return; }
  chip.style.display = 'inline-flex';
  document.getElementById('progressLbl').textContent = `叶子 ${p.pct}%`;
  document.getElementById('progressFill').style.width = p.pct + '%';
}

/* v7.8: 移动端大标题（随内容滚动，滚出后顶栏里的迷你标题接上） */
const APP_TITLE = { today: '今日', plan: '规划', insights: '洞察', ai: 'AI' };
function renderAppTitle() {
  const h = document.getElementById('appTitleText');
  if (!h) return;
  const on = document.querySelector('.main-scroll .view.on');
  const name = (on && on.dataset.view) || 'today';
  const d = TODAY;
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const dateStr = `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
  const p = leafProgress();
  let sub = dateStr, mini = dateStr;
  if (name === 'today') {
    // v8.7 口径修复：原用 todayExecutionPoolFor(state.nodes) 只算当前项目（清单是全局的，口径不一致），
    // 且 pool 已滤掉 done → 完成数恒 0。现改 todayAggregatedPool（与清单同源、跟随「只看当前项目」过滤），
    // 完成数取自 executionLog 今日记录；总数 = 待办 + 已完成。
    let pool = [];
    try { pool = todayAggregatedPool() || []; } catch (e) { }
    const doneN = (((state.meta || {}).executionLog || {})[dateKey()] || { entries: [] }).entries.length;
    const total = pool.length + doneN, done = doneN;
    sub = total ? `${dateStr} · 今日 ${done}/${total} 完成` : `${dateStr} · 今天没有待办`;
    mini = total ? `${done}/${total} · ${d.getMonth() + 1}月${d.getDate()}日` : dateStr;
  } else if (name === 'plan') {
    const n = (state.workflows || []).length;
    sub = `${n} 个项目 · 叶子完成 ${p ? p.pct : 0}%`;
    mini = `${n} 个项目`;
  } else if (name === 'insights') {
    sub = `${state.nodes.length} 个任务 · 完成 ${p ? p.pct : 0}%`;
    mini = `${state.nodes.length} 个任务`;
  } else {
    sub = '拆解目标 · SMART 体检 · 使用历史';
    mini = '拆解 · 体检 · 历史';
  }
  h.textContent = APP_TITLE[name] || '今日';
  const el = document.getElementById('appTitleSub'); if (el) el.textContent = sub;
  const mb = document.getElementById('abMini');
  if (mb) mb.textContent = APP_TITLE[name] || '今日';
  const ms = document.getElementById('abMiniSub'); if (ms) ms.textContent = mini;
  document.title = `${APP_TITLE[name] || '今日'} · 目标流 GoalFlow`;
}

/* v7.8: 移动端外壳交互 —— 左侧抽屉 + 顶栏折叠 */
function bindAppShell() {
  const topbar = document.getElementById('topbar');
  const drawer = document.getElementById('sideDrawer');
  const scrim = document.getElementById('drawerScrim');
  const btn = document.getElementById('btnDrawer');
  if (!topbar || !drawer) return;
  const open = () => {
    drawer.classList.add('open');
    if (scrim) scrim.classList.add('on');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  };
  const close = () => {
    drawer.classList.remove('open');
    if (scrim) scrim.classList.remove('on');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  };
  if (btn) btn.addEventListener('click', () => drawer.classList.contains('open') ? close() : open());
  const x = document.getElementById('btnDrawerClose');
  if (x) x.addEventListener('click', close);
  if (scrim) scrim.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // 抽屉里点「视图 / 项目 / 仪式」之后自动收起
  drawer.addEventListener('click', e => {
    if (e.target.closest('[data-nav], .si, .wf-item, .wf-add, .side-tree .trow')) setTimeout(close, 60);
  });
  // 顶栏：大标题滚出后显示迷你标题
  const ms = document.querySelector('.main-scroll');
  if (ms) {
    let raf = 0;
    ms.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; topbar.classList.toggle('scrolled', ms.scrollTop > 36); });
    }, { passive: true });
  }
  // 左边缘右滑打开抽屉
  let sx = 0, sy = 0, tracking = false;
  document.addEventListener('touchstart', e => {
    if (drawer.classList.contains('open')) return;
    const t = e.touches[0];
    if (t && t.clientX < 26) { sx = t.clientX; sy = t.clientY; tracking = true; }
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!tracking) return;
    const t = e.touches[0]; if (!t) return;
    if (Math.abs(t.clientY - sy) > 48) { tracking = false; return; }
    if (t.clientX - sx > 56) { tracking = false; open(); }
  }, { passive: true });
  document.addEventListener('touchend', () => { tracking = false; }, { passive: true });
}
function renderReviewBanner() {
  const el = document.getElementById('reviewBanner'); if (!el) return;
  const wk = weekKey();
  const show = state.nodes.length > 0 && !hasWeekReviewThisWeek() && state.meta.bannerDismissedWeek !== wk;
  el.classList.toggle('show', show);
}
function addMicroAction(id) {
  const parent = byId(id); if (!parent) return;
  const hint = parent.text.length > 24 ? parent.text.slice(0, 24) + '…' : parent.text;
  const action = prompt('接下来 5 分钟能做的最小动作？\n（越具体越好：打开什么、写多少字、打给谁）', `针对「${hint}」：先完成最小一步（约 5 分钟）`);
  if (action == null || !String(action).trim()) return;
  insertChildren(id, [String(action).trim()]);
  const kids = state.nodes.filter(n => n.parentId === id);
  const last = kids[kids.length - 1];
  if (last) { last.scale = 'day'; last.ur = Math.max(last.ur, 4); if (!last.slot) last.slot = 'h1'; }
  save(); afterChange();
}
function icsStamp(d) {
  const x = new Date(d);
  return x.getFullYear() + pad2(x.getMonth() + 1) + pad2(x.getDate()) + 'T' + pad2(x.getHours()) + pad2(x.getMinutes()) + pad2(x.getSeconds());
}
function icsEscape(s) { return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
const ICS_WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function icsRRule(n) {
  const r = habitRecurrence(n);
  switch (r.type) {
    case 'daily': return 'FREQ=DAILY';
    case 'weekdays': return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekends': return 'FREQ=WEEKLY;BYDAY=SA,SU';
    case 'weekly': return (r.days || []).length ? 'FREQ=WEEKLY;BYDAY=' + r.days.map(d => ICS_WD[d]).join(',') : '';
    case 'interval': return 'FREQ=DAILY;INTERVAL=' + (r.interval || 1);
    case 'monthly': return 'FREQ=MONTHLY;BYMONTHDAY=' + (r.dayOfMonth || 1);
    default: return '';
  }
}
function icsAlarm(trigger, desc) {
  return `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsEscape(desc || '提醒')}\r\nTRIGGER:${trigger}\r\nEND:VALARM\r\n`;
}
function icsDateOnly(d) { const x = new Date(d); return x.getFullYear() + pad2(x.getMonth() + 1) + pad2(x.getDate()); }
function exportICS() {
  ensureWorkflows(); flushActiveWorkflow();
  const now = icsStamp(new Date());
  const today = today0();
  const events = [];
  const push = (uid, summary, desc, startLine, endLine, rrule, alarms) => {
    let e = `BEGIN:VEVENT\r\nUID:${uid}@goalflow.local\r\nDTSTAMP:${now}\r\n${startLine}\r\n`;
    if (endLine) e += endLine + '\r\n';
    if (rrule) e += 'RRULE:' + rrule + '\r\n';
    e += `SUMMARY:${icsEscape(summary)}\r\nDESCRIPTION:${icsEscape(desc)}\r\n`;
    (alarms || []).forEach(a => e += a);
    e += 'END:VEVENT\r\n';
    events.push(e);
  };
  state.workflows.forEach(wf => {
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    const prefix = wf.name ? '[' + wf.name + '] ' : '';
    nodes.filter(n => n.parentId && n._children.length === 0 && !n.done).forEach(n => {
      const desc = `GoalFlow · 重要${n.im} 紧急${n.ur}` + (n.waitNote ? ' · ' + n.waitNote : '');
      const rec = isRecurringTask(n);
      const rrule = rec ? icsRRule(n) : '';
      if (n.time) {
        const base = n.deadlineDate ? new Date(n.deadlineDate) : new Date(today);
        const p = String(n.time).split(':');
        base.setHours(clamp(+p[0] || 0, 0, 23), clamp(+p[1] || 0, 0, 59), 0, 0);
        const mins = n.estimateMinutes || 30;
        const end = new Date(base.getTime() + mins * 60000);
        push(wf.id + '-' + n.id + '-t', prefix + n.text, desc,
          'DTSTART:' + icsStamp(base), 'DTEND:' + icsStamp(end), rrule,
          [icsAlarm('-PT15M', n.text), icsAlarm('-PT0S', n.text)]);
      } else if (rec && rrule) {
        const base = n.deadlineDate ? new Date(n.deadlineDate) : new Date(today);
        push(wf.id + '-' + n.id + '-r', prefix + n.text, desc,
          'DTSTART;VALUE=DATE:' + icsDateOnly(base), 'DTEND;VALUE=DATE:' + icsDateOnly(addDays(base, 1)), rrule,
          [icsAlarm('-PT0S', n.text)]);
      } else if (n.deadlineDate) {
        const dl = new Date(n.deadlineDate);
        push(wf.id + '-' + n.id + '-d', prefix + n.text, desc,
          'DTSTART;VALUE=DATE:' + icsDateOnly(dl), 'DTEND;VALUE=DATE:' + icsDateOnly(addDays(dl, 1)), '',
          [icsAlarm('-P1D', '明天到期：' + n.text)]);
      }
      if (n.status === 'waiting' && n.followUp) {
        const fu = new Date(n.followUp + 'T09:00:00');
        push(wf.id + '-' + n.id + '-f', '📣 催办：' + prefix + n.text, n.waitNote || '等待外部回复，该催办了',
          'DTSTART:' + icsStamp(fu), 'DTEND:' + icsStamp(new Date(fu.getTime() + 15 * 60000)), '',
          [icsAlarm('-PT0S', '催办：' + n.text)]);
      }
    });
  });
  if (!events.length) { alert('没有可导出的提醒。请给任务设「计划时间 / 期限日期 / 循环周期」，或给等待中的任务设「催办日期」。'); return; }
  let body = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GoalFlow//ZH\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:GoalFlow 提醒\r\n';
  body += events.join('');
  body += 'END:VCALENDAR\r\n';
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'goalflow-reminders-' + new Date().toISOString().slice(0, 10) + '.ics';
  a.click();
  showToast(`已导出 ${events.length} 条提醒（含闹钟）· 导入系统日历后，关掉页面也能准时提醒`);
}
function exportBackup() {
  flushActiveWorkflow();
  ensureWorkflows();
  const payload = {
    app: 'goalflow', version: 10, exportedAt: new Date().toISOString(),
    viewMode: state.viewMode,
    activeWorkflowId: state.activeWorkflowId,
    workflows: state.workflows.map(w => ({
      id: w.id, name: w.name, topId: w.topId || null, topPin: w.topPin || null,
      tags: w.tags || [], startDate: w.startDate || '', endDate: w.endDate || '', description: w.description || '', color: w.color || '',
      nodes: serializeNodes(w.nodes || []),
    })),
    nodes: serializeNodes(state.nodes), meta: state.meta || {}
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'goalflow-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  // v6.3 备份提醒：记录最近一次备份时间
  try { if (!state.meta) state.meta = {}; state.meta.lastBackupAt = Date.now(); saveMeta(); } catch (e) { }
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => importBackupText(reader.result);
  reader.readAsText(file);
}
/* v8.10: 快照/备份恢复后清 meta 里的孤儿引用 —— 恢复会整树替换，rocks/明晚预选/习惯打卡
   可能指向恢复后树里不存在的节点（「石头条显示陌生任务、点了没反应」）。 */
function reconcileRefsAfterRestore() {
  ensureScoreMeta();
  const alive = new Set();
  (state.workflows || []).forEach(w => (w.nodes || []).forEach(n => alive.add(w.id + '|' + n.id)));
  let dirty = false;
  Object.values(state.meta.weekPlans || {}).forEach(plan => {
    if (!plan || !Array.isArray(plan.rocks)) return;
    const before = plan.rocks.length;
    plan.rocks = plan.rocks.filter(r => r && alive.has((r.wfId || '') + '|' + r.nodeId));
    if (plan.rocks.length !== before) dirty = true;
  });
  const tm = state.meta.tomorrowMit;
  if (tm && !alive.has((tm.wfId || '') + '|' + tm.nodeId)) { state.meta.tomorrowMit = null; dirty = true; }
  Object.keys(state.meta.habitStreaks || {}).forEach(key => {
    if (!alive.has(key)) { delete state.meta.habitStreaks[key]; dirty = true; }
  });
  if (dirty) saveMeta();
}
async function importBackupText(text) {
  try {
    const data = JSON.parse(text);
    let nodes = data;
    if (data && data.nodes) nodes = data.nodes;
    if (!Array.isArray(nodes) || !nodes.length) { alert('未找到有效目标数据'); return; }
    // v8.10: 原生 confirm 改页内确认弹窗（同 v8.8/v8.9——部分 WebView 静默吞 confirm，点了没反应）
    const okRestore = await confirmModal({
      icon: '📥', title: '恢复备份', danger: true, okText: '恢复',
      text: '恢复将覆盖当前全部目标流，是否继续？',
      sub: '当前项目、今日计划与统计数据会被备份文件完全替换。',
    });
    if (!okRestore) return;
    if (data.workflows && Array.isArray(data.workflows) && data.workflows.length) {
      state.workflows = data.workflows.map(w => {
        const wf = {
          id: w.id || newWorkflowId(),
          name: w.name || '目标流',
          topId: w.topId || null,
          topPin: w.topPin || null,
          tags: w.tags, startDate: w.startDate, endDate: w.endDate, description: w.description, color: w.color,
          nodes: (w.nodes || []).map(normalizeNode),
        };
        normalizeWorkflowMeta(wf);
        return wf;
      });
      state.activeWorkflowId = data.activeWorkflowId || state.workflows[0].id;
      applyActiveWorkflow();
    } else {
      state.nodes = nodes.map(normalizeNode);
      state.workflows = [];
      state.activeWorkflowId = null;
      ensureWorkflows();
      recomputeSchedule(state.nodes);
    }
    if (data.meta) state.meta = { ...state.meta, ...data.meta };
    if (data.viewMode) state.viewMode = data.viewMode;
    // v8.10: 恢复的 meta 此前不落盘（save() 只写 workflows）——刷新后 loadMeta 读回旧 meta，新树配旧统计
    reconcileRefsAfterRestore();
    save(); saveMeta(); afterChange();
    const wc = state.workflows.length;
    alert('已恢复 ' + wc + ' 个工作流 · 当前流 ' + state.nodes.length + ' 条节点');
  } catch (e) { alert('JSON 解析失败'); }
}

/* ============ 自动备份：滚动快照（时间旅行）+ 文件落盘（local-first 同步使能） ============ */
const LS_SNAPSHOTS = 'goalfocus.snapshots.v1';
const SNAP_KEEP = 6;
const SNAP_INTERVAL = 60 * 60 * 1000;
let _lastSnapAt = 0;
function snapshotPayload() {
  flushActiveWorkflow(); ensureWorkflows();
  return JSON.stringify(workflowsPayload(serializeNodes(state.nodes)));
}
function pushSnapshot(force) {
  const now = Date.now();
  if (!force && now - _lastSnapAt < SNAP_INTERVAL) return;
  _lastSnapAt = now;
  try {
    const payload = snapshotPayload();
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(LS_SNAPSHOTS) || '[]'); } catch (e) { }
    if (!Array.isArray(arr)) arr = [];
    if (arr.length && arr[0].payload === payload) return;
    arr.unshift({ at: now, payload });
    arr = arr.slice(0, SNAP_KEEP);
    localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(arr));
  } catch (e) {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_SNAPSHOTS) || '[]').slice(0, 2);
      localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(arr));
    } catch (_) { }
  }
}
function listSnapshots() {
  try { const a = JSON.parse(localStorage.getItem(LS_SNAPSHOTS) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
async function restoreSnapshot(at) {
  const snap = listSnapshots().find(s => s.at === at);
  if (!snap) { showToast('⚠️ 快照不存在'); return; }
  const res = parseWorkflowsJson(snap.payload, '快照');
  if (!res) { showToast('⚠️ 快照解析失败'); return; }
  // v8.10: 原生 confirm 改页内确认弹窗（WebView 会静默吞 confirm）
  const okSnap = await confirmModal({
    icon: '⏳', title: '恢复快照', danger: true, okText: '恢复',
    text: '恢复到该快照将覆盖当前全部目标流，是否继续？',
    sub: '快照只含目标树；大石头/明晚预选/习惯打卡中指向已消失节点的引用会被一并清理。',
  });
  if (!okSnap) return;
  applyWorkflowsData(res);
  reconcileRefsAfterRestore();   // v8.10: 快照树与当前 meta 不配套，清孤儿引用
  save(); afterChange();
  showToast('↩ 已恢复到快照');
}
/* 文件落盘：File System Access API（Chrome/Edge 桌面）。handle 存 IndexedDB，save 时节流自动写。
   落盘文件可被 Syncthing / 网盘同步，实现 local-first 多设备同步（不绑云账号）。 */
const FS_DB = 'goalflow-fs', FS_STORE = 'handles', FS_KEY = 'backupFile';
const FS_WRITE_INTERVAL = 5 * 60 * 1000;
let _fsHandle = null, _fsLastWrite = 0;
function fsSupported() { return typeof window.showSaveFilePicker === 'function' && typeof indexedDB !== 'undefined'; }
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(FS_DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(FS_STORE)) r.result.createObjectStore(FS_STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction(FS_STORE, 'readonly').objectStore(FS_STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function idbSet(key, val) { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction(FS_STORE, 'readwrite').objectStore(FS_STORE).put(val, key); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
async function idbDel(key) { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction(FS_STORE, 'readwrite').objectStore(FS_STORE).delete(key); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
async function fsInit() {
  if (!fsSupported()) return;
  try { _fsHandle = (await idbGet(FS_KEY)) || null; } catch (e) { _fsHandle = null; }
}
async function fsGranted(handle, request) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  try {
    if (await handle.queryPermission(opts) === 'granted') return true;
    if (request && await handle.requestPermission(opts) === 'granted') return true;
  } catch (e) { }
  return false;
}
async function fsWrite(force) {
  if (!_fsHandle) return;
  const now = Date.now();
  if (!force && now - _fsLastWrite < FS_WRITE_INTERVAL) return;
  try {
    if (!await fsGranted(_fsHandle, false)) return;
    const w = await _fsHandle.createWritable();
    await w.write(snapshotPayload());
    await w.close();
    _fsLastWrite = now;
  } catch (e) { console.warn('[GoalFlow] 文件落盘失败', e); }
}
async function chooseBackupFile() {
  if (!fsSupported()) { showToast('⚠️ 当前环境不支持文件落盘（需 Chrome/Edge 桌面版，且经 http(s) 打开）'); return; }
  try {
    const handle = await window.showSaveFilePicker({ suggestedName: 'goalflow-data.json', types: [{ description: 'GoalFlow 数据', accept: { 'application/json': ['.json'] } }] });
    _fsHandle = handle;
    await idbSet(FS_KEY, handle);
    await fsWrite(true);
    showToast('✅ 已绑定备份文件，之后自动落盘');
  } catch (e) { if (e && e.name !== 'AbortError') showToast('⚠️ 绑定失败'); }
}
async function fsLoadFromFile() {
  if (!fsSupported()) { showToast('⚠️ 当前环境不支持文件读取'); return; }
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'GoalFlow 数据', accept: { 'application/json': ['.json'] } }] });
    const file = await handle.getFile();
    importBackupText(await file.text());
  } catch (e) { if (e && e.name !== 'AbortError') showToast('⚠️ 读取失败'); }
}
async function fsUnbind() {
  _fsHandle = null;
  try { await idbDel(FS_KEY); } catch (e) { }
  showToast('已解除文件绑定');
}
async function fsStatusText() {
  if (!fsSupported()) return '当前环境不支持文件落盘';
  if (!_fsHandle) return '未绑定文件';
  const ok = await fsGranted(_fsHandle, false);
  return `已绑定：${_fsHandle.name || 'goalflow-data.json'}${ok ? ' · 自动落盘开' : ' · 需重新授权'}`;
}
function ritualTemplate(cycle, draft, last) {
  if (cycle === 'month') return [
    { k: 'highlight', label: '① 本月高光时刻', hint: '自动汇集完成叶子，可删改。', type: 'area', def: last.highlight || draft.wins },
    { k: 'lesson', label: '② 本月最大教训', type: 'area' },
    { k: 'theme', label: '③ 下月一个主题词', type: 'area' },
    { k: 'next', label: '④ 下周期调整行动', hint: '每行一条——保存后进入晨计划待确认（PDCA 的 Act）', type: 'area', def: last.next || '' },
  ];
  if (cycle === 'quarter') return [
    { k: 'okr', label: '① OKR / KR 得分（0–10）', hint: '对照左侧度量条与 KR 进度。', type: 'area' },
    { k: 'align', label: '② 与年度目标对齐了吗？', type: 'area' },
    { k: 'bet', label: '③ 下季一个战略赌注', type: 'area' },
    { k: 'next', label: '④ 下周期调整行动', hint: '每行一条——保存后进入晨计划待确认（PDCA 的 Act）', type: 'area', def: last.next || '' },
  ];
  return [
    { k: 'pause_done', label: '开场 · 暂停 10 秒', hint: '闭眼深呼吸。', type: 'check', checked: !!last.pause_done },
    { k: 'gold', label: '① 金线推进？', hint: '周回顾 · 三问', type: 'area', def: draft.gold },
    { k: 'core', label: '② 核心投入几成？', hint: '对照核心 vs 救火', type: 'area', def: draft.core },
    { k: 'block', label: '③ 下周深潜块？', hint: '何时 · 做什么 · 如何守住', type: 'area', def: last.block || '' },
    { k: 'exec', label: '④ 执行 / 偏差反馈', hint: '自动汇总近 7 天完成与估实差异，可改', type: 'area', def: draft.exec },
    { k: 'wins', label: '附加 · 本周小赢', type: 'area', def: draft.wins },
    { k: 'next', label: '⑤ 下周期调整行动', hint: '每行一条——保存后进入晨计划待确认（PDCA 的 Act）', type: 'area', def: last.next || '' },
    { k: 'commit', label: '封坛 · 一句承诺', type: 'area' },
  ];
}
function reviewCycleLabel(c) { return c === 'week' ? '周回顾' : c === 'month' ? '月回顾' : '季回顾'; }
function reviewChecklistHtml() {
  const someday = inboxItems().filter(i => i.status === 'someday');
  const waiting = parkedEntries().filter(ent => ent.node.status === 'waiting');
  const stale = stagnationAlerts(STALE_DAYS).slice(0, 6);
  if (!someday.length && !waiting.length && !stale.length) return '';
  const sdRows = someday.slice(0, 12).map(it => `<li class="rc-row"><span class="rc-t">${esc(it.text)}</span><span class="rc-acts"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-rc-task="${it.id}" title="现在就要做 · 变成今日任务">→今天</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-rc-trash="${it.id}" title="不做了 · 丢弃">🗑</button></span></li>`).join('');
  const wtRows = waiting.slice(0, 12).map(ent => { const n = ent.node; const due = followUpDue(n); return `<li class="rc-row${due ? ' rc-due' : ''}"><span class="rc-t">${esc(n.text)}${n.waitNote ? ' · ' + esc(n.waitNote) : ''}${due ? ' · 📣需催办' : ''}</span><span class="rc-acts"><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-rc-fu="${n.id}" data-wf="${ent.wfId}" title="已催办 · 顺延 3 天">📣已催办</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-rc-unpark="${n.id}" data-wf="${ent.wfId}" title="收到回复 · 解除等待">↩解除</button></span></li>`; }).join('');
  const stRows = stale.map(a => `<li class="rc-row"><span class="rc-t">${esc(a.node.text)} · ${a.days >= 999 ? '从未激活' : a.days + '天无动静'}</span><span class="rc-acts"><button type="button" class="gf-btn gf-btn--sm" data-rc-stale="${a.node.id}" data-wf="${a.wfId}" title="钉入今日清单并标记激活">⚡激活</button></span></li>`).join('');
  return `<details class="wr-fold" open><summary>🧹 回顾清单（GTD 每周必做）</summary><div class="rc-wrap">
    ${someday.length ? `<div class="rc-sec"><div class="rc-h">☁ 以后再说 · ${someday.length} 项 —— 重新澄清：现在要做吗？</div><ul class="rc-list">${sdRows}</ul></div>` : ''}
    ${waiting.length ? `<div class="rc-sec"><div class="rc-h">⏳ 等待中 · ${waiting.length} 项 —— 该催的催，该解除的解除</div><ul class="rc-list">${wtRows}</ul></div>` : ''}
    ${stale.length ? `<div class="rc-sec"><div class="rc-h">⚠️ 停滞预警 · ${STALE_DAYS}天+ 无动静 —— 激活或放弃</div><ul class="rc-list">${stRows}</ul></div>` : ''}
  </div></details>`;
}
function bindReviewChecklist(overlay, cycle) {
  const refresh = () => openReview(cycle);
  overlay.querySelectorAll('[data-rc-task]').forEach(b => b.onclick = () => { clarifyInbox(b.dataset.rcTask, 'task', state.activeWorkflowId); refresh(); });
  overlay.querySelectorAll('[data-rc-trash]').forEach(b => b.onclick = () => { clarifyInbox(b.dataset.rcTrash, 'trash'); refresh(); });
  overlay.querySelectorAll('[data-rc-fu]').forEach(b => b.onclick = () => { const n = nodeInWorkflow(b.dataset.wf, b.dataset.rcFu); if (n) { n.followUpAt = Date.now(); n.followUp = dateKey(addDays(today0(), 3)); save(); } refresh(); });
  overlay.querySelectorAll('[data-rc-unpark]').forEach(b => b.onclick = () => { const n = nodeInWorkflow(b.dataset.wf, b.dataset.rcUnpark); if (n) { n.status = ''; n.waitNote = ''; n.followUp = ''; save(); } refresh(); });
  overlay.querySelectorAll('[data-rc-stale]').forEach(b => b.onclick = () => { activateStale(b.dataset.wf, b.dataset.rcStale); refresh(); });
}
function openReview(cycle) {
  cycle = cycle || 'week';
  const overlay = document.getElementById('weekReviewModal');
  const pr = periodRange(cycle);
  const store = REVIEW_STORE[cycle];
  const last = (state.meta[store] || []).find(r => (r.period || r.week) === pr.key) || {};
  const st = computePeriodStats(cycle);
  const draft = autoWeekDraft(st, last);
  const ritual = ritualTemplate(cycle, draft, last);
  const lp = st.leafProg;
  const okrHtml = (st.okrNodes && st.okrNodes.length) ? `<details class="wr-fold"><summary>📈 OKR · 习惯进度（${Math.min(st.okrNodes.length, 8)} 项）</summary><ul class="wr-okr">${st.okrNodes.slice(0, 8).map(n => {
    const mp = metricProgress(n); if (!mp) return '';
    const pace = paceStatus(n);
    const conf = n.role === 'KR' && n.conf ? ` · 信心 ${n.conf}/5${n.confNote ? '（' + esc(n.confNote) + '）' : ''}` : '';
    return `<li>${esc(n.text)} · ${mp.done}/${mp.tgt}（${mp.pct}%）${pace ? ` · 节奏 Δ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}` : ''}${conf}</li>`;
  }).join('')}</ul></details>` : '';
  // 月/季回顾：「目标前进了没有」——与叶子完成率分开看（含补行动操作，默认展开）
  const movedHtml = (cycle !== 'week' && st.okrNodes && st.okrNodes.length) ? `
    <details class="wr-fold" open><summary>🎯 目标前进了没有（${pr.label}）</summary>
    <div class="wr-moved">
      ${st.progressed.length ? `<div class="wr-moved-sec ok">✅ 有前进 ${st.progressed.length} 项<ul>${st.progressed.slice(0, 6).map(n => `<li>${esc(n.text)}${n.role === 'KR' && n.conf ? ` · 信心${n.conf}/5` : ''}</li>`).join('')}</ul></div>` : ''}
      ${st.stalled.length ? `<div class="wr-moved-sec warn">⏸ 还在原地 ${st.stalled.length} 项<ul>${st.stalled.slice(0, 6).map(n => `<li data-mvrow="${n.id}">${esc(n.text)} <button type="button" class="gf-btn gf-btn--sm" data-mvact="${n.id}" title="给这个目标补一条下周行动（进晨计划待确认）">→ 补行动</button></li>`).join('')}</ul></div>` : ''}
      ${!st.progressed.length && !st.stalled.length ? '<div class="wr-empty">该周期没有可判定的目标。</div>' : ''}
    </div></details>` : '';
  overlay.classList.add('show');
  overlay.innerHTML =`<div class="modal modal-wide" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">📋</div>
      <div><div class="mh-tt">${reviewCycleLabel(cycle)}</div><div class="mh-sub">分析 → 仪式 · ${pr.label} · ${pr.key}</div></div>
      <span class="mh-x" id="wrClose">×</span>
    </div>
    <div class="wr-cycle">
      <button type="button" class="wr-ctab${cycle === 'week' ? ' on' : ''}" data-cycle="week">周</button>
      <button type="button" class="wr-ctab${cycle === 'month' ? ' on' : ''}" data-cycle="month">月</button>
      <button type="button" class="wr-ctab${cycle === 'quarter' ? ' on' : ''}" data-cycle="quarter">季</button>
    </div>
    <div class="wr-tabs">
      <button type="button" class="wr-tab on" data-tab="stats">📊 ${pr.label}分析</button>
      <button type="button" class="wr-tab" data-tab="ritual">🕯 仪式模板</button>
    </div>
    <div class="wr-pane on" data-pane="stats">
      ${(() => {
        // v6.5 承诺卡对照：周回顾开篇先展示「你当时承诺了什么」
        if (cycle !== 'week') return '';
        const wk = weekKey();
        const plan = (state.meta.weekPlans || {})[wk];
        if (!plan || !(plan.rocks || []).length) return '';
        const rows = plan.rocks.map(r => {
          const n = nodeInWorkflow(r.wfId, r.nodeId);
          const done = n && n.done;
          return `<li class="${done ? 'ok' : 'miss'}">${done ? '✅' : '○'} ${esc(r.text)}</li>`;
        }).join('');
        const doneN = plan.rocks.filter(r => { const n = nodeInWorkflow(r.wfId, r.nodeId); return n && n.done; }).length;
        return `<div class="wr-commit${doneN === plan.rocks.length ? ' all' : ''}">
          <div class="wr-commit-h">📜 本周承诺卡 · 履约 ${doneN}/${plan.rocks.length}${plan.committedAt ? ' · 承诺于 ' + new Date(plan.committedAt).toLocaleDateString() : ''}</div>
          ${plan.intent ? `<div class="wr-commit-intent">「${esc(plan.intent)}」</div>` : ''}
          <ul class="wr-commit-list">${rows}</ul>
        </div>`;
      })()}
      <div class="wr-stats-grid">
        <div class="wr-stat"><div class="wr-k">${pr.label}完成（叶子）</div><div class="wr-v">${st.total}</div><div class="wr-h">带完成时间戳的叶子</div></div>
        <div class="wr-stat"><div class="wr-k">核心象限占比</div><div class="wr-v gold">${st.corePct}%</div><div class="wr-h">完成项里重要不紧急</div></div>
        <div class="wr-stat"><div class="wr-k">待办叶子</div><div class="wr-v">${st.pending}</div><div class="wr-h">⚡快速赢 ${st.quickWins}</div></div>
        <div class="wr-stat"><div class="wr-k">全树叶子</div><div class="wr-v">${lp ? lp.pct : 0}%</div><div class="wr-h">${lp ? lp.done + '/' + lp.total : '—'}</div></div>
      </div>
      <div class="wr-gold ${st.goldMoved ? 'ok' : 'warn'}">${st.goldMoved ? '★ 金线有推进' : '○ 金线待激活'} · ${esc((st.goldDetail || '').split('\n')[0])}</div>
      <div class="wr-bars-title">核心 vs 救火</div>
      <div class="wr-bar-row"><span class="wr-lbl">核心</span><div class="wr-bar"><i style="width:${st.coreVsFire.corePct}%;background:${PALETTE_UR[0]}"></i></div><span class="wr-num">${st.coreVsFire.core}</span></div>
      <div class="wr-bar-row"><span class="wr-lbl">救火</span><div class="wr-bar"><i style="width:${st.coreVsFire.firePct}%;background:${PALETTE_UR[4]}"></i></div><span class="wr-num">${st.coreVsFire.fire}</span></div>
      ${(() => { const a = timeAudit(cycle === 'week' ? 7 : cycle === 'month' ? 30 : 90); const tgt = (state.meta && state.meta.q2Target) || 50; const p = a.catTotal ? Math.round((a.byCat.core || 0) / a.catTotal * 100) : 0; return a.catTotal ? `<div class="wr-bar-row" title="近${cycle === 'week' ? '7' : cycle === 'month' ? '30' : '90'}天实际投入（执行记录）中 Q2 重要不紧急占比"><span class="wr-lbl">Q2 时间</span><div class="wr-bar"><i style="width:${p}%;background:${p >= tgt ? '#4caf7d' : 'var(--ur4)'}"></i></div><span class="wr-num">${p}% / 目标 ${tgt}%</span></div>` : ''; })()}
      ${okrHtml}
      ${movedHtml}
      ${reviewChecklistHtml()}
      ${st.estSum ? `<div class="wr-h" style="margin:8px 0">预估 ${st.estSum} 分 · 实计 ${st.actSum} 分</div>` : ''}
      <details class="wr-fold"><summary>📊 完成明细 · 四象限（${st.total} 项）</summary>
      ${st.total ? weekStatsBarsHtml(st) : '<div class="wr-empty">该周期尚无完成记录。</div>'}
      ${st.completedTexts.length ? `<div class="wr-done-list"><ul>${st.completedTexts.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      </details>
    </div>
    <div class="wr-pane" data-pane="ritual">
      <div class="chat wr-ritual">${ritual.map(q => {
    if (q.type === 'check') return `<label class="wr-check"><input type="checkbox" data-k="${q.k}" ${q.checked ? 'checked' : ''}><span><b>${q.label}</b><br><span class="wr-hint">${q.hint || ''}</span></span></label>`;
    return `<label class="wr-field"><span class="wr-fl">${q.label}</span>${q.hint ? `<span class="wr-hint">${q.hint}</span>` : ''}
          <textarea data-k="${q.k}" rows="2">${esc(last[q.k] || q.def || '')}</textarea></label>`;
  }).join('')}</div>
    </div>
    <div class="modal-foot">
      <button class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="wrSave">保存${reviewCycleLabel(cycle)}</button>
      <button class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="wrCancel">取消</button>
    </div>
  </div>`;
  overlay.querySelectorAll('.wr-ctab').forEach(b => b.onclick = () => openReview(b.dataset.cycle));
  overlay.querySelectorAll('.wr-tab').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('.wr-tab').forEach(b => b.classList.toggle('on', b === btn));
      overlay.querySelectorAll('.wr-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === btn.dataset.tab));
    };
  });
  overlay.querySelector('#wrClose').onclick = closeWeekReview;
  overlay.querySelector('#wrCancel').onclick = closeWeekReview;
  bindReviewChecklist(overlay, cycle);
  // 月/季回顾：给停滞目标补行动（进晨计划待确认，PDCA Act）——行内输入，替代原生 prompt
  overlay.querySelectorAll('[data-mvact]').forEach(b => b.onclick = () => {
    const n = byId(b.dataset.mvact); if (!n) return;
    const li = b.closest('li'); if (!li || li.querySelector('.wr-mv-input')) return;
    const box = document.createElement('span'); box.className = 'wr-mv-input';
    box.innerHTML = `<input class="gf-input" value="推进：${esc(n.text.slice(0, 20))}"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary">加入</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost">×</button>`;
    li.appendChild(box);
    const inp = box.querySelector('input');
    const [okB, cancelB] = box.querySelectorAll('button');
    inp.focus(); inp.select();
    cancelB.onclick = () => box.remove();
    const commit = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      ensureScoreMeta();
      state.meta.pendingActions.push({ id: 'pa' + Date.now() + Math.floor(Math.random() * 1000), text: v, fromCycle: cycle, period: pr.key, status: 'pending', createdAt: Date.now(), wfId: state.activeWorkflowId || '' });
      saveMeta();
      box.remove();
      b.textContent = '✓ 已加入晨计划'; b.disabled = true;
    };
    okB.onclick = commit;
    inp.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') box.remove(); };
  });
  overlay.querySelector('#wrSave').onclick = () => {
    const entry = {
      cycle, period: pr.key, week: cycle === 'week' ? pr.key : undefined, savedAt: new Date().toISOString(),
      statsSnapshot: { total: st.total, corePct: st.corePct, byCat: st.byCat }
    };
    overlay.querySelectorAll('textarea[data-k]').forEach(ta => { entry[ta.dataset.k] = ta.value.trim(); });
    overlay.querySelectorAll('input[type=checkbox][data-k]').forEach(cb => { entry[cb.dataset.k] = cb.checked; });
    const arr = state.meta[store] || [];
    state.meta[store] = arr.filter(r => (r.period || r.week) !== pr.key);
    state.meta[store].push(entry);
    // PDCA · Act：把「下周期调整行动」落到晨计划待确认队列
    ensureScoreMeta();
    const lines = String(entry.next || '').split(/\n+/).map(s => s.replace(/^[-·\d.\s]+/, '').trim()).filter(Boolean);
    if (lines.length) {
      state.meta.pendingActions = state.meta.pendingActions.filter(a => !(a.fromCycle === cycle && a.period === pr.key && a.status === 'pending'));
      lines.slice(0, 5).forEach(text => {
        state.meta.pendingActions.push({ id: 'pa' + Date.now() + Math.floor(Math.random() * 1000), text, fromCycle: cycle, period: pr.key, status: 'pending', createdAt: Date.now(), wfId: state.activeWorkflowId || '' });
      });
    }
    saveMeta(); closeWeekReview(); renderReviewBanner();
    showToast('💾 ' + reviewCycleLabel(cycle) + '已保存（本机）' + (lines.length ? ` · ${lines.length} 条调整行动已加入晨计划待确认` : ''));
  };
  overlay.onclick = e => { if (e.target === overlay) closeWeekReview(); };
}
function openWeekReview() { openReview('week'); }
function closeWeekReview() {
  const overlay = document.getElementById('weekReviewModal');
  overlay.classList.remove('show'); overlay.innerHTML = '';
}

/* ============ 早晚仪式闹钟（晨计划 / 晚总结） ============ */
function tickRitualAlarms() {
  ensureScoreMeta();
  const r = state.meta.ritual;
  if (!r || r.on === false) return;
  if (!state.meta.alarmFired) state.meta.alarmFired = {};
  const dk = dateKey();
  const now = new Date();
  // 周一晨间：未排大石头则先弹周计划
  const wk = weekKey();
  if (now.getDay() === 1 && !(state.meta.weekPlans && state.meta.weekPlans[wk]) && !state.meta.alarmFired['weekplan|' + wk]) {
    const mt = String(r.morning || '08:30').split(':');
    const wAt = new Date(now); wAt.setHours(clamp(+mt[0] || 8, 0, 23), clamp(+mt[1] || 30, 0, 59), 0, 0);
    if (now >= wAt) {
      state.meta.alarmFired['weekplan|' + wk] = true; saveMeta();
      openWeekPlan();
      return;
    }
  }
  [['morning', r.morning], ['evening', r.evening]].forEach(([kind, ts]) => {
    if (!ts) return;
    const p = String(ts).split(':');
    const fireAt = new Date(now);
    fireAt.setHours(clamp(+p[0] || 0, 0, 23), clamp(+p[1] || 0, 0, 59), 0, 0);
    if (now < fireAt) return;
    const key = 'ritual|' + dk + '|' + kind;
    if (state.meta.alarmFired[key]) return;
    state.meta.alarmFired[key] = true; saveMeta();
    openRitualModal(kind);
  });
}
function openRitualModal(kind) {
  const overlay = document.getElementById('ritualModal'); if (!overlay) return;
  ensureScoreMeta();
  const ts = todayScore();
  if (kind === 'morning') {
    const dk = dateKey();
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yEntries = (state.meta.scoreLog[dateKey(yd)] || { entries: [] }).entries;
    const yTotal = yEntries.reduce((a, e) => a + (e.score || 0), 0);
    const pool = todayAggregatedPool();
    const topNode = state.topId ? byId(state.topId) : null;
    let mitEntry = pool.find(x => x.node.id === state.topId)
      || (topNode && !topNode.done ? { node: topNode, wfId: state.activeWorkflowId, wfName: (workflowById(state.activeWorkflowId) || {}).name || '', isWfTop: true } : null)
      || pool.find(x => x.isWfTop) || pool[0] || null;
    // v6.3 昨晚预选的 MIT 优先（Ivy Lee：晨间只需确认，不再决策）
    const tmPre = state.meta.tomorrowMit;
    let preMit = null;
    if (tmPre && tmPre.forDate === dk && tmPre.nodeId) {
      const tn = nodeInWorkflow(tmPre.wfId, tmPre.nodeId);
      if (tn && !tn.done) {
        preMit = { wfId: tmPre.wfId, wfName: (state.workflows.find(w => w.id === tmPre.wfId) || {}).name || '', node: tn };
        mitEntry = preMit;
      }
    }
    const d = dayPlanFeasibilityAll();
    const wk = weekKey();
    const hasPlan = !!(state.meta.weekPlans && state.meta.weekPlans[wk]);
    const pendings = (state.meta.pendingActions || []).filter(a => a.status === 'pending').slice(0, 3);
    const listHtml = pool.filter(ent => !ent.node._overflow).slice(0, 6).map(ent => {  // v8.11: 预览只列预算内任务
      const n = ent.node;
      return `<div class="rt-row"><span class="rt-t">${ent.isWfTop ? '★ ' : ''}${esc(n.text)}</span><span class="rt-m">${esc(ent.wfName || '')}${n.estimateMinutes ? ` · ${n.estimateMinutes}′` : ''}</span></div>`;
    }).join('');
    const pendingHtml = pendings.length ? `<div class="rt-pend"><div class="rt-pend-h">📋 回顾调整行动 · 待确认（PDCA → Act）</div>${pendings.map(pa =>
      `<div class="rt-row"><span class="rt-t">${esc(pa.text)}</span><span class="rt-m">来自${reviewCycleLabel(pa.fromCycle)}</span>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-adopt="${pa.id}">采纳</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-skip="${pa.id}">跳过</button></div>`).join('')}</div>` : '';
    const ifthenHtml = mitEntry ? (
      mitEntry.node.ifThen
        ? `<div class="rt-ifthen has">🛡 MIT 预案：${esc(mitEntry.node.ifThen)}</div>`
        : `<div class="rt-ifthen"><span>🛡 给 MIT 补一句障碍预案：</span><input id="rtIfThen" class="gf-input" placeholder="如果[障碍]，我就[应对]"><button type="button" class="gf-btn gf-btn--sm" id="rtIfThenSave">存</button></div>`
    ) : '';
    const staleAlerts = stagnationAlerts(STALE_DAYS).slice(0, 3);
    const staleHtml = staleAlerts.length ? `<div class="rt-stale"><div class="rt-stale-h">⚠️ 停滞预警 · ${STALE_DAYS} 天+ 无动静</div>${staleAlerts.map(a =>
      `<div class="rt-row"><span class="rt-t">${esc(a.node.text)}</span><span class="rt-m">${a.days >= 999 ? '从未激活' : a.days + ' 天'} · ${esc(a.wfName)}</span>
        <button type="button" class="gf-btn gf-btn--sm" data-stale-act="${a.node.id}" data-wf="${a.wfId}">⚡ 激活到今日</button></div>`).join('')}</div>` : '';
    // v6.4 提醒给没有触发线索的习惯补 ⚓（习惯叠加）
    const noAnchor = pool.filter(ent => (ent.node.recur || ent.node.role === 'habit') && !ent.node.done && !(ent.node.anchor || '').trim());
    const anchorHtml = noAnchor.length ? `<details class="rt-preview"><summary>⚓ ${noAnchor.length} 个习惯还没设触发线索</summary>
      <div class="hint">「在[既有行为]之后，我就[习惯]」——早餐后/通勤后这类线索，比裸时间承诺更可靠。回今日面板点习惯行尾的 ⚓ 补上。</div></details>` : '';
    // v8.12 仪式历史：打开即快照留痕（⏰ 到点弹出 / 手动打开都算做过晨计划），「📜 历史」页可查；
    // 同一天重复打开只刷新记录时间与 MIT 选择，语义=「今天最后一次看到的晨计划」
    state.meta.morningPlans[dk] = {
      at: Date.now(),
      mit: mitEntry ? { wfId: mitEntry.wfId || '', nodeId: mitEntry.node.id, text: mitEntry.node.text, pre: !!preMit } : null,
      poolN: pool.length, est: d.est, cap: d.cap, pendN: pendings.length
    };
    saveMeta();
    overlay.innerHTML =`<div class="modal modal-wide">
      <div class="modal-head"><div class="mh-ic">🌅</div>
        <div><div class="mh-tt">早安 · 制订今日计划</div>
        <div class="mh-sub">昨日总评分 ${yTotal || '—'} · 今日已收敛 ${pool.length} 项 · 预估 ${d.est}′ / 每日可投入 ${d.cap}′${d.over ? `（超出 ${d.est - d.cap}′，建议删减或顺延）` : ''}</div></div>
        <span class="mh-x" id="rtClose">×</span></div>
      <div class="rt-body">
        ${hasPlan ? '' : '<div class="rt-weekplan-tip">本周还没排大石头 <button type="button" class="gf-btn gf-btn--sm" id="rtWeekPlan">🗓 先排本周大石头</button></div>'}
        ${mitEntry ? `<div class="rt-mit${preMit ? ' pre' : ''}">${preMit ? '<span class="rt-pre-tag">🌙 昨晚预选</span>' : ''}今日 MIT：<b>${esc(mitEntry.node.text)}</b>${mitEntry.wfName ? `<span class="rt-m"> · ${esc(mitEntry.wfName)}</span>` : ''}${preMit ? '<span class="rt-mit-acts"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="rtMitKeep">✓ 就是它</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="rtMitSwap">换一个</button></span>' : ''}</div>` : '<div class="rt-mit">还没有 MIT——先解析目标或载入示例。</div>'}
        ${ifthenHtml}
        ${staleHtml}
        ${anchorHtml}
        <details class="rt-preview"><summary>👀 今日清单预览（${pool.length} 项）</summary><div class="rt-list">${listHtml || '<div class="hint">今日清单为空，可先给任务加「今天」或钉时段。</div>'}</div></details>
        ${pendingHtml}
      </div>
      <div class="modal-foot">
        <button type="button" class="gf-btn gf-btn--primary" id="rtAdjust">去调整今日行动</button>
        <button type="button" class="gf-btn gf-btn--ghost" id="rtOk">保持计划，开始一天</button>
      </div></div>`;
    overlay.classList.add('show');
    overlay.querySelector('#rtClose').onclick = closeRitualModal;
    overlay.querySelector('#rtOk').onclick = closeRitualModal;
    overlay.querySelector('#rtAdjust').onclick = () => { closeRitualModal(); scrollToToday(); };
    const wpBtn = overlay.querySelector('#rtWeekPlan');
    if (wpBtn) wpBtn.onclick = () => { openWeekPlan(); };
    // v6.3 昨晚预选 MIT：采用 / 换一个
    const keepBtn = overlay.querySelector('#rtMitKeep');
    if (keepBtn && preMit) keepBtn.onclick = () => {
      const n = nodeInWorkflow(preMit.wfId, preMit.node.id);
      if (n) { n.scale = 'day'; n.touchedAt = Date.now(); }
      state.meta.tomorrowMit = null;
      save(); saveMeta(); openRitualModal('morning');
    };
    const swapBtn = overlay.querySelector('#rtMitSwap');
    if (swapBtn) swapBtn.onclick = () => { state.meta.tomorrowMit = null; saveMeta(); openRitualModal('morning'); };
    const itSave = overlay.querySelector('#rtIfThenSave');
    if (itSave && mitEntry) itSave.onclick = () => {
      const inp = overlay.querySelector('#rtIfThen');
      const n = nodeInWorkflow(mitEntry.wfId, mitEntry.node.id);
      if (n && inp && inp.value.trim()) {
        n.ifThen = inp.value.trim(); save();
        const box = overlay.querySelector('.rt-ifthen');
        if (box) { box.classList.add('has'); box.innerHTML = `🛡 MIT 预案：${esc(n.ifThen)}`; }
      }
    };
    // 行内原地更新：采纳/跳过/激活只改这一行，不重建弹窗（保住滚动位置与输入焦点）
    overlay.querySelectorAll('[data-stale-act]').forEach(b => b.onclick = () => {
      activateStale(b.dataset.wf, b.dataset.staleAct);
      b.textContent = '✓ 已激活'; b.disabled = true;
    });
    overlay.querySelectorAll('[data-adopt]').forEach(b => b.onclick = () => {
      adoptPendingAction(b.dataset.adopt);
      const pa = (state.meta.pendingActions || []).find(a => a.id === b.dataset.adopt);
      if (!pa || pa.status !== 'adopted') return;
      const row = b.closest('.rt-row');
      const skip = row ? row.querySelector('[data-skip]') : null; if (skip) skip.remove();
      b.textContent = '✓ 已采纳'; b.disabled = true;
    });
    overlay.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => {
      const pa = (state.meta.pendingActions || []).find(a => a.id === b.dataset.skip);
      if (pa) { pa.status = 'skipped'; saveMeta(); }
      const row = b.closest('.rt-row');
      const adopt = row ? row.querySelector('[data-adopt]') : null; if (adopt) adopt.remove();
      b.textContent = '已跳过'; b.disabled = true;
    });
  } else {
    const undone = todayAggregatedPool().filter(ent => !ent.node.done);
    const dk = dateKey();
    const note = (state.meta.dayNotes && state.meta.dayNotes[dk]) || '';
    // v6.3 三件好事（峰终定律：以积极收尾）
    const goods = (state.meta.goodThings && state.meta.goodThings[dk]) || ['', '', ''];
    const goodHtml = `<div class="rt-good-h">✨ 今天值得记住的 3 个时刻</div>
      <div class="rt-good-sub">以积极收尾——你记住的今天是什么样子，由最后这一刻决定</div>
      <div class="rt-good">
        <input class="gf-input rt-good-i" id="rtGood1" placeholder="1. 一件做成的小事 / 一个开心瞬间" value="${esc(goods[0] || '')}">
        <input class="gf-input rt-good-i" id="rtGood2" placeholder="2.（可选）" value="${esc(goods[1] || '')}">
        <input class="gf-input rt-good-i" id="rtGood3" placeholder="3.（可选）" value="${esc(goods[2] || '')}">
      </div>`;
    // v6.3 明日 MIT 预选（Ivy Lee：睡前定好，明早不纠结）
    const tmrDk = dateKey(addDays(today0(), 1));
    const tm0 = state.meta.tomorrowMit;
    const tmSel = (tm0 && tm0.forDate === tmrDk) ? tm0.nodeId : '';
    const mitCands = undone.slice(0, 4);
    const mitPickHtml = mitCands.length ? `<div class="rt-pend"><div class="rt-pend-h">🌙 明日 MIT 预选 <span style="font-weight:400;color:var(--muted-2)">（睡前定好第一件事，明早只需确认）</span></div>${mitCands.map((ent, i) =>
      `<label class="rt-row" style="cursor:pointer"><input type="radio" name="rtMitPick" value="${ent.node.id}" data-wf="${ent.wfId}"${(tmSel ? tmSel === ent.node.id : i === 0) ? ' checked' : ''} style="margin-right:6px;flex-shrink:0"><span class="rt-t">${i === 0 ? '🐸 ' : ''}${esc(ent.node.text)}</span><span class="rt-m">${esc(ent.wfName || '')}</span></label>`).join('')}</div>` : '';
    const rows = ts.entries.map(e => `<div class="rt-row"><span class="rt-t">${e.kind === 'pomo' ? '🍅' : '✓'} ${esc(e.text)}</span><span class="rt-score">+${e.score}</span><span class="rt-m">${esc(e.reason || '')}</span></div>`).join('');
    // 未完成逐条处置：明天继续 / 改期 / 放弃（借鉴 super-productivity 日终处置）
    // 全量列出待处置项；已处置的收进折叠区，处置动作原地更新行、不重建弹窗（保住滚动位置）
    const dispoRow = ent => {
      const n = ent.node;
      const k = dk + '|' + ent.wfId + '|' + n.id;
      const cur = (state.meta.eveningDispo || {})[k] || '';
      const curLabel = cur === 'continue' ? '→ 明天继续' : cur === 'defer' ? `→ 改期${n.deadline ? '「' + esc(n.deadline) + '」' : ''}` : cur === 'drop' ? '已放弃' : '';
      return `<div class="rt-row dispo${cur ? ' disposed' : ''}" data-dk="${k}" data-wf="${ent.wfId}" data-node="${n.id}">
        <span class="rt-t">${esc(n.text)}</span>
        ${cur ? `<span class="rt-dispo-cur">${curLabel}</span>` : ''}
        <span class="rt-dispo"${cur ? ' style="display:none"' : ''}>
          <button type="button" class="gf-btn gf-btn--sm" data-dispo="continue" title="明天继续（排到明天）">继续</button>
          <button type="button" class="gf-btn gf-btn--sm" data-dispo="defer" title="改期（设个新期限）">改期</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-dispo="drop" title="放弃（标记不再做，从树里勾掉）">放弃</button>
        </span>
      </div>`;
    };
    const dispoMap = state.meta.eveningDispo || {};
    const dispoPend = undone.filter(ent => !dispoMap[dk + '|' + ent.wfId + '|' + ent.node.id]);
    // 已处置项从落盘记录还原（继续/放弃后节点会离开今日池，不能只靠 undone 过滤）
    const dispoDone = Object.keys(dispoMap).filter(k => k.startsWith(dk + '|')).map(k => {
      const parts = k.split('|');
      const n = nodeInWorkflow(parts[1], parts[2]);
      return n ? { wfId: parts[1], node: n } : null;
    }).filter(Boolean);
    const dispoRows = dispoPend.map(dispoRow).join('');
    const dispoDoneHtml = dispoDone.length ? `<details class="rt-dispo-done"><summary>✓ 已处置 <b class="rt-dispo-done-n">${dispoDone.length}</b> 项</summary><div class="rt-dispo-done-list">${dispoDone.map(dispoRow).join('')}</div></details>` : '';
    overlay.innerHTML =`<div class="modal modal-wide">
      <div class="modal-head"><div class="mh-ic">🌙</div>
        <div><div class="mh-tt">晚安 · 今日总结</div>
        <div class="mh-sub">完成 ${ts.count} 项 · 🍅 ${ts.pomos} 个 · 专注 ${ts.focusMin}′ · 未完成 ${undone.length} 项（逐条处置）</div></div>
        <span class="mh-x" id="rtClose">×</span></div>
      <div class="rt-body">
        <div class="rt-total"><span>今日总评分</span><b>${ts.total}</b><i class="ts-grade">${ts.grade}</i></div>
        <div class="rt-list">${rows || '<div class="hint">今天还没有评分记录——明天从 MIT 开始，完成叶子或番茄钟即可自动评分。</div>'}</div>
        ${undone.length ? `<div class="rt-dispo-h" id="rtDispoH">🧹 待处置 ${dispoPend.length} 项（明天继续 / 改期 / 放弃）</div><div class="rt-list dispo-list" id="rtDispoList">${dispoRows || '<div class="hint">全部处置完毕 🎉</div>'}</div>${dispoDoneHtml}` : '<div class="hint">今日清单全部完成 🎉</div>'}
        ${goodHtml}
        ${mitPickHtml}
        <textarea class="rt-note" id="rtNote" placeholder="一句话总结今天（可选，仅存本机）">${esc(note)}</textarea>
      </div>
      <div class="modal-foot">
        <button type="button" class="gf-btn gf-btn--primary" id="rtSave">保存并休息</button>
      </div></div>`;
    overlay.classList.add('show');
    overlay.querySelector('#rtClose').onclick = closeRitualModal;
    // 处置动作：原地更新行并移入「已处置」折叠区，不重建弹窗
    const dispoListOf = () => overlay.querySelector('#rtDispoList');
    const refreshDispoCounts = () => {
      const list = dispoListOf(); if (!list) return;
      const pendN = list.querySelectorAll('.rt-row.dispo:not(.disposed)').length;
      const h = overlay.querySelector('#rtDispoH');
      if (h) h.textContent = pendN ? `🧹 待处置 ${pendN} 项（明天继续 / 改期 / 放弃）` : '🧹 全部处置完毕 🎉';
      let done = overlay.querySelector('.rt-dispo-done');
      if (done) done.querySelector('.rt-dispo-done-n').textContent = done.querySelectorAll('.rt-row.dispo').length;
    };
    const markDisposed = (row, label) => {
      row.classList.add('disposed');
      const acts = row.querySelector('.rt-dispo'); if (acts) acts.style.display = 'none';
      let cur = row.querySelector('.rt-dispo-cur');
      if (!cur) { cur = document.createElement('span'); cur.className = 'rt-dispo-cur'; row.appendChild(cur); }
      cur.textContent = label;
      let done = overlay.querySelector('.rt-dispo-done');
      if (!done) {
        done = document.createElement('details'); done.className = 'rt-dispo-done'; done.open = true;
        done.innerHTML = '<summary>✓ 已处置 <b class="rt-dispo-done-n">0</b> 项</summary><div class="rt-dispo-done-list"></div>';
        dispoListOf().after(done);
      }
      done.querySelector('.rt-dispo-done-list').appendChild(row);
      refreshDispoCounts();
    };
    const unmarkDisposed = row => {
      row.classList.remove('disposed');
      const acts = row.querySelector('.rt-dispo'); if (acts) acts.style.display = '';
      const cur = row.querySelector('.rt-dispo-cur'); if (cur) cur.remove();
      const list = dispoListOf();
      const hint = list.querySelector('.hint'); if (hint) hint.remove();
      list.appendChild(row);
      const done = overlay.querySelector('.rt-dispo-done');
      if (done && !done.querySelectorAll('.rt-row.dispo').length) done.remove();
      refreshDispoCounts();
    };
    overlay.querySelectorAll('[data-dispo]').forEach(btn => btn.onclick = () => {
      const row = btn.closest('.rt-row.dispo'); if (!row) return;
      const wfId = row.dataset.wf, nodeId = row.dataset.node, act = btn.dataset.dispo;
      const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
      ensureScoreMeta();
      const k = row.dataset.dk;
      if (!state.meta.eveningDispo) state.meta.eveningDispo = {};
      if (act === 'continue') {
        // 明天继续：期限改到明天、钉到上午（v8.10: 走 setNodeDeadline 唯一写入口，五字段+deadlineText 同步）
        setNodeDeadline(n, '明天');
        n.scale = 'day'; if (!n.slot) n.slot = 'h1';
        state.meta.eveningDispo[k] = 'continue';
        save(); saveMeta();
        markDisposed(row, '→ 明天继续');
      } else if (act === 'defer') {
        // 改期：行内日期输入（支持自然语言），替代原生 prompt
        if (row.querySelector('.rt-defer')) return;
        const box = document.createElement('span'); box.className = 'rt-defer';
        box.innerHTML = `<input class="gf-input" placeholder="周五 / 3月15日 / 下周" value="${esc(n.deadline || '下周')}"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary">定</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost">×</button>`;
        row.appendChild(box);
        const inp = box.querySelector('input');
        const [okB, cancelB] = box.querySelectorAll('button');
        inp.focus(); inp.select();
        cancelB.onclick = () => box.remove();
        const commit = () => {
          const dl = parseDeadline(inp.value.trim());
          if (!dl.date) { showToast('🤔 没认出这个日期，试试「周五 / 3月15日 / 下周 / 月底」'); inp.focus(); return; }
          setNodeDeadline(n, inp.value.trim());   // v8.10: 唯一写入口，不再手搓五字段
          state.meta.eveningDispo[k] = 'defer';
          save(); saveMeta();
          box.remove();
          markDisposed(row, `→ 改期「${dl.label}」`);
        };
        okB.onclick = commit;
        inp.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') box.remove(); };
      } else if (act === 'drop') {
        n.done = true; n.doneAt = Date.now(); n.dropped = true;
        state.meta.eveningDispo[k] = 'drop';
        save(); saveMeta();
        markDisposed(row, '已放弃');
        showUndoToast(`🗑 已放弃「${n.text.slice(0, 18)}」`, () => {
          const nn = nodeInWorkflow(wfId, nodeId); if (!nn) return;
          nn.done = false; nn.doneAt = null; nn.dropped = false;
          delete state.meta.eveningDispo[k];
          save(); saveMeta();
          if (row.isConnected) unmarkDisposed(row);
        });
      }
    });
    overlay.querySelector('#rtSave').onclick = () => {
      const ta = overlay.querySelector('#rtNote');
      if (!state.meta.dayNotes) state.meta.dayNotes = {};
      state.meta.dayNotes[dk] = ta ? ta.value.trim() : '';
      // v6.3 三件好事
      state.meta.goodThings[dk] = ['rtGood1', 'rtGood2', 'rtGood3'].map(id => { const el = overlay.querySelector('#' + id); return el ? el.value.trim() : ''; });
      // v6.3 明日 MIT 预选
      const pick = overlay.querySelector('input[name="rtMitPick"]:checked');
      if (pick) {
        const ent = mitCands.find(x => x.node.id === pick.value && !x.node.done);
        state.meta.tomorrowMit = ent ? { forDate: tmrDk, wfId: ent.wfId, nodeId: ent.node.id, text: ent.node.text } : null;
      } else state.meta.tomorrowMit = null;
      saveMeta(); closeRitualModal();
      afterChange();
    };
  }
  overlay.onclick = e => { if (e.target === overlay) closeRitualModal(); };
}
function closeRitualModal() {
  const overlay = document.getElementById('ritualModal');
  if (overlay) { overlay.classList.remove('show'); overlay.innerHTML = ''; }
}

/* ============ 回顾调整行动 → 采纳为今日任务 ============ */
/* 统一「插一条今日行动到根下」：adoptPendingAction / clarifyInbox / 月回顾补行动 共用 */
function appendActionLeaf(text, opts) {
  opts = opts || {};
  const root = state.nodes[0];
  if (!root) return null;
  const maxId = state.nodes.reduce((m, n) => Math.max(m, +(n.id || 'n0').slice(1) || 0), 0);
  const node = newNode({
    id: 'n' + (maxId + 1), text: text || '', im: opts.im || 4, ur: opts.ur || 3,
    deadline: opts.deadline || '今天', deadlineDate: opts.deadlineDate || today0(), daysLeft: 0, overdue: false,
    parentId: root.id, scale: opts.scale || 'day', slot: opts.slot || '',
    estimateMinutes: opts.est || null, source: opts.source || '',
  });
  applySuggestions(node, text || '');
  if (opts.keepScale !== false) node.scale = opts.scale || 'day';
  if (opts.deadlineDate) {
    const dd = new Date(opts.deadlineDate);
    // 只传日期不传文案时补一个可解析的 label：recomputeSchedule 是按 deadline 文本重算的，
    // 否则下次载入会把手选的 deadlineDate 抹回「今天」。
    if (!opts.deadline) node.deadline = `${dd.getMonth() + 1}月${dd.getDate()}日`;
    const dl = parseDeadline(node.deadline);
    node.deadlineDate = dl.date || dd; node.daysLeft = dl.daysLeft; node.overdue = dl.overdue;
  }
  state.nodes.push(node);
  return node;
}
function adoptPendingAction(paId) {
  ensureScoreMeta();
  const pa = (state.meta.pendingActions || []).find(a => a.id === paId);
  if (!pa) return;
  // 回到原工作流（周回顾跨流，采纳不该全进当前流）
  const targetWf = pa.wfId && workflowById(pa.wfId) ? pa.wfId : state.activeWorkflowId;
  const prevWf = state.activeWorkflowId;
  if (targetWf !== state.activeWorkflowId) switchWorkflow(targetWf);
  const root = state.nodes[0];
  if (!root) { showToast('⚠️ 请先在目标工作流解析一个目标，再采纳调整行动'); if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  appendActionLeaf(pa.text, { deadline: '今天', deadlineDate: today0(), source: 'review' });
  pa.status = 'adopted';
  recomputeSchedule(state.nodes);
  save(); saveMeta();
  // v8.9: 跨流靠 switchWorkflow 内部刷新；同流采纳此前没有任何刷新 → 今日面板停留在旧数据
  if (targetWf !== prevWf) switchWorkflow(prevWf); else afterChange();
}

/* ============ 周计划仪式 · 本周大石头 ============ */
function weekPlanCandidates() {
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  activeWorkflows().forEach(wf => {  // v6.5: 归档项目不进候选
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    computeTree(nodes);
    nodes.filter(n => n.parentId && !n.done && n._children.length === 0 && n.im >= 4).forEach(n => {
      out.push({ wfId: wf.id, wfName: wf.name || '', node: n, _s: focusScore(n) });
    });
  });
  return out.sort((a, b) => b._s - a._s).slice(0, 12);
}
function openWeekPlan() {
  const overlay = document.getElementById('ritualModal'); if (!overlay) return;
  ensureScoreMeta();
  const wk = weekKey();
  const plan = (state.meta.weekPlans || {})[wk];
  const cands = weekPlanCandidates();
  const savedIds = new Set((plan && plan.rocks || []).map(r => r.wfId + '|' + r.nodeId));
  overlay.innerHTML =`<div class="modal modal-wide">
    <div class="modal-head"><div class="mh-ic">🗓</div>
      <div><div class="mh-tt">周计划 · 本周大石头</div>
      <div class="mh-sub">先放 3–5 块大石头（重要叶子），再让小石子填缝 · 周一 ${wk} 起</div></div>
      <span class="mh-x" id="wpClose">×</span></div>
    <div class="rt-body">
      <div class="rt-list">${cands.length ? cands.map((c, i) => {
    const key = c.wfId + '|' + c.node.id;
    return `<label class="wp-cand"><input type="checkbox" data-rock="${i}" ${savedIds.has(key) ? 'checked' : ''}>
          <span class="rt-t">${esc(c.node.text)}</span><span class="rt-m">${esc(c.wfName)} · 分 ${c._s}${c.node.estimateMinutes ? ` · ${c.node.estimateMinutes}′` : ''}</span></label>`;
  }).join('') : '<div class="hint">暂无候选——先解析目标，或把重要叶子提到重要度 ≥4。</div>'}</div>
      <div class="hint">勾选 ≤5 块；保存后出现在「今日行动」大石头条，整周可见。</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="wpSave">保存本周大石头</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="wpCancel">取消</button>
    </div></div>`;
  overlay.classList.add('show');
  overlay.querySelector('#wpClose').onclick = closeRitualModal;
  overlay.querySelector('#wpCancel').onclick = closeRitualModal;
  overlay.querySelector('#wpSave').onclick = () => {
    const picks = [];
    overlay.querySelectorAll('input[data-rock]:checked').forEach(cb => {
      const c = cands[+cb.dataset.rock];
      if (c) picks.push({ wfId: c.wfId, nodeId: c.node.id, text: c.node.text });
    });
    if (picks.length > 5) { alert('大石头最多 5 块——少即是多'); return; }
    if (!picks.length) { alert('至少选 1 块大石头'); return; }
    openCommitCard(wk, picks);
  };
  overlay.onclick = e => { if (e.target === overlay) closeRitualModal(); };
}
/* v6.5 承诺卡（commitment device）：周计划确认后先生成承诺卡，签名式「我承诺」才落库。
   理论：损失厌恶 + 一致性偏见（stickK/Beeminder）——明确承诺+对照显著提升履约率。 */
function openCommitCard(wk, picks) {
  const overlay = document.getElementById('ritualModal'); if (!overlay) return;
  overlay.innerHTML = `<div class="modal" style="max-width:480px">
    <div class="modal-head"><div class="mh-ic">📜</div>
      <div><div class="mh-tt">本周承诺卡</div>
      <div class="mh-sub">周一 ${wk} 起 · 周回顾时先对照这张卡</div></div>
      <span class="mh-x" id="ccClose">×</span></div>
    <div class="rt-body">
      <div class="commit-card">
        <div class="commit-card-h">本周我将推进 ${picks.length} 块大石头：</div>
        <ul class="commit-card-list">${picks.map(p => `<li>🪨 ${esc(p.text)}</li>`).join('')}</ul>
        <textarea class="gf-input commit-intent" id="ccIntent" rows="2" placeholder="一句话意图（可选）：如「这周守住核心，不被救火牵着走」"></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="gf-btn gf-btn--primary" id="ccCommit">✍️ 我承诺</button>
      <button type="button" class="gf-btn gf-btn--ghost" id="ccBack">返回改选</button>
    </div></div>`;
  overlay.classList.add('show');
  overlay.querySelector('#ccClose').onclick = closeRitualModal;
  overlay.querySelector('#ccBack').onclick = openWeekPlan;
  overlay.querySelector('#ccCommit').onclick = () => {
    ensureScoreMeta();
    const intent = (overlay.querySelector('#ccIntent').value || '').trim();
    state.meta.weekPlans[wk] = { rocks: picks, intent, committedAt: Date.now(), savedAt: Date.now() };
    if (!state.meta.alarmFired) state.meta.alarmFired = {};
    state.meta.alarmFired['weekplan|' + wk] = true;
    saveMeta(); closeRitualModal(); afterChange();
  };
  overlay.onclick = e => { if (e.target === overlay) closeRitualModal(); };
}
function renderTodayRocks() {
  const box = document.getElementById('todayRocks'); if (!box) return;
  ensureScoreMeta();
  const wk = weekKey();
  const plan = (state.meta.weekPlans || {})[wk];
  if (!plan || !(plan.rocks || []).length) {
    box.innerHTML = `<div class="today-rocks empty"><span class="hint">本周大石头未排。</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnWeekPlan2">🗓 排大石头</button></div>`;
    const b = box.querySelector('#btnWeekPlan2');
    if (b) b.onclick = () => openWeekPlan();
    return;
  }
  const chips = plan.rocks.map(r => {
    const n = nodeInWorkflow(r.wfId, r.nodeId);
    const done = n ? !!n.done : false;
    const txt = n ? n.text : r.text;
    return `<button type="button" class="rock-chip${done ? ' done' : ''}" data-rock-done="${r.nodeId}" data-wf="${r.wfId}" title="${done ? '已完成 · 点击撤销' : '点击勾掉这块大石头'}">${done ? '✅' : '🪨'} ${esc(txt.length > 16 ? txt.slice(0, 16) + '…' : txt)}</button>`;
  }).join('');
  const doneCount = plan.rocks.filter(r => { const n = nodeInWorkflow(r.wfId, r.nodeId); return n && n.done; }).length;
  box.innerHTML = `<div class="today-rocks"><span class="rocks-lbl">本周大石头 ${doneCount}/${plan.rocks.length}</span>${chips}</div>`;
  box.querySelectorAll('[data-rock-done]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.rockDone);
    if (n) { setNodeDoneInWorkflow(b.dataset.wf, b.dataset.rockDone, !n.done); afterChange(); }
  });
}

/* ============ v8.12 仪式历史（晨计划 / 晚回顾 / 周计划 / 周期回顾记录） ============ */
/* 聚合层是纯函数（meta 入参、不读 state），unit-history 直接 require 可测；
   openHistory 只做渲染 + 活状态标注（大石头履约实时查 nodeInWorkflow，节点被删标「已移除」）。 */
function dkWeekLabel(dk) {
  const p = String(dk || '').split('-').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return dk || '';
  const d = new Date(p[0], p[1] - 1, p[2]);
  return p[1] + '月' + p[2] + '日 周' + '日一二三四五六'[d.getDay()];
}
function historyMorningDays(meta) {
  const mp = (meta && meta.morningPlans) || {};
  return Object.keys(mp).sort().reverse().map(dk => Object.assign({ dk }, mp[dk]));
}
function historyEveningDays(meta) {
  if (!meta) return [];
  const keys = new Set();
  [meta.scoreLog, meta.dayNotes, meta.goodThings].forEach(m => Object.keys(m || {}).forEach(k => keys.add(k)));
  Object.keys(meta.eveningDispo || {}).forEach(k => keys.add(String(k).split('|')[0]));
  return [...keys].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse().map(dk => {
    const sc = summarizeScoreEntries(((meta.scoreLog || {})[dk] || { entries: [] }).entries);
    const goods = ((meta.goodThings || {})[dk] || []).filter(Boolean);
    const note = (meta.dayNotes || {})[dk] || '';
    const dispo = { continue: 0, defer: 0, drop: 0 };
    Object.keys(meta.eveningDispo || {}).forEach(k => {
      if (String(k).split('|')[0] !== dk) return;
      const a = meta.eveningDispo[k];
      if (dispo[a] !== undefined) dispo[a]++;
    });
    return { dk, total: sc.total, grade: sc.grade, count: sc.count, pomos: sc.pomos, focusMin: sc.focusMin, goods, note, dispo };
  });
}
function historyWeekPlans(meta) {
  const wp = (meta && meta.weekPlans) || {};
  return Object.keys(wp).sort().reverse().map(wk => ({
    wk, rocks: (wp[wk] && wp[wk].rocks) || [], intent: (wp[wk] && wp[wk].intent) || '',
    committedAt: (wp[wk] && (wp[wk].committedAt || wp[wk].savedAt)) || 0
  }));
}
function historyReviews(meta) {
  if (!meta) return [];
  const out = [];
  Object.keys(REVIEW_STORE).forEach(cycle => {
    (meta[REVIEW_STORE[cycle]] || []).forEach(r => out.push(Object.assign({ cycle }, r)));
  });
  return out.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}
const HISTORY_TABS = [
  { k: 'morning', icon: '🌅', label: '晨计划', sub: '每天打开晨计划时自动留痕' },
  { k: 'evening', icon: '🌙', label: '晚回顾', sub: '评分 · 未完成处置 · 三件好事 · 一句话总结' },
  { k: 'week', icon: '🗓', label: '周计划', sub: '每周大石头与承诺卡 · 履约对照' },
  { k: 'review', icon: '📋', label: '周期回顾', sub: '保存过的周 / 月 / 季回顾' },
];
const REVIEW_FIELD_LABELS = { highlight: '高光时刻', lesson: '最大教训', theme: '下月主题词', okr: 'OKR/KR 得分', align: '对齐年度目标', bet: '下季战略赌注', gold: '金线推进', core: '核心投入几成', block: '下周深潜块', exec: '执行/偏差反馈', wins: '本周小赢', next: '下周期调整行动', commit: '一句承诺' };
function openHistory(tab) {
  tab = HISTORY_TABS.some(t => t.k === tab) ? tab : 'morning';
  const overlay = document.getElementById('historyModal'); if (!overlay) return;
  ensureScoreMeta();
  const meta = state.meta;
  const todayDk = dateKey();
  let body = '';
  if (tab === 'morning') {
    const days = historyMorningDays(meta);
    body = days.length ? days.map(r => {
      const at = r.at ? new Date(r.at) : null;
      return `<div class="his-day">
        <div class="his-date">${dkWeekLabel(r.dk)}${r.dk === todayDk ? '<span class="his-live">今天</span>' : ''}<span class="his-time">${at ? '记录于 ' + pad2(at.getHours()) + ':' + pad2(at.getMinutes()) : ''}</span></div>
        ${r.mit ? `<div class="his-mit">🐸 MIT：${esc(r.mit.text)}${r.mit.pre ? '<span class="his-pre">🌙昨晚预选</span>' : ''}</div>` : '<div class="his-mit dim">（未记录到 MIT）</div>'}
        <div class="his-meta">清单 ${r.poolN || 0} 项 · 预估 ${r.est || 0}′ / 容量 ${r.cap || 0}′${(r.est || 0) > (r.cap || 0) ? '（超负荷）' : ''}${r.pendN ? ` · 回顾行动待确认 ${r.pendN} 条` : ''}</div>
      </div>`;
    }).join('') : '<div class="hint">还没有晨计划记录——每天第一次打开晨计划（⏰ 到点自动弹，或侧栏 🌅 晨计划手动打开）会自动留痕。</div>';
  } else if (tab === 'evening') {
    const days = historyEveningDays(meta);
    body = days.length ? days.map(r => {
      const dN = r.dispo.continue + r.dispo.defer + r.dispo.drop;
      return `<div class="his-day">
        <div class="his-date">${dkWeekLabel(r.dk)}${r.dk === todayDk ? '<span class="his-live">今天 · 进行中</span>' : ''}</div>
        <div class="his-meta"><b class="his-score">${r.total}</b> 分 <i class="ts-grade">${r.grade}</i> · 完成 ${r.count} 项 · 🍅 ${r.pomos} 个 · 专注 ${r.focusMin}′</div>
        ${dN ? `<div class="his-meta">未完成处置 → 明天继续 ${r.dispo.continue} · 改期 ${r.dispo.defer} · 放弃 ${r.dispo.drop}</div>` : ''}
        ${r.goods.length ? `<div class="his-goods">${r.goods.map(g => `<div>✨ ${esc(g)}</div>`).join('')}</div>` : ''}
        ${r.note ? `<div class="his-quote">「${esc(r.note)}」</div>` : ''}
      </div>`;
    }).join('') : '<div class="hint">还没有晚回顾记录——完成叶子 / 番茄钟会自动评分，晚总结（🌙）保存三件好事与一句话总结后都会出现在这里。</div>';
  } else if (tab === 'week') {
    const plans = historyWeekPlans(meta);
    const curWk = weekKey();
    body = plans.length ? plans.map(p => {
      const doneN = p.rocks.filter(r => { const n = nodeInWorkflow(r.wfId, r.nodeId); return n && n.done; }).length;
      const full = p.rocks.length > 0 && doneN === p.rocks.length;
      return `<div class="his-day">
        <div class="his-date">${dkWeekLabel(p.wk)} 起${p.wk === curWk ? '<span class="his-live">本周 · 进行中</span>' : ''}<span class="his-time">${p.committedAt ? '承诺于 ' + new Date(p.committedAt).toLocaleDateString() : ''}</span></div>
        <div class="his-meta">🪨 履约 <b>${doneN}/${p.rocks.length}</b>${full ? ' · 全部兑现 🎉' : ''}</div>
        ${p.intent ? `<div class="his-quote">「${esc(p.intent)}」</div>` : ''}
        <ul class="his-rocks">${p.rocks.map(r => {
          const n = nodeInWorkflow(r.wfId, r.nodeId);
          const st = n ? (n.done ? '✅' : '○') : '🗑';
          return `<li>${st} ${esc((n && n.text) || r.text)}${!n ? '<span class="his-dim">（已从树移除）</span>' : ''}</li>`;
        }).join('')}</ul>
      </div>`;
    }).join('') : '<div class="hint">还没有周计划记录——周一早上到点自动弹，或侧栏「🗓 周计划」随时排下本周大石头。</div>';
  } else {
    const rows = historyReviews(meta);
    body = rows.length ? rows.map(r => {
      const snap = r.statsSnapshot || {};
      const answers = Object.keys(REVIEW_FIELD_LABELS)
        .filter(k => typeof r[k] === 'string' && r[k].trim())
        .map(k => `<div class="his-qa"><b>${REVIEW_FIELD_LABELS[k]}</b>：${esc(r[k]).replace(/\n/g, '<br>')}</div>`).join('');
      return `<div class="his-day">
        <div class="his-date">${reviewCycleLabel(r.cycle)} · ${esc(r.period || r.week || '')}<span class="his-time">${r.savedAt ? new Date(r.savedAt).toLocaleDateString() + ' 保存' : ''}</span></div>
        ${snap.total !== undefined ? `<div class="his-meta">完成 ${snap.total} 项 · 核心象限占比 ${snap.corePct}%</div>` : ''}
        ${answers ? `<details class="his-det"><summary>🕯 仪式问答</summary>${answers}</details>` : ''}
      </div>`;
    }).join('') : '<div class="hint">还没有保存过周期回顾——侧栏「◔ 周回顾」可切换周 / 月 / 季，保存后在这里留档。</div>';
  }
  const sub = (HISTORY_TABS.find(t => t.k === tab) || {}).sub || '';
  overlay.innerHTML = `<div class="modal modal-wide" role="dialog">
    <div class="modal-head"><div class="mh-ic">📜</div>
      <div><div class="mh-tt">仪式历史</div><div class="mh-sub">${sub} · 仅存本机</div></div>
      <span class="mh-x" id="hisClose">×</span></div>
    <div class="wr-cycle">${HISTORY_TABS.map(t => `<button type="button" class="wr-ctab${t.k === tab ? ' on' : ''}" data-htab="${t.k}">${t.icon} ${t.label}</button>`).join('')}</div>
    <div class="rt-body his-body">${body}</div>
  </div>`;
  overlay.classList.add('show');
  overlay.querySelector('#hisClose').onclick = closeHistory;
  overlay.querySelectorAll('[data-htab]').forEach(b => b.onclick = () => openHistory(b.dataset.htab));
  overlay.onclick = e => { if (e.target === overlay) closeHistory(); };
}
function closeHistory() {
  const overlay = document.getElementById('historyModal');
  if (overlay) { overlay.classList.remove('show'); overlay.innerHTML = ''; }
}

/* ============ 今日总评分（自动评分汇总） ============ */
function renderTodayScore() {
  const box = document.getElementById('todayScore'); if (!box) return;
  const ts = todayScore();
  if (!ts.entries.length) {
    box.innerHTML = '<div class="today-score ts-empty"><span class="hint">完成叶子任务或结束一个番茄钟后，这里会自动给出每项评分与今日总评分（日目标 100 分）。</span></div>';
    return;
  }
  const pct = clamp(Math.round(ts.total), 0, 100);
  const last = ts.entries[ts.entries.length - 1];
  box.innerHTML =`<div class="today-score">
    <div class="ts-main"><span class="ts-label">今日总评分</span><b class="ts-num">${ts.total}</b><i class="ts-grade">${ts.grade}</i></div>
    <div class="ts-bar"><i style="width:${pct}%"></i></div>
    <div class="ts-pills">
      <span>完成 ${ts.count} 项</span><span>🍅 ${ts.pomos} 个 · 专注 ${ts.focusMin}′</span>
      <span class="ts-last" title="${esc(last.reason)}">最近：${esc(last.text.length > 14 ? last.text.slice(0, 14) + '…' : last.text)} <b>+${last.score}</b></span>
      <span class="ts-target">目标 100 分 · ${ts.total >= 100 ? '已达成 🎉' : '还差 ' + (100 - ts.total)}</span>
    </div>
  </div>`;
}

/* ============ 交互 ============ */
function renderSidebar() {
  const el = document.getElementById('sideTree');
  if (!el) return;
  const sp = document.getElementById('sideProg');
  const t = state.nodes && state.nodes[0];
  if (!t) {
    el.innerHTML = '<div class="si dim">解析后在此显示目标树</div>';
    if (sp) sp.textContent = '';
    return;
  }
  getCachedTree(state.nodes);
  const kids = t._children || [];
  const shown = kids.slice(0, 8);
  el.innerHTML = '<div class="si dim root">▾ ' + esc(t.text) + '</div>' +
    shown.map(c => '<div class="si dim child">· ' + esc(c.text) + '</div>').join('') +
    (kids.length > 8 ? `<div class="si dim child">… 其余 ${kids.length - 8} 支</div>` : '');
  const lp = leafProgress();
  if (sp) sp.textContent = lp ? lp.pct + '%' : '';
}
/* ============ 渲染调度 ============ */
/* 三视图共用一套 afterChange，但隐藏视图的重活（树编辑器 / 四象限 / 画布）占大头，
   所以按视图分组：只渲染当前可见组，其余标脏，switchView 切过去时补渲染。 */
// v8.8: 改为「函数数组 + 逐个 try」—— 原写法一个面板抛错会中断整组渲染
// （如删除/新建项目后某面板在空数据态抛错 → 四象限等后续面板全部不更新，表现为「没同步更新」）
const VIEW_GROUP = {
  today: () => [syncTop, renderFocus, renderMetricsStrip, renderPlanShareStrip, renderTodayPanel, renderReviewBanner, updateTodayZones],
  plan: () => [renderSmart, renderTreeEditor],
  insights: () => [renderRhythm, renderQuadrant, renderCanvas, renderCompletionHistory],
  ai: () => [renderAIView, renderSmart],
};
const _viewStale = { today: true, plan: true, insights: true, ai: true };
function renderViewGroup(name) {
  const get = VIEW_GROUP[name]; if (!get) return;
  _viewStale[name] = false;
  get().forEach(fn => { try { fn(); } catch (e) { console.error('[renderViewGroup]', name, fn && fn.name, e); } });
}
/* topId 必须在任何视图下都是最新的：英雄卡、桑基金线、侧栏 ★ 都读它 */
function syncTop() {
  // v7.9: 跨项目全局候选，保证今日行动里 MIT 唯一且全项目一致（v8.13 英雄卡移除后，syncTop 是 topId 唯一裁定者）
  const cands = heroGlobalCandidates();
  const noHabit = cands.filter(c => !(c.node.recur || c.node.role === 'habit'));
  let topC = null;
  if (state.topPin) topC = cands.find(c => c.node.id === state.topPin) || null;
  if (!topC) topC = noHabit[0] || cands[0] || null;
  state.topId = topC ? topC.node.id : null;
  state.topWfId = topC ? topC.wfId : null;
}
function afterChange() {
  // v8.8: 全链容错 —— 任一环节抛错不中断后续（否则删除/新建项目后 UI 停在旧状态，表现为「没反应/没同步」）
  const safe = (label, fn) => { try { fn(); } catch (e) { console.error('[afterChange]', label, e); } };
  safe('invalidateTreeCache', invalidateTreeCache);
  safe('ensureWorkflows', ensureWorkflows);
  safe('ensureAllEstimates', ensureAllEstimates);
  safe('syncTop', syncTop);
  safe('renderWorkflowBar', renderWorkflowBar);
  safe('renderProgress', renderProgress);
  safe('renderSidebar', renderSidebar);
  safe('renderPomoBar', renderPomoBar);
  safe('renderAppTitle', renderAppTitle);
  _viewStale.today = _viewStale.plan = _viewStale.insights = _viewStale.ai = true;
  safe('renderViewGroup', () => renderViewGroup(currentView()));
  safe('tickReminders', tickReminders);
}
function doParse() {
  const raw = document.getElementById('input').value.trim();
  if (!raw) { alert('请先输入目标文本'); return; }
  ensureWorkflows();
  // v8.9: 整树替换会让旧节点 id 全部作废 → 先清掉指向旧树的引用（大石头/明晚预选/习惯打卡/置顶/番茄钟），
  // 否则出现「删了还在、点了没反应」的孤儿。注意：解析无撤销路径，故不做备份。
  purgeCurrentTreeRefs();
  state.nodes = parseText(raw);
  flushActiveWorkflow();
  save(); saveMeta(); afterChange();
  warnIfOverCapacity('新解析的目标流');
  // v7.0: 解析后直接跳转到目标规划页面
  switchView('plan');
}

/* ============ v6.9 目标补充向导 ============ */
function initDemoSelect() {
  const sel = document.getElementById('demoSelect');
  const lib = typeof GoalFlowDemos !== 'undefined' ? GoalFlowDemos.list : null;
  if (!sel || !lib || !lib.length) return;
  sel.innerHTML = lib.map(d => `<option value="${d.id}">${d.title}</option>`).join('');
}
function loadDemo() {
  const sel = document.getElementById('demoSelect');
  const id = sel && sel.value ? sel.value : 'sales';
  const pack = typeof GoalFlowDemos !== 'undefined' ? GoalFlowDemos.get(id) : null;
  const demo = pack ? pack.text : '';
  if (!demo) { alert('示例库未加载'); return; }
  document.getElementById('input').value = demo;
  doParse();
}
async function clearAll() {
  // v8.9：原生 confirm 改页内确认弹窗（同 v8.8 deleteWorkflow——部分 WebView 静默吞 confirm，点了没反应）
  const okClear = await confirmModal({
    icon: '🗑', title: '清空全部', danger: true, okText: '清空',
    text: '确定清空全部目标流与本地保存？',
    sub: '所有项目、今日计划、大石头与习惯打卡记录都会清除。',
  });
  if (!okClear) return;
  // v6.3 撤销：清空前快照工作流；v8.9: meta 一并快照（引用类数据随清空删除，undo 需一并还原）
  const snap = JSON.parse(JSON.stringify({ workflows: state.workflows, activeWorkflowId: state.activeWorkflowId, nodes: state.nodes, topId: state.topId, topPin: state.topPin, meta: state.meta }));
  // v8.9：清掉指向旧工作流的散落引用（此前只删流本体，大石头/打卡/预选全成孤儿）
  (state.workflows || []).forEach(w => purgeWorkflowRefs(w.id));
  state.nodes = []; state.topId = null; state.topPin = null;
  const wf = { id: newWorkflowId(), name: '默认目标', nodes: [], topId: null, tags: [], startDate: '', endDate: '', description: '' };
  normalizeWorkflowMeta(wf);
  state.workflows = [wf];
  state.activeWorkflowId = state.workflows[0].id;
  const ta = document.getElementById('input'); if (ta) ta.value = '';
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_WORKFLOWS); } catch (e) { }
  save(); saveMeta(); afterChange();
  showUndoToast('已清空全部目标流', () => {
    state.workflows = snap.workflows;
    state.activeWorkflowId = snap.activeWorkflowId;
    state.nodes = snap.nodes; state.topId = snap.topId; state.topPin = snap.topPin;
    state.meta = snap.meta;
    recomputeSchedule(state.nodes); save(); saveMeta(); afterChange();
  });
}
function wfExpanded(id) {
  if (!state.meta) return false;
  if (!state.meta.wfExpanded) state.meta.wfExpanded = {};
  return !!state.meta.wfExpanded[id];
}
function toggleWfExpanded(id) {
  if (!state.meta) state.meta = {};
  if (!state.meta.wfExpanded) state.meta.wfExpanded = {};
  state.meta.wfExpanded[id] = !state.meta.wfExpanded[id];
  saveMeta();
  renderWorkflowBar();
}
function wfLeafCounts(nodes, node) {
  let t = 0, d = 0;
  (function wk(x) {
    if (x.parentId && (!x._children || !x._children.length)) { t++; if (x.done) d++; }
    (x._children || []).forEach(wk);
  })(node);
  return { t, d };
}
function wfTreePreviewHtml(w) {
  const nodes = w.nodes || [];
  if (!nodes.length) return '<div class="wf-empty">空项目 · 去「输入目标」解析</div>';
  computeTree(nodes);
  const root = nodes.find(n => !n.parentId) || nodes[0];
  const kids = (root._children || []);
  const shown = kids.slice(0, 5);
  let h = `<div class="wf-root" title="${esc(root.text)}">▾ ${esc(root.text.length > 18 ? root.text.slice(0, 18) + '…' : root.text)}</div>`;
  shown.forEach(c => {
    const k = wfLeafCounts(nodes, c);
    h += `<div class="wf-kid">· ${esc(c.text.length > 15 ? c.text.slice(0, 15) + '…' : c.text)}${k.t ? `<span class="wf-kprog">${k.d}/${k.t}</span>` : ''}</div>`;
  });
  if (kids.length > 5) h += `<div class="wf-kid dim">… 其余 ${kids.length - 5} 支</div>`;
  return h;
}
function projectRelations() {
  const byTag = {};
  state.workflows.forEach(w => {
    (w.tags || []).forEach(t => { (byTag[t] = byTag[t] || []).push(w.name || '未命名'); });
  });
  const rels = Object.keys(byTag).filter(t => byTag[t].length > 1).map(t => ({ tag: t, names: byTag[t] }));
  // 时间段重叠也算一种关系
  const ranges = state.workflows.filter(w => w.startDate && w.endDate);
  const overlaps = [];
  for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
    const a = ranges[i], b = ranges[j];
    if (a.startDate <= b.endDate && b.startDate <= a.endDate) overlaps.push([a.name, b.name]);
  }
  return { rels, overlaps };
}
function renderWorkflowBar() {
  const bar = document.getElementById('wfBar');
  if (!bar) return;
  ensureWorkflows();
  flushActiveWorkflow();
  let html = `<div class="wf-head"><span>项目 · 可多展开</span><button type="button" class="gf-btn gf-btn--sm wf-add" id="wfAdd" title="新建项目">＋</button></div>`;
  const liveWfs = state.workflows.filter(w => !w.archived);
  const archivedWfs = state.workflows.filter(w => w.archived);
  liveWfs.forEach(w => {
    const open = wfExpanded(w.id);
    const active = w.id === state.activeWorkflowId;
    const nodes = w.nodes || [];
    let pct = '';
    let complete = false;
    if (nodes.length) {
      computeTree(nodes);
      const root = nodes.find(n => !n.parentId) || nodes[0];
      const k = wfLeafCounts(nodes, root);
      if (k.t) { pct = Math.round(k.d / k.t * 100) + '%'; complete = k.d === k.t; }
    }
    html += `<div class="wf-item${active ? ' active' : ''}${open ? ' open' : ''}">
      <div class="wf-row">
        <button type="button" class="wf-toggle" data-wft="${w.id}" title="${open ? '收起' : '展开'}（不影响当前编辑）">${open ? '▾' : '▸'}</button>
        <span class="wf-dot" style="background:${w.color || 'var(--accent)'}"></span>
        <button type="button" class="wf-name" data-wfs="${w.id}" title="设为当前编辑项目">${esc(w.name || '未命名')}
          <span class="wf-cnt">${nodes.length ? `${nodes.length}节点` : ''}${pct ? ` · ${pct}` : ''}</span></button>
        ${complete ? `<button type="button" class="wf-edit wf-arch" data-wfa="${w.id}" title="叶子全部完成 🎉 归档此项目（移出今日汇总）">🏆</button>` : ''}
        <button type="button" class="wf-edit" data-wfe="${w.id}" title="项目设置：名称 / 标签 / 时间段">✎</button>
      </div>`;
    if (open) {
      const tagChips = (w.tags || []).map(t => `<span class="wf-tagchip">${esc(t)}</span>`).join('');
      const range = (w.startDate || w.endDate) ? `<span class="wf-range">📅 ${esc(w.startDate || '…')} → ${esc(w.endDate || '…')}</span>` : '';
      let progBar = '';
      if (nodes.length) {
        computeTree(nodes);
        const root0 = nodes.find(n => !n.parentId) || nodes[0];
        const k = wfLeafCounts(nodes, root0);
        if (k.t) {
          const p = Math.round(k.d / k.t * 100);
          progBar = `<div class="wf-prog" title="叶子完成 ${k.d}/${k.t}"><i style="width:${p}%"></i><span>${p}%</span></div>`;
        }
      }
      let todayN = 0;
      try { todayN = todayExecutionPoolFor(nodes).length; } catch (e) { }
      const activeHint = active ? '✓ 当前项目 · 点名称看总览/重新规划' : '点名称 = 设为当前 + 项目总览';
      html +=`<div class="wf-body">
        ${(tagChips || range) ? `<div class="wf-meta">${tagChips}${range}</div>` : ''}
        ${progBar}
        ${wfTreePreviewHtml(w)}
        <div class="wf-foot">
          <span class="wf-today-n" title="今日行动池中属于该项目的待办">☀ 今日待办 ${todayN}</span>
          <span class="wf-hint">${activeHint}</span>
        </div>
      </div>`;
    }
    html += `</div>`;
  });
  const { rels, overlaps } = projectRelations();
  if (rels.length || overlaps.length) {
    html += `<div class="wf-rel"><div class="wf-rel-h">项目关系</div>`;
    rels.forEach(r => {
      html += `<div class="wf-rel-row" title="共享标签">🏷 <b>${esc(r.tag)}</b>：${r.names.map(n => esc(n)).join(' × ')}</div>`;
    });
    overlaps.forEach(([a, b]) => {
      html += `<div class="wf-rel-row" title="时间段重叠">⏳ ${esc(a)} × ${esc(b)} 同期推进</div>`;
    });
    html += `</div>`;
  }
  // v6.5 归档区：完成的项目只读陈列，可恢复
  if (archivedWfs.length) {
    html += `<div class="wf-rel wf-archived"><div class="wf-rel-h">🏆 归档 · ${archivedWfs.length} 个已完成项目</div>`;
    archivedWfs.forEach(w => {
      const k = wfLeafCountsAll(w.nodes);
      const when = w.archivedAt ? new Date(w.archivedAt) : null;
      html += `<div class="wf-rel-row wf-arch-row">
        <span class="wf-arch-name" title="${when ? '归档于 ' + when.toLocaleDateString() : ''}">🏆 ${esc(w.name || '未命名')} <span class="wf-cnt">${k.d}/${k.t} 叶子</span></span>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost wf-unarch" data-wfu="${w.id}" title="恢复到项目列表">↩ 恢复</button>
      </div>`;
    });
    html += `</div>`;
  }
  bar.innerHTML = html;
  bar.querySelectorAll('[data-wft]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleWfExpanded(b.dataset.wft); });
  bar.querySelectorAll('[data-wfs]').forEach(b => b.onclick = e => { e.preventDefault(); switchWorkflow(b.dataset.wfs); openProjectOverview(b.dataset.wfs); });
  bar.querySelectorAll('[data-wfe]').forEach(b => b.onclick = e => { e.stopPropagation(); openWorkflowMetaModal('edit', b.dataset.wfe); });
  bar.querySelectorAll('[data-wfa]').forEach(b => b.onclick = e => { e.stopPropagation(); archiveWorkflow(b.dataset.wfa); });
  bar.querySelectorAll('[data-wfu]').forEach(b => b.onclick = e => { e.stopPropagation(); unarchiveWorkflow(b.dataset.wfu); });
  const add = document.getElementById('wfAdd');
  if (add) add.onclick = () => openWorkflowMetaModal('create');
  const ws = document.querySelector('.ws-tx p');
  if (ws) {
    const w = workflowById(state.activeWorkflowId);
    const t = (w && w.tags && w.tags.length) ? ` · ${w.tags.join(' / ')}` : '';
    ws.textContent = w ? `项目：${w.name}${t} · 今日行动跨项目` : '本地工作区 · 数据不出机';
  }
  const store = document.getElementById('wsStore');
  if (store) {
    const total = state.workflows.reduce((a, w) => a + ((w.nodes || []).length), 0);
    const saved = state.meta && state.meta.lastSavedAt;
    const time = saved ? new Date(saved) : null;
    const hhmm = time ? pad2(time.getHours()) + ':' + pad2(time.getMinutes()) : '—';
    store.textContent = `💾 ${state.workflows.length} 项目 / ${total} 节点 · 已存 ${hhmm}`;
    store.title = '数据保存在本浏览器 localStorage（换浏览器/端口需用「备份」迁移）';
  }
}
function exportPNG() {
  const svg = document.getElementById('diagram-svg');
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const cv = document.createElement('canvas');
    cv.width = svg.viewBox.baseVal.width * scale;
    cv.height = svg.viewBox.baseVal.height * scale;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, cv.height);
    g.addColorStop(0, '#0f1420'); g.addColorStop(1, '#0a0d14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
    cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '目标流.png'; a.click(); });
  };
  img.src = url;
}

/* ============ 初始化（仅浏览器） ============ */
if (typeof document !== 'undefined') {
  (function init() {
    const d = TODAY;
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    document.getElementById('todayLine').textContent =
      `今天 ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${wd}`;
    bindAppShell();
    renderAppTitle();
    initDemoSelect();
    // 主题切换（gf-tokens.js 提供 GoalFlowTheme.THEMES / setTheme；含旧缓存兜底）
    const thSel = document.getElementById('themeSelect');
    if (thSel) {
      thSel.value = GF.theme || 'linear';
      thSel.onchange = () => {
        if (GF.setTheme) { GF.setTheme(thSel.value); afterThemeApply(); return; }
        try { localStorage.setItem('goalflow.theme', thSel.value); } catch (e) { }
        location.reload();
      };
    }
    // 明暗模式切换（含旧缓存兜底：无 GF.toggleMode 时也能生效）
    const mt = document.getElementById('modeToggle');
    if (mt) {
      const curMode = (GF.mode || document.documentElement.dataset.mode || 'dark');
      mt.textContent = (curMode === 'light') ? '☀' : '☾';
      mt.onclick = () => {
        if (GF.toggleMode) { GF.toggleMode(); afterThemeApply(); return; }
        const next = (curMode === 'light') ? 'dark' : 'light';
        try { localStorage.setItem('goalflow.mode', next); } catch (e) { }
        location.reload();
      };
    }
    // v6.6 移动端主题循环按钮（替代下拉选择）
    const tc = document.getElementById('btnThemeCycle');
    if (tc) {
      const themeOrder = ['linear', 'raycast', 'rpg'];
      const themeLabels = { linear: 'Linear', raycast: 'Raycast', rpg: 'RPG' };
      tc.onclick = () => {
        const cur = document.documentElement.dataset.theme || GF.theme || 'linear';
        const idx = themeOrder.indexOf(cur);
        const next = themeOrder[(idx + 1) % themeOrder.length];
        if (GF.setTheme) { GF.setTheme(next); afterThemeApply(); return; }
        try { localStorage.setItem('goalflow.theme', next); } catch (e) { }
        location.reload();
      };
    }
    // 主题/模式即时落地后的本地刷新：reload 成功时会被覆盖，被 WebView 拦截时保证 UI 与色板正确
    function afterThemeApply() {
      VE.quick.color = PALETTE_UR[2];
      VE.major.color = PALETTE_UR[0];
      VE.trap.color = PALETTE_UR[3];
      const dm = document.documentElement.dataset.mode;
      const dt = document.documentElement.dataset.theme;
      if (mt) mt.textContent = (dm === 'light') ? '☀' : '☾';
      if (thSel) thSel.value = dt || 'linear';
      if (tc) tc.title = '切换界面主题（当前：' + ({ linear: 'Linear', raycast: 'Raycast', rpg: 'RPG' }[dt] || 'Linear') + '）';
      syncTop();
    }
    // v6.6 画布"适应宽度"切换（移动端把 SVG 缩放到容器宽度，再点恢复原始像素）
    const btnFit = document.getElementById('btnFitWidth');
    const canvasWrap = document.getElementById('canvasWrap');
    if (btnFit && canvasWrap) {
      btnFit.onclick = () => {
        canvasWrap.classList.toggle('fit');
        btnFit.classList.toggle('on', canvasWrap.classList.contains('fit'));
        btnFit.textContent = canvasWrap.classList.contains('fit') ? '↔ 原始尺寸' : '↔ 适应宽度';
      };
    }
    // 侧栏的周回顾入口（rail / mtab 重复入口已收敛）
    ['sideWeekReview'].forEach(id => {
      const b = document.getElementById(id); if (b) b.onclick = openWeekReview;
    });
    // v6.4 移动端快速捕捉入口
    const mtabCap = document.getElementById('mtabCapture'); if (mtabCap) mtabCap.onclick = quickCapture;
    // 全局搜索入口（顶栏按钮 + Ctrl+K / 斜杠快捷键）
    const bSearch = document.getElementById('btnSearch'); if (bSearch) bSearch.onclick = openGlobalSearch;
    // 移动端项目入口：顶栏「🗂 项目」→ 项目切换器
    const btnProj = document.getElementById('btnProjects'); if (btnProj) btnProj.onclick = openProjectSwitcher;
    // 移动端「⋯ 更多」菜单：展开时把下拉框夹在视口内（避免负偏移跑出页面），点击外部/动作后收起
    const tbMore = document.getElementById('tbMoreMenu');
    if (tbMore) {
      const drop = tbMore.querySelector('.tb-drop');
      const placeDrop = () => {
        if (!tbMore.open) { drop.style.left = drop.style.top = drop.style.right = ''; return; }
        const tr = tbMore.getBoundingClientRect();
        const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        const w = drop.offsetWidth, h = drop.offsetHeight;
        const left = Math.min(Math.max(8, tr.right - w), Math.max(8, vw - w - 8));
        let top = tr.bottom + 6;
        if (top + h > vh - 8) top = Math.max(8, tr.top - h - 6);
        drop.style.right = 'auto';
        drop.style.left = (left - tr.left) + 'px';
        drop.style.top = (top - tr.top) + 'px';
      };
      tbMore.addEventListener('toggle', placeDrop);
      window.addEventListener('resize', () => { if (tbMore.open) placeDrop(); });
      document.addEventListener('click', (e) => {
        if (tbMore.open && !tbMore.contains(e.target)) tbMore.open = false;
      });
      if (drop) drop.addEventListener('click', (e) => {
        if (e.target.closest('button')) tbMore.open = false;
      });
    }
    document.getElementById('btnParse').onclick = doParse;
    document.getElementById('btnDemo').onclick = loadDemo;
    document.getElementById('btnClear').onclick = clearAll;
    document.getElementById('btnExport').onclick = exportPNG;
    document.getElementById('showNoise').onchange = renderCanvas;
    // 移动端时间尺度下拉（与 zoombar 按钮双向同步）
    const zoombarSelect = document.getElementById('zoombarSelect');
    if (zoombarSelect) {
      zoombarSelect.onchange = () => {
        state.scale = zoombarSelect.value || 'all';
        document.querySelectorAll('#zoombar button[data-scale]').forEach(x => x.classList.toggle('on', x.dataset.scale === state.scale));
        afterChange();
      };
    }
    // v7.6: 移动端视角切换下拉菜单
    const viewbarSelect = document.getElementById('viewbarSelect');
    if (viewbarSelect) {
      viewbarSelect.onchange = () => {
        state.viewMode = viewbarSelect.value || 'sankey';
        const sub = document.getElementById('canvasSub');
        const subs = {
          sankey: '条带宽度 = 重要性 · 颜色 = 紧急性 · 金色 = Top1',
          network: '节点 = 目标 · 连线 = 父子 · 半径 ≈ 重要度',
          kanban: '看板 = 四象限列 · 卡片可点选高亮',
          heatmap: '365 天叶子完成热力（越深越多）',
          calendar: '日历 · 每格 = 一天：底色 = 加权热力（完成40/时长30/打卡15/能量15），✓⏱🔥 = 当日实况，● = 到期项 · 点格子看详情、「定位」到规划树或钉为 Top1',
          mindmap: '脑图 = 目标树层次 · 百分比 = 子树/指标进度',
        };
        if (sub) sub.textContent = subs[state.viewMode] || subs.sankey;
        renderCanvas();
      };
    }
    document.querySelectorAll('#viewbar button').forEach(b => {
      b.onclick = () => {
        state.viewMode = b.dataset.view || 'sankey';
        document.querySelectorAll('#viewbar button').forEach(x => x.classList.toggle('on', x === b));
        // v7.6: 同步移动端 select
        if (viewbarSelect) viewbarSelect.value = state.viewMode;
        const sub = document.getElementById('canvasSub');
        const subs = {
          sankey: '条带宽度 = 重要性 · 颜色 = 紧急性 · 金色 = Top1',
          network: '节点 = 目标 · 连线 = 父子 · 半径 ≈ 重要度',
          kanban: '看板 = 四象限列 · 卡片可点选高亮',
          heatmap: '365 天叶子完成热力（越深越多）',
          calendar: '日历 · 每格 = 一天：底色 = 加权热力（完成40/时长30/打卡15/能量15），✓⏱🔥 = 当日实况，● = 到期项 · 点格子看详情、「定位」到规划树或钉为 Top1',
          mindmap: '脑图 = 目标树层次 · 百分比 = 子树/指标进度',
        };
        if (sub) sub.textContent = subs[state.viewMode] || subs.sankey;
        renderCanvas();
      };
    });
    const qw = document.getElementById('btnQuickWin');
    if (qw) qw.onclick = () => { state.quadQuickWin = !state.quadQuickWin; afterChange(); };
    document.querySelectorAll('#zoombar button[data-scale]').forEach(b => {
      b.onclick = () => {
        state.scale = b.dataset.scale;
        document.querySelectorAll('#zoombar button[data-scale]').forEach(x => x.classList.toggle('on', x === b));
        if (zoombarSelect) zoombarSelect.value = state.scale;
        afterChange();
      };
    });
    // 视图导航：rail / 侧栏 [data-nav] 按钮
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = () => switchView(b.dataset.nav);
    });
    // 侧栏「仪式」入口
    const bindRit = (id, fn) => { const rb = document.getElementById(id); if (rb) rb.onclick = fn; };
    bindRit('sideMorning', () => openRitualModal('morning'));
    bindRit('sideEvening', () => openRitualModal('evening'));
    bindRit('sideWeekPlan', () => openWeekPlan());
    bindRit('sideHistory', () => openHistory());   // v8.12 仪式历史
    // URL 深链：#/today|plan|insights 切视图；#day|week|month|year|all 设尺度并跳到「归纳洞察」
    // #calendar 或 #cal=2026-11-24 → 直接进「归纳洞察 · 日历视角」并选中该日
    const syncViewbar = () => {
      document.querySelectorAll('#viewbar button').forEach(x => x.classList.toggle('on', x.dataset.view === state.viewMode));
      if (viewbarSelect) viewbarSelect.value = state.viewMode;
    };
    try {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      const calM = raw.match(/^cal=(\d{4})-(\d{2})-(\d{2})$/);
      if (raw === 'calendar' || calM) {
        state.viewMode = 'calendar';
        if (calM) {
          calSelDk = raw.slice(4); calMonth = new Date(+calM[1], +calM[2] - 1, 1);
          // 深链指向具体某一天：直接落到该月的网格，否则 scale='all' 只会看到年度概览
          state.scale = 'month';
        }
        syncViewbar();
        switchView('insights', { silent: true });
      }
      else if (VIEWS[raw]) switchView(raw, { silent: true });
      else if (['all', 'day', 'week', 'month', 'year'].includes(raw)) { state.scale = raw; switchView('insights', { silent: true }); }
      else switchView(currentView(), { silent: true });
    } catch (e) { switchView('today', { silent: true }); }
    document.querySelectorAll('#zoombar button[data-scale]').forEach(b => b.classList.toggle('on', b.dataset.scale === state.scale));
    if (zoombarSelect) zoombarSelect.value = state.scale;
    const keyIn = document.getElementById('llmKey');
    if (keyIn) {
      try { const k = localStorage.getItem(LLM_KEY_STORAGE); if (k) keyIn.value = k; } catch (e) { }
      const saveKeyBtn = document.getElementById('btnSaveKey');
      if (saveKeyBtn) saveKeyBtn.onclick = () => { try { localStorage.setItem(LLM_KEY_STORAGE, keyIn.value.trim()); LLM_KEY = keyIn.value.trim(); } catch (e) { } showToast('已保存（仅存于本机浏览器）'); };
    }
    document.getElementById('btnWeekReview').onclick = openWeekReview;
    document.getElementById('btnReviewBanner').onclick = openWeekReview;
    document.getElementById('btnDismissBanner').onclick = () => {
      state.meta.bannerDismissedWeek = weekKey(); saveMeta(); renderReviewBanner();
    };
    const doExport = () => exportBackup();
    document.getElementById('btnExportJson').onclick = doExport;
    const ex2 = document.getElementById('btnExportJson2'); if (ex2) ex2.onclick = doExport;
    const icsBtn = document.getElementById('btnExportIcs');
    if (icsBtn) icsBtn.onclick = () => exportICS();
    const syncBtn = document.getElementById('btnSyncTree');
    if (syncBtn) syncBtn.onclick = () => { syncTreeToInput(); alert('已将树形结构同步到左侧文本框。'); };
    const fin = document.getElementById('importFile');
    document.getElementById('btnImportJson').onclick = () => fin.click();
    fin.onchange = () => { if (fin.files && fin.files[0]) importBackup(fin.files[0]); fin.value = ''; };
    const bs = document.getElementById('btnSettings'); if (bs) bs.onclick = openSettingsModal;
    fsInit();
    if (load()) afterChange();
    else {
      // v6.3 新手引导：首次使用（无任何已存数据）自动载入示例 + 显示三步引导卡
      try { loadDemo(); switchView('today', { silent: true }); }
      catch (e) { afterChange(); }
    }
    window.goalflowStorageReport = storageReport;
    window.addEventListener('beforeunload', () => { try { save(); saveMeta(); } catch (e) { } });
    setInterval(() => { refreshTodayIfNeeded(); tickReminders(); tickRitualAlarms(); }, 30000);
    // v6.2 移动端兜底：锁屏/切后台会挂起定时器，页面重新可见时立即补跑提醒与仪式闹钟（弹窗式闹钟）
    // v8.10: wakeCheck 先跑 refreshTodayIfNeeded —— 隔夜唤醒先换「今天」再补提醒，否则提醒与面板各认各的日期
    const wakeCheck = () => { try { refreshTodayIfNeeded(); tickReminders(); tickRitualAlarms(); if (state.pomo && state.pomo.active) renderPomoBar(); } catch (e) { } };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeCheck(); });
    window.addEventListener('pageshow', wakeCheck);
    window.addEventListener('focus', wakeCheck);
    tickReminders(); tickRitualAlarms();
    // Esc 关闭弹窗 + v6.4 全局快捷键
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask[style*="display: block"], .modal-mask[style*="display:block"]').forEach(m => {
          m.style.display = 'none';
        });
        return;
      }
      // v6.4 快捷键：1/2/3 切视图 · t 回今日 · c 捕捉 · 空格 番茄暂停
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openGlobalSearch(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
      // 弹窗打开时不响应（Esc 除外）
      if (document.querySelector('.modal-mask.show, .modal-mask[style*="display: block"], .modal-mask[style*="display:block"]')) return;
      const viewKeys = { '1': 'today', '2': 'plan', '3': 'insights', '4': 'ai' };
      if (viewKeys[e.key]) { e.preventDefault(); switchView(viewKeys[e.key]); return; }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); switchView('today'); return; }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); quickCapture(); return; }
      if (e.key === '/') { e.preventDefault(); openGlobalSearch(); return; }
      if (e.key === ' ' && state.pomo && state.pomo.active) { e.preventDefault(); togglePomoPause(); return; }
    });
    // v6.6 键盘弹出时把输入框滚入视口（避免被键盘挡住）
    document.addEventListener('focusin', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        const scroll = document.querySelector('.main-scroll');
        if (scroll) setTimeout(() => { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 350);
      }
    });
    // v6.6 四象限卡片触屏拖动（长按 250ms 后跟随手指，松手归位）
    document.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      const qh = e.target.closest('.qh');
      if (!qh) return;
      const card = qh.closest('.qcard');
      if (!card) return;
      const id = qh.dataset.id;
      let startX = e.clientX, startY = e.clientY, dragging = false;
      const timer = setTimeout(() => {
        dragging = true;
        card.classList.add('dragging');
        try { qh.setPointerCapture(e.pointerId); } catch (e) {}
      }, 250);
      const onMove = ev => {
        if (dragging) return;
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) { clearTimeout(timer); }
      };
      const finish = ev => {
        clearTimeout(timer);
        if (dragging) {
          try { qh.releasePointerCapture(e.pointerId); } catch (e) {}
          card.classList.remove('dragging');
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const drop = el && el.closest && el.closest('.qdrop');
          if (drop && drop.dataset.q) applyQuadDrop(id, drop.dataset.q);
        }
        qh.removeEventListener('pointermove', onMove);
        qh.removeEventListener('pointerup', finish);
        qh.removeEventListener('pointercancel', finish);
      };
      qh.addEventListener('pointermove', onMove);
      qh.addEventListener('pointerup', finish);
      qh.addEventListener('pointercancel', finish);
    });
    // v7.2 AI 分析视图初始化
    initAIDecomposeHandlers();
    requestAnimationFrame(() => { document.body.classList.add('is-ready'); });
  })();
}

/* ============ 导出纯函数供测试 ============ */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    parseText, parseDeadline, focusScore, category, applySuggestions, computeTree, recomputeSchedule,
    treeOrder, pickTop, pickRanked, leafProgress, subtreeProgress, urColor, buildView, sankeyLayout,
    wrapLabel, inferScale, smartEval, smartQuestions, decomposeSuggestions, serializeNodes, weekKey,
    computeWeekStats, computePeriodStats, ensureVE, isQuickWin, inferRecur, parseEstimateMinutes, metricProgress, paceStatus, backlogLanes, exportICS, nodesToIndentedText, periodKey,
    scoreDoneItem, scorePomoItem, scoreGrade, todayScore, scoreForDk, summarizeScoreEntries,
    dkWeekLabel, historyMorningDays, historyEveningDays, historyWeekPlans, historyReviews, openHistory,
    timeAudit, weekPlanCandidates, adoptPendingAction,
    stagnationAlerts, stagnantDays, energyCurve, energyBucketNow, logEnergy,
    focusScoreParts, pickNextTopId, scoreOfDoneEntry, isNodeParked, isNodeWaiting, isNodeBlocked, habitStrength, habitWeekLog,
    setNodeDeadline, convertDuePlanDate, habitRecurrence, habitTarget, habitDueToday, isRecurringTask, recurringTaskDueToday,
    resolveTimeConflicts, ensureTodayTimeResolved, todayExecutionPoolFor, backfillAISchedule,
    addInbox, clarifyInbox, inboxPending, planVsActual,
    archiveWorkflow, unarchiveWorkflow, isWorkflowComplete, activeWorkflows, openCommitCard, togglePomoPause, quickCapture,
    GoalFlowTheme: typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : GF,
  };
}