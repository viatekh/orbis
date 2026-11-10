// Stage workspace: controls, elevation view, make panel and exports.

import { quantize } from './generator.js';
import { PALETTES } from './render.js';
import { MATERIALS } from './fabrication.js';
import { jobSVG, jobDXF } from './export.js';
import { zip } from './zip.js';
import {
  STAGE_PARAMS, STAGE_PARAM_MAP, STAGE_GROUPS, STAGE_DEFAULTS, TILINGS, MODULES, MOTIFS, CENTRES, FORMS, PRINT_SETS, PETAL_SHAPES, PIECE_MODULES, PIECE_MOTIFS, STAGE_MATERIALS,
  normalizeStage, normalizeStageFab, generateStage, sourcePanels,
} from './stage.js';
import { stageJob, checkStage, settingOutCSV, printFiles } from './stagefab.js';
import { STAGE_PRESETS } from './stagepresets.js';
import { elevationSVG, elevationBox, skyColor, sourceSVG, STAGE_MODES } from './stagerender.js';

const $ = (sel) => document.querySelector(sel);
const KEY = 'orbis.stage';
const MODE_KEY = 'orbis.workspace';

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just don't persist */
  }
};

export function initStage({ getDisc, setDisc, saveFile, saveZipped, toast }) {
  const saved = read(KEY, {});
  const state = {
    params: normalizeStage(saved.params),
    fab: normalizeStageFab(saved.fab),
    mode: STAGE_MODES[saved.mode] ? saved.mode : 'night',
    palette: PALETTES[saved.palette] ? saved.palette : 'neon',
    stage: null,
    job: null,
    cam: { yaw: 0, pitch: 0 },
    view: null, // zoomed viewBox, or null for the whole stage
    src: 'cell',
  };
  const inputs = {};

  // ------------------------------------------------------------ workspace switch
  const setWorkspace = (ws) => {
    document.body.dataset.mode = ws;
    document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.ws === ws));
    write(MODE_KEY, ws);
    if (ws === 'stage') {
      render();
      renderVariations();
    }
    else window.dispatchEvent(new Event('resize'));
  };
  $('#modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setWorkspace(b.dataset.ws);
  });

  // ------------------------------------------------------------ controls
  const host = $('#stageControls');
  for (const group of STAGE_GROUPS) {
    const det = document.createElement('details');
    det.className = 'group';
    det.open = true;
    det.innerHTML = `<summary>${group.label}</summary>`;
    for (const def of STAGE_PARAMS.filter((d) => d.group === group.id)) {
      const row = document.createElement('div');
      row.className = 'param';
      row.innerHTML = `<label for="sp-${def.key}">${def.label}</label>
        <input class="val" type="number" min="${def.min}" max="${def.max}" step="${def.step}" aria-label="${def.label} value" />
        <span></span>
        <input id="sp-${def.key}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" />`;
      const [num, range] = row.querySelectorAll('input');
      range.addEventListener('input', () => setParam(def.key, range.value));
      num.addEventListener('change', () => setParam(def.key, num.value));
      inputs[def.key] = { num, range, def };
      det.appendChild(row);
    }
    host.appendChild(det);
  }
  const SELECTS = { tiling: TILINGS, form: FORMS };
  const CHECKS = ['mirror', 'backlit', 'truss'];
  for (const [key, set] of Object.entries(SELECTS)) {
    $(`#st-${key}`).innerHTML = Object.entries(set).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $(`#st-${key}`).addEventListener('change', (e) => setParam(key, e.target.value));
  }
  for (const key of CHECKS) $(`#st-${key}`).addEventListener('change', (e) => setParam(key, e.target.checked));
  $('#st-material').innerHTML = STAGE_MATERIALS.map((k) => `<option value="${k}">${MATERIALS[k].label}</option>`).join('');
  $('#st-palette').innerHTML = Object.entries(PALETTES).map(([k, v]) => `<option value="${k}">${v.label} LEDs</option>`).join('');
  $('#stageModeSeg').innerHTML = Object.entries(STAGE_MODES).map(([k, v]) => `<button data-smode="${k}">${v}</button>`).join('');

  const sync = () => {
    for (const { num, range, def } of Object.values(inputs)) {
      const v = state.params[def.key];
      range.value = v;
      if (document.activeElement !== num) num.value = v;
      range.style.setProperty('--pct', `${((v - def.min) / (def.max - def.min)) * 100}%`);
    }
    for (const key of Object.keys(SELECTS)) $(`#st-${key}`).value = state.params[key];
    for (const key of CHECKS) $(`#st-${key}`).checked = state.params[key];
    for (const key of ['sheetW', 'sheetH', 'thickness', 'tool', 'printBed', 'printThickness']) {
      const el = $(`#st-${key}`);
      if (document.activeElement !== el) el.value = state.fab[key];
    }
    $('#st-material').value = state.fab.material;
    $('#st-printSet').value = state.fab.printSet;
    $('#st-labels').checked = state.fab.labels;
    $('#st-led').checked = state.fab.led;
    $('#st-palette').value = state.palette;
    $('#st-palette').hidden = state.mode !== 'night';
    document.querySelectorAll('#stageModeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.smode === state.mode));
    const orbit = Boolean(state.cam.yaw || state.cam.pitch) && state.mode !== 'setout';
    document.querySelectorAll('#stageViewSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.cam === 'orbit') === orbit));
  };

  function setParam(key, value) {
    state.params = normalizeStage({ ...state.params, [key]: STAGE_PARAM_MAP[key] ? Number(value) : value });
    render();
  }
  function setFab(key, value) {
    state.fab = normalizeStageFab({ ...state.fab, [key]: value });
    render();
  }

  for (const key of ['sheetW', 'sheetH', 'thickness', 'tool', 'printBed', 'printThickness']) $(`#st-${key}`).addEventListener('change', (e) => setFab(key, e.target.value));
  $('#st-material').addEventListener('change', (e) => setFab('material', e.target.value));
  $('#st-printSet').innerHTML = Object.entries(PRINT_SETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#st-printSet').addEventListener('change', (e) => setFab('printSet', e.target.value));
  $('#st-preset').innerHTML = '<option value="">Presets…</option>' + Object.keys(STAGE_PRESETS).map((k) => `<option>${k}</option>`).join('');
  $('#st-preset').addEventListener('change', (e) => {
    const preset = STAGE_PRESETS[e.target.value];
    e.target.value = '';
    if (!preset) return;
    state.params = normalizeStage({ ...STAGE_DEFAULTS, ...preset, seed: state.params.seed });
    render();
    renderVariations();
  });
  $('#st-labels').addEventListener('change', (e) => setFab('labels', e.target.checked));
  $('#st-led').addEventListener('change', (e) => setFab('led', e.target.checked));
  $('#st-palette').addEventListener('change', (e) => {
    state.palette = e.target.value;
    render();
  });
  $('#stageModeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.mode = b.dataset.smode;
    render();
  });
  $('#btnStageRandom').addEventListener('click', () => {
    const next = { ...state.params };
    for (const def of STAGE_PARAMS) if (def.rand) next[def.key] = quantize(def, def.rand[0] + Math.random() * (def.rand[1] - def.rand[0]));
    const tilings = Object.keys(TILINGS).filter((k) => k !== 'none');
    next.tiling = tilings[Math.floor(Math.random() * tilings.length)];
    const pick = (set) => Object.keys(set)[Math.floor(Math.random() * Object.keys(set).length)];
    next.module = pick(MODULES);
    next.centre = pick(CENTRES);
    next.form = Math.random() < 0.5 ? 'flat' : pick(FORMS);
    state.params = normalizeStage(next);
    render();
  });
  $('#btnStageSeed').addEventListener('click', () => setParam('seed', Math.floor(Math.random() * 1000)));
  $('#btnStageReset').addEventListener('click', () => {
    state.params = normalizeStage(STAGE_DEFAULTS);
    render();
  });
  $('#btnEditDisc').addEventListener('click', () => setWorkspace('disc'));

  // ------------------------------------------------------------ render
  const fileBase = () => `orbis-stage-s${state.params.seed}-${state.params.width}m-${state.params.tiling}`;
  const look = () => ({ palette: state.palette, material: MATERIALS[state.fab.material] });
  const elevation = (mode = state.mode, cam = state.cam, draft = false, view = null) => elevationSVG(state.stage, { mode, ...look(), ...cam, draft, view });
  const FRONT = { yaw: 0, pitch: 0 };
  let makeTimer;

  function render() {
    if (document.body.dataset.mode !== 'stage') return;
    sync();
    write(KEY, { params: state.params, fab: state.fab, mode: state.mode, palette: state.palette });
    state.stage = generateStage(state.params, getDisc(), state.fab);
    state.job = null;
    $('#elevation').innerHTML = elevation(state.mode, state.cam, false, state.view);
    renderSource();
    const box = elevationBox(state.stage);
    const frame = $('#elevation').parentElement;
    frame.style.aspectRatio = `${Math.round(box.w)} / ${Math.round(box.h)}`;
    frame.style.background = skyColor(state.mode);
    $('#stageName').textContent = `${fileBase()}.svg`;
    // nesting is the slow part: let slider drags settle first
    clearTimeout(makeTimer);
    $('#stageMake').classList.add('stale');
    makeTimer = setTimeout(renderMake, 350);
  }

  function ensureJob() {
    return (state.job ??= stageJob(state.stage));
  }

  function renderMake() {
    const stage = state.stage;
    const job = ensureJob();
    const s = stage.stats;
    const label = { ok: 'ok', warn: 'warn', fail: 'fail', info: 'note' };
    $('#stageChecks').innerHTML = checkStage(stage, job)
      .map((c) => `<li class="${c.level}"><span class="tag">${label[c.level]}</span><span>${c.text}</span></li>`)
      .join('');
    const hours = job.stats.minutes / 60;
    const rows = [
      ['Sheets', `${job.sheets} × ${stage.fab.sheetW}×${stage.fab.sheetH}`],
      ['CNC panels', s.parts - s.printed],
      ['CNC time', `≈ ${hours < 1 ? `${Math.round(job.stats.minutes)} min` : `${hours.toFixed(1)} h`}`],
      ['Weight', `≈ ${Math.round(s.massKg)} kg`],
      ['LED run', stage.fab.led ? `≈ ${Math.round(s.ledM)} m` : '—'],
      ['Deck', `${s.deckModules} × 2×1 m`],
      ['Facade', `${s.areaM2.toFixed(1)} m²`],
      ['Relief', `${Math.round(s.reliefMm)} mm`],
      ...(s.printed ? [['3D printed', `${s.printed} parts`], ['Filament', `≈ ${s.printKg.toFixed(1)} kg · ${Math.round(s.printHours)} h`]] : []),
    ];
    $('#stageEstimate').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#stagePreview').innerHTML = jobSVG(job, '', { preview: true });
    $('#stageMake').classList.remove('stale');
  }

  // ------------------------------------------------------------ source pieces
  // Each piece has its own options; the galleries show what every option does to that piece.
  const PIECES = {
    cell: { note: 'The lattice cell. Every panel in the lattice is spawned from it.', galleries: [['module', 'Module', MODULES], ['motif', 'Fretwork', MOTIFS]] },
    petal: { note: 'One petal; the ring repeats it. Length, width, lean and layers are under Petal Ring.', galleries: [['petalShape', 'Shape', PETAL_SHAPES], ['petalMotif', 'Fretwork', PIECE_MOTIFS]] },
    spike: { note: 'One spike. Set how many under Spikes.', galleries: [['spikeModule', 'Module', PIECE_MODULES], ['spikeMotif', 'Fretwork', PIECE_MOTIFS]] },
    core: { note: 'The centre piece; side medallions copy it.', galleries: [['centre', 'Core', CENTRES], ['coreModule', 'Module', PIECE_MODULES], ['coreMotif', 'Fretwork', PIECE_MOTIFS]] },
  };
  const srcLook = () => ({ mode: state.mode, ...look(), backlit: state.params.backlit });
  let galleryTimer;
  function renderSource() {
    const piece = PIECES[state.src];
    document.querySelectorAll('#srcTabs button').forEach((b) => b.classList.toggle('on', b.dataset.src === state.src));
    const parts = sourcePanels(state.params, state.fab, state.src)[state.src];
    const off = (state.src === 'petal' && !state.params.petals) || (state.src === 'spike' && !state.params.spikes);
    $('#sourceView').innerHTML = sourceSVG(parts, srcLook());
    $('#srcNote').textContent = off ? `${piece.note} None are on the stage yet.` : parts.length ? piece.note : 'No core: the stage has a void or nothing at its centre.';
    clearTimeout(galleryTimer);
    galleryTimer = setTimeout(renderGalleries, 250);
  }
  function renderGalleries() {
    const host = $('#srcGalleries');
    host.innerHTML = '';
    for (const [key, title, options] of PIECES[state.src].galleries) {
      const head = document.createElement('div');
      head.className = 'gallery-head';
      head.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'gallery';
      for (const [value, label] of Object.entries(options)) {
        const b = document.createElement('button');
        b.title = label;
        b.classList.toggle('on', state.params[key] === value);
        const parts = sourcePanels({ ...state.params, [key]: value }, state.fab, state.src)[state.src];
        if (parts.length) b.innerHTML = `${sourceSVG(parts, { ...srcLook(), simple: true })}<span>${label}</span>`;
        else {
          b.className += ' text';
          b.innerHTML = `<span>${label}</span>`;
        }
        b.addEventListener('click', () => setParam(key, value));
        grid.appendChild(b);
      }
      host.append(head, grid);
    }
  }
  $('#srcTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.src = b.dataset.src;
    renderSource();
  });

  // ------------------------------------------------------------ zoom and pan
  // Zooming only moves the SVG's viewBox, so it costs nothing to redraw.
  const applyView = () => {
    const svg = $('#elevation svg');
    const v = state.view || elevationBox(state.stage);
    if (svg) svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  };
  function zoomBy(factor, clientX = null, clientY = null) {
    if (!state.stage) return;
    const full = elevationBox(state.stage);
    const v = state.view || full;
    const rect = $('#elevation').getBoundingClientRect();
    const fx = clientX === null ? 0.5 : (clientX - rect.left) / rect.width;
    const fy = clientY === null ? 0.5 : (clientY - rect.top) / rect.height;
    const w = Math.min(full.w, Math.max(full.w / 16, v.w / factor));
    const h = (w * full.h) / full.w;
    const x = Math.min(full.x + full.w - w, Math.max(full.x, v.x + fx * (v.w - w)));
    const y = Math.min(full.y + full.h - h, Math.max(full.y, v.y + fy * (v.h - h)));
    state.view = w >= full.w * 0.999 ? null : { x, y, w, h };
    applyView();
  }
  function panBy(dx, dy) {
    if (!state.view) return;
    const full = elevationBox(state.stage);
    const rect = $('#elevation').getBoundingClientRect();
    const v = state.view;
    v.x = Math.min(full.x + full.w - v.w, Math.max(full.x, v.x - (dx / rect.width) * v.w));
    v.y = Math.min(full.y + full.h - v.h, Math.max(full.y, v.y - (dy / rect.height) * v.h));
    applyView();
  }
  $('#elevation').parentElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY);
  }, { passive: false });
  $('#stageZoomSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.zoom === 'fit') {
      state.view = null;
      applyView();
    } else zoomBy(b.dataset.zoom === 'in' ? 1.5 : 1 / 1.5);
  });

  // ------------------------------------------------------------ variations
  const pickKey = (set, skip = []) => {
    const keys = Object.keys(set).filter((k) => !skip.includes(k));
    return keys[Math.floor(Math.random() * keys.length)];
  };
  const MUTATORS = [
    (p) => [{ seed: Math.floor(Math.random() * 1000) }, 'New seed'],
    (p) => { const v = pickKey(TILINGS, ['none', p.tiling]); return [{ tiling: v }, TILINGS[v]]; },
    (p) => { const v = pickKey(MODULES, [p.module]); return [{ module: v }, MODULES[v]]; },
    (p) => { const v = pickKey(CENTRES, [p.centre]); return [{ centre: v }, `Core: ${CENTRES[v]}`]; },
    (p) => { const v = pickKey(FORMS, ['flat', p.form]); const d = Math.random() < 0.5 ? -2 : 2; return [{ form: v, formDepth: d }, `${FORMS[v]} ${d > 0 ? 'out' : 'in'}`]; },
    (p) => { const v = pickKey(MOTIFS, [p.motif]); return [{ motif: v }, MOTIFS[v]]; },
    (p) => [{ depth: -p.depth || -250 }, p.depth > 0 ? 'Recessed' : 'Raised'],
    (p) => [{ petals: p.petals ? 0 : 14, spikes: p.spikes ? 0 : 12 }, 'Swap petals / spikes'],
    (p) => [{ cells: 14 + 2 * Math.floor(Math.random() * 12), crownPoints: Math.floor(Math.random() * 8) }, 'Lattice scale'],
  ];
  let varRun = 0;
  function renderVariations() {
    const run = ++varRun;
    const host = $('#stageVariations');
    host.innerHTML = '';
    const picks = MUTATORS.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    // one thumbnail per tick so the page stays responsive
    const next = (i) => {
      if (run !== varRun || i >= picks.length || document.body.dataset.mode !== 'stage') return;
      const [delta, label] = picks[i](state.params);
      const params = normalizeStage({ ...state.params, ...delta });
      const b = document.createElement('button');
      b.className = 'var';
      b.innerHTML = `${elevationSVG(generateStage(params, getDisc(), state.fab), { mode: state.mode === 'setout' ? 'night' : state.mode, ...look(), draft: true })}<span><em>${label}</em></span>`;
      b.addEventListener('click', () => {
        state.params = params;
        render();
        renderVariations();
      });
      host.appendChild(b);
      setTimeout(() => next(i + 1), 30);
    };
    setTimeout(() => next(0), 400);
  }
  $('#btnStageShuffle').addEventListener('click', renderVariations);

  // ------------------------------------------------------------ orbit
  const frame = $('#elevation').parentElement;
  let drag = null;
  let pending = false;
  const redraw = (draft) => {
    if (state.stage) $('#elevation').innerHTML = elevation(state.mode, state.cam, draft, state.view);
  };
  const touches = new Map();
  let pinch = 0;
  frame.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hud')) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      drag = null;
      return;
    }
    const pan = e.shiftKey || e.button === 1 || state.mode === 'setout';
    drag = { x: e.clientX, y: e.clientY, ...state.cam, moved: false, pan };
  });
  window.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2 && pinch) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomBy(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch = d;
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    frame.classList.add('dragging');
    if (drag.pan) {
      panBy(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    state.cam = { yaw: Math.max(-80, Math.min(80, drag.yaw + dx * 0.3)), pitch: Math.max(-10, Math.min(65, drag.pitch + dy * 0.25)) };
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (drag) redraw(true); // outlines only while moving
    });
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = 0;
    if (!drag) return;
    const { moved, pan } = drag;
    drag = null;
    frame.classList.remove('dragging');
    if (moved && !pan) {
      redraw(false);
      sync();
    }
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  $('#stageViewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.cam = b.dataset.cam === 'orbit' ? { yaw: -32, pitch: 16 } : { ...FRONT };
    if (b.dataset.cam === 'orbit' && state.mode === 'setout') state.mode = 'night';
    redraw(false);
    sync();
  });

  // ------------------------------------------------------------ exports
  const meta = () =>
    `Orbis stage ${Object.entries(state.params).map(([k, v]) => `${k}=${v}`).join(' ')} | sheet=${state.fab.sheetW}x${state.fab.sheetH} t=${state.fab.thickness}mm bit=${state.fab.tool}mm`;
  const settings = () => JSON.stringify({ app: 'orbis-stage', version: 1, stage: state.params, fab: state.fab, disc: getDisc(), palette: state.palette }, null, 2);

  function readme() {
    const s = state.stage.stats;
    const f = state.fab;
    return [
      `ORBIS STAGE — ${fileBase()}`,
      '',
      `Overall ${s.widthM.toFixed(1)} m wide × ${s.heightM.toFixed(1)} m high. ${s.parts} panels, ${ensureJob().sheets} sheets of ${f.sheetW}×${f.sheetH} × ${f.thickness} mm ${MATERIALS[f.material].label}.`,
      '',
      'FILES',
      '  cut-sheets.svg / .dxf   Nested panels at 1:1 in mm. Layers in cutting order:',
      '                          LABELS (engrave panel numbers), CUT-INNER (cutouts first), CUT-OUTLINE (last).',
      '  setting-out.svg         Numbered front elevation on a 1 m grid.',
      '  setting-out.csv         Each panel: offset from the centreline, height above ground and stand-off from the back plane (mm).',
      '  elevation-night.svg / elevation-day.svg   Visuals.',
      '  stage.json              Settings, to reload the design.',
      '',
      '  print/                  One STL per 3D-printed part, flat on the bed (only if printing is switched on).',
      '',
      'BUILD',
      '  1. Cut the sheets. Panel numbers are engraved on each part and match the setting-out drawing.',
      '  2. Fix panels to the support structure using the setting-out positions, working outward from the centreline.',
      f.led ? `  3. LED: roughly ${Math.round(s.ledM)} m to outline every panel edge and trace.` : '',
      '',
      'SAFETY',
      `  ${s.areaM2.toFixed(1)} m² of facade is a wind sail. Structure, fixings, ballast and wind limits must be designed`,
      '  and signed off by a qualified structural engineer. The truss shown is indicative only.',
      '',
    ].join('\n');
  }

  async function doExport(kind) {
    const base = fileBase();
    const job = ensureJob();
    switch (kind) {
      case 'sheets':
        return saveFile(`${base}-cut-sheets.svg`, jobSVG(job, meta()), 'image/svg+xml');
      case 'dxf':
        return saveZipped(`${base}-cut-sheets.dxf`, jobDXF(job), 'application/dxf');
      case 'elevation':
        return saveFile(`${base}-${state.mode}.svg`, elevation(state.mode, state.cam, false, state.view), 'image/svg+xml');
      case 'stl': {
        const files = printFiles(state.stage);
        if (!files.length) return toast('Nothing is set to print: choose what to print under 3D print');
        return saveFile(`${base}-print.zip`, zip(files), 'application/zip');
      }
      case 'json':
        return saveFile(`${base}.json`, settings(), 'application/json');
      case 'kit':
        return saveFile(
          `${base}-kit.zip`,
          zip([
            { name: `${base}/cut-sheets.svg`, data: jobSVG(job, meta()) },
            { name: `${base}/cut-sheets.dxf`, data: jobDXF(job) },
            { name: `${base}/setting-out.svg`, data: elevation('setout', FRONT) },
            { name: `${base}/setting-out.csv`, data: settingOutCSV(state.stage) },
            { name: `${base}/elevation-night.svg`, data: elevation('night', FRONT) },
            { name: `${base}/view-3d.svg`, data: elevation('night', { yaw: -32, pitch: 16 }) },
            { name: `${base}/elevation-day.svg`, data: elevation('day', FRONT) },
            { name: `${base}/stage.json`, data: settings() },
            ...printFiles(state.stage).map((f) => ({ name: `${base}/print/${f.name}`, data: f.data })),
            { name: `${base}/README.txt`, data: readme() },
          ]),
          'application/zip',
        );
    }
  }
  $('#stageExports').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sexport]');
    if (b) doExport(b.dataset.sexport).catch(() => toast('Export failed'));
  });
  $('#stageImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'orbis-stage') throw new Error('not a stage file');
      state.params = normalizeStage(data.stage);
      state.fab = normalizeStageFab(data.fab);
      if (PALETTES[data.palette]) state.palette = data.palette;
      if (data.disc && typeof data.disc === 'object') setDisc(data.disc);
      render();
      toast('Stage loaded');
    } catch {
      toast('That is not an Orbis stage file');
    }
  });

  setWorkspace(read(MODE_KEY, 'stage') === 'disc' ? 'disc' : 'stage');
}
