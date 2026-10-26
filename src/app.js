import { PARAMS, PARAM_MAP, GROUPS, DEFAULTS, generate, normalizeParams, quantize } from './generator.js';
import { PALETTES, MODES, ringsMarkup, designSVG, viewBox, paletteColor, matGridSVG } from './render.js';
import { fabSVG, jobSVG, artSVG, toDXF, svgToPngBlob, download, paramsComment } from './export.js';
import { PROCESSES, MATERIALS, LAYOUTS, defaultFab, buildJob, checkDesign, estimate } from './fabrication.js';
import { toSTL } from './mesh.js';
import { zip } from './zip.js';
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
const FAB_KEY = 'orbis.fab';
const EMBED = Boolean(window.ORBIS_EMBED);
const PALETTE_MODES = new Set(['line', 'solid', 'neon']);
const LOCK_SVG = (on) =>
  `<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="6" rx="1" fill="currentColor"/><path d="M4 5.5V4a2 2 0 0 1 4 0${on ? 'v1.5' : ''}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

const state = {
  params: { ...DEFAULTS },
  fab: { ...defaultFab('laser'), ...load(FAB_KEY, {}) },
  palette: 'circuit',
  mode: 'material',
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
  if (EMBED || !location.hash) return;
  const q = new URLSearchParams(location.hash.slice(1));
  const params = { ...state.params };
  for (const def of PARAMS) if (q.has(def.key)) params[def.key] = quantize(def, q.get(def.key));
  if (PALETTES[q.get('palette')]) state.palette = q.get('palette');
  if (MODES[q.get('mode')]) state.mode = q.get('mode');
  if (VIEWS[q.get('view')]) state.view = q.get('view');
  state.params = params;
}
function writeHash() {
  if (EMBED) return;
  const q = new URLSearchParams();
  for (const def of PARAMS) if (state.params[def.key] !== def.def) q.set(def.key, state.params[def.key]);
  if (state.palette !== 'circuit') q.set('palette', state.palette);
  if (state.mode !== 'material') q.set('mode', state.mode);
  if (state.view !== 'top') q.set('view', state.view);
  window.history.replaceState(null, '', '#' + q.toString());
}

// ---------------------------------------------------------------- design controls
function buildControls() {
  const root = $('#controls');
  for (const group of GROUPS) {
    if (group.id === 'fab') continue;
    const det = document.createElement('details');
    det.className = 'group';
    det.open = true;
    det.innerHTML = `<summary>${group.label}</summary>`;
    for (const def of PARAMS.filter((p) => p.group === group.id)) {
      const row = document.createElement('div');
      row.className = 'param';
      row.innerHTML = `
        <label for="p-${def.key}">${def.label}</label>
        <input class="val" type="number" id="p-${def.key}-n" min="${def.min}" max="${def.max}" step="${def.step}" aria-label="${def.label} value">
        <button class="lock" title="Lock from Randomize" aria-label="Lock ${def.label}"></button>
        <input type="range" id="p-${def.key}" min="${def.min}" max="${def.max}" step="${def.step}">`;
      const range = row.querySelector('input[type=range]');
      const num = row.querySelector('.val');
      const lock = row.querySelector('.lock');
      if (!def.rand) lock.style.visibility = 'hidden';
      range.addEventListener('input', () => setParam(def.key, range.value, false));
      range.addEventListener('change', () => commit());
      num.addEventListener('change', () => setParam(def.key, num.value));
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

  $('#palette').innerHTML = Object.entries(PALETTES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('#palette').addEventListener('change', (e) => { state.palette = e.target.value; commit(); });
  $('#mode').innerHTML = Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('#mode').addEventListener('change', (e) => { state.mode = e.target.value; commit(); });
  document.querySelectorAll('#viewSeg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
}

function syncControls() {
  for (const def of PARAMS) {
    if (!inputs[def.key]) continue;
    const { range, num, lock } = inputs[def.key];
    const v = state.params[def.key];
    if (document.activeElement !== range) range.value = v;
    if (document.activeElement !== num) num.value = v;
    range.style.setProperty('--pct', `${((v - def.min) / (def.max - def.min)) * 100}%`);
    const on = state.locks.has(def.key);
    lock.classList.toggle('on', on);
    lock.innerHTML = LOCK_SVG(on);
  }
  $('#palette').value = state.palette;
  $('#palette').hidden = !PALETTE_MODES.has(state.mode);
  $('#mode').value = state.mode;
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
  $('#btnUndo').disabled = !undoStack.past.length;
  $('#btnRedo').disabled = !undoStack.future.length;
  syncMake();
}

// ---------------------------------------------------------------- make controls
const FAB_NUMS = ['thickness', 'tool', 'kerf', 'border', 'bedW', 'bedH', 'relief', 'ringStep'];
const FAB_CHECKS = ['engrave', 'labels', 'mounting', 'stlBase'];

function buildMake() {
  $('#processSeg').innerHTML = Object.entries(PROCESSES).map(([k, v]) => `<button data-process="${k}">${v.label}</button>`).join('');
  $('#processSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setProcess(b.dataset.process);
  });
  $('#layoutSeg').innerHTML = Object.entries(LAYOUTS).map(([k, v]) => `<button data-layout="${k}">${v.split(' ')[0]}</button>`).join('');
  $('#layoutSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setFab('layout', b.dataset.layout);
  });
  $('#fab-material').addEventListener('change', (e) => setFab('material', e.target.value));
  for (const key of FAB_NUMS) {
    const el = $(`#fab-${key}`);
    el.addEventListener('change', () => {
      const n = Number(el.value);
      if (Number.isFinite(n)) setFab(key, Math.min(Number(el.max), Math.max(Number(el.min), n)));
      else syncMake();
    });
  }
  for (const key of FAB_CHECKS) $(`#fab-${key}`).addEventListener('change', (e) => setFab(key, e.target.checked));
  for (const key of ['minHole', 'minWeb']) $(`#p-${key}`).addEventListener('change', (e) => setParam(key, e.target.value));
}

