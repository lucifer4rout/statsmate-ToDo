(function(){
  "use strict";

  const STORAGE_KEY = "trophyCaseState_v2";
  const CATS = [
    {id:'general',  name:'General',  color:'var(--cat-general)'},
    {id:'work',     name:'Work',     color:'var(--cat-work)'},
    {id:'health',   name:'Health',   color:'var(--cat-health)'},
    {id:'learning', name:'Learning', color:'var(--cat-learning)'},
    {id:'personal', name:'Personal', color:'var(--cat-personal)'},
  ];
  const catInfo = (id) => CATS.find(c=>c.id===id) || CATS[0];
  const XP_PER_TASK = 10;
  const RANKS = [
    {min:1, title:'Novice'}, {min:5, title:'Apprentice'}, {min:10, title:'Adept'},
    {min:18, title:'Specialist'}, {min:28, title:'Expert'}, {min:40, title:'Master'}, {min:60, title:'Legend'}
  ];

  const todayStr = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  const parseDate = (s) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const fmt = (d) => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const addDays = (dateStr,n) => { const d=parseDate(dateStr); d.setDate(d.getDate()+n); return fmt(d); };
  const isLastDayOfMonth = (dateStr) => { const d=parseDate(dateStr); const next=new Date(d); next.setDate(d.getDate()+1); return next.getMonth()!==d.getMonth(); };
  const monthKey = (dateStr) => dateStr.slice(0,7);

  const TROPHY_DEFS = [
    {id:'streak_3',   tier:'bronze',   category:'streak',  name:'Spark',        desc:'3-day completion streak',        threshold:3},
    {id:'streak_7',   tier:'silver',   category:'streak',  name:'Ember',        desc:'7-day completion streak',        threshold:7},
    {id:'streak_14',  tier:'gold',     category:'streak',  name:'Flame',        desc:'14-day completion streak',       threshold:14},
    {id:'streak_30',  tier:'platinum', category:'streak',  name:'Blaze',        desc:'30-day completion streak',       threshold:30},
    {id:'streak_100', tier:'platinum', category:'streak',  name:'Inferno',      desc:'100-day completion streak',      threshold:100},
    {id:'week_bronze',tier:'bronze',   category:'weekly',  name:'Weekly Bronze',desc:'3+ perfect days in one week',    threshold:3},
    {id:'week_silver',tier:'silver',   category:'weekly',  name:'Weekly Silver',desc:'5+ perfect days in one week',    threshold:5},
    {id:'week_gold',  tier:'gold',     category:'weekly',  name:'Weekly Gold',  desc:'7/7 perfect days in one week',   threshold:7},
    {id:'month_bronze',tier:'bronze',  category:'monthly', name:'Monthly Bronze',desc:'7+ perfect days in one month',  threshold:7},
    {id:'month_silver',tier:'silver',  category:'monthly', name:'Monthly Silver',desc:'15+ perfect days in one month', threshold:15},
    {id:'month_gold', tier:'gold',     category:'monthly', name:'Monthly Gold', desc:'25+ perfect days in one month',  threshold:25},
  ];

  function defaultState(){
    return { tasks: [], history: {}, unlocked: {}, longestStreak: 0, lastActiveDate: todayStr(), theme: { mode: "dark", accent: "#3fb6a8" } };
  }
  function load(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); if(!raw) return defaultState(); return Object.assign(defaultState(), JSON.parse(raw)); }
    catch(e){ return defaultState(); }
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  let state = load();
  state.tasks.forEach(t=>{ if(!t.category) t.category = 'general'; });
  let trophyTabFilter = 'all';
  let currentFilter = 'all';

  function rollForward(){
    let guard = 0;
    while(state.lastActiveDate < todayStr() && guard < 400){
      guard++;
      const dayToFinalize = state.lastActiveDate;
      const total = state.tasks.length;
      const completed = state.tasks.filter(t=>t.done).length;
      if(total > 0){
        const perfect = completed === total;
        state.history[dayToFinalize] = { total, completed, perfect };
        evaluateTrophies(dayToFinalize);
      }
      state.tasks.forEach(t=>t.done = false);
      state.lastActiveDate = addDays(dayToFinalize, 1);
    }
    save();
  }
  function computeStreak(uptoDateStrExclusive){
    let streak = 0, cursor = uptoDateStrExclusive;
    while(state.history[cursor] && state.history[cursor].perfect){ streak++; cursor = addDays(cursor,-1); }
    return streak;
  }
  function weekPerfectCount(dateStr){
    const d = parseDate(dateStr), dow = d.getDay();
    const sunday = new Date(d); sunday.setDate(d.getDate()-dow);
    let count = 0;
    for(let i=0;i<7;i++){ const cur=new Date(sunday); cur.setDate(sunday.getDate()+i); const key=fmt(cur);
      if(state.history[key] && state.history[key].perfect) count++; }
    return count;
  }
  function monthPerfectCount(dateStr){
    const mk = monthKey(dateStr); let count=0;
    Object.keys(state.history).forEach(k=>{ if(k.startsWith(mk) && state.history[k].perfect) count++; });
    return count;
  }
  function unlockTrophy(id, dateStr){
    if(state.unlocked[id]) return;
    state.unlocked[id] = dateStr;
    const def = TROPHY_DEFS.find(t=>t.id===id);
    if(def){ queueToast(`🏆 Trophy unlocked: ${def.name}`); burstConfetti(); }
  }
  function evaluateTrophies(finalizedDate){
    const streak = computeStreak(finalizedDate);
    if(streak > state.longestStreak) state.longestStreak = streak;
    TROPHY_DEFS.filter(t=>t.category==='streak').forEach(t=>{ if(streak >= t.threshold) unlockTrophy(t.id, finalizedDate); });
    const d = parseDate(finalizedDate);
    if(d.getDay() === 6){
      const wc = weekPerfectCount(finalizedDate);
      TROPHY_DEFS.filter(t=>t.category==='weekly').forEach(t=>{ if(wc >= t.threshold) unlockTrophy(t.id, finalizedDate); });
    }
    if(isLastDayOfMonth(finalizedDate)){
      const mc = monthPerfectCount(finalizedDate);
      TROPHY_DEFS.filter(t=>t.category==='monthly').forEach(t=>{ if(mc >= t.threshold) unlockTrophy(t.id, finalizedDate); });
    }
  }

  let toastTimer = null;
  function queueToast(msg){
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=> el.classList.remove('show'), 3200);
  }
  function burstConfetti(){
    const colors = ['#e8b93f','#3fb6a8','#ef6b52','#a875e0','#7fd8cf'];
    for(let i=0;i<28;i++){
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random()*100 + 'vw';
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.animation = `confettiFall ${1.6+Math.random()*1.2}s ease-in forwards`;
      p.style.animationDelay = (Math.random()*0.3)+'s';
      document.body.appendChild(p);
      setTimeout(()=>p.remove(), 3200);
    }
  }

  function applyTheme(){
    document.body.setAttribute('data-theme', state.theme.mode);
    document.body.style.setProperty('--custom-accent', state.theme.accent);
    document.getElementById('customColor').value = state.theme.accent;
    document.querySelectorAll('#themeSwitch button').forEach(b=> b.classList.toggle('active', b.dataset.mode === state.theme.mode));
  }
  document.getElementById('themeSwitch').addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    state.theme.mode = btn.dataset.mode; applyTheme(); save();
  });
  document.getElementById('customColor').addEventListener('input', (e)=>{
    state.theme.accent = e.target.value; state.theme.mode = 'custom'; applyTheme(); save();
  });

  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `trophy-case-backup-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  document.getElementById('importBtn').addEventListener('click', ()=> document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        if(!parsed || !Array.isArray(parsed.tasks)) throw new Error('bad file');
        state = Object.assign(defaultState(), parsed);
        state.tasks.forEach(t=>{ if(!t.category) t.category='general'; });
        save(); applyTheme(); renderTasks(); renderStats();
        queueToast('✅ Backup restored');
      }catch(err){ queueToast('⚠️ Could not read that backup file'); }
    };
    reader.readAsText(file); e.target.value = '';
  });

  function trophySVG(tier){
    const colorVar = {bronze:'var(--bronze)', silver:'var(--silver)', gold:'var(--gold)', platinum:'var(--platinum)'}[tier];
    return `<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="19" r="13" fill="${colorVar}" opacity="0.92"/>
      <circle cx="24" cy="19" r="8" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <path d="M12 30 L24 23 L36 30 L30 45 L18 45 Z" fill="${colorVar}" opacity="0.55"/>
    </svg>`;
  }
  function nextTrophyProgress(category, currentValue){
    const chain = TROPHY_DEFS.filter(t=>t.category===category).sort((a,b)=>a.threshold-b.threshold);
    const next = chain.find(t=>!state.unlocked[t.id]);
    if(!next) return null;
    return { id: next.id, pct: Math.min(100, Math.round((currentValue/next.threshold)*100)) };
  }

  document.getElementById('trophyTabs').addEventListener('click',(e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    trophyTabFilter = btn.dataset.cat;
    document.querySelectorAll('#trophyTabs button').forEach(b=>b.classList.toggle('active', b===btn));
    renderShelf();
  });

  function renderShelf(){
    const shelf = document.getElementById('shelf');
    shelf.innerHTML = '';
    const today = todayStr();
    const curStreak = computeStreak(today);
    const curWeek = weekPerfectCount(today);
    const curMonth = monthPerfectCount(today);
    const nextStreak = nextTrophyProgress('streak', curStreak);
    const nextWeek = nextTrophyProgress('weekly', curWeek);
    const nextMonth = nextTrophyProgress('monthly', curMonth);

    const defs = trophyTabFilter === 'all' ? TROPHY_DEFS : TROPHY_DEFS.filter(t=>t.category===trophyTabFilter);

    defs.forEach(t=>{
      const unlocked = !!state.unlocked[t.id];
      const div = document.createElement('div');
      div.className = 'trophy ' + (unlocked ? 'unlocked' : 'locked');
      div.style.setProperty('--tier-color', `var(--${t.tier})`);
      div.title = t.desc;
      let progressHtml = '';
      if(!unlocked){
        let match = null;
        if(t.category==='streak' && nextStreak && nextStreak.id===t.id) match = nextStreak;
        if(t.category==='weekly' && nextWeek && nextWeek.id===t.id) match = nextWeek;
        if(t.category==='monthly' && nextMonth && nextMonth.id===t.id) match = nextMonth;
        if(match) progressHtml = `<div class="progress"><i style="width:${match.pct}%"></i></div>`;
      }
      div.innerHTML = `
        <div class="badge">${trophySVG(t.tier)}</div>
        <div class="name ${unlocked?'':'locked-text'}">${t.name}</div>
        <div class="earned">${unlocked ? 'earned ' + state.unlocked[t.id] : t.desc}</div>
        ${progressHtml}
      `;
      shelf.appendChild(div);
    });
    document.getElementById('trophyCount').textContent = `${Object.keys(state.unlocked).length} / ${TROPHY_DEFS.length} unlocked`;
  }

  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  function addTask(text, category){
    text = text.trim(); if(!text) return;
    state.tasks.push({ id:uid(), text, done:false, category: category || 'general' });
    save(); renderTasks(); renderStats();
  }
  function toggleTask(id){
    const t = state.tasks.find(x=>x.id===id); if(!t) return;
    t.done = !t.done; save(); renderTasks(); renderStats();
    const total = state.tasks.length, completed = state.tasks.filter(x=>x.done).length;
    if(total>0 && completed===total){ queueToast('✅ All tasks done for today — keep the streak alive!'); burstConfetti(); }
  }
  function deleteTask(id){ state.tasks = state.tasks.filter(x=>x.id!==id); save(); renderTasks(); renderStats(); }
  function renameTask(id, newText){
    const t = state.tasks.find(x=>x.id===id); if(!t) return;
    newText = newText.trim(); if(newText) t.text = newText;
    save(); renderTasks();
  }

  document.getElementById('addBtn').addEventListener('click', ()=>{
    const input = document.getElementById('newTask'); const cat = document.getElementById('newCat').value;
    addTask(input.value, cat); input.value=''; input.focus();
  });
  document.getElementById('newTask').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('addBtn').click(); });
  document.getElementById('filterChips').addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('#filterChips button').forEach(b=>b.classList.toggle('active', b===btn));
    renderTasks();
  });

  function renderTasks(){
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    let visible = state.tasks;
    if(currentFilter === 'active') visible = state.tasks.filter(t=>!t.done);
    if(currentFilter === 'done') visible = state.tasks.filter(t=>t.done);
    document.getElementById('emptyMsg').style.display = visible.length ? 'none' : 'block';
    document.getElementById('emptyMsg').textContent = (visible.length===0 && state.tasks.length>0) ? 'Nothing matches this filter.' : 'No tasks yet — add one above to start your streak.';

    visible.forEach(t=>{
      const li = document.createElement('li');
      li.className = t.done ? 'done' : '';
      const c = catInfo(t.category);
      li.innerHTML = `
        <span class="cat-dot" style="background:${c.color}" title="${c.name}"></span>
        <div class="box" data-id="${t.id}" data-act="toggle">${t.done ? '✓' : ''}</div>
        <span class="txt" data-id="${t.id}" data-act="edit">${escapeHtml(t.text)}</span>
        <span class="xp-tag">+${XP_PER_TASK} xp</span>
        <button class="del" data-id="${t.id}" data-act="del" title="Delete">✕</button>
      `;
      list.appendChild(li);
    });
  }
  document.getElementById('taskList').addEventListener('click', (e)=>{
    const el = e.target.closest('[data-act]'); if(!el) return;
    const id = el.dataset.id;
    if(el.dataset.act === 'toggle') toggleTask(id);
    if(el.dataset.act === 'del') deleteTask(id);
  });
  document.getElementById('taskList').addEventListener('dblclick', (e)=>{
    const span = e.target.closest('.txt'); if(!span) return;
    const id = span.dataset.id;
    const t = state.tasks.find(x=>x.id===id); if(!t) return;
    const input = document.createElement('input');
    input.type='text'; input.className='edit-input'; input.value=t.text; input.maxLength=120;
    span.replaceWith(input); input.focus(); input.select();
    const commit = () => { renameTask(id, input.value); };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter') input.blur(); if(ev.key==='Escape'){ input.value=t.text; input.blur(); } });
  });
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---- XP / Level ----
  function lifetimeCompletions(){
    let sum = 0;
    Object.values(state.history).forEach(h=> sum += h.completed);
    sum += state.tasks.filter(t=>t.done).length;
    return sum;
  }
  function xpForLevel(n){ return 50 * n * (n+1) / 2; } // cumulative xp needed to reach level n+1
  function levelFromXp(xp){
    let level = 1;
    while(xpForLevel(level) <= xp) level++;
    return level;
  }
  function rankTitleForLevel(level){
    let title = RANKS[0].title;
    RANKS.forEach(r=>{ if(level >= r.min) title = r.title; });
    return title;
  }
  function renderLevel(){
    const completions = lifetimeCompletions();
    const xp = completions * XP_PER_TASK;
    const level = levelFromXp(xp);
    const prevThreshold = xpForLevel(level-1);
    const nextThreshold = xpForLevel(level);
    const pct = Math.max(0, Math.min(100, Math.round(((xp - prevThreshold)/(nextThreshold - prevThreshold))*100)));
    const title = rankTitleForLevel(level);

    document.getElementById('sideLevel').textContent = level;
    document.getElementById('rankTitle').textContent = title;
    document.getElementById('xpSub').textContent = `${xp - prevThreshold} / ${nextThreshold - prevThreshold} XP to next level`;
    document.getElementById('totalXp').textContent = xp;
    document.getElementById('lifetimeCompletions').textContent = completions;
    document.getElementById('xpRing').style.background = `conic-gradient(var(--gold) 0% ${pct}%, var(--surface-3) ${pct}% 100%)`;
    document.getElementById('navLvRing').textContent = level;
    document.getElementById('navLvTitle').textContent = title;
  }

  function renderStats(){
    const today = todayStr();
    const total = state.tasks.length;
    const completed = state.tasks.filter(t=>t.done).length;

    document.getElementById('todayNum').textContent = `${completed}/${total}`;
    document.getElementById('todaySub').textContent = total ? (completed===total ? 'perfect day! 🎉' : 'tasks completed') : 'add a task to begin';

    const streak = computeStreak(today);
    document.getElementById('streakNum').textContent = streak;
    document.getElementById('streakSub').textContent = streak===1 ? 'perfect day in a row' : 'perfect days in a row';
    document.getElementById('bestStreak').textContent = `best ${Math.max(state.longestStreak, streak)}`;
    document.getElementById('sideLongest').textContent = Math.max(state.longestStreak, streak);

    const d = parseDate(today), dow = d.getDay();
    const sunday = new Date(d); sunday.setDate(d.getDate()-dow);
    const dotsWrap = document.getElementById('weekDots'); dotsWrap.innerHTML = '';
    const miniWrap = document.getElementById('miniWeek'); miniWrap.innerHTML = '';
    let weekCount = 0;
    for(let i=0;i<7;i++){
      const cur = new Date(sunday); cur.setDate(sunday.getDate()+i); const key = fmt(cur);
      const isPerfect = state.history[key] && state.history[key].perfect;
      const isToday = key === today;
      const span = document.createElement('span');
      if(isPerfect){ span.classList.add('done'); weekCount++; }
      if(isToday) span.classList.add('today');
      dotsWrap.appendChild(span);
      const span2 = span.cloneNode(true);
      miniWrap.appendChild(span2);
    }
    document.getElementById('weekNum').textContent = `${weekCount}/7`;

    const mk = monthKey(today);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    let monthPerfect = 0;
    Object.keys(state.history).forEach(k=>{ if(k.startsWith(mk) && state.history[k].perfect) monthPerfect++; });
    document.getElementById('monthNum').textContent = `${monthPerfect}/${daysInMonth}`;
    document.getElementById('monthBar').style.width = Math.round((monthPerfect/daysInMonth)*100) + '%';

    renderCategoryDonut();
    renderProgressRing(completed, total);
    renderBarGraph();
    renderSparkline();
    renderHeatmap();
    renderShelf();
    renderLevel();
  }

  function renderCategoryDonut(){
    const counts = {}; CATS.forEach(c=>counts[c.id]=0);
    state.tasks.forEach(t=>{ counts[t.category] = (counts[t.category]||0)+1; });
    const total = state.tasks.length;
    const donut = document.getElementById('catDonut');
    const legend = document.getElementById('catLegend');
    document.getElementById('catDonutNum').textContent = total;
    legend.innerHTML = '';
    if(total === 0){ donut.style.background = 'var(--surface-3)'; legend.innerHTML = '<div class="row" style="color:var(--text-dim)">No tasks yet</div>'; return; }
    let acc = 0; const stops = [];
    CATS.forEach(c=>{
      const n = counts[c.id]; if(n===0) return;
      const start = acc/total*100; acc += n; const end = acc/total*100;
      stops.push(`${c.color} ${start}% ${end}%`);
      const row = document.createElement('div'); row.className='row';
      row.innerHTML = `<span class="dot" style="background:${c.color}"></span><span class="cname">${c.name}</span><span class="cval">${n}</span>`;
      legend.appendChild(row);
    });
    donut.style.background = `conic-gradient(${stops.join(',')})`;
  }
  function renderProgressRing(completed, total){
    const ring = document.getElementById('progRing');
    const pct = total ? Math.round((completed/total)*100) : 0;
    document.getElementById('progRingNum').textContent = pct + '%';
    ring.style.background = `conic-gradient(var(--accent) 0% ${pct}%, var(--surface-3) ${pct}% 100%)`;
  }
  function last7(){
    const today = todayStr(); const out = [];
    for(let i=6;i>=0;i--){
      const dateStr = addDays(today, -i);
      const isToday = dateStr === today;
      let total, completed, perfect;
      if(isToday){ total = state.tasks.length; completed = state.tasks.filter(t=>t.done).length; perfect = total>0 && completed===total; }
      else if(state.history[dateStr]){ ({total, completed, perfect} = state.history[dateStr]); }
      else { total=0; completed=0; perfect=false; }
      out.push({dateStr, total, completed, perfect, pct: total ? Math.round((completed/total)*100) : 0});
    }
    return out;
  }
  function renderBarGraph(){
    const wrap = document.getElementById('barGraph'); wrap.innerHTML = '';
    last7().forEach(({dateStr,total,completed,perfect,pct})=>{
      const d = parseDate(dateStr);
      const col = document.createElement('div'); col.className='bar-col';
      col.innerHTML = `<div class="bar ${perfect?'perfect':''}" style="height:100%" title="${dateStr}: ${completed}/${total}"><i style="height:${pct}%"></i></div><div class="dlabel">${['S','M','T','W','T','F','S'][d.getDay()]}</div>`;
      wrap.appendChild(col);
    });
  }
  function renderSparkline(){
    const svg = document.getElementById('sparkline');
    const data = last7().map(x=>x.pct);
    const w = 100, h = 26, n = data.length;
    const pts = data.map((v,i)=>{ const x = (i/(n-1))*w; const y = h - (v/100)*h; return `${x},${y}`; }).join(' ');
    const areaPts = `0,${h} ${pts} ${w},${h}`;
    svg.innerHTML = `
      <polyline points="${areaPts}" fill="color-mix(in srgb, var(--accent) 18%, transparent)" stroke="none"></polyline>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    `;
  }
  function renderHeatmap(){
    const wrap = document.getElementById('heatmap'); wrap.innerHTML = '';
    const today = todayStr();
    for(let i=29;i>=0;i--){
      const dateStr = addDays(today, -i);
      const isToday = dateStr === today;
      const cell = document.createElement('div');
      let cls = 'no-data';
      if(isToday){
        const total = state.tasks.length, completed = state.tasks.filter(t=>t.done).length;
        if(total>0) cls = completed===total ? 'perfect' : (completed>0 ? 'partial' : 'missed');
      } else if(state.history[dateStr]){
        const h = state.history[dateStr];
        cls = h.perfect ? 'perfect' : (h.completed>0 ? 'partial' : 'missed');
      }
      cell.className = 'heat-cell ' + cls + (isToday ? ' today-cell' : '');
      cell.title = isToday ? `${dateStr} (today)` : (state.history[dateStr] ? `${dateStr}: ${state.history[dateStr].completed}/${state.history[dateStr].total}` : `${dateStr}: no data`);
      wrap.appendChild(cell);
    }
  }

  rollForward();
  applyTheme();
  renderTasks();
  renderStats();

})();