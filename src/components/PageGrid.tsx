import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openForRender, renderPage } from '../lib/pdfRender';

interface Props {
  data: ArrayBuffer;
  total: number;
  /** Páginas elegidas (índices desde 0), en el orden del resultado. */
  selected: number[];
  onToggle: (page: number) => void;
}

/** Cuadrícula de miniaturas. Cada página se dibuja solo cuando entra en pantalla. */
export function PageGrid({ data, total, selected, onToggle }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let opened: PDFDocumentProxy | null = null;
    openForRender(data)
      .then((d) => {
        opened = d;
        if (alive) setDoc(d);
        else void d.destroy();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      void opened?.destroy();
    };
  }, [data]);

  if (failed) return <p className="help">No se pudieron dibujar las miniaturas, pero puedes elegir las páginas escribiéndolas.</p>;

  return (
    <ul className="page-grid" aria-label="Páginas del documento">
      {Array.from({ length: total }, (_, i) => {
        const order = selected.indexOf(i);
        return (
          <li key={i}>
            <button
              className="page"
              data-selected={order >= 0}
              aria-pressed={order >= 0}
              aria-label={`Página ${i + 1}${order >= 0 ? `, posición ${order + 1} en el resultado` : ''}`}
              onClick={() => onToggle(i)}
            >
              <Thumb doc={doc} index={i} />
              <span className="page-num mono">{i + 1}</span>
              {order >= 0 && <span className="page-order mono">{order + 1}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Thumb({ doc, index }: { doc: PDFDocumentProxy | null; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!doc || !canvas || drawn) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        renderPage(doc, index, canvas, 140)
          .then(() => setDrawn(true))
          .catch(() => {
            /* el documento se cerró mientras se dibujaba */
          });
      },
      { rootMargin: '200px' },
    );
    io.observe(canvas);
    return () => io.disconnect();
  }, [doc, index, drawn]);

  return <canvas ref={ref} className="page-canvas" data-drawn={drawn} />;
}
