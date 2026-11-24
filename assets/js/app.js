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
const DAY_CAPACITY_MIN = 480; // 日视图可做完性：默认 8 小时容量
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
  getCachedTree(state.nodes);
  state.nodes.forEach(n => {
    const leaf = n.parentId && n._children.length === 0;
    ensureEstimate(n, leaf);
  });
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function dateKey(d) {
  d = d || today0();
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
  if (n.targetNum > 0) return { done: n.targetDone || 0, tgt: n.targetNum, pct: Math.round((n.targetDone || 0) / n.targetNum * 100) };
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
}

/* ============ v6.3 折叠子块（时间审计 / 停滞 / 精力，状态记忆） ============ */
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
  let s = 10 + (n ? (n.im || 3) * 2 : 6);
  if ((minutes || 25) >= 25) s += 4;
  return { score: clamp(Math.round(s), 0, 40), reason: `完整专注 ${minutes || 25}′${n ? ` · 重要${n.im || 3}` : ''}` };
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
function todayScore() {
  ensureScoreMeta();
  const entries = (state.meta.scoreLog[dateKey()] || { entries: [] }).entries;
  const total = entries.reduce((a, e) => a + (e.score || 0), 0);
  const pomos = entries.filter(e => e.kind === 'pomo').length;
  const dones = entries.filter(e => e.kind === 'done').length;
  return { total, count: dones, pomos, focusMin: pomos * 25, entries, grade: scoreGrade(total) };
}
function setNodeDone(n, checked) {
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
    updateHabitStreak(n, state.activeWorkflowId, false);
    logHabitCheck(n, state.activeWorkflowId, false);
  }
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

/* ============ 日期 / 排期解析 ============ */
const WK = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
function parseDeadline(text) {
  const t = text || '';
  const base = today0();
  const mk = (label, date) => { const d = startOfDay(date); const dl = Math.round((d - base) / 86400000); return { label, date: d, daysLeft: dl, overdue: dl < 0 }; };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let m;
  if (/今天|今日/.test(t)) return mk('今天', base);
  if (/明天/.test(t)) return mk('明天', addDays(base, 1));
  if (/后天/.test(t)) return mk('后天', addDays(base, 2));
  m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (m) { let mo = +m[1], da = +m[2]; let yr = base.getFullYear(); let d = new Date(yr, mo - 1, da); if (d < base) d = new Date(yr + 1, mo - 1, da); return mk(`${mo}月${da}日`, d); }
  m = t.match(/(下)?\s*(周|星期)\s*([一二三四五六日天])/);
  if (m) { const wd = WK[m[3]]; let d = nextWeekday(base, wd); if (m[1]) d = addDays(d, 7); return mk(`${m[1] || ''}周${m[3]}`, d); }
  if (/本周\s*内?/.test(t)) return mk('本周内', endOfWeek(base));
  if (/下周/.test(t)) return mk('下周', endOfWeek(addDays(base, 7)));
  if (/下月底|下月末/.test(t)) return mk('下月底', new Date(base.getFullYear(), base.getMonth() + 2, 0));
  if (/本月底|月底|月末/.test(t)) return mk('月底', new Date(base.getFullYear(), base.getMonth() + 1, 0));
  if (/本月/.test(t)) return mk('本月', new Date(base.getFullYear(), base.getMonth() + 1, 0));
  return { label: '', date: null, daysLeft: null, overdue: false };
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
  if (d <= 4) return 4;
  if (d <= 7) return 4;
  if (d <= 14) return 3;
  return 2;
}

/* ============ 解析层 ============ */
/* 节点工厂：所有新节点走这里，字段一处维护（避免 5 处字面量同步漏字段） */
function newNode(partial) {
  const n = {
    id: partial.id || 'n0', text: partial.text || '', im: 3, ur: 3, val: null, eff: null, role: '',
    targetNum: null, targetDone: 0, deadline: '', deadlineDate: null, daysLeft: null, overdue: false,
    done: false, doneAt: null, touchedAt: null, createdAt: partial.createdAt || Date.now(),
    estimateMinutes: null, actualMinutes: null, recur: false, scale: null, slot: '',
    ifThen: '', premortem: '', status: '', waitNote: '', timesPerWeek: 0,
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
}
function recomputeSchedule(nodes) {
  nodes.forEach(n => {
    if (n.deadline) { const dl = parseDeadline(n.deadline); n.deadlineDate = dl.date; n.daysLeft = dl.daysLeft; n.overdue = dl.overdue; }
    else { n.deadlineDate = null; n.daysLeft = null; n.overdue = false; }
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
function focusScore(n) {
  if (n.done) return -1000;
  let s = n.im * 10;
  if (n.deadlineDate) {
    if (n.overdue) s += 30;
    else if (n.daysLeft <= 1) s += 26;
    else if (n.daysLeft <= 3) s += 20;
    else if (n.daysLeft <= 7) s += 13;
    else if (n.daysLeft <= 14) s += 7;
    else s += 3;
  } else {
    if (n.im >= 5) s += 4; else if (n.im >= 4) s += 2;
  }
  // 等待 / 阻塞不参与「当下最重要」竞选（借鉴 Taskwarrior：blocked/waiting 压分）
  if (isNodeBlocked(n)) s -= 60;
  else if (isNodeWaiting(n)) s -= 45;
  // 精力高峰加权：高费力任务若钉在你的高峰时段，当前正处于该时段则临时加权
  if (typeof state !== 'undefined' && state.meta && state.meta.energyLog && n.slot && (n.eff || 3) >= 4) {
    try {
      const curve = energyCurve();
      if (curve && curve.peak) {
        const bucket = ENERGY_BUCKETS.find(b => b[0] === curve.peak);
        const nowBucket = energyBucketNow();
        if (bucket && bucket[0] === nowBucket && (bucket[2] || []).includes(n.slot)) s += 6;
      }
    } catch (e) { }
  }
  return s;
}
/* 得分分解：英雄卡要「讲清楚为什么」（加分项逐条可见） */
function focusScoreParts(n) {
  const parts = [];
  parts.push({ label: `重要${n.im || 3}`, pts: (n.im || 3) * 10 });
  if (n.deadlineDate) {
    if (n.overdue) parts.push({ label: '已逾期', pts: 30 });
    else if (n.daysLeft <= 1) parts.push({ label: '1天内到期', pts: 26 });
    else if (n.daysLeft <= 3) parts.push({ label: '3天内到期', pts: 20 });
    else if (n.daysLeft <= 7) parts.push({ label: '本周到期', pts: 13 });
    else if (n.daysLeft <= 14) parts.push({ label: '两周内', pts: 7 });
    else parts.push({ label: '有期限', pts: 3 });
  } else if ((n.im || 3) >= 4) {
    parts.push({ label: '长期主线', pts: (n.im >= 5 ? 4 : 2) });
  }
  if (isNodeBlocked(n)) parts.push({ label: '阻塞中', pts: -60 });
  else if (isNodeWaiting(n)) parts.push({ label: '等待中', pts: -45 });
  const sd = stagnantDays(n);
  if (sd > 0 && sd < 999 && (n.im || 3) >= 4) parts.push({ label: `停滞${sd}天`, pts: 0 });
  return { total: focusScore(n), parts };
}
function pickRanked(pool, limit) {
  pool = pool || state.nodes;
  let cand = pool.filter(n => n.parentId && !n.done && n._children.length === 0 && !isNodeParked(n));
  if (!cand.length) cand = pool.filter(n => n.parentId && !n.done && !isNodeParked(n));
  if (!cand.length) { const root = pool[0]; if (root && !root.done) return limit > 1 ? [root] : root; return limit > 1 ? [] : null; }
  cand.sort((a, b) => focusScore(b) - focusScore(a) || b.im - a.im || ((a.daysLeft == null ? 999 : a.daysLeft) - (b.daysLeft == null ? 999 : b.daysLeft)));
  return limit > 1 ? cand.slice(0, limit) : cand[0];
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
  return { s, m, a, r, tb, avg, gaps, smart: gaps.length === 0 && avg >= 2.4 };
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
async function callLLM(system, user) {
  const key = getLLMKey(); if (!key) return null;
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.choices && d.choices[0] && d.choices[0].message.content;
  } catch (e) { return null; }
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
  const focus = document.getElementById('focusMode').checked;
  const showNoise = document.getElementById('showNoise').checked;
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
  vis.forEach(n => { if (n.parentId && visSet.has(n.parentId)) localById[n.parentId]._vc.push(n); });
  (function val(n) { if (!n._vc.length) { n._val = n.im; return n._val; } let s = 0; n._vc.forEach(c => s += val(c)); n._val = s; return n._val; })(vis.find(n => !n.parentId) || vis[0]);
  return vis;
}
function sankeyLayout(vis) {
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
  nodes: [], topId: null, scale: 'all', viewMode: 'sankey', quadQuickWin: false,
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
      rec.lastDate = '';
      rec.cur = 0;
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
function habitTarget(n) { return (n && n.timesPerWeek > 0) ? n.timesPerWeek : 7; }
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
}
function applyActiveWorkflow() {
  ensureWorkflows();
  const w = workflowById(state.activeWorkflowId);
  if (!w) return;
  state.nodes = w.nodes || [];
  state.topId = w.topId || null;
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
function deleteWorkflow(id) {
  if (!id) return;
  ensureWorkflows();
  if (state.workflows.length <= 1) {
    alert('至少保留一个项目（目标流），不能全部删除。');
    return;
  }
  const w = workflowById(id);
  if (!w) return;
  if (!confirm(`确定删除项目「${w.name}」？其目标树也会删除，且不可撤销。`)) return;
  state.workflows = state.workflows.filter(x => x.id !== id);
  if (state.activeWorkflowId === id) {
    state.activeWorkflowId = state.workflows[0].id;
    applyActiveWorkflow();
  }
  save();
  afterChange();
  syncTreeToInput();
}
function openWorkflowMetaModal(mode, wfId) {
  const overlay = document.getElementById('workflowMetaModal');
  if (!overlay) return;
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
      <label class="wfm-row"><span>项目名称</span><input id="wfmName" class="gf-input" value="${esc(name)}" placeholder="如：副业收入 / 2026 健康"></label>
      <label class="wfm-row"><span>标签（逗号分隔）</span><input id="wfmTags" class="gf-input" value="${esc(tags)}" placeholder="工作, 成长, 家庭"></label>
      <div class="wfm-2col">
        <label class="wfm-row"><span>开始日期</span><input id="wfmStart" type="date" class="gf-input" value="${esc(sd)}"></label>
        <label class="wfm-row"><span>结束日期</span><input id="wfmEnd" type="date" class="gf-input" value="${esc(ed)}"></label>
      </div>
      <label class="wfm-row"><span>备注</span><textarea id="wfmDesc" class="gf-input" rows="3" placeholder="项目背景、成功标准…">${esc(desc)}</textarea></label>
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
  overlay.querySelector('#wfmSave').onclick = () => {
    const v = (id) => overlay.querySelector(id) ? overlay.querySelector(id).value.trim() : '';
    const meta = { name: v('#wfmName'), tags: parseTagsInput(v('#wfmTags')), startDate: v('#wfmStart'), endDate: v('#wfmEnd'), description: v('#wfmDesc') };
    const shareRaw = v('#wfmShare');
    ensureScoreMeta();
    if (isNew) {
      createWorkflow(meta);
      if (shareRaw !== '') state.meta.planShare[state.activeWorkflowId] = clamp(+shareRaw || 0, 0, 100);
      saveMeta();
      close();
      setTimeout(() => {
        if (confirm('项目已创建。现在去「目标规划」输入并解析目标，再用必经步骤向导自动生成规划？')) switchView('plan');
      }, 50);
      return;
    }
    const id = wfId || state.activeWorkflowId;
    updateWorkflowMeta(id, meta);
    if (shareRaw === '') delete state.meta.planShare[id];
    else state.meta.planShare[id] = clamp(+shareRaw || 0, 0, 100);
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
    alert(`已生成 ${items.length} 条规划步骤${removed ? `（清掉上次 ${removed} 条）` : ''}：里程碑进规划、习惯进今日打卡、行动进今日清单。`);
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
  state.nodes = keep;
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
  if (!timeStr) { n.remindAt = null; save(); return; }
  const p = String(timeStr).split(':');
  const hh = +p[0] || 0, mm = +p[1] || 0;
  const d = today0();
  d.setHours(clamp(hh, 0, 23), clamp(mm, 0, 59), 0, 0);
  n.remindAt = d.getTime();
  save();
}
function requestAlarmPermission() {
  // v6.2 移动端/微信内：无桌面通知 API，静默降级（页面内弹窗式闹钟不依赖它）
  if (typeof Notification === 'undefined') { return Promise.resolve(false); }
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') { alert('通知已被拒绝，请在浏览器站点设置中允许通知'); return Promise.resolve(false); }
  return Notification.requestPermission().then(p => p === 'granted');
}
function tickReminders() {
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
      const title = '⏰ ' + n.text;
      const body = (wf.name ? '[' + wf.name + '] ' : '') + (n.estimateMinutes ? ('约 ' + n.estimateMinutes + ' 分钟') : '该行动了');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification(title, { body, tag: key }); } catch (e) { }
      }
    });
  });
  if (dirty) saveMeta();
}

