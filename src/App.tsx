import { useEffect, useState } from 'react';
import { Toaster } from './components/Toaster';
import { TOOLS, toolFromHash, type ToolInfo } from './tools';

function readTheme(): 'light' | 'dark' | null {
  try {
    const t = localStorage.getItem('sinnube:theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [tool, setTool] = useState<ToolInfo>(() => toolFromHash(location.hash));
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const onHash = () => setTool(toolFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `${tool.name} · Sinnube`;
  }, [tool]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem('sinnube:theme', theme);
      else localStorage.removeItem('sinnube:theme');
    } catch {
      /* sin almacenamiento */
    }
  }, [theme]);

  const toggleTheme = () => {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'light' : 'dark');
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/unir" aria-label="Sinnube, inicio">
          <Logo />
          <span>Sinnube</span>
        </a>
        <div className="topbar-actions">
          <span className="privacy-pill">Tus archivos no salen de tu equipo</span>
          <button className="btn btn-ghost icon-btn" aria-label="Cambiar tema" onClick={toggleTheme}>
            <ThemeIcon />
          </button>
          <a className="btn btn-ghost icon-btn" href="https://github.com/ChristianIvanDev/sinnube" target="_blank" rel="noreferrer" aria-label="Código en GitHub">
            <GitHubIcon />
          </a>
        </div>
      </header>

      <div className="layout">
        <nav className="toolnav" aria-label="Herramientas">
          <span className="toolnav-label">Herramientas</span>
          {TOOLS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} aria-current={t.id === tool.id ? 'page' : undefined} data-soon={!t.ready}>
              <strong>{t.name}</strong>
              <span>{t.summary}</span>
            </a>
          ))}
        </nav>

        <main>
          <header className="tool-head">
            <h1>{tool.title}</h1>
            <p>{tool.description}</p>
          </header>
          <ToolView tool={tool} />
        </main>
      </div>

      <footer className="footer">
        <span>Todo el procesamiento ocurre en tu navegador. Sin cuentas, sin servidores, sin rastreo.</span>
        <a href="https://github.com/ChristianIvanDev/sinnube" target="_blank" rel="noreferrer">
          Código abierto · MIT
        </a>
      </footer>
      <Toaster />
    </div>
  );
}

function ToolView(_: { tool: ToolInfo }) {
  return (
    <section className="card soon">
      <p>Esta herramienta está en construcción.</p>
    </section>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" fill="currentColor" opacity=".18" />
      <path d="M4 4l16 16" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}
