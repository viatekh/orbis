// Starting points for the stage. Unlisted settings fall back to the defaults.
export const STAGE_PRESETS = {
  'Hive Shield': {},
  Stargate: { centre: 'rosette', corePoints: 12, discDiameter: 4.4, lift: 1.4, sideDisc: 0, petals: 0, tiling: 'hex', module: 'stepped', depth: -280, steps: 3, cells: 30, crownPoints: 0, squareness: 2, crownHeight: 9, erode: 0, subdivide: 0.1 },
  'Eye of Petals': { centre: 'iris', corePoints: 12, discDiameter: 3.6, petals: 16, petalLength: 2, petalWidth: 0.9, petalLean: 14, petalAsym: 0.45, tiling: 'none', sideDisc: 1.6, sideOffset: 5.8, spikes: 6, spikeStart: 4.2 },
  'Star Portal': { centre: 'star', corePoints: 6, discDiameter: 4, sideDisc: 2.2, sideOffset: 5.6, petals: 0, tiling: 'diamond', module: 'stepped', motif: 'window', depth: -240, steps: 2, cells: 18, crownPoints: 6, crownDepth: 0.3 },
  'Geodesic Pod': { centre: 'opening', discDiameter: 3, lift: 0.6, coreGap: 0, sideDisc: 0, petals: 0, boothWidth: 0, tiling: 'shard', module: 'pyramid', motif: 'window', depth: 220, form: 'dome', formDepth: 3, cells: 20, width: 13, crownHeight: 8, crownPoints: 0, squareness: 2, erode: 0, subdivide: 0 },
  'Pyramid Portal': { centre: 'opening', discDiameter: 4.6, lift: 0.2, sideDisc: 0, petals: 0, boothWidth: 0, tiling: 'brick', module: 'pyramid', motif: 'window', depth: 380, cells: 28, stretch: 1.3, width: 12, crownHeight: 7.5, crownPoints: 0, squareness: 2, erode: 0, subdivide: 0 },
  'Dragon Scales': { centre: 'disc', tiling: 'diamond', module: 'scales', motif: 'slots', depth: 260, cells: 28, petals: 10, sideDisc: 0, form: 'barrel', formDepth: -2, crownPoints: 7, crownDepth: 0.35, erode: 0.3 },
  Sunburst: { centre: 'iris', corePoints: 10, spikes: 18, spikeStart: 2.4, spikeLength: 2.3, spikeWidth: 0.55, petals: 10, tiling: 'none', module: 'pyramid', depth: 160, motif: 'solid', sideDisc: 0 },
  'Slat Fan Arch': { centre: 'opening', discDiameter: 4.2, lift: 0.1, sideDisc: 0, petals: 0, boothWidth: 0, tiling: 'shard', module: 'flat', motif: 'rays', overlay: 0, detail: 1, form: 'cone', formDepth: -2.5, cells: 16, width: 12, crownHeight: 7, crownPoints: 0, squareness: 2, erode: 0 },
  'Solid Wall': { centre: 'none', sideDisc: 0, petals: 0, tiling: 'hex', module: 'stepped', depth: 200, cells: 20, crownPoints: 0, squareness: 4, erode: 0, form: 'ripple', formDepth: 0.8 },
};
