// Curated randomising. Rolling every slider independently mostly gives mush, so each
// roll first picks a family of stage (a recipe) and then varies it within limits that
// are known to hold together.

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const int = (lo, hi) => Math.floor(rnd(lo, hi + 1));
const even = (lo, hi) => 2 * int(lo / 2, hi / 2);
const pick = (...a) => a[Math.floor(Math.random() * a.length)];
const CORES = ['disc', 'iris', 'star', 'rosette', 'mandala'];
const CUTS = ['window', 'mixed', 'slots', 'fan', 'honeycomb', 'bloom', 'voronoi', 'arcs', 'crackle', 'sunflower'];
const CLEAR = { petals: 0, spikes: 0, tendrils: 0, sideDisc: 0, erode: 0, subdivide: 0, overlay: 0, form: 'flat', coreGap: 0 };

const core = () => ({ centre: pick(...CORES), corePoints: pick(6, 8, 8, 10, 12), discDiameter: rnd(2.8, 4.2), lift: rnd(1.3, 2) });
const medallions = () => (Math.random() < 0.45 ? { sideDisc: rnd(1.6, 2.6), sideOffset: rnd(5.2, 6.6) } : {});
const petals = () => ({
  petals: pick(10, 12, 14, 16, 18), petalShape: pick('leaf', 'eye', 'teardrop', 'diamond', 'blade'), petalLength: rnd(1.3, 2.1), petalWidth: rnd(0.5, 1),
  petalLean: pick(0, 0, rnd(10, 35)), petalAsym: rnd(0, 0.5), petalLayers: pick(2, 3),
});
const crown = () => pick({ crownPoints: 0, squareness: rnd(1.8, 3.6) }, { crownPoints: pick(3, 5, 7), crownDepth: rnd(0.15, 0.4), squareness: rnd(1.8, 2.8) }, { crownPoints: 0, squareness: rnd(1.25, 1.6) });

const RECIPES = {
  'Hex wall': () => ({
    layout: 'grid', tiling: 'hex', module: pick('stepped', 'stepped', 'mix', 'flat'), motif: pick(...CUTS), depth: pick(-1, 1) * rnd(160, 320), steps: int(1, 3),
    cells: even(18, 26), crownHeight: rnd(7.4, 9.2), ...crown(), ...core(), ...medallions(), ...(Math.random() < 0.6 ? petals() : {}),
  }),
  'Crystal field': () => ({
    layout: 'grid', tiling: 'shard', module: 'pyramid', motif: pick('solid', 'solid', 'fan', 'window'), depth: rnd(140, 260), cells: even(16, 22),
    crownHeight: rnd(7.4, 9), ...crown(), ...core(), ...(Math.random() < 0.5 ? { spikes: pick(8, 10, 12), spikeStart: rnd(2.2, 2.8), spikeLength: rnd(1.4, 2) } : petals()),
  }),
  'Diamond temple': () => ({
    layout: 'grid', tiling: 'diamond', module: pick('stepped', 'pyramid', 'flat'), motif: pick('window', 'slots', 'bloom', 'diamonds', 'fan'), depth: rnd(160, 300), steps: int(1, 2),
    cells: even(18, 24), crownHeight: rnd(7.6, 9.4), ...crown(), ...core(), ...petals(), ...medallions(),
  }),
  'Sun gate': () => {
    const d = rnd(3.8, 5);
    const ring = rnd(1.8, 2.8);
    const lift = rnd(0, 0.4);
    return {
      centre: 'opening', discDiameter: d, lift, crownHeight: d + ring + lift, width: Math.round((d + 2 * ring) * 2) / 2, squareness: 2, crownPoints: 0,
      tiling: pick('shard', 'diamond'), module: 'pyramid', motif: pick('solid', 'solid', 'fan'), depth: rnd(160, 260), cells: even(32, 44), boothWidth: 0, truss: false,
    };
  },
  'Mandala shield': () => ({
    tiling: pick('hex', 'hex', 'diamond'), module: pick('stepped', 'stepped', 'flat', 'scales'), motif: pick(...CUTS), depth: rnd(160, 320), steps: int(1, 3),
    cells: even(26, 34), stretch: rnd(0.8, 1), subdivide: rnd(0, 0.12), crownHeight: rnd(7.6, 9), crownPoints: pick(0, 0, 5), crownDepth: rnd(0.1, 0.2), squareness: rnd(2.2, 3),
    ...core(), ...petals(),
  }),
  'Petal eye': () => {
    const c = core();
    const len = rnd(1.8, 2.3);
    return {
      tiling: 'none', ...c, ...petals(), petalLength: len, petalWidth: rnd(0.8, 1.1), sideDisc: rnd(1.8, 2.8), sideOffset: rnd(5, 6),
      ...(Math.random() < 0.6 ? { spikes: pick(8, 10, 12, 14), spikeStart: c.discDiameter / 2 + len * 0.75, spikeLength: rnd(1.4, 2.2), spikeWidth: rnd(0.4, 0.7) } : {}), width: rnd(14, 18),
    };
  },
  'Feather fan': () => ({
    tiling: 'none', ...core(), discDiameter: rnd(2, 3), ...petals(), tendrils: int(3, 5), tendrilStyle: pick('feather', 'feather', 'vine'), tendrilLength: rnd(5, 7),
    tendrilCurl: rnd(0.1, 0.4), tendrilWidth: rnd(0.7, 1), tendrilLeaves: rnd(0.6, 1), width: rnd(14, 18),
  }),
  'Portal arch': () => ({
    centre: 'opening', discDiameter: rnd(4, 5), lift: rnd(0, 0.4), boothWidth: 0, tiling: pick('brick', 'diamond', 'hex'), module: pick('stepped', 'pyramid'),
    motif: pick('window', 'waves', 'slots', 'rays', 'scales'), depth: rnd(180, 320), steps: int(1, 2), cells: even(22, 30), stretch: rnd(0.9, 1.2), width: rnd(13, 16),
    crownHeight: rnd(7.4, 8.6), squareness: 2, crownPoints: pick(0, 0, 5, 7), crownDepth: rnd(0.1, 0.25), form: pick('flat', 'barrel', 'cone'), formDepth: rnd(1, 2.5),
  }),
};

export const RECIPE_NAMES = Object.keys(RECIPES);

// Returns a full set of stage settings, plus `recipe` (its family) and a `palette` to show it in.
export function randomStage(defaults, only = null) {
  const recipe = only && RECIPES[only] ? only : pick(...RECIPE_NAMES);
  return {
    ...defaults, ...CLEAR,
    seed: int(0, 999), chaos: rnd(0, 0.4), detail: rnd(0.45, 1), rim: rnd(50, 90), etch: int(0, 2), layerGap: rnd(80, 220),
    ...RECIPES[recipe](),
    recipe, palette: pick('neon', 'ember', 'glacier', 'phosphor', 'circuit'),
  };
}
