(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const NS = 'http://www.w3.org/2000/svg';
  const tv = $('tv'), glass = $('glass'), shelf = $('shelf'), fly = $('fly'), holder = $('holder'), deck = $('deck');
  const padWrap = document.querySelector('.pad-wrap');
  const sctx = $('screen').getContext('2d');
  const nctx = $('noise').getContext('2d');

  const DEPTH = 60;   /* how far the cartridge sinks into the bay */
  const POP = 24;     /* how far it pops back up on eject */
  const HOVER = 28;   /* hover height above the slot before dropping in */

  let nes = null, kind = null, romName = '', romSize = 0;
  let running = false, paused = false, muted = false;
  let busy = false, inserted = null, mode = 'static';
  const recs = [];
  const memState = {};

  function setStatus(msg, isError) {
    const el = $('status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  /* ---------- TV: static, tuning, game ---------- */
  const NW = 160, NH = 120;
  const nimg = nctx.createImageData(NW, NH);
  const n32 = new Uint32Array(nimg.data.buffer);
  let roll = 0;
  function drawNoise() {
    const tuning = mode === 'tuning';
    roll = (roll + (tuning ? 7 : 1.6)) % (NH + 24);
    for (let y = 0; y < NH; y++) {
      const band = ((y - roll + NH + 24) % (NH + 24)) < 16;
      const gain = band ? 255 : 190;
      const lift = band ? 50 : 0;
      const glitch = Math.random() < (tuning ? 0.12 : 0.02) ? 70 : 0;
      for (let x = 0; x < NW; x++) {
        let v = (Math.random() * gain + lift + glitch) | 0;
        if (v > 255) v = 255;
        n32[y * NW + x] = 0xFF000000 | (v << 16) | (v << 8) | v;
      }
    }
    nctx.putImageData(nimg, 0, 0);
  }
  drawNoise();

  function setMode(m) { mode = m; tv.dataset.mode = m; }
  let osdTimer = 0;
  function osd(text, ms) {
    const o = $('osd');
    o.textContent = text;
    o.classList.add('show');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => o.classList.remove('show'), ms || 1500);
  }
  function powerOn() {
    glass.classList.remove('poweron');
    void glass.offsetWidth;
    glass.classList.add('poweron');
    setTimeout(() => glass.classList.remove('poweron'), 800);
  }

  /* Screen filters: normal, VHS, sharp, smooth. */
  const FILTERS = ['normal', 'vhs', 'sharp', 'smooth'];
  const FILTER_LABEL = { normal: 'Normal', vhs: 'VHS', sharp: 'Sharp', smooth: 'Smooth' };
  function setFilter(f, announce) {
    if (!FILTER_LABEL[f]) f = 'normal';
    tv.dataset.filter = f;
    $('filter').textContent = 'Filter: ' + FILTER_LABEL[f];
    try { localStorage.setItem('nestalgia:filter', f); } catch (err) { /* ignore */ }
    if (announce) osd(FILTER_LABEL[f] + ' filter', 1200);
  }
  $('filter').addEventListener('click', () => {
    setFilter(FILTERS[(FILTERS.indexOf(tv.dataset.filter) + 1) % FILTERS.length], true);
  });
  (function () {
    let f = 'normal';
    try { f = localStorage.getItem('nestalgia:filter') || 'normal'; } catch (err) { /* ignore */ }
    setFilter(f, false);
  })();

  /* ---------- Input: keyboard, gamepad and on-screen pad ---------- */
  const NAMES = ['A', 'B', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
  const src = { kbd: new Set(), pad: new Set(), ui: new Set() };
  const applied = new Set();

  function sendInput(name, on) {
    if (kind === 'nes' && nes && window.jsnes) {
      const code = jsnes.Controller['BUTTON_' + name];
      if (code === undefined) return;
      if (on) nes.buttonDown(1, code); else nes.buttonUp(1, code);
    }
  }
  function refresh(name) {
    const on = src.kbd.has(name) || src.pad.has(name) || src.ui.has(name);
    if (on === applied.has(name)) return;
    if (on) applied.add(name); else applied.delete(name);
    sendInput(name, on);
    document.querySelectorAll('#pad [data-btn="' + name + '"]').forEach((e) => e.classList.toggle('pressed', on));
  }
  function releaseAll() {
    src.kbd.clear(); src.pad.clear(); src.ui.clear();
    NAMES.forEach(refresh);
  }

  /* Key bindings: action -> KeyboardEvent.code, editable from the controller. */
  const DEFAULT_BINDS = {
    UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
    B: 'KeyZ', A: 'KeyX',
    START: 'Enter', SELECT: 'ShiftLeft'
  };
  const RESERVED = { KeyP: 'pause', KeyM: 'mute' };
  const ACTION_LABEL = { UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', A: 'A', B: 'B', SELECT: 'Select', START: 'Start' };
  const MAP_ORDER = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B', 'SELECT', 'START'];
  function loadBinds() {
    const out = Object.assign({}, DEFAULT_BINDS);
    try {
      const j = JSON.parse(localStorage.getItem('nestalgia:keys') || 'null');
      if (j) {
        const merged = Object.assign({}, DEFAULT_BINDS);
        NAMES.forEach((n) => { if (typeof j[n] === 'string' && j[n]) merged[n] = j[n]; });
        if (new Set(Object.values(merged)).size === NAMES.length) return merged;
      }
    } catch (err) { /* ignore */ }
    return out;
  }
  function saveBinds() {
    try { localStorage.setItem('nestalgia:keys', JSON.stringify(binds)); } catch (err) { /* ignore */ }
  }
  const binds = loadBinds();
  function actionFor(code) {
    for (let i = 0; i < NAMES.length; i++) if (binds[NAMES[i]] === code) return NAMES[i];
    if (code === 'ShiftRight' && binds.SELECT === 'ShiftLeft') return 'SELECT';
    return null;
  }
  function keyLabel(code) {
    const fixed = {
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
      ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
      AltLeft: 'Alt', AltRight: 'Alt', Space: 'Space', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab',
      Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: "'", BracketLeft: '[', BracketRight: ']',
      Minus: '-', Equal: '=', Backslash: '\\', Backquote: '`'
    };
    if (fixed[code]) return fixed[code];
    let m = /^Key(.)$/.exec(code); if (m) return m[1];
    m = /^Digit(.)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
    return code;
  }

  /* Customize mode: click a controller button, then press the key to assign. */
  let customizing = false, target = null;
  const swallow = new Set();
  function selectAction(n) {
    target = n;
    document.querySelectorAll('#pad [data-btn]').forEach((e) => e.classList.toggle('target', e.getAttribute('data-btn') === n));
    document.querySelectorAll('.mapbtn').forEach((b) => {
      const on = b.getAttribute('data-map') === n;
      b.classList.toggle('on', on);
      b.querySelector('kbd').textContent = on ? 'Press a key' : keyLabel(binds[b.getAttribute('data-map')]);
    });
    if (n) setStatus('Press the key for ' + ACTION_LABEL[n] + '. Esc cancels.');
  }
  function renderKeys() {
    NAMES.forEach((n) => {
      const t = document.getElementById('kh-' + n);
      if (t) t.textContent = keyLabel(binds[n]);
      const b = document.querySelector('.mapbtn[data-map="' + n + '"] kbd');
      if (b && target !== n) b.textContent = keyLabel(binds[n]);
    });
    const dl = $('keys');
    dl.textContent = '';
    const row = (name, items) => {
      const d = el('div');
      const dt = el('dt'); dt.textContent = name;
      const dd = el('dd');
      items.forEach((it, i) => {
        if (i) dd.appendChild(document.createTextNode(' '));
        if (it.k) { const k = el('kbd'); k.textContent = it.k; dd.appendChild(k); }
        else dd.appendChild(document.createTextNode(it.t));
      });
      d.append(dt, dd); dl.appendChild(d);
    };
    const K = (n) => ({ k: keyLabel(binds[n]) });
    row('D-pad', [K('UP'), K('DOWN'), K('LEFT'), K('RIGHT')]);
    row('A / B', [K('A'), K('B')]);
    row('Start / Select', [K('START'), K('SELECT')]);
    row('Pause / Mute', [{ k: 'P' }, { k: 'M' }]);
    row('Gamepad', [{ t: 'Plug in, press a button' }]);
  }
  function setCustom(v) {
    customizing = v;
    padWrap.classList.toggle('customizing', v);
    $('map').hidden = !v;
    $('custom').classList.toggle('on', v);
    $('custom').setAttribute('aria-pressed', v ? 'true' : 'false');
    $('custom').textContent = v ? 'Done' : 'Customize keys';
    releaseAll();
    selectAction(null);
    setStatus(v ? 'Click a button on the controller or in the list, then press the key you want.' : 'Controls saved.');
  }
  function captureKey(e) {
    if (e.code === 'Escape') {
      e.preventDefault(); swallow.add(e.code);
      selectAction(null); setStatus('Cancelled. Nothing changed.');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); swallow.add(e.code);
    if (e.repeat) return;
    if (RESERVED[e.code]) {
      setStatus(keyLabel(e.code) + ' is kept for ' + RESERVED[e.code] + '. Pick another key.', true);
      return;
    }
    const from = target, prev = binds[from], other = actionFor(e.code);
    if (other && other !== from) binds[other] = prev;
    binds[from] = e.code;
    saveBinds();
    selectAction(null);
    renderKeys();
    setStatus(ACTION_LABEL[from] + ' is now ' + keyLabel(e.code) + (other && other !== from ? '. ' + ACTION_LABEL[other] + ' took ' + keyLabel(prev) + '.' : '.'));
  }

  function onKeyDown(e) {
    if (customizing && target) { captureKey(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (e.code === 'Enter' && (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A')) return;
    const n = actionFor(e.code);
    if (n) {
      if (running) e.preventDefault();
      if (e.repeat) return;
      src.kbd.add(n); refresh(n); resumeAudio();
    } else if (e.code === 'KeyP' && running) {
      setPaused(!paused);
    } else if (e.code === 'KeyM') {
      setMuted(!muted);
    }
  }
  function onKeyUp(e) {
    if (swallow.has(e.code)) { swallow.delete(e.code); if (e.preventDefault) e.preventDefault(); }
    const n = actionFor(e.code);
    if (!n) return;
    src.kbd.delete(n); refresh(n);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);

  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* ignore */ } }
  document.querySelectorAll('#pad [data-hit]').forEach((node) => {
    const n = node.getAttribute('data-hit');
    const up = () => { src.ui.delete(n); refresh(n); };
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (customizing) { selectAction(n); return; }
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      src.ui.add(n); refresh(n); resumeAudio(); buzz();
    });
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', up);
  });

  /* The D-pad is one touch surface: the direction follows the thumb, diagonals included. */
  const dpad = $('dpad'), padSvg = $('pad');
  let dpadPointer = null;
  function padPoint(e) {
    const pt = padSvg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(padSvg.getScreenCTM().inverse());
  }
  function dpadMove(e) {
    const p = padPoint(e);
    const dx = p.x - 104, dy = p.y - 103;
    const next = new Set();
    if (Math.hypot(dx, dy) > 10) {
      const a = Math.atan2(dy, dx) * 180 / Math.PI;
      if (Math.abs(a) < 67.5) next.add('RIGHT');
      if (Math.abs(a) > 112.5) next.add('LEFT');
      if (a > 22.5 && a < 157.5) next.add('DOWN');
      if (a < -22.5 && a > -157.5) next.add('UP');
    }
    ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach((n) => {
      if (next.has(n)) src.ui.add(n); else src.ui.delete(n);
      refresh(n);
    });
  }
  function dpadEnd(e) {
    if (e.pointerId !== dpadPointer) return;
    dpadPointer = null;
    ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach((n) => { src.ui.delete(n); refresh(n); });
  }
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (customizing) {
      const p = padPoint(e);
      const dx = p.x - 104, dy = p.y - 103;
      selectAction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
      return;
    }
    dpadPointer = e.pointerId;
    try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    dpadMove(e); resumeAudio();
  });
  dpad.addEventListener('pointermove', (e) => { if (e.pointerId === dpadPointer) dpadMove(e); });
  dpad.addEventListener('pointerup', dpadEnd);
  dpad.addEventListener('pointercancel', dpadEnd);
  dpad.addEventListener('lostpointercapture', dpadEnd);
  padSvg.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('gamepadconnected', (e) => setStatus('Gamepad connected: ' + e.gamepad.id));
  function pollPad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < list.length; i++) { if (list[i] && list[i].connected) { gp = list[i]; break; } }
    const next = new Set();
    if (gp) {
      const b = (k) => gp.buttons[k] && gp.buttons[k].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (b(0) || b(1)) next.add('A');
      if (b(2) || b(3)) next.add('B');
      if (b(8)) next.add('SELECT');
      if (b(9)) next.add('START');
      if (b(12) || ay < -0.5) next.add('UP');
      if (b(13) || ay > 0.5) next.add('DOWN');
      if (b(14) || ax < -0.5) next.add('LEFT');
      if (b(15) || ax > 0.5) next.add('RIGHT');
    }
    if (!next.size && !src.pad.size) return;
    NAMES.forEach((n) => {
      const had = src.pad.has(n), has = next.has(n);
      if (had !== has) { if (has) src.pad.add(n); else src.pad.delete(n); refresh(n); }
    });
  }

  /* ---------- Audio (NES) ---------- */
  let actx = null, gain = null, sfxGain = null;
  const MASK = 8191, bufL = new Float32Array(8192), bufR = new Float32Array(8192);
  let wp = 0, rp = 0;
  function pushSample(l, r) { bufL[wp & MASK] = l; bufR[wp & MASK] = r; wp++; }
  function initAudio() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
      gain = actx.createGain();
      sfxGain = actx.createGain();
      applyVolume();
      const proc = actx.createScriptProcessor(1024, 0, 2);
      proc.onaudioprocess = (ev) => {
        const oL = ev.outputBuffer.getChannelData(0), oR = ev.outputBuffer.getChannelData(1);
        if (wp - rp > 6144) rp = wp - 2048;
        for (let i = 0; i < oL.length; i++) {
          if (rp < wp) { oL[i] = bufL[rp & MASK]; oR[i] = bufR[rp & MASK]; rp++; }
          else { oL[i] = 0; oR[i] = 0; }
        }
      };
      proc.connect(gain);
      gain.connect(actx.destination);
      sfxGain.connect(actx.destination);
    } catch (err) { actx = null; }
  }
  function resumeAudio() {
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (err) { /* ignore */ } }
  }
  function applyVolume() {
    const v = muted ? 0 : $('vol').value / 100;
    if (gain) gain.gain.value = v;
    if (sfxGain) sfxGain.gain.value = v * 0.6;
  }
  function setMuted(v) {
    muted = v;
    $('mute').textContent = v ? 'Unmute' : 'Mute';
    $('mute').setAttribute('aria-pressed', v ? 'true' : 'false');
    applyVolume();
  }
  $('mute').addEventListener('click', () => setMuted(!muted));
  $('vol').addEventListener('input', () => { if (muted) setMuted(false); else applyVolume(); });

  function sfx(which) {
    if (!actx || muted) return;
    try {
      const t = actx.currentTime;
      const o = actx.createOscillator(), g = actx.createGain();
      if (which === 'insert') {
        o.type = 'square';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      } else {
        o.type = 'triangle';
        o.frequency.setValueAtTime(260, t);
        o.frequency.exponentialRampToValueAtTime(760, t + 0.09);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      }
      o.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.22);
    } catch (err) { /* ignore */ }
  }

  /* ---------- Emulators ---------- */
  const img = sctx.createImageData(256, 240);
  const buf32 = new Uint32Array(img.data.buffer);
  buf32.fill(0xFF000000);
  function paint(fb) {
    for (let i = 0; i < 61440; i++) buf32[i] = 0xFF000000 | fb[i];
    sctx.putImageData(img, 0, 0);
  }
  function bytesToString(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }
  function validNes(b) {
    return !!b && b.length > 16 && b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A;
  }
  function syncUI() {
    $('pause').disabled = !running;
    $('save').disabled = !running;
    $('restore').disabled = !running;
    $('btnReset').disabled = !running || busy;
    $('btnEject').disabled = !inserted || busy;
    $('ejectTv').disabled = !inserted || busy;
    document.body.classList.toggle('playing', running);
    $('pause').textContent = paused ? 'Resume' : 'Pause';
  }

  function startNes(bytes, name) {
    if (!window.jsnes) { setStatus('The NES emulator core did not load. Check your connection and reload.', true); return false; }
    if (!validNes(bytes)) { setStatus('That file is not an iNES ROM.', true); return false; }
    initAudio(); resumeAudio();
    let inst;
    try {
      inst = new jsnes.NES({ onFrame: paint, onAudioSample: pushSample, sampleRate: actx ? actx.sampleRate : 44100 });
      inst.loadROM(bytesToString(bytes));
    } catch (err) {
      setStatus('This game could not start: ' + (err && err.message ? err.message : err), true);
      return false;
    }
    nes = inst; kind = 'nes'; romName = name; romSize = bytes.length;
    wp = 0; rp = 0; acc = 0;
    applied.clear(); releaseAll();
    running = true; paused = false;
    syncUI();
    return true;
  }

  async function startEmu(rec) {
    return startNes(rec.bytes, rec.name);
  }
  function stopEmu() {
    releaseAll();
    running = false; paused = false; nes = null; kind = null;
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, 256, 240);
    tv.dataset.sys = '';
    padWrap.dataset.sys = '';
    syncUI();
  }
  function setPaused(v) {
    if (!running) return;
    paused = v;
    osd(v ? 'Paused' : 'Play', v ? 60000 : 900);
    syncUI();
  }
  $('pause').addEventListener('click', () => setPaused(!paused));

  let last = performance.now(), acc = 0, lastNoise = 0;
  const STEP = 1000 / 60.0988;
  function frame(t) {
    requestAnimationFrame(frame);
    pollPad();
    if (mode !== 'game' && t - lastNoise > 33) { drawNoise(); lastNoise = t; }
    const dt = Math.min(t - last, 100);
    last = t;
    if (!running || paused || mode !== 'game' || kind !== 'nes' || !nes) { acc = 0; return; }
    acc += dt;
    let n = 0;
    try {
      while (acc >= STEP && n < 2) { nes.frame(); acc -= STEP; n++; }
    } catch (err) {
      setPaused(true);
      setStatus('The game stopped: ' + (err && err.message ? err.message : err), true);
    }
    if (acc > STEP * 2) acc = 0;
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) setPaused(true);
  });

  const stateKey = () => 'nestalgia:state:' + (kind || 'x') + ':' + romName + ':' + romSize;
  $('save').addEventListener('click', () => {
    if (!running) return;
    if (!nes) return;
    const key = stateKey();
    let json;
    try { json = JSON.stringify(nes.toJSON()); }
    catch (err) { setStatus('Could not save the state: ' + (err && err.message ? err.message : err), true); return; }
    memState[key] = json;
    try { localStorage.setItem(key, json); osd('State saved'); }
    catch (err) { osd('Saved for now'); setStatus('State kept for this visit only. Browser storage is full or blocked.'); }
  });
  $('restore').addEventListener('click', () => {
    if (!running) return;
    const key = stateKey();
    if (!nes) return;
    let json = memState[key];
    if (!json) { try { json = localStorage.getItem(key); } catch (err) { /* ignore */ } }
    if (!json) { osd('No state'); setStatus('No saved state for this cartridge yet.'); return; }
    try { nes.fromJSON(JSON.parse(json)); osd('State loaded'); }
    catch (err) { setStatus('Could not load the saved state: ' + (err && err.message ? err.message : err), true); }
  });

  if (!document.fullscreenEnabled) {
    $('full').hidden = true;
  } else {
    $('full').addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      const p = glass.requestFullscreen();
      if (p && p.catch) p.catch(() => setStatus('Fullscreen is not available here.'));
    });
  }

  /* ---------- Stored ROMs (IndexedDB, this browser only) ---------- */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        try {
          const r = indexedDB.open('nestalgia', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('roms', { keyPath: 'id' });
          r.onsuccess = () => { DB.db = r.result; res(true); };
          r.onerror = () => res(false);
          r.onblocked = () => res(false);
        } catch (err) { res(false); }
      });
    },
    tx(modeName, fn) {
      return new Promise((res) => {
        if (!DB.db) { res(null); return; }
        try {
          const t = DB.db.transaction('roms', modeName);
          const rq = fn(t.objectStore('roms'));
          t.oncomplete = () => res(rq && rq.result !== undefined ? rq.result : true);
          t.onerror = t.onabort = () => res(null);
        } catch (err) { res(null); }
      });
    },
    put(rec) {
      return DB.tx('readwrite', (s) => s.put({
        id: rec.id, name: rec.name, size: rec.size, sys: rec.sys,
        added: rec.added, bytes: rec.bytes.buffer.slice(0)
      }));
    },
    all() { return DB.tx('readonly', (s) => s.getAll()).then((r) => (Array.isArray(r) ? r : [])); },
    del(id) { return DB.tx('readwrite', (s) => s.delete(id)); }
  };

  /* ---------- Cartridges ---------- */
  const COLORS = ['#f5b800', '#e4683a', '#b9b6a8', '#3f8f86', '#5666b8', '#8aa33a'];
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function iconFor(h) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 5 5');
    s.setAttribute('class', 'icon');
    s.setAttribute('aria-hidden', 'true');
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (!((h >>> (r * 3 + c)) & 1)) continue;
        [c, 4 - c].filter((v, i, a) => a.indexOf(v) === i).forEach((cx) => {
          const q = document.createElementNS(NS, 'rect');
          q.setAttribute('x', cx); q.setAttribute('y', r); q.setAttribute('width', 1); q.setAttribute('height', 1);
          s.appendChild(q);
        });
      }
    }
    return s;
  }
  function makeCart(rec) {
    const h = hash(rec.name + ':' + rec.size);
    const slot = el('div', 'slot');
    slot.dataset.id = rec.id;
    const bed = el('div', 'bed');
    const cart = el('button', 'cart');
    cart.type = 'button';
    cart.style.setProperty('--shell', COLORS[h % COLORS.length]);
    const label = el('span', 'label');
    const title = el('span', 'title'); title.textContent = rec.name;
    const meta = el('span', 'meta');
    const tl = el('span', 'tagline'); tl.textContent = '8-BIT';
    meta.append(tl, iconFor(h));
    label.append(title, meta);
    cart.append(el('span', 'grip'), label);
    cart.setAttribute('aria-label', 'Insert ' + rec.name);
    cart.title = rec.name;
    bed.append(cart);

    const tools = el('div', 'tools');
    const rm = el('button', 'tb rm'); rm.type = 'button'; rm.textContent = '×';
    rm.setAttribute('aria-label', 'Remove ' + rec.name + ' from the shelf');
    tools.append(rm);
    slot.append(bed, tools);

    rec.el = cart; rec.slot = slot; rec.bed = bed;
    cart.addEventListener('click', () => onCartClick(rec));
    rm.addEventListener('click', () => removeRec(rec));
    shelf.insertBefore(slot, $('addSlot'));
  }

  function anim(node, frames, dur, ease, finalTransform) {
    return new Promise((res) => {
      const done = () => { node.style.transform = finalTransform; res(); };
      if (reduceMotion() || !node.animate) { done(); return; }
      const a = node.animate(frames, { duration: dur, easing: ease, fill: 'forwards' });
      a.onfinish = () => { node.style.transform = finalTransform; a.cancel(); res(); };
      a.oncancel = () => res();
    });
  }

  async function flyIn(rec) {
    const cart = rec.el;
    shelf.scrollLeft = Math.max(0, rec.slot.offsetLeft - 12);
    const f = fly.getBoundingClientRect();
    const r = cart.getBoundingClientRect();
    cart.classList.add('flying');
    cart.style.left = (r.left - f.left) + 'px';
    cart.style.top = (r.top - f.top) + 'px';
    cart.style.transform = '';
    fly.appendChild(cart);
    rec.bed.classList.add('empty');
    const h = holder.getBoundingClientRect();
    const dx = h.left - r.left, dy = h.top - HOVER - r.top;
    await anim(cart, [
      { transform: 'translate(0px,0px) rotate(0deg)' },
      { transform: 'translate(0px,-22px) rotate(-3deg)', offset: 0.2 },
      { transform: 'translate(' + dx + 'px,' + (dy - 24) + 'px) rotate(2deg)', offset: 0.78 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg)' }
    ], 760, 'cubic-bezier(.45,.05,.3,1)', 'translate(' + dx + 'px,' + dy + 'px)');
    cart.classList.remove('flying');
    cart.classList.add('docked');
    cart.style.left = ''; cart.style.top = '';
    cart.style.transform = 'translateY(' + (-HOVER) + 'px)';
    holder.appendChild(cart);
    await anim(cart, [
      { transform: 'translateY(' + (-HOVER) + 'px)' },
      { transform: 'translateY(' + (DEPTH + 4) + 'px)', offset: 0.8 },
      { transform: 'translateY(' + DEPTH + 'px)' }
    ], 460, 'cubic-bezier(.55,0,.8,.55)', 'translateY(' + DEPTH + 'px)');
  }

  async function flyOut(rec) {
    const cart = rec.el;
    await anim(cart, [
      { transform: 'translateY(' + DEPTH + 'px)' },
      { transform: 'translateY(' + POP + 'px)' }
    ], 280, 'cubic-bezier(.2,.9,.3,1.2)', 'translateY(' + POP + 'px)');
    if (!reduceMotion()) await wait(180);
    shelf.scrollLeft = Math.max(0, rec.slot.offsetLeft - 12);
    const f = fly.getBoundingClientRect();
    const r = cart.getBoundingClientRect();
    cart.classList.remove('docked');
    cart.classList.add('flying');
    cart.style.transform = '';
    cart.style.left = (r.left - f.left) + 'px';
    cart.style.top = (r.top - f.top) + 'px';
    fly.appendChild(cart);
    const s = rec.bed.getBoundingClientRect();
    const tx = s.left + (s.width - cart.offsetWidth) / 2 - r.left;
    const ty = s.top + (s.height - cart.offsetHeight) / 2 - r.top;
    await anim(cart, [
      { transform: 'translate(0px,0px) rotate(0deg)' },
      { transform: 'translate(' + (tx * 0.3) + 'px,-30px) rotate(-4deg)', offset: 0.35 },
      { transform: 'translate(' + tx + 'px,' + (ty - 16) + 'px) rotate(2deg)', offset: 0.85 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(0deg)' }
    ], 720, 'cubic-bezier(.45,.05,.3,1)', 'translate(' + tx + 'px,' + ty + 'px)');
    cart.classList.remove('flying');
    cart.style.left = ''; cart.style.top = ''; cart.style.transform = '';
    rec.bed.appendChild(cart);
    rec.bed.classList.remove('empty');
  }

  async function doInsert(rec) {
    initAudio(); resumeAudio();
    setStatus('Inserting ' + rec.name + '…');
    await flyIn(rec);
    inserted = rec;
    rec.el.setAttribute('aria-label', 'Eject ' + rec.name);
    deck.classList.add('on');
    sfx('insert');
    $('now').textContent = rec.name;
    tv.dataset.sys = rec.sys;
    padWrap.dataset.sys = rec.sys;
    setMode('tuning');
    osd('Tuning', 900);
    syncUI();
    const started = startEmu(rec);
    await wait(reduceMotion() ? 0 : 750);
    if (!(await started)) {
      setMode('static');
      await doEject(true);
      return;
    }
    setMode('game');
    if (document.body.classList.contains('playing')) window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    powerOn();
    osd('Play', 1800);
    setStatus('Playing ' + rec.name + '. Click the cartridge or press Eject to swap games.');
  }

  async function doEject(quiet) {
    const rec = inserted;
    if (!rec) return;
    stopEmu();
    setMode('static');
    deck.classList.remove('on');
    $('now').textContent = 'No cartridge';
    $('osd').classList.remove('show');
    sfx('eject');
    await flyOut(rec);
    inserted = null;
    rec.el.setAttribute('aria-label', 'Insert ' + rec.name);
    if (!quiet) setStatus('Cartridge ejected. Pick another one from the shelf.');
    syncUI();
  }

  async function guarded(fn) {
    if (busy) return;
    busy = true; syncUI();
    try { await fn(); }
    catch (err) { console.error(err); setStatus('Something went wrong: ' + (err && err.message ? err.message : err), true); }
    finally { busy = false; syncUI(); }
  }

  function onCartClick(rec) {
    if (busy) return;
    if (!window.jsnes) { setStatus('The NES emulator core did not load. Check your connection and reload.', true); return; }
    guarded(async () => {
      if (inserted === rec) { await doEject(); return; }
      if (inserted) await doEject(true);
      await doInsert(rec);
    });
  }

  function removeRec(rec) {
    if (busy) return;
    guarded(async () => {
      if (inserted === rec) await doEject(true);
      rec.slot.remove();
      const i = recs.indexOf(rec);
      if (i >= 0) recs.splice(i, 1);
      DB.del(rec.id);
      setStatus('Removed ' + rec.name + ' from the shelf.');
    });
  }

    async function addRomFile(file) {
    if (!file) return;
    if (busy) { setStatus('Wait for the cartridge to finish moving, then try again.'); return; }
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = m ? m[1].toLowerCase() : '';
    if (ext !== 'nes') { setStatus('Load a .nes file.', true); return; }
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); }
    catch (err) { setStatus('Could not read that file.', true); return; }
    if (!validNes(bytes)) { setStatus('That file is not a .nes ROM.', true); return; }
    const name = file.name.replace(/\.[a-z0-9]+$/i, '');
    let rec = recs.find((r) => r.name === name && r.size === bytes.length && r.sys === 'nes');
    if (!rec) {
      rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: name, size: bytes.length, sys: 'nes', bytes: bytes, added: Date.now() };
      recs.push(rec);
      makeCart(rec);
      DB.put(rec);
    }
    onCartClick(rec);
  }

  $('addCart').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', (e) => { addRomFile(e.target.files[0]); e.target.value = ''; });
  $('btnEject').addEventListener('click', () => { if (inserted) guarded(() => doEject()); });
  $('ejectTv').addEventListener('click', () => { if (inserted) guarded(() => doEject()); });
  $('btnReset').addEventListener('click', async () => {
    if (!running || busy || !inserted) return;
    if (startNes(inserted.bytes, inserted.name)) osd('Reset', 900);
  });

  window.addEventListener('dragover', (e) => { e.preventDefault(); tv.classList.add('drop'); });
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) tv.classList.remove('drop'); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    tv.classList.remove('drop');
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    addRomFile(f);
  });

  /* ---------- Controller customize panel ---------- */
  MAP_ORDER.forEach((n) => {
    const b = el('button', 'mapbtn');
    b.type = 'button';
    b.setAttribute('data-map', n);
    const lab = el('span'); lab.textContent = ACTION_LABEL[n];
    b.append(lab, el('kbd'));
    b.addEventListener('click', () => selectAction(target === n ? null : n));
    $('map').insertBefore(b, document.querySelector('.map-actions'));
  });
  $('custom').addEventListener('click', () => setCustom(!customizing));
  $('mapReset').addEventListener('click', () => {
    Object.assign(binds, DEFAULT_BINDS);
    saveBinds(); selectAction(null); renderKeys();
    setStatus('Keys reset to the defaults.');
  });
  renderKeys();

  /* ---------- Boot ---------- */
  if (!window.jsnes) setStatus('The NES emulator core did not load. Check your connection and reload.', true);
  DB.open().then((ok) => (ok ? DB.all() : [])).then((list) => {
    list.filter((r) => (r.sys || 'nes') === 'nes').sort((a, b) => a.added - b.added).forEach((r) => {
      const rec = { id: r.id, name: r.name, size: r.size, sys: 'nes', added: r.added, bytes: new Uint8Array(r.bytes) };
      recs.push(rec);
      makeCart(rec);
    });
    if (recs.length && window.jsnes) setStatus('No cartridge in the console. Pick one from the shelf.');
  });
  syncUI();
})();
