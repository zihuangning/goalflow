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
const LLM_KEY_STORAGE = STORAGE.llmKey || 'gf_llm_key';
const SCALES=[
  {key:'day',  label:'每日', short:'今日'},
  {key:'week', label:'每周', short:'本周'},
  {key:'month',label:'每月', short:'本月'},
  {key:'year', label:'年度', short:'年度'}
];
const SCALE_LABEL={all:'当下',day:'今日',week:'本周',month:'本月',year:'年度'};
const QUAD={
  now:     {key:'now',     label:'重要且紧急 · 立即做',  icon:'🔴', val:{im:5,ur:5}},
  core:    {key:'core',    label:'重要不紧急 · 核心投入',icon:'🔵', val:{im:5,ur:2}},
  distract:{key:'distract',label:'紧急不重要 · 干扰',    icon:'🟠', val:{im:2,ur:5}},
  noise:   {key:'noise',   label:'不重要不紧急 · 噪音',  icon:'⚪', val:{im:2,ur:2}},
};
const QUAD_ORDER=['now','core','distract','noise'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const urColor=ur=>PALETTE_UR[clamp(Math.round(ur),1,5)-1];
function inferRecur(text, scale){
  const t=text||'';
  if(/每天|每日|天天|日课|日更|晨间|晚间习惯/.test(t)) return true;
  if(/每周|周报|周会|每星期|双周/.test(t)) return true;
  if(scale==='day' && /固定\s*\d|时段|集中回复/.test(t)) return true;
  return scale==='week' && /例行|周期/.test(t);
}
function ensureVE(n){
  if(n.val==null) n.val=clamp(n.im,1,5);
  if(n.eff==null){
    let e=3;
    if(/只需|顺手|简单|5分钟|十分钟/.test(n.text||'')) e=2;
    else if(/复杂|深度|重构|搭建|体系/.test(n.text||'')) e=4;
    else if(n.ur>=4) e=4;
    else if(n.ur<=2) e=2;
    n.eff=clamp(e,1,5);
  }
  n.val=clamp(n.val,1,5); n.eff=clamp(n.eff,1,5);
}
function isQuickWin(n){ return n.val>=4 && n.eff<=2; }
function veKey(val,eff){
  const v=val>=4, e=eff>=3;
  if(v&&!e) return 'quick';
  if(v&&e) return 'major';
  if(!v&&!e) return 'easy';
  return 'trap';
}
const VE={
  quick:{label:'快速赢 · 高价值低费力',icon:'⚡',color:PALETTE_UR[2]},
  major:{label:'主战役 · 高价值高费力',icon:'🏔',color:PALETTE_UR[0]},
  easy:{label:'顺手活 · 低价值低费力',icon:'🍃',color:'#8a93ab'},
  trap:{label:'陷阱 · 低价值高费力',icon:'🕳',color:PALETTE_UR[3]},
};
const VE_ORDER=['quick','major','easy','trap'];
const DAY_CAPACITY_MIN=480; // 日视图可做完性：默认 8 小时容量
function goldChainIds(topId){
  const ids=new Set();
  let c=topId?byId(topId):null;
  while(c){ ids.add(c.id); c=c.parentId?byId(c.parentId):null; }
  return ids;
}
function isUnderTopNode(n, topId){
  if(!n||!topId) return false;
  const top=byId(topId); if(!top) return false;
  return (function walk(x){ if(x.id===n.id) return true; return (x._children||[]).some(walk); })(top);
}
function parseEstimateMinutes(text){
  const t=text||'';
  let m=t.match(/(\d+(?:\.\d+)?)\s*小时/);
  if(m) return clamp(Math.round(parseFloat(m[1])*60),1,999);
  m=t.match(/(\d+)\s*分钟|(\d+)\s*min\b/i);
  if(m) return clamp(+(m[1]||m[2]),1,999);
  if(/半天/.test(t)) return 240;
  if(/5\s*分钟|五分钟/.test(t)) return 5;
  return null;
}
function ensureEstimate(n,isLeaf){
  if(n.estimateMinutes==null){
    const p=parseEstimateMinutes(n.text);
    if(p!=null) n.estimateMinutes=p;
    else if(isLeaf) n.estimateMinutes=30;
  }
  if(n.estimateMinutes!=null) n.estimateMinutes=clamp(+n.estimateMinutes||0,0,999)||null;
  if(n.actualMinutes!=null) n.actualMinutes=clamp(+n.actualMinutes||0,0,9999)||null;
}
function ensureAllEstimates(){
  computeTree(state.nodes);
  state.nodes.forEach(n=>{
    const leaf=n.parentId&&n._children.length===0;
    ensureEstimate(n,leaf);
  });
}
function setNodeDone(n, checked){
  n.done=!!checked;
  n.doneAt=checked?Date.now():null;
  if(checked){
    if(n.estimateMinutes && n.actualMinutes==null) n.actualMinutes=n.estimateMinutes;
    if(state.topId && isUnderTopNode(n, state.topId)) n.touchedAt=Date.now();
    const chain=goldChainIds(state.topId);
    if(chain.has(n.id)) n.touchedAt=Date.now();
  }
}
function category(im,ur){
  if(im>=4&&ur>=4) return CAT.now;
  if(im>=4&&ur<4)  return CAT.core;
  if(im<4&&ur>=4)  return CAT.distract;
  return CAT.noise;
}
const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DAY_SLOTS=[
  ['','未钉时段'], ['h0','清晨'], ['h1','上午'], ['h2','中午'], ['h3','午后'],
  ['h4','下午'], ['h5','傍晚'], ['h6','夜间']
];

let TODAY=new Date();                 // 渲染时使用"今天"
const today0=()=>{const d=new Date(TODAY);return new Date(d.getFullYear(),d.getMonth(),d.getDate());};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const nextWeekday=(from,wd)=>{const x=new Date(from);let diff=(wd-x.getDay()+7)%7;if(diff===0)diff=7;x.setDate(x.getDate()+diff);return x;};
const endOfWeek=d=>{const x=new Date(d);x.setDate(x.getDate()+((7-x.getDay())%7));return x;};

/* ============ 日期 / 排期解析 ============ */
const WK={日:0,天:0,一:1,二:2,三:3,四:4,五:5,六:6};
function parseDeadline(text){
  const t=text||'';
  const base=today0();
  const mk=(label,date)=>{const d=startOfDay(date);const dl=Math.round((d-base)/86400000);return {label,date:d,daysLeft:dl,overdue:dl<0};};
  const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  let m;
  if(/今天|今日/.test(t)) return mk('今天',base);
  if(/明天/.test(t)) return mk('明天',addDays(base,1));
  if(/后天/.test(t)) return mk('后天',addDays(base,2));
  m=t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if(m){let mo=+m[1],da=+m[2];let yr=base.getFullYear();let d=new Date(yr,mo-1,da);if(d<base)d=new Date(yr+1,mo-1,da);return mk(`${mo}月${da}日`,d);}
  m=t.match(/(下)?\s*(周|星期)\s*([一二三四五六日天])/);
  if(m){const wd=WK[m[3]];let d=nextWeekday(base,wd);if(m[1])d=addDays(d,7);return mk(`${m[1]||''}周${m[3]}`,d);}
  if(/本周\s*内?/.test(t)) return mk('本周内',endOfWeek(base));
  if(/下周/.test(t)) return mk('下周',endOfWeek(addDays(base,7)));
  if(/下月底|下月末/.test(t)) return mk('下月底',new Date(base.getFullYear(),base.getMonth()+2,0));
  if(/本月底|月底|月末/.test(t)) return mk('月底',new Date(base.getFullYear(),base.getMonth()+1,0));
  if(/本月/.test(t)) return mk('本月',new Date(base.getFullYear(),base.getMonth()+1,0));
  return {label:'',date:null,daysLeft:null,overdue:false};
}

/* ============ 时间尺度嗅探 ============ */
function inferScale(text,deadlineDate,daysLeft,hasChildren){
  if(/每天|每日|天天|日课|日更|每天/.test(text)) return 'day';
  if(/每周|一周|周会|周报|每星期|双周/.test(text)) return 'week';
  if(/每月|月度|月报|每个月|月更|半月/.test(text)) return 'month';
  if(/今年|年度|这一年|全年|年底|本年|长期|主线|一辈子|终身|一直|战略|核心|关键|目标/.test(text)) return 'year';
  if(deadlineDate){
    if(daysLeft<=1) return 'day';
    if(daysLeft<=7) return 'week';
    return 'month';
  }
  return hasChildren? 'year' : 'month';
}
function deadlineUrgency(dl){
  if(!dl||dl.date==null) return null;
  if(dl.overdue) return 5;
  const d=dl.daysLeft;
  if(d<=2) return 5;
  if(d<=4) return 4;
  if(d<=7) return 4;
  if(d<=14) return 3;
  return 2;
}

/* ============ 解析层 ============ */
function applySuggestions(node,text){
  const imWords=['核心','关键','战略','主线','长期','目标','健康','家庭','成长','收入','客户','重要','年度','学习','复盘','体系','沉淀'];
  const urWords=['紧急','今天','本周','马上','立刻','立即','尽快','截止','催','deadline','周五','敲定','给方案','催办'];
  const noiseWords=['噪音','刷','无目的','闲','随便','摸鱼'];
  let im=3,ur=3;
  const negUr=text.includes('不紧急');
  imWords.forEach(w=>{if(text.includes(w))im++;});
  urWords.forEach(w=>{if(text.includes(w)){ if(w==='紧急'&&negUr) return; ur++; }});
  noiseWords.forEach(w=>{if(text.includes(w)){im=1;ur=1;}});
  if(text.includes('不重要')) im=Math.min(im,2);
  const dl=parseDeadline(text);
  node.deadline=dl.label; node.deadlineDate=dl.date; node.daysLeft=dl.daysLeft; node.overdue=dl.overdue;
  const dur=deadlineUrgency(dl);
  if(dur!=null) ur=Math.max(ur,dur);
  node.im=clamp(im,1,5); node.ur=clamp(ur,1,5);
  if(node.scale==null) node.scale=inferScale(text,dl.date,dl.daysLeft,false);
  node.recur=inferRecur(text,node.scale);
  ensureVE(node);
  const est=parseEstimateMinutes(text);
  if(est!=null) node.estimateMinutes=est;
}
function parseText(raw,today){
  if(today) TODAY=today;
  const lines=raw.split(/\r?\n/).map(s=>s.replace(/\s+$/,'')).filter(l=>l.trim().length);
  if(!lines.length) return [];
  const nodes=[]; let idc=0; const stack=[];
  lines.forEach((line,i)=>{
    const indent=line.length-line.trimStart().length;
    const content=line.trim();
    const clean=content.replace(/^([-*•·]|\d+[.、])\s+/,'');
    const node={id:'n'+(idc++),text:clean,im:3,ur:3,val:null,eff:null,deadline:'',deadlineDate:null,daysLeft:null,overdue:false,done:false,doneAt:null,touchedAt:null,estimateMinutes:null,actualMinutes:null,recur:false,scale:null,slot:''};
    applySuggestions(node,clean);
    while(stack.length&&stack[stack.length-1].indent>=indent) stack.pop();
    node.parentId = (i>0) ? (stack.length?stack[stack.length-1].node.id:nodes[0].id) : null;
    nodes.push(node);
    stack.push({node,indent});
  });
  computeTree(nodes);
  // 二次推断：有子节点的分支按 hasChildren 重判尺度
  nodes.forEach(n=>{ if(n._children.length){ const dl=n.deadlineDate?{date:n.deadlineDate,daysLeft:n.daysLeft}:null; n.scale=inferScale(n.text,dl?dl.date:null,dl?dl.daysLeft:null,true); } });
  return nodes;
}
function computeTree(nodes){
  nodes.forEach(n=>{n._children=[];});
  const byId={}; nodes.forEach(n=>byId[n.id]=n);
  nodes.forEach(n=>{ if(n.parentId&&byId[n.parentId]) byId[n.parentId]._children.push(n); });
  function walk(n,d){n.depth=d; n._children.forEach(c=>walk(c,d+1));}
  if(nodes[0]) walk(nodes[0],0);
}
function recomputeSchedule(nodes){
  nodes.forEach(n=>{
    if(n.deadline){const dl=parseDeadline(n.deadline); n.deadlineDate=dl.date; n.daysLeft=dl.daysLeft; n.overdue=dl.overdue;}
    else {n.deadlineDate=null;n.daysLeft=null;n.overdue=false;}
  });
  computeTree(nodes);
}
function treeOrder(nodes){
  const out=[]; const root=nodes[0];
  (function w(n){out.push(n); n._children.forEach(w);})(root||{_children:[]});
  return out;
}

/* ============ 优先级打分 ============ */
function focusScore(n){
  if(n.done) return -1000;
  let s=n.im*10;
  if(n.deadlineDate){
    if(n.overdue) s+=30;
    else if(n.daysLeft<=1) s+=26;
    else if(n.daysLeft<=3) s+=20;
    else if(n.daysLeft<=7) s+=13;
    else if(n.daysLeft<=14) s+=7;
    else s+=3;
  } else {
    if(n.im>=5) s+=4; else if(n.im>=4) s+=2;
  }
  return s;
}
function pickRanked(pool, limit){
  pool=pool||state.nodes;
  let cand=pool.filter(n=>n.parentId&&!n.done&&n._children.length===0);
  if(!cand.length) cand=pool.filter(n=>n.parentId&&!n.done);
  if(!cand.length){const root=pool[0]; if(root&&!root.done) return limit>1?[root]:root; return limit>1?[]:null;}
  cand.sort((a,b)=> focusScore(b)-focusScore(a) || b.im-a.im || ((a.daysLeft==null?999:a.daysLeft)-(b.daysLeft==null?999:b.daysLeft)));
  return limit>1 ? cand.slice(0,limit) : cand[0];
}
function pickTop(pool){ return pickRanked(pool,1); }

function leafProgress(){
  computeTree(state.nodes);
  const leaves=state.nodes.filter(n=>n.parentId&&n._children.length===0);
  if(!leaves.length) return null;
  const done=leaves.filter(n=>n.done).length;
  return {done,total:leaves.length,pct:Math.round(done/leaves.length*100)};
}
function subtreeProgress(n){
  if(!n) return null;
  computeTree(state.nodes);
  const collect=[];
  (function w(x){ collect.push(x); (x._children||[]).forEach(w); })(n);
  const leaves=collect.filter(x=>x._children.length===0);
  if(!leaves.length) return null;
  const done=leaves.filter(x=>x.done).length;
  return {done,total:leaves.length,pct:Math.round(done/leaves.length*100)};
}

/* ============ SMART 评估 + 对话拆解 ============ */
function smartEval(n){
  const t=n.text||'';
  // S 具体
  let s=2;
  if(/提升|提高|优化|加强|改善|更好|增强|完善|推进|做好|一些|相关|尽量|努力|处理|关注/.test(t) && !/\d/.test(t)) s=1;
  if(t.length>=10 && /\d/.test(t)) s=3;
  if(t.length>=12) s=Math.max(s,3);
  // M 可衡量
  let m=1;
  if(/\d/.test(t) || /%|倍|万|个|篇|本|次|名|家|元|小时|天|周|月|%.|百分比/.test(t)) m=3;
  // A 可达（中性，留待用户判断）
  let a=2;
  // R 相关（重要分支默认高）
  let r=(n.im>=4)?3:2;
  // T 有期限（基于显式期限或文本中明确的时间节奏，避免被自动默认的 month/year 尺度误判）
  let tb=1;
  if(n.deadline) tb=3;
  else if(/每天|每日|每周|每星期|一周|每月|月度|本月底|月底|月末|下周|本周|周[一二三四五六日天]|下?周[一二三四五六日天]|\d+\s*月|\d+\s*日/.test(t)) tb=2;
  const avg=(s+m+a+r+tb)/5;
  const gaps=[];
  if(s<=1) gaps.push('不具体：缺少可衡量的动作或产出对象');
  if(m<=1) gaps.push('不可衡量：没有量化指标（数字 / 百分比 / 件数）');
  if(tb<=1) gaps.push('无限期：没有时间节点');
  if(gaps.length===0 && avg<2.4) gaps.push('整体仍偏模糊：建议补一个量化指标或更具体的动作');
  return {s,m,a,r,tb,avg,gaps,smart: gaps.length===0 && avg>=2.4};
}
function smartQuestions(n){
  const ev=smartEval(n); const qs=[];
  if(ev.m<=1) qs.push('用什么指标判断这个目标达成了？给我一个可量化的数字或标准（如「签下 3 单」「读完 5 本」）。');
  if(ev.tb<=1) qs.push('希望什么时候完成？给个具体日期或周期（如「3月15日」「本月底」）。');
  if(ev.s<=1) qs.push('具体要做什么、对谁做、产出是什么？把它写成一个明确的动作。');
  qs.push('可以拆成哪 2-3 个具体小步骤？每个步骤最好也能衡量。');
  return qs;
}
function decomposeSuggestions(n){
  const t=n.text;
  if(/读|书|学|课|知识/.test(t)) return ['列出具体书单 / 课程（3 项）','每周固定 X 小时投入并做笔记','月底产出 1 份复盘'];
  if(/客户|合同|销售|跟进|谈|方案/.test(t)) return ['列出本周意向清单（带状态）','每天推进 1 个关键节点','准备标准化方案 / 话术模板'];
  if(/写|文章|报告|书|文档|稿/.test(t)) return ['拆成 大纲→初稿→修订 3 步','设定每周写作字数 / 页数','找 1 位反馈人定期评审'];
  if(/锻炼|运动|健康|体重|睡|饮食/.test(t)) return ['固定每日时段（如晨间 30 分）','记录每日数据','设定月度达标线'];
  if(/钱|收入|存|理财|月入|赚/.test(t)) return ['拆成 收入来源 A / B / C','设定每月具体金额目标','每周复盘转化与漏斗'];
  return ['明确可交付的产出物','拆成 3 个周里程碑','安排一次进度复盘'];
}
/* 可选 LLM（DeepSeek） */
let LLM_KEY='';
function getLLMKey(){ if(LLM_KEY) return LLM_KEY; try{LLM_KEY=localStorage.getItem(LLM_KEY_STORAGE)||'';}catch(e){} return LLM_KEY; }
async function callLLM(system,user){
  const key=getLLMKey(); if(!key) return null;
  try{
    const r=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model:'deepseek-v4-flash',messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.7})
    });
    if(!r.ok) return null;
    const d=await r.json();
    return d.choices&&d.choices[0]&&d.choices[0].message.content;
  }catch(e){ return null; }
}

