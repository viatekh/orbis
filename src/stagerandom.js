// Curated randomising. Rolling every slider independently mostly gives mush, so each
// roll first picks a family of stage (a recipe) and then varies it within limits that
// are known to hold together.

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const int = (lo, hi) => Math.floor(rnd(lo, hi + 1));
const even = (lo, hi) => 2 * int(lo / 2, hi / 2);
const pick = (...a) => a[Math.floor(Math.random() * a.length)];
const CORES = ['disc', 'iris', 'star', 'rosette', 'mandala'];
const CUTS = ['mixed', 'slots', 'fan', 'honeycomb', 'bloom', 'voronoi', 'arcs', 'crackle', 'sunflower', 'rays'];
const CLEAR = { petals: 0, spikes: 0, tendrils: 0, sideDisc: 0, erode: 0, subdivide: 0, overlay: 0, coreGap: 0, boothWidth: 0 };

// One symmetry number runs through a whole design: core points, petals, spikes and crown
// all count in it, and every piece shares one fretwork. That is what makes it read as one thing.
const core = (n) => ({ centre: pick(...CORES), corePoints: n, discDiameter: rnd(2.8, 4.2), lift: rnd(1.3, 2), coreMotif: 'inherit', coreModule: 'inherit' });
const medallions = () => (Math.random() < 0.4 ? { sideDisc: rnd(1.6, 2.4), sideOffset: rnd(5.4, 6.6) } : {});
const petals = (n) => ({
  petals: n <= 8 ? 2 * n : n, petalShape: pick('leaf', 'eye', 'teardrop', 'diamond', 'blade'), petalLength: rnd(1.4, 2.1), petalWidth: rnd(0.55, 0.95),
  petalLean: pick(0, 0, rnd(12, 30)), petalAsym: rnd(0, 0.45), petalLayers: 3, petalMotif: 'inherit', petalCurl: pick(0, 0, 1, -1) * rnd(0.3, 0.7),
});
const crown = (n) => pick({ crownPoints: 0, squareness: rnd(2, 3.2) }, { crownPoints: n > 8 ? n / 2 : n > 6 ? n - 1 : 5, crownDepth: rnd(0.15, 0.35), squareness: rnd(1.9, 2.6) }, { crownPoints: 0, squareness: rnd(1.3, 1.6) });
// depth: the lattice is a deep funnel or dome, and steps again from band to band
const deep = () => ({ form: pick('funnel', 'funnel', 'cone', 'dome'), formDepth: pick(-1, -1, 1) * rnd(2.5, 5.5), zones: int(3, 5), bandStep: pick(-1, 1) * rnd(180, 420) });
const organic = () => ({ tendrilLength: rnd(5.5, 7.5), tendrilCurl: pick(-1, 1, 1) * rnd(0.15, 0.6), tendrilWidth: rnd(0.8, 1.05), tendrilLeaves: rnd(0.6, 1), ribbonMotif: pick('vein', 'vein', 'lanes', 'eyes', 'ribs'), overlay: pick(0, 0.6) });
const relief = () => ({ depth: rnd(220, 420), steps: int(2, 3) });

