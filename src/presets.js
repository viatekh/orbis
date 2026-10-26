// Built-in starting points. Unlisted params fall back to defaults.
export const PRESETS = {
  'As Saved': { params: {} },
  'Dense Core': { params: { seed: 211, rings: 13, innerRadius: 18, fill: 0.55, minSlice: 220, hairlines: 12, bubbleSize: 0.5 } },
  'Sparse Orbit': { params: { seed: 77, rings: 4, fill: 0.35, minSlice: 120, gapWidth: 9, hairlines: 10, traceSweep: 240 } },
  'Bubble Ring': { params: { seed: 512, rings: 6, bubbleSize: 0.85, bubbleDensity: 0.95, bubbleSpacing: 16, viaDensity: 0 } },
  Gearworks: { params: { seed: 303, rings: 8, notchDepth: 0.65, notchDensity: 0.95, edge: 4, maxSplits: 2 } },
  Glyph: { params: { seed: 9, rings: 6, wallAngle: 62, notchDepth: 0.45, edge: 2.5, maxSplits: 4, gapWidth: 10 }, palette: 'neon', mode: 'neon' },
  Blueprint: { params: { seed: 128, rings: 10, fill: 0.45, hairlines: 16, tracePads: 0.9 }, palette: 'glacier' },
  'Pen Plot': { params: { seed: 640, rings: 11, fill: 0.4, hairlines: 18, viaDensity: 0.7 }, mode: 'plot' },
  'Solid Ember': { params: { seed: 451, rings: 7, fill: 0.62, bubbleSize: 0.55 }, palette: 'ember', mode: 'solid' },
};