/* ============ 桑基布局 ============ */
const NODEW=15, COLGAP=214, UH=12.5, MINH=22, LGAP=15, SX=46, SY=58, LBL=196, MAXLABEL=13;
function wrapLabel(t){
  const lines=[]; let buf='';
  for(const ch of (t||'')){ buf+=ch; if(buf.length>=MAXLABEL){lines.push(buf);buf=''; if(lines.length===2)break;} }
  if(buf&&lines.length<2) lines.push(buf);
  if(lines.length>2) return [lines[0], lines[1].slice(0,MAXLABEL-1)+'…'];
  return lines.length?lines:[t];
}
/* 构建可见视图（应用聚焦/隐藏噪音/按尺度过滤），并计算每节点"价值"（= 子树重要性之和） */
function buildView(nodes, scale){
  scale = scale||'all';
  const focus=document.getElementById('focusMode').checked;
  const showNoise=document.getElementById('showNoise').checked;
  const localById={}; nodes.forEach(n=>localById[n.id]=n);
  nodes.forEach(n=>{ n._vc=[]; n._hidden=false; });
  let vis;
  if(scale==='all'){
    vis = nodes.filter(n=>{
      const c=category(n.im,n.ur);
      if((focus||!showNoise) && c.key==='noise'){ n._hidden=true; return false; }
      return true;
    });
  } else {
    // 选中尺度的节点 + 它们的祖先链（保留话题上下文）
    const keep=new Set();
    nodes.filter(n=> n.scale===scale).forEach(n=>{ let c=n; while(c){ keep.add(c.id); c=c.parentId?localById[c.parentId]:null; } });
    vis = nodes.filter(n=> keep.has(n.id));
  }
  const visSet=new Set(vis.map(n=>n.id));
  vis.forEach(n=>{ if(n.parentId && visSet.has(n.parentId)) localById[n.parentId]._vc.push(n); });
  (function val(n){ if(!n._vc.length){ n._val=n.im; return n._val; } let s=0; n._vc.forEach(c=>s+=val(c)); n._val=s; return n._val; })(vis.find(n=>!n.parentId)||vis[0]);
  return vis;
}
function sankeyLayout(vis){
  let cursor=SY;
  (function place(n){
    if(!n._vc.length){
      n._h=Math.max(MINH, n._val*UH);
      n._y=cursor; cursor += n._h + LGAP;
    } else {
      n._vc.forEach(place);
      const first=n._vc[0], last=n._vc[n._vc.length-1];
      n._y=first._y; n._h=(last._y+last._h)-first._y;
    }
  })(vis.find(n=>!n.parentId)||vis[0]);
  let maxD=0; vis.forEach(n=> maxD=Math.max(maxD,n.depth));
  vis.forEach(n=>{ n._x = SX + n.depth*(NODEW+COLGAP); });
  return maxD;
}

/* ============ 渲染 SVG（桑基流图） ============ */
let state={nodes:[], topId:null, scale:'all', viewMode:'sankey', quadQuickWin:false, meta:{weekReviews:[],bannerDismissedWeek:''}};
const byId=id=>state.nodes.find(n=>n.id===id);

function normalizeNode(n){
  if(n.slot==null) n.slot='';
  if(n.deadlineDate && typeof n.deadlineDate==='string') n.deadlineDate=new Date(n.deadlineDate);
  if(n.doneAt!=null && typeof n.doneAt==='string') n.doneAt=+new Date(n.doneAt);
  if(n.recur==null) n.recur=inferRecur(n.text,n.scale);
  if(n.touchedAt!=null && typeof n.touchedAt==='string') n.touchedAt=+new Date(n.touchedAt);
  ensureVE(n);
  return n;
}
function serializeNodes(nodes){
  return nodes.map(n=>({
    id:n.id,text:n.text,im:n.im,ur:n.ur,val:n.val,eff:n.eff,deadline:n.deadline||'',
    deadlineDate:n.deadlineDate?n.deadlineDate.getTime():null,
    daysLeft:n.daysLeft,overdue:!!n.overdue,done:!!n.done,doneAt:n.doneAt||null,
    touchedAt:n.touchedAt||null,estimateMinutes:n.estimateMinutes??null,actualMinutes:n.actualMinutes??null,
    recur:!!n.recur,scale:n.scale||null,
    parentId:n.parentId,slot:n.slot||''
  }));
}
function monthRange(offset){
  const t=today0();
  const start=new Date(t.getFullYear(),t.getMonth()+offset,1);
  const end=new Date(t.getFullYear(),t.getMonth()+offset+1,1);
  return {start,end};
}
function backlogLanes(){
  const {start}=weekRange();
  const prevStart=new Date(start); prevStart.setDate(prevStart.getDate()-7);
  const nextMo=monthRange(1);
  computeTree(state.nodes);
  const leaves=state.nodes.filter(n=>n.parentId&&n._children.length===0&&!n.done);
  const vis=state.nodes.length?buildView(state.nodes,state.scale):[];
  const topIds=new Set(pickRanked(vis,3).map(n=>n.id));
  const lastWeek=leaves.filter(n=>{
    if(topIds.has(n.id)) return false;
    if(n.deadlineDate){
      const ms=n.deadlineDate.getTime();
      if(ms>=prevStart.getTime()&&ms<start.getTime()) return true;
      if(ms<start.getTime()&&(n.overdue||n.daysLeft<0)) return true;
    }
    return n.overdue&&n.daysLeft!=null&&n.daysLeft<=-3;
  }).sort((a,b)=>focusScore(b)-focusScore(a)).slice(0,12);
  const nextMonth=leaves.filter(n=>{
    if(topIds.has(n.id)) return false;
    if(n.deadlineDate){
      const ms=n.deadlineDate.getTime();
      return ms>=nextMo.start.getTime()&&ms<nextMo.end.getTime();
    }
    return n.scale==='month'&&!n.deadlineDate;
  }).sort((a,b)=>(a.daysLeft==null?999:a.daysLeft)-(b.daysLeft==null?999:b.daysLeft)).slice(0,12);
  return {lastWeek,nextMonth};
}
function dayPlanFeasibility(){
  computeTree(state.nodes);
  const leaves=state.nodes.filter(n=>n.parentId&&!n.done&&n._children.length===0);
  const dayLeaves=leaves.filter(n=>n.scale==='day'||(n.deadlineDate&&n.daysLeft!=null&&n.daysLeft<=1));
  let est=0, act=0;
  dayLeaves.forEach(n=>{ ensureEstimate(n); est+=(n.estimateMinutes||0); act+=(n.actualMinutes||0); });
  return {est,act,count:dayLeaves.length,over:est>DAY_CAPACITY_MIN,cap:DAY_CAPACITY_MIN};
}
function nodesToIndentedText(){
  if(!state.nodes.length) return '';
  computeTree(state.nodes);
  return treeOrder(state.nodes).map(n=>{
    if(n.depth===0) return n.text;
    return '  '.repeat(n.depth)+'- '+n.text;
  }).join('\n');
}

