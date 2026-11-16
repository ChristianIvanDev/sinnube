/**
 * Generadores de archivos de prueba con metadatos conocidos (solo para tests).
 * Construyen EXIF reales byte a byte, en orden «II» (Intel) o «MM» (Motorola).
 */

type Entry = { tag: number; type: 2 | 3 | 4 | 5; value: string | number | number[] };

interface TiffSpec {
  little?: boolean;
  ifd0: Entry[];
  exif?: Entry[];
  gps?: Entry[];
}

const SIZES = { 2: 1, 3: 2, 4: 4, 5: 8 } as const;

export function buildTiff({ little = true, ifd0, exif, gps }: TiffSpec): Uint8Array {
  const ifds: Entry[][] = [ifd0.slice()];
  if (exif) ifds[0].push({ tag: 0x8769, type: 4, value: 0 });
  if (gps) ifds[0].push({ tag: 0x8825, type: 4, value: 0 });
  if (exif) ifds.push(exif);
  if (gps) ifds.push(gps);
  ifds.forEach((entries) => entries.sort((a, b) => a.tag - b.tag));

  const buf = new Uint8Array(4096);
  const v = new DataView(buf.buffer);
  v.setUint16(0, little ? 0x4949 : 0x4d4d);
  v.setUint16(2, 42, little);
  v.setUint32(4, 8, little);

  // Cada IFD: 2 + 12·n + 4 bytes. Los datos largos van al final.
  const ifdOffsets: number[] = [];
  let pos = 8;
  for (const entries of ifds) {
    ifdOffsets.push(pos);
    pos += 2 + entries.length * 12 + 4;
  }
  let data = pos;

  ifds.forEach((entries, i) => {
    let p = ifdOffsets[i];
    v.setUint16(p, entries.length, little);
    p += 2;
    for (const e of entries) {
      let value = e.value;
      if (e.tag === 0x8769) value = ifdOffsets[1];
      if (e.tag === 0x8825) value = ifdOffsets[exif ? 2 : 1];
      const values: (number | string)[] = e.type === 2 ? [...(value as string), '\0'] : Array.isArray(value) ? value : [value as number];
      const size = SIZES[e.type] * values.length;
      v.setUint16(p, e.tag, little);
      v.setUint16(p + 2, e.type, little);
      v.setUint32(p + 4, e.type === 2 ? values.length : values.length, little);
      let at = p + 8;
      if (size > 4) {
        v.setUint32(p + 8, data, little);
        at = data;
        data += size + (size & 1);
      }
      values.forEach((x, k) => {
        if (e.type === 2) buf[at + k] = (x as string).charCodeAt(0);
        else if (e.type === 3) v.setUint16(at + k * 2, x as number, little);
        else if (e.type === 4) v.setUint32(at + k * 4, x as number, little);
        else {
          // racional: guardamos con denominador 10000
          v.setUint32(at + k * 8, Math.round((x as number) * 10000), little);
          v.setUint32(at + k * 8 + 4, 10000, little);
        }
      });
      p += 12;
    }
    v.setUint32(p, 0, little);
  });
  return buf.slice(0, data);
}

/** EXIF de ejemplo: un teléfono en el Zócalo de Ciudad de México. */
export function sampleTiff(little = true): Uint8Array {
  return buildTiff({
    little,
    ifd0: [
      { tag: 0x010f, type: 2, value: 'Apple' },
      { tag: 0x0110, type: 2, value: 'iPhone 15 Pro' },
      { tag: 0x0112, type: 3, value: 6 },
      { tag: 0x0131, type: 2, value: '17.5.1' },
      { tag: 0x013b, type: 2, value: 'Ana Torres' },
    ],
    exif: [
      { tag: 0x9003, type: 2, value: '2024:06:15 18:42:07' },
      { tag: 0xa434, type: 2, value: 'iPhone 15 Pro back camera 6.86mm f/1.78' },
    ],
    gps: [
      { tag: 1, type: 2, value: 'N' },
      { tag: 2, type: 5, value: [19, 25, 57.0] },
      { tag: 3, type: 2, value: 'W' },
      { tag: 4, type: 5, value: [99, 7, 59.0] },
      { tag: 6, type: 5, value: 2240.5 },
    ],
  });
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  return concat(new Uint8Array([0xff, marker, len >> 8, len & 0xff]), payload);
}

/** JPG mínimo (no decodificable, pero con estructura válida) con EXIF, XMP, comentario y perfil ICC. */
export function sampleJpeg(little = true): Uint8Array {
  return concat(
    new Uint8Array([0xff, 0xd8]),
    jpegSegment(0xe0, concat(ascii('JFIF\0'), new Uint8Array([1, 1, 0, 0, 1, 0, 1, 0, 0]))),
    jpegSegment(0xe1, concat(ascii('Exif\0\0'), sampleTiff(little))),
    jpegSegment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
    jpegSegment(0xe2, concat(ascii('ICC_PROFILE\0'), new Uint8Array([1, 1, 9, 9, 9]))),
    jpegSegment(0xfe, ascii('Foto de las vacaciones')),
    jpegSegment(0xdb, new Uint8Array(65)), // tabla de cuantización
    new Uint8Array([0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0xff, 0xd9]),
  );
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(ascii(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** PNG mínimo con eXIf, textos y fecha de edición. */
export function samplePng(): Uint8Array {
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, 1);
  new DataView(ihdr.buffer).setUint32(4, 1);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return concat(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('eXIf', sampleTiff(false)),
    pngChunk('tEXt', ascii('Author\0Ana Torres')),
    pngChunk('iTXt', concat(ascii('Description\0\0\0es\0\0'), new TextEncoder().encode('Cumpleaños de Sofía'))),
    pngChunk('tIME', new Uint8Array([7, 232, 6, 15, 18, 42, 7])),
    pngChunk('IDAT', new Uint8Array([0x78, 0x9c, 0x63, 0, 0, 0, 2, 0, 1])),
    pngChunk('IEND', new Uint8Array()),
  );
}

/** WebP extendido (VP8X) con EXIF y XMP. */
export function sampleWebp(): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const head = new Uint8Array(8);
    head.set(ascii(type));
    new DataView(head.buffer).setUint32(4, data.length, true);
    return concat(head, data, data.length & 1 ? new Uint8Array(1) : new Uint8Array());
  };
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0b00001100; // banderas: EXIF (bit 3) y XMP (bit 2)
  const body = concat(
    ascii('WEBP'),
    chunk('VP8X', vp8x),
    chunk('VP8 ', new Uint8Array([1, 2, 3, 4, 5, 6])),
    chunk('EXIF', sampleTiff()),
    chunk('XMP ', ascii('<x:xmpmeta/>')),
  );
  const head = new Uint8Array(8);
  head.set(ascii('RIFF'));
  new DataView(head.buffer).setUint32(4, body.length, true);
  return concat(head, body);
}
