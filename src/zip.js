// Minimal store-only ZIP writer, used to bundle DXF/STL where only .zip can be saved.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const toBytes = (data) =>
  typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;

// files: [{ name, data: string | ArrayBuffer | Uint8Array }] → Uint8Array
export function zip(files) {
  const entries = files.map((f) => ({ name: new TextEncoder().encode(f.name), bytes: toBytes(f.data) }));
  const size = entries.reduce((s, e) => s + 30 + e.name.length + e.bytes.length + 46 + e.name.length, 22);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let off = 0;
  const central = [];
  for (const e of entries) {
    const crc = crc32(e.bytes);
    central.push({ ...e, crc, offset: off });
    dv.setUint32(off, 0x04034b50, true);
    dv.setUint16(off + 4, 20, true);
    dv.setUint16(off + 6, 0x0800, true); // UTF-8 names
    dv.setUint16(off + 8, 0, true);
    dv.setUint32(off + 10, 0x00210000, true); // 1980-01-01
    dv.setUint32(off + 14, crc, true);
    dv.setUint32(off + 18, e.bytes.length, true);
    dv.setUint32(off + 22, e.bytes.length, true);
    dv.setUint16(off + 26, e.name.length, true);
    dv.setUint16(off + 28, 0, true);
    out.set(e.name, off + 30);
    out.set(e.bytes, off + 30 + e.name.length);
    off += 30 + e.name.length + e.bytes.length;
  }
  const cdStart = off;
  for (const e of central) {
    dv.setUint32(off, 0x02014b50, true);
    dv.setUint16(off + 4, 20, true);
    dv.setUint16(off + 6, 20, true);
    dv.setUint16(off + 8, 0x0800, true);
    dv.setUint16(off + 10, 0, true);
    dv.setUint32(off + 12, 0x00210000, true);
    dv.setUint32(off + 16, e.crc, true);
    dv.setUint32(off + 20, e.bytes.length, true);
    dv.setUint32(off + 24, e.bytes.length, true);
    dv.setUint16(off + 28, e.name.length, true);
    dv.setUint32(off + 30, 0, true);
    dv.setUint32(off + 34, 0, true);
    dv.setUint32(off + 38, 0, true);
    dv.setUint32(off + 42, e.offset, true);
    out.set(e.name, off + 46);
    off += 46 + e.name.length;
  }
  dv.setUint32(off, 0x06054b50, true);
  dv.setUint16(off + 8, central.length, true);
  dv.setUint16(off + 10, central.length, true);
  dv.setUint32(off + 12, off - cdStart, true);
  dv.setUint32(off + 16, cdStart, true);
  return out;
}
