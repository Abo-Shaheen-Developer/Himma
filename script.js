const $ = id => document.getElementById(id);
const C = 2 * Math.PI * 130, CB = 2 * Math.PI * 112, CA = 2 * Math.PI * 42;
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local day key: YYYY-MM-DD
const today = () => keyOf(new Date());
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const MIN = 60000;
const clamp01 = x => Math.min(1, Math.max(0, x));

const el = {
  time: $('time'), sub: $('sub'), mode: $('modeLabel'),
  start: $('startBtn'), next: $('nextBtn'), end: $('endBtn'), reset: $('resetBtn'),
  fH: $('pFocusH'), fM: $('pFocusM'), bH: $('pBreakH'), bM: $('pBreakM'),
  aRing: $('aRing'), aPct: $('aPct'), aTime: $('aTime'), aOf: $('aOf'), aTitle: $('aTitle')
};

/* ---------- Saved data ---------- */
// history: focused milliseconds per day { 'YYYY-MM-DD': ms }. It is the single source of truth for
// the statistics page and for the pomodoro "today" hours, and it is kept forever in this browser.
let history = store.get('history', null);
if (!history || typeof history !== 'object') {
  history = {};
  const old = store.get('achieved', 0), oldDay = store.get('achievedDate', null); // data from the previous version
  if (old > 0 && oldDay) history[oldDay] = Math.floor(old / 1000) * 1000;
  store.set('history', history);
}
// the resettable achievement counter: one value shared by both systems (the statistics keep their own history)
let counter = store.get('counter', null);
if (typeof counter !== 'number') counter = history[today()] || 0;
let histDirty = false, todosDirty = false, lastSave = 0;
function saveHistory(force){
  if (!histDirty && !todosDirty) return;
  const n = Date.now();
  if (force || n - lastSave >= 2000) {
    if (histDirty) { store.set('history', history); store.set('counter', counter); histDirty = false; }
    if (todosDirty) { saveTodos(); todosDirty = false; }
    lastSave = n;
  }
}

// Two apps in one page: 'tasks' (timed, splittable tasks) and 'pomo' (a plain pomodoro clock with simple tasks).
let appMode = store.get('appMode', 'tasks');
if (appMode !== 'tasks' && appMode !== 'pomo') appMode = 'tasks';

// tasks mode: { id, text, done, min (total minutes), parts (how many pieces), brk (break minutes between pieces),
//               spent (focused ms so far), part (index of the piece that is next / running) }
const rawTodos = store.get('todos', []);
let todos = rawTodos.filter(t => t.min);
todos.forEach(t => {
  if (!t.id) t.id = uid();
  t.parts = Math.max(1, Math.min(12, parseInt(t.parts) || 1));
  t.brk = Math.max(0, parseInt(t.brk) || 0);
  t.spent = typeof t.spent === 'number' ? t.spent : (t.done ? t.min * MIN : 0);
  t.part = Math.min(t.parts - 1, Math.max(0, parseInt(t.part) || 0));
});
// pomodoro mode: simple { id, text, done }. Old tasks that had no time live here now.
let ptodos = store.get('ptodos', []);
rawTodos.filter(t => !t.min).forEach(t => ptodos.push({ id: t.id || uid(), text: t.text, done: !!t.done }));
ptodos.forEach(t => { if (!t.id) t.id = uid(); });
let activeId = store.get('activeTask', null); // the task the next focus period is made for
const saveTodos = () => store.set('todos', todos);
const savePTodos = () => store.set('ptodos', ptodos);
const taskById = id => todos.find(t => t.id === id);

const s = {
  mode: 'focus',              // the phase: 'focus' | 'break'
  running: false, paused: false, waiting: false,
  finished: false,            // a task has just been completed (dial at zero, "start the new task" shown)
  remaining: 0, total: 0, last: 0, timer: null,
  taskId: null,               // task the running session belongs to (tasks mode)
  credited: 0,                // whole seconds of this focus period already added to the totals
  achieved: history[today()] || 0 // ms, today
};

// The pomodoro "today" counter is per day: it starts again from zero on a new day
let achievedDate = today();
let autoFocus = store.get('autoFocus', false); // start focus automatically after a break (off by default)
let autoBreak = store.get('autoBreak', true);  // start a break automatically after focus (on by default)
let fx = store.get('fx', true); // visual effects: gradients, animations and the theme wave (on by default)
document.body.classList.toggle('no-fx', !fx);
function dayCheck(){
  const t = today();
  if (t !== achievedDate) { achievedDate = t; s.achieved = history[t] || 0; }
}
function addFocus(ms){
  dayCheck();
  history[achievedDate] = (history[achievedDate] || 0) + ms;
  s.achieved = history[achievedDate];
  counter += ms;
  histDirty = true;
}

/* ---------- Theme ---------- */
document.documentElement.dataset.theme = store.get('theme', 'dark');
const setTheme = t => { document.documentElement.dataset.theme = t; store.set('theme', t); };
let waving = false;

