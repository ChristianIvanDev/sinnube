/**
 * Generador mínimo de archivos ZIP («store», sin compresión). Los PDF y las imágenes ya
 * vienen comprimidos, así que comprimir otra vez apenas ahorra espacio y sí cuesta tiempo.
 * Formato: PKWARE APPNOTE 6.3.x, con nombres en UTF-8 (bit 11).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  date?: Date;
}

function dosDateTime(d: Date): [number, number] {
  const year = Math.max(1980, d.getFullYear());
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

/** Evita nombres repetidos dentro del ZIP: «a.pdf», «a (2).pdf»… */
function uniqueNames(entries: ZipEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map(({ name }) => {
    const clean = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/^\.+/, '') || 'archivo';
    const count = (seen.get(clean.toLowerCase()) ?? 0) + 1;
    seen.set(clean.toLowerCase(), count);
    if (count === 1) return clean;
    const m = clean.match(/^(.*?)(\.[^.]+)?$/)!;
    return `${m[1]} (${count})${m[2] ?? ''}`;
  });
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const names = uniqueNames(entries).map((n) => enc.encode(n));
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry, i) => {
    const name = names[i];
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const [time, date] = dosDateTime(entry.date ?? new Date());
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error('El ZIP superaría 4 GB.');

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // firma de cabecera local
    lv.setUint16(4, 20, true); // versión necesaria: 2.0
    lv.setUint16(6, 0x0800, true); // nombre en UTF-8
    lv.setUint16(8, 0, true); // método: sin compresión
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // firma del directorio central
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length + size;
  });

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // fin del directorio central
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
