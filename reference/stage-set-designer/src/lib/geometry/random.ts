export type Rng = () => number

// mulberry32 — small, fast, deterministic PRNG.
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Combines several integers into one deterministic 32-bit seed. Used to
// derive each recursion cell's own RNG from (seed, level, cellIndex) so that
// changing one parameter doesn't reshuffle the entire design.
export function hash32(...values: number[]): number {
  let h = 2166136261 >>> 0
  for (const v of values) {
    const x = Math.floor(v) | 0
    h ^= x
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
