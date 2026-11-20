import { useEffect, useRef, useState } from 'react';
import { onNetwork, type NetworkSummary } from '../lib/network';

/** Indicador en la barra superior: cuántos datos han salido del equipo (siempre debería ser cero). */
export function PrivacyBadge() {
  const [net, setNet] = useState<NetworkSummary>({ since: null, sends: [], assets: 0 });
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => onNetwork(setNet), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const sent = net.sends.length;
  const label = !online ? 'Sin conexión: todo sigue funcionando' : net.since === null ? 'Tus archivos no salen de tu equipo' : `${sent} ${sent === 1 ? 'envío' : 'envíos'} de datos`;

  return (
    <div className="privacy" ref={ref}>
      <button className="privacy-pill" data-alert={sent > 0} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="privacy-pop card" role="dialog" aria-label="Actividad de red">
          <strong>Así puedes comprobarlo</strong>
          {net.since === null ? (
            <p>Cuando agregues un archivo, aquí verás cada petición de red que haga la página a partir de ese momento.</p>
          ) : (
            <ul>
              <li>
                <span className="mono">{sent}</span> envíos de datos (fetch, XHR o beacon) desde que agregaste archivos.
              </li>
              <li>
                <span className="mono">{net.assets}</span> descargas de código de la propia app, como el lector de PDF, que se carga la primera vez.
              </li>
            </ul>
          )}
          <p className="muted">
            También puedes abrir las herramientas de desarrollo (F12), ir a la pestaña Red y desconectar internet: Sinnube sigue funcionando.
          </p>
        </div>
      )}
    </div>
  );
}