function syncMake() {
  const f = state.fab;
  const pr = PROCESSES[f.process];
  document.querySelectorAll('#processSeg button').forEach((b) => b.classList.toggle('on', b.dataset.process === f.process));
  document.querySelectorAll('#layoutSeg button').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === f.layout);
    b.title = LAYOUTS[b.dataset.layout];
  });
  const mat = $('#fab-material');
  if (mat.dataset.process !== f.process) {
    mat.innerHTML = pr.materials.map((k) => `<option value="${k}">${MATERIALS[k].label}</option>`).join('');
    mat.dataset.process = f.process;
  }
  mat.value = f.material;
  for (const key of FAB_NUMS) if (document.activeElement !== $(`#fab-${key}`)) $(`#fab-${key}`).value = f[key];
  for (const key of FAB_CHECKS) $(`#fab-${key}`).checked = !!f[key];
  for (const key of ['minHole', 'minWeb']) if (document.activeElement !== $(`#p-${key}`)) $(`#p-${key}`).value = state.params[key];
  $('#toolLabel').textContent = pr.toolLabel;
  $('#thkLabel').textContent = f.process === 'print' ? 'Base' : 'Thickness';
  $('#kerfField').hidden = f.process !== 'laser';
  const plot = f.process === 'plot';
  $('#layoutBlock').hidden = f.process === 'print' || plot;
  for (const key of ['thickness', 'border', 'mounting']) $(`#fab-${key}`).closest('label').hidden = plot;
  $('#stlBlock').hidden = f.process !== 'print';
  $('#engraveLabel').textContent = { print: 'Raised traces', plot: 'Draw traces', cnc: 'V-carve traces' }[f.process] || 'Engrave traces';
}

function setProcess(proc) {
  const pr = PROCESSES[proc];
  state.fab = { ...state.fab, process: proc, material: pr.material, thickness: pr.thickness, kerf: pr.kerf, tool: pr.tool, bedW: pr.bed[0], bedH: pr.bed[1] };
  state.params = { ...state.params, minHole: pr.minHole, minWeb: pr.minWeb };
  if (proc === 'plot') {
    state.mode = 'plot';
    state.fab.layout = 'assembled';
  }
  else if (state.mode === 'plot') state.mode = 'material';
  commit();
}

function setFab(key, value) {
  state.fab = { ...state.fab, [key]: value };
  commit();
}

// ---------------------------------------------------------------- state changes
const snapshot = () => JSON.stringify({ params: state.params, fab: state.fab, palette: state.palette, mode: state.mode });
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
  save(FAB_KEY, state.fab);
  scheduleRender(true);
}

function restore(snap) {
  const s = JSON.parse(snap);
  Object.assign(state, { params: s.params, fab: s.fab, palette: s.palette, mode: s.mode });
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
    if (!def.rand || state.locks.has(def.key) || def.key === 'seed' || Math.random() < 0.5) continue;
    const span = (def.max - def.min) * 0.12;
    next[def.key] = quantize(def, next[def.key] + (Math.random() * 2 - 1) * span);
  }
  if (!state.locks.has('seed') && Math.random() < 0.3) next.seed = Math.floor(Math.random() * 1000);
  setParams(next);
}

