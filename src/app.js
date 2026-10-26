import { PARAMS, PARAM_MAP, GROUPS, DEFAULTS, generate, normalizeParams, quantize } from './generator.js';
import { PALETTES, MODES, ringsMarkup, designSVG, viewBox, paletteColor } from './render.js';
import { cutSVG, artSVG, toDXF, svgToPngBlob, download } from './export.js';
import { makeVariations } from './variations.js';
import { PRESETS } from './presets.js';

const $ = (sel) => document.querySelector(sel);
const VIEWS = {
  top: { rx: 0, rz: 0, explode: 0 },
  tilt: { rx: 52, rz: -18, explode: 0 },
  exploded: { rx: 60, rz: -26, explode: 1 },
};
const MODE_KEYS = Object.keys(MODES);
const VIEW_KEYS = Object.keys(VIEWS);
const USER_PRESETS_KEY = 'orbis.presets';
const LOCKS_KEY = 'orbis.locks';

const state = {
  params: { ...DEFAULTS },
  palette: 'circuit',
  mode: 'line',
  view: 'top',
  orbit: { ...VIEWS.top },
  zoom: 1,
  animate: false,
  locks: new Set(load(LOCKS_KEY, [])),
  design: null,
};
const undoStack = { past: [], future: [] };

const viewport = $('#viewport');
const stage = $('#stage');
const inputs = {};
let layers = [];

// ---------------------------------------------------------------- storage
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-critical */
  }
}

// ---------------------------------------------------------------- URL state
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const params = { ...DEFAULTS };
  for (const def of PARAMS) if (q.has(def.key)) params[def.key] = quantize(def, q.get(def.key));
  if (PALETTES[q.get('palette')]) state.palette = q.get('palette');
  if (MODES[q.get('mode')]) state.mode = q.get('mode');
  if (VIEWS[q.get('view')]) state.view = q.get('view');
  state.params = params;
}
function writeHash() {
  const q = new URLSearchParams();
  for (const def of PARAMS) if (state.params[def.key] !== def.def) q.set(def.key, state.params[def.key]);
  if (state.palette !== 'circuit') q.set('palette', state.palette);
  if (state.mode !== 'line') q.set('mode', state.mode);
  if (state.view !== 'top') q.set('view', state.view);
  window.history.replaceState(null, '', '#' + q.toString());
}