const RECIPES = {
  'Hex wall': (n) => ({
    layout: 'grid', tiling: 'hex', module: pick('stepped', 'mix', 'pyramid'), motif: pick(...CUTS), ...relief(), ...deep(),
    cells: even(18, 26), crownHeight: rnd(7.4, 9.2), ...crown(n), ...core(n), ...medallions(), ...(Math.random() < 0.6 ? petals(n) : {}),
  }),
  'Crystal field': (n) => ({
    layout: 'grid', tiling: 'shard', module: 'pyramid', motif: pick('solid', 'fan', 'rays'), ...relief(), ...deep(), cells: even(16, 22),
    crownHeight: rnd(7.4, 9), ...crown(n), ...core(n), ...petals(n), petalShape: pick('diamond', 'blade'),
  }),
  'Diamond temple': (n) => ({
    layout: 'grid', tiling: 'diamond', module: pick('stepped', 'pyramid'), motif: pick('slots', 'bloom', 'fan', 'rays', 'arcs'), ...relief(), ...deep(),
    cells: even(18, 24), crownHeight: rnd(7.6, 9.4), ...crown(n), ...core(n), ...petals(n), petalShape: pick('diamond', 'leaf', 'eye'), ...medallions(),
  }),
  'Sun gate': () => {
    const d = rnd(3.8, 5);
    const ring = rnd(1.8, 2.8);
    const lift = rnd(0, 0.4);
    return {
      centre: 'opening', discDiameter: d, lift, crownHeight: d + ring + lift, width: Math.round((d + 2 * ring) * 2) / 2, squareness: 2, crownPoints: 0,
      tiling: pick('shard', 'diamond'), module: 'pyramid', motif: pick('solid', 'solid', 'fan'), depth: rnd(180, 280), cells: even(32, 44), truss: false,
      form: pick('funnel', 'cone'), formDepth: -rnd(1.5, 3.5), zones: int(1, 3), bandStep: rnd(100, 300),
    };
  },
  'Vortex shield': (n) => ({
    tiling: pick('hex', 'diamond', 'brick'), module: pick('stepped', 'scales', 'pyramid'), motif: pick(...CUTS), ...relief(),
    form: 'funnel', formDepth: -rnd(4, 7), zones: int(3, 5), bandStep: rnd(150, 400),
    cells: 3 * n >= 30 ? 3 * n : 4 * n, stretch: rnd(0.8, 1), crownHeight: rnd(7.6, 9), crownPoints: pick(0, 0, 5), crownDepth: rnd(0.1, 0.2), squareness: rnd(2.2, 3),
    width: rnd(15, 18), ...core(n), ...petals(n),
  }),
  'Petal eye': (n) => {
    const c = core(n);
    const pt = petals(n);
    return {
      tiling: 'none', ...c, ...pt, petalLength: rnd(1.8, 2.3), petalWidth: rnd(0.8, 1.1), ...relief(),
      // spikes repeat the petal: same count, same proportions, sitting in the gaps
      spikes: pt.petals, spikeCurl: pt.petalCurl ? pt.petalCurl : 0, ribbonMotif: pick('vein', 'lanes', 'eyes'), spikeStart: c.discDiameter / 2 + 1.1, spikeLength: rnd(1.6, 2.3), spikeWidth: rnd(0.45, 0.7), spikeMotif: 'inherit', spikeModule: 'inherit',
      module: pick('stepped', 'pyramid'), motif: pick('slots', 'fan', 'rays'), sideDisc: pick(0, rnd(1.8, 2.6)), sideOffset: rnd(5, 6), width: rnd(14, 18),
    };
  },
  'Feather fan': (n) => ({
    tiling: 'none', ...core(n), discDiameter: rnd(2, 3), ...petals(n), ...organic(), tendrils: int(3, 6), tendrilStyle: pick('feather', 'feather', 'flame', 'vine'),
    tendrilFrom: rnd(5, 25), tendrilSweep: rnd(80, 110), width: rnd(14, 18), module: 'flat', motif: pick('slots', 'louvre', 'rays'),
  }),
  'Flame crown': (n) => ({
    tiling: pick('hex', 'diamond'), module: pick('stepped', 'pyramid'), motif: pick(...CUTS), ...relief(), form: 'funnel', formDepth: -rnd(3, 5), zones: 2, bandStep: rnd(150, 300),
    cells: 3 * n >= 30 ? 3 * n : 4 * n, crownHeight: rnd(6.6, 7.6), crownPoints: 0, squareness: rnd(2, 2.6), width: rnd(12, 14.5), ...core(n), ...petals(n), ...organic(),
    tendrils: int(3, 5), tendrilStyle: pick('flame', 'horn', 'flame'), tendrilFrom: rnd(20, 45), tendrilSweep: rnd(60, 95), layerOrder: ['spike', 'facade', 'tendril', 'petal', 'core'],
  }),
  'Portal arch': (n) => ({
    centre: 'opening', discDiameter: rnd(4, 5), lift: rnd(0, 0.4), tiling: pick('brick', 'diamond', 'hex'), module: pick('stepped', 'pyramid'),
    motif: pick('waves', 'slots', 'rays', 'scales', 'fan'), ...relief(), cells: 4 * n >= 24 ? 4 * n : 6 * n, stretch: rnd(0.9, 1.1), width: rnd(13, 16),
    crownHeight: rnd(7.4, 8.6), squareness: 2, crownPoints: pick(0, 0, 5, 7), crownDepth: rnd(0.1, 0.25), form: pick('funnel', 'cone', 'barrel'), formDepth: -rnd(3, 6), zones: int(2, 4), bandStep: rnd(150, 400),
  }),
};

export const RECIPE_NAMES = Object.keys(RECIPES);

// Returns a full set of stage settings, plus `recipe` (its family) and a `palette` to show it in.
export function randomStage(defaults, only = null) {
  const recipe = only && RECIPES[only] ? only : pick(...RECIPE_NAMES);
  return {
    ...defaults, ...CLEAR,
    seed: int(0, 999), chaos: rnd(0, 0.15), form: 'flat', detail: rnd(0.45, 1), rim: rnd(50, 90), etch: int(0, 2), layerGap: rnd(80, 220),
    ...RECIPES[recipe](pick(6, 8, 8, 10, 12)),
    recipe, palette: pick('neon', 'ember', 'glacier', 'phosphor', 'circuit'),
  };
}