// Circular waves spread from the button across the whole page while the new theme is revealed.
// A frozen copy of the page (old theme) sits on top and a growing hole in it shows the new theme.
function themeWaves(next, x, y){
  waving = true;
  const old = document.documentElement.dataset.theme, b = document.body.getBoundingClientRect();
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script').forEach(n => n.remove());
  clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  const src = document.body.querySelectorAll('input,textarea');
  clone.querySelectorAll('input,textarea').forEach((n, i) => { n.value = src[i].value; n.checked = src[i].checked; });
  Object.assign(clone.style, { position: 'absolute', margin: '0', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
  clone.dataset.theme = old;

  const cover = document.createElement('div'); cover.className = 'wave-cover'; cover.append(clone);
  const box = document.createElement('div'); box.className = 'wave-rings';
  const color = next === 'dark' ? '#5eead4' : '#3b82f6';
  const rings = [[0, 1], [110, .6], [220, .35]].map(([off, k]) => {
    const i = document.createElement('i'); i.style.setProperty('--wc', color); box.append(i); return { i, off, k };
  });
  [cover, box].forEach(n => { n.style.setProperty('--x', x + 'px'); n.style.setProperty('--y', y + 'px'); });
  cover.style.setProperty('--r', '0px');
  document.body.append(cover, box);

  // keep the frozen copy's running animations in step with the real page (no visible jump)
  const oa = document.body.getAnimations({ subtree: true }), ca = clone.getAnimations({ subtree: true });
  ca.forEach((a, i) => { if (oa[i] && oa[i].animationName === a.animationName) a.currentTime = oa[i].currentTime; });

  setTheme(next);
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 100, dur = 1400, t0 = performance.now();
  const frame = now => {
    const p = Math.min(1, (now - t0) / dur), R = (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2) * end;
    cover.style.setProperty('--r', R + 'px');
    rings.forEach(({ i, off, k }) => {
      const d = Math.max(0, R - off) * 2;
      i.style.width = i.style.height = d + 'px';
      i.style.opacity = d > 20 ? k * (1 - p * p) : 0;
    });
    if (p < 1) requestAnimationFrame(frame); else { cover.remove(); box.remove(); waving = false; }
  };
  requestAnimationFrame(frame);
}

$('themeBtn').onclick = () => {
  if (waving) return;
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  if (!fx || matchMedia('(prefers-reduced-motion: reduce)').matches) return setTheme(next);
  const r = $('themeBtn').getBoundingClientRect();
  themeWaves(next, r.left + r.width / 2, r.top + r.height / 2);
};

/* ---------- Helpers ---------- */
const shorten = (t, n = 26) => t.length > n ? t.slice(0, n - 1) + '…' : t;
const fmtClock = secs => secs >= 3600
  ? `${Math.floor(secs / 3600)}:${pad(Math.floor(secs % 3600 / 60))}:${pad(secs % 60)}`
  : `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
// hours + minutes boxes → minutes (empty boxes → the default)
const hmMin = (h, m, def) => (h.value === '' && m.value === '') ? def : Math.min(1440, Math.max(0, (parseInt(h.value) || 0) * 60 + (parseInt(m.value) || 0)));
const pomoFocusMs = () => (hmMin(el.fH, el.fM, 25) || 1) * MIN;
const pomoBreakMs = () => hmMin(el.bH, el.bM, 5) * MIN;

// A task of T minutes split into N pieces: every piece lasts T/N (rounded to whole seconds, the last one takes the remainder).
const taskMs = t => t.min * MIN;
const baseMs = t => Math.round(taskMs(t) / t.parts / 1000) * 1000;
const partStart = (t, i) => i * baseMs(t);
const partMs = (t, i) => i >= t.parts - 1 ? taskMs(t) - (t.parts - 1) * baseMs(t) : baseMs(t);
const taskProg = t => t.done ? taskMs(t) : Math.min(taskMs(t), t.spent);

function activeTask(){
  const open = todos.filter(t => !t.done);
  return open.find(t => t.id === activeId) || open[0] || null;
}
// the task the dial is showing: the running / just-finished one, otherwise the chosen one
const curTask = () => appMode !== 'tasks' ? null : ((s.running || s.finished) ? (taskById(s.taskId) || null) : activeTask());
const phaseMs = mode => {
  if (appMode === 'pomo') return mode === 'focus' ? pomoFocusMs() : pomoBreakMs();
  const t = curTask(); if (!t) return 0;
  return mode === 'focus' ? partMs(t, t.part) : t.brk * MIN;
};
const lockedSel = () => s.running && !s.paused; // a period is counting right now

function subText(){
  const t = curTask(), multi = t && t.parts > 1, piece = multi ? ` • الجزء ${t.part + 1} من ${t.parts}` : '';
  if (appMode === 'tasks') {
    if (s.finished) return activeTask() ? 'أنهيت المهمة • ابدأ مهمة جديدة' : 'أنجزت كل مهامك';
    if (!s.running) return t ? `جاهز للبدء • ${shorten(t.text)}${piece}` : 'أضف مهمة لتبدأ';
  } else if (!s.running) return 'جاهز للبدء';
  if (s.paused && s.waiting) return s.mode === 'focus' ? `انتهت الراحة • اضغط بدء للتركيز${piece}` : 'انتهى التركيز • اضغط بدء للراحة';
  if (s.paused) return 'متوقف مؤقتاً';
  if (s.mode === 'focus') return appMode === 'tasks' ? `ركّز على مهمتك${piece}` : 'ركّز';
  return 'خذ قسطاً من الراحة';
}

const timerKey = () => 'timer_' + appMode;
function saveTimer(){
  store.set(timerKey(), { mode: s.mode, running: s.running, paused: s.paused, finished: s.finished, remaining: s.remaining, total: s.total, waiting: s.waiting, taskId: s.taskId });
}

/* ---------- The dial: one arc per piece of the task, a thin yellow ring for the rest time ---------- */
const NS = 'http://www.w3.org/2000/svg';
const ringG = $('ringG'), brkT = $('brkT'), brkR = $('brkR');
let arcs = [], ringKey = '';
brkR.style.strokeDasharray = `0 ${CB}`;
function mk(tag, attrs){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function buildRing(n){
  ringG.textContent = ''; arcs = [];
  const gap = n > 1 ? 20 : 0, cap = n > 1 ? 7 : 0;                 // gap between arcs, half a stroke for the round caps
  const L = n > 1 ? Math.max(2, C / n - gap - 14) : C;             // visible dash length of one arc
  for (let i = 0; i < n; i++) {
    const rot = n > 1 ? -90 + (i * C / n + gap / 2 + cap) / C * 360 : -90;
    const a = { cx: 150, cy: 150, r: 130, transform: `rotate(${rot} 150 150)` };
    const tr = mk('circle', { ...a, class: 'track' }), pr = mk('circle', { ...a, class: 'ring' });
    tr.style.strokeDasharray = `${L} ${C}`; pr.style.strokeDasharray = `0 ${C}`;
    if (n > 1) tr.style.strokeLinecap = 'round';
    ringG.append(tr, pr); arcs.push({ pr, L });
  }
}
function drawRing(){
  const t = curTask(), n = t ? t.parts : 1, key = appMode + n;
  if (key !== ringKey) { ringKey = key; buildRing(n); }
  const elapsed = s.total ? clamp01(1 - s.remaining / s.total) : 0;
  arcs.forEach((a, i) => {
    let p = 0;
    if (appMode === 'tasks') p = t ? clamp01((taskProg(t) - partStart(t, i)) / partMs(t, i)) : 0;
    else p = s.running ? elapsed : 0;
    a.pr.style.strokeDasharray = `${a.L * p} ${C}`;
    a.pr.style.opacity = p > .002 ? 1 : 0;
  });
  const showBrk = appMode === 'tasks' && s.running && s.mode === 'break';
  brkT.style.display = brkR.style.display = showBrk ? '' : 'none';
  brkR.style.strokeDasharray = `${showBrk ? CB * elapsed : 0} ${CB}`;
}

function render(){
  const ms = s.finished ? 0 : (!s.running ? phaseMs('focus') : Math.max(0, s.remaining));
  const secs = Math.ceil(ms / 1000), clock = fmtClock(secs);
  el.time.textContent = clock;
  el.time.classList.toggle('long', clock.length > 5);
  drawRing();
  document.title = s.running ? `${clock} • ${s.mode === 'focus' ? 'تركيز' : 'راحة'}` : 'همّة | مساعدك في الدراسة';
  renderAchieve();
  updateTaskBars();
  if (!statsEl.hidden) statsTick();
}

// tasks mode: the ring is the finished share of ALL the tasks' time (and the same time in hours);
// pomodoro mode: only hours, no percentage.
function renderAchieve(){
  dayCheck();
  const tasks = appMode === 'tasks';
  let ms = counter, p = 0;
  if (tasks) {
    const goal = todos.reduce((a, t) => a + taskMs(t), 0);
    p = goal ? clamp01(todos.reduce((a, t) => a + taskProg(t), 0) / goal) : 0;
    el.aOf.textContent = goal ? `من ${fmtMin(goal / MIN)} (مجموع وقت مهامك)` : 'أضف مهامًا بوقت ليظهر تقدمك';
  } else el.aOf.textContent = 'مجموع ساعات التركيز';
  el.aTitle.textContent = tasks ? 'تقدّمك في المهام' : 'إنجازك';
  const t = Math.floor(ms / 1000);
  el.aTime.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`;
  el.aPct.textContent = Math.round(p * 100) + '%';
  el.aRing.style.strokeDashoffset = CA * (1 - p);
}

function setMode(mode, keep){
  s.mode = mode;
  if (!keep) { s.total = s.remaining = phaseMs(mode); s.credited = 0; }
  document.body.classList.toggle('break', mode !== 'focus');
  el.mode.textContent = mode === 'focus' ? 'تركيز' : 'استراحة';
  el.sub.textContent = subText();
  renderTodos();
}

/* ---------- Soft chime (Web Audio) ---------- */
let ctx;
function audio(){
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
  return ctx;
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, audio, { once: true }));