// ---------------------------------------------------------------- controls
function buildControls() {
  const root = $('#controls');
  for (const group of GROUPS) {
    const det = document.createElement('details');
    det.className = 'group';
    det.open = true;
    det.innerHTML = `<summary>${group.label}</summary>`;
    for (const def of PARAMS.filter((p) => p.group === group.id)) {
      const row = document.createElement('div');
      row.className = 'param';
      row.innerHTML = `
        <span class="label" title="${def.label}">${def.label}</span>
        <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" aria-label="${def.label}">
        <input type="number" min="${def.min}" max="${def.max}" step="${def.step}" aria-label="${def.label} value">
        <button class="lock" title="Lock from randomize">${def.rand ? '🔓' : ''}</button>`;
      const [range, num] = row.querySelectorAll('input');
      const lock = row.querySelector('.lock');
      if (!def.rand) lock.disabled = true;
      range.addEventListener('input', () => setParam(def.key, range.value, false));
      range.addEventListener('change', () => commit());
      num.addEventListener('change', () => {
        setParam(def.key, num.value, false);
        commit();
      });
      lock.addEventListener('click', () => {
        if (state.locks.has(def.key)) state.locks.delete(def.key);
        else state.locks.add(def.key);
        save(LOCKS_KEY, [...state.locks]);
        syncControls();
      });
      inputs[def.key] = { range, num, lock };
      det.appendChild(row);
    }
    root.appendChild(det);
  }

  const pal = $('#palette');
  pal.innerHTML = Object.entries(PALETTES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  pal.addEventListener('change', () => { state.palette = pal.value; commit(); });
  const mode = $('#mode');
  mode.innerHTML = Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  mode.addEventListener('change', () => { state.mode = mode.value; commit(); });
  $('#view').addEventListener('change', (e) => setView(e.target.value));
}

function syncControls() {
  for (const def of PARAMS) {
    const { range, num, lock } = inputs[def.key];
    const v = state.params[def.key];
    if (document.activeElement !== range) range.value = v;
    if (document.activeElement !== num) num.value = v;
    range.style.setProperty('--pct', `${((v - def.min) / (def.max - def.min)) * 100}%`);
    if (def.rand) {
      const on = state.locks.has(def.key);
      lock.classList.toggle('on', on);
      lock.textContent = on ? '🔒' : '🔓';
    }
  }
  $('#palette').value = state.palette;
  $('#mode').value = state.mode;
  $('#view').value = state.view;
  $('#btnUndo').disabled = !undoStack.past.length;
  $('#btnRedo').disabled = !undoStack.future.length;
}

// ---------------------------------------------------------------- state changes
const snapshot = () => JSON.stringify({ params: state.params, palette: state.palette, mode: state.mode });
let committed = null;

function setParam(key, value, doCommit = true) {
  state.params[key] = quantize(PARAM_MAP[key], value);
  scheduleRender();
  if (doCommit) commit();
}

function setParams(params) {
  state.params = normalizeParams(params);
  commit();
}

function commit() {
  const snap = snapshot();
  if (committed && snap !== committed) {
    undoStack.past.push(committed);
    if (undoStack.past.length > 200) undoStack.past.shift();
    undoStack.future = [];
  }
  committed = snap;
  scheduleRender(true);
}

function restore(snap) {
  const s = JSON.parse(snap);
  state.params = s.params;
  state.palette = s.palette;
  state.mode = s.mode;
  committed = snap;
  scheduleRender(true);
}

function undo() {
  if (!undoStack.past.length) return;
  undoStack.future.push(committed);
  restore(undoStack.past.pop());
}
function redo() {
  if (!undoStack.future.length) return;
  undoStack.past.push(committed);
  restore(undoStack.future.pop());
}

function randomize() {
  const next = { ...state.params };
  for (const def of PARAMS) {
    if (!def.rand || state.locks.has(def.key)) continue;
    const [lo, hi] = def.rand;
    next[def.key] = quantize(def, lo + Math.random() * (hi - lo));
  }
  setParams(next);
}

function mutate() {
  const next = { ...state.params };
  for (const def of PARAMS) {
    if (!def.rand || state.locks.has(def.key) || def.key === 'seed') continue;
    if (Math.random() < 0.5) continue;
    const span = (def.max - def.min) * 0.12;
    next[def.key] = quantize(def, next[def.key] + (Math.random() * 2 - 1) * span);
  }
  if (!state.locks.has('seed') && Math.random() < 0.3) next.seed = Math.floor(Math.random() * 1000);
  setParams(next);
}

function newSeed() {
  setParam('seed', Math.floor(Math.random() * 1000));
}

// ---------------------------------------------------------------- rendering
let renderQueued = false;
let fullQueued = false;
function scheduleRender(full = false) {
  fullQueued ||= full;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render(fullQueued);
    fullQueued = false;
  });
}

function render(full) {
  const design = generate(state.params);
  state.design = design;
  const n = design.rings.length;

  while (layers.length < n) {
    const el = document.createElement('div');
    el.className = 'layer';
    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    stage.appendChild(el);
    layers.push({ el, svg: el.firstChild, angle: 0, speed: 0 });
  }
  while (layers.length > n) layers.pop().el.remove();

  const vb = viewBox(design);
  layers.forEach((layer, i) => {
    layer.svg.setAttribute('viewBox', vb);
    layer.svg.innerHTML = ringsMarkup(design, { palette: state.palette, mode: state.mode, rings: [i] });
    layer.speed = (i % 2 ? -1 : 1) * (4 + ((i * 7919) % 13)) / (1 + i * 0.25);
  });
  positionLayers();

  viewport.className = `viewport mode-${state.mode}${dragging ? ' dragging' : ''}`;
  viewport.style.setProperty('--glow', paletteColor(state.palette, 0.4));
  $('#modeLabel').textContent = MODES[state.mode].label.toUpperCase();

  const s = design.stats;
  $('#stats').innerHTML = `
    <div>${s.parts} PARTS · ${s.cutouts} CUTOUTS</div>
    <div>OUTER Ø ${s.outerDiameter} MM</div>
    <div>${s.rings} RINGS · ${s.hairlines} HAIRLINES</div>
    <div class="dim">CUT ${(s.cutLengthMm / 1000).toFixed(1)} M · AREA ${(s.areaMm2 / 1e6).toFixed(3)} M²</div>`;
  $('#fileName').textContent = `${fileBase()}.svg`;

  syncControls();
  if (full) {
    writeHash();
    renderVariations();
  }
}

