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
    bindRit('sideWeekReview', () => openWeekReview());
    bindRit('sideHistory', () => openHistory());   // v8.12 仪式历史
    bindRit('sideSettings', () => openSettingsModal()); // v8.20 基础设置
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
    const ss = document.getElementById('sideSettings'); if (ss) ss.onclick = openSettingsModal;
    fsInit();
    if (load()) {
      // v8.17: 启动即清已删项目的 planShare/capacity/打卡孤儿（不只在恢复备份时）
      try { reconcileRefsAfterRestore(); } catch (e) { }
      // v8.23: 隔夜重开也要换日清陈旧 time（不只靠 30s 轮询）
      try { rolloverTodayState(); } catch (e) { }
      afterChange();
    }
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
    focusScoreParts, pickNextTopId, scoreOfDoneEntry, splitStaleOverdue, overdueLeaves, projectKrNodes, isNodeParked, isNodeWaiting, isNodeBlocked, habitStrength, habitWeekLog,
    setNodeDeadline, convertDuePlanDate, habitRecurrence, habitTarget, habitDueToday, isRecurringTask, recurringTaskDueToday,
    resolveTimeConflicts, ensureTodayTimeResolved, todayExecutionPoolFor, backfillAISchedule,
    remindAtFromTime, ensureRemindDefaults, workflowColor, WF_COLORS,
    scrubStaleTodayTimes, stampNodeTimeDk, sortTodayExecEntries, toggleTodayListPin, todayListPinsFor, rolloverTodayState,
    modalHeadHtml, modalFootHtml, buildModalHtml, openModalMask, foldSectionHtml, emptyStateHtml, rowChrome, confirmModal,
    prefsSimpleMode, syncSimpleModeClass,
    addInbox, clarifyInbox, inboxPending, planVsActual,
    archiveWorkflow, unarchiveWorkflow, isWorkflowComplete, activeWorkflows, openCommitCard, togglePomoPause, quickCapture,
    globalCapacityHours, weekCapGlobal, weekPlanFeasibility, weekCap, dayCap, capacitySettings, winsTotalHours,
    clipWinsToGlobal, clipProjectWinsToGlobals, globalTimeWindows,
    __testState: () => state,
    GoalFlowTheme: typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : GF,
  };
}
