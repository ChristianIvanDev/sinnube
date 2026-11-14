import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip';

const enc = new TextEncoder();

/** Lector mínimo para comprobar el ZIP desde el directorio central, como hacen los descompresores. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const start = localOffset + 30 + localNameLen;
    files.push({ name, crc, data: zip.subarray(start, start + size) });
    p += 46 + nameLen;
  }
  return files;
}

describe('crc32', () => {
  it('coincide con los valores de referencia', () => {
    expect(crc32(enc.encode(''))).toBe(0);
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(enc.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('createZip', () => {
  it('guarda los archivos íntegros y con su CRC', () => {
    const zip = createZip([
      { name: 'uno.txt', data: enc.encode('hola') },
      { name: 'dos.bin', data: new Uint8Array([0, 255, 128]) },
    ]);
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(['uno.txt', 'dos.bin']);
    expect(new TextDecoder().decode(files[0].data)).toBe('hola');
    expect([...files[1].data]).toEqual([0, 255, 128]);
    for (const f of files) expect(f.crc).toBe(crc32(f.data));
  });

  it('admite nombres con acentos y evita duplicados', () => {
    const names = readZip(
      createZip([
        { name: 'Año fiscal.pdf', data: enc.encode('a') },
        { name: 'año fiscal.pdf', data: enc.encode('b') },
        { name: 'carpeta/raro:nombre?.pdf', data: enc.encode('c') },
      ]),
    ).map((f) => f.name);
    expect(names).toEqual(['Año fiscal.pdf', 'año fiscal (2).pdf', 'carpeta-raro-nombre-.pdf']);
  });

  it('genera un ZIP vacío válido', () => {
    expect(readZip(createZip([]))).toEqual([]);
  });
});