function chime(){
  const a = audio(); if (!a) return;
  const out = a.createGain(); out.gain.value = .55;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
  out.connect(lp); lp.connect(a.destination);
  const notes = [1046.5, 1318.5, 1568, 2093]; // C6 E6 G6 C7, a gentle rising arpeggio
  [0, 2.4].forEach((pass, p) => {
    notes.forEach((f, i) => {
      const t0 = a.currentTime + .05 + pass + i * .2, peak = (p ? .16 : .24) * (1 - i * .08);
      [[f, 1], [f * 2, .12]].forEach(([fr, v]) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.value = fr;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak * v, t0 + .03);
        g.gain.exponentialRampToValueAtTime(.0008, t0 + 2);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 2.1);
      });
    });
  });
}

/* ---------- Ambient sounds (your own audio files, endless loop) ---------- */
// Waves = audio/1.mp3, Rain = audio/2.mp3. Put the two files inside the "audio" folder.
const SOUND_FILES = {
  waves: 'audio/1.mp3',
  rain: 'audio/2.mp3'
};

const live = {};
function paintSound(name){
  const b = document.querySelector(`.snd[data-sound="${name}"]`), on = !!live[name];
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
}
function setSound(name, on){
  if (on && !live[name]) {
    if (!SOUND_FILES[name]) return;
    const au = new Audio(SOUND_FILES[name]); au.loop = true; // loops forever until it is pressed again
    live[name] = au;
    const fail = () => { if (live[name] === au) { delete live[name]; paintSound(name); } }; // file missing / blocked
    au.addEventListener('error', fail);
    au.play().catch(fail);
  } else if (!on && live[name]) {
    live[name].pause(); delete live[name];
  }
  paintSound(name);
}
document.querySelectorAll('.snd').forEach(b => b.onclick = () => setSound(b.dataset.sound, !live[b.dataset.sound]));


/* ---------- Timer ---------- */
function tick(){
  if (!s.running || s.paused) return;
  const now = Date.now(), d = now - s.last; s.last = now;
  s.remaining -= d;
  if (s.mode === 'focus') {
    // Progress is credited in whole seconds, exactly when the dial's seconds change, so the two always agree.
    const e = Math.min(Math.floor(s.total / 1000), Math.max(0, Math.floor((s.total - s.remaining) / 1000)));
    if (e > s.credited) {
      const inc = (e - s.credited) * 1000; addFocus(inc); s.credited = e;
      const t = appMode === 'tasks' ? taskById(s.taskId) : null;
      if (t) { t.spent = Math.max(t.spent, partStart(t, t.part) + e * 1000); todosDirty = true; } // a replayed piece never counts twice
    }
  }
  if (s.remaining <= 0) phaseEnd();
  render(); saveTimer(); saveHistory();
}

// go to the next phase; wait for the user unless the matching "start automatically" switch is on
function enter(mode){
  setMode(mode);
  if (!(mode === 'focus' ? autoFocus : autoBreak)) { s.paused = true; s.waiting = true; ui(); }
}

function phaseEnd(){
  chime();
  if (s.mode === 'break') return enter('focus');
  // a focus period ended
  if (appMode === 'tasks') {
    const t = taskById(s.taskId);
    if (t) {
      t.spent = Math.max(t.spent, partStart(t, t.part) + partMs(t, t.part)); todosDirty = true;
      if (t.part >= t.parts - 1) return finishTask(t);   // that was the last piece
      t.part++; saveTodos();
      return t.brk ? enter('break') : enter('focus');    // no rest time set: straight to the next piece
    }
  }
  return pomoBreakMs() ? enter('break') : enter('focus');
}

