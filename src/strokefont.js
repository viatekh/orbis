// Single-stroke digits for engraved part numbers. Real font text is not machinable
// (CAM ignores it, lasers need the font installed), so labels are drawn as polylines.
// Glyphs sit on a 4 x 6 grid, y down.

const BOX = [[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]];
const GLYPHS = {
  0: [BOX],
  1: [[[1, 1.5], [2.5, 0], [2.5, 6]]],
  2: [[[0, 0], [4, 0], [4, 3], [0, 3], [0, 6], [4, 6]]],
  3: [[[0, 0], [4, 0], [4, 6], [0, 6]], [[1, 3], [4, 3]]],
  4: [[[0, 0], [0, 3], [4, 3]], [[4, 0], [4, 6]]],
  5: [[[4, 0], [0, 0], [0, 3], [4, 3], [4, 6], [0, 6]]],
  6: [[[4, 0], [0, 0], [0, 6], [4, 6], [4, 3], [0, 3]]],
  7: [[[0, 0], [4, 0], [4, 6]]],
  8: [BOX, [[0, 3], [4, 3]]],
  9: [[[4, 3], [0, 3], [0, 0], [4, 0], [4, 6], [0, 6]]],
  '.': [[[0.3, 5.4], [0.9, 5.4], [0.9, 6], [0.3, 6], [0.3, 5.4]]],
};
const ADVANCE = { '.': 2.4 };

// Open polylines for `text`, centred on (x, y), `size` mm tall.
export function strokeText(text, x, y, size) {
  const k = size / 6;
  const chars = [...String(text)].filter((ch) => GLYPHS[ch]);
  const width = chars.reduce((w, ch) => w + (ADVANCE[ch] ?? 5.5), 0) - 1.5;
  let cx = -width / 2;
  const out = [];
  for (const ch of chars) {
    for (const line of GLYPHS[ch]) out.push(line.map(([gx, gy]) => [x + (cx + gx) * k, y + (gy - 3) * k]));
    cx += ADVANCE[ch] ?? 5.5;
  }
  return out;
}
