// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildNetTools, isToolDisabledForNet, TOOLS } from '../toolbarNetTools.ts';
import { STATUS, ToolbarCollapsed, ToolbarExpanded } from '../toolbarButtons.tsx';
import { renderYVer } from '../../../../../test/render.tsx';

/**
 * Caracterización de la barra de herramientas del visor extraída de PdfViewerToolbar:
 * la regla herramienta↔red (buildNetTools/isToolDisabledForNet) y las dos rutas de render
 * (colapsada/expandida) fijan el comportamiento que NO debe cambiar al partir el monolito.
 */

const ids = (net: string, recolectoraActive = true) =>
  buildNetTools(net, recolectoraActive).map((t) => t.id);

describe('buildNetTools (regla herramienta↔red)', () => {
  it('san: bajante visible, montante/gabinete/muro/canal ocultos', () => {
    const v = ids('san');
    expect(v).toContain('baj');
    expect(v).not.toContain('mon');
    expect(v).not.toContain('gab');
    expect(v).not.toContain('muro');
    expect(v).not.toContain('canal');
    expect(v).toContain('caja'); // Caja AN
  });

  it('gas: incluye Contador, oculta bajante/canal, muestra montante', () => {
    const v = ids('gas');
    expect(v).toContain('cont');
    expect(v).toContain('mon');
    expect(v).not.toContain('baj');
    expect(v).not.toContain('canal');
  });

  it('ll con recolectora activa: canal y Caja ALL visibles', () => {
    const v = ids('ll');
    expect(v).toContain('canal');
    expect(v).toContain('caja');
    const caja = buildNetTools('ll', true).find((t) => t.id === 'caja');
    expect(caja?.label).toBe('Caja ALL');
  });

  it('ll sin recolectora: canal filtrado (la red no se está diseñando)', () => {
    expect(ids('ll', false)).not.toContain('canal');
    expect(ids('ll', true)).toContain('canal');
  });

  it('rci: gabinete, muro y montante visibles; canal/caja/bajante ocultos', () => {
    const v = ids('rci');
    expect(v).toContain('gab');
    expect(v).toContain('muro');
    expect(v).toContain('mon');
    expect(v).not.toContain('canal');
    expect(v).not.toContain('caja');
    expect(v).not.toContain('baj');
  });

  it('el orden de inserciones respeta el contrato de splices (muro, gab tras Texto en rci)', () => {
    // En rci quedan visibles gab y muro: cada splice(7) empuja al anterior → muro primero.
    const v = ids('rci');
    expect(v.slice(0, 7)).toEqual(TOOLS.slice(0, 7).map((t) => t.id));
    expect(v[7]).toBe('muro');
    expect(v[8]).toBe('gab');
  });

  it('isToolDisabledForNet coincide con el filtro de buildNetTools', () => {
    expect(isToolDisabledForNet('baj', 'gas')).toBe(true);
    expect(isToolDisabledForNet('baj', 'san')).toBe(false);
    expect(isToolDisabledForNet('canal', 'll', false)).toBe(true);
  });
});

describe('las dos rutas de render (paridad colapsada/expandida)', () => {
  const base = {
    visibleTools: buildNetTools('san', true),
    isToolActive: () => false,
    onToolClick: () => {},
    snapOn: true,
    gridOn: false,
    onSnapToggle: () => {},
    onGridToggle: () => {},
    onFit: () => {},
    onSave: () => {},
    onUndo: () => {},
    onRedo: () => {},
    onClear: () => {},
    onClearGuides: () => {},
    currentFile: null,
    saveStatus: 'saved',
    esSuscripcionVencida: false,
    bdError: null,
  };

  it('colapsada: botones compactos con aria-label y snap encendido', async () => {
    const cont = await renderYVer(<ToolbarCollapsed {...base} />);
    expect(cont.querySelector('[aria-label="Snap"]')).toBeTruthy();
    expect(cont.querySelector('[aria-label="Grilla (H)"]')).toBeTruthy();
    expect(cont.querySelector('[aria-label="Guardar"]')).toBeTruthy();
  });

  it('expandida: encabezados Herramientas/Acciones + etiqueta Ramal principal', async () => {
    const cont = await renderYVer(<ToolbarExpanded {...base} />);
    expect(cont.textContent).toContain('Herramientas');
    expect(cont.textContent).toContain('Acciones');
    expect(cont.textContent).toContain('Ramal principal');
    expect(cont.textContent).toContain('Encajar PDF al visor');
  });

  it('expandida con bdError suscripcion_requerida muestra el banner de alerta', async () => {
    const cont = await renderYVer(
      <MemoryRouter>
        <ToolbarExpanded {...base} esSuscripcionVencida bdError="suscripcion_requerida: venció" />
      </MemoryRouter>,
    );
    expect(cont.querySelector('[role="alert"]')).toBeTruthy();
    expect(cont.textContent).toContain('Suscripción vencida');
  });

  it('STATUS conserva los tres estados de guardado', () => {
    expect(STATUS.saved.label).toContain('Guardado');
    expect(STATUS.saving.color).toBe('#3b82f6');
    expect(STATUS.error.label).toContain('Sin guardar');
  });
});