function renderCanvas(){
  if(state.viewMode==='network') renderNetwork();
  else render();
}

function render(){
  const svg=document.getElementById('diagram-svg');
  const nodes=state.nodes;
  if(!nodes.length){ svg.innerHTML=''; svg.setAttribute('viewBox','0 0 100 100'); svg.removeAttribute('width'); svg.removeAttribute('height'); return; }
  const vis=buildView(nodes, state.scale);
  const maxD=sankeyLayout(vis);
  const topId=state.topId;
  // 金线：top 的祖先链（目标→…→任务）
  const goldEdges=new Set();
  if(topId){
    let cur=byId(topId); const chain=[];
    while(cur){ chain.push(cur.id); cur=cur.parentId?byId(cur.parentId):null; }
    for(let i=0;i<chain.length-1;i++) goldEdges.add(chain[i+1]+'>'+chain[i]); // 父>子
  }
  const map={}; vis.forEach(n=>map[n.id]=n);

  let maxX=0,maxY=0;
  vis.forEach(n=>{ if(n._x+NODEW+LBL>maxX)maxX=n._x+NODEW+LBL; if(n._y+n._h>maxY)maxY=n._y+n._h; });
  const W=maxX+SX, H=maxY+SY+10;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('width',W); svg.setAttribute('height',H);

  // defs：金色发光 + 每条带渐变
  let defs=`<defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#f5c451" flood-opacity="0.95"/>
    </filter>
    <filter id="softglow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${COLORS.svgGlow || '#5b9fd4'}" flood-opacity="0.5"/>
    </filter>`;
  vis.forEach(n=>{
    if(!n.parentId) return;
    const p=map[n.parentId]; if(!p) return;
    const id='g_'+n.id;
    const isGold=goldEdges.has(p.id+'>'+n.id);
    if(isGold){
      defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f5c451"/><stop offset="1" stop-color="#ffd97a"/></linearGradient>`;
    } else {
      defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${urColor(p.ur)}"/><stop offset="1" stop-color="${urColor(n.ur)}"/></linearGradient>`;
    }
  });
  defs+=`</defs>`;

  // 条带
  let ribbons='', nodesSvg='';
  const colBottom={};   // 同列分支标签的已占用底部 y（防碰撞）
  vis.forEach(n=>{
    if(!n.parentId) return;
    const p=map[n.parentId]; if(!p) return;
    const id='g_'+n.id;
    const isGold=goldEdges.has(p.id+'>'+n.id);
    const sibs=p._vc.slice().sort((a,b)=>a._y-b._y);
    const used=sibs.reduce((s,c)=>s+c._h,0)+(sibs.length-1)*LGAP;
    let off=p._y+(p._h-used)/2;
    let si=sibs.indexOf(n);
    for(let k=0;k<si;k++) off+=sibs[k]._h+LGAP;
    const x0=p._x+NODEW, x1=n._x, cx=(x0+x1)/2, h=n._h, oy0=off, oy1=n._y;
    const d=`M${x0},${oy0} C${cx},${oy0} ${cx},${oy1} ${x1},${oy1} L${x1},${oy1+h} C${cx},${oy1+h} ${cx},${oy0+h} ${x0},${oy0+h} Z`;
    const isNoise = (category(n.im,n.ur).key==='noise') && !isGold;
    const op = n.done?0.12 : (isGold?0.92 : (isNoise?0.28:0.45));
    ribbons+=`<path class="ribbon${isGold?' hot':''}" data-p="${p.id}" data-c="${n.id}" d="${d}"
      fill="${isNoise?'#7c8295':`url(#${id})`}" opacity="${op}" ${isGold?'filter="url(#glow)"':''}></path>`;
  });

  // 节点 + 标签
  vis.forEach(n=>{
    const isRoot=(!n.parentId);
    const isTop=(n.id===topId);
    const inGold = topId && (function(){let c=byId(topId);while(c){if(c.id===n.id)return true;c=c.parentId?byId(c.parentId):null;}return false;})();
    const c=category(n.im,n.ur);
    const isNoiseNode = !inGold && category(n.im,n.ur).key==='noise';
    let barFill = isRoot ? 'rgba(255,255,255,.55)' : (inGold ? 'url(#g_'+n.id+')' : (isNoiseNode ? 'rgba(150,158,180,.5)' : urColor(n.ur)));
    let stroke = isTop? 'var(--gold)' : (inGold? 'rgba(245,196,81,.7)' : 'rgba(255,255,255,.25)');
    let sw = isTop?2.4:(inGold?1.8:1);
    let filt = (isTop||inGold)?'filter="url(#glow)"':'';
    const scaleTag = (n.scale && n.scale!=='long') ? {t:SCALE_LABEL[n.scale]||'', cls:'nlabel sub', col:COLORS.scaleLabel || '#7eb8e0'} : null;
    nodesSvg+=`<g class="node${isTop?' hot':''}" data-id="${n.id}">
      <rect class="nbar" x="${n._x}" y="${n._y}" width="${NODEW}" height="${n._h}" rx="5"
        fill="${barFill}" stroke="${stroke}" stroke-width="${sw}" ${filt}
        opacity="${n.done?0.35:1}"></rect>`;
    const lines=wrapLabel(n.text);
    const isLeaf=(n._vc.length===0);
    const dlLine = (n.deadline && !n.done) ? (n.overdue?`逾期${-n.daysLeft}天`:`${n.deadline}·剩${n.daysLeft}天`) : null;
    const all=[{t:(n.done?'✓ ':'')+lines[0], cls:'nlabel'}];
    for(let i=1;i<lines.length;i++) all.push({t:lines[i], cls:'nlabel'});
    if(dlLine) all.push({t:'⏱ '+dlLine, cls:'nlabel sub', col:n.overdue?'#ef5d6b':'#8a93ab'});
    if(scaleTag) all.push(scaleTag);
    const LH=16;
    let tx, ty;
    if(isLeaf){ tx=n._x+NODEW+10; ty=n._y+n._h/2-(all.length-1)*LH/2+4.5; }
    else {
      // 分支标签放条上方；若与同列上一个标签碰撞则退到右侧
      const topNeed=n._y-8-(all.length-1)*LH;
      const d=n.depth;
      if(colBottom[d]!=null && topNeed < colBottom[d]){ tx=n._x+NODEW+10; ty=n._y+n._h/2-(all.length-1)*LH/2+4.5; }
      else { tx=n._x; ty=topNeed; }
      colBottom[d]=Math.max(colBottom[d]||0, ty+all.length*LH);
    }
    let txt='';
    all.forEach(L=>{ txt+=`<tspan x="${tx}" y="${ty}" class="${L.cls}"${L.col?` fill="${L.col}"`:''}>${esc(L.t)}</tspan>`; ty+=LH; });
    nodesSvg+=`<text>${txt}</text></g>`;
  });

  svg.innerHTML=defs+ribbons+nodesSvg;
  bindDiagramHover();
}

/* ============ 网络 / 关系图（桑基之外的第二视角） ============ */
function renderNetwork(){
  const svg=document.getElementById('diagram-svg');
  const nodes=state.nodes;
  if(!nodes.length){ svg.innerHTML=''; svg.setAttribute('viewBox','0 0 100 100'); svg.removeAttribute('width'); svg.removeAttribute('height'); return; }
  const vis=buildView(nodes, state.scale);
  computeTree(state.nodes);
  sankeyLayout(vis);
  const topId=state.topId;
  const map={}; vis.forEach(n=>map[n.id]=n);
  let maxX=0,maxY=0;
  vis.forEach(n=>{
    const cx=n._x+NODEW/2, cy=n._y+n._h/2;
    if(cx+20>maxX) maxX=cx+20;
    if(cy+20>maxY) maxY=cy+20;
  });
  const W=maxX+SX+40, H=maxY+SY+40;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  let edges='', dots='';
  vis.forEach(n=>{
    if(!n.parentId) return;
    const p=map[n.parentId]; if(!p) return;
    const x0=p._x+NODEW/2, y0=p._y+p._h/2, x1=n._x+NODEW/2, y1=n._y+n._h/2;
    const isTopChain=(function(){let c=byId(topId); while(c){if(c.id===n.id||c.id===p.id)return true;c=c.parentId?byId(c.parentId):null;}return false;})();
    const stroke=isTopChain?'#f5c451':urColor(n.ur);
    const sw=isTopChain?2.4:1.2;
    const op=n.done?0.2:0.55;
    edges+=`<line class="net-edge${isTopChain?' hot':''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${op}"/>`;
  });
  vis.forEach(n=>{
    const cx=n._x+NODEW/2, cy=n._y+n._h/2;
    const r=Math.max(7, Math.min(16, 6+n.im*1.6));
    const isTop=(n.id===topId);
    const inGold=topId&&(function(){let c=byId(topId);while(c){if(c.id===n.id)return true;c=c.parentId?byId(c.parentId):null;}return false;})();
    const fill=inGold?'#f5c451':(category(n.im,n.ur).color);
    const stroke=isTop?'#fff':(inGold?'#ffd97a':'rgba(255,255,255,.35)');
    const sw=isTop?2:1;
    dots+=`<g class="node${isTop?' hot':''}" data-id="${n.id}">
      <circle class="nbar" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${n.done?0.35:0.92}" stroke="${stroke}" stroke-width="${sw}" ${isTop||inGold?'filter="url(#glow)"':''}/>
      <text class="nlabel" x="${cx+r+8}" y="${cy+4}" font-size="12">${esc(wrapLabel(n.text)[0])}</text>
    </g>`;
  });
  const defs=`<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#f5c451" flood-opacity="0.9"/></filter></defs>`;
  svg.innerHTML=defs+edges+dots;
  bindDiagramHover();
}

/* ============ 四象限校准（拖拽归位） ============ */
function quadNodes(){
  // 只取「当前缩放尺度可见」的非根节点（与精力流向图尺度过滤一致）
  let list=state.nodes.filter(n=> n.parentId);
  if(state.scale!=='all') list=list.filter(n=> n.scale===state.scale);
  if(state.quadQuickWin) list=list.filter(n=> isQuickWin(n));
  return list;
}
function vePanelNodes(){
  let list=state.nodes.filter(n=>n.parentId&&!n.done);
  if(state.scale!=='all') list=list.filter(n=>n.scale===state.scale);
  return list;
}
function makeQuadCard(n){
  const c=category(n.im,n.ur);
  const isTop=(n.id===state.topId);
  const card=document.createElement('div'); card.className='qcard'+(isTop?' istop':''); card.dataset.id=n.id;
  card.style.borderLeftColor=isTop?'var(--gold)':c.color;
  const h=document.createElement('div'); h.className='qh'; h.draggable=true; h.dataset.id=n.id; h.title=n.text; h.textContent=(isTop?'★ ':'')+n.text;
  h.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',n.id); e.dataTransfer.effectAllowed='move'; card.classList.add('dragging'); });
  h.addEventListener('dragend',()=> card.classList.remove('dragging'));
  const scaleOpts=['','day','week','month','year','long'].map(k=>`<option value="${k}"${n.scale===k?' selected':''}>${k==='day'?'每日':k==='week'?'每周':k==='month'?'每月':k==='year'?'年度':k==='long'?'长期':'尺度'}</option>`).join('');
  const slotOpts=DAY_SLOTS.map(([k,l])=>`<option value="${k}"${(n.slot||'')===k?' selected':''}>${l}</option>`).join('');
  const isLeaf=!n._children.length;
  const body=document.createElement('div'); body.className='qbody';
  if(isQuickWin(n)) card.classList.add('qcard-qw');
  body.innerHTML=`
    <span class="qstep">重<button data-k="im" data-d="-1">−</button><b>${n.im}</b><button data-k="im" data-d="1">+</button></span>
    <span class="qstep">急<button data-k="ur" data-d="-1">−</button><b>${n.ur}</b><button data-k="ur" data-d="1">+</button></span>
    <span class="qstep" title="价值">值<button data-k="val" data-d="-1">−</button><b>${n.val}</b><button data-k="val" data-d="1">+</button></span>
    <span class="qstep" title="费力">力<button data-k="eff" data-d="-1">−</button><b>${n.eff}</b><button data-k="eff" data-d="1">+</button></span>
    <label class="qdone"><input type="checkbox" ${n.done?'checked':''}>✓</label>
    <select class="qscale">${scaleOpts}</select>
    ${isLeaf?`<select class="qslot" title="日视图时段">${slotOpts}</select>`:''}
    ${isLeaf?'<button class="qmicro" title="拆出 5 分钟微动作">🫳</button>':''}
    <button class="qai" title="SMART 对话拆解">🤖</button>`;
  card.appendChild(h); card.appendChild(body);
  card.addEventListener('mouseenter',()=>highlightNode(n.id,true));
  card.addEventListener('mouseleave',()=>highlightNode(n.id,false));
  body.querySelectorAll('button[data-k]').forEach(b=> b.onclick=()=>{ const nd=byId(n.id); nd[b.dataset.k]=clamp((+nd[b.dataset.k])+(+b.dataset.d),1,5); if(b.dataset.k==='im') nd.val=Math.max(nd.val,nd.im); save(); afterChange(); });
  body.querySelector('.qdone input').onchange=e=>{ setNodeDone(byId(n.id),e.target.checked); save(); afterChange(); };
  body.querySelector('.qscale').onchange=e=>{ byId(n.id).scale=e.target.value||null; save(); afterChange(); };
  const slotEl=body.querySelector('.qslot');
  if(slotEl) slotEl.onchange=e=>{ byId(n.id).slot=e.target.value||''; byId(n.id).scale=byId(n.id).scale||'day'; save(); afterChange(); };
  const micro=body.querySelector('.qmicro');
  if(micro) micro.onclick=()=> addMicroAction(n.id);
  body.querySelector('.qai').onclick=()=> openSmart(n.id);
  return card;
}
function renderQuadrant(){
  const wrap=document.getElementById('quadGrid'); if(!wrap) return;
  computeTree(state.nodes);
  const nodes=quadNodes();
  const buckets={now:[],core:[],distract:[],noise:[]};
  nodes.forEach(n=>{ const k=category(n.im,n.ur).key; (buckets[k]||buckets.noise).push(n); });
  wrap.innerHTML='';
  QUAD_ORDER.forEach(q=>{
    const cell=document.createElement('div'); cell.className='quad-cell'; cell.dataset.q=q;
    const head=document.createElement('div'); head.className='quad-head'; head.innerHTML=QUAD[q].icon+' '+QUAD[q].label; cell.appendChild(head);
    const drop=document.createElement('div'); drop.className='qdrop'; drop.dataset.q=q;
    if(!buckets[q].length){ const e=document.createElement('div'); e.className='qempty'; e.textContent='— 把任务卡拖到这儿 —'; drop.appendChild(e); }
    buckets[q].forEach(n=> drop.appendChild(makeQuadCard(n)));
    drop.addEventListener('dragover',e=>{ e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave',()=> drop.classList.remove('over'));
    drop.addEventListener('drop',e=>{ e.preventDefault(); drop.classList.remove('over'); const id=e.dataTransfer.getData('text/plain'); applyQuadDrop(id,q); });
    cell.appendChild(drop); wrap.appendChild(cell);
  });
  renderVeMatrix();
}
function renderVeMatrix(){
  const wrap=document.getElementById('veGrid'); if(!wrap) return;
  const nodes=vePanelNodes();
  const buckets={quick:[],major:[],easy:[],trap:[]};
  nodes.forEach(n=>{ (buckets[veKey(n.val,n.eff)]||buckets.trap).push(n); });
  const toggle=document.getElementById('btnQuickWin');
  if(toggle) toggle.classList.toggle('on',!!state.quadQuickWin);
  wrap.innerHTML='';
  VE_ORDER.forEach(k=>{
    const cell=document.createElement('div'); cell.className='ve-cell'; cell.dataset.ve=k;
    const head=document.createElement('div'); head.className='ve-head';
    head.innerHTML=`${VE[k].icon} ${VE[k].label} <span class="ve-cnt">${buckets[k].length}</span>`;
    head.style.borderLeftColor=VE[k].color;
    cell.appendChild(head);
    const list=document.createElement('div'); list.className='ve-list';
    if(!buckets[k].length){ const e=document.createElement('div'); e.className='ve-empty'; e.textContent='—'; list.appendChild(e); }
    buckets[k].slice(0,6).forEach(n=>{
      const row=document.createElement('div'); row.className='ve-row'+(isQuickWin(n)?' qw':'');
      row.textContent=n.text.length>28?n.text.slice(0,28)+'…':n.text;
      row.title=`值 ${n.val} · 力 ${n.eff}`;
      list.appendChild(row);
    });
    if(buckets[k].length>6){ const more=document.createElement('div'); more.className='ve-more'; more.textContent=`+${buckets[k].length-6} 项`; list.appendChild(more); }
    cell.appendChild(list); wrap.appendChild(cell);
  });
}
function applyQuadDrop(id,q){
  const n=byId(id); if(!n) return;
  const v=QUAD[q].val; n.im=v.im; n.ur=v.ur; save(); afterChange();
}
function highlightNode(id,on){
  const g=document.getElementById('diagram-svg').querySelector('g.node[data-id="'+id+'"]');
  const svg=document.getElementById('diagram-svg');
  if(g){ svg.classList.add('hovering'); g.classList.add('hot');
    svg.querySelectorAll('.ribbon[data-c="'+id+'"],.ribbon[data-p="'+id+'"]').forEach(r=>r.classList.add('hot')); }
  if(!on){ svg.classList.remove('hovering'); g&&g.classList.remove('hot');
    svg.querySelectorAll('.ribbon.hot').forEach(r=>r.classList.remove('hot')); }
  highlightQuad(id,on);
}
function highlightQuad(id,on){const c=document.querySelector('.qcard[data-id="'+id+'"]'); if(c) c.classList.toggle('hl',on);}
function bindDiagramHover(){
  document.querySelectorAll('#diagram-svg g.node').forEach(g=>{
    const id=g.dataset.id;
    g.addEventListener('mouseenter',()=>{
      const svg=document.getElementById('diagram-svg');
      svg.classList.add('hovering'); g.classList.add('hot');
      svg.querySelectorAll('.ribbon[data-c="'+id+'"],.ribbon[data-p="'+id+'"]').forEach(r=>r.classList.add('hot'));
      highlightQuad(id,true);
    });
    g.addEventListener('mouseleave',()=>{
      const svg=document.getElementById('diagram-svg');
      svg.classList.remove('hovering'); g.classList.remove('hot');
      svg.querySelectorAll('.ribbon.hot').forEach(r=>r.classList.remove('hot'));
      highlightQuad(id,false);
    });
  });
}

/* ============ 英雄卡：当下最重要（按尺度） ============ */
function renderHero(){
  const box=document.getElementById('hero');
  const vis = state.nodes.length ? buildView(state.nodes, state.scale) : [];
  const top = vis.length ? pickTop(vis) : null;
  state.topId = top? top.id : null;
  if(!top){
    box.className='hero empty';
    box.innerHTML='<div class="hero-main">暂无待办——把你的目标粘进来，或点击「载入示例」。</div>';
    return;
  }
  box.className='hero';
  const dl = top.deadlineDate ? (top.overdue?`已逾期 ${-top.daysLeft} 天`:`剩余 ${top.daysLeft} 天`) : '无明确期限 · 长期主线';
  const c=category(top.im,top.ur);
  const why = top.overdue ? '已超期，最该立刻处理'
            : top.daysLeft!=null&&top.daysLeft<=3 ? '期限临近且重要，优先拿下'
            : top.im>=4&&top.ur<4 ? '重要不紧急，是长期主线，要提前投入'
            : '重要且紧急，立刻做';
  const scaleTag = state.scale==='all' ? '当下最重要' : (SCALE_LABEL[state.scale]+'最重要');
  const ranked=pickRanked(vis,3);
  const alts=ranked.filter(n=>n.id!==top.id).slice(0,2);
  const prog=subtreeProgress(top);
  const progPill=prog?`<span class="pill">📈 子树 ${prog.pct}%（${prog.done}/${prog.total}）</span>`:'';
  let altHtml='';
  if(alts.length){
    altHtml=`<div class="hero-stack"><div class="hs-lbl">执行栈 · 仍可优先（Top ${alts.length+1} 之 ${alts.length>1?'②③':'②'}）</div>`+
      alts.map((n,i)=>`<div class="hero-alt"><span class="rank">#${i+2}</span><b>${esc(n.text)}</b></div>`).join('')+'</div>';
  }
  box.innerHTML=`<div class="hero-main"><span class="hero-star">★</span> ${scaleTag}：<b>${esc(top.text)}</b></div>
    <div class="hero-sub">
      <span class="pill"><span class="dot" style="background:${c.color}"></span>${c.label}</span>
      <span class="pill">⏱ ${esc(dl)}</span>
      <span class="pill">重要 ${top.im} · 紧急 ${top.ur}</span>
      ${progPill}
      <span class="why">▶ ${why}</span>
    </div>${altHtml}`;
}

/* ============ 顶部比例尺（随尺度缩放切换） ============ */
// 把当前尺度映射成一组时间桶（像地图比例尺一样随缩放换单位）
function timeBuckets(scale, today){
  const t = today ? new Date(today) : new Date(TODAY);
  if(scale==='all'){
    const y=t.getFullYear();
    const bs=[];
    for(let m=0;m<12;m++){ const s=new Date(y,m,1), e=new Date(y,m+1,1); bs.push({key:'m'+m,label:(m+1)+'月',sub:'',start:s,end:e}); }
    return {title:'年度精力节奏', sub:`${y} 年 · 12 个月`, buckets:bs};
  }
  if(scale==='month'){
    const y=t.getFullYear(), m=t.getMonth();
    const start=new Date(y,m,1), end=new Date(y,m+1,1);
    const bs=[]; let wk=0; let d=new Date(start);
    while(d<end){
      const ws=new Date(d);
      const dow=(d.getDay()+6)%7; const span=6-dow;
      let we=new Date(d); we.setDate(we.getDate()+span+1);
      if(we>end) we=end;
      bs.push({key:'w'+wk,label:'第'+(wk+1)+'周',sub:ws.getDate()+'日',start:new Date(ws),end:new Date(we)});
      d=new Date(we); wk++;
    }
    return {title:'本月精力节奏', sub:`${m+1} 月 · ${bs.length} 周`, buckets:bs};
  }
  if(scale==='week'){
    const d=new Date(t); const dow=(d.getDay()+6)%7; d.setDate(d.getDate()-dow);
    const wn=['一','二','三','四','五','六','日']; const bs=[];
    for(let i=0;i<7;i++){ const day=new Date(d); day.setDate(d.getDate()+i); const s=new Date(day); s.setHours(0,0,0,0); const e=new Date(day); e.setHours(24,0,0,0); bs.push({key:'d'+i,label:'周'+wn[i],sub:day.getDate()+'日',start:s,end:e}); }
    return {title:'本周精力节奏', sub:'7 天', buckets:bs};
  }
  if(scale==='day'){
    const blocks=[['清晨',0,6],['上午',6,9],['中午',9,12],['午后',12,15],['下午',15,18],['傍晚',18,21],['夜间',21,24]];
    const bs=blocks.map((b,i)=>{ const s=new Date(t); s.setHours(b[1],0,0,0); const e=new Date(t); e.setHours(b[2],0,0,0); return {key:'h'+i,label:b[0],sub:'',start:s,end:e}; });
    return {title:'今日精力节奏', sub:'一天 · 7 个时段', buckets:bs};
  }
  return {title:'',sub:'',buckets:[]};
}
function bucketOfDate(date, buckets){
  for(const b of buckets){ if(date>=b.start && date<b.end) return b; }
  return null;
}
const scaleUnit=s=> s==='all'?'月': s==='month'?'周': s==='week'?'天': s==='day'?'时段':'期';

function renderRhythm(){
  const box=document.getElementById('rhythm'); if(!box) return;
  let capHtml='';
  if(state.scale==='day'&&state.nodes.length){
    const d=dayPlanFeasibility();
    const pct=Math.min(100,Math.round(d.est/d.cap*100));
    const ok=!d.over;
    capHtml=`<div class="day-capacity${ok?'':' over'}" title="今日待办叶子预估合计 vs 默认 ${d.cap} 分钟容量">
      <span>今日可做完性</span>
      <span class="dc-bar"><i style="width:${pct}%"></i></span>
      <span class="dc-num">预估 ${d.est} 分${d.act?` / 已计 ${d.act} 分`:''} · ${d.count} 项</span>
      <span class="dc-tag">${ok?'可承载':'超负荷'}</span>
    </div>`;
  }
  const {title, sub, buckets}=timeBuckets(state.scale, TODAY);
  const load=buckets.map(()=>({val:0,ur:0,cnt:0}));
  let anyDeadline=false;
  state.nodes.forEach(n=>{ if(n.deadlineDate) anyDeadline=true; });
  // 1) 带具体期限的节点 → 落入对应桶
  state.nodes.forEach(n=>{
    if(!n.deadlineDate) return;
    const b=bucketOfDate(n.deadlineDate, buckets);
    if(b){ const i=buckets.indexOf(b); load[i].val+=n.im; load[i].ur+=n.ur; load[i].cnt++; }
  });
  // 2) 例行 / 周期性节点（无具体期限、尺度与当前视图一致）→ 平摊到各桶，呈现“基线节奏”
  if(state.scale!=='all'){
    state.nodes.forEach(n=>{
      if(n.deadlineDate) return;
      const routine=n.recur || inferRecur(n.text,n.scale);
      const scaleMatch=n.scale===state.scale;
      const crossRoutine=(state.scale==='week'&&n.scale==='day'&&routine) || (state.scale==='day'&&n.scale==='week'&&routine);
      if(!scaleMatch && !crossRoutine) return;
      const each=n.im/buckets.length;
      buckets.forEach((b,i)=>{ load[i].val+=each; load[i].cnt++; if(load[i].cnt===1) load[i].ur=n.ur; else load[i].ur=(load[i].ur+n.ur)/2; });
    });
  }
  const anyLoad=load.some(l=>l.val>0);
  if(state.scale==='all' && !anyDeadline){
    box.innerHTML=capHtml+'<div class="rhint">给目标加上「3月15日 / 本月底 / 周五前」这类期限，这里会显示全年精力节奏——看清精力在哪几个月扎堆。</div>'; return;
  }
  if(!anyLoad && state.scale!=='all'){
    box.innerHTML=`<div class="rhint">当前「${SCALE_LABEL[state.scale]}」尺度下还没有带期限的精力投入；切到「年度总览」可看全年节奏，或在目标里加上「${state.scale==='day'?'今天/每天':state.scale==='week'?'本周内/每周':'本月底/每月'}」这样的时间词。</div>`;
    // 仍渲染空比例尺，让用户看到尺度已切换
    const max=1; const tnow=new Date(TODAY);
    let hint=`<div class="rtitle">📊 ${title}（条高 = 该${scaleUnit(state.scale)}的重要度之和 · 红=越急）<span class="rsub2">${sub}</span></div><div class="rbars">`;
    buckets.forEach(b=>{ const isCur=(tnow>=b.start&&tnow<b.end); hint+=`<div class="rcol${isCur?' cur':''}" title="${b.label}"><div class="rbar" style="height:5px;background:rgba(255,255,255,.10)"></div><div class="rmo">${b.label}</div>${b.sub?`<div class="rsub">${b.sub}</div>`:''}</div>`; });
    hint+='</div>';
    box.innerHTML=capHtml+hint; return;
  }
  const max=Math.max(1,...load.map(l=>l.val));
  const tnow=new Date(TODAY);
  let html=capHtml+`<div class="rtitle">📊 ${title}（条高 = 该${scaleUnit(state.scale)}的重要度之和 · 红=越急）<span class="rsub2">${sub}</span></div><div class="rbars">`;
  const slotTasks={};
  if(state.scale==='day'){
    state.nodes.filter(n=>n.parentId&&!n.done).forEach(n=>{
      let slot=n.slot||'';
      if(!slot && (n.recur||n.scale==='day') && !n.deadlineDate) slot='h1';
      if(!slot) return;
      if(!slotTasks[slot]) slotTasks[slot]=[];
      const label=(n.recur&&!n.slot?'🔁 ':'')+n.text;
      slotTasks[slot].push(label);
    });
  }
  if(state.scale==='week'){
    state.nodes.filter(n=>n.parentId&&!n.done&&(n.recur||(n.scale==='week'&&!n.deadlineDate))).forEach(n=>{
      buckets.forEach((b,i)=>{ if(!slotTasks[b.key]) slotTasks[b.key]=[]; slotTasks[b.key].push('🔁 '+n.text); });
    });
  }
  buckets.forEach((b,i)=>{
    const l=load[i];
    const h=Math.max(5, l.val/max*64);
    const ur = l.cnt? clamp(Math.round(l.ur/l.cnt),1,5): (l.val>0?3:1);
    const col = l.val>0? urColor(ur):'rgba(255,255,255,.10)';
    const isCur = (tnow>=b.start && tnow<b.end);
    const tasks=slotTasks[b.key]?`<div class="rhythm-tasks" title="${esc(slotTasks[b.key].join(' · '))}">${esc(slotTasks[b.key].slice(0,2).join(' · '))}${slotTasks[b.key].length>2?'…':''}</div>`:'';
    html+=`<div class="rcol${isCur?' cur':''}" title="${b.label}：重要度 ${l.val.toFixed(1)}${l.cnt?' · 平均紧急 '+(l.ur/l.cnt).toFixed(1):''}">
      <div class="rbar" style="height:${h}px;background:${col};box-shadow:0 0 10px ${col}55"></div>
      <div class="rmo">${b.label}</div>${b.sub?`<div class="rsub">${b.sub}</div>`:''}${tasks}</div>`;
  });
  html+='</div>';
  box.innerHTML=html;
}

/* ============ 聚焦清单（按尺度过滤） ============ */
function renderFocus(){
  const box=document.getElementById('todayFocus');
  let items=state.nodes.filter(n=>n.parentId&&!n.done);
  if(state.scale!=='all') items=items.filter(n=> n.scale===state.scale);
  const vis=state.nodes.length?buildView(state.nodes, state.scale):[];
  const top3=pickRanked(vis,3);
  const now=items.filter(n=>n.im>=4&&n.ur>=4).sort((a,b)=>focusScore(b)-focusScore(a));
  const core=items.filter(n=>n.im>=4&&n.ur<4).sort((a,b)=>focusScore(b)-focusScore(a));
  const li=(n,rank)=>{const dl=n.deadline?(n.overdue?`<span class="dl">⏰ 逾期${-n.daysLeft}天</span>`:`<span class="dl">⏱ ${esc(n.deadline)}·剩${n.daysLeft}天</span>`):'';
    const slot=n.slot?`<span class="dl">🕐 ${esc((DAY_SLOTS.find(s=>s[0]===n.slot)||['',''])[1])}</span>`:'';
    const est=n.estimateMinutes!=null?`<span class="dl">⏳ ${n.estimateMinutes}分</span>`:'';
    const act=n.actualMinutes!=null?`<span class="dl">✓ ${n.actualMinutes}分</span>`:'';
    const rk=rank!=null?`<span class="dl">#${rank}</span>`:'';
    return `<div class="fitem ${n.overdue?'overdue':''}">${rk}${esc(n.text)}${dl}${slot}${est}${act}</div>`;};
  const sc = state.scale==='all'?'全部' : (SCALE_LABEL[state.scale]+'重点');
  const top3Html=top3.length?`<div class="fgroup top3"><h3>★ 可完成焦点 Top ${top3.length}<span class="cnt">算法排序 · 不含 Backlog</span></h3>${top3.map((n,i)=>li(n,i+1)).join('')}</div>`:'';
  const lanes=backlogLanes();
  const lane=arr=>arr.length?arr.map(n=>li(n)).join(''):'<div class="hint" style="color:var(--muted-2)">暂无</div>';
  box.innerHTML=`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">当前视图：${sc}${state.scale==='all'?'（含各尺度）':''}</div>
    ${top3Html}
    <div class="fgroup now"><h3>🔴 立即做（重要且紧急）<span class="cnt">${now.length} 项</span></h3>${now.length?now.map(n=>li(n)).join(''):'<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup core"><h3>🔵 核心投入（重要不紧急）<span class="cnt">${core.length} 项</span></h3>${core.length?core.map(n=>li(n)).join(''):'<div class="hint" style="color:var(--muted-2)">暂无</div>'}</div>
    <div class="fgroup backlog lw"><h3>🌊 上周未完成 Backlog<span class="cnt">${lanes.lastWeek.length} 项</span></h3>${lane(lanes.lastWeek)}</div>
    <div class="fgroup backlog nm"><h3>🔭 下月预告<span class="cnt">${lanes.nextMonth.length} 项</span></h3>${lane(lanes.nextMonth)}</div>`;
}

/* ============ 内联树编辑（Planner 式维护） ============ */
function deleteNode(id){
  const root=state.nodes[0];
  if(!root||id===root.id) return;
  const drop=new Set();
  (function w(nid){ drop.add(nid); state.nodes.filter(x=>x.parentId===nid).forEach(c=>w(c.id)); })(id);
  state.nodes=state.nodes.filter(n=>!drop.has(n.id));
  if(drop.has(state.topId)) state.topId=null;
  recomputeSchedule(state.nodes); save(); afterChange();
}
function addTreeChild(pid){
  const parent=byId(pid); if(!parent) return;
  insertChildren(pid,['新子任务（可在此编辑）']);
}
function renderTreeEditor(){
  const box=document.getElementById('treeEditor'); if(!box) return;
  const hint=document.getElementById('treeEditorHint');
  if(!state.nodes.length){
    box.innerHTML='<div class="hint">解析后在此维护，无需重新粘贴全文。</div>';
    return;
  }
  computeTree(state.nodes);
  ensureAllEstimates();
  box.innerHTML='';
  treeOrder(state.nodes).forEach(n=>{
    const isLeaf=n.parentId&&n._children.length===0;
    const row=document.createElement('div');
    row.className='trow'+(n.id===state.topId?' trow-top':'');
    row.style.paddingLeft=(n.depth*12+6)+'px';
    const txt=document.createElement('input');
    txt.className='gf-input trow-txt'; txt.value=n.text; txt.dataset.id=n.id;
    txt.title=n.text;
    const meta=document.createElement('span');
    meta.className='trow-meta'; meta.textContent=isLeaf?'叶':'枝';
    row.appendChild(txt); row.appendChild(meta);
    if(isLeaf){
      const est=document.createElement('input');
      est.type='number'; est.min='0'; est.step='5'; est.className='trow-est';
      est.value=n.estimateMinutes??''; est.placeholder='分'; est.title='预估时长'; est.dataset.id=n.id;
      const act=document.createElement('input');
      act.type='number'; act.min='0'; act.step='5'; act.className='trow-act';
      act.value=n.actualMinutes??''; act.placeholder='实'; act.title='实际时长'; act.dataset.id=n.id;
      row.appendChild(est); row.appendChild(act);
      const done=document.createElement('label');
      done.className='trow-done';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!n.done; cb.dataset.id=n.id;
      done.appendChild(cb); done.appendChild(document.createTextNode('✓'));
      row.appendChild(done);
    }
    const child=document.createElement('button');
    child.type='button'; child.className='gf-btn gf-btn--sm'; child.textContent='+子'; child.dataset.act='child'; child.dataset.id=n.id;
    row.appendChild(child);
    if(n.parentId){
      const del=document.createElement('button');
      del.type='button'; del.className='gf-btn gf-btn--sm gf-btn--ghost'; del.textContent='×'; del.dataset.act='del'; del.dataset.id=n.id;
      row.appendChild(del);
    }
    box.appendChild(row);
  });
  if(hint) hint.textContent=`共 ${state.nodes.length} 节点 · 叶子进度见顶栏（仅叶计完成）`;
  box.querySelectorAll('.trow-txt').forEach(inp=>{
    inp.onchange=()=>{ const n=byId(inp.dataset.id); if(!n) return; n.text=inp.value.trim()||n.text; applySuggestions(n,n.text); recomputeSchedule(state.nodes); save(); afterChange(); };
  });
  box.querySelectorAll('.trow-est').forEach(inp=>{
    inp.onchange=()=>{ const n=byId(inp.dataset.id); if(!n) return; n.estimateMinutes=inp.value?clamp(+inp.value,1,999):null; save(); afterChange(); };
  });
  box.querySelectorAll('.trow-act').forEach(inp=>{
    inp.onchange=()=>{ const n=byId(inp.dataset.id); if(!n) return; n.actualMinutes=inp.value?clamp(+inp.value,0,9999):null; save(); afterChange(); };
  });
  box.querySelectorAll('.trow-done input').forEach(cb=>{
    cb.onchange=()=>{ const n=byId(cb.dataset.id); if(!n) return; setNodeDone(n,cb.checked); save(); afterChange(); };
  });
  box.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.id;
      if(btn.dataset.act==='child') addTreeChild(id);
      else if(btn.dataset.act==='del'&&confirm('删除该节点及其子树？')) deleteNode(id);
    };
  });
}
function syncTreeToInput(){
  const ta=document.getElementById('input');
  if(!ta||!state.nodes.length) return;
  ta.value=nodesToIndentedText();
}

