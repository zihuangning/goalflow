function prefsSimpleMode() {
  ensureScoreMeta();
  return state.meta.prefs.simpleMode !== false;
}
function syncSimpleModeClass() {
  ensureScoreMeta();
  document.body.classList.toggle('simple-mode', prefsSimpleMode());
}
function openSettingsModal() {
  if (!document.getElementById('settingsModal')) return;
  ensureScoreMeta();
  const c = capacitySettings();
  const otherUsage = getOtherProjectsTimeUsage();
  const profile = state.meta.profile || {};
  const prefs = state.meta.prefs || {};
  const curTheme = (typeof GF !== 'undefined' && GF.theme) || document.documentElement.dataset.theme || 'linear';
  const curMode = document.documentElement.dataset.mode || (typeof GF !== 'undefined' && GF.mode) || 'dark';
  const pomoDef = +prefs.pomoMinutes || 25;
  const hasKey = !!getLLMKey();
  const keyMasked = hasKey ? '••••' + String(getLLMKey()).slice(-4) : '';
  const wdWins = globalTimeWindows('workday');
  const weWins = globalTimeWindows('weekend');
  const wdHrs = winsTotalHours(wdWins);
  const weHrs = winsTotalHours(weWins);
  const hasGlobal = !!globalCapacityHours();

  const winRowHtml = (w) => `<div class="wfm-win-row">
    <input type="time" class="gf-input wfm-win-s" value="${esc(w.start || '')}" title="时段开始">
    <span class="wfm-win-sep">起</span>
    <input type="number" class="gf-input wfm-win-m" min="0.5" max="12" step="0.5" value="${w.mins ? (w.mins / 60) : ''}" placeholder="时长" title="小时">
    <span class="wfm-win-sep">小时</span>
    <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost wfm-win-del" title="删除">✕</button>
  </div>`;

  const capOverview = hasGlobal
    ? `<div class="usage-row"><span>全局每周（空闲时段汇总）</span><b>${fmtHours(weekCapGlobal())}h</b></div>
          <div class="usage-row"><span>其他项目占用</span><b>${fmtHours(otherUsage.weekTotal)}h</b></div>
          <div class="usage-row total"><span>本项目净可投入</span><b>${fmtHours(weekCap())}h</b>（工作日 ${c.workdayHours}h / 周末 ${c.weekendHours}h）</div>`
    : `<div class="usage-row"><span>本项目净值</span><b>${fmtHours(weekCap())}h</b>（工作日 ${c.workdayHours}h / 周末 ${c.weekendHours}h）</div>
          <div class="hint" style="margin-top:6px">尚未配置全局空闲时段——上方添加工作日/周末时段后，才会按「全局每周」校验全部项目承诺。</div>`;

  const body = `
      <div class="wfm-section">
        <h4>👤 个人资料</h4>
        <label class="wfm-row"><span>显示名 / 称呼</span><input id="setDisplayName" class="gf-input" maxlength="24" value="${esc(profile.displayName || '')}" placeholder="如：阿宁 · 出现在顶栏问候"></label>
      </div>

      <div class="wfm-section">
        <h4>🎨 外观</h4>
        <div class="wfm-2col">
          <label class="wfm-row"><span>界面主题</span>
            <select id="setTheme" class="gf-input gf-select">
              <option value="linear"${curTheme === 'linear' ? ' selected' : ''}>Linear</option>
              <option value="raycast"${curTheme === 'raycast' ? ' selected' : ''}>Raycast 玻璃</option>
              <option value="rpg"${curTheme === 'rpg' ? ' selected' : ''}>RPG 游戏</option>
            </select>
          </label>
          <label class="wfm-row"><span>明暗模式</span>
            <select id="setMode" class="gf-input gf-select">
              <option value="dark"${curMode === 'dark' ? ' selected' : ''}>深色</option>
              <option value="light"${curMode === 'light' ? ' selected' : ''}>浅色</option>
            </select>
          </label>
        </div>
      </div>

      <div class="wfm-section">
        <h4>🌍 我的空闲时段</h4>
        <div class="hint" style="margin-bottom:8px">人有空闲时段；项目可再收窄。容量与 AI 排期都按这些时段算；留空 = 不设全局限制。</div>
        <div class="wfm-wins">
          <div class="wfm-wins-h"><span>我的空闲时段 · 工作日 · 合计 ${wdHrs || 0}h</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setWdWinAdd">＋ 添加</button></div>
          <div id="setWdWinsList"></div>
        </div>
        <div class="wfm-wins" style="margin-top:10px">
          <div class="wfm-wins-h"><span>我的空闲时段 · 周末 · 合计 ${weHrs || 0}h</span><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setWeWinAdd">＋ 添加</button></div>
          <div id="setWeWinsList"></div>
        </div>
      </div>

      <div class="wfm-section">
        <h4>📊 容量一览</h4>
        <div class="set-usage-info">
          ${capOverview}
        </div>
      </div>

      <div class="wfm-section" id="setRitualSection">
        <h4>⏰ 仪式与通知</h4>
        <div class="wfm-2col">
          <label class="wfm-row"><span>🌅 晨计划</span><input id="setRitualMorning" type="time" class="gf-input" value="${esc((state.meta.ritual && state.meta.ritual.morning) || '')}"></label>
          <label class="wfm-row"><span>🌙 晚总结</span><input id="setRitualEvening" type="time" class="gf-input" value="${esc((state.meta.ritual && state.meta.ritual.evening) || '')}"></label>
        </div>
        <div class="set-fs-row" style="margin-top:8px">
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setNotifyPerm">🔔 开启系统通知</button>
          <span class="hint" id="setNotifyStatus"></span>
        </div>
      </div>

      <div class="wfm-section">
        <h4>今日界面</h4>
        <label class="set-fs-row" style="align-items:flex-start;gap:10px">
          <input type="checkbox" id="setSimpleMode"${prefsSimpleMode() ? ' checked' : ''}>
          <span>简洁模式：顶栏问候 + MIT + 执行清单；状态、需要关注、备选等次级区块默认隐藏（可在关闭后于设置里再开）</span>
        </label>
      </div>

      <div class="wfm-section">
        <h4>默认专注时长</h4>
        <div class="set-pomo-opts" id="setPomoOpts">
          ${[25, 50, 90].map(m => `<button type="button" class="gf-btn gf-btn--sm${pomoDef === m ? ' gf-btn--primary' : ' gf-btn--ghost'}" data-pomo="${m}">${m === 90 ? '🌊 90′ 深潜' : (m === 50 ? '🍅 50′ 长专注' : '🍅 25′ 标准')}</button>`).join('')}
        </div>
        <div class="hint" style="margin-top:6px">新建番茄钟时的默认值；MIT 行内下拉仍可临时改。</div>
      </div>

      <div class="wfm-section">
        <h4>🤖 AI（DeepSeek）</h4>
        <label class="wfm-row"><span>API Key</span><input id="setApiKey" type="password" class="gf-input" value="${esc(getLLMKey() || '')}" placeholder="${hasKey ? '已保存 ' + keyMasked + ' · 留空清除' : 'sk-... 仅存本机'}"></label>
        <div class="hint">用于目标拆解 / SMART 评估。密钥只存浏览器 localStorage，不出机。</div>
      </div>

      <div class="wfm-section">
        <h4>💾 数据安全 · 自动备份</h4>
        <div class="hint" style="margin-bottom:8px">滚动快照最近 ${SNAP_KEEP} 份（每小时一份）。绑定本地文件可交给 Syncthing / 网盘做多设备同步。</div>
        <div class="set-snap-list" id="setSnapList"></div>
        <div class="set-fs-row">
          <span class="set-fs-status" id="setFsStatus">检测中…</span>
          <button type="button" class="gf-btn gf-btn--sm" id="setFsBind">绑定文件</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setFsLoad">从文件恢复</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setFsUnbind">解除</button>
        </div>
        <div class="set-fs-row" style="margin-top:8px">
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setExportJson">💾 导出备份</button>
          <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="setImportJson">📂 恢复备份</button>
        </div>
      </div>

      <div class="wfm-section">
        <h4>ℹ️ 关于</h4>
        <div class="set-usage-info">
          <div class="usage-row"><span>版本</span><b id="setAboutVer">—</b></div>
          <div class="usage-row"><span>数据位置</span><b>本机 localStorage</b></div>
          <div class="usage-row"><span>项目数</span><b>${(state.workflows || []).length}</b></div>
        </div>
        <div class="set-shortcuts hint" style="margin-top:10px;line-height:1.7">
          <b>快捷键</b>（输入框/弹窗内无效，Esc 除外）<br>
          <code>1</code>/<code>2</code>/<code>3</code>/<code>4</code> 今日/规划/洞察/AI ·
          <code>t</code> 今日 · <code>c</code> 捕捉 ·
          <code>/</code> 或 <code>⌘/Ctrl+K</code> 搜索 ·
          <code>空格</code> 暂停番茄 · <code>Esc</code> 关弹窗
        </div>
      </div>`;

  const html = buildModalHtml({
    wide: true,
    icon: '⚙',
    title: '基础设置',
    sub: '资料 · 外观 · 空闲时段 · 仪式 · AI · 数据',
    closeId: 'setClose',
    bodyClass: 'wfm-body set-body',
    body,
    buttons: [
      { id: 'setSave', label: '保存设置', primary: true },
      { id: 'setCancel', label: '取消', ghost: true },
    ],
  });
  const api = openModalMask('settingsModal', html, { closeId: 'setClose' });
  if (!api) return;
  const overlay = api.overlay;
  const close = api.close;

  const bindWinList = (listEl, addBtn, init) => {
    const rebind = () => { listEl.querySelectorAll('.wfm-win-del').forEach(b => b.onclick = () => b.closest('.wfm-win-row').remove()); };
    listEl.innerHTML = (init || []).map(winRowHtml).join('');
    rebind();
    if (addBtn) addBtn.onclick = () => {
      listEl.insertAdjacentHTML('beforeend', winRowHtml({}));
      rebind();
      const inp = listEl.querySelector('.wfm-win-row:last-child .wfm-win-s');
      if (inp) inp.focus();
    };
  };
  const readWins = (listEl) => {
    const wins = [];
    let bad = false;
    listEl.querySelectorAll('.wfm-win-row').forEach(row => {
      const s = row.querySelector('.wfm-win-s').value;
      const hrs = parseFloat(row.querySelector('.wfm-win-m').value);
      if (!s && !hrs) return;
      if (!s || !(hrs > 0)) { bad = true; return; }
      wins.push({ start: s, mins: Math.round(hrs * 60) });
    });
    return bad ? null : wins;
  };
  bindWinList(overlay.querySelector('#setWdWinsList'), overlay.querySelector('#setWdWinAdd'), wdWins);
  bindWinList(overlay.querySelector('#setWeWinsList'), overlay.querySelector('#setWeWinAdd'), weWins);

  let pickedPomo = pomoDef;
  overlay.querySelectorAll('#setPomoOpts [data-pomo]').forEach(b => {
    b.onclick = () => {
      pickedPomo = +b.dataset.pomo;
      overlay.querySelectorAll('#setPomoOpts [data-pomo]').forEach(x => {
        x.classList.toggle('gf-btn--primary', +x.dataset.pomo === pickedPomo);
        x.classList.toggle('gf-btn--ghost', +x.dataset.pomo !== pickedPomo);
      });
    };
  });

  const nStatus = overlay.querySelector('#setNotifyStatus');
  const refreshNotify = () => {
    if (!nStatus) return;
    if (typeof Notification === 'undefined') { nStatus.textContent = '当前环境不支持系统通知'; return; }
    nStatus.textContent = Notification.permission === 'granted' ? '已开启' : (Notification.permission === 'denied' ? '已被浏览器拒绝' : '未开启');
  };
  refreshNotify();
  overlay.querySelector('#setNotifyPerm').onclick = () => { requestAlarmPermission().then(refreshNotify); };

  {
    const verEl = overlay.querySelector('#setAboutVer');
    if (verEl) {
      const src = ((document.querySelector('script[src*="app.js"]') || {}).src || '');
      const m = src.match(/[?&]v=([\d.]+)/);
      verEl.textContent = m ? ('v' + m[1]) : '—';
    }
  }
  overlay.querySelector('#setClose').onclick = close;
  overlay.querySelector('#setCancel').onclick = close;
  overlay.querySelector('#setSave').onclick = () => {
    if (!state.meta) state.meta = {};
    if (!state.meta.capacity) state.meta.capacity = {};
    ensureScoreMeta();
    if (!state.meta.prefs) state.meta.prefs = {};

    const wd = readWins(overlay.querySelector('#setWdWinsList'));
    const we = readWins(overlay.querySelector('#setWeWinsList'));
    if (wd === null || we === null) { alert('空闲时段：每行都要填「开始时间 + 时长」，不用的行请删掉'); return; }
    state.meta.capacity.globalWorkdayWins = wd;
    state.meta.capacity.globalWeekendWins = we;
    // 同步派生小时（旧代码路径 / 备份可读）
    state.meta.capacity.globalWorkdayHours = winsTotalHours(wd);
    state.meta.capacity.globalWeekendHours = winsTotalHours(we);

    const dn = overlay.querySelector('#setDisplayName');
    if (dn) state.meta.profile.displayName = String(dn.value || '').trim().slice(0, 24);
    const rm = overlay.querySelector('#setRitualMorning');
    const re = overlay.querySelector('#setRitualEvening');
    if (rm) state.meta.ritual.morning = rm.value || '';
    if (re) state.meta.ritual.evening = re.value || '';
    state.meta.prefs.pomoMinutes = pickedPomo;
    const sm = overlay.querySelector('#setSimpleMode');
    if (sm) state.meta.prefs.simpleMode = !!sm.checked;

    const keyIn = overlay.querySelector('#setApiKey');
    if (keyIn) {
      const key = String(keyIn.value || '').trim();
      LLM_KEY = key;
      try { if (key) localStorage.setItem(LLM_KEY_STORAGE, key); else localStorage.removeItem(LLM_KEY_STORAGE); } catch (e) { }
    }

    const th = overlay.querySelector('#setTheme');
    const md = overlay.querySelector('#setMode');
    if (th && GF.setTheme) GF.setTheme(th.value);
    else if (th) { try { localStorage.setItem('goalflow.theme', th.value); document.documentElement.dataset.theme = th.value; } catch (e) { } }
    if (md) {
      const want = md.value === 'light' ? 'light' : 'dark';
      const now = document.documentElement.dataset.mode || 'dark';
      if (want !== now) {
        if (GF.toggleMode) GF.toggleMode();
        else { try { localStorage.setItem('goalflow.mode', want); document.documentElement.dataset.mode = want; } catch (e) { } }
      }
    }

    saveMeta(); syncSimpleModeClass(); close(); afterChange();
    showToast('✅ 设置已保存');
  };

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
  const ex = overlay.querySelector('#setExportJson');
  if (ex) ex.onclick = () => { const b = document.getElementById('btnExportJson'); if (b) b.click(); };
  const im = overlay.querySelector('#setImportJson');
  if (im) im.onclick = () => { const b = document.getElementById('btnImportJson'); if (b) b.click(); };
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
  if (!document.getElementById('habitModal')) return;
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
  const hbBody = `
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
      <div class="wfm-actions">${taskMode && editing && editing.recurrence ? '<button type="button" class="gf-btn gf-btn--ghost" id="hbClearRec">清除循环</button>' : ''}<button type="button" class="gf-btn gf-btn--ghost" id="hbCancel">取消</button><button type="button" class="gf-btn gf-btn--primary" id="hbSave">${taskMode ? '保存周期' : (editing ? '保存' : '添加习惯')}</button></div>`;
  const html = buildModalHtml({
    icon: '🔁',
    title: ttl,
    sub,
    closeId: 'hbClose',
    bodyClass: 'wfm-body',
    body: hbBody,
    buttons: [],
  });
  const api = openModalMask('habitModal', html, { closeId: 'hbClose' });
  if (!api) return;
  const overlay = api.overlay;
  const close = api.close;
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
  $('hbCancel').onclick = close;
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
  // v8.14: ② 次重要行直接显示优先级分（用户反馈「看不到第二项的分数」），title 带分解明细
  // v8.15: 「算法分」→「优先级分」并写明用途——与「今日表现分」（完成累计）区分，避免同名异义
  const nextScoreMeta = opts.nextTop ? (() => {
    const fsp = focusScoreParts(n);
    const brk = fsp.parts.filter(p => p.pts !== 0 && !p.note).slice(0, 4).map(p => `${p.label} ${p.pts > 0 ? '+' : ''}${p.pts}`).join(' · ');
    return `<span class="today-meta next-top-score" title="② 优先级分：算法排序用，决定「谁先做的」——不是完成评价｜分解：${esc(brk)}">② 优先 ${fsp.total}</span>`;
  })() : '';
  const listPinned = !!opts.listPinned || isTodayListPinned(wfId, n.id);
  const rowCls = [
    'today-row',
    isWfTop ? 'is-top' : '',
    opts.nextTop ? 'next-top' : '',
    listPinned ? 'is-list-pinned' : '',
    habit ? 'is-habit' : '',
    isNodeParked(n) ? 'is-parked' : '',
    n._overflow ? 'is-overflow' : '',
    expanded ? 'expanded' : ''
  ].filter(Boolean).join(' ');
  const titleLine = `${listPinned ? '<i class="today-pfx pin-badge" title="今日置顶 · 仅影响今日清单顺序">📌</i>' : ''}${opts.nextTop ? '<i class="today-pfx next-top-badge" title="② 次重要 · 今日池算法排序仅次于 MIT，值得排进下一段专注">②</i>' : ''}${isWfTop ? '<i class="today-pfx" title="各流最重要">★</i>' : ''}${habit ? '<i class="today-pfx">🔁</i>' : ''}${isMicro ? '<i class="today-pfx">🫳</i>' : ''}<input class="today-txt-in" data-edit="${n.id}" data-wf="${wfId}" value="${esc(n.text)}" title="编辑文案 · 回车或失焦保存" aria-label="任务文案">`;
  const metaLine = `${nextScoreMeta}${wfName ? `<span class="today-meta wf-tag">${esc(wfName)}</span>` : ''}${timeVal ? `<span class="today-meta">🕐 ${esc(timeVal)}</span>` : ''}${recurMeta}${habit ? habitMeta : (streak ? `<span class="today-meta streak" title="习惯连续天数（执行记录驱动）">🔥 ${streak.cur}天</span>` : '')}${anchorMeta}${tagMeta}${n.daysLeft != null ? `<span class="today-meta meta-dleft">${n.overdue ? '逾期' : '剩'}${Math.abs(n.daysLeft)}天</span>` : ''}${waitMeta}${blockMeta}${overflowMeta}`;
  const moreInner = `<div class="today-timing">
      <label class="today-time-lbl" title="今日闹钟提醒">⏰ 提醒</label>
      <input type="time" class="today-remind" data-remind="${n.id}" data-wf="${wfId}" value="${remind}" title="到点弹通知提醒你（闹钟，可选）">
      <input type="number" class="today-est" min="1" max="999" step="5" data-est="${n.id}" data-wf="${wfId}" value="${est}" placeholder="分" title="计划时长（分钟）">
      <input type="time" class="today-time" data-time="${n.id}" data-wf="${wfId}" value="${timeVal}" title="计划几点开始做（今日按此排序，不会弹提醒）">
    </div>
    <div class="today-acts">
      ${opts.micro !== false ? `<button type="button" class="gf-btn gf-btn--sm" data-micro="${n.id}" data-wf="${wfId}" title="5分钟微动作">🫳 微动作</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm${n.ifThen ? ' woop-on' : ''}" data-woop="${n.id}" data-wf="${wfId}" title="障碍预案（执行意图：如果…就…）">🛡 预案</button>
      ${habit ? `<button type="button" class="gf-btn gf-btn--sm${n.anchor ? ' woop-on' : ''}" data-anchor="${n.id}" data-wf="${wfId}" title="触发线索（习惯叠加：在[既有行为]之后）">⚓ 线索</button>` : ''}
      ${habit ? `<button type="button" class="gf-btn gf-btn--sm" data-habitedit="${n.id}" data-wf="${wfId}" title="编辑习惯：循环周期 / 计划时间 / 估时 / 触发线索">🔁 周期</button>` : `<button type="button" class="gf-btn gf-btn--sm${(n.recurrence && n.recurrence.type) ? ' woop-on' : ''}" data-recurredit="${n.id}" data-wf="${wfId}" title="设循环周期：到期日自动出现，完成本次后自动排下次">🔁 循环</button>`}
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'waiting' ? ' wait-on' : ''}" data-wait="${n.id}" data-wf="${wfId}" title="标记等待中（退出今日竞选，写清在等什么）">⏳ 等待</button>
      <button type="button" class="gf-btn gf-btn--sm${n.status === 'blocked' ? ' block-on' : ''}" data-block="${n.id}" data-wf="${wfId}" title="标记阻塞（退出今日竞选，写清被什么卡住）">🚫 阻塞</button>
      <button type="button" class="gf-btn gf-btn--sm${(n.tags && n.tags.length) ? ' woop-on' : ''}" data-tags="${n.id}" data-wf="${wfId}" title="情境标签（@电脑 / @外出 / @低能量 / @15分钟）">🏷 标签</button>
      ${!opts.micro && !habit ? `<button type="button" class="gf-btn gf-btn--sm${isTodayListPinned(wfId, n.id) ? ' woop-on' : ''}" data-todaypin="${n.id}" data-wf="${wfId}" title="${isTodayListPinned(wfId, n.id) ? '取消今日置顶（仅影响今日清单顺序，不是 MIT）' : '置顶到今日清单最前（仅今天有效，可多条）'}">${isTodayListPinned(wfId, n.id) ? '📌 已置顶' : '📌 置顶'}</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm today-del" data-del="${n.id}" data-wf="${wfId}" title="删除该任务（10 秒内可撤销）">🗑 删除</button>
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
    </div>`;
  return rowChrome({
    cls: rowCls,
    attrs: `data-id="${n.id}" data-wf="${wfId}" draggable="true"`,
    checkLabelCls: 'today-check',
    checkAttrs: ` data-done="${n.id}" data-wf="${wfId}" aria-label="完成"`,
    titleHtml: `<span class="today-txt-line">${titleLine}</span>`,
    metaHtml: metaLine,
    extraHtml: `<div class="today-row-quick">
      ${isWfTop || opts.pomo ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary" data-pomo="${n.id}" data-wf="${wfId}" title="番茄钟专注（时长取 MIT 区下拉，默认 25′）">🍅 专注</button>` : ''}
      <button type="button" class="gf-btn gf-btn--sm gf-btn--ghost today-rowmore-btn" data-rowmore="${n.id}" title="更多：移动端可改提醒/计划时间/删除；预案·周期·等待等请用桌面" aria-expanded="${expanded}">${expanded ? '▲ 收起' : '⋯ 更多'}</button>
    </div>`,
    moreHtml: moreInner,
    moreCls: 'today-row-more'
  });
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
      stampNodeTimeDk(n);
      if (n.time && !n.scale) n.scale = 'day';
      save(); afterChange();
    };
  });
  root.querySelectorAll('[data-todaypin]').forEach(b => b.onclick = () => {
    toggleTodayListPin(b.dataset.wf, b.dataset.todaypin);
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
  if (!document.getElementById('parkModal')) return;
  const n = nodeInWorkflow(wfId, nodeId); if (!n) return;
  const waiting = status === 'waiting';
  const ttl = waiting ? '标记等待中' : '标记阻塞';
  const sub = waiting ? '写清在等什么 · 设个催办日期，到期自动提醒你去催' : '写清被什么卡住 · 解锁后再回到今日竞选';
  const presets = waiting ? `<div class="pk-presets">${[['+1天', 1], ['+3天', 3], ['+1周', 7]].map(([l, d]) => `<button type="button" class="ctx-chip" data-pkpre="${d}">${l}</button>`).join('')}<button type="button" class="ctx-chip" data-pkpre="0">清除日期</button></div>` : '';
  const html = buildModalHtml({
    icon: waiting ? '⏳' : '🚫',
    title: ttl,
    sub,
    closeId: 'pkClose',
    body: `
      <div class="pk-task">${esc(n.text)}</div>
      <label class="wfm-row"><span>${waiting ? '在等什么' : '被什么卡住'}</span><input id="pkNote" class="gf-input" value="${esc(n.waitNote || '')}" placeholder="${waiting ? '如：等客户回复报价' : '如：缺设计稿'}"></label>
      ${waiting ? `<label class="wfm-row"><span>催办日期</span><input id="pkDate" type="date" class="gf-input" value="${esc(n.followUp || '')}"></label>${presets}` : ''}
      <div class="wfm-actions">${n.status === status ? '<button type="button" class="gf-btn gf-btn--ghost" id="pkClear">解除标记</button>' : ''}<button type="button" class="gf-btn gf-btn--ghost" id="pkCancel">取消</button><button type="button" class="gf-btn gf-btn--primary" id="pkSave">保存</button></div>`,
    buttons: [],
  });
  const api = openModalMask('parkModal', html, { closeId: 'pkClose' });
  if (!api) return;
  const overlay = api.overlay;
  const close = api.close;
  const $ = id => overlay.querySelector('#' + id);
  $('pkCancel').onclick = close;
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
    return rowChrome({
      cls: 'ib-row',
      attrs: `data-ib="${it.id}"`,
      titleHtml: `<b>${esc(it.text)}</b>`,
      metaHtml: `${dl}${remind}`,
      extraHtml: `<div class="ib-acts">${primary}<button type="button" class="gf-btn gf-btn--sm gf-btn--ghost ib-morebtn" data-ibmore="${it.id}" title="更多：选项目 / 以后再说 / 明天 / 丢弃" aria-expanded="false">⋯</button></div>`,
      moreHtml: overflow,
      moreCls: 'ib-overflow',
      moreAttrs: `data-ibov="${it.id}" style="display:none"`
    });
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
        <button type="button" class="am-item" id="btnRitualTimes">⚙ 改到点时间<span class="am-sub">晨 / 晚（设置）</span></button>
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
  // v8.19: 移动端闹钟条不再内嵌时间控件 → 仪式菜单进设置改晨/晚到点
  const bt = document.getElementById('btnRitualTimes');
  if (bt) bt.onclick = () => {
    openSettingsModal();
    setTimeout(() => {
      const sec = document.getElementById('setRitualSection');
      if (sec) try { sec.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
    }, 80);
  };
}

// v7.7 需要关注汇总信号外露：执行区头部只放两个可点数字，细节仍在「需要关注」里
function renderTodayAttnPill() {
  const box = document.getElementById('todayAttnPill'); if (!box) return;
  const due = parkedEntries().filter(e => followUpDue(e.node));
  const stale = stagnationAlerts(STALE_DAYS);
  if (!due.length && !stale.length) { box.innerHTML = ''; return; }
  // v8.15: chip title 写明口径（与「需要关注」角标的全部事项区分），且超 3 条时补「等」
  box.innerHTML =
    (due.length ? `<button type="button" class="attn-chip due" data-attn="due" title="到期的跟进：暂停事项里设了跟进时间且到点了（全部暂停项在「需要关注」里）｜${esc(due.slice(0, 3).map(e => e.node.text).join(' / '))}${due.length > 3 ? ' 等' : ''}">📣 ${due.length} 需催办</button>` : '') +
    (stale.length ? `<button type="button" class="attn-chip stale" data-attn="stale" title="停滞：重要但 ${STALE_DAYS} 天没碰过的叶子｜${esc(stale.slice(0, 3).map(a => a.node.text).join(' / '))}${stale.length > 3 ? ' 等' : ''}">⚠️ ${stale.length} 停滞</button>` : '');
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
  // v8.23: 渲染前换日自愈 + 清陈旧 time（否则昨日排程仍按「今日时间」混排）
  try { rolloverTodayState(); } catch (e) { }
  const wfCount = state.workflows.filter(w => (w.nodes || []).length).length;
  if (!wfCount) {
    const wfEmpty = emptyStateHtml({
      icon: '🎯', title: '还没有目标流', hint: '去「目标规划」输入并解析你的计划',
      btnLabel: '去规划', btnOnclick: "switchView('plan')"
    });
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
  // MIT 与 syncTop 同源：优先取 syncTop 选出的 Top1，保证「当下最重要」全页一致
  // topId 不在今日池（如周尺度主线）也直接展示，保证两处一致
  // v7.9: MIT 节点可能属于其他项目（全局英雄卡）——byId 只查当前项目会漏，改用跨项目查找
  const topWfId = state.topWfId || state.activeWorkflowId;
  const topNode = state.topId ? (nodeInWorkflow(topWfId, state.topId) || byId(state.topId)) : null;
  const mitEntry = pool.find(x => x.node.id === state.topId)
    || (topNode && !topNode.done ? { node: topNode, wfId: topWfId, wfName: (workflowById(topWfId) || {}).name || '', isWfTop: true } : null)
    || pool.find(x => x.isWfTop && !x.node._overflow) || pool.find(x => !x.node._overflow) || pool[0] || null;  // v8.11: 溢出任务不当 MIT
  // v8.2/v8.18: 有计划时间 → 开始前 5 分钟提醒；MIT 可能不在 pool（跨项目 Top1），必须单独并入
  const remindNodes = pool.map(x => x.node);
  if (mitEntry && mitEntry.node && !remindNodes.some(n => n && n.id === mitEntry.node.id)) remindNodes.push(mitEntry.node);
  ensureRemindDefaults(remindNodes);
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
    <details class="dc-fold"><summary title="本周承诺时长 vs 可投入容量：全局行统计全部项目合计（需在⚙设置全局小时），本项目行只看当前项目">周预算 ${wk.global ? (wk.over ? '<span class="dc-tag over">⚠ 超支</span>' : '<span class="dc-tag">✓</span>') : (wk.projOver ? '<span class="dc-tag over">⚠ 本项目超支</span>' : '')}</summary>
      ${wk.global ? `<div class="day-capacity${wk.over ? ' over' : ''}" title="全部项目本周承诺合计 vs 全局每周容量（⚙设置里的工作日/周末小时）">
        <span>本周总预算</span><span class="dc-bar"><i style="width:${wpct}%"></i></span>
        <span class="dc-num">已承诺 ${fmtHours(wk.est)}h / ${fmtHours(wk.cap)}h${wk.free >= 0 ? ' · 余 ' + fmtHours(wk.free) + 'h' : ' · 超 ' + fmtHours(-wk.free) + 'h'}</span>
      </div>` : `<div class="hint dc-no-global">🌐 全局周预算未设置（全部项目合计 ${fmtHours(wk.est)}h）——⚙ 设置里配置「工作日/周末空闲时段」后，这里显示全局预算与超支判定</div>`}
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
    // v8.23: 置顶 → 有 time 升序 → 未设时间 → 逾期补做 → 溢出（统一走 sortTodayExecEntries）
    const pins = todayListPinsFor();
    const ordered = sortTodayExecEntries(taskPool, { pins });
    const inPool = taskPool.filter(ent => !ent.node._overflow);
    const overflowed = taskPool.filter(ent => ent.node._overflow);
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
        const pomoDef = +((state.meta && state.meta.prefs && state.meta.prefs.pomoMinutes) || 25);
        sh += `<div class="today-mit-pin"><div class="mit-pin-head"><span class="mit-pin-lbl">🎯 MIT · 当下最重要</span>` +
          `<select class="gf-input gf-select mit-pomo-len" id="pomoLen" title="专注时长：25′ 标准 / 50′ 长专注 / 90′ 深潜（BRAC 完整周期，评分加权）——配合行内「🍅 专注」启动"><option value="25"${pomoDef === 25 ? ' selected' : ''}>🍅 25′ 标准</option><option value="50"${pomoDef === 50 ? ' selected' : ''}>🍅 50′ 长专注</option><option value="90"${pomoDef === 90 ? ' selected' : ''}>🌊 90′ 深潜</option></select>` +
          (state.topPin === mitN.id ? `<button type="button" class="mit-unpin" id="btnUnpinTop" title="你在日历/洞察里手动固定了这件，算法暂不接管">📌 已固定 · 取消</button>` : '') +
          `</div>${todayRowHtml(mitEntry, { micro: true, pomo: true })}` +
          `<details class="mit-score-fold"><summary title="优先级分：算法排序用，决定「先做谁」——不是完成评价（那个在📊今日状态里看表现分）">📊 优先级 ${mitFs.total} · 为什么排最前</summary><div class="hero-more">${mitProgPill}${mitMpPill}${mitPacePill}${mitSprint}</div><div class="hero-score" title="为什么选这个：${mitParts.map(p => p.label).join('、')}">${mitPartsHtml}</div></details>` +
          `</div>`;
      }
      if (ordered.length) {
        // v8.11/v8.23: 置顶 / 逾期补做 / 溢出 分区标题
        let pinSplit = false, odSplit = false, ovfSplit = false;
        const pinSet = new Set(pins);
        sh += ordered.map(ent => {
          const k = todayListPinKey(ent.wfId, ent.node.id);
          let div = '';
          if (!pinSplit && pinSet.has(k)) {
            pinSplit = true;
            const nPin = ordered.filter(e => pinSet.has(todayListPinKey(e.wfId, e.node.id))).length;
            div += `<div class="today-sec-div">📌 今日置顶 <span class="cnt">${nPin}</span></div>`;
          }
          if (!odSplit && !ent.node._overflow && !pinSet.has(k) && !ent.node.time && (ent.node.overdue || (ent.node.daysLeft != null && ent.node.daysLeft < 0))) {
            odSplit = true;
            div += `<div class="today-sec-div">⏪ 补做 · 逾期未完成（已清昨日排程时间）</div>`;
          }
          if (!ovfSplit && ent.node._overflow) {
            ovfSplit = true;
            div += `<div class="today-sec-div">🌊 溢出 · 超出今日可投入，建议顺延或删减 <span class="cnt">${overflowed.length}</span></div>`;
          }
          const opts = {};
          if (ent.node.id === nextTopId) opts.nextTop = true;
          if (pinSet.has(k)) opts.listPinned = true;
          return div + todayRowHtml(ent, opts);
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
        sh += `<div class="today-sec-div">习惯打卡 <span class="cnt">${habitPool.length}</span></div>`;
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
        `<div class="today-exec-help">排序规则：📌 用户置顶（⋯里点「置顶」，仅今日有效）→ 设了「🕐 计划时间」的按时间升序 → 未设时间按重要度 → ⏪ 逾期补做 → 🌊 溢出沉底。隔夜会清掉昨日的计划时间，避免「上一天」混进今日。🎯 MIT / ② 由算法钉选。</div>`);
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
    // v8.18: 今日已完成默认折叠（FOLD_DEFAULT.done=false）——完成后清单太长抢执行区注意力
    const doneRows = doneEntries.length
      ? doneEntries.map(en => {
          const dsc = scoreOfDoneEntry(en, scoreLogToday);
          const hm = en.t ? (() => { const dt = new Date(en.t); return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()); })() : '';
          return `<div class="today-done-row">${hm ? `<span class="today-meta done-hm" title="完成时刻 · 列表按完成先后排序">${hm}</span>` : ''}<b>${esc(en.text)}</b>${en.wfName ? `<span class="today-meta wf-tag">${esc(en.wfName)}</span>` : ''}${en.act ? `<span class="today-meta">实计 ${en.act}′</span>` : ''}${dsc ? `<span class="today-meta done-score" title="完成得分 · ${esc(dsc.reason || '按重要度/期限/时长加权')}">${dsc.score >= 0 ? '+' : ''}${dsc.score}分</span>` : ''}</div>`;
        }).join('')
      : '<div class="empty-state">✅ 完成后会显示在这里</div>';
    list.innerHTML = foldSectionHtml({
      fold: 'done', open: foldOpen('done'), cls: 'today-done-fold',
      titleHtml: `✅ 今日已完成 <span class="cnt fold-sum">${doneEntries.length}</span>`,
      body: doneRows
    });
    bindFoldPersist(list, 'done');
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
  const syncAria = () => {
    const sum = el.querySelector('summary');
    if (sum) sum.setAttribute('aria-expanded', el.open ? 'true' : 'false');
  };
  syncAria();
  el.addEventListener('toggle', () => {
    syncAria();
    try { localStorage.setItem('goalflow.zone.' + el.id, el.open ? '1' : '0'); } catch (e) { }
  });
}
function updateTodayZones() {
  syncSimpleModeClass();
  const att = document.getElementById('zoneAttention');
  const st = document.getElementById('zoneStatus');
  const fo = document.getElementById('zoneFocus');
  // v8.15: badge 数「实际事项」而非非空区块——旧口径下收件箱 pend=0 但 someday 有货时
  // inboxPanel 仍渲染「已清空」占位（innerHTML 非空）→ 点掉后数字还在却找不到内容；
  // 且 onboard 欢迎卡/备份提示混入计数，「关注的东西不对」
  const _so = attentionStaleOverdue();
  const odN = _so.od.length, staleN = _so.stale.length;
  const parkedN = parkedEntries().length;
  const inboxN = inboxPending().length;
  let tipN = 0;
  ['todayBackupBar', 'todayBurnout'].forEach(id => { const el = document.getElementById(id); if (el && el.innerHTML.trim()) tipN++; });
  const rb = document.getElementById('reviewBanner'); if (rb && rb.classList.contains('show')) tipN++;
  const n = odN + staleN + parkedN + inboxN + tipN;
  const badge = document.getElementById('attentionBadge');
  if (badge) {
    badge.textContent = n ? `(${n})` : '';
    badge.title = n ? `需要关注 ${n} 项 = 🚨逾期 ${odN} + ⚠️停滞 ${staleN} + ⏸暂停 ${parkedN} + 📥待澄清 ${inboxN} + 💡提示 ${tipN}` : '';
  }
  if (att) {
    const onboard = document.getElementById('onboardCard');
    const hasOnboard = !!(onboard && onboard.innerHTML.trim());
    att.open = prefsSimpleMode() ? false : (hasOnboard ? true : zoneOpenPref('zoneAttention', false));
    bindZonePersist(att);
    // v8.15: 全部清空时给明确空态（否则展开是一片空白，以为数字出 bug）
    const body = att.querySelector('.zone-body');
    let empty = document.getElementById('attentionEmpty');
    if (n === 0 && !hasOnboard) {
      if (!empty && body) {
        empty = document.createElement('div');
        empty.id = 'attentionEmpty';
        empty.className = 'hint attention-empty';
        body.appendChild(empty);
      }
      if (empty) empty.textContent = '✨ 没有需要关注的事——逾期 / 停滞 / 暂停 / 待澄清都已清空';
    } else if (empty) empty.remove();
  }
  if (st) {
    st.open = prefsSimpleMode() ? false : zoneOpenPref('zoneStatus', false);
    bindZonePersist(st);
    const sum = document.getElementById('statusSum');
    if (sum) {
      const ts = todayScore();
      const d = dayPlanFeasibilityAll();
      // v8.15: 「分」→「表现分」+ title 说口径，与 MIT 的「优先级分」区分（同名异义曾是最大困惑源）
      sum.textContent = `${ts.total} 表现分 · ${ts.grade || '—'} · ${d.over ? `超出预算 ${d.est - d.cap}′` : '可承载'}`;
      sum.title = '今日表现分：已完成事项的加分累计（日目标 100 分，番茄另计）｜可做完性：今日清单预估时长是否超出可支配时间';
    }
  }
  if (fo) {
    fo.open = prefsSimpleMode() ? false : zoneOpenPref('zoneFocus', false);
    bindZonePersist(fo);
  }
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
  // v8.18: body[data-view] 供移动端 CSS 按视图减负（今日藏大标题，顶栏常显迷你标题）
  try { document.body.dataset.view = name; } catch (e) { }
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
    <div class="gs-bar"><span class="gs-ic">🔍</span><input id="gsInput" class="gs-input" placeholder="搜索任务 / 标签 / 等待备注… 输入新事项回车捕获到收件箱" autocomplete="off"><button type="button" class="gs-x" id="gsClose" aria-label="关闭">×</button></div>
    <div class="gs-results" id="gsResults"></div>
    <div class="gs-foot" id="gsFoot"></div>
  </div>`;
  overlay.classList.add('show');
  const inp = overlay.querySelector('#gsInput');
  const results = overlay.querySelector('#gsResults');
  const foot = overlay.querySelector('#gsFoot');
  const close = () => { overlay.classList.remove('show'); overlay.innerHTML = ''; };
  const gsX = overlay.querySelector('#gsClose');
  if (gsX) gsX.onclick = close;
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
    // v8.16: 备选区所有行都能「→今天」（原只有 Backlog 两条 lane 有按钮）；
    // 已在今日清单的（已排时间/排到今日/今天到期）显示标记而非按钮——重复点击会把已排时间顺延
    const inToday = !!(n.time || n.planDate === dateKey() || n.daysLeft === 0);
    const todayBtn = inToday
      ? '<span class="dl fitem-in-today" title="已在今日清单（见上方「今日执行」区）">✓ 今日</span>'
      : (showToday ? `<button type="button" class="gf-btn gf-btn--sm gf-btn--primary fitem-today" data-today="${n.id}" title="把这条加入今天任务（自动排空闲时间，可撤回）">→今天</button>` : '');
    return `<div class="fitem ${n.overdue ? 'overdue' : ''}">${rk}${esc(n.text)}${dl}${slot}${est}${act}${todayBtn}</div>`;
  };
  const sc = state.scale === 'all' ? '全部' : (SCALE_LABEL[state.scale] + '重点');
  const top3Html = top3.length ? `<div class="fgroup top3"><h3>★ 可完成焦点 Top ${top3.length}<span class="cnt">算法排序 · 不含 Backlog</span></h3>${top3.map((n, i) => li(n, i + 1, true)).join('')}</div>` : '';
  const lanes = backlogLanes();
  const lane = arr => arr.length ? arr.map(n => li(n, null, true)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>';
  box.innerHTML = `<div class="empty-hint">当前视图：${sc}${state.scale === 'all' ? '（含各尺度）' : ''}</div>
    ${top3Html}
    <div class="fgroup now"><h3>🔴 立即做（重要且紧急）<span class="cnt">${now.length} 项</span></h3>${now.length ? now.map(n => li(n, null, true)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup core"><h3>🔵 核心投入（重要不紧急）<span class="cnt">${core.length} 项</span></h3>${core.length ? core.map(n => li(n, null, true)).join('') : '<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
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
    daysLeft: n.daysLeft, overdue: n.overdue, time: n.time, timeDk: n.timeDk || '', planDate: n.planDate, slot: n.slot,
  };
  n.scale = 'day';
  setNodeDeadline(n, '今天');
  try { ensureEstimate(n, true); } catch (e) { }
  const hm = nextFreeTimeToday(state.activeWorkflowId, n.estimateMinutes || 30);
  if (hm) { n.time = hm; n.planDate = ''; stampNodeTimeDk(n); }
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
    box.innerHTML = emptyStateHtml({ icon: '🌳', title: '还没有目标树', hint: '在上方文本框粘贴计划后点「解析并生成」' });
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
    row.className = 'trow gf-row' + (n.id === state.topId ? ' trow-top' : '') + (expanded ? ' expanded' : '');
    row.draggable = true;
    row.dataset.id = n.id;
    row.style.paddingLeft = (n.depth * 12 + 6) + 'px';
    const txt = document.createElement('input');
    txt.className = 'gf-input trow-txt gf-row-title'; txt.value = n.text; txt.dataset.id = n.id;
    txt.title = n.text;
    const meta = document.createElement('span');
    meta.className = 'trow-meta gf-row-meta';
    // v7.8: 叶子直接露出「哪天几点」，AI 排期一眼可核对
    const schedMeta = isLeaf && (n.deadlineDate || n.time)
      ? (n.deadlineDate ? ' 📅' + dateKey(new Date(n.deadlineDate)).slice(5) : '') + (n.time ? ' 🕐' + n.time : '')
      : '';
    meta.textContent = (isLeaf ? '叶' : '枝') + schedMeta;
    row.appendChild(txt); row.appendChild(meta);
    if (isLeaf) {
      const done = document.createElement('label');
      done.className = 'trow-done gf-row-check';
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
    more.className = 'trow-more gf-row-more';
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
  box.addEventListener('click', async e => {
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
    else if (btn.dataset.act === 'del') {
      const ok = await confirmModal({
        icon: '🗑', title: '删除节点', danger: true, okText: '删除',
        text: '删除该节点及其子树？',
      });
      if (ok) deleteNode(id);
    }
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
    void reparentNode(e.dataTransfer.getData('text/plain'), inp && inp.dataset.id);
  });
  box.addEventListener('dragend', () => box.querySelectorAll('.drop-target').forEach(r => r.classList.remove('drop-target')));
  bindScrollMemory(box);
}
/* 拖拽换父：把 dragId 挂到 targetId 下（含防环与确认） */
async function reparentNode(dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return;
  const dragN = byId(dragId), targetN = byId(targetId);
  if (!dragN || !targetN) return;
  let anc = targetN;
  while (anc) { if (anc.id === dragId) { alert('不能挂到自己的子树下'); return; } anc = anc.parentId ? byId(anc.parentId) : null; }
  const ok = await confirmModal({
    icon: '↕', title: '调整层级', okText: '挂到下方',
    text: `把「${dragN.text}」挂到「${targetN.text}」下？`,
  });
  if (!ok) return;
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
  if (!state.nodes.length) {
    box.innerHTML = emptyStateHtml({
      icon: '📝', title: '还没有目标', hint: '粘贴你的计划，或点「载入示例」',
      btnLabel: '载入示例', btnOnclick: 'loadDemo()'
    });
    return;
  }
  const weak = state.nodes.filter(n => !smartEval(n).smart && n.parentId);
  if (!weak.length) {
    box.innerHTML = emptyStateHtml({ icon: '✅', title: '所有目标都够 SMART', hint: '具体 · 可衡量 · 有期限' });
    return;
  }
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
  if (!document.getElementById('smartModal')) return;

  const date = new Date(entry.timestamp);
  const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  const body = `
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
      </div>` : ''}`;
  const html = buildModalHtml({
    icon: '📜',
    title: 'AI 分解详情',
    sub: dateStr,
    closeId: 'historyDetailClose',
    bodyClass: 'guide-body',
    body,
    buttons: [{ id: 'historyDetailDone', label: '关闭', primary: true }],
  });
  const api = openModalMask('smartModal', html, { closeId: 'historyDetailClose' });
  if (!api) return;
  api.overlay.querySelector('#historyDetailDone').onclick = api.close;
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
    btnResetSkill.onclick = async () => {
      const ok = await confirmModal({
        icon: '↺', title: '恢复默认 Skill', okText: '恢复',
        text: '确定要恢复默认的 Skill Prompt 吗？',
      });
      if (!ok) return;
      skillInput.value = AI_DECOMPOSE_SYSTEM;
      try { localStorage.removeItem('goalflow.aiSkill'); } catch (e) {}
      showToast('↺ 已恢复默认 Skill');
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
    const g = COLORS.gradSmartDot || [COLORS.goldSoft || 'var(--gold-soft)', COLORS.svgGlow || 'var(--accent)'];
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
          <button type="button" class="mh-x" id="mClose" aria-label="关闭">×</button>
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
    const col = QUAD[q].icon ? (CAT[q] ? CAT[q].color : (typeof svgNoise === 'function' ? svgNoise() : 'var(--muted)')) : 'var(--muted-2)';
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
    // v8.7 口径修复：todayAggregatedPool 与清单同源；完成数取 executionLog。
    // v8.21: 去掉独立「今日摘要」条——问候 + 待办/完成并入顶栏 ab-mini / appTitleSub。
    let pool = [];
    try { pool = todayAggregatedPool() || []; } catch (e) { }
    const doneN = (((state.meta || {}).executionLog || {})[dateKey()] || { entries: [] }).entries.length;
    const pending = pool.length;
    const hour = new Date().getHours();
    const hello = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const dn = ((state.meta || {}).profile || {}).displayName || '';
    const greet = dn ? `${hello}，${dn}` : hello;
    sub = pending || doneN
      ? `${greet} · ${dateStr} · 待办 ${pending} · 已完成 ${doneN}`
      : `${greet} · ${dateStr} · 今天没有待办`;
    mini = pending || doneN
      ? `待办 ${pending} · 已完成 ${doneN}`
      : dateStr;
    // 移动顶栏主标题用问候，桌面 crumb 仍走 VIEWS「今日行动」
    const mbTitle = document.getElementById('abMini');
    if (mbTitle) mbTitle.textContent = greet;
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
  if (name !== 'today') {
    const mb = document.getElementById('abMini');
    if (mb) mb.textContent = APP_TITLE[name] || '今日';
  }
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
  // 抽屉里点导航 / 项目 / 设置 / 树 之后自动收起
  drawer.addEventListener('click', e => {
    if (e.target.closest('[data-nav], .si, .wf-item, .wf-add, .side-tree .trow, #sideSettings')) setTimeout(close, 60);
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
  const aliveWf = new Set();
  (state.workflows || []).forEach(w => {
    aliveWf.add(w.id);
    (w.nodes || []).forEach(n => alive.add(w.id + '|' + n.id));
  });
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
  // v8.17: 已删项目的 planShare / capacity 孤儿键也清掉——否则「指标/带宽」还挂着已删项目名
  Object.keys(state.meta.planShare || {}).forEach(wfId => {
    if (!aliveWf.has(wfId)) { delete state.meta.planShare[wfId]; dirty = true; }
  });
  Object.keys(state.meta.capacity || {}).forEach(wfId => {
    // capacity 顶层还有 globalWorkdayHours 等全局键——只清看起来像工作流 id 的孤儿（含 '-' 或 'wf' 前缀的自定义键）
    if (wfId === 'globalWorkdayHours' || wfId === 'globalWeekendHours' || wfId === 'globalWorkdayWins' || wfId === 'globalWeekendWins' || wfId === 'hoursPerDay' || wfId === 'daysPerWeek' || wfId === 'workdayHours' || wfId === 'weekendHours') return;
    if (!aliveWf.has(wfId) && typeof state.meta.capacity[wfId] === 'object') {
      delete state.meta.capacity[wfId]; dirty = true;
    }
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
  if (!document.getElementById('weekReviewModal')) return;
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
  const wrBody = `<div class="wr-cycle">
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
      ${(() => { const a = timeAudit(cycle === 'week' ? 7 : cycle === 'month' ? 30 : 90); const tgt = (state.meta && state.meta.q2Target) || 50; const p = a.catTotal ? Math.round((a.byCat.core || 0) / a.catTotal * 100) : 0; return a.catTotal ? `<div class="wr-bar-row" title="近${cycle === 'week' ? '7' : cycle === 'month' ? '30' : '90'}天实际投入（执行记录）中 Q2 重要不紧急占比"><span class="wr-lbl">Q2 时间</span><div class="wr-bar"><i style="width:${p}%;background:${p >= tgt ? 'var(--ur3)' : 'var(--ur4)'}"></i></div><span class="wr-num">${p}% / 目标 ${tgt}%</span></div>` : ''; })()}
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
    </div>`;
  const html = buildModalHtml({
    wide: true,
    icon: '📋',
    title: reviewCycleLabel(cycle),
    sub: `分析 → 仪式 · ${pr.label} · ${pr.key}`,
    closeId: 'wrClose',
    bodyClass: '',
    body: wrBody,
    buttons: [
      { id: 'wrSave', label: '保存' + reviewCycleLabel(cycle), primary: true },
      { id: 'wrCancel', label: '取消', ghost: true },
    ],
  });
  const api = openModalMask('weekReviewModal', html, { closeId: 'wrClose' });
  if (!api) return;
  const overlay = api.overlay;
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
  if (!document.getElementById('ritualModal')) return;
  let overlay;
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
    const mornHtml = buildModalHtml({
      wide: true,
      icon: '🌅',
      title: '早安 · 制订今日计划',
      sub: `昨日总评分 ${yTotal || '—'} · 今日已收敛 ${pool.length} 项 · 预估 ${d.est}′ / 每日可投入 ${d.cap}′${d.over ? `（超出 ${d.est - d.cap}′，建议删减或顺延）` : ''}`,
      closeId: 'rtClose',
      bodyClass: 'rt-body',
      body: `${hasPlan ? '' : '<div class="rt-weekplan-tip">本周还没排大石头 <button type="button" class="gf-btn gf-btn--sm" id="rtWeekPlan">🗓 先排本周大石头</button></div>'}
        ${mitEntry ? `<div class="rt-mit${preMit ? ' pre' : ''}">${preMit ? '<span class="rt-pre-tag">🌙 昨晚预选</span>' : ''}今日 MIT：<b>${esc(mitEntry.node.text)}</b>${mitEntry.wfName ? `<span class="rt-m"> · ${esc(mitEntry.wfName)}</span>` : ''}${preMit ? '<span class="rt-mit-acts"><button type="button" class="gf-btn gf-btn--sm gf-btn--primary" id="rtMitKeep">✓ 就是它</button><button type="button" class="gf-btn gf-btn--sm gf-btn--ghost" id="rtMitSwap">换一个</button></span>' : ''}</div>` : '<div class="rt-mit">还没有 MIT——先解析目标或载入示例。</div>'}
        ${ifthenHtml}
        ${staleHtml}
        ${anchorHtml}
        <details class="rt-preview"><summary>👀 今日清单预览（${pool.length} 项）</summary><div class="rt-list">${listHtml || '<div class="hint">今日清单为空，可先给任务加「今天」或钉时段。</div>'}</div></details>
        ${pendingHtml}`,
      buttons: [
        { id: 'rtAdjust', label: '去调整今日行动', primary: true },
        { id: 'rtOk', label: '保持计划，开始一天', ghost: true },
      ],
    });
    const mornApi = openModalMask('ritualModal', mornHtml, { closeId: 'rtClose', onClose: closeRitualModal });
    if (!mornApi) return;
    overlay = mornApi.overlay;
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
    const eveHtml = buildModalHtml({
      wide: true,
      icon: '🌙',
      title: '晚安 · 今日总结',
      sub: `完成 ${ts.count} 项 · 🍅 ${ts.pomos} 个 · 专注 ${ts.focusMin}′ · 未完成 ${undone.length} 项（逐条处置）`,
      closeId: 'rtClose',
      bodyClass: 'rt-body',
      body: `<div class="rt-total"><span title="已完成事项的加分累计（日目标 100 分，番茄另计）">今日表现分</span><b>${ts.total}</b><i class="ts-grade">${ts.grade}</i></div>
        <div class="rt-list">${rows || '<div class="hint">今天还没有评分记录——明天从 MIT 开始，完成叶子或番茄钟即可自动评分。</div>'}</div>
        ${undone.length ? `<div class="rt-dispo-h" id="rtDispoH">🧹 待处置 ${dispoPend.length} 项（明天继续 / 改期 / 放弃）</div><div class="rt-list dispo-list" id="rtDispoList">${dispoRows || '<div class="hint">全部处置完毕 🎉</div>'}</div>${dispoDoneHtml}` : '<div class="hint">今日清单全部完成 🎉</div>'}
        ${goodHtml}
        ${mitPickHtml}
        <textarea class="rt-note" id="rtNote" placeholder="一句话总结今天（可选，仅存本机）">${esc(note)}</textarea>`,
      buttons: [
        { id: 'rtSave', label: '保存并休息', primary: true },
      ],
    });
    const eveApi = openModalMask('ritualModal', eveHtml, { closeId: 'rtClose', onClose: closeRitualModal });
    if (!eveApi) return;
    overlay = eveApi.overlay;
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
    parentId: root.id, scale: opts.scale || 'day', slot: opts.slot || '',
    estimateMinutes: opts.est || null, source: opts.source || '',
  });
  applySuggestions(node, text || '');
  if (opts.keepScale !== false) node.scale = opts.scale || 'day';
  // 期限唯一写入口：有显式 Date 用 dateKey，否则用文案（默认「今天」）
  if (opts.deadlineDate) {
    const dd = opts.deadlineDate instanceof Date ? opts.deadlineDate : new Date(opts.deadlineDate);
    setNodeDeadline(node, opts.deadline || dateKey(dd));
  } else {
    setNodeDeadline(node, opts.deadline || '今天');
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
  if (!document.getElementById('ritualModal')) return;
  ensureScoreMeta();
  const wk = weekKey();
  const plan = (state.meta.weekPlans || {})[wk];
  const cands = weekPlanCandidates();
  const savedIds = new Set((plan && plan.rocks || []).map(r => r.wfId + '|' + r.nodeId));
  const listHtml = cands.length ? cands.map((c, i) => {
    const key = c.wfId + '|' + c.node.id;
    return `<label class="wp-cand"><input type="checkbox" data-rock="${i}" ${savedIds.has(key) ? 'checked' : ''}>
          <span class="rt-t">${esc(c.node.text)}</span><span class="rt-m">${esc(c.wfName)} · 分 ${c._s}${c.node.estimateMinutes ? ` · ${c.node.estimateMinutes}′` : ''}</span></label>`;
  }).join('') : '<div class="hint">暂无候选——先解析目标，或把重要叶子提到重要度 ≥4。</div>';
  const html = buildModalHtml({
    wide: true,
    icon: '🗓',
    title: '周计划 · 本周大石头',
    sub: '先放 3–5 块大石头（重要叶子），再让小石子填缝 · 周一 ' + wk + ' 起',
    closeId: 'wpClose',
    bodyClass: 'rt-body',
    body: `<div class="rt-list">${listHtml}</div>
      <div class="hint">勾选 ≤5 块；保存后出现在「今日行动」大石头条，整周可见。</div>`,
    buttons: [
      { id: 'wpSave', label: '保存本周大石头', primary: true },
      { id: 'wpCancel', label: '取消', ghost: true },
    ],
  });
  const api = openModalMask('ritualModal', html, { closeId: 'wpClose', onClose: closeRitualModal });
  if (!api) return;
  const overlay = api.overlay;
  overlay.querySelector('#wpClose').onclick = closeRitualModal;
  overlay.querySelector('#wpCancel').onclick = closeRitualModal;
  overlay.onclick = e => { if (e.target === overlay) closeRitualModal(); };
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
}
/* v6.5 承诺卡（commitment device）：周计划确认后先生成承诺卡，签名式「我承诺」才落库。
   理论：损失厌恶 + 一致性偏见（stickK/Beeminder）——明确承诺+对照显著提升履约率。 */
function openCommitCard(wk, picks) {
  const html = buildModalHtml({
    icon: '📜',
    title: '本周承诺卡',
    sub: `周一 ${wk} 起 · 周回顾时先对照这张卡`,
    closeId: 'ccClose',
    style: 'max-width:480px',
    bodyClass: 'rt-body',
    body: `<div class="commit-card">
        <div class="commit-card-h">本周我将推进 ${picks.length} 块大石头：</div>
        <ul class="commit-card-list">${picks.map(p => `<li>🪨 ${esc(p.text)}</li>`).join('')}</ul>
        <textarea class="gf-input commit-intent" id="ccIntent" rows="2" placeholder="一句话意图（可选）：如「这周守住核心，不被救火牵着走」"></textarea>
      </div>`,
    buttons: [
      { id: 'ccCommit', label: '✍️ 我承诺', primary: true },
      { id: 'ccBack', label: '返回改选', ghost: true }
    ]
  });
  const api = openModalMask('ritualModal', html, {
    closeId: 'ccClose',
    onClose: closeRitualModal
  });
  if (!api) return;
  // × / 遮罩走 closeRitualModal（不只清 innerHTML）
  api.overlay.querySelector('#ccClose').onclick = closeRitualModal;
  api.overlay.onclick = e => { if (e.target === api.overlay) closeRitualModal(); };
  api.overlay.querySelector('#ccBack').onclick = openWeekPlan;
  api.overlay.querySelector('#ccCommit').onclick = () => {
    ensureScoreMeta();
    const intent = (api.overlay.querySelector('#ccIntent').value || '').trim();
    state.meta.weekPlans[wk] = { rocks: picks, intent, committedAt: Date.now(), savedAt: Date.now() };
    if (!state.meta.alarmFired) state.meta.alarmFired = {};
    state.meta.alarmFired['weekplan|' + wk] = true;
    saveMeta(); closeRitualModal(); afterChange();
  };
}
function renderTodayRocks() {
  const box = document.getElementById('todayRocks'); if (!box) return;
  ensureScoreMeta();
  const wk = weekKey();
  const plan = (state.meta.weekPlans || {})[wk];
  if (!plan || !(plan.rocks || []).length) {
    box.innerHTML = emptyStateHtml({
      icon: '🪨', title: '本周大石头未排', hint: '选 3–5 件最重要的事，周回顾时对齐履约',
      btnLabel: '🗓 排大石头', btnId: 'btnWeekPlan2'
    });
    const b = box.querySelector('#btnWeekPlan2');
    if (b) b.onclick = () => openWeekPlan();
    return;
  }
  const chips = plan.rocks.map(r => {
    const n = nodeInWorkflow(r.wfId, r.nodeId);
    const done = n ? !!n.done : false;
    const txt = n ? n.text : r.text;
    const short = txt.length > 16 ? txt.slice(0, 16) + '…' : txt;
    return `<button type="button" class="rock-chip gf-row${done ? ' done' : ''}" data-rock-done="${r.nodeId}" data-wf="${r.wfId}" title="${done ? '已完成 · 点击撤销' : '点击勾掉这块大石头'}"><span class="gf-row-check rock-ic">${done ? '✅' : '🪨'}</span><span class="gf-row-title">${esc(short)}</span></button>`;
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
  if (!document.getElementById('historyModal')) return;
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
  const html = buildModalHtml({
    wide: true,
    icon: '📜',
    title: '仪式历史',
    sub: sub + ' · 仅存本机',
    closeId: 'hisClose',
    bodyClass: '',
    body: `<div class="wr-cycle">${HISTORY_TABS.map(t => `<button type="button" class="wr-ctab${t.k === tab ? ' on' : ''}" data-htab="${t.k}">${t.icon} ${t.label}</button>`).join('')}</div>
    <div class="rt-body his-body">${body}</div>`,
    buttons: [],
  });
  const api = openModalMask('historyModal', html, { closeId: 'hisClose', onClose: closeHistory });
  if (!api) return;
  api.overlay.querySelector('#hisClose').onclick = closeHistory;
  api.overlay.onclick = e => { if (e.target === api.overlay) closeHistory(); };
  api.overlay.querySelectorAll('[data-htab]').forEach(b => b.onclick = () => openHistory(b.dataset.htab));
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
    box.innerHTML = '<div class="today-score ts-empty"><span class="hint">完成叶子任务或结束一个番茄钟后，这里会自动累计「今日表现分」（日目标 100 分）。</span></div>';
    return;
  }
  const pct = clamp(Math.round(ts.total), 0, 100);
  const last = ts.entries[ts.entries.length - 1];
  box.innerHTML =`<div class="today-score">
    <div class="ts-main"><span class="ts-label" title="今日表现分：已完成事项的加分累计（日目标 100 分，番茄另计）——与清单里 MIT/② 的「优先级分」（决定先做谁）是两回事">今日表现分</span><b class="ts-num">${ts.total}</b><i class="ts-grade">${ts.grade}</i></div>
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
  safe('syncSimpleModeClass', syncSimpleModeClass);
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
    const wfCol = workflowColor(w);
    html += `<div class="wf-item${active ? ' active' : ''}${open ? ' open' : ''}" style="--wf-color:${wfCol}">
      <div class="wf-row">
        <button type="button" class="wf-toggle" data-wft="${w.id}" title="${open ? '收起' : '展开'}（不影响当前编辑）">${open ? '▾' : '▸'}</button>
        <span class="wf-dot" style="background:${wfCol}"></span>
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
    g.addColorStop(0, cssVar('--bg2', '#131417')); g.addColorStop(1, cssVar('--bg0', '#08090c'));
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
    cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '目标流.png'; a.click(); });
  };
  img.src = url;
}
