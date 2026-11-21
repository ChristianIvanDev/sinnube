export interface ToolInfo {
  id: string;
  name: string;
  summary: string;
  title: string;
  description: string;
  ready: boolean;
}

/** Registro de herramientas. Cada una se activa cuando su módulo está listo. */
export const TOOLS: ToolInfo[] = [
  {
    id: 'unir',
    name: 'Unir PDF',
    summary: 'Varios PDF en uno',
    title: 'Une varios PDF en uno solo',
    description: 'Arrastra tus archivos, ordénalos como quieras y descarga un único PDF. Nada se sube a internet.',
    ready: true,
  },
  {
    id: 'dividir',
    name: 'Dividir PDF',
    summary: 'Extrae y reordena páginas',
    title: 'Extrae, reordena o elimina páginas',
    description: 'Escribe qué páginas quieres conservar, en el orden que quieras, y descarga el resultado.',
    ready: true,
  },
  {
    id: 'imagenes-pdf',
    name: 'Imágenes a PDF',
    summary: 'Fotos o escaneos en un PDF',
    title: 'Convierte imágenes en un PDF',
    description: 'Ideal para documentos fotografiados con el celular: cada imagen es una página, en el orden que elijas.',
    ready: true,
  },
  {
    id: 'comprimir',
    name: 'Comprimir imágenes',
    summary: 'JPG, PNG y WebP más ligeros',
    title: 'Comprime y redimensiona imágenes',
    description: 'Reduce el peso de tus fotos en lote y compara el resultado antes de descargarlo.',
    ready: true,
  },
  {
    id: 'metadatos',
    name: 'Quitar metadatos',
    summary: 'Ubicación GPS, cámara y fecha',
    title: 'Mira y borra lo que revelan tus fotos',
    description: 'Las fotos guardan dónde y con qué cámara se tomaron. Bórralo sin volver a comprimir la imagen: no pierde ni un píxel.',
    ready: true,
  },
];

export function toolFromHash(hash: string): ToolInfo {
  const id = hash.replace(/^#\/?/, '');
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0];
}
