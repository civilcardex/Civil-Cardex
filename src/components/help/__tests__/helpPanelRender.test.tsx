import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AyudaPanel from '../HelpPanel.tsx';
import { GUIA } from '../helpGuide.tsx';
import { tutorialDe } from '../helpTutorials.ts';

// Regresión reportada: "la info de ayuda ya no está, solo está el video". El panel debe
// renderizar los acordeones de GUIA además de la sección de video.

const ctx = {
  key: 'cf:visor',
  modulo: 'Civil Flow',
  seccion: 'Dibujo de redes',
  intro: 'intro',
};

describe('HelpPanel', () => {
  it('GUIA tiene contenido para cf:visor y el panel renderiza acordeones + video', () => {
    expect((GUIA['cf:visor'] || []).length).toBeGreaterThan(0);
    const html = renderToString(
      <MemoryRouter>
        <AyudaPanel ctx={ctx} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(html).not.toContain('Aún no hay contenido');
    expect((html.match(/<button/g) || []).length).toBeGreaterThan(3);
    expect(html).toContain('<iframe');
    expect(tutorialDe('cf:visor')).not.toBeNull();
  });

  it('Carga de planos muestra el recorte como sección COLAPSABLE (no tarjeta fija)', () => {
    const html = renderToString(
      <MemoryRouter>
        <AyudaPanel
          ctx={{ ...ctx, key: 'cf:planos', seccion: 'Carga de planos' }}
          onClose={() => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Recorte para isometría');
    // Sección colapsable como las demás: acordeón cerrado y SIN botón propio en la cabecera.
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('REPETIR TOUR DEL RECORTE');
    // El «Repetir tour» es el del pie, igual que en el resto de pestañas.
    expect((html.match(/REPETIR TOUR/g) || []).length).toBe(1);
    // El grupo sale de la MISMA guía que usa el editor (una sola fuente de texto).
    const grupo = (GUIA['cf:planos'] || []).find((g) => g.titulo === 'Recorte para isometría');
    expect(grupo?.items.length).toBeGreaterThan(0);
  });

  it('el editor de recorte tiene su PROPIA ayuda y el pie repite SU tour', () => {
    const html = renderToString(
      <MemoryRouter>
        <AyudaPanel
          ctx={{ ...ctx, key: 'cf:recorte', seccion: 'Recorte para isometría' }}
          onClose={() => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Recorte para isometría');
    expect(html).not.toContain('Aún no hay contenido');
    // Una sola sección (la del recorte) y el repetir-tour estándar del pie.
    expect((html.match(/REPETIR TOUR/g) || []).length).toBe(1);
    expect(html).toContain('aria-expanded="false"');
  });
});