// the task is complete: the dial goes to zero and "start the new task" appears
function finishTask(t){
  clearInterval(s.timer);
  t.done = true; t.spent = taskMs(t); saveTodos(); todosDirty = false;
  if (activeId === t.id) { activeId = null; store.set('activeTask', null); }
  s.running = false; s.paused = false; s.waiting = false; s.finished = true;
  setMode('focus', true); s.remaining = 0;
  ui(); renderTodos();
}

function run(){
  clearInterval(s.timer);
  s.last = Date.now();
  s.timer = setInterval(tick, 200);
}

function start(){
  const t = appMode === 'tasks' ? activeTask() : null;
  if (appMode === 'tasks' && !t) return;
  audio();
  s.finished = false; s.running = true; s.paused = false; s.waiting = false;
  s.taskId = t ? t.id : null;
  if (t) { t.spent = Math.max(t.spent, partStart(t, t.part)); todosDirty = true; }
  setMode('focus');
  run(); ui(); render(); saveTimer();
}

function togglePause(){
  s.paused = !s.paused;
  if (!s.paused) { s.last = Date.now(); s.waiting = false; } // paused time is never counted
  ui(); render(); saveTimer();
}

// stop the session and go back to "ready" (progress already earned is kept)
function endSession(){
  clearInterval(s.timer);
  s.running = false; s.paused = false; s.waiting = false; s.finished = false;
  setMode('focus');
  ui(); render(); saveTimer();
}

function resetTimer(){
  if (!s.running) return;
  if (appMode === 'tasks') { // only the timer: the piece goes back to its beginning, progress already earned stays
    const t = taskById(s.taskId);
    endSession(); renderTodos();
  } else {                   // pomodoro: the current period goes back to its full length, paused
    s.remaining = s.total; s.credited = 0; s.paused = true; s.last = Date.now();
    ui(); render(); saveTimer();
  }
}

function ui(){
  const tasks = appMode === 'tasks', t = curTask(), open = activeTask();
  el.start.hidden = tasks && s.finished;
  el.next.hidden = !(tasks && s.finished && open);
  el.end.hidden = tasks;
  const b = el.start;
  b.disabled = !s.running && tasks && !open;
  if (!s.running) { b.textContent = 'بدء'; b.className = 'main-btn go'; }
  else if (s.paused) { b.textContent = s.waiting ? 'بدء' : 'استئناف'; b.className = 'main-btn go'; }
  else { b.textContent = 'إيقاف مؤقت'; b.className = 'main-btn stop'; }
  el.end.disabled = !s.running;
  el.reset.disabled = !s.running;
  el.sub.textContent = subText();
  if (lockedSel() !== lastLock) renderTodos(); // the "choose" buttons appear / disappear with the lock
}

el.start.onclick = () => s.running ? togglePause() : start();
el.next.onclick = () => { s.finished = false; start(); };
el.end.onclick = endSession;
el.reset.onclick = resetTimer;
// reset the achievement counter (and the tasks' progress that the percentage is made of), after a warning
const cf = $('confirm');
const closeConfirm = () => { cf.hidden = true; $('clearAch').focus({ preventScroll: true }); };
$('clearAch').onclick = () => { cf.hidden = false; $('cfNo').focus({ preventScroll: true }); };
cf.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeConfirm(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !cf.hidden) closeConfirm(); });
$('cfYes').onclick = () => {
  closeConfirm();
  counter = 0; store.set('counter', 0);
  todos.forEach(t => { t.spent = 0; t.part = 0; t.done = false; });
  if (appMode === 'tasks' && s.running) endSession();
  saveTodos(); todosDirty = false; renderTodos(); retarget();
};

/* ---------- Pomodoro settings: focus / rest as hours + minutes ---------- */
const pInputs = [[el.fH, 'pFocusH', 0], [el.fM, 'pFocusM', 25], [el.bH, 'pBreakH', 0], [el.bM, 'pBreakM', 5]];
pInputs.forEach(([inp, key, def]) => inp.value = store.get(key, def));
pInputs.forEach(([inp, key]) => {
  inp.addEventListener('input', () => { store.set(key, inp.value); if (appMode === 'pomo' && !s.running) render(); });
  inp.addEventListener('change', () => {
    if (appMode !== 'pomo') return;
    if (!s.running) setMode('focus');
    else { const d = phaseMs(s.mode); s.remaining = Math.max(0, s.remaining + d - s.total); s.total = d; } // changing the active period's length applies now
    render(); saveTimer();
  });
});

/* ---------- Settings drawer ---------- */
const drawer = $('drawer'), overlay = $('overlay'), notes = $('notes');
function toggleDrawer(open){
  drawer.classList.toggle('open', open); overlay.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  (open ? $('closeSettings') : $('gearBtn')).focus({ preventScroll: true });
}
$('gearBtn').onclick = () => toggleDrawer(true);
$('closeSettings').onclick = overlay.onclick = () => toggleDrawer(false);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (drawer.classList.contains('open')) toggleDrawer(false); else if (!statsEl.hidden) closeStats();
});
const cFocus = $('autoFocus'), cBreak = $('autoBreak');
cFocus.checked = autoFocus; cBreak.checked = autoBreak;
cFocus.onchange = () => { autoFocus = cFocus.checked; store.set('autoFocus', autoFocus); };
cBreak.onchange = () => { autoBreak = cBreak.checked; store.set('autoBreak', autoBreak); };
const cFx = $('fx');
cFx.checked = fx;
cFx.onchange = () => { fx = cFx.checked; store.set('fx', fx); document.body.classList.toggle('no-fx', !fx); };

/* ---------- Notes ---------- */
notes.value = store.get('notes', '');
notes.addEventListener('input', () => store.set('notes', notes.value));


