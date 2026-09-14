const STORAGE_KEY = 'my75-v1';
const TEST_KEY = 'my75-test-v1';

const CORE = [
  { id: 'bed', icon: '🛏️', name: 'Make My Bed', subtitle: 'Start the day with a small win' },
  { id: 'water', icon: '💧', name: '2L Water', subtitle: 'Keep yourself hydrated throughout the day' },
  { id: 'skincare', icon: '✨', name: 'Skincare', subtitle: 'A little bit of looking after yourself' },
  { id: 'prep', icon: '🌙', name: 'Prep for Tomorrow', subtitle: '30 minutes to make tomorrow easier' },
  { id: 'phone', icon: '📵', name: 'Phone Down', subtitle: '30 minutes offline before sleep' }
];

const EXTRAS = [
  { id: 'movement', icon: '🏃‍♀️', name: 'Movement' },
  { id: 'meal', icon: '🥗', name: 'Nourishing Meal' },
  { id: 'outside', icon: '🌿', name: 'Outside Time' },
  { id: 'reading', icon: '📖', name: 'Reading' },
  { id: 'sleep7', icon: '😴', name: '7+ Hours Sleep' },
  { id: 'before7', icon: '🌅', name: 'Up Before 7am' }
];

function blankState() {
  return {
    version: 1,
    mode: 'test',
    challenge: {
      startDate: null,
      length: 75,
      flexAllowance: 5,
      flexDays: [],
      completed: false
    },
    entries: {},
    testBaseDate: todayISO(),
    ui: { selectedDate: todayISO() }
  };
}

let state = loadState();
let activeScreen = 'today';

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || blankState(); }
  catch { return blankState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function todayISO() { return formatISO(new Date()); }
function formatISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate()+n); return formatISO(d); }
function diffDays(a, b) { return Math.floor((parseISO(b)-parseISO(a))/86400000); }
function prettyDate(iso, opts={weekday:'long', day:'numeric', month:'long'}) { return parseISO(iso).toLocaleDateString('en-GB', opts); }
function isFuture(iso) { return parseISO(iso) > parseISO(todayISO()); }
function isPast(iso) { return parseISO(iso) < parseISO(todayISO()); }
function challengeStart() { return state.mode === 'test' ? state.testBaseDate : state.challenge.startDate; }
function challengeEnd() { const s = challengeStart(); return s ? addDays(s, state.challenge.length - 1) : null; }
function challengeDayNumber(iso) { const s = challengeStart(); if (!s) return null; const n = diffDays(s, iso)+1; return (n>=1 && n<=state.challenge.length) ? n : null; }
function inChallenge(iso) { return challengeDayNumber(iso) !== null; }
function entryFor(iso) {
  if (!state.entries[iso]) state.entries[iso] = { core:{ bed:false, water:0, skincare:false, prep:false, phone:false }, extras:{}, mood:null, note:'', locked:false, loggedLater:false, submittedAt:null };
  return state.entries[iso];
}
function coreCount(e) { return ['bed','skincare','prep','phone'].filter(k=>!!e.core[k]).length + (e.core.water>=2 ? 1 : 0); }
function isFlex(iso) { return state.challenge.flexDays.some(f => f.date === iso); }
function statusFor(iso) {
  if (isFlex(iso)) return 'flex';
  const e = state.entries[iso];
  if (!e || !e.locked) return '';
  const c = coreCount(e);
  if (c===5) return 'complete';
  if (c===4) return 'good';
  if (c>=1) return 'partial';
  return 'missed';
}
function canEdit(iso) {
  if (isFuture(iso)) return false;
  if (!inChallenge(iso)) return false;
  const e = state.entries[iso];
  return !(e && e.locked);
}
function isBackfill(iso) { return isPast(iso) && !(state.entries[iso] && state.entries[iso].locked); }
function countsAsNormalDay(iso) { return inChallenge(iso) && !isFlex(iso); }