/* ============ SMART 体检面板 ============ */
function renderSmart(){
  const box=document.getElementById('smartList'); if(!box) return;
  if(!state.nodes.length){ box.innerHTML='<div class="smart-empty">还没有目标。先粘贴你的计划，或点「载入示例」。</div>'; return; }
  const weak=state.nodes.filter(n=>!smartEval(n).smart && n.parentId);
  if(!weak.length){ box.innerHTML='<div class="smart-empty">✅ 当前所有目标都够 SMART（具体 / 可衡量 / 有期限）。如需挑战更高标准，可点任意目标行的「🤖 对话拆解」进一步细化。</div>'; return; }
  box.innerHTML='';
  weak.forEach(n=>{
    const ev=smartEval(n);
    const item=document.createElement('div'); item.className='smart-item';
    item.innerHTML=`<div class="si-tt"><span class="dot" style="background:${category(n.im,n.ur).color}"></span>${esc(n.text.slice(0,30))}</div>
      <div class="si-gaps">⚠ ${ev.gaps.join('；')}</div>
      <div class="si-btns">
        <button class="${BTN.aiSm || 'gf-btn gf-btn--ai gf-btn--sm'}" data-smart="${n.id}">🤖 对话拆解</button>
        <button class="${BTN.sm || 'gf-btn gf-btn--sm'}" data-decomp="${n.id}">⚡ 一键拆解</button>
      </div>`;
    box.appendChild(item);
  });
  box.querySelectorAll('button[data-smart]').forEach(b=> b.onclick=()=>openSmart(b.dataset.smart));
  box.querySelectorAll('button[data-decomp]').forEach(b=> b.onclick=()=>{ const id=b.dataset.decomp; quickDecompose(id); });
}
function quickDecompose(id){
  const n=byId(id); if(!n) return;
  const sugg=decomposeSuggestions(n);
  insertChildren(id, sugg);
}