/* ---------- Tasks ---------- */
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}س${m % 60 ? ' ' + (m % 60) + 'د' : ''}` : `${m}د`;
let taskEls = {}, lastLock = null, justAdded = null;

function renderTodos(){
  const ul = $('todoList'), st = ul.scrollTop, tasks = appMode === 'tasks';
  ul.innerHTML = ''; taskEls = {};
  const list = tasks ? todos : ptodos;
  $('empty').style.display = list.length ? 'none' : 'block';
  $('empty').textContent = tasks ? 'لا توجد مهام بعد. اضغط «إضافة مهمة» وابدأ.' : 'لا توجد مهام بعد. اكتب أول مهمة وابدأ.';
  const locked = lastLock = lockedSel(), cur = curTask(), curId = cur && cur.id;

  list.forEach(t => {
    const li = document.createElement('li');
    li.className = [t.done && 'done', tasks && !t.done && t.id === curId && 'current', t.id === justAdded && 'new'].filter(Boolean).join(' ');
    const row = document.createElement('div'); row.className = 'trow';
    const c = document.createElement('input'); c.type = 'checkbox'; c.className = 'chk'; c.checked = t.done;
    c.setAttribute('aria-label', 'إنجاز المهمة');
    const sp = document.createElement('span'); sp.className = 'ttxt'; sp.textContent = t.text;
    const meta = document.createElement('div'); meta.className = 'tmeta';
    row.append(c, sp);

    if (tasks) {
      c.onchange = () => {
        t.done = c.checked;
        if (t.done && s.running && s.taskId === t.id) endSession();
        if (!t.done) { t.spent = 0; t.part = 0; }   // un-ticking starts the task over
        saveTodos(); renderTodos(); retarget();
      };
      const chip = document.createElement('span'); chip.className = 'tchip'; chip.textContent = '⏱ ' + fmtMin(t.min); meta.append(chip);
      if (t.parts > 1) {
        const pc = document.createElement('span'); pc.className = 'tchip parts';
        pc.textContent = `${t.parts} أجزاء${t.brk ? ' • راحة ' + fmtMin(t.brk) : ''}`; meta.append(pc);
      }
      const openCount = todos.filter(x => !x.done).length;
      if (!t.done && openCount > 1) {
        if (t.id === curId) { const b = document.createElement('span'); b.className = 'tcur'; b.textContent = 'الحالية'; meta.append(b); }
        else if (!locked) {
          const b = document.createElement('button'); b.className = 'tsel'; b.textContent = 'اختيار'; b.title = 'اجعلها مهمة التركيز القادمة';
          b.onclick = () => {
            if (s.running) endSession(); // leave the paused task where it is
            activeId = t.id; store.set('activeTask', activeId); s.finished = false; renderTodos(); retarget();
          };
          meta.append(b);
        }
      }
    } else {
      c.onchange = () => { t.done = c.checked; savePTodos(); renderTodos(); };
    }

    const d = document.createElement('button'); d.className = 'del'; d.textContent = '×'; d.setAttribute('aria-label', 'حذف');
    d.onclick = () => {
      list.splice(list.indexOf(t), 1);
      if (tasks) {
        saveTodos();
        if (s.taskId === t.id) { if (s.running) endSession(); s.taskId = null; s.finished = false; saveTimer(); }
      } else savePTodos();
      renderTodos(); retarget();
    };
    row.append(d); li.append(row);
    if (meta.children.length) li.append(meta);

    if (tasks) { // progress bar under the task: one segment per piece
      const bar = document.createElement('div'); bar.className = 'tbar';
      const segs = document.createElement('div'); segs.className = 'segbar';
      const fills = [];
      for (let i = 0; i < t.parts; i++) {
        const sg = document.createElement('div'); sg.className = 'sg'; sg.style.flexGrow = partMs(t, i);
        const f = document.createElement('i'); sg.append(f); segs.append(sg); fills.push(f);
      }
      const tx = document.createElement('small'); bar.append(segs, tx); li.append(bar);
      taskEls[t.id] = { fills, tx };
    }
    ul.append(li);
  });
  ul.scrollTop = st; justAdded = null;
  updateTaskBars(); renderAchieve();
}

function updateTaskBars(){
  for (const id in taskEls) {
    const t = taskById(id); if (!t) continue;
    const e = taskEls[id], prog = taskProg(t);
    e.fills.forEach((f, i) => f.style.width = clamp01((prog - partStart(t, i)) / partMs(t, i)) * 100 + '%');
    e.tx.textContent = Math.floor(prog / taskMs(t) * 100) + '%';
  }
}

// the dial follows the chosen task while nothing is counting
function retarget(){
  if (s.running) return;
  if (s.finished && !taskById(s.taskId)) s.finished = false;
  setMode('focus');
  render(); ui(); saveTimer();
}

/* tasks mode: the add-task box (name, time in hours + minutes, split into pieces, rest between them) */
const tf = { form: $('taskForm'), name: $('tfName'), h: $('tfH'), m: $('tfM'), parts: $('tfParts'), brk: $('tfBrk'), brkWrap: $('tfBrkWrap') };
const shake = box => { box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad'); };
const clearBad = e => e.target.closest('.bad') && e.target.closest('.bad').classList.remove('bad');
function toggleTaskForm(open){
  tf.form.hidden = !open;
  $('addToggle').setAttribute('aria-expanded', String(open));
  if (open) tf.name.focus();
}
$('addToggle').onclick = () => toggleTaskForm(tf.form.hidden);
$('tfCancel').onclick = () => toggleTaskForm(false);
tf.parts.addEventListener('input', () => { tf.brkWrap.hidden = (parseInt(tf.parts.value) || 1) < 2; });
tf.form.addEventListener('input', clearBad);
tf.form.addEventListener('keydown', e => { if (e.key === 'Escape') toggleTaskForm(false); });
tf.form.onsubmit = e => {
  e.preventDefault();
  const text = tf.name.value.trim(), min = Math.min(1440, (parseInt(tf.h.value) || 0) * 60 + (parseInt(tf.m.value) || 0));
  if (!text) { shake(tf.name); tf.name.focus(); return; }
  if (!min) { shake(tf.h.closest('.hm')); tf.m.focus(); return; } // every task needs its time
  const parts = Math.max(1, Math.min(12, min, parseInt(tf.parts.value) || 1)); // a piece is never shorter than a minute
  const brk = parts > 1 ? Math.max(0, Math.min(240, parseInt(tf.brk.value) || 0)) : 0;
  const t = { id: uid(), text, done: false, min, parts, brk, spent: 0, part: 0 };
  todos.push(t); justAdded = t.id; saveTodos();
  tf.name.value = tf.h.value = tf.m.value = ''; tf.parts.value = 1; tf.brk.value = 5; tf.brkWrap.hidden = true;
  toggleTaskForm(false);
  renderTodos(); retarget();
};

/* pomodoro mode: a task is only a name and a tick */
const todoIn = $('todoInput');
function addSimple(){
  const v = todoIn.value.trim(); if (!v) return;
  const t = { id: uid(), text: v, done: false };
  ptodos.unshift(t); justAdded = t.id; savePTodos();
  todoIn.value = ''; $('addBtn').hidden = true;
  renderTodos();
}
todoIn.addEventListener('input', () => { $('addBtn').hidden = !todoIn.value.trim(); });
$('addBtn').onclick = addSimple;
todoIn.addEventListener('keydown', e => { if (e.key === 'Enter') addSimple(); });

/* ---------- Switching between the two systems ---------- */
function applyAppMode(){
  const tasks = appMode === 'tasks', b = document.body;
  b.classList.toggle('m-tasks', tasks); b.classList.toggle('m-pomo', !tasks);
  $('pomoSet').hidden = tasks;
  $('addToggle').hidden = !tasks; if (!tasks) tf.form.hidden = true;
  $('simpleForm').hidden = tasks;
  $('modeDesc').textContent = tasks ? 'أضف مهام وقسّمها وضع لها وقت محدد' : 'استخدم مؤقت البومودورو في المهام التي لا تعرف متى ستنهيها';
  $('modeBtn').textContent = tasks ? 'استخدام ساعة البومودورو بدلًا من هذا' : 'استخدام وضع المهام بدلًا من هذا';
}
function loadTimer(){
  clearInterval(s.timer);
  Object.assign(s, { mode: 'focus', running: false, paused: false, waiting: false, finished: false, taskId: null, credited: 0 });
  const sv = store.get(timerKey(), null), tk = sv && taskById(sv.taskId);
  if (sv && sv.running && ['focus', 'break'].includes(sv.mode) && sv.total > 0 && sv.remaining >= 0 && sv.remaining <= sv.total && (appMode === 'pomo' || (tk && !tk.done))) {
    s.mode = sv.mode; s.total = sv.total; s.remaining = sv.remaining;
    s.running = true; s.paused = true; s.waiting = !!sv.waiting; // reopening always comes back paused, ready to resume
    s.taskId = appMode === 'tasks' ? sv.taskId : null;
    s.credited = s.mode === 'focus' ? Math.max(0, Math.floor((s.total - s.remaining) / 1000)) : 0;
    if (tk && s.mode === 'focus') tk.spent = Math.max(tk.spent, partStart(tk, tk.part) + s.credited * 1000);
    setMode(s.mode, true);
    run(); // continues from the exact point it was left at
  } else {
    if (appMode === 'tasks' && sv && sv.finished && tk) { s.finished = true; s.taskId = sv.taskId; }
    setMode('focus', s.finished);
    if (s.finished) s.remaining = s.total = 0;
  }
  ui(); render(); renderTodos();
}
$('modeBtn').onclick = () => {
  tick(); // credit what has been counted so far
  if (s.running && !s.paused) s.paused = true;
  saveTimer(); saveHistory(true); clearInterval(s.timer);
  appMode = appMode === 'tasks' ? 'pomo' : 'tasks'; store.set('appMode', appMode);
  applyAppMode(); loadTimer();
};

/* ---------- Statistics ---------- */
const statsEl = $('stats');
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // one-letter day names for narrow screens
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const weekStartDow = 6; // week starts on Saturday
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = d => addDays(d, -((d.getDay() - weekStartDow + 7) % 7));
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const dayMs = d => history[keyOf(d)] || 0;
const weekDays = ws => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
const weekTotal = ws => weekDays(ws).reduce((a, d) => a + dayMs(d), 0);
const sameDay = (a, b) => a.getTime() === b.getTime();
const dateLabel = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmtDur = ms => { const m = Math.round(ms / 60000), h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}س ${r}د` : `${h}س`) : `${m}د`; };
const fmtShort = ms => !ms ? '0' : ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))}د` : `${(ms / 3600000).toFixed(1).replace(/\.0$/, '')}س`;

function firstDay(){
  const ks = Object.keys(history).filter(k => history[k] > 0).sort();
  const n = new Date(); return ks.length ? parseKey(ks[0]) : new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
// ▲ better / ▼ worse / ＝ same, with the difference
function chip(cur, prev, pct){
  const d = cur - prev;
  if (Math.abs(d) < 30000) return '<span class="chip same">＝ ثابت</span>';
  const p = pct && prev > 0 ? ` • <bdi dir="ltr">${Math.round(Math.abs(d) / prev * 100)}%</bdi>` : '';
  return d > 0 ? `<span class="chip up">▲ تحسّن ${fmtDur(d)}${p}</span>` : `<span class="chip down">▼ تراجع ${fmtDur(-d)}${p}</span>`;
}
function weekName(ws, curWs){
  const n = Math.round((curWs - ws) / (7 * 864e5));
  return n === 0 ? 'هذا الأسبوع' : n === 1 ? 'الأسبوع الماضي' : n === 2 ? 'قبل أسبوعين' : n <= 10 ? `قبل ${n} أسابيع` : `قبل ${n} أسبوعًا`;
}
function weekRange(ws){
  const a = ws, b = addDays(ws, 6), y = new Date().getFullYear();
  return `${dateLabel(a)}${a.getFullYear() !== y ? ' ' + a.getFullYear() : ''} – ${dateLabel(b)}${b.getFullYear() !== y ? ' ' + b.getFullYear() : ''}`;
}

let viewWeek = startOfWeek(new Date()), lastStat = '';
function renderStats(anim){
  if (statsEl.hidden) return;
  statsEl.classList.toggle('anim', !!anim);
  const n = new Date(), td = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const curWs = startOfWeek(td), first = firstDay(), firstWs = startOfWeek(first);
  const minWs = firstWs < curWs ? firstWs : curWs;
  if (viewWeek > curWs) viewWeek = curWs;
  if (viewWeek < minWs) viewWeek = minWs;
  const isCur = sameDay(viewWeek, curWs), days = weekDays(viewWeek), vals = days.map(dayMs);
  const total = vals.reduce((a, b) => a + b, 0), elapsed = days.filter(d => d <= td).length;
  const bi = vals.indexOf(Math.max(...vals)), best = vals[bi];
  const goalMs = 0;
  const hasPrev = viewWeek > firstWs, prevTotal = weekTotal(addDays(viewWeek, -7));

  $('wkTitle').textContent = weekName(viewWeek, curWs);
  $('wkRange').textContent = weekRange(viewWeek);
  $('wkPrev').disabled = viewWeek <= minWs;
  $('wkNext').disabled = viewWeek >= curWs;

  // summary tiles
  $('wkTiles').innerHTML = `
    <div class="tile main"><small>محصلة الأسبوع${isCur ? ' (حتى الآن)' : ''}</small><b>${fmtDur(total)}</b>
      ${hasPrev ? chip(total, prevTotal, true) + `<em>مقابل الأسبوع السابق (${fmtDur(prevTotal)})</em>` : '<em>أول أسبوع مسجّل</em>'}</div>
    <div class="tile"><small>المتوسط اليومي</small><b>${fmtDur(elapsed ? total / elapsed : 0)}</b></div>
    <div class="tile"><small>أفضل يوم</small><b>${best > 0 ? DAYS[days[bi].getDay()] : '—'}</b><em>${best > 0 ? fmtDur(best) : 'لا يوجد بعد'}</em></div>
    <div class="tile"><small>أيام الإنجاز</small><b>${vals.filter(v => v >= 60000).length} / ${elapsed}</b></div>`;

  // bar chart: hours per day
  const max = Math.max(...vals, goalMs, 3600000);
  $('wkChart').innerHTML = `
    <div class="plot"><div class="plot-in">
      ${goalMs ? `<div class="goal-line" style="bottom:${goalMs / max * 100}%"><span>الهدف ${fmtShort(goalMs)}</span></div>` : ''}
      ${days.map((d, i) => {
        const v = vals[i], fut = d > td, h = v ? Math.max(3, v / max * 100) : 0;
        return `<div class="col${fut ? ' fut' : ''}${sameDay(d, td) ? ' today' : ''}${goalMs && v >= goalMs ? ' hit' : ''}">
          ${fut ? '' : `<span class="val" style="bottom:calc(${h}% + 4px)">${fmtShort(v)}</span>`}
          <i class="bar" style="height:${h}%"></i></div>`;
      }).join('')}
    </div></div>
    <div class="xlab">${days.map(d => `<div class="xl${sameDay(d, td) ? ' today' : ''}"><b><span class="short">${SHORT[d.getDay()]}</span><span class="full">${DAYS[d.getDay()]}</span></b><small>${d.getDate()}</small></div>`).join('')}</div>`;

  // day by day: each day against the day before it
  const dmax = Math.max(...vals, goalMs, 1);
  $('dayList').innerHTML = days.map((d, i) => {
    const v = vals[i], fut = d > td, isToday = sameDay(d, td);
    let c = '';
    if (fut || d < first) c = '<span class="chip same">—</span>';
    else if (sameDay(d, first)) c = '<span class="chip same">بداية التسجيل</span>';
    else c = chip(v, dayMs(addDays(d, -1)), false);
    return `<li class="${fut ? 'fut' : ''}${isToday ? ' today' : ''}">
      <div class="d-name"><b>${DAYS[d.getDay()]}${goalMs && v >= goalMs ? ' <span class="tick" title="تحقق الهدف">✓</span>' : ''}</b><small>${dateLabel(d)}${isToday ? ' • اليوم' : ''}</small></div>
      <div class="d-bar"><i style="width:${fut ? 0 : v / dmax * 100}%"></i></div>
      <div class="d-val">${fut ? '—' : fmtDur(v)}</div>
      <div class="d-delta">${c}</div></li>`;
  }).join('');

  // every week since the first record
  const weeks = []; for (let w = curWs, k = 0; w >= minWs && k < 520; w = addDays(w, -7), k++) weeks.push(w);
  const totals = weeks.map(weekTotal), wmax = Math.max(...totals, 1), all = totals.reduce((a, b) => a + b, 0);
  $('allSub').textContent = `إجمالي ما أنجزته: ${fmtDur(all)} خلال ${weeks.length} ${weeks.length === 1 ? 'أسبوع' : weeks.length === 2 ? 'أسبوعين' : weeks.length <= 10 ? 'أسابيع' : 'أسبوعًا'} • كل أسبوع مقابل الذي قبله`;
  $('weekList').innerHTML = weeks.map((w, i) => {
    const t = totals[i], isFirst = w <= firstWs;
    const c = isFirst ? '<span class="chip same">أول أسبوع</span>' : chip(t, weekTotal(addDays(w, -7)), true);
    return `<li><button class="wk-row${sameDay(w, viewWeek) ? ' sel' : ''}" data-w="${keyOf(w)}">
      <div class="d-name"><b>${weekName(w, curWs)}</b><small>${weekRange(w)}</small></div>
      <div class="d-bar"><i style="width:${t / wmax * 100}%"></i></div>
      <div class="d-val">${fmtDur(t)}</div>
      <div class="d-delta">${c}</div></button></li>`;
  }).join('');
}

// live pill + refresh once a minute of new progress (the page itself updates every second elsewhere)
function statsTick(){
  const live = $('stLive');
  live.hidden = !s.running;
  if (s.running) live.textContent = `${pad(Math.floor(Math.ceil(Math.max(0, s.remaining) / 1000) / 60))}:${pad(Math.ceil(Math.max(0, s.remaining) / 1000) % 60)} • ${s.mode === 'focus' ? 'تركيز' : 'استراحة'}`;
  const k = Math.floor(s.achieved / 60000) + '|' + today();
  if (k !== lastStat) { lastStat = k; renderStats(false); }
}

function openStats(){
  if (drawer.classList.contains('open')) toggleDrawer(false);
  statsEl.hidden = false; document.body.classList.add('stats-open');
  viewWeek = startOfWeek(new Date()); lastStat = '';
  renderStats(true); statsTick();
  window.scrollTo(0, 0); $('statsClose').focus({ preventScroll: true });
}
function closeStats(){
  statsEl.hidden = true; document.body.classList.remove('stats-open');
  window.scrollTo(0, 0);
}
$('statsBtn').onclick = openStats;
$('statsClose').onclick = () => { closeStats(); $('statsBtn').focus({ preventScroll: true }); };
$('wkPrev').onclick = () => { viewWeek = addDays(viewWeek, -7); renderStats(true); };
$('wkNext').onclick = () => { viewWeek = addDays(viewWeek, 7); renderStats(true); };
$('weekList').onclick = e => {
  const b = e.target.closest('[data-w]'); if (!b) return;
  viewWeek = parseKey(b.dataset.w); renderStats(true);
  $('wkTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
};
/* ---------- Restore saved state ---------- */
applyAppMode();
loadTimer();

// save the exact position when the tab is closed or hidden
const flush = () => { tick(); saveTimer(); saveHistory(true); };
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else renderAchieve(); });

/* ---------- Entrance animation: the word grows in, then shrinks into the header while everything else appears ---------- */
(async function intro(){
  const body = document.body, screen = $('intro');
  const finish = () => { body.classList.remove('intro', 'hold-brand'); screen.remove(); };
  if (!fx || matchMedia('(prefers-reduced-motion: reduce)').matches || !screen.animate) return finish();
  try {
    await Promise.race([document.fonts ? document.fonts.ready : 0, new Promise(r => setTimeout(r, 1500))]);
    const brand = document.querySelector('.brand'), cs = getComputedStyle(brand), tgt = brand.getBoundingClientRect();
    const word = document.createElement('div'); word.className = 'intro-word'; word.textContent = brand.textContent;
    Object.assign(word.style, { fontSize: cs.fontSize, fontFamily: cs.fontFamily, visibility: 'hidden' });
    screen.append(word);
    const w0 = word.getBoundingClientRect().width;
    word.style.fontSize = parseFloat(cs.fontSize) * Math.min(innerWidth * .55, 560) / w0 + 'px'; // big, so it stays sharp when scaled down
    const r = word.getBoundingClientRect();
    word.style.left = (innerWidth - r.width) / 2 + 'px'; word.style.top = (innerHeight - r.height) / 2 + 'px';
    word.style.visibility = '';
    const k = tgt.width / r.width, dx = tgt.left + tgt.width / 2 - innerWidth / 2, dy = tgt.top + tgt.height / 2 - innerHeight / 2;
    const T = 2800, hold = .55, still = { opacity: 1, transform: 'translate(0px,0px) scale(1)', filter: 'blur(0px)', textShadow: '0 0 60px #5eead4' };
    const a = word.animate([
      { opacity: 0, transform: 'translate(0px,0px) scale(.85)', filter: 'blur(16px)', textShadow: '0 0 0 #5eead4', offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
      { ...still, offset: .3 },
      { ...still, offset: hold, easing: 'cubic-bezier(.7,0,.2,1)' },
      { opacity: 1, transform: `translate(${dx}px,${dy}px) scale(${k})`, filter: 'blur(0px)', textShadow: `0 0 ${22 / k}px #5eead4`, offset: 1 }
    ], { duration: T, fill: 'forwards' });
    screen.firstElementChild.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: T * hold + 200, fill: 'forwards' });
    setTimeout(() => body.classList.remove('intro'), T * hold + 350); // the rest of the page appears as the word travels
    await a.finished;
  } catch {}
  finish();
})();