function normalizeNode(n) {
  if (n.slot == null) n.slot = '';
  if (n.deadlineDate && typeof n.deadlineDate === 'string') n.deadlineDate = new Date(n.deadlineDate);
  if (n.doneAt != null && typeof n.doneAt === 'string') n.doneAt = +new Date(n.doneAt);
  if (n.recur == null) n.recur = inferRecur(n.text, n.scale);
  if (n.touchedAt != null && typeof n.touchedAt === 'string') n.touchedAt = +new Date(n.touchedAt);
  if (n.remindAt != null && typeof n.remindAt === 'string') n.remindAt = +new Date(n.remindAt);
  if (n.ifThen == null) n.ifThen = '';
  if (n.premortem == null) n.premortem = '';
  if (n.createdAt == null) n.createdAt = null;
  if (n.status == null) n.status = '';
  if (n.waitNote == null) n.waitNote = '';
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
    daysLeft: n.daysLeft, overdue: !!n.overdue, done: !!n.done, doneAt: n.doneAt || null,
    touchedAt: n.touchedAt || null, estimateMinutes: n.estimateMinutes ?? null, actualMinutes: n.actualMinutes ?? null,
    remindAt: n.remindAt ?? null,
    ifThen: n.ifThen || '', premortem: n.premortem || '', createdAt: n.createdAt || null,
    status: n.status || '', waitNote: n.waitNote || '', timesPerWeek: n.timesPerWeek || 0,
    conf: n.conf || 0, confNote: n.confNote || '', confAt: n.confAt || null,
    recur: !!n.recur, scale: n.scale || null,
    parentId: n.parentId, slot: n.slot || ''
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
  return { est, act, count: dayLeaves.length, over: est > DAY_CAPACITY_MIN, cap: DAY_CAPACITY_MIN };
}
function nodesToIndentedText() {
  if (!state.nodes.length) return '';
  getCachedTree(state.nodes);
  return treeOrder(state.nodes).map(n => {
    if (n.depth === 0) return n.text;
    return '  '.repeat(n.depth) + '- ' + n.text;
  }).join('\n');
}

