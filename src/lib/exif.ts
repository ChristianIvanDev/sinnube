/**
 * Lector de metadatos para JPG, PNG y WebP, sin dependencias.
 *
 * - JPG: segmentos APP1 (EXIF y XMP), APP13 (IPTC/Photoshop), COM (comentarios).
 * - PNG: fragmentos eXIf, tEXt, iTXt, zTXt y tIME.
 * - WebP: fragmentos EXIF y XMP del contenedor RIFF.
 *
 * El EXIF es un pequeño TIFF: una cabecera con el orden de bytes y una cadena de
 * directorios (IFD) con etiquetas. De ahí sacamos cámara, fechas y GPS.
 */

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface Metadata {
  camera?: string;
  lens?: string;
  software?: string;
  takenAt?: string;
  author?: string;
  copyright?: string;
  orientation?: number;
  gps?: GpsPosition;
  /** Bloques encontrados, aunque no sepamos leerlos todos: «EXIF», «XMP», «IPTC», «Comentario»… */
  blocks: string[];
  /** Textos libres (comentarios JPG, tEXt de PNG). */
  texts: { key: string; value: string }[];
}

const TAGS = {
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  software: 0x0131,
  dateTime: 0x0132,
  artist: 0x013b,
  copyright: 0x8298,
  exifIfd: 0x8769,
  gpsIfd: 0x8825,
  dateTimeOriginal: 0x9003,
  lensModel: 0xa434,
} as const;

type TagValue = string | number | number[];

/** Lee un directorio TIFF y devuelve sus etiquetas como mapa. */
function readIfd(view: DataView, start: number, offset: number, little: boolean): Map<number, TagValue> {
  const tags = new Map<number, TagValue>();
  if (offset + 2 > view.byteLength - start) return tags;
  const count = view.getUint16(start + offset, little);
  for (let i = 0; i < count; i++) {
    const entry = start + offset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 0;
    if (!size) continue;
    const total = size * n;
    const at = total <= 4 ? entry + 8 : start + view.getUint32(entry + 8, little);
    if (at + total > view.byteLength) continue;
    try {
      if (type === 2) {
        // ASCII terminado en cero
        let s = '';
        for (let k = 0; k < n; k++) {
          const c = view.getUint8(at + k);
          if (c === 0) break;
          s += String.fromCharCode(c);
        }
        tags.set(tag, decodeLatin(s).trim());
      } else if (type === 3) {
        tags.set(tag, n === 1 ? view.getUint16(at, little) : Array.from({ length: n }, (_, k) => view.getUint16(at + k * 2, little)));
      } else if (type === 4) {
        tags.set(tag, n === 1 ? view.getUint32(at, little) : Array.from({ length: n }, (_, k) => view.getUint32(at + k * 4, little)));
      } else if (type === 5 || type === 10) {
        const vals = Array.from({ length: n }, (_, k) => {
          const num = type === 5 ? view.getUint32(at + k * 8, little) : view.getInt32(at + k * 8, little);
          const den = type === 5 ? view.getUint32(at + k * 8 + 4, little) : view.getInt32(at + k * 8 + 4, little);
          return den === 0 ? 0 : num / den;
        });
        tags.set(tag, n === 1 ? vals[0] : vals);
      } else if (type === 1 || type === 7) {
        tags.set(tag, Array.from({ length: n }, (_, k) => view.getUint8(at + k)));
      }
    } catch {
      /* etiqueta dañada: la ignoramos */
    }
  }
  return tags;
}

/** Muchas cámaras escriben UTF-8 en campos ASCII. */
function decodeLatin(s: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
}

function toDegrees(v: TagValue | undefined, ref: TagValue | undefined): number | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const deg = v[0] + v[1] / 60 + v[2] / 3600;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return Math.round(sign * deg * 1e6) / 1e6;
}

/** «2024:06:15 18:42:07» → «2024-06-15 18:42:07». */
function exifDate(v: TagValue | undefined): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}:\d{2}:\d{2}/.test(v)) return typeof v === 'string' && v ? v : undefined;
  return v.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
}