function positionLayers() {
  const size = stage.clientWidth || 600;
  const gap = (size * 0.32 * state.orbit.explode) / Math.max(4, layers.length);
  const center = (layers.length - 1) / 2;
  layers.forEach((layer, i) => {
    layer.el.style.transform = `translateZ(${(i - center) * gap}px)`;
    layer.svg.style.transform = layer.angle ? `rotate(${layer.angle}deg)` : '';
  });
}

function applyOrbit() {
  stage.style.setProperty('--rx', `${state.orbit.rx}deg`);
  stage.style.setProperty('--rz', `${state.orbit.rz}deg`);
  stage.style.setProperty('--zoom', state.zoom);
  positionLayers();
}

function setView(view) {
  state.view = view;
  state.orbit = { ...VIEWS[view] };
  applyOrbit();
  syncControls();
  writeHash();
}

function fitStage() {
  const r = viewport.getBoundingClientRect();
  stage.style.setProperty('--size', `${Math.min(r.width, r.height) * 0.9}px`);
  positionLayers();
}

// ---------------------------------------------------------------- orbit / zoom
let dragging = null;
viewport.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.hud')) return;
  dragging = { x: e.clientX, y: e.clientY, rx: state.orbit.rx, rz: state.orbit.rz };
  viewport.classList.add('dragging');
  viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragging.x;
  const dy = e.clientY - dragging.y;
  state.orbit.rz = dragging.rz + dx * 0.3;
  state.orbit.rx = Math.max(0, Math.min(80, dragging.rx - dy * 0.3));
  applyOrbit();
});
const endDrag = () => {
  dragging = null;
  viewport.classList.remove('dragging');
};
viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);
viewport.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.zoom = Math.max(0.4, Math.min(4, state.zoom * Math.exp(-e.deltaY * 0.0012)));
    applyOrbit();
  },
  { passive: false },
);
viewport.addEventListener('dblclick', () => {
  state.zoom = 1;
  setView(state.view);
});

// ---------------------------------------------------------------- animation
let lastT = 0;
function tick(t) {
  if (!state.animate) return;
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
  lastT = t;
  for (const layer of layers) {
    layer.angle = (layer.angle + layer.speed * dt) % 360;
    layer.svg.style.transform = `rotate(${layer.angle}deg)`;
  }
  requestAnimationFrame(tick);
}
function toggleAnimate() {
  state.animate = !state.animate;
  $('#btnAnimate').classList.toggle('on', state.animate);
  $('#btnAnimate').textContent = state.animate ? '❚❚' : '▶';
  if (state.animate) {
    lastT = 0;
    requestAnimationFrame(tick);
  } else {
    for (const layer of layers) layer.angle = 0;
    positionLayers();
  }
}

// ---------------------------------------------------------------- variations
function renderVariations() {
  const root = $('#variations');
  root.innerHTML = '';
  for (const v of makeVariations(state.params)) {
    const d = generate(v.params);
    const btn = document.createElement('button');
    btn.className = 'var' + (v.current ? ' current' : '');
    btn.title = v.current ? 'Current design' : `Apply: ${v.label}`;
    btn.innerHTML =
      designSVG(d, { palette: state.palette, mode: state.mode === 'plot' ? 'line' : state.mode, scaleStroke: 0.8 }) +
      `<span class="vl">${v.label}</span><span class="vp">${d.stats.parts} PARTS</span>`;
    if (!v.current) btn.addEventListener('click', () => setParams(v.params));
    root.appendChild(btn);
  }
}