/* ---------- Rotating supplications: change every minute ---------- */
(function rotatingDua(){
  const duaEl = document.getElementById('rotatingDua');
  if (!duaEl) return;

  const duas = [
    'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا.',
    'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ.',
    'اللَّهُمَّ يَا مُفَهِّمَ سُلَيْمَانَ فَهِّمْنِي، وَيَا مُعَلِّمَ آدَمَ عَلِّمْنِي.',
    'اللَّهُمَّ إِنِّي أَسْتَوْدِعُكَ مَا أَحْفَظُهُ لِحِينَ حَاجَتِي إِلَيْهِ.',
    'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ.',
    'اللَّهُمَّ إِنِّي أَتَبَرَّأُ مِنْ حَوْلِي وَقُوَّتِي، وَأَسْتَعِينُ بِحَوْلِكَ وَقُوَّتِكَ.',
    'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.',
    'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ.',
    'يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَىٰ نَفْسِي طَرْفَةَ عَيْنٍ.',
    'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.',
    'إِنَّ مَعِيَ رَبِّي سَيَهْدِينِ.',
    'إِنَّ مَعَ الْعُسْرِ يُسْرًا.',
    'رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ.',
    'عَسَىٰ رَبِّي أَنْ يَهْدِيَنِي سَوَاءَ السَّبِيلِ.',
    'لَا تَدْرِي لَعَلَّ اللَّهَ يُحْدِثُ بَعْدَ ذَٰلِكَ أَمْرًا.',
    'إِنَّا لَا نُضِيعُ أَجْرَ مَنْ أَحْسَنَ عَمَلًا.',
    'سَيَجْعَلُ اللَّهُ بَعْدَ عُسْرٍ يُسْرًا.',
    'أَمَّنْ يُجِيبُ الْمُضْطَرَّ إِذَا دَعَاهُ.',
    'وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ.',
    'وَاصْبِرْ لِحُكْمِ رَبِّكَ فَإِنَّكَ بِأَعْيُنِنَا.'
  ];

  let index = 0;
  duaEl.textContent = duas[index];

  window.setInterval(() => {
    duaEl.classList.add('dua-fade');
    window.setTimeout(() => {
      index = (index + 1) % duas.length;
      duaEl.textContent = duas[index];
      duaEl.classList.remove('dua-fade');
    }, 350);
  }, 60000);
})();