const newSeed = () => setParam('seed', Math.floor(Math.random() * 1000));

// ---------------------------------------------------------------- rendering
let renderQueued = false;
let fullQueued = false;
function scheduleRender(full = false) {
  fullQueued ||= full;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const f = fullQueued;
    fullQueued = false;
    render(f);
  });
}

const material = () => MATERIALS[state.fab.material] || MATERIALS.birch;
let gridFor = null;

function render(full) {
  const design = generate(state.params);
  state.design = design;
  const n = design.rings.length;

  while (layers.length < n) {
    const el = document.createElement('div');
    el.className = 'layer part-layer';
    el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    stage.appendChild(el);
    layers.push({ el, svg: el.firstChild, angle: 0, speed: 0 });
  }
  while (layers.length > n) layers.pop().el.remove();

  if (gridFor !== design.stats.outerDiameter) {
    $('#mat').innerHTML = matGridSVG(design);
    gridFor = design.stats.outerDiameter;
  }
  const vb = viewBox(design);
  const opts = { palette: state.palette, mode: state.mode, material: material() };
  layers.forEach((layer, i) => {
    layer.svg.setAttribute('viewBox', vb);
    layer.svg.innerHTML = ringsMarkup(design, { ...opts, rings: [i] });
    layer.speed = ((i % 2 ? -1 : 1) * (4 + ((i * 7919) % 13))) / (1 + i * 0.25);
  });
  positionLayers();

  viewport.className = `viewport mode-${state.mode}${dragging ? ' dragging' : ''}`;
  viewport.style.setProperty('--glow', paletteColor(state.palette, 0.4));

  const s = design.stats;
  $('#stats').innerHTML = `
    <div><b>${s.parts}</b> parts · <b>${s.cutouts}</b> holes</div>
    <div>Ø <b>${s.outerDiameter}</b> mm · <b>${s.rings}</b> rings</div>
    <div>cut <b>${(s.cutLengthMm / 1000).toFixed(2)}</b> m</div>`;
  $('#fileName').textContent = `${fileBase()}.svg`;
  updateScaleBar();
  syncControls();
  if (full) {
    writeHash();
    renderMake();
    renderVariations();
  }
}

function renderMake() {
  const d = state.design;
  const f = state.fab;
  const checks = checkDesign(d, f);
  const label = { ok: 'ok', warn: 'warn', fail: 'fail', info: 'note' };
  $('#checks').innerHTML = checks.map((c) => `<li class="${c.level}"><span class="tag">${label[c.level]}</span><span>${c.text}</span></li>`).join('');

  const e = estimate(d, f);
  const time = e.minutes < 60 ? `${Math.max(1, Math.round(e.minutes))} min` : `${(e.minutes / 60).toFixed(1)} h`;
  const mass = e.mass < 1000 ? `${Math.round(e.mass)} g` : `${(e.mass / 1000).toFixed(2)} kg`;
  const rows =
    f.process === 'print'
      ? [['Print time', `≈ ${time}`], ['Filament', `≈ ${mass}`], ['Parts', d.stats.parts], ['Volume', `${(e.volume / 1000).toFixed(0)} cm³`]]
      : [['Machine time', `≈ ${time}`], [f.process === 'plot' ? 'Paper' : 'Weight', f.process === 'plot' ? `${f.bedW}×${f.bedH}` : `≈ ${mass}`], ['Pierces', e.pierces], ['Passes', e.passes ?? 1]];
  $('#estimate').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  const preview = $('#jobPreview');
  $('#jobName').textContent = f.process === 'print' ? `${fileBase()}.stl` : `${fileBase()}-${f.layout}.svg`;
  if (f.process === 'print') {
    preview.innerHTML = designSVG(d, { mode: 'toolpath' });
    $('#jobNote').textContent = `STL relief: ${f.stlBase ? `${f.thickness} mm base disc, ` : ''}parts ${f.relief} mm tall${f.ringStep ? `, ${f.ringStep > 0 ? '+' : ''}${f.ringStep} mm per ring` : ''}. Units in mm, Z up.`;
  } else {
    const job = buildJob(d, f);
    preview.innerHTML = jobSVG(job, '', { preview: true });
    $('#jobNote').textContent = job.notes.join(' ') || 'Parts and holes cut through; traces engraved.';
  }
}

