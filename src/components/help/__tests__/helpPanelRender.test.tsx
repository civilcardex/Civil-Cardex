import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AyudaPanel from '../HelpPanel';
import { GUIA } from '../helpGuide';
import { tutorialDe } from '../helpTutoriales';

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
});