function render() {
  document.getElementById('modeLabel').textContent = state.mode === 'test' ? 'TEST MODE' : 'MY 75';
  renderToday();
  renderCalendar();
  renderProgress();
  renderMe();
  switchScreen(activeScreen, false);
}

function renderToday() {
  const date = state.ui.selectedDate || todayISO();
  const e = entryFor(date);
  const editable = canEdit(date);
  const flex = isFlex(date);
  const count = coreCount(e);
  const pct = flex ? 0 : Math.round(count/5*100);
  const day = challengeDayNumber(date);
  const screen = document.getElementById('todayScreen');

  if (!inChallenge(date)) {
    screen.innerHTML = `<div class="card settings-group"><h3>${state.mode==='test'?'Test challenge':'Challenge not active for this date'}</h3><p>${state.mode==='test'?'Choose today or another challenge day.':'Start your challenge from the Me tab.'}</p></div>`;
    return;
  }

  screen.innerHTML = `
    <div class="hero-card">
      <div>
        <p class="eyebrow">${prettyDate(date,{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</p>
        <h2>${flex ? '✦ Flex Day' : `Day ${day} of 75`}</h2>
        <p>${flex ? 'Today is intentionally lighter.' : `${count}/5 core habits complete`}${e.loggedLater ? ' · Logged later' : ''}</p>
      </div>
      <div class="progress-ring" style="--p:${pct}"><strong>${flex ? '✦' : `${count}/5`}</strong></div>
    </div>

    ${flex ? `<div class="locked-note">Flex Days still count as one of your 75 days, but they are excluded from your consistency score. You can still log anything you happen to do.</div>` : ''}

    <div class="section-title"><h3>Core Habits</h3><span>${editable?'Tap as you go':e.locked?'🔒 Locked':'Read only'}</span></div>
    <div class="habit-list">${CORE.map(h=>habitHTML(h,e,editable)).join('')}</div>

    <div class="section-title"><h3>Extra Wins</h3><span>Bonus only</span></div>
    <div class="mini-grid">${EXTRAS.map(x=>`<button class="mini-card ${e.extras[x.id]?'active':''}" data-extra="${x.id}" ${editable?'':'disabled'}><span>${x.icon}</span><strong>${x.name}</strong></button>`).join('')}</div>

    <div class="section-title"><h3>How did today feel?</h3><span>Optional</span></div>
    <div class="card checkin">
      <div class="mood-row">${['😞','😕','😐','🙂','😄'].map(m=>`<button class="mood-btn ${e.mood===m?'active':''}" data-mood="${m}" ${editable?'':'disabled'}>${m}</button>`).join('')}</div>
      <textarea id="dayNote" placeholder="A little note about today…" ${editable?'':'disabled'}>${escapeHTML(e.note||'')}</textarea>
    </div>

    ${editable ? `<button class="primary-btn" id="finishDayBtn">${isBackfill(date)?'Save & Lock This Day':'Finish Day'}</button>` : `<div class="locked-note">🔒 This day has been submitted and can no longer be edited.</div>`}
    ${isBackfill(date) ? `<div class="locked-note">You’re filling in a previous day. Once saved, it will lock permanently and be marked “Logged later”.</div>` : ''}
  `;

  wireToday(date);
}

function habitHTML(h,e,editable) {
  if (h.id==='water') {
    return `<div class="habit-card water-card ${e.core.water>=2?'complete':''}">
      <div class="habit-icon">${h.icon}</div><div class="habit-copy"><h4>${h.name}</h4><p>${h.subtitle}</p></div>
      <div class="water-controls">${[0.5,1,1.5,2].map(v=>`<button class="water-step ${e.core.water>=v?'active':''}" data-water="${v}" ${editable?'':'disabled'}>${v}L</button>`).join('')}</div>
    </div>`;
  }
  return `<div class="habit-card ${e.core[h.id]?'complete':''}">
    <div class="habit-icon">${h.icon}</div><div class="habit-copy"><h4>${h.name}</h4><p>${h.subtitle}</p></div>
    <button class="tick-btn" data-core="${h.id}" ${editable?'':'disabled'}>✓</button>
  </div>`;
}

