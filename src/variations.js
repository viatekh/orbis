// Variation explorer: each mutator tweaks one or two parameters and names the change.

import { PARAM_MAP, quantize } from './generator.js';

const q = (key, v) => quantize(PARAM_MAP[key], v);
const ri = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));
const rf = (lo, hi) => lo + Math.random() * (hi - lo);

const MUTATORS = [
  () => { const rings = ri(3, 14); const seed = ri(0, 999); return [{ rings, seed }, `${rings} RINGS · SEED ${seed}`]; },
  () => { const rings = ri(8, 14); const b = q('bubbleSize', rf(0.4, 0.8)); return [{ rings, bubbleSize: b }, `${rings} RINGS · BUBBLE ${b}`]; },
  () => { const m = q('minSlice', rf(200, 330)); return [{ minSlice: m }, `SLICES ${m}–360°`]; },
  () => { const s = q('startSpread', rf(0, 120)); return [{ startSpread: s }, `SPREAD ${s}°`]; },
  () => { const b = q('bubbleSize', rf(0.7, 0.95)); return [{ bubbleSize: b, bubbleDensity: 0.9 }, `BUBBLE SIZE ${b}`]; },
  () => { const n = q('notchDepth', rf(0.5, 0.8)); const e = q('edge', rf(2, 6)); return [{ notchDepth: n, edge: e, notchDensity: 0.8 }, `NOTCH ${n} · EDGE ${e}`]; },
  () => [{ chaos: 0 }, 'RANDOM 0'],
  () => [{ chaos: 1 }, 'RANDOM 1'],
  () => { const s = q('bubbleSpacing', rf(6, 15)); return [{ bubbleSpacing: s }, `BUBBLE SPACING ${s}`]; },
  () => { const rings = ri(10, 16); const r = q('innerRadius', rf(10, 30)); return [{ rings, innerRadius: r }, `${rings} RINGS · RADIUS ${r}`]; },
  () => { const rings = ri(4, 8); const w = q('wallAngle', rf(45, 80)); return [{ rings, wallAngle: w }, `${rings} RINGS · WALL ${w}°`]; },
  () => { const gw = q('gapWidth', rf(8, 20)); const s = ri(4, 6); return [{ gapWidth: gw, maxSplits: s }, `GAP ${gw} · SPLITS ${s}`]; },
  () => { const h = ri(14, 24); return [{ hairlines: h, tracePads: 0.9 }, `${h} TRACES`]; },
  () => { const f = q('fill', rf(0.7, 0.9)); return [{ fill: f }, `FILL ${f}`]; },
  () => { const f = q('fill', rf(0.2, 0.35)); return [{ fill: f, hairlines: 16 }, `THIN BANDS ${f}`]; },
  () => { const v = q('viaDensity', rf(0.8, 1)); return [{ viaDensity: v, bubbleDensity: 0.2 }, `VIAS ${v}`]; },
  () => { const seed = ri(0, 999); return [{ seed }, `SEED ${seed}`]; },
];

export function makeVariations(params, count = 12) {
  const out = [{ params: { ...params }, label: `CURRENT · ${params.rings} RINGS`, current: true }];
  const pool = MUTATORS.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; out.length < count; i++) {
    const [delta, label] = pool[i % pool.length]();
    out.push({ params: { ...params, ...delta }, label });
  }
  return out;
}
