import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import './index.css';
// PlanoState solo trae tipos + el catálogo NETS (sin motor): no engorda el bundle de entrada.
import { NETS } from './modules/civilflow/lib/PlanoEngine/PlanoState';

// Colores personalizados por red (orig. usuario): aplicar la caché de localStorage ANTES del
// primer paint — al reingresar ya no se ven los predeterminados y luego los suyos. La BD
// (perfiles.net_colors) sigue resolviendo después vía loadNetColors y gana si difiere.
// Ponytail: solo variables CSS aquí; NETS[].col lo sincroniza useNetColorsInit al montar el
// visor. Los ids nacen del catálogo (agregar una red ya no exige editar esta lista); 'ep'
// es clave legacy que NETS no trae y se conserva para no perder cachés viejas.
{
  const ids = [...NETS.map((n) => n.id), 'ep'];
  for (const id of ids) {
    try {
      const raw = localStorage.getItem('civilflow_net_' + id);
      if (!raw) continue;
      const c = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      })();
      if (typeof c === 'string' && c) {
        document.documentElement.style.setProperty('--' + id, c);
      }
    } catch {
      /* ignorar */
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  </StrictMode>,
);