function wireToday(date) {
  document.querySelectorAll('[data-core]').forEach(btn=>btn.addEventListener('click',()=>{ const e=entryFor(date); e.core[btn.dataset.core]=!e.core[btn.dataset.core]; saveState(); renderToday(); }));
  document.querySelectorAll('[data-water]').forEach(btn=>btn.addEventListener('click',()=>{ const e=entryFor(date); const v=Number(btn.dataset.water); e.core.water = e.core.water===v ? 0 : v; saveState(); renderToday(); }));
  document.querySelectorAll('[data-extra]').forEach(btn=>btn.addEventListener('click',()=>{ const e=entryFor(date); e.extras[btn.dataset.extra]=!e.extras[btn.dataset.extra]; saveState(); renderToday(); }));
  document.querySelectorAll('[data-mood]').forEach(btn=>btn.addEventListener('click',()=>{ const e=entryFor(date); e.mood=btn.dataset.mood; saveState(); renderToday(); }));
  const note = document.getElementById('dayNote');
  if (note) note.addEventListener('input',()=>{ entryFor(date).note=note.value; saveState(); });
  const finish = document.getElementById('finishDayBtn');
  if (finish) finish.addEventListener('click',()=>confirmFinish(date));
}

function confirmFinish(date) {
  const e=entryFor(date); const c=coreCount(e); const extras=Object.values(e.extras).filter(Boolean).length;
  showModal(`<h3>${isBackfill(date)?'Lock this backfilled day?':'Finish this day?'}</h3><p>You’ve logged <strong>${c}/5 core habits</strong> and <strong>${extras} Extra Wins</strong>.</p><p>Once you confirm, this day cannot be changed.</p><div class="inline-actions"><button class="secondary-btn" data-close>Go back</button><button class="primary-btn" id="confirmLock">Confirm & lock</button></div>`);
  document.getElementById('confirmLock').addEventListener('click',()=>{
    e.locked=true; e.loggedLater=isBackfill(date); e.submittedAt=new Date().toISOString(); saveState(); hideModal(); toast('Day locked ✓'); render();
  });
}

function renderCalendar() {
  const screen=document.getElementById('calendarScreen');
  const selected=state.ui.selectedDate || todayISO();
  const focus=parseISO(selected);
  const year=focus.getFullYear(), month=focus.getMonth();
  const first=new Date(year,month,1); const start=new Date(year,month,1-((first.getDay()+6)%7));
  const days=[]; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(formatISO(d)); }
  screen.innerHTML=`
    <div class="section-title"><h3>${focus.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3><span>Tap a day to view</span></div>
    <div class="card" style="padding:14px">
      <div class="calendar-grid">
        ${['M','T','W','T','F','S','S'].map(x=>`<div class="day-head">${x}</div>`).join('')}
        ${days.map(iso=>{ const d=parseISO(iso); const s=statusFor(iso); return `<button class="day-cell ${d.getMonth()!==month?'outside':''} ${s} ${iso===todayISO()?'today':''}" data-date="${iso}" ${!inChallenge(iso)?'disabled':''}>${d.getDate()}${state.entries[iso]?.locked?'<span class="dot"></span>':''}</button>`}).join('')}
      </div>
      <div class="calendar-legend">
        <div class="legend-item"><i class="legend-swatch" style="background:#dcd0ff"></i>5/5 Complete</div>
        <div class="legend-item"><i class="legend-swatch" style="background:#eee7ff"></i>4/5 Good</div>
        <div class="legend-item"><i class="legend-swatch" style="background:#f8dfe9"></i>Partial</div>
        <div class="legend-item"><i class="legend-swatch" style="background:#dfe8ff"></i>Flex Day</div>
      </div>
    </div>
    <button class="secondary-btn" id="todayJump">Jump to today</button>`;
  screen.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{ state.ui.selectedDate=b.dataset.date; saveState(); activeScreen='today'; render(); }));
  document.getElementById('todayJump').addEventListener('click',()=>{ state.ui.selectedDate=todayISO(); saveState(); activeScreen='today'; render(); });
}