function updateScaleBar() {
  const d = state.design;
  const bar = $('#scalebar');
  if (!d || state.view !== 'top') {
    bar.hidden = true;
    return;
  }
  const pxPerMm = (stage.clientWidth * state.zoom) / (d.stats.outerDiameter * 1.06);
  const mm = [5, 10, 20, 50, 100, 200, 500].find((v) => v * pxPerMm >= 60) ?? 500;
  bar.hidden = false;
  bar.querySelector('i').style.width = `${mm * pxPerMm}px`;
  bar.querySelector('span').textContent = `${mm} mm`;
}

function positionLayers() {
  const size = stage.clientWidth || 600;
  const gap = (size * 0.32 * state.orbit.explode) / Math.max(4, layers.length);
  const center = (layers.length - 1) / 2;
  $('#mat').style.transform = `translateZ(${(-center - 1.5) * gap}px)`;
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
  updateScaleBar();
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
  updateScaleBar();
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
  state.orbit.rz = dragging.rz + (e.clientX - dragging.x) * 0.3;
  state.orbit.rx = Math.max(0, Math.min(80, dragging.rx - (e.clientY - dragging.y) * 0.3));
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
viewport.addEventListener('dblclick', (e) => {
  if (e.target.closest('.hud')) return;
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
    btn.className = `var mode-${state.mode}${v.current ? ' current' : ''}`;
    btn.title = v.current ? 'Current design' : `Apply: ${v.label}`;
    btn.innerHTML =
      designSVG(d, { palette: state.palette, mode: state.mode, material: material(), scaleStroke: 0.8 }) +
      `<span><em>${v.label}</em><small>${d.stats.parts}p</small></span>`;
    if (!v.current) btn.addEventListener('click', () => setParams(v.params));
    root.appendChild(btn);
  }
}

// ---------------------------------------------------------------- presets
const userPresets = () => load(USER_PRESETS_KEY, {});
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function buildPresets(selected = '') {
  const sel = $('#preset');
  const user = userPresets();
  sel.innerHTML =
    `<option value="">Presets…</option><optgroup label="Built-in">` +
    Object.keys(PRESETS).map((k) => `<option value="b:${k}">${k}</option>`).join('') +
    `</optgroup>` +
    (Object.keys(user).length
      ? `<optgroup label="Saved">` + Object.keys(user).map((k) => `<option value="u:${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('') + `</optgroup>`
      : '');
  sel.value = selected;
  $('#btnDeletePreset').disabled = !sel.value.startsWith('u:');
}

function applyPreset(value) {
  if (!value) return;
  const name = value.slice(2);
  const preset = value[0] === 'b' ? PRESETS[name] : userPresets()[name];
  if (!preset) return;
  if (preset.palette) state.palette = preset.palette;
  if (preset.mode) state.mode = preset.mode;
  if (preset.fab) state.fab = { ...state.fab, ...preset.fab };
  setParams({ ...DEFAULTS, minHole: state.params.minHole, minWeb: state.params.minWeb, ...preset.params });
  toast(`Preset: ${name}`);
}

// ---------------------------------------------------------------- export
function fileBase() {
  const p = state.params;
  return `orbis-s${p.seed}-r${p.rings}-${p.outerDiameter}mm`;
}

const settingsJSON = () =>
  JSON.stringify({ app: 'orbis', version: 2, palette: state.palette, mode: state.mode, params: state.params, fab: state.fab }, null, 2);

function readme() {
  const d = state.design;
  const f = state.fab;
  const pr = PROCESSES[f.process];
  const e = estimate(d, f);
  return [
    `Orbis — ${fileBase()}`,
    '',
    `Process:   ${pr.label}  (${pr.toolLabel} ${f.tool} mm${f.process === 'laser' ? `, kerf comp ${f.kerf} mm` : ''})`,
    `Material:  ${MATERIALS[f.material].label}, ${f.thickness} mm`,
    `Layout:    ${LAYOUTS[f.layout]}`,
    `Size:      Ø ${d.stats.outerDiameter} mm, ${d.stats.parts} parts, ${d.stats.cutouts} holes`,
    `Estimate:  ~${Math.round(e.minutes)} min, ~${Math.round(e.mass)} g`,
    '',
    'Layers: CUT = red (#ff0000), ENGRAVE = blue (#0000ff), LABELS = black, GUIDES = green (sheet outlines, do not cut).',
    'All files are in millimetres. STL is Z-up.',
    '',
    'Checks:',
    ...checkDesign(d, f).map((c) => `  [${c.level.toUpperCase()}] ${c.text}`),
    '',
    paramsComment(d, f),
  ].join('\n');
}

let downloadsCap = null;
const getDownloads = () => (downloadsCap ??= window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null));

async function saveFile(filename, data, type) {
  if (!EMBED) {
    download(filename, data, type);
    toast(`Saved ${filename}`);
    return;
  }
  const dl = await getDownloads();
  if (!dl) {
    toast('File saving is not available in this view');
    return;
  }
  try {
    await dl.save({ filename, data });
    toast(`Saved ${filename}`);
  } catch (err) {
    if (err?.code !== 'declined') toast(`Could not save ${filename}`);
  }
}

// Hosted embeds can only save a fixed list of types, so DXF/STL go inside a .zip there.
async function saveZipped(filename, data, type) {
  if (!EMBED) return saveFile(filename, data, type);
  return saveFile(`${filename}.zip`, zip([{ name: filename, data }]), 'application/zip');
}

async function doExport(kind) {
  const d = state.design;
  const f = state.fab;
  const base = fileBase();
  const bg = { plot: '#f3efe6', material: '#22574a', toolpath: '#2b2e31' }[state.mode] ?? '#0f1418';
  const fails = checkDesign(d, f).filter((c) => c.level === 'fail').length;
  if (fails && ['svg', 'dxf', 'stl', 'zip'].includes(kind)) toast(`${fails} check${fails > 1 ? 's' : ''} failing — exporting anyway`);
  switch (kind) {
    case 'svg':
      return saveFile(`${base}-${f.layout}.svg`, fabSVG(d, f), 'image/svg+xml');
    case 'dxf':
      return saveZipped(`${base}-${f.layout}.dxf`, toDXF(d, f), 'application/dxf');
    case 'stl':
      return saveZipped(`${base}.stl`, toSTL(d, f).buffer, 'model/stl');
    case 'zip':
      return saveFile(
        `${base}.zip`,
        zip([
          { name: `${base}-${f.layout}.svg`, data: fabSVG(d, f) },
          { name: `${base}-${f.layout}.dxf`, data: toDXF(d, f) },
          { name: `${base}.stl`, data: toSTL(d, f).buffer },
          { name: `${base}.json`, data: settingsJSON() },
          { name: 'README.txt', data: readme() },
        ]),
        'application/zip',
      );
    case 'png': {
      const svg = artSVG(d, { palette: state.palette, mode: state.mode, material: material(), background: bg, scaleStroke: 2.5 });
      return saveFile(`${base}.png`, await svgToPngBlob(svg, 2048), 'image/png');
    }
    case 'json':
      return saveFile(`${base}.json`, settingsJSON(), 'application/json');
  }
}

async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (PALETTES[data.palette]) state.palette = data.palette;
    if (MODES[data.mode]) state.mode = data.mode;
    if (data.fab && PROCESSES[data.fab.process]) state.fab = { ...defaultFab(data.fab.process), ...data.fab };
    setParams({ ...DEFAULTS, ...(data.params || data) });
    toast('Imported');
  } catch {
    toast('That file is not an Orbis JSON export');
  }
}

// ---------------------------------------------------------------- misc UI
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
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
  $('#preset').addEventListener('change', (e) => {
    applyPreset(e.target.value);
    $('#btnDeletePreset').disabled = !e.target.value.startsWith('u:');
  });
  $('#btnSavePreset').addEventListener('click', () => {
    const fallback = `Seed ${state.params.seed} · ${state.params.rings} rings`;
    const name = (EMBED ? fallback : prompt('Preset name', fallback))?.trim();
    if (!name) return;
    const user = userPresets();
    user[name] = { params: { ...state.params }, fab: { ...state.fab }, palette: state.palette, mode: state.mode };
    save(USER_PRESETS_KEY, user);
    buildPresets(`u:${name}`);
    toast(`Saved preset “${name}”`);
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
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
      e.preventDefault();
      e.shiftKey || k === 'y' ? redo() : undo();
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
if (!PROCESSES[state.fab.process]) state.fab = defaultFab('laser');
state.params.minHole = PROCESSES[state.fab.process].minHole;
state.params.minWeb = PROCESSES[state.fab.process].minWeb;
readHash();
buildControls();
buildMake();
buildPresets();
bindUI();
state.orbit = { ...VIEWS[state.view] };
fitStage();
applyOrbit();
commit();
if (EMBED) getDownloads();
