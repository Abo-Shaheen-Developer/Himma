/* ---------- Keeping the data on the device ----------
   Everything the app saves (tasks, statistics, settings) lives in the browser's localStorage. A browser gives each
   address / folder its own storage, so a new copy of the project opened from somewhere else starts empty.
   This file adds three ways to carry the data over to any new copy:
   1. hemma-data.js  - if a file with this name sits next to index.html it is loaded automatically (see index.html).
   2. A linked file  - Chrome / Edge: the app keeps writing every change to a file you choose on your device.
   3. Export / import from the settings drawer (works in every browser).
   All three use the same file format:  window.HEMMA_DATA = { ... };                                          */
(function () {
  const SAVED = '__savedAt', FILE = 'hemma-data.js';
  const ls = localStorage;
  const localSavedAt = () => Number(ls.getItem(SAVED)) || 0;
  const localEmpty = () => !ls.getItem('history') && !ls.getItem('ptodos');

  function snapshot(){
    const data = {};
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k !== SAVED) data[k] = ls.getItem(k); }
    return { app: 'hemma', v: 1, savedAt: localSavedAt() || Date.now(), data };
  }
  const toText = () => `window.HEMMA_DATA = ${JSON.stringify(snapshot())};\n`;
  function parse(text){
    try {
      const a = text.indexOf('{'), b = text.lastIndexOf('}');
      const o = JSON.parse(text.slice(a, b + 1));
      return o && o.app === 'hemma' && o.data ? o : null;
    } catch { return null; }
  }
  function apply(snap){
    Object.keys(snap.data).forEach(k => ls.setItem(k, snap.data[k]));
    ls.setItem(SAVED, String(snap.savedAt || Date.now()));
  }
  const newer = snap => localEmpty() || (snap.savedAt || 0) > localSavedAt();

  // 1) hemma-data.js next to index.html: applied before the app reads anything
  try { if (window.HEMMA_DATA && window.HEMMA_DATA.app === 'hemma' && newer(window.HEMMA_DATA)) apply(window.HEMMA_DATA); } catch {}

  /* ----- linked file (File System Access API) ----- */
  const canLink = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  const types = [{ description: 'بيانات منصة همّة', accept: { 'text/javascript': ['.js'] } }];
  let handle = null, perm = 'none', lastWrite = 0, timer = null, msg = '';

  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('hemma-backup', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const idbGet = async () => { const d = await idb(); return new Promise(res => { const q = d.transaction('h').objectStore('h').get('file'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
  const idbSet = async v => { const d = await idb(); return new Promise(res => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').put(v, 'file'); t.oncomplete = () => res(); t.onerror = () => res(); }); };

  async function write(){
    if (!handle || perm !== 'granted') return;
    try {
      const w = await handle.createWritable(); await w.write(toText()); await w.close();
      lastWrite = Date.now(); msg = '';
    } catch (e) { msg = 'تعذّر الحفظ في الملف'; }
    paint();
  }
  async function readFile(){ try { return parse(await (await handle.getFile()).text()); } catch { return null; } }

  // the file may hold newer data than this browser has (e.g. a new copy of the project): take it, then reload once
  async function sync(){
    const snap = await readFile();
    if (snap && newer(snap) && !sessionStorage.getItem('hemma-reloaded')) {
      apply(snap); sessionStorage.setItem('hemma-reloaded', '1'); location.reload(); return;
    }
    await write();
  }
  async function checkPerm(ask){
    if (!handle) { perm = 'none'; return; }
    try {
      perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && ask) perm = await handle.requestPermission({ mode: 'readwrite' });
    } catch { perm = 'denied'; }
  }

  async function link(existing){
    try {
      const h = existing
        ? (await window.showOpenFilePicker({ types, multiple: false }))[0]
        : await window.showSaveFilePicker({ suggestedName: FILE, types });
      handle = h; await idbSet(h); await checkPerm(true); paint();
      if (perm === 'granted') existing ? await sync() : await write();
    } catch { /* cancelled */ }
    paint();
  }
  async function unlink(){ handle = null; perm = 'none'; await idbSet(null); paint(); }

  function changed(){ clearTimeout(timer); timer = setTimeout(write, 1200); }
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; write(); } };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  /* ----- export / import ----- */
  function exportFile(){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toText()], { type: 'text/javascript' }));
    a.download = FILE; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importFile(file){
    const snap = parse(await file.text());
    if (!snap) { msg = 'الملف غير صالح'; paint(); return; }
    apply(snap); location.reload();
  }

  /* ----- settings drawer ----- */
  const $ = id => document.getElementById(id);
  function paint(){
    if (!$('bkStatus')) return;
    let t;
    if (!canLink) t = 'متصفحك لا يدعم الحفظ التلقائي في ملف؛ استخدم التصدير والاستيراد.';
    else if (!handle) t = 'بياناتك محفوظة في هذا المتصفح. اربط ملفًا على جهازك ليتحدّث تلقائيًا مع كل تغيير.';
    else if (perm !== 'granted') t = `الملف «${handle.name}» مربوط • اضغط «تفعيل» للسماح بالحفظ فيه.`;
    else t = `الحفظ التلقائي شغّال في «${handle.name}»` + (lastWrite ? ` • آخر حفظ ${new Date(lastWrite).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : '');
    $('bkStatus').textContent = msg || t;
    $('bkNew').hidden = $('bkOpen').hidden = !canLink || !!handle;
    $('bkGrant').hidden = !handle || perm === 'granted';
    $('bkUnlink').hidden = !handle;
  }
  function wire(){
    if (!$('bkStatus')) return;
    $('bkNew').onclick = () => link(false);
    $('bkOpen').onclick = () => link(true);
    $('bkGrant').onclick = async () => { await checkPerm(true); paint(); if (perm === 'granted') await sync(); };
    $('bkUnlink').onclick = unlink;
    $('bkExport').onclick = exportFile;
    $('bkImport').onclick = () => $('bkFile').click();
    $('bkFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
    paint();
  }
  wire();

  (async function init(){
    if (!canLink) return;
    try { handle = await idbGet(); } catch { handle = null; }
    if (handle) { await checkPerm(false); paint(); if (perm === 'granted') await sync(); }
  })();

  // ask the browser not to clear the site's data when it is low on space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}

  window.hemmaBackup = { changed, snapshot, exportFile };
})();