function renderProgress() {
  const screen=document.getElementById('progressScreen');
  const dates=challengeDatesUpToToday();
  const normal=dates.filter(countsAsNormalDay);
  let possible=0, completed=0;
  const habitTotals=Object.fromEntries(CORE.map(h=>[h.id,{done:0,total:0}]));
  const status={complete:0,good:0,partial:0,missed:0,flex:0};
  const extraCounts=Object.fromEntries(EXTRAS.map(x=>[x.id,0]));
  const moods=[];
  normal.forEach(iso=>{
    const e=state.entries[iso]; if(!e||!e.locked) return;
    possible+=5; completed+=coreCount(e);
    ['bed','skincare','prep','phone'].forEach(k=>{habitTotals[k].total++; if(e.core[k]) habitTotals[k].done++;});
    habitTotals.water.total++; if(e.core.water>=2) habitTotals.water.done++;
    status[statusFor(iso)]++;
    EXTRAS.forEach(x=>{ if(e.extras[x.id]) extraCounts[x.id]++; });
    if(e.mood) moods.push(e.mood);
  });
  dates.filter(isFlex).forEach(()=>status.flex++);
  const pct=possible?Math.round(completed/possible*100):0;
  const day=Math.max(1, Math.min(state.challenge.length, diffDays(challengeStart(), todayISO())+1));
  const mood=moods.length? mostCommon(moods): '—';
  screen.innerHTML=`
    <div class="hero-card"><div><p class="eyebrow">YOUR PROGRESS</p><h2>${pct}% consistency</h2><p>Day ${day} of 75 · ${completed}/${possible||0} habits logged</p></div><div class="progress-ring" style="--p:${pct}"><strong>${pct}%</strong></div></div>
    <div class="section-title"><h3>Day Breakdown</h3><span>Locked days</span></div>
    <div class="stats-grid">
      ${statCard(status.complete,'Complete days')}${statCard(status.good,'Good days')}${statCard(status.partial,'Partial days')}${statCard(status.flex,'Flex days')}
    </div>
    <div class="section-title"><h3>Core Habit Performance</h3><span>Normal days only</span></div>
    <div class="card settings-group">${CORE.map(h=>{const t=habitTotals[h.id]; const p=t.total?Math.round(t.done/t.total*100):0; return `<div class="bar-row"><div class="bar-top"><span>${h.icon} ${h.name}</span><strong>${p}%</strong></div><div class="bar"><div class="bar-fill" style="width:${p}%"></div></div></div>`}).join('')}</div>
    <div class="section-title"><h3>Extra Wins</h3><span>No pressure</span></div>
    <div class="stats-grid">${EXTRAS.map(x=>statCard(extraCounts[x.id],x.name)).join('')}</div>
    <div class="section-title"><h3>Mood</h3><span>Gentle pattern tracking</span></div>
    <div class="card settings-group"><div class="setting-row"><span>Most common mood</span><strong style="font-size:1.3rem">${mood}</strong></div><div class="setting-row"><span>Check-ins logged</span><strong>${moods.length}</strong></div></div>
  `;
}
function statCard(value,label){ return `<div class="card stat-card"><strong>${value}</strong><span>${label}</span></div>`; }
function mostCommon(arr){ return [...arr].sort((a,b)=>arr.filter(v=>v===a).length-arr.filter(v=>v===b).length).pop(); }
function challengeDatesUpToToday(){ const s=challengeStart(); if(!s)return[]; const end=challengeEnd(); const stop=parseISO(todayISO())<parseISO(end)?todayISO():end; const n=Math.max(-1,diffDays(s,stop)); return n<0?[]:Array.from({length:n+1},(_,i)=>addDays(s,i)); }