/* ============ 插入子任务 ============ */
function insertChildren(pid, texts){
  const parent=byId(pid); if(!parent) return;
  const idx=state.nodes.findIndex(n=>n.id===pid);
  let maxId=state.nodes.reduce((m,n)=>Math.max(m, +(n.id||'n0').slice(1)||0), 0);
  const newNodes=texts.map(t=>{
    const node={id:'n'+(++maxId),text:t,im:Math.min(5,parent.im),ur:Math.min(5,parent.ur),val:null,eff:null,deadline:'',deadlineDate:null,daysLeft:null,overdue:false,done:false,doneAt:null,touchedAt:null,estimateMinutes:null,actualMinutes:null,recur:false,parentId:pid,scale:parent.scale,slot:''};
    applySuggestions(node,t); node.scale=parent.scale; return node;
  });
  state.nodes.splice(idx+1,0,...newNodes);
  recomputeSchedule(state.nodes); save(); afterChange();
}
function applyEnriched(id, text){
  const n=byId(id); if(!n) return;
  n.text=text; applySuggestions(n,text); n.scale=inferScale(text,n.deadlineDate,n.daysLeft,n._children.length>0);
  recomputeSchedule(state.nodes); save(); afterChange();
}

/* ============ SMART 对话弹窗 ============ */
function openSmart(id){
  const n=byId(id); if(!n) return;
  const overlay=document.getElementById('smartModal');
  const ev=smartEval(n);
  const qs=smartQuestions(n);
  const answers=new Array(qs.length).fill('');
  let qIndex=0;
  const conv=[]; // {role:'ai'|'me', text, qIndex}
  conv.push({role:'ai', text:`我看了「${n.text}」，它目前还不够 SMART：<br>${ev.gaps.map(g=>'· '+g).join('<br>')}<br>我来帮你一项项补齐。`, qIndex:0});
  conv.push({role:'ai', text:qs[0], qIndex:0});

  function scoreDots(v){
    const g=COLORS.gradSmartDot || ['#f5d78a','#5b9fd4'];
    let s=''; for(let i=1;i<=3;i++) s+=`<i style="background:${i<=v?`linear-gradient(135deg,${g[0]},${g[1]})`:'rgba(255,255,255,.14)'}"></i>`; return s;
  }
  function render(){
    const mask=document.getElementById('smartModal');
    const ss=['s','m','a','r','t'].map((k,i)=>{const keys=['具体 S','可衡量 M','可达 A','相关 R','有期限 T']; const val=ev[['s','m','a','r','t'][i]]||1;
      return `<div class="ss"><div class="ss-k">${keys[i]}</div><div class="ss-dots">${scoreDots(val)}</div></div>`;}).join('');
    const chatHtml=conv.map(m=>{
      if(m.role==='ai'){
        const tag = (m.qIndex!=null && m.text===qs[m.qIndex]) ? `<div class="qtag">助手提问 ${m.qIndex+1}/${qs.length}</div>` : '';
        return `<div class="bub ai">${tag}${m.text}</div>`;
      }
      return `<div class="bub me">${esc(m.text)}</div>`;
    }).join('');
    const assembled = answers.filter(a=>a.trim()).length ? buildAssembled(n, qs, answers) : '';
    const assembledHtml = assembled ? `<div class="assembled">📌 补充后的目标：<br>${esc(assembled)}</div>` : '';
    mask.innerHTML=`
      <div class="modal">
        <div class="modal-head">
          <div class="mh-ic">🤖</div>
          <div><div class="mh-tt">SMART 对话拆解</div><div class="mh-sub">${esc(n.text)}</div></div>
          <div class="mh-x" id="mClose">×</div>
        </div>
        <div class="smartscores">${ss}</div>
        <div class="chat" id="chatBox">${chatHtml}</div>
        <div class="chat-input">
          <input id="chatIn" placeholder="回答助手的问题，或补充任何信息…" ${qIndex>=qs.length?'disabled':''}>
          <button class="${BTN.primarySm || 'gf-btn gf-btn--primary gf-btn--sm'}" id="chatSend" ${qIndex>=qs.length?'disabled':''}>${qIndex>=qs.length?'已问完':'回答'}</button>
        </div>
        <div class="modal-foot">
          <button class="${BTN.ai || 'gf-btn gf-btn--ai'}" id="mAI">✨ AI 深度拆解${getLLMKey()?'(已连密钥)':'(需密钥)'}</button>
          <button class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="mApply" ${assembled?'':'disabled'}>采用补充并替换</button>
          <button id="mDecomp">⚡ 一键拆成子任务</button>
          <button class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="mCancel">关闭</button>
        </div>
        ${assembledHtml?`<div style="padding:0 20px 14px">${assembledHtml}</div>`:''}
      </div>`;
    document.getElementById('mClose').onclick=closeSmart;
    document.getElementById('mCancel').onclick=closeSmart;
    document.getElementById('mApply').onclick=()=>{ if(assembled) applyEnriched(id, assembled); closeSmart(); };
    document.getElementById('mDecomp').onclick=()=>{ const sugg=decomposeSuggestions(n); insertChildren(id, sugg); closeSmart(); };
    document.getElementById('mAI').onclick=()=>aiDecompose(id, n);
    const send=()=>{
      const inp=document.getElementById('chatIn'); const v=inp.value.trim(); if(!v) return;
      if(qIndex<qs.length) answers[qIndex]=v;
      conv.push({role:'me', text:v});
      qIndex++;
      if(qIndex<qs.length){ conv.push({role:'ai', text:qs[qIndex], qIndex}); }
      else { conv.push({role:'ai', text:'信息已收集齐全 ✅ 下方「补充后的目标」是我帮你整合的版本，可以「采用并替换」，或「一键拆成子任务」付诸行动。'}); }
      render();
      const cb=document.getElementById('chatBox'); if(cb) cb.scrollTop=cb.scrollHeight;
    };
    document.getElementById('chatSend').onclick=send;
    document.getElementById('chatIn').addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
    const cb=document.getElementById('chatBox'); if(cb) cb.scrollTop=cb.scrollHeight;
  }
  render();
  overlay.classList.add('show');
}
function buildAssembled(n, qs, answers){
  const parts=[n.text];
  answers.forEach((a,i)=>{ if(a.trim()){ const tag=qs[i].slice(0,2); parts.push((i===0?'指标:':i===1?'期限:':i===2?'步骤:':'补充:')+a.trim()); } });
  return parts.join(' ｜ ');
}
function closeSmart(){ document.getElementById('smartModal').classList.remove('show'); document.getElementById('smartModal').innerHTML=''; }
async function aiDecompose(id, n){
  const box=document.getElementById('chatBox'); if(!box) return;
  const typing=document.createElement('div'); typing.className='typing'; typing.textContent='AI 正在深度拆解…'; box.appendChild(typing); box.scrollTop=box.scrollHeight;
  const sys='你是一个目标拆解助手。用户会给你一个目标。请把它拆解成 3 个具体、可衡量、有 owner 感的小步骤，每步一行，以「1. 」开头，不要解释。';
  const out=await callLLM(sys, '目标：'+n.text+(n.deadline?' 期限：'+n.deadline:''));
  typing.remove();
  if(!out){ const t=document.createElement('div'); t.className='bub ai'; t.textContent='未检测到 DeepSeek 密钥或调用失败，已自动改用内置规则引擎拆解。'; box.appendChild(t); box.scrollTop=box.scrollHeight; const sugg=decomposeSuggestions(n); insertChildren(id, sugg); return; }
  const lines=out.split(/\n+/).map(s=>s.replace(/^\d+\.\s*/,'').trim()).filter(Boolean).slice(0,3);
  const sugg=lines.length?lines:decomposeSuggestions(n);
  const t=document.createElement('div'); t.className='bub ai'; t.textContent='✨ AI 拆解建议（已插入为子任务）：\n'+sugg.join('；'); box.appendChild(t); box.scrollTop=box.scrollHeight;
  insertChildren(id, sugg);
  closeSmart();
}