const VIZ_HTML = new Set(['kanban', 'heatmap', 'mindmap']);
function renderCanvas() {
  const svg = document.getElementById('diagram-svg');
  const alt = document.getElementById('vizAlt');
  if (svg) svg.style.display = VIZ_HTML.has(state.viewMode) ? 'none' : '';
  if (alt) {
    alt.style.display = VIZ_HTML.has(state.viewMode) ? 'block' : 'none';
    if (VIZ_HTML.has(state.viewMode)) {
      if (state.viewMode === 'kanban') renderKanban(alt);
      else if (state.viewMode === 'heatmap') renderHeatmap365(alt);
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
function makeQuadCard(n) {
  const c = category(n.im, n.ur);
  const isTop = (n.id === state.topId);
  const card = document.createElement('div'); card.className = 'qcard' + (isTop ? ' istop' : ''); card.dataset.id = n.id;
  card.style.borderLeftColor = isTop ? 'var(--gold)' : c.color;
  const h = document.createElement('div'); h.className = 'qh'; h.draggable = true; h.dataset.id = n.id; h.title = n.text; h.textContent = (isTop ? '★ ' : '') + n.text;
  h.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
  h.addEventListener('dragend', () => card.classList.remove('dragging'));
  const scaleOpts = ['', 'day', 'week', 'month', 'year', 'long'].map(k => `<option value="${k}"${n.scale === k ? ' selected' : ''}>${k === 'day' ? '每日' : k === 'week' ? '每周' : k === 'month' ? '每月' : k === 'year' ? '年度' : k === 'long' ? '长期' : '尺度'}</option>`).join('');
  const slotOpts = DAY_SLOTS.map(([k, l]) => `<option value="${k}"${(n.slot || '') === k ? ' selected' : ''}>${l}</option>`).join('');
  const isLeaf = !n._children.length;
  const body = document.createElement('div'); body.className = 'qbody';
  if (isQuickWin(n)) card.classList.add('qcard-qw');
  body.innerHTML =`
    <span class="qstep">重<button data-k="im" data-d="-1">−</button><b>${n.im}</b><button data-k="im" data-d="1">+</button></span>
    <span class="qstep">急<button data-k="ur" data-d="-1">−</button><b>${n.ur}</b><button data-k="ur" data-d="1">+</button></span>
    <span class="qstep" title="价值">值<button data-k="val" data-d="-1">−</button><b>${n.val}</b><button data-k="val" data-d="1">+</button></span>
    <span class="qstep" title="费力">力<button data-k="eff" data-d="-1">−</button><b>${n.eff}</b><button data-k="eff" data-d="1">+</button></span>
    <label class="qdone"><input type="checkbox" ${n.done ? 'checked' : ''}>✓</label>
    <select class="qscale">${scaleOpts}</select>
    ${isLeaf ? `<select class="qslot" title="日视图时段">${slotOpts}</select>` : ''}
    ${isLeaf ? '<button class="qmicro" title="拆出 5 分钟微动作">🫳</button>' : ''}
    <button class="qai" title="SMART 对话拆解">🤖</button>`;
  card.appendChild(h); card.appendChild(body);
  card.addEventListener('mouseenter', () => highlightNode(n.id, true));
  card.addEventListener('mouseleave', () => highlightNode(n.id, false));
  body.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { const nd = byId(n.id); nd[b.dataset.k] = clamp((+nd[b.dataset.k]) + (+b.dataset.d), 1, 5); if (b.dataset.k === 'im') nd.val = Math.max(nd.val, nd.im); save(); afterChange(); });
  body.querySelector('.qdone input').onchange = e => { setNodeDone(byId(n.id), e.target.checked); save(); afterChange(); };
  body.querySelector('.qscale').onchange = e => { byId(n.id).scale = e.target.value || null; save(); afterChange(); };
  const slotEl = body.querySelector('.qslot');
  if (slotEl) slotEl.onchange = e => { byId(n.id).slot = e.target.value || ''; byId(n.id).scale = byId(n.id).scale || 'day'; save(); afterChange(); };
  const micro = body.querySelector('.qmicro');
  if (micro) micro.onclick = () => addMicroAction(n.id);
  body.querySelector('.qai').onclick = () => openSmart(n.id);
  return card;
}
function renderQuadrant() {
  const wrap = document.getElementById('quadGrid'); if (!wrap) return;
  getCachedTree(state.nodes);
  const nodes = quadNodes();
  const buckets = { now: [], core: [], distract: [], noise: [] };
  nodes.forEach(n => { const k = category(n.im, n.ur).key; (buckets[k] || buckets.noise).push(n); });
  wrap.innerHTML = '';
  QUAD_ORDER.forEach(q => {
    const cell = document.createElement('div'); cell.className = 'quad-cell'; cell.dataset.q = q;
    const head = document.createElement('div'); head.className = 'quad-head'; head.innerHTML = QUAD[q].icon + ' ' + QUAD[q].label; cell.appendChild(head);
    const drop = document.createElement('div'); drop.className = 'qdrop'; drop.dataset.q = q;
    if (!buckets[q].length) { const e = document.createElement('div'); e.className = 'qempty'; e.textContent = '— 把任务卡拖到这儿 —'; drop.appendChild(e); }
    buckets[q].forEach(n => drop.appendChild(makeQuadCard(n)));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); applyQuadDrop(id, q); });
    cell.appendChild(drop); wrap.appendChild(cell);
  });
  renderVeMatrix();
}
function renderVeMatrix() {
  const wrap = document.getElementById('veGrid'); if (!wrap) return;
  const nodes = vePanelNodes();
  const buckets = { quick: [], major: [], easy: [], trap: [] };
  nodes.forEach(n => { (buckets[veKey(n.val, n.eff)] || buckets.trap).push(n); });
  const toggle = document.getElementById('btnQuickWin');
  if (toggle) toggle.classList.toggle('on', !!state.quadQuickWin);
  wrap.innerHTML = '';
  VE_ORDER.forEach(k => {
    const cell = document.createElement('div'); cell.className = 've-cell'; cell.dataset.ve = k;
    const head = document.createElement('div'); head.className = 've-head';
    head.innerHTML = `${VE[k].icon} ${VE[k].label} <span class="ve-cnt">${buckets[k].length}</span>`;
    head.style.borderLeftColor = VE[k].color;
    cell.appendChild(head);
    const list = document.createElement('div'); list.className = 've-list';
    if (!buckets[k].length) { const e = document.createElement('div'); e.className = 've-empty'; e.textContent = '—'; list.appendChild(e); }
    buckets[k].slice(0, 6).forEach(n => {
      const row = document.createElement('div'); row.className = 've-row' + (isQuickWin(n) ? ' qw' : '');
      row.textContent = n.text.length > 28 ? n.text.slice(0, 28) + '…' : n.text;
      row.title = `值 ${n.val} · 力 ${n.eff}`;
      list.appendChild(row);
    });
    if (buckets[k].length > 6) { const more = document.createElement('div'); more.className = 've-more'; more.textContent = `+${buckets[k].length - 6} 项`; list.appendChild(more); }
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
function pomoRemainMs() { return state.pomo.active ? Math.max(0, state.pomo.endAt - Date.now()) : 0; }
function startPomo(minutes) {
  const id = state.topId;
  if (!id) { alert('请先载入目标，选出当下最重要'); return; }
  minutes = minutes || 25;
  state.pomo = { active: true, endAt: Date.now() + minutes * 60000, nodeId: id, minutes };
  document.body.classList.add('focus-timer-on');
  if (pomoTimer) clearInterval(pomoTimer);
  pomoTimer = setInterval(() => { if (pomoRemainMs() <= 0) finishPomo(true); else renderPomoBar(); }, 1000);
  renderHero(); renderPomoBar();
}
function stopPomo() { finishPomo(false); }
function finishPomo(credit) {
  if (credit && state.pomo.nodeId) {
    const n = byId(state.pomo.nodeId);
    if (n) { n.actualMinutes = (n.actualMinutes || 0) + Math.round(state.pomo.minutes || 25); n.touchedAt = Date.now(); appendScore(n, 'pomo', { minutes: state.pomo.minutes || 25 }); save(); }
  }
  state.pomo.active = false;
  document.body.classList.remove('focus-timer-on');
  if (pomoTimer) clearInterval(pomoTimer);
  renderHero(); renderPomoBar(); afterChange();
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
  const n = byId(state.pomo.nodeId);
  el.classList.add('show');
  el.innerHTML = `<div class="pomo-inner"><b>🍅 专注</b><span class="pomo-task">${esc((n && n.text) || '')}</span><span class="pomo-t">${pad2(m)}:${pad2(s)}</span><span class="pomo-pct">${pct}%</span>
    <div class="pomo-prog"><i style="width:${pct}%"></i></div>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="pomoStop">结束</button></div>`;
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
  box.innerHTML = `<details class="fold" data-fold="audit"${foldOpen('audit') ? ' open' : ''}>
    <summary>🔍 时间审计 · 近 7 天<span class="fold-sum">${a.entries} 项 · ${biasSum}</span></summary>
    <div class="fold-body"><div class="today-audit">
      ${biasHtml}
      <div class="ta-cols"><div class="ta-col"><div class="ta-col-h">实际投入 · 按工作流</div>${wfBars}</div>
      <div class="ta-col"><div class="ta-col-h">实际投入 · 按象限</div>${catBars}</div></div>
    </div></div>
  </details>`;
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
  state.workflows.forEach(wf => {
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
  box.querySelectorAll('[data-energy]').forEach(b => b.onclick = () => { logEnergy(+b.dataset.energy); renderEnergyWidget(); });
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
  const pills = [
    lp ? `<span class="ms-pill">叶子 <b>${lp.pct}%</b> <small>${lp.done}/${lp.total}</small></span>` : '',
    top ? `<span class="ms-pill">Top1 分 <b>${imp}</b></span>` : '',
    `<span class="ms-pill ms-mom" title="近 7 天勾选叶子 · 写入执行记录 JSON">本周完成 <b>${mom.done}</b> · 估 ${mom.est}′ / 实 ${mom.act}′ <span class="ms-sparks">${spark}</span></span>`,
  ].concat(krs.map(n => {
    const mp = metricProgress(n); if (!mp) return '';
    const pace = paceStatus(n);
    const tag = n.role === 'habit' ? '习惯' : (n.role === 'KR' ? 'KR' : '目标');
    const confBtn = n.role === 'KR'
      ? ` <button type="button" class="ms-conf" data-confkr="${n.id}" title="KR 信心打卡（每周一次）：当前信心 ${n.conf ? n.conf + '/5' : '未评'}${n.confNote ? ' · ' + esc(n.confNote) : ''}">${n.conf ? '💪' + n.conf : '💪'}</button>`
      : '';
    return `<span class="ms-pill" title="${esc(n.text)}${n.role === 'KR' ? ' · 信心 ' + (n.conf || '—') + '/5' : ''}">${tag} ${mp.done}/${mp.tgt} <b>${mp.pct}%</b>${pace ? ` · Δ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}` : ''}${confBtn}</span>`;
  })).filter(Boolean);
  el.innerHTML = `<div class="metrics-strip">${pills.join('')}</div>`;
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
  return noHabit[0] || list[0] || null;
}
function renderHero() {
  const box = document.getElementById('hero');
  const vis = state.nodes.length ? buildView(state.nodes, state.scale) : [];
  const ranked = vis.length ? pickRanked(vis, 8) : [];
  const top = pickHeroTop(vis, ranked);
  state.topId = top ? top.id : null;
  if (!top) {
    box.className = 'hero empty';
    box.innerHTML = '<div class="hero-main">暂无待办——把你的目标粘进来，或点击「载入示例」。等待/阻塞的任务已自动退出竞选。</div>';
    return;
  }
  box.className = 'hero';
  const dl = top.deadlineDate ? (top.overdue ? `已逾期 ${-top.daysLeft} 天` : `剩余 ${top.daysLeft} 天`) : '无明确期限 · 长期主线';
  const c = category(top.im, top.ur);
  const why = top.overdue ? '已超期，最该立刻处理'
    : top.daysLeft != null && top.daysLeft <= 3 ? '期限临近且重要，优先拿下'
      : top.im >= 4 && top.ur < 4 ? '重要不紧急，是长期主线，要提前投入'
        : '重要且紧急，立刻做';
  const scaleTag = state.scale === 'all' ? '当下最重要' : (SCALE_LABEL[state.scale] + '最重要');
  const alts = ranked.filter(n => n.id !== top.id && !(n.recur || n.role === 'habit')).slice(0, 2);
  const prog = subtreeProgress(top);
  const progPill = prog ? `<span class="pill">📈 子树 ${prog.pct}%（${prog.done}/${prog.total}）</span>` : '';
  let altHtml = '';
  if (alts.length) {
    altHtml = `<div class="hero-stack"><div class="hs-lbl">执行栈 · 仍可优先（Top ${alts.length + 1} 之 ${alts.length > 1 ? '②③' : '②'}）</div>` +
      alts.map((n, i) => `<div class="hero-alt"><span class="rank">#${i + 2}</span><b>${esc(n.text)}</b></div>`).join('') + '</div>';
  }
  const pace = paceStatus(top);
  const pacePill = pace ? `<span class="pill pace" title="相对期限应有进度">节奏 ${pace.ahead >= 0 ? '领先' : '落后'} ${Math.abs(pace.ahead)}</span>` : '';
  const mp = metricProgress(top);
  const mpPill = mp && mp.kind !== 'leaf' ? `<span class="pill">📊 ${mp.done}/${mp.tgt}</span>` : '';
  // 得分分解：讲清楚为什么是它（加分项逐条可见）
  const fs = focusScoreParts(top);
  const partsHtml = fs.parts.map(p => `<span class="fs-item${p.pts < 0 ? ' neg' : ''}">${esc(p.label)} <b>${p.pts > 0 ? '+' : ''}${p.pts}</b></span>`).join('<span class="fs-sep">·</span>');
  box.innerHTML = `<div class="hero-main"><span class="hero-star">★</span> ${scaleTag}：<b>${esc(top.text)}</b></div>
    <div class="hero-sub">
      <span class="pill"><span class="dot" style="background:${c.color}"></span>${c.label}</span>
      <span class="pill">⏱ ${esc(dl)}</span>
      <span class="pill">重要 ${top.im} · 紧急 ${top.ur} · 分 ${fs.total}</span>
      ${progPill}${mpPill}${pacePill}
      <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="btnPomo25" title="番茄钟绑定当前 Top1">🍅 专注 25′</button>
      <span class="why">▶ ${why}</span>
    </div>
    <div class="hero-score" title="得分分解：为什么是这一件">${partsHtml}<span class="fs-total">= ${fs.total} 分</span></div>
    ${altHtml}`;
  const pb = document.getElementById('btnPomo25');
  if (pb) pb.onclick = () => startPomo(25);
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
function todayExecutionPoolFor(nodes) {
  if (!nodes || !nodes.length) return [];
  computeTree(nodes);
  const leaves = nodes.filter(n => n.parentId && n._children.length === 0 && !n.done && !isNodeParked(n));
  if (!leaves.length) return [];
  const vis = buildView(nodes, 'day');
  const topIds = new Set(pickRanked(vis, 5).map(n => n.id));
  const pool = leaves.filter(n => {
    if (topIds.has(n.id)) return true;
    if (n.scale === 'day') return true;
    if (n.recur || n.role === 'habit') return true;
    if (n.daysLeft != null && n.daysLeft <= 1) return true;
    if (n.overdue) return true;
    if (n.slot) return true;
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
  // 今日容量硬约束：估时累计超 DAY_CAPACITY_MIN 后，后续任务进「溢出」而非今日清单
  let budget = DAY_CAPACITY_MIN;
  const out = [];
  sorted.forEach(n => {
    ensureEstimate(n, true);
    const est = n.estimateMinutes || 0;
    const habit = n.recur || n.role === 'habit';
    // 习惯不计容量（打卡型），其余计
    if (!habit && est > budget && out.length) { n._overflow = true; return; }
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
  state.workflows.forEach(wf => {
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
    const pool = todayExecutionPoolFor(nodes);
    pool.forEach(n => {
      items.push({
        node: n, wfId: wf.id, wfName: wf.name || '目标流',
        isWfTop: !!(wfTop && n.id === wfTop.id),
      });
    });
    if (wf.id === state.activeWorkflowId && wfTop) {
      state.topId = wfTop.id;
      wf.topId = wfTop.id;
    }
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
  state.workflows.forEach(wf => {
    const nodes = wf.nodes || [];
    if (!nodes.length) return;
    todayExecutionPoolFor(nodes).forEach(n => {
      if (n.recur || n.role === 'habit') return; // 习惯不计容量
      ensureEstimate(n, true);
      est += (n.estimateMinutes || 0);
      count++;
    });
  });
  return { est, act: 0, count, over: est > DAY_CAPACITY_MIN, cap: DAY_CAPACITY_MIN };
}
function todayRowHtml(entry, opts) {
  opts = opts || {};
  const n = entry.node || entry;
  const wfId = entry.wfId || state.activeWorkflowId || '';
  const wfName = entry.wfName || '';
  const isWfTop = !!entry.isWfTop;
  const habit = n.recur || n.role === 'habit';
  const isMicro = (n.estimateMinutes || 99) <= 10;
  const slot = n.slot ? (DAY_SLOTS.find(s => s[0] === n.slot) || ['', ''])[1] : '';
  const slotOpts = DAY_SLOTS.map(([k, l]) => `<option value="${k}"${(n.slot || '') === k ? ' selected' : ''}>${l}</option>`).join('');
  const remind = todayRemindValue(n);
  const est = n.estimateMinutes ?? '';
  const streak = habitStreakOf(n, wfId);
  const hw = habit ? habitWeekLog(n, wfId) : null;
  const hs = hw && hw.rec ? habitStrength(hw.rec) : null;
  const habitMeta = habit
    ? `<span class="today-meta habit-freq" title="习惯分轨：本周进度 / 强度（漏做按频率衰减，不清零）">📈 本周 ${hw.done}/${hw.target}${hw.left ? ` · 差${hw.left}次` : ' · 已达成'}${hs && hs.samples ? ` · 强度${hs.pct}%` : ''}${streak ? ` · 🔥${streak.cur}天` : ''}</span>`
    : '';
  const waitMeta = isNodeWaiting(n) ? `<span class="today-meta wait-tag" title="${esc(n.waitNote || '等待外部')}">⏳ 等待中${n.waitNote ? ' · ' + esc(n.waitNote) : ''}</span>` : '';
  const blockMeta = isNodeBlocked(n) ? `<span class="today-meta block-tag" title="${esc(n.waitNote || '被阻塞')}">🚫 阻塞${n.waitNote ? ' · ' + esc(n.waitNote) : ''}</span>` : '';
  return `<div class="today-row${isWfTop ? ' is-top' : ''}${habit ? ' is-habit' : ''}${isNodeParked(n) ? ' is-parked' : ''}" data-id="${n.id}" data-wf="${wfId}" draggable="true">
    <label class="today-check"><input type="checkbox" data-done="${n.id}" data-wf="${wfId}" aria-label="完成"></label>
    <div class="today-txt"><b>${isWfTop ? '★ ' : ''}${habit ? '🔁 ' : ''}${isMicro ? '🫳 ' : ''}${esc(n.text)}</b>
      ${wfName ? `<span class="today-meta wf-tag">${esc(wfName)}</span>` : ''}
      ${slot ? `<span class="today-meta">🕐 ${esc(slot)}</span>` : ''}
      ${habit ? habitMeta : (streak ? `<span class="today-meta streak" title="习惯连续天数（执行记录驱动）">🔥 ${streak.cur}天</span>` : '')}
      ${n.daysLeft != null ? `<span class="today-meta">${n.overdue ? '逾期' : '剩'}${Math.abs(n.daysLeft)}天</span>` : ''}
      ${waitMeta}${blockMeta}
    </div>
    <div class="today-timing">
      <label class="today-time-lbl" title="今日闹钟提醒">⏰</label>
      <input type="time" class="today-remind" data-remind="${n.id}" data-wf="${wfId}" value="${remind}" title="设置今日提醒时间">
      <input type="number" class="today-est" min="1" max="999" step="5" data-est="${n.id}" data-wf="${wfId}" value="${est}" placeholder="分" title="计划时长（分钟）">
      <select class="today-slot-sel" data-slot="${n.id}" data-wf="${wfId}" title="钉到时段（When）">${slotOpts}</select>
    </div>
    <div class="today-acts">
      ${opts.micro !== false ? `<button type="button" class="gf-btn gf-btn--sm" data-micro="${n.id}" data-wf="${wfId}" title="5分钟微动作">🫳</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm${n.ifThen ? ' woop-on' : ''}" data-woop="${n.id}" data-wf="${wfId}" title="障碍预案（执行意图：如果…就…）">🛡</button>
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'waiting' ? ' wait-on' : ''}" data-wait="${n.id}" data-wf="${wfId}" title="标记等待中（退出今日竞选，写清在等什么）">⏳</button>
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'blocked' ? ' block-on' : ''}" data-block="${n.id}" data-wf="${wfId}" title="标记阻塞（退出今日竞选，写清被什么卡住）">🚫</button>
      ${isWfTop || opts.pomo ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-pomo="${n.id}" data-wf="${wfId}">🍅</button>` : ''}
    </div>
    <div class="today-ifthen" data-ifthenbox="${n.id}" style="display:${n.ifThen ? 'flex' : 'none'}">
      <span class="ti-shield">🛡</span>
      <input class="ti-input" data-ifthen="${n.id}" data-wf="${wfId}" value="${esc(n.ifThen || '')}" placeholder="如果[障碍]，我就[应对] · 回车保存">
    </div>
  </div>`;
}
function bindTodayPanel(root) {
  if (!root) return;
  root.querySelectorAll('input[data-done]').forEach(cb => {
    cb.onchange = () => { setNodeDoneInWorkflow(cb.dataset.wf, cb.dataset.done, cb.checked); afterChange(); };
  });
  root.querySelectorAll('input[data-remind]').forEach(inp => {
    inp.onchange = () => { setNodeRemind(inp.dataset.wf, inp.dataset.remind, inp.value); tickReminders(); };
  });
  root.querySelectorAll('input[data-est]').forEach(inp => {
    inp.onchange = () => {
      const n = nodeInWorkflow(inp.dataset.wf, inp.dataset.est);
      if (!n) return;
      n.estimateMinutes = inp.value ? clamp(+inp.value, 1, 999) : null;
      save(); afterChange();
    };
  });
  root.querySelectorAll('select[data-slot]').forEach(sel => {
    sel.onchange = () => {
      const n = nodeInWorkflow(sel.dataset.wf, sel.dataset.slot);
      if (!n) return;
      n.slot = sel.value || '';
      if (n.slot && !n.scale) n.scale = 'day';
      save(); afterChange();
    };
  });
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
  root.querySelectorAll('[data-pomo]').forEach(b => b.onclick = () => {
    if (b.dataset.wf) state.pomo.wfId = b.dataset.wf;
    if (b.dataset.wf && b.dataset.wf !== state.activeWorkflowId) switchWorkflow(b.dataset.wf);
    state.topId = b.dataset.pomo;
    const w = workflowById(b.dataset.wf); if (w) w.topId = b.dataset.pomo;
    startPomo(25);
    save();
  });
  const setPark = (wfId, nodeId, status) => {
    const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
    if (n.status === status) { n.status = ''; n.waitNote = ''; }
    else {
      const hint = status === 'waiting' ? '在等什么？（如：等客户回复报价）' : '被什么卡住？（如：缺设计稿）';
      const note = prompt(hint + '\n留空 = 取消标记', n.waitNote || '');
      if (note === null) return;
      n.status = status; n.waitNote = note.trim();
    }
    save(); afterChange();
  };
  root.querySelectorAll('[data-wait]').forEach(b => b.onclick = () => setPark(b.dataset.wf, b.dataset.wait, 'waiting'));
  root.querySelectorAll('[data-block]').forEach(b => b.onclick = () => setPark(b.dataset.wf, b.dataset.block, 'blocked'));
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
function renderParkedStrip() {
  const box = document.getElementById('todayParked'); if (!box) return;
  const list = parkedEntries();
  if (!list.length) { box.innerHTML = ''; return; }
  const rows = list.map(ent => {
    const n = ent.node;
    const tag = isNodeBlocked(n) ? '🚫 阻塞' : '⏳ 等待';
    return `<div class="pk-row"><span class="pk-tag ${isNodeBlocked(n) ? 'blk' : 'wt'}">${tag}</span>
      <b>${esc(n.text.length > 22 ? n.text.slice(0, 22) + '…' : n.text)}</b>
      <span class="pk-note">${esc(n.waitNote || '（未注明原因）')}</span>
      <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-unpark="${n.id}" data-wf="${ent.wfId}" title="恢复参与今日竞选">↩ 解除</button></div>`;
  }).join('');
  box.innerHTML = `<div class="today-parked"><div class="pk-h">⏸ 已暂停 ${list.length} 项（等待/阻塞 —— 退出竞选，但别忘了催）</div>${rows}</div>`;
  box.querySelectorAll('[data-unpark]').forEach(b => b.onclick = () => {
    const n = nodeInWorkflow(b.dataset.wf, b.dataset.unpark);
    if (n) { n.status = ''; n.waitNote = ''; save(); afterChange(); }
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
  if (action === 'snooze') { it.snoozeUntil = Date.now() + 86400000; saveMeta(); afterChange(); return; }
  // task：变成叶子，插到目标树根下（scale=day）
  const targetWf = wfId || it.wfId || state.activeWorkflowId;
  if (!targetWf || !workflowById(targetWf)) { alert('请选择一个项目再变成任务'); return; }
  const w = workflowById(targetWf);
  const prevWf = state.activeWorkflowId;
  if (targetWf !== state.activeWorkflowId) switchWorkflow(targetWf);
  const root = state.nodes[0];
  if (!root) { alert('该项目还没有目标树，请先在「目标规划」解析一个目标'); if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  const node = appendActionLeaf(it.text, {
    deadline: it.deadline || '今天', deadlineDate: it.deadlineDate ? new Date(it.deadlineDate) : today0(),
    est: it.est || null, source: 'inbox',
  });
  if (!node) { if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  recomputeSchedule(state.nodes);
  flushActiveWorkflow();
  it.status = 'clarified'; it.clarifiedAt = Date.now(); it.wfId = targetWf;
  save(); saveMeta();
  if (targetWf !== prevWf) switchWorkflow(prevWf); else afterChange();
}
function renderInboxPanel() {
  const box = document.getElementById('inboxPanel'); if (!box) return;
  ensureScoreMeta();
  const pend = inboxPending();
  const someday = inboxItems().filter(i => i.status === 'someday').length;
  const wfOpts = (state.workflows || []).map(w => `<option value="${w.id}">${esc(w.name || '项目')}</option>`).join('');
  const rows = pend.slice(0, 6).map(it => {
    const dl = it.deadlineDate ? `<span class="ib-meta">⏱ ${esc(it.deadline || dateKey(new Date(it.deadlineDate)))}</span>` : '';
    const remind = it.remindAt ? `<span class="ib-meta">⏰ ${new Date(it.remindAt).getHours()}:${pad2(new Date(it.remindAt).getMinutes())}</span>` : '';
    return `<div class="ib-row" data-ib="${it.id}">
      <div class="ib-txt"><b>${esc(it.text)}</b>${dl}${remind}</div>
      <div class="ib-acts">
        <select class="gf-input gf-select ib-wf" data-ibwf="${it.id}" title="挂到哪个项目">${wfOpts}</select>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-ibtask="${it.id}" title="澄清：变成叶子任务，进今日">→任务</button>
        <button type="button" class="gf-btn gf-btn--sm" data-ibsomeday="${it.id}" title="以后再说（不丢，收进 someday）">☁</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ibsnooze="${it.id}" title="明天再看">💤</button>
        <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" data-ibtrash="${it.id}" title="丢掉">×</button>
      </div>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="inbox-bar">
      <div class="ib-head"><span class="ib-tt">📥 收件箱</span><span class="ib-cnt">${pend.length ? `待澄清 ${pend.length}` : '已清空'}${someday ? ` · ☁以后 ${someday}` : ''}</span></div>
      <div class="ib-input-row">
        <input class="gf-input ib-in" id="ibQuick" placeholder="先丢进来：如「给 Anna 回电话 明天下午3点」——之后澄清成任务/挂目标">
        <button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="ibAdd">捕获</button>
      </div>
      ${rows ? `<div class="ib-list">${rows}</div>` : ''}
    </div>`;
  const inp = box.querySelector('#ibQuick');
  const doAdd = () => {
    const v = (inp.value || '').trim(); if (!v) return;
    // 自然语言里的时间词 → 提醒；其余 → 期限
    let remindAt = null;
    const tm = v.match(/(今天|明天|后天)?\s*(上午|下午|晚上)?\s*(\d{1,2})[点时:：](\d{2})?/);
    if (tm) {
      const base = tm[1] === '明天' ? addDays(today0(), 1) : tm[1] === '后天' ? addDays(today0(), 2) : today0();
      let h = +tm[3];
      if ((tm[2] === '下午' || tm[2] === '晚上') && h < 12) h += 12;
      const d = new Date(base); d.setHours(h, +(tm[4] || 0), 0, 0);
      if (d.getTime() > Date.now()) remindAt = d.getTime();
    }
    addInbox(v, { remindAt });
    inp.value = '';
    renderInboxPanel();
  };
  box.querySelector('#ibAdd').onclick = doAdd;
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') doAdd(); };
  box.querySelectorAll('[data-ibtask]').forEach(b => b.onclick = () => {
    const sel = box.querySelector(`[data-ibwf="${b.dataset.ibtask}"]`);
    clarifyInbox(b.dataset.ibtask, 'task', sel ? sel.value : '');
  });
  box.querySelectorAll('[data-ibsomeday]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibsomeday, 'someday'));
  box.querySelectorAll('[data-ibsnooze]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibsnooze, 'snooze'));
  box.querySelectorAll('[data-ibtrash]').forEach(b => b.onclick = () => clarifyInbox(b.dataset.ibtrash, 'trash'));
}

function renderTodayAlarmBar() {
  const bar = document.getElementById('todayAlarmBar');
  if (!bar) return;
  ensureScoreMeta();
  const r = state.meta.ritual;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const tag = perm === 'granted' ? '通知已开启' : (perm === 'denied' ? '通知已关闭' : perm === 'unsupported' ? '不支持通知' : '可开启桌面提醒');
  bar.innerHTML = `<span class="today-alarm-st">${tag}</span>
    <label class="alarm-set" title="早上到点弹窗：制订 / 调整今日活动">🌅<input type="time" id="ritualMorning" value="${esc(r.morning || '')}"></label>
    <label class="alarm-set" title="晚上到点弹窗：自动评分与今日总结">🌙<input type="time" id="ritualEvening" value="${esc(r.evening || '')}"></label>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnEnableAlarm">🔔 开启提醒</button>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnMorningRitual" title="立即打开早间计划弹窗">☀ 晨计划</button>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnEveningRitual" title="立即打开晚间总结弹窗">🌙 晚总结</button>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="btnWeekPlan" title="本周大石头（周计划仪式）">🗓 周计划</button>`;
  const btn = document.getElementById('btnEnableAlarm');
  if (btn) btn.onclick = () => requestAlarmPermission().then(ok => { if (ok) renderTodayAlarmBar(); });
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
}
function renderTodayPanel() {
  const mit = document.getElementById('todayMit');
  const slots = document.getElementById('todaySlots');
  const micro = document.getElementById('todayMicro');
  const list = document.getElementById('todayChecklist');
  const cap = document.getElementById('todayCapacity');
  const hint = document.getElementById('todayHint');
  if (!mit || !list) return;
  ensureWorkflows();
  flushActiveWorkflow();
  const wfCount = state.workflows.filter(w => (w.nodes || []).length).length;
  if (!wfCount) {
    mit.innerHTML = '<div class="hint">先在各目标流中输入并解析，今日行动会汇总所有工作流的待行动。</div>';
    if (slots) slots.innerHTML = ''; if (micro) micro.innerHTML = ''; list.innerHTML = ''; if (cap) cap.innerHTML = '';
    renderTodayScore();
    renderTodayRocks();
    renderTodayStale();
    renderEnergyWidget();
    renderTimeAudit();
    renderInboxPanel();
    renderParkedStrip();
    renderTodayAlarmBar();
    renderBackupTip();
    renderBurnoutTip();
    renderOnboard();
    return;
  }
  const pool = todayAggregatedPool();
  const mitEntry = pool.find(x => x.isWfTop) || pool[0] || null;
  const d = dayPlanFeasibilityAll();
  if (cap) {
    const pct = Math.min(100, Math.round(d.est / d.cap * 100));
    cap.innerHTML = `<div class="day-capacity${d.over ? ' over' : ''}">
      <span>今日可做完性（${wfCount} 个工作流）</span><span class="dc-bar"><i style="width:${pct}%"></i></span>
      <span class="dc-num">预估 ${d.est} 分 · ${d.count} 项</span><span class="dc-tag">${d.over ? '超负荷' : '可承载'}</span>
    </div>`;
  }
  renderTodayScore();
  renderTodayRocks();
  renderTodayStale();
  renderEnergyWidget();
  renderTimeAudit();
  renderInboxPanel();
  renderBackupTip();
  renderBurnoutTip();
  renderOnboard();
  if (hint) hint.textContent = `📥 先捕获到收件箱 → 只做一件 MIT（可拖到精力高峰时段）→ 按时段执行 → 习惯打卡。⏳等待 / 🚫阻塞自动退出竞选。`;
  renderTodayAlarmBar();
  if (mitEntry) {
    const curve = energyCurve();
    const peakBucket = curve && curve.peak ? (ENERGY_BUCKETS.find(b => b[0] === curve.peak) || [])[2] : null;
    const peakSlots = peakBucket || [];
    const mitSlot = mitEntry.node.slot || '';
    const atPeak = peakSlots.includes(mitSlot);
    const peakHint = peakSlots.length
      ? `<div class="mit-energy${atPeak ? ' ok' : ''}" title="近 14 天精力曲线：把 MIT 拖到右侧高峰时段列，即钉到该时段">${atPeak ? '⚡ MIT 已在你的精力高峰时段' : `🔥 你的高峰在 ${(ENERGY_BUCKETS.find(b => b[0] === curve.peak) || ['', ''])[1]}——把 MIT 拖到右侧高亮时段`}</div>`
      : '';
    mit.innerHTML = `<div class="today-block-h">MIT · 各流最重要之一</div>${peakHint}` + todayRowHtml(mitEntry, { micro: true, pomo: true });
  } else mit.innerHTML = '<div class="hint">暂无 MIT</div>';
  if (slots) {
    const bySlot = {};
    pool.forEach(ent => {
      const n = ent.node;
      const k = n.slot || (n.scale === 'day' || n.recur ? 'h1' : '');
      if (!k) return;
      if (!bySlot[k]) bySlot[k] = [];
      bySlot[k].push(ent);
    });
    let sh = '<div class="today-block-h">按日时段（跨工作流）</div><div class="today-slot-grid">';
    DAY_SLOTS.filter(s => s[0]).forEach(([k, l]) => {
      const items = bySlot[k] || [];
      sh += `<div class="today-slot"><div class="today-slot-h">${l}</div><div class="today-slot-body">`;
      if (items.length) {
        items.slice(0, 4).forEach(ent => {
          const t = ent.node.text;
          const tag = ent.wfName ? ` · ${ent.wfName}` : '';
          sh += `<div class="today-slot-item">${esc(t.length > 18 ? t.slice(0, 18) + '…' : t)}<span class="muted">${esc(tag)}</span></div>`;
        });
      } else sh += `<span class="muted">—</span>`;
      sh += '</div></div>';
    });
    sh += '</div>';
    slots.innerHTML = sh;
  }
  const isHabitEnt = ent => !!(ent.node.recur || ent.node.role === 'habit');
  const mitId = mitEntry ? mitEntry.node.id : null;
  const taskPool = pool.filter(ent => !isHabitEnt(ent) && ent.node.id !== mitId);
  const habitPool = pool.filter(ent => isHabitEnt(ent) && ent.node.id !== mitId);
  if (slots) {
    const bySlot = {};
    taskPool.forEach(ent => {
      const k = ent.node.slot || 'unassigned';
      if (!bySlot[k]) bySlot[k] = [];
      bySlot[k].push(ent);
    });
    // 精力高峰时段集合：用于拖拽落点高亮
    const curve = energyCurve();
    const peakSlots = (curve && curve.peak) ? ((ENERGY_BUCKETS.find(b => b[0] === curve.peak) || [])[2] || []) : [];
    let sh = '<div class="today-block-h">执行清单 · 按时段 <span class="muted" style="font-weight:400">（可拖拽行到时段列，MIT 建议拖到 ⚡ 高峰）</span></div>';
    let any = false;
    DAY_SLOTS.filter(s => s[0]).forEach(([k, l]) => {
      const items = bySlot[k] || [];
      const isPeak = peakSlots.includes(k);
      if (!items.length && !isPeak) return;
      any = true;
      sh += `<div class="today-slot-group drop-slot${isPeak ? ' peak' : ''}" data-slotdrop="${k}"><div class="today-slot-h">🕐 ${l}${isPeak ? ' <span class="peak-tag">⚡ 精力高峰</span>' : ''}</div>` +
        (items.length ? items.map(ent => todayRowHtml(ent)).join('') : '<div class="slot-empty">拖到这里钉到该时段</div>') + '</div>';
    });
    const un = bySlot['unassigned'] || [];
    if (un.length) {
      any = true;
      sh += `<div class="today-slot-group drop-slot" data-slotdrop=""><div class="today-slot-h">📥 未排期（建议钉时段）</div>` +
        un.map(ent => todayRowHtml(ent)).join('') + '</div>';
    }
    if (!any) sh += '<div class="hint">暂无任务——从「目标规划」生成今日行动，或给叶子设「每日」尺度</div>';
    slots.innerHTML = sh;
    // 拖拽：行 → 时段列（钉 slot），精力高峰列高亮
    slots.querySelectorAll('.today-row[draggable]').forEach(row => {
      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: row.dataset.id, wf: row.dataset.wf }));
        e.dataTransfer.effectAllowed = 'move';
      });
    });
    slots.querySelectorAll('[data-slotdrop]').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('over');
        try {
          const d = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
          const n = nodeInWorkflow(d.wf, d.id); if (!n) return;
          n.slot = zone.dataset.slotdrop || '';
          if (n.slot && !n.scale) n.scale = 'day';
          save(); afterChange();
        } catch (err) { }
      });
    });
  }
  // 等待 / 阻塞区：可见但退出竞选（提醒在等什么）
  renderParkedStrip();
  if (micro) {
    micro.innerHTML = `<div class="today-block-h">习惯打卡 <span class="cnt">${habitPool.length}</span></div>` +
      (habitPool.length ? habitPool.map(ent => todayRowHtml(ent)).join('') : '<div class="hint">在规划向导里加【习惯】步骤，或在树里写「每天…」</div>');
  }
  const todayLog = ((state.meta && state.meta.executionLog) || {})[dateKey()] || null;
  const doneEntries = todayLog ? (todayLog.entries || []) : [];
  if (list) {
    list.innerHTML = `<div class="today-block-h">✅ 今日已完成 <span class="cnt">${doneEntries.length}</span></div>` +
      (doneEntries.length
        ? doneEntries.map(en => `<div class="today-done-row"><b>${esc(en.text)}</b>${en.wfName ? `<span class="today-meta wf-tag">${esc(en.wfName)}</span>` : ''}${en.act ? `<span class="today-meta">实计 ${en.act}′</span>` : ''}</div>`).join('')
        : '<div class="hint">完成清单中的事项后会记录在这里（本地执行记录）。</div>');
  }
  bindTodayPanel(mit); bindTodayPanel(micro); bindTodayPanel(slots); bindTodayPanel(list);
}
/* ============ 多视图导航（今日 / 规划 / 洞察） ============ */
const VIEWS = { today: '今日行动', plan: '目标规划', insights: '归纳洞察' };
function currentView() {
  try { const v = localStorage.getItem('goalflow.view'); if (VIEWS[v]) return v; } catch (e) { }
  return 'today';
}
function switchView(name, opts) {
  if (!VIEWS[name]) name = 'today';
  document.querySelectorAll('.main-scroll .view').forEach(v => v.classList.toggle('on', v.dataset.view === name));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === name));
  const crumb = document.getElementById('crumbSection'); if (crumb) crumb.textContent = VIEWS[name];
  try { localStorage.setItem('goalflow.view', name); } catch (e) { }
  const ms = document.querySelector('.main-scroll'); if (ms) ms.scrollTop = 0;
  if (!opts || !opts.silent) { try { history.replaceState(null, '', '#/' + name); } catch (e) { } }
  if (name === 'insights') {
    // 隐藏状态下渲染的 SVG 重新绘制一次，保证尺寸正确
    requestAnimationFrame(() => { try { renderCanvas(); renderQuadrant(); } catch (e) { } });
  }
}
function scrollToToday() { switchView('today'); }

/* ============ 聚焦清单（按尺度过滤） ============ */
function renderFocus() {
  const box = document.getElementById('todayFocus');
  let items = state.nodes.filter(n => n.parentId && !n.done);
  if (state.scale !== 'all') items = items.filter(n => n.scale === state.scale);
  const vis = state.nodes.length ? buildView(state.nodes, state.scale) : [];
  const top3 = pickRanked(vis, 3);
  const now = items.filter(n => n.im >= 4 && n.ur >= 4).sort((a, b) => focusScore(b) - focusScore(a));
  const core = items.filter(n => n.im >= 4 && n.ur < 4).sort((a, b) => focusScore(b) - focusScore(a));
  const li = (n, rank) => {
    const dl = n.deadline ? (n.overdue ? `<span class="dl">⏰ 逾期${-n.daysLeft}天</span>` : `<span class="dl">⏱ ${esc(n.deadline)}·剩${n.daysLeft}天</span>`) : '';
    const slot = n.slot ? `<span class="dl">🕐 ${esc((DAY_SLOTS.find(s => s[0] === n.slot) || ['', ''])[1])}</span>` : '';
    const est = n.estimateMinutes != null ? `<span class="dl">⏳ ${n.estimateMinutes}分</span>` : '';
    const act = n.actualMinutes != null ? `<span class="dl">✓ ${n.actualMinutes}分</span>` : '';
    const rk = rank != null ? `<span class="dl">#${rank}</span>` : '';
    return `<div class="fitem ${n.overdue ? 'overdue' : ''}">${rk}${esc(n.text)}${dl}${slot}${est}${act}</div>`;
  };
  const sc = state.scale === 'all' ? '全部' : (SCALE_LABEL[state.scale] + '重点');
  const top3Html = top3.length ? `<div class="fgroup top3"><h3>★ 可完成焦点 Top ${top3.length}<span class="cnt">算法排序 · 不含 Backlog</span></h3>${top3.map((n, i) => li(n, i + 1)).join('')}</div>` : '';
  const lanes = backlogLanes();
  const lane = arr => arr.length ? arr.map(n => li(n)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>';
  box.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">当前视图：${sc}${state.scale === 'all' ? '（含各尺度）' : ''}</div>
    ${top3Html}
    <div class="fgroup now"><h3>🔴 立即做（重要且紧急）<span class="cnt">${now.length} 项</span></h3>${now.length ? now.map(n => li(n)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup core"><h3>🔵 核心投入（重要不紧急）<span class="cnt">${core.length} 项</span></h3>${core.length ? core.map(n => li(n)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup backlog lw"><h3>🌊 上周未完成 Backlog<span class="cnt">${lanes.lastWeek.length} 项</span></h3>${lane(lanes.lastWeek)}</div>
    <div class="fgroup backlog nm"><h3>🔭 下月预告<span class="cnt">${lanes.nextMonth.length} 项</span></h3>${lane(lanes.nextMonth)}</div>`;
}

/* ============ 内联树编辑（Planner 式维护） ============ */
function deleteNode(id) {
  const root = state.nodes[0];
  if (!root || id === root.id) return;
  // v6.3 撤销：删前快照（当前流 nodes + topId）
  const snapNodes = JSON.parse(JSON.stringify(state.nodes));
  const snapTop = state.topId;
  const target = state.nodes.find(n => n.id === id);
  const drop = new Set();
  (function w(nid) { drop.add(nid); state.nodes.filter(x => x.parentId === nid).forEach(c => w(c.id)); })(id);
  state.nodes = state.nodes.filter(n => !drop.has(n.id));
  if (drop.has(state.topId)) state.topId = null;
  recomputeSchedule(state.nodes); save(); afterChange();
  showUndoToast(`已删除「${esc((target && target.text || '').slice(0, 14))}」及其子树（${drop.size} 个节点）`, () => {
    state.nodes = snapNodes; state.topId = snapTop;
    recomputeSchedule(state.nodes); save(); afterChange();
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
    box.innerHTML = '<div class="hint">解析后在此维护，无需重新粘贴全文。</div>';
    return;
  }
  getCachedTree(state.nodes);
  ensureAllEstimates();
  box.innerHTML = '';
  treeOrder(state.nodes).forEach(n => {
    const isLeaf = n.parentId && n._children.length === 0;
    const row = document.createElement('div');
    row.className = 'trow' + (n.id === state.topId ? ' trow-top' : '');
    row.style.paddingLeft = (n.depth * 12 + 6) + 'px';
    const txt = document.createElement('input');
    txt.className = 'gf-input trow-txt'; txt.value = n.text; txt.dataset.id = n.id;
    txt.title = n.text;
    const meta = document.createElement('span');
    meta.className = 'trow-meta'; meta.textContent = isLeaf ? '叶' : '枝';
    row.appendChild(txt); row.appendChild(meta);
    // 重要 / 紧急：手动调整（_manualIm/_manualUr），不被文本重推断覆盖
    const imInp = document.createElement('input');
    imInp.type = 'number'; imInp.min = '1'; imInp.max = '5'; imInp.className = 'trow-im';
    imInp.value = n.im; imInp.title = '重要度（1-5，手动后文本推断不再覆盖）'; imInp.dataset.id = n.id;
    const urInp = document.createElement('input');
    urInp.type = 'number'; urInp.min = '1'; urInp.max = '5'; urInp.className = 'trow-ur';
    urInp.value = n.ur; urInp.title = '紧急度（1-5，手动后文本推断不再覆盖）'; urInp.dataset.id = n.id;
    row.appendChild(imInp); row.appendChild(urInp);
    if (isLeaf) {
      const est = document.createElement('input');
      est.type = 'number'; est.min = '0'; est.step = '5'; est.className = 'trow-est';
      est.value = n.estimateMinutes ?? ''; est.placeholder = '分'; est.title = '预估时长'; est.dataset.id = n.id;
      const act = document.createElement('input');
      act.type = 'number'; act.min = '0'; act.step = '5'; act.className = 'trow-act';
      act.value = n.actualMinutes ?? ''; act.placeholder = '实'; act.title = '实际时长'; act.dataset.id = n.id;
      row.appendChild(est); row.appendChild(act);
      const done = document.createElement('label');
      done.className = 'trow-done';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!n.done; cb.dataset.id = n.id;
      done.appendChild(cb); done.appendChild(document.createTextNode('✓'));
      row.appendChild(done);
    }
    const child = document.createElement('button');
    child.type = 'button'; child.className = 'gf-btn gf-btn--sm'; child.textContent = '+子'; child.dataset.act = 'child'; child.dataset.id = n.id;
    row.appendChild(child);
    if (n.parentId) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'gf-btn gf-btn--sm gf-btn--ghost'; del.textContent = '×'; del.dataset.act = 'del'; del.dataset.id = n.id;
      row.appendChild(del);
    }
    box.appendChild(row);
  });
  // 拖拽换父：行 → 另一行（挂为其子节点）
  box.querySelectorAll('.trow').forEach(row => {
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      const id = row.querySelector('.trow-txt') && row.querySelector('.trow-txt').dataset.id;
      if (id) e.dataTransfer.setData('text/plain', id);
    });
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drop-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', e => {
      e.preventDefault(); row.classList.remove('drop-target');
      const dragId = e.dataTransfer.getData('text/plain');
      const targetId = row.querySelector('.trow-txt') && row.querySelector('.trow-txt').dataset.id;
      if (!dragId || !targetId || dragId === targetId) return;
      const dragN = byId(dragId), targetN = byId(targetId);
      if (!dragN || !targetN) return;
      // 防环：不能把祖先挂到后代下
      let anc = targetN;
      while (anc) { if (anc.id === dragId) { alert('不能挂到自己的子树下'); return; } anc = anc.parentId ? byId(anc.parentId) : null; }
      if (!confirm(`把「${dragN.text}」挂到「${targetN.text}」下？`)) return;
      dragN.parentId = targetN.id;
      if (dragN.scale == null) dragN.scale = targetN.scale;
      getCachedTree(state.nodes);
      save(); afterChange();
    });
  });
  if (hint) hint.textContent = `共 ${state.nodes.length} 节点 · 叶子进度见顶栏（仅叶计完成）· 拖拽行可换父`;
  box.querySelectorAll('.trow-txt').forEach(inp => {
    inp.onchange = () => { const n = byId(inp.dataset.id); if (!n) return; n.text = inp.value.trim() || n.text; applySuggestions(n, n.text); recomputeSchedule(state.nodes); save(); afterChange(); };
  });
  box.querySelectorAll('.trow-im,.trow-ur').forEach(inp => {
    inp.onchange = () => {
      const n = byId(inp.dataset.id); if (!n) return;
      if (inp.classList.contains('trow-im')) { n.im = clamp(+inp.value || 3, 1, 5); n._manualIm = true; }
      else { n.ur = clamp(+inp.value || 3, 1, 5); n._manualUr = true; }
      save(); afterChange();
    };
  });
  box.querySelectorAll('.trow-est').forEach(inp => {
    inp.onchange = () => { const n = byId(inp.dataset.id); if (!n) return; n.estimateMinutes = inp.value ? clamp(+inp.value, 1, 999) : null; save(); afterChange(); };
  });
  box.querySelectorAll('.trow-act').forEach(inp => {
    inp.onchange = () => { const n = byId(inp.dataset.id); if (!n) return; n.actualMinutes = inp.value ? clamp(+inp.value, 0, 9999) : null; save(); afterChange(); };
  });
  box.querySelectorAll('.trow-done input').forEach(cb => {
    cb.onchange = () => { const n = byId(cb.dataset.id); if (!n) return; setNodeDone(n, cb.checked); save(); afterChange(); };
  });
  box.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'child') addTreeChild(id);
      else if (btn.dataset.act === 'del' && confirm('删除该节点及其子树？')) deleteNode(id);
    };
  });
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
  if (!state.nodes.length) { box.innerHTML = '<div class="smart-empty">还没有目标。先粘贴你的计划，或点「载入示例」。</div>'; return; }
  const weak = state.nodes.filter(n => !smartEval(n).smart && n.parentId);
  if (!weak.length) { box.innerHTML = '<div class="smart-empty">✅ 当前所有目标都够 SMART（具体 / 可衡量 / 有期限）。如需挑战更高标准，可点任意目标行的「🤖 对话拆解」进一步细化。</div>'; return; }
  box.innerHTML = '';
  weak.forEach(n => {
    const ev = smartEval(n);
    const item = document.createElement('div'); item.className = 'smart-item';
    item.innerHTML = `<div class="si-tt"><span class="dot" style="background:${category(n.im, n.ur).color}"></span>${esc(n.text.slice(0, 30))}</div>
      <div class="si-gaps">⚠ ${ev.gaps.join('；')}</div>
      <div class="si-btns">
        <button class="${BTN.aiSm || 'gf-btn gf-btn--ai gf-btn--sm'}" data-smart="${n.id}">🤖 对话拆解</button>
        <button class="${BTN.sm || 'gf-btn gf-btn--sm'}" data-decomp="${n.id}">⚡ 一键拆解</button>
      </div>`;
    box.appendChild(item);
  });
  box.querySelectorAll('button[data-smart]').forEach(b => b.onclick = () => openSmart(b.dataset.smart));
  box.querySelectorAll('button[data-decomp]').forEach(b => b.onclick = () => { const id = b.dataset.decomp; quickDecompose(id); });
}
function quickDecompose(id) {
  const n = byId(id); if (!n) return;
  const sugg = decomposeSuggestions(n);
  insertChildren(id, sugg);
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
    document.getElementById('mAI').onclick = () => aiDecompose(id, n);
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
async function aiDecompose(id, n) {
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
function saveMeta() { try { localStorage.setItem(LS_META, JSON.stringify(state.meta || {})); } catch (e) { } }
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
}
function workflowsPayload() {
  ensureWorkflows();
  return {
    activeWorkflowId: state.activeWorkflowId,
    workflows: state.workflows.map(w => ({
      id: w.id, name: w.name || '项目', topId: w.topId || null,
      tags: w.tags || [], startDate: w.startDate || '', endDate: w.endDate || '', description: w.description || '',
      color: w.color || '',
      nodes: serializeNodes(w.nodes || []),
    })),
  };
}
function save() {
  try {
    flushActiveWorkflow();
    localStorage.setItem(LS_KEY, JSON.stringify(serializeNodes(state.nodes)));
    const payload = JSON.stringify(workflowsPayload());
    localStorage.setItem(LS_WORKFLOWS, payload);
    // 冗余镜像：主键损坏/被清空时仍可恢复
    try { localStorage.setItem(LS_WORKFLOWS_BAK, payload); } catch (e) { }
    if (state.meta) state.meta.lastSavedAt = Date.now();
    saveMeta();
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
        topId: w.topId || null,
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
function exportICS() {
  getCachedTree(state.nodes);
  const leaves = state.nodes.filter(n => n.parentId && n._children.length === 0 && n.deadlineDate);
  if (!leaves.length) { alert('没有带期限日期的叶子任务。请在任务里写「周五前 / 3月15日」等，或对叶子设 deadline。'); return; }
  const now = icsStamp(new Date());
  let body = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GoalFlow//ZH\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  leaves.forEach(n => {
    const dt = icsStamp(n.deadlineDate).slice(0, 8);
    body += `BEGIN:VEVENT\r\nUID:${n.id}@goalflow.local\r\nDTSTAMP:${now}\r\nDTSTART;VALUE=DATE:${dt}\r\nSUMMARY:${icsEscape(n.text)}\r\nDESCRIPTION:GoalFlow 叶子 · 重要${n.im} 紧急${n.ur}\r\nEND:VEVENT\r\n`;
  });
  body += 'END:VCALENDAR\r\n';
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'goalflow-deadlines-' + new Date().toISOString().slice(0, 10) + '.ics';
  a.click();
}
function exportBackup() {
  flushActiveWorkflow();
  ensureWorkflows();
  const payload = {
    app: 'goalflow', version: 10, exportedAt: new Date().toISOString(),
    viewMode: state.viewMode,
    activeWorkflowId: state.activeWorkflowId,
    workflows: state.workflows.map(w => ({
      id: w.id, name: w.name, topId: w.topId || null,
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
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let nodes = data;
      if (data && data.nodes) nodes = data.nodes;
      if (!Array.isArray(nodes) || !nodes.length) { alert('未找到有效目标数据'); return; }
      if (!confirm('恢复将覆盖当前全部目标流，是否继续？')) return;
      if (data.workflows && Array.isArray(data.workflows) && data.workflows.length) {
        state.workflows = data.workflows.map(w => {
          const wf = {
            id: w.id || newWorkflowId(),
            name: w.name || '目标流',
            topId: w.topId || null,
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
      save(); afterChange();
      const wc = state.workflows.length;
      alert('已恢复 ' + wc + ' 个工作流 · 当前流 ' + state.nodes.length + ' 条节点');
    } catch (e) { alert('JSON 解析失败'); }
  };
  reader.readAsText(file);
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
  const okrHtml = (st.okrNodes && st.okrNodes.length) ? `<div class="wr-bars-title">OKR · 习惯进度</div><ul class="wr-okr">${st.okrNodes.slice(0, 8).map(n => {
    const mp = metricProgress(n); if (!mp) return '';
    const pace = paceStatus(n);
    const conf = n.role === 'KR' && n.conf ? ` · 信心 ${n.conf}/5${n.confNote ? '（' + esc(n.confNote) + '）' : ''}` : '';
    return `<li>${esc(n.text)} · ${mp.done}/${mp.tgt}（${mp.pct}%）${pace ? ` · 节奏 Δ${pace.ahead >= 0 ? '+' : ''}${pace.ahead}` : ''}${conf}</li>`;
  }).join('')}</ul>` : '';
  // 月/季回顾：「目标前进了没有」——与叶子完成率分开看
  const movedHtml = (cycle !== 'week' && st.okrNodes && st.okrNodes.length) ? `
    <div class="wr-bars-title">🎯 目标前进了没有（${pr.label}）</div>
    <div class="wr-moved">
      ${st.progressed.length ? `<div class="wr-moved-sec ok">✅ 有前进 ${st.progressed.length} 项<ul>${st.progressed.slice(0, 6).map(n => `<li>${esc(n.text)}${n.role === 'KR' && n.conf ? ` · 信心${n.conf}/5` : ''}</li>`).join('')}</ul></div>` : ''}
      ${st.stalled.length ? `<div class="wr-moved-sec warn">⏸ 还在原地 ${st.stalled.length} 项<ul>${st.stalled.slice(0, 6).map(n => `<li>${esc(n.text)} <button type="button" class="gf-btn gf-btn--sm" data-mvact="${n.id}" title="给这个目标补一条下周行动（进晨计划待确认）">→ 补行动</button></li>`).join('')}</ul></div>` : ''}
      ${!st.progressed.length && !st.stalled.length ? '<div class="wr-empty">该周期没有可判定的目标。</div>' : ''}
    </div>` : '';
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
      ${okrHtml}
      ${movedHtml}
      ${st.estSum ? `<div class="wr-h" style="margin:8px 0">预估 ${st.estSum} 分 · 实计 ${st.actSum} 分</div>` : ''}
      <div class="wr-bars-title">完成 · 四象限</div>
      ${st.total ? weekStatsBarsHtml(st) : '<div class="wr-empty">该周期尚无完成记录。</div>'}
      ${st.completedTexts.length ? `<div class="wr-done-list"><ul>${st.completedTexts.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
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
  // 月/季回顾：给停滞目标补行动（进晨计划待确认，PDCA Act）
  overlay.querySelectorAll('[data-mvact]').forEach(b => b.onclick = () => {
    const n = byId(b.dataset.mvact); if (!n) return;
    const v = prompt(`给「${n.text.slice(0, 24)}」补一条下周行动：`, '推进：' + n.text.slice(0, 20));
    if (v === null || !v.trim()) return;
    ensureScoreMeta();
    state.meta.pendingActions.push({ id: 'pa' + Date.now() + Math.floor(Math.random() * 1000), text: v.trim(), fromCycle: cycle, period: pr.key, status: 'pending', createdAt: Date.now(), wfId: state.activeWorkflowId || '' });
    saveMeta();
    b.textContent = '✓ 已加入晨计划'; b.disabled = true;
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
    alert(reviewCycleLabel(cycle) + '已保存（本机）' + (lines.length ? ` · ${lines.length} 条调整行动已加入晨计划待确认` : ''));
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
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yEntries = (state.meta.scoreLog[dateKey(yd)] || { entries: [] }).entries;
    const yTotal = yEntries.reduce((a, e) => a + (e.score || 0), 0);
    const pool = todayAggregatedPool();
    let mitEntry = pool.find(x => x.isWfTop) || pool[0] || null;
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
    const listHtml = pool.slice(0, 6).map(ent => {
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
    overlay.innerHTML =`<div class="modal modal-wide">
      <div class="modal-head"><div class="mh-ic">🌅</div>
        <div><div class="mh-tt">早安 · 制订今日计划</div>
        <div class="mh-sub">昨日总评分 ${yTotal || '—'} · 今日已收敛 ${pool.length} 项 · 预估 ${d.est}′ / 容量 ${d.cap}′${d.over ? '（超负荷，建议删减）' : ''}</div></div>
        <span class="mh-x" id="rtClose">×</span></div>
      <div class="rt-body">
        ${hasPlan ? '' : '<div class="rt-weekplan-tip">本周还没排大石头 <button type="button" class="gf-btn gf-btn--sm" id="rtWeekPlan">🗓 先排本周大石头</button></div>'}
        ${mitEntry ? `<div class="rt-mit${preMit ? ' pre' : ''}">${preMit ? '<span class="rt-pre-tag">🌙 昨晚预选</span>' : ''}今日 MIT：<b>${esc(mitEntry.node.text)}</b>${mitEntry.wfName ? `<span class="rt-m"> · ${esc(mitEntry.wfName)}</span>` : ''}${preMit ? '<span class="rt-mit-acts"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="rtMitKeep">✓ 就是它</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="rtMitSwap">换一个</button></span>' : ''}</div>` : '<div class="rt-mit">还没有 MIT——先解析目标或载入示例。</div>'}
        ${ifthenHtml}
        ${staleHtml}
        <div class="rt-list">${listHtml || '<div class="hint">今日清单为空，可先给任务加「今天」或钉时段。</div>'}</div>
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
      if (n && inp && inp.value.trim()) { n.ifThen = inp.value.trim(); save(); }
      openRitualModal('morning');
    };
    overlay.querySelectorAll('[data-stale-act]').forEach(b => b.onclick = () => {
      activateStale(b.dataset.wf, b.dataset.staleAct);
      openRitualModal('morning');
    });
    overlay.querySelectorAll('[data-adopt]').forEach(b => b.onclick = () => { adoptPendingAction(b.dataset.adopt); openRitualModal('morning'); });
    overlay.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => {
      const pa = (state.meta.pendingActions || []).find(a => a.id === b.dataset.skip);
      if (pa) { pa.status = 'skipped'; saveMeta(); }
      openRitualModal('morning');
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
    const dispoRows = undone.slice(0, 6).map(ent => {
      const n = ent.node;
      const k = dk + '|' + ent.wfId + '|' + n.id;
      const cur = (state.meta.eveningDispo || {})[k] || '';
      return `<div class="rt-row dispo" data-dk="${k}" data-wf="${ent.wfId}" data-node="${n.id}">
        <span class="rt-t">${esc(n.text)}</span>
        <span class="rt-dispo">
          <button type="button" class="gf-btn gf-btn--sm${cur === 'continue' ? ' gf-btn--primary' : ''}" data-dispo="continue" title="明天继续（排到明天）">继续</button>
          <button type="button" class="gf-btn gf-btn--sm${cur === 'defer' ? ' gf-btn--primary' : ''}" data-dispo="defer" title="改期（设个新期限）">改期</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost${cur === 'drop' ? ' gf-btn--primary' : ''}" data-dispo="drop" title="放弃（标记不再做，从树里勾掉）">放弃</button>
        </span>
      </div>`;
    }).join('');
    overlay.innerHTML =`<div class="modal modal-wide">
      <div class="modal-head"><div class="mh-ic">🌙</div>
        <div><div class="mh-tt">晚安 · 今日总结</div>
        <div class="mh-sub">完成 ${ts.count} 项 · 🍅 ${ts.pomos} 个 · 专注 ${ts.focusMin}′ · 未完成 ${undone.length} 项（逐条处置）</div></div>
        <span class="mh-x" id="rtClose">×</span></div>
      <div class="rt-body">
        <div class="rt-total"><span>今日总评分</span><b>${ts.total}</b><i class="ts-grade">${ts.grade}</i></div>
        <div class="rt-list">${rows || '<div class="hint">今天还没有评分记录——明天从 MIT 开始，完成叶子或番茄钟即可自动评分。</div>'}</div>
        ${undone.length ? `<div class="rt-dispo-h">🧹 未完成 ${undone.length} 项 · 逐条处置（明天继续 / 改期 / 放弃）</div><div class="rt-list dispo-list">${dispoRows}</div>` : '<div class="hint">今日清单全部完成 🎉</div>'}
        ${goodHtml}
        ${mitPickHtml}
        <textarea class="rt-note" id="rtNote" placeholder="一句话总结今天（可选，仅存本机）">${esc(note)}</textarea>
      </div>
      <div class="modal-foot">
        <button type="button" class="gf-btn gf-btn--primary" id="rtSave">保存并休息</button>
      </div></div>`;
    overlay.classList.add('show');
    overlay.querySelector('#rtClose').onclick = closeRitualModal;
    // 处置动作
    overlay.querySelectorAll('[data-dispo]').forEach(btn => btn.onclick = () => {
      const row = btn.closest('.rt-row.dispo'); if (!row) return;
      const wfId = row.dataset.wf, nodeId = row.dataset.node, act = btn.dataset.dispo;
      const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
      ensureScoreMeta();
      const k = row.dataset.dk;
      if (!state.meta.eveningDispo) state.meta.eveningDispo = {};
      if (act === 'continue') {
        // 明天继续：期限改到明天、钉到上午
        const tmr = addDays(today0(), 1);
        n.deadline = '明天'; n.deadlineDate = tmr; n.daysLeft = 1; n.overdue = false;
        n.scale = 'day'; if (!n.slot) n.slot = 'h1';
        state.meta.eveningDispo[k] = 'continue';
      } else if (act === 'defer') {
        const v = prompt('改到哪天？（如：周五 / 3月15日 / 下周）', n.deadline || '下周');
        if (v === null) return;
        const dl = parseDeadline(v);
        if (!dl.date) { alert('没认出这个日期，试试「周五 / 3月15日 / 下周 / 月底」'); return; }
        n.deadline = dl.label; n.deadlineDate = dl.date; n.daysLeft = dl.daysLeft; n.overdue = dl.overdue;
        state.meta.eveningDispo[k] = 'defer';
      } else if (act === 'drop') {
        if (!confirm(`放弃「${n.text}」？它会从今日清单消失（标记完成态但记为放弃）。`)) return;
        n.done = true; n.doneAt = Date.now(); n.dropped = true;
        state.meta.eveningDispo[k] = 'drop';
      }
      save(); saveMeta();
      openRitualModal('evening');
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
        const ent = mitCands.find(x => x.node.id === pick.value);
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
  if (opts.deadlineDate) { node.deadlineDate = opts.deadlineDate; const dl = parseDeadline(opts.deadline || ''); node.daysLeft = dl.daysLeft; node.overdue = dl.overdue; }
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
  if (!root) { alert('请先在目标工作流解析一个目标，再采纳调整行动'); if (targetWf !== prevWf) switchWorkflow(prevWf); return; }
  appendActionLeaf(pa.text, { deadline: '今天', deadlineDate: today0(), source: 'review' });
  pa.status = 'adopted';
  recomputeSchedule(state.nodes);
  save(); saveMeta();
  if (targetWf !== prevWf) switchWorkflow(prevWf);
}

/* ============ 周计划仪式 · 本周大石头 ============ */
function weekPlanCandidates() {
  ensureWorkflows(); flushActiveWorkflow();
  const out = [];
  state.workflows.forEach(wf => {
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
    state.meta.weekPlans[wk] = { rocks: picks, savedAt: Date.now() };
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
function afterChange() {
  invalidateTreeCache();
  ensureWorkflows();
  ensureAllEstimates();
  renderWorkflowBar();
  renderHero(); renderQuadrant(); renderFocus(); renderRhythm(); renderSmart();
  renderTreeEditor(); renderProgress(); renderReviewBanner(); renderSidebar();
  renderMetricsStrip(); renderPlanShareStrip(); renderPomoBar(); renderTodayPanel();
  // 懒渲染：仅在 insights 视图可见时渲染重型画布
  if (currentView() === 'insights') { renderCanvas(); }
  tickReminders();
}
function doParse() {
  const raw = document.getElementById('input').value.trim();
  if (!raw) { alert('请先输入目标文本'); return; }
  ensureWorkflows();
  state.nodes = parseText(raw);
  flushActiveWorkflow();
  save(); afterChange();
  scrollToToday();
}
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
function clearAll() {
  if (!confirm('清空全部目标流与本地保存？')) return;
  // v6.3 撤销：清空前快照工作流
  const snap = JSON.parse(JSON.stringify({ workflows: state.workflows, activeWorkflowId: state.activeWorkflowId, nodes: state.nodes, topId: state.topId }));
  state.nodes = []; state.topId = null;
  const wf = { id: newWorkflowId(), name: '默认目标', nodes: [], topId: null, tags: [], startDate: '', endDate: '', description: '' };
  normalizeWorkflowMeta(wf);
  state.workflows = [wf];
  state.activeWorkflowId = state.workflows[0].id;
  const ta = document.getElementById('input'); if (ta) ta.value = '';
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_WORKFLOWS); } catch (e) { }
  save(); afterChange();
  showUndoToast('已清空全部目标流', () => {
    state.workflows = snap.workflows;
    state.activeWorkflowId = snap.activeWorkflowId;
    state.nodes = snap.nodes; state.topId = snap.topId;
    recomputeSchedule(state.nodes); save(); afterChange();
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
  state.workflows.forEach(w => {
    const open = wfExpanded(w.id);
    const active = w.id === state.activeWorkflowId;
    const nodes = w.nodes || [];
    let pct = '';
    if (nodes.length) {
      computeTree(nodes);
      const root = nodes.find(n => !n.parentId) || nodes[0];
      const k = wfLeafCounts(nodes, root);
      if (k.t) pct = Math.round(k.d / k.t * 100) + '%';
    }
    html += `<div class="wf-item${active ? ' active' : ''}${open ? ' open' : ''}">
      <div class="wf-row">
        <button type="button" class="wf-toggle" data-wft="${w.id}" title="${open ? '收起' : '展开'}（不影响当前编辑）">${open ? '▾' : '▸'}</button>
        <span class="wf-dot" style="background:${w.color || 'var(--accent)'}"></span>
        <button type="button" class="wf-name" data-wfs="${w.id}" title="设为当前编辑项目">${esc(w.name || '未命名')}
          <span class="wf-cnt">${nodes.length ? `${nodes.length}节点` : ''}${pct ? ` · ${pct}` : ''}</span></button>
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
  bar.innerHTML = html;
  bar.querySelectorAll('[data-wft]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleWfExpanded(b.dataset.wft); });
  bar.querySelectorAll('[data-wfs]').forEach(b => b.onclick = e => { e.preventDefault(); switchWorkflow(b.dataset.wfs); openProjectOverview(b.dataset.wfs); });
  bar.querySelectorAll('[data-wfe]').forEach(b => b.onclick = e => { e.stopPropagation(); openWorkflowMetaModal('edit', b.dataset.wfe); });
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
    initDemoSelect();
    // 主题切换（gf-tokens.js 提供 GoalFlowTheme.THEMES / setTheme；含旧缓存兜底）
    const thSel = document.getElementById('themeSelect');
    if (thSel) {
      thSel.value = GF.theme || 'linear';
      thSel.onchange = () => {
        if (GF.setTheme) { GF.setTheme(thSel.value); return; }
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
        if (GF.toggleMode) { GF.toggleMode(); return; }
        const next = (curMode === 'light') ? 'dark' : 'light';
        try { localStorage.setItem('goalflow.mode', next); } catch (e) { }
        location.reload();
      };
    }
    // 侧栏 / 图标轨的周回顾入口
    ['sideWeekReview', 'railWeekReview', 'mtabWeekReview'].forEach(id => {
      const b = document.getElementById(id); if (b) b.onclick = openWeekReview;
    });
    document.getElementById('btnParse').onclick = doParse;
    document.getElementById('btnDemo').onclick = loadDemo;
    document.getElementById('btnClear').onclick = clearAll;
    document.getElementById('btnExport').onclick = exportPNG;
    document.getElementById('focusMode').onchange = renderCanvas;
    document.getElementById('showNoise').onchange = renderCanvas;
    document.querySelectorAll('#viewbar button').forEach(b => {
      b.onclick = () => {
        state.viewMode = b.dataset.view || 'sankey';
        document.querySelectorAll('#viewbar button').forEach(x => x.classList.toggle('on', x === b));
        const sub = document.getElementById('canvasSub');
        const subs = {
          sankey: '条带宽度 = 重要性 · 颜色 = 紧急性 · 金色 = Top1',
          network: '节点 = 目标 · 连线 = 父子 · 半径 ≈ 重要度',
          kanban: '看板 = 四象限列 · 卡片可点选高亮',
          heatmap: '365 天叶子完成热力（越深越多）',
          mindmap: '脑图 = 目标树层次 · 百分比 = 子树/指标进度',
        };
        if (sub) sub.textContent = subs[state.viewMode] || subs.sankey;
        renderCanvas();
      };
    });
    const qw = document.getElementById('btnQuickWin');
    if (qw) qw.onclick = () => { state.quadQuickWin = !state.quadQuickWin; afterChange(); };
    document.querySelectorAll('#zoombar button').forEach(b => {
      b.onclick = () => {
        state.scale = b.dataset.scale;
        document.querySelectorAll('#zoombar button').forEach(x => x.classList.toggle('on', x === b));
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
    // URL 深链：#/today|plan|insights 切视图；#day|week|month|year|all 设尺度并跳到「归纳洞察」
    try {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      if (VIEWS[raw]) switchView(raw, { silent: true });
      else if (['all', 'day', 'week', 'month', 'year'].includes(raw)) { state.scale = raw; switchView('insights', { silent: true }); }
      else switchView(currentView(), { silent: true });
    } catch (e) { switchView('today', { silent: true }); }
    document.querySelectorAll('#zoombar button').forEach(b => b.classList.toggle('on', b.dataset.scale === state.scale));
    const keyIn = document.getElementById('llmKey');
    try { const k = localStorage.getItem(LLM_KEY_STORAGE); if (k) keyIn.value = k; } catch (e) { }
    document.getElementById('btnSaveKey').onclick = () => { try { localStorage.setItem(LLM_KEY_STORAGE, keyIn.value.trim()); LLM_KEY = keyIn.value.trim(); } catch (e) { } alert('已保存（仅存于本机浏览器）'); };
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
    if (load()) afterChange();
    else {
      // v6.3 新手引导：首次使用（无任何已存数据）自动载入示例 + 显示三步引导卡
      try { loadDemo(); switchView('today', { silent: true }); }
      catch (e) { afterChange(); }
    }
    window.goalflowStorageReport = storageReport;
    window.addEventListener('beforeunload', () => { try { save(); } catch (e) { } });
    setInterval(() => { tickReminders(); tickRitualAlarms(); }, 30000);
    // v6.2 移动端兜底：锁屏/切后台会挂起定时器，页面重新可见时立即补跑提醒与仪式闹钟（弹窗式闹钟）
    const wakeCheck = () => { try { tickReminders(); tickRitualAlarms(); if (state.pomo && state.pomo.active) renderPomoBar(); } catch (e) { } };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeCheck(); });
    window.addEventListener('pageshow', wakeCheck);
    window.addEventListener('focus', wakeCheck);
    tickReminders(); tickRitualAlarms();
    // Esc 关闭弹窗
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask[style*="display: block"], .modal-mask[style*="display:block"]').forEach(m => {
          m.style.display = 'none';
        });
      }
    });
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
    scoreDoneItem, scorePomoItem, scoreGrade, todayScore,
    timeAudit, weekPlanCandidates, adoptPendingAction,
    stagnationAlerts, stagnantDays, energyCurve, energyBucketNow, logEnergy,
    focusScoreParts, isNodeParked, isNodeWaiting, isNodeBlocked, habitStrength, habitWeekLog,
    addInbox, clarifyInbox, inboxPending, planVsActual,
    GoalFlowTheme: typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : GF,
  };
}