function renderMe() {
  const screen=document.getElementById('meScreen');
  const start=challengeStart(); const end=challengeEnd();
  const used=state.challenge.flexDays.length;
  screen.innerHTML=`
    <div class="card settings-group">
      <h3>${state.mode==='test'?'Test Mode':'Current Challenge'}</h3>
      <div class="setting-row"><span>Start</span><strong>${start?prettyDate(start,{day:'numeric',month:'short',year:'numeric'}):'Not started'}</strong></div>
      <div class="setting-row"><span>End</span><strong>${end?prettyDate(end,{day:'numeric',month:'short',year:'numeric'}):'—'}</strong></div>
      <div class="setting-row"><span>Length</span><strong>75 consecutive days</strong></div>
    </div>

    <div class="card settings-group">
      <h3>Your Rules</h3>
      ${CORE.map(h=>`<div class="setting-row"><span>${h.icon} ${h.name}</span><strong>Core</strong></div>`).join('')}
      <div class="setting-row"><span>Submitted days</span><strong>Permanent</strong></div>
      <div class="setting-row"><span>Backfilling</span><strong>Allowed once</strong></div>
    </div>

    <div class="card settings-group">
      <h3>Flex Days</h3>
      <div class="setting-row"><span>Used / planned</span><strong>${used} of 5</strong></div>
      <div class="flex-list">${used?state.challenge.flexDays.sort((a,b)=>a.date.localeCompare(b.date)).map(f=>`<div class="flex-chip">✦ ${prettyDate(f.date,{weekday:'short',day:'numeric',month:'short'})}${f.reason?` · ${escapeHTML(f.reason)}`:''}</div>`).join(''):'<span style="color:var(--muted);font-size:.82rem">No Flex Days planned yet.</span>'}</div>
      <button class="secondary-btn" id="addFlexBtn" ${used>=5?'disabled':''}>Plan a Flex Day</button>
    </div>

    <div class="card settings-group">
      <h3>Backup & Restore</h3>
      <button class="secondary-btn" id="exportBtn">Export Backup</button>
      <label class="secondary-btn" style="display:block;text-align:center;cursor:pointer">Import Backup<input id="importInput" type="file" accept="application/json" hidden></label>
    </div>

    ${state.mode==='test' ? `<div class="card settings-group"><h3>Ready to go live?</h3><p style="color:var(--muted);font-size:.85rem">Test Mode lets you try everything without affecting your real challenge.</p><button class="primary-btn" id="startRealBtn">Start My 75</button><button class="danger-btn" id="resetTestBtn">Reset Test Data</button></div>` : `<div class="card settings-group"><h3>After Day 75</h3><p style="color:var(--muted);font-size:.85rem">You’ll be able to continue with the same routine or create a new phase with edited goals.</p></div>`}

    <div class="card settings-group"><h3>About My 75</h3><p style="color:var(--muted);font-size:.85rem;line-height:1.5">Consistency over perfection. Five core habits, optional Extra Wins, five planned Flex Days, no restarting, and no editing submitted days.</p></div>
  `;
  wireMe();
}

function wireMe(){
  document.getElementById('addFlexBtn')?.addEventListener('click',openFlexModal);
  document.getElementById('exportBtn')?.addEventListener('click',exportBackup);
  document.getElementById('importInput')?.addEventListener('change',importBackup);
  document.getElementById('startRealBtn')?.addEventListener('click',openStartModal);
  document.getElementById('resetTestBtn')?.addEventListener('click',()=>{showModal(`<h3>Reset Test Mode?</h3><p>This clears all test entries and Flex Days.</p><div class="inline-actions"><button class="secondary-btn" data-close>Cancel</button><button class="danger-btn" id="confirmReset">Reset</button></div>`);document.getElementById('confirmReset').addEventListener('click',()=>{state=blankState();saveState();hideModal();render();toast('Test data reset');});});
}