/** Interpreta un bloque EXIF (empieza por «II*\0» o «MM\0*»). */
export function parseTiff(bytes: Uint8Array, into: Metadata): void {
  if (bytes.length < 8) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = view.getUint16(0);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return;
  if (view.getUint16(2, little) !== 42) return;
  const ifd0 = readIfd(view, 0, view.getUint32(4, little), little);
  const exif = typeof ifd0.get(TAGS.exifIfd) === 'number' ? readIfd(view, 0, ifd0.get(TAGS.exifIfd) as number, little) : new Map();
  const gps = typeof ifd0.get(TAGS.gpsIfd) === 'number' ? readIfd(view, 0, ifd0.get(TAGS.gpsIfd) as number, little) : new Map();

  const make = ifd0.get(TAGS.make) as string | undefined;
  const model = ifd0.get(TAGS.model) as string | undefined;
  if (make || model) into.camera = model && make && model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ');
  into.lens = (exif.get(TAGS.lensModel) as string) || into.lens;
  into.software = (ifd0.get(TAGS.software) as string) || into.software;
  into.takenAt = exifDate(exif.get(TAGS.dateTimeOriginal)) ?? exifDate(ifd0.get(TAGS.dateTime)) ?? into.takenAt;
  into.author = (ifd0.get(TAGS.artist) as string) || into.author;
  into.copyright = (ifd0.get(TAGS.copyright) as string) || into.copyright;
  const orientation = ifd0.get(TAGS.orientation);
  if (typeof orientation === 'number') into.orientation = orientation;

  const lat = toDegrees(gps.get(2), gps.get(1));
  const lon = toDegrees(gps.get(4), gps.get(3));
  if (lat !== undefined && lon !== undefined && !(lat === 0 && lon === 0)) {
    const alt = gps.get(6);
    const below = Array.isArray(gps.get(5)) ? (gps.get(5) as number[])[0] === 1 : gps.get(5) === 1;
    into.gps = { latitude: lat, longitude: lon, ...(typeof alt === 'number' ? { altitude: Math.round((below ? -alt : alt) * 10) / 10 } : {}) };
  }
}

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));
const addBlock = (m: Metadata, name: string) => {
  if (!m.blocks.includes(name)) m.blocks.push(name);
};

function parseJpeg(b: Uint8Array, m: Metadata) {
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) break;
    const marker = b[p + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      p += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // empieza la imagen: ya no hay metadatos
    const len = (b[p + 2] << 8) | b[p + 3];
    const data = b.subarray(p + 4, p + 2 + len);
    if (marker === 0xe1 && ascii(data, 0, 6) === 'Exif\0\0') {
      addBlock(m, 'EXIF');
      parseTiff(data.subarray(6), m);
    } else if (marker === 0xe1 && ascii(data, 0, 28) === 'http://ns.adobe.com/xap/1.0/') {
      addBlock(m, 'XMP');
    } else if (marker === 0xed) {
      addBlock(m, 'IPTC');
    } else if (marker === 0xfe) {
      addBlock(m, 'Comentario');
      m.texts.push({ key: 'Comentario', value: new TextDecoder().decode(data).replace(/\0+$/, '') });
    } else if (marker === 0xe2 && ascii(data, 0, 11) === 'ICC_PROFILE') {
      addBlock(m, 'Perfil de color');
    }
    p += 2 + len;
  }
}

function parsePng(b: Uint8Array, m: Metadata) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  while (p + 8 <= b.length) {
    const len = view.getUint32(p);
    const type = ascii(b, p + 4, 4);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'eXIf') {
      addBlock(m, 'EXIF');
      parseTiff(data, m);
    } else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      const sep = data.indexOf(0);
      const key = ascii(data, 0, sep);
      if (key === 'XML:com.adobe.xmp') addBlock(m, 'XMP');
      else {
        addBlock(m, 'Texto');
        if (type === 'tEXt') m.texts.push({ key, value: new TextDecoder('latin1').decode(data.subarray(sep + 1)) });
        else if (type === 'iTXt') {
          // clave \0 compresión \0 método \0 idioma \0 clave traducida \0 texto
          const flag = data[sep + 1];
          let q = sep + 3;
          for (let k = 0; k < 2; k++) q = data.indexOf(0, q) + 1;
          m.texts.push({ key, value: flag ? '(comprimido)' : new TextDecoder().decode(data.subarray(q)) });
        } else m.texts.push({ key, value: '(comprimido)' });
      }
    } else if (type === 'tIME') {
      addBlock(m, 'Fecha de edición');
    } else if (type === 'iCCP') {
      addBlock(m, 'Perfil de color');
    } else if (type === 'IEND') break;
    p += 12 + len;
  }
}

function parseWebp(b: Uint8Array, m: Metadata) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 12;
  while (p + 8 <= b.length) {
    const type = ascii(b, p, 4);
    const len = view.getUint32(p + 4, true);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'EXIF') {
      addBlock(m, 'EXIF');
      // Algunos programas dejan el prefijo «Exif\0\0» de JPG.
      parseTiff(ascii(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data, m);
    } else if (type === 'XMP ') addBlock(m, 'XMP');
    else if (type === 'ICCP') addBlock(m, 'Perfil de color');
    p += 8 + len + (len & 1);
  }
}

export function readMetadata(bytes: Uint8Array): Metadata {
  const m: Metadata = { blocks: [], texts: [] };
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) parseJpeg(bytes, m);
    else if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') parsePng(bytes, m);
    else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') parseWebp(bytes, m);
  } catch {
    /* archivo truncado: devolvemos lo que se haya podido leer */
  }
  return m;
}

/** ¿Hay algo que pueda identificar a la persona o el lugar? */
export function isSensitive(m: Metadata): boolean {
  return !!(m.gps || m.camera || m.takenAt || m.author || m.texts.length || m.blocks.some((b) => b !== 'Perfil de color'));
}

export function formatCoords({ latitude, longitude }: GpsPosition): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`;
  return `${f(latitude, 'N', 'S')}, ${f(longitude, 'E', 'O')}`;
}