/* ============ 持久化 ============ */
function saveMeta(){ try{localStorage.setItem(LS_META,JSON.stringify(state.meta||{}));}catch(e){} }
function loadMeta(){
  try{const s=localStorage.getItem(LS_META); if(s) state.meta={weekReviews:[],bannerDismissedWeek:'',...JSON.parse(s)};}catch(e){}
  if(!state.meta) state.meta={weekReviews:[],bannerDismissedWeek:''};
}
function save(){
  try{
    localStorage.setItem(LS_KEY,JSON.stringify(serializeNodes(state.nodes)));
    saveMeta();
  }catch(e){}
}
function load(){
  try{
    let s=localStorage.getItem(LS_KEY);
    if(!s) s=localStorage.getItem(LS_KEY_LEGACY);
    if(s){
      const n=JSON.parse(s);
      if(Array.isArray(n)&&n.length){
        state.nodes=n.map(normalizeNode);
        recomputeSchedule(state.nodes);
        loadMeta();
        return true;
      }
    }
  }catch(e){}
  loadMeta();
  return false;
}

function weekKey(d){
  d=d||new Date(TODAY);
  const t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const day=(t.getDay()+6)%7;
  t.setDate(t.getDate()-day);
  return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
}
function weekRange(d){
  const parts=(weekKey(d)||'').split('-').map(Number);
  const start=new Date(parts[0],parts[1]-1,parts[2]);
  start.setHours(0,0,0,0);
  const end=new Date(start); end.setDate(end.getDate()+7);
  return {start,end,key:weekKey(d)};
}
function computeWeekStats(){
  computeTree(state.nodes);
  ensureAllEstimates();
  const {start,end}=weekRange();
  const leaves=state.nodes.filter(n=>n.parentId&&n._children.length===0);
  const completed=leaves.filter(n=>{
    if(!n.done) return false;
    const at=+(n.doneAt||0);
    if(!at) return false;
    return at>=start.getTime() && at<end.getTime();
  });
  const byCat={now:0,core:0,distract:0,noise:0};
  completed.forEach(n=>{ const k=category(n.im,n.ur).key; byCat[k]=(byCat[k]||0)+1; });
  const total=completed.length;
  const coreCount=byCat.core||0;
  const fireCount=(byCat.now||0)+(byCat.distract||0);
  const cfTotal=coreCount+fireCount;
  const coreVsFire={
    core:coreCount, fire:fireCount,
    corePct:cfTotal?Math.round(coreCount/cfTotal*100):0,
    firePct:cfTotal?Math.round(fireCount/cfTotal*100):0,
  };
  const corePct=total?Math.round((byCat.core/total)*100):0;
  const lp=leafProgress();
  const quickWins=leaves.filter(n=>!n.done&&isQuickWin(n)).length;
  const topId=state.topId;
  const goldCompleted=completed.filter(n=>topId&&isUnderTopNode(n,topId));
  const goldTouched=state.nodes.filter(n=>{
    const t=+(n.touchedAt||0);
    if(!t||t<start.getTime()||t>=end.getTime()) return false;
    return topId&&(goldChainIds(topId).has(n.id)||isUnderTopNode(n,topId));
  });
  const goldMoved=!!(goldCompleted.length||goldTouched.length);
  const goldDetail=goldMoved
    ? `金线本周有动静：完成 ${goldCompleted.length} 项`+(goldTouched.length?` · 触碰 ${goldTouched.length} 次`:'')+
      (goldCompleted.length?'\n· '+goldCompleted.map(n=>n.text).join('\n· '):'')
    : (topId?`金线「${(byId(topId)||{}).text||'—'}」本周尚无完成/触碰记录。`:'尚未选出金线任务。');
  const completedTexts=completed.map(n=>n.text);
  let estSum=0, actSum=0;
  completed.forEach(n=>{ estSum+=n.estimateMinutes||0; actSum+=n.actualMinutes||0; });
  return {
    total,byCat,corePct,coreVsFire,leafProg:lp,quickWins,
    pending:leaves.filter(n=>!n.done).length,range:{start,end},
    completedTexts,goldMoved,goldDetail,goldCompleted,goldTouched,estSum,actSum,
  };
}
function autoWeekDraft(st, last){
  const wins=last.wins||(st.completedTexts.length?'· '+st.completedTexts.join('\n· '):'');
  const gold=last.gold||(st.goldDetail||'');
  const core=last.core||(st.coreVsFire&&st.coreVsFire.core+st.coreVsFire.fire
    ? `计数：核心 ${st.coreVsFire.core} 项 / 救火 ${st.coreVsFire.fire} 项（核心占 ${st.coreVsFire.corePct}%）`
    : '');
  return {wins,gold,core};
}
function weekStatsBarsHtml(st){
  const total=st.total||1;
  const bars=QUAD_ORDER.map(q=>{
    const n=st.byCat[q]||0;
    const pct=Math.round(n/total*100);
    const col=QUAD[q].icon? (CAT[q]?CAT[q].color:'#7c8295'):'#555';
    return `<div class="wr-bar-row"><span class="wr-lbl">${QUAD[q].label.split('·')[0].trim()}</span>
      <div class="wr-bar"><i style="width:${pct}%;background:${col}"></i></div><span class="wr-num">${n} · ${pct}%</span></div>`;
  }).join('');
  return bars;
}
function hasWeekReviewThisWeek(){
  const wk=weekKey();
  return (state.meta.weekReviews||[]).some(r=>r.week===wk);
}
function renderProgress(){
  const chip=document.getElementById('progressChip');
  const p=leafProgress();
  if(!p||!state.nodes.length){ chip.style.display='none'; return; }
  chip.style.display='inline-flex';
  document.getElementById('progressLbl').textContent=`叶子 ${p.pct}%`;
  document.getElementById('progressFill').style.width=p.pct+'%';
}
function renderReviewBanner(){
  const el=document.getElementById('reviewBanner'); if(!el) return;
  const wk=weekKey();
  const show=state.nodes.length>0 && !hasWeekReviewThisWeek() && state.meta.bannerDismissedWeek!==wk;
  el.classList.toggle('show',show);
}
function addMicroAction(id){
  const parent=byId(id); if(!parent) return;
  const hint=parent.text.length>24?parent.text.slice(0,24)+'…':parent.text;
  const action=prompt('接下来 5 分钟能做的最小动作？\n（越具体越好：打开什么、写多少字、打给谁）', `针对「${hint}」：先完成最小一步（约 5 分钟）`);
  if(action==null||!String(action).trim()) return;
  insertChildren(id,[String(action).trim()]);
  const kids=state.nodes.filter(n=>n.parentId===id);
  const last=kids[kids.length-1];
  if(last){ last.scale='day'; last.ur=Math.max(last.ur,4); if(!last.slot) last.slot='h1'; }
  save(); afterChange();
}
function pad2(n){ return n<10?'0'+n:''+n; }
function icsStamp(d){
  const x=new Date(d);
  return x.getFullYear()+pad2(x.getMonth()+1)+pad2(x.getDate())+'T'+pad2(x.getHours())+pad2(x.getMinutes())+pad2(x.getSeconds());
}
function icsEscape(s){ return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function exportICS(){
  computeTree(state.nodes);
  const leaves=state.nodes.filter(n=>n.parentId&&n._children.length===0&&n.deadlineDate);
  if(!leaves.length){ alert('没有带期限日期的叶子任务。请在任务里写「周五前 / 3月15日」等，或对叶子设 deadline。'); return; }
  const now=icsStamp(new Date());
  let body='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GoalFlow//ZH\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  leaves.forEach(n=>{
    const dt=icsStamp(n.deadlineDate).slice(0,8);
    body+=`BEGIN:VEVENT\r\nUID:${n.id}@goalflow.local\r\nDTSTAMP:${now}\r\nDTSTART;VALUE=DATE:${dt}\r\nSUMMARY:${icsEscape(n.text)}\r\nDESCRIPTION:GoalFlow 叶子 · 重要${n.im} 紧急${n.ur}\r\nEND:VEVENT\r\n`;
  });
  body+='END:VCALENDAR\r\n';
  const blob=new Blob([body],{type:'text/calendar;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='goalflow-deadlines-'+new Date().toISOString().slice(0,10)+'.ics';
  a.click();
}
function exportBackup(){
  const payload={
    app:'goalflow',version:6,exportedAt:new Date().toISOString(),
    viewMode:state.viewMode,
    nodes:serializeNodes(state.nodes),meta:state.meta||{}
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='goalflow-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}
function importBackup(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      let nodes=data;
      if(data&&data.nodes) nodes=data.nodes;
      if(!Array.isArray(nodes)||!nodes.length){ alert('未找到有效目标数据'); return; }
      if(!confirm('恢复将覆盖当前目标树，是否继续？')) return;
      state.nodes=nodes.map(normalizeNode);
      if(data.meta) state.meta={...state.meta,...data.meta};
      if(data.viewMode) state.viewMode=data.viewMode;
      recomputeSchedule(state.nodes);
      save(); afterChange();
      alert('已恢复 '+state.nodes.length+' 条节点');
    }catch(e){ alert('JSON 解析失败'); }
  };
  reader.readAsText(file);
}
function openWeekReview(){
  const overlay=document.getElementById('weekReviewModal');
  const wk=weekKey();
  const last=(state.meta.weekReviews||[]).find(r=>r.week===wk)||{};
  const st=computeWeekStats();
  const draft=autoWeekDraft(st,last);
  const ritual=[
    {k:'pause_done',label:'开场 · 暂停 10 秒',hint:'闭眼深呼吸，把注意力从噪音里收回来。',type:'check',checked:!!last.pause_done},
    {k:'gold',label:'① 金线（★ 最重要）本周推进了什么？',hint:'下方已预填系统观察，可删改。',type:'area',def:draft.gold},
    {k:'core',label:'② 核心 vs 救火（重要不紧急 vs 紧急项）',hint:'对照分析页计数，可补充感受。',type:'area',def:draft.core},
    {k:'wins',label:'③ 本周小赢（自动汇集已完成叶子）',hint:'可删减或补充。',type:'area',def:draft.wins},
    {k:'block',label:'④ 下周保护的一个深潜块（2h+）',hint:'写清何时、做什么、如何不被打断。',type:'area'},
    {k:'commit',label:'封坛 · 下周一句承诺',hint:'只承诺一件事，越少越能守住。',type:'area'},
  ];
  const lp=st.leafProg;
  overlay.classList.add('show');
  overlay.innerHTML=`<div class="modal modal-wide" role="dialog">
    <div class="modal-head">
      <div class="mh-ic">📋</div>
      <div><div class="mh-tt">周回顾仪式</div><div class="mh-sub">分析 → 反思 → 承诺 · 周起始 ${wk}</div></div>
      <span class="mh-x" id="wrClose">×</span>
    </div>
    <div class="wr-tabs">
      <button type="button" class="wr-tab on" data-tab="stats">📊 本周分析</button>
      <button type="button" class="wr-tab" data-tab="ritual">🕯 固定仪式</button>
    </div>
    <div class="wr-pane on" data-pane="stats">
      <div class="wr-stats-grid">
        <div class="wr-stat"><div class="wr-k">本周完成（叶子）</div><div class="wr-v">${st.total}</div><div class="wr-h">仅统计勾选完成且带时间戳的叶子</div></div>
        <div class="wr-stat"><div class="wr-k">核心象限占比</div><div class="wr-v gold">${st.corePct}%</div><div class="wr-h">完成项里「重要不紧急」</div></div>
        <div class="wr-stat"><div class="wr-k">待办叶子</div><div class="wr-v">${st.pending}</div><div class="wr-h">含 ⚡快速赢 ${st.quickWins} 项</div></div>
        <div class="wr-stat"><div class="wr-k">全树叶子进度</div><div class="wr-v">${lp?lp.pct:0}%</div><div class="wr-h">${lp?lp.done+'/'+lp.total:'—'}（仅叶子计完成）</div></div>
      </div>
      <div class="wr-gold ${st.goldMoved?'ok':'warn'}">${st.goldMoved?'★ 金线本周有推进/触碰':'○ 金线本周尚无完成记录'} · ${esc((st.goldDetail||'').split('\n')[0])}</div>
      <div class="wr-bars-title">核心 vs 救火（本周完成计数）</div>
      <div class="wr-bar-row"><span class="wr-lbl">核心投入</span><div class="wr-bar"><i style="width:${st.coreVsFire.corePct}%;background:${PALETTE_UR[0]}"></i></div><span class="wr-num">${st.coreVsFire.core} 项</span></div>
      <div class="wr-bar-row"><span class="wr-lbl">救火紧急</span><div class="wr-bar"><i style="width:${st.coreVsFire.firePct}%;background:${PALETTE_UR[4]}"></i></div><span class="wr-num">${st.coreVsFire.fire} 项</span></div>
      ${st.estSum?`<div class="wr-h" style="margin:8px 0">预估 ${st.estSum} 分 vs 实计 ${st.actSum} 分（已完成叶子）</div>`:''}
      <div class="wr-bars-title">本周完成 · 按四象限分布</div>
      ${st.total?weekStatsBarsHtml(st):'<div class="wr-empty">本周尚无可统计的叶子完成（完成后会自动记录时间戳）。</div>'}
      ${st.completedTexts.length?`<div class="wr-done-list"><div class="wr-bars-title">已完成叶子列表</div><ul>${st.completedTexts.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}
    </div>
    <div class="wr-pane" data-pane="ritual">
      <div class="chat wr-ritual">
        ${ritual.map(q=>{
          if(q.type==='check') return `<label class="wr-check"><input type="checkbox" data-k="${q.k}" ${q.checked?'checked':''}><span><b>${q.label}</b><br><span class="wr-hint">${q.hint}</span></span></label>`;
          return `<label class="wr-field"><span class="wr-fl">${q.label}</span><span class="wr-hint">${q.hint}</span>
            <textarea data-k="${q.k}" rows="2">${esc(last[q.k]||q.def||'')}</textarea></label>`;
        }).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="${BTN.primary || 'gf-btn gf-btn--primary'}" id="wrSave">保存本周回顾</button>
      <button class="${BTN.ghost || 'gf-btn gf-btn--ghost'}" id="wrCancel">取消</button>
    </div>
  </div>`;
  overlay.querySelectorAll('.wr-tab').forEach(btn=>{
    btn.onclick=()=>{
      overlay.querySelectorAll('.wr-tab').forEach(b=>b.classList.toggle('on',b===btn));
      overlay.querySelectorAll('.wr-pane').forEach(p=>p.classList.toggle('on',p.dataset.pane===btn.dataset.tab));
    };
  });
  overlay.querySelector('#wrClose').onclick=closeWeekReview;
  overlay.querySelector('#wrCancel').onclick=closeWeekReview;
  overlay.querySelector('#wrSave').onclick=()=>{
    const entry={week:wk,savedAt:new Date().toISOString(),statsSnapshot:{total:st.total,corePct:st.corePct,byCat:st.byCat}};
    overlay.querySelectorAll('textarea[data-k]').forEach(ta=>{ entry[ta.dataset.k]=ta.value.trim(); });
    overlay.querySelectorAll('input[type=checkbox][data-k]').forEach(cb=>{ entry[cb.dataset.k]=cb.checked; });
    state.meta.weekReviews=(state.meta.weekReviews||[]).filter(r=>r.week!==wk);
    state.meta.weekReviews.push(entry);
    saveMeta(); closeWeekReview(); renderReviewBanner();
    alert('周回顾已保存（仅存于本机）');
  };
  overlay.onclick=e=>{ if(e.target===overlay) closeWeekReview(); };
}
function closeWeekReview(){
  const overlay=document.getElementById('weekReviewModal');
  overlay.classList.remove('show'); overlay.innerHTML='';
}

/* ============ 交互 ============ */
function renderSidebar(){
  const el=document.getElementById('sideTree');
  if(!el) return;
  const sp=document.getElementById('sideProg');
  const t=state.nodes&&state.nodes[0];
  if(!t){
    el.innerHTML='<div class="si dim">解析后在此显示目标树</div>';
    if(sp) sp.textContent='';
    return;
  }
  const kids=(t.children||[]);
  const shown=kids.slice(0,8);
  el.innerHTML='<div class="si dim root">▾ '+esc(t.text)+'</div>'+
    shown.map(c=>'<div class="si dim child">· '+esc(c.text)+'</div>').join('')+
    (kids.length>8?`<div class="si dim child">… 其余 ${kids.length-8} 支</div>`:'');
  const lp=leafProgress();
  if(sp) sp.textContent=lp?lp.pct+'%':'';
}
function afterChange(){
  ensureAllEstimates();
  renderHero(); renderQuadrant(); renderCanvas(); renderFocus(); renderRhythm(); renderSmart();
  renderTreeEditor(); renderProgress(); renderReviewBanner(); renderSidebar();
}
function doParse(){
  const raw=document.getElementById('input').value.trim();
  if(!raw){alert('请先输入目标文本');return;}
  state.nodes=parseText(raw); save(); afterChange();
}
function initDemoSelect(){
  const sel=document.getElementById('demoSelect');
  const lib=typeof GoalFlowDemos!=='undefined'?GoalFlowDemos.list:null;
  if(!sel||!lib||!lib.length) return;
  sel.innerHTML=lib.map(d=>`<option value="${d.id}">${d.title}</option>`).join('');
}
function loadDemo(){
  const sel=document.getElementById('demoSelect');
  const id=sel&&sel.value?sel.value:'sales';
  const pack=typeof GoalFlowDemos!=='undefined'?GoalFlowDemos.get(id):null;
  const demo=pack?pack.text:'';
  if(!demo){ alert('示例库未加载'); return; }
  document.getElementById('input').value=demo;
  doParse();
}
function clearAll(){
  if(!confirm('清空当前目标与本地保存？'))return;
  state.nodes=[]; state.topId=null; document.getElementById('input').value='';
  try{localStorage.removeItem(LS_KEY);}catch(e){}
  renderHero(); renderQuadrant(); renderCanvas(); renderFocus(); renderRhythm(); renderSmart();
}
function exportPNG(){
  const svg=document.getElementById('diagram-svg');
  const xml=new XMLSerializer().serializeToString(svg);
  const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const img=new Image();
  img.onload=()=>{
    const scale=2;
    const cv=document.createElement('canvas');
    cv.width=svg.viewBox.baseVal.width*scale;
    cv.height=svg.viewBox.baseVal.height*scale;
    const ctx=cv.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,cv.height);
    g.addColorStop(0,'#0f1420'); g.addColorStop(1,'#0a0d14');
    ctx.fillStyle=g; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.scale(scale,scale); ctx.drawImage(img,0,0);
    cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='目标流.png';a.click();});
  };
  img.src=url;
}

/* ============ 初始化（仅浏览器） ============ */
if(typeof document!=='undefined'){
  (function init(){
    const d=TODAY;
    const wd=['日','一','二','三','四','五','六'][d.getDay()];
    document.getElementById('todayLine').textContent=
      `今天 ${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 星期${wd}`;
    initDemoSelect();
    // 主题切换（gf-tokens.js 提供 GoalFlowTheme.THEMES / setTheme；含旧缓存兜底）
    const thSel=document.getElementById('themeSelect');
    if(thSel){
      thSel.value=GF.theme||'linear';
      thSel.onchange=()=>{
        if(GF.setTheme){ GF.setTheme(thSel.value); return; }
        try{localStorage.setItem('goalflow.theme',thSel.value);}catch(e){}
        location.reload();
      };
    }
    // 明暗模式切换（含旧缓存兜底：无 GF.toggleMode 时也能生效）
    const mt=document.getElementById('modeToggle');
    if(mt){
      const curMode=(GF.mode||document.documentElement.dataset.mode||'dark');
      mt.textContent=(curMode==='light')?'☀':'☾';
      mt.onclick=()=>{
        if(GF.toggleMode){ GF.toggleMode(); return; }
        const next=(curMode==='light')?'dark':'light';
        try{localStorage.setItem('goalflow.mode',next);}catch(e){}
        location.reload();
      };
    }
    // 侧栏 / 图标轨的周回顾入口
    ['sideWeekReview','railWeekReview'].forEach(id=>{
      const b=document.getElementById(id); if(b) b.onclick=openWeekReview;
    });
    document.getElementById('btnParse').onclick=doParse;
    document.getElementById('btnDemo').onclick=loadDemo;
    document.getElementById('btnClear').onclick=clearAll;
    document.getElementById('btnExport').onclick=exportPNG;
    document.getElementById('focusMode').onchange=renderCanvas;
    document.getElementById('showNoise').onchange=renderCanvas;
    document.querySelectorAll('#viewbar button').forEach(b=>{
      b.onclick=()=>{ state.viewMode=b.dataset.view||'sankey';
        document.querySelectorAll('#viewbar button').forEach(x=>x.classList.toggle('on',x===b));
        const sub=document.getElementById('canvasSub');
        if(sub) sub.textContent=state.viewMode==='network'
          ? '节点 = 目标 · 连线 = 父子关系 · 半径 ≈ 重要度'
          : '条带宽度 = 重要性 · 颜色冷暖 = 紧急性 · 金色发光 = 当下最重要';
        renderCanvas();
      };
    });
    const qw=document.getElementById('btnQuickWin');
    if(qw) qw.onclick=()=>{ state.quadQuickWin=!state.quadQuickWin; afterChange(); };
    document.querySelectorAll('#zoombar button').forEach(b=>{
      b.onclick=()=>{ state.scale=b.dataset.scale;
        document.querySelectorAll('#zoombar button').forEach(x=>x.classList.toggle('on', x===b));
        afterChange(); };
    });
    // 支持 URL 深链：#day / #week / #month / #year / #all
    try{
      const h=(location.hash||'').replace('#','');
      if(['all','day','week','month','year'].includes(h)) state.scale=h;
    }catch(e){}
    document.querySelectorAll('#zoombar button').forEach(b=>b.classList.toggle('on', b.dataset.scale===state.scale));
    const keyIn=document.getElementById('llmKey');
    try{ const k=localStorage.getItem(LLM_KEY_STORAGE); if(k) keyIn.value=k; }catch(e){}
    document.getElementById('btnSaveKey').onclick=()=>{ try{localStorage.setItem(LLM_KEY_STORAGE,keyIn.value.trim()); LLM_KEY=keyIn.value.trim();}catch(e){} alert('已保存（仅存于本机浏览器）'); };
    document.getElementById('btnWeekReview').onclick=openWeekReview;
    document.getElementById('btnReviewBanner').onclick=openWeekReview;
    document.getElementById('btnDismissBanner').onclick=()=>{
      state.meta.bannerDismissedWeek=weekKey(); saveMeta(); renderReviewBanner();
    };
    const doExport=()=>exportBackup();
    document.getElementById('btnExportJson').onclick=doExport;
    const ex2=document.getElementById('btnExportJson2'); if(ex2) ex2.onclick=doExport;
    const icsBtn=document.getElementById('btnExportIcs');
    if(icsBtn) icsBtn.onclick=()=>exportICS();
    const syncBtn=document.getElementById('btnSyncTree');
    if(syncBtn) syncBtn.onclick=()=>{ syncTreeToInput(); alert('已将树形结构同步到左侧文本框。'); };
    const fin=document.getElementById('importFile');
    document.getElementById('btnImportJson').onclick=()=>fin.click();
    fin.onchange=()=>{ if(fin.files&&fin.files[0]) importBackup(fin.files[0]); fin.value=''; };
    if(load()) afterChange();
    else afterChange();
    requestAnimationFrame(()=>{ document.body.classList.add('is-ready'); });
  })();
}

/* ============ 导出纯函数供测试 ============ */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    parseText, parseDeadline, focusScore, category, applySuggestions, computeTree, recomputeSchedule,
    treeOrder, pickTop, pickRanked, leafProgress, subtreeProgress, urColor, buildView, sankeyLayout,
    wrapLabel, inferScale, smartEval, smartQuestions, decomposeSuggestions, serializeNodes, weekKey,
    computeWeekStats, ensureVE, isQuickWin, inferRecur, parseEstimateMinutes, backlogLanes, exportICS, nodesToIndentedText,
    GoalFlowTheme: typeof GoalFlowTheme !== 'undefined' ? GoalFlowTheme : GF,
  };
}