function openFlexModal(){
  const min=addDays(todayISO(),1); const max=challengeEnd();
  showModal(`<h3>Plan a Flex Day</h3><p>Flex Days must be chosen by the night before. They still count as one of your 75 days and cannot be added retrospectively.</p><label>Date</label><input id="flexDate" type="date" min="${min}" max="${max}"><label>Reason (optional)</label><input id="flexReason" type="text" maxlength="60" placeholder="Friend’s birthday, wedding, travel…"><button class="primary-btn" id="saveFlex">Add Flex Day</button>`);
  document.getElementById('saveFlex').addEventListener('click',()=>{
    const date=document.getElementById('flexDate').value; const reason=document.getElementById('flexReason').value.trim();
    if(!date || !inChallenge(date) || date<=todayISO()) return toast('Choose a future challenge day');
    if(state.challenge.flexDays.some(f=>f.date===date)) return toast('That day is already a Flex Day');
    if(state.challenge.flexDays.length>=5) return toast('All 5 Flex Days are already used');
    state.challenge.flexDays.push({date,reason,plannedAt:new Date().toISOString()}); saveState(); hideModal(); render(); toast('Flex Day planned ✦');
  });
}

function openStartModal(){
  const today=todayISO(), tomorrow=addDays(today,1);
  showModal(`<h3>Ready to start My 75?</h3><p>75 consecutive days · 5 planned Flex Days · submitted days cannot be edited.</p><label>Start date</label><select id="startChoice"><option value="${today}">Today — ${prettyDate(today,{day:'numeric',month:'short'})}</option><option value="${tomorrow}">Tomorrow — ${prettyDate(tomorrow,{day:'numeric',month:'short'})}</option><option value="custom">Choose a future date…</option></select><input id="customStart" type="date" min="${today}" style="display:none;margin-top:8px"><button class="primary-btn" id="confirmStart">Start My 75</button>`);
  const sel=document.getElementById('startChoice'), custom=document.getElementById('customStart'); sel.addEventListener('change',()=>custom.style.display=sel.value==='custom'?'block':'none');
  document.getElementById('confirmStart').addEventListener('click',()=>{
    const start=sel.value==='custom'?custom.value:sel.value; if(!start)return toast('Choose a start date');
    state={...blankState(),mode:'real',challenge:{startDate:start,length:75,flexAllowance:5,flexDays:[],completed:false},entries:{},ui:{selectedDate:start}}; saveState(); hideModal(); render(); toast('My 75 is ready ✨');
  });
}

function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`my75-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url); toast('Backup exported');
}
function importBackup(ev){ const file=ev.target.files?.[0]; if(!file)return; const r=new FileReader(); r.onload=()=>{try{const imported=JSON.parse(r.result); if(!imported.version)throw 0; state=imported; saveState(); render(); toast('Backup restored');}catch{toast('That backup file could not be read');}}; r.readAsText(file); }

function showModal(html){ const b=document.getElementById('modalBackdrop'); document.getElementById('modalContent').innerHTML=html; b.classList.remove('hidden'); document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',hideModal)); b.onclick=e=>{if(e.target===b)hideModal();}; }
function hideModal(){ document.getElementById('modalBackdrop').classList.add('hidden'); }
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }
function escapeHTML(s=''){ return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function switchScreen(name, doRender=true){ activeScreen=name; document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active')); document.getElementById(`${name}Screen`).classList.add('active'); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===name)); if(doRender) render(); }
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{activeScreen=b.dataset.screen; switchScreen(activeScreen,true);}));
document.getElementById('themeButton').addEventListener('click',()=>toast('Lavender Aura ✦'));

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
