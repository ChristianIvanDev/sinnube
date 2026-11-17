/**
 * Elimina metadatos sin volver a codificar la imagen: se copian los bytes de la imagen tal
 * cual y se omiten solo los bloques de metadatos. Así no se pierde ni un píxel de calidad.
 *
 * Se conserva lo que afecta a cómo se ve la foto:
 * - El perfil de color (ICC): sin él, los colores podrían cambiar.
 * - La orientación (en JPG): sin ella, una foto vertical aparecería tumbada. Se reescribe
 *   en un EXIF mínimo que solo contiene ese dato.
 */
import { readMetadata } from './exif';

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** APP1 con un EXIF que solo dice la orientación. */
export function orientationSegment(orientation: number): Uint8Array {
  const seg = new Uint8Array(4 + 6 + 8 + 2 + 12 + 4);
  const v = new DataView(seg.buffer);
  seg.set([0xff, 0xe1]);
  v.setUint16(2, seg.length - 2);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // «Exif\0\0»
  const t = 10;
  v.setUint16(t, 0x4949); // «II»
  v.setUint16(t + 2, 42, true);
  v.setUint32(t + 4, 8, true);
  v.setUint16(t + 8, 1, true); // una etiqueta
  v.setUint16(t + 10, 0x0112, true); // Orientation
  v.setUint16(t + 12, 3, true); // SHORT
  v.setUint32(t + 14, 1, true);
  v.setUint16(t + 18, orientation, true);
  v.setUint32(t + 22, 0, true); // sin más directorios
  return seg;
}

export function stripJpeg(b: Uint8Array, keepOrientation = true): Uint8Array {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('No es un JPG.');
  const orientation = keepOrientation ? readMetadata(b).orientation : undefined;
  const kept: { marker: number; bytes: Uint8Array }[] = [];
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) throw new Error('JPG dañado.');
    const marker = b[p + 1];
    if (marker === 0xff) {
      p++; // relleno entre segmentos
      continue;
    }
    if (marker === 0xda) {
      // Inicio de la imagen comprimida: de aquí al final se copia sin tocar.
      kept.push({ marker, bytes: b.subarray(p) });
      // La orientación va después de JFIF (APP0), que por norma debe ser el primer segmento.
      if (orientation && orientation !== 1) {
        const at = kept[0]?.marker === 0xe0 ? 1 : 0;
        kept.splice(at, 0, { marker: 0xe1, bytes: orientationSegment(orientation) });
      }
      return concat([b.subarray(0, 2), ...kept.map((k) => k.bytes)]);
    }
    const len = (b[p + 2] << 8) | b[p + 3];
    const seg = b.subarray(p, p + 2 + len);
    const data = seg.subarray(4);
    const isMeta =
      marker === 0xe1 || // EXIF y XMP
      marker === 0xed || // IPTC / Photoshop
      marker === 0xfe || // comentarios
      (marker >= 0xe3 && marker <= 0xec) || // APP3–APP12: datos de fabricantes y vistas previas
      (marker === 0xe2 && ascii(data, 0, 11) !== 'ICC_PROFILE'); // APP2 que no es perfil de color (FlashPix, MPF)
    if (!isMeta) kept.push({ marker, bytes: seg });
    p += 2 + len;
  }
  throw new Error('JPG incompleto.');
}

const PNG_META = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

export function stripPng(b: Uint8Array): Uint8Array {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let p = 8;
  while (p + 12 <= b.length) {
    const len = view.getUint32(p);
    const type = ascii(b, p + 4, 4);
    if (!PNG_META.has(type)) parts.push(b.subarray(p, p + 12 + len));
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return concat(parts);
}

export function stripWebp(b: Uint8Array): Uint8Array {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks: Uint8Array[] = [];
  let p = 12;
  while (p + 8 <= b.length) {
    const type = ascii(b, p, 4);
    const len = view.getUint32(p + 4, true);
    const full = b.slice(p, p + 8 + len + (len & 1));
    if (type === 'VP8X') full[8] &= ~0b00001100; // ya no hay EXIF (bit 3) ni XMP (bit 2)
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(full);
    p += 8 + len + (len & 1);
  }
  const body = concat(chunks);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 4));
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  head.set(b.subarray(8, 12), 8);
  return concat([head, body]);
}

export function stripMetadata(b: Uint8Array): Uint8Array {
  if (b[0] === 0xff && b[1] === 0xd8) return stripJpeg(b);
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return stripPng(b);
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return stripWebp(b);
  throw new Error('Formato no compatible.');
}