// ---------------------------------------------------------------- presets
function userPresets() {
  return load(USER_PRESETS_KEY, {});
}
function buildPresets(selected = '') {
  const sel = $('#preset');
  const user = userPresets();
  sel.innerHTML =
    `<option value="">— choose —</option><optgroup label="Built-in">` +
    Object.keys(PRESETS).map((k) => `<option value="b:${k}">${k}</option>`).join('') +
    `</optgroup>` +
    (Object.keys(user).length
      ? `<optgroup label="Saved">` + Object.keys(user).map((k) => `<option value="u:${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('') + `</optgroup>`
      : '');
  sel.value = selected;
  $('#btnDeletePreset').disabled = !sel.value.startsWith('u:');
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function applyPreset(value) {
  if (!value) return;
  const [kind, name] = [value.slice(0, 1), value.slice(2)];
  const preset = kind === 'b' ? PRESETS[name] : userPresets()[name];
  if (!preset) return;
  if (preset.palette) state.palette = preset.palette;
  if (preset.mode) state.mode = preset.mode;
  setParams({ ...DEFAULTS, ...preset.params });
  toast(`Preset: ${name}`);
}

// ---------------------------------------------------------------- export
function fileBase() {
  const p = state.params;
  return `orbis-s${p.seed}-r${p.rings}-${p.outerDiameter}mm`;
}

async function doExport(kind) {
  const d = state.design;
  const base = fileBase();
  const bg = state.mode === 'plot' ? '#f1ece1' : '#0b0f14';
  switch (kind) {
    case 'cut-svg':
      download(`${base}-cut.svg`, cutSVG(d), 'image/svg+xml');
      break;
    case 'dxf':
      download(`${base}.dxf`, toDXF(d), 'application/dxf');
      break;
    case 'art-svg':
      download(`${base}.svg`, artSVG(d, { palette: state.palette, mode: state.mode, background: bg }), 'image/svg+xml');
      break;
    case 'png': {
      const svg = artSVG(d, { palette: state.palette, mode: state.mode, background: bg, scaleStroke: 2.5 });
      download(`${base}.png`, await svgToPngBlob(svg, 2048));
      break;
    }
    case 'json':
      download(`${base}.json`, JSON.stringify({ app: 'orbis', version: 1, palette: state.palette, mode: state.mode, params: state.params }, null, 2), 'application/json');
      break;
    case 'link':
      writeHash();
      try {
        await navigator.clipboard.writeText(location.href);
        toast('Link copied');
      } catch {
        toast('Copy failed — use the address bar');
      }
      return;
  }
  toast(`Exported ${kind.toUpperCase()}`);
}

async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (PALETTES[data.palette]) state.palette = data.palette;
    if (MODES[data.mode]) state.mode = data.mode;
    setParams({ ...DEFAULTS, ...(data.params || data) });
    toast('Imported');
  } catch {
    toast('Not a valid Orbis JSON file');
  }
}

// ---------------------------------------------------------------- misc UI
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

const cycle = (keys, cur) => keys[(keys.indexOf(cur) + 1) % keys.length];

function bindUI() {
  $('#btnRandom').addEventListener('click', randomize);
  $('#btnMutate').addEventListener('click', mutate);
  $('#btnSeed').addEventListener('click', newSeed);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnAnimate').addEventListener('click', toggleAnimate);
  $('#btnShuffle').addEventListener('click', renderVariations);
  $('#modeLabel').addEventListener('click', () => { state.mode = cycle(MODE_KEYS, state.mode); commit(); });
  $('#preset').addEventListener('change', (e) => {
    applyPreset(e.target.value);
    $('#btnDeletePreset').disabled = !e.target.value.startsWith('u:');
  });
  $('#btnSavePreset').addEventListener('click', () => {
    const name = prompt('Preset name', `Seed ${state.params.seed}`)?.trim();
    if (!name) return;
    const user = userPresets();
    user[name] = { params: { ...state.params }, palette: state.palette, mode: state.mode };
    save(USER_PRESETS_KEY, user);
    buildPresets(`u:${name}`);
    toast(`Saved “${name}”`);
  });
  $('#btnDeletePreset').addEventListener('click', () => {
    const v = $('#preset').value;
    if (!v.startsWith('u:')) return;
    const user = userPresets();
    delete user[v.slice(2)];
    save(USER_PRESETS_KEY, user);
    buildPresets();
  });
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('#importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = '';
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const actions = {
      r: randomize,
      m: mutate,
      n: newSeed,
      x: renderVariations,
      ' ': toggleAnimate,
      v: () => { state.mode = cycle(MODE_KEYS, state.mode); commit(); },
      c: () => setView(cycle(VIEW_KEYS, state.view)),
    };
    if (actions[k]) {
      e.preventDefault();
      actions[k]();
    }
  });
  window.addEventListener('hashchange', () => {
    readHash();
    commit();
  });

  new ResizeObserver(fitStage).observe(viewport);
}

// ---------------------------------------------------------------- boot
readHash();
buildControls();
buildPresets();
bindUI();
state.orbit = { ...VIEWS[state.view] };
fitStage();
applyOrbit();
commit();
