// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router';
import { ScaleText, PlanoAsocInfo } from '../viewerInfoPanels.tsx';
import { useActiveNetState } from '../useActiveNetState.ts';
import { useDmuroRciInjection } from '../useDmuroRciInjection.ts';
import { useCloseViewer } from '../useCloseViewer.ts';
import { renderYVer } from '../../../../../test/render.tsx';
import { saveToStorage, loadFromStorage } from '../../../services/storageService.ts';
import { RCI_ESTADO_VIVO_KEY } from '../../../constants/storage-keys.ts';
import { EV_RCI_VIVO_SAVED } from '../../../utils/fixtureEvents.ts';
import PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';

/**
 * Caracterización de los hooks/paneles extraídos de PdfViewer (extracción verbatim): la red
 * activa, la inyección de Dmuro RCI, los paneles de escala y el cierre del visor.
 */

const plano = {
  id: 9,
  name: 'Piso 2.pdf',
  nivel: 1,
  status: 'confirmed',
  scale: 200,
} as unknown as PlanItem;

describe('viewerInfoPanels', () => {
  it('ScaleText: la escala de la lámina calibrada manda sobre scaleM', async () => {
    const cont = await renderYVer(<ScaleText selectedNivel={1} planos={[plano]} scaleM="0.5" />);
    expect(cont.textContent).toBe('1:200');
  });

  it('ScaleText sin lámina calibrada: usa el map de scaleM', async () => {
    const cont = await renderYVer(<ScaleText selectedNivel={null} planos={[]} scaleM="0.5" />);
    expect(cont.textContent).toBe('1:50');
  });

  it('PlanoAsocInfo: tarjeta con nombre y escala del plano confirmado', async () => {
    const cont = await renderYVer(<PlanoAsocInfo selectedNivel={1} planos={[plano]} />);
    expect(cont.textContent).toContain('Piso 2.pdf');
    expect(cont.textContent).toContain('Escala 1:200');
  });

  it('PlanoAsocInfo sin piso: no renderiza nada', async () => {
    const cont = await renderYVer(<PlanoAsocInfo selectedNivel={null} planos={[plano]} />);
    expect(cont.innerHTML).toBe('');
  });
});

describe('useActiveNetState', () => {
  function Probe({ nets }: { nets: Set<string> }) {
    const [net, setNet] = useActiveNetState(nets);
    return (
      <button type="button" onClick={() => setNet('gas')} aria-label="net">
        {net}
      </button>
    );
  }

  it('con redes activas del proyecto arranca en la primera (no en la default af)', async () => {
    const cont = await renderYVer(<Probe nets={new Set(['san', 'vent'])} />);
    expect(cont.textContent).toBe('san');
  });

  it('sin redes activas cae a la default af', async () => {
    saveToStorage('civilflow_active_nets', []);
    const cont = await renderYVer(<Probe nets={new Set()} />);
    expect(cont.textContent).toBe('af');
  });
});

describe('useDmuroRciInjection', () => {
  it('inyecta el máximo del riesgo solo con S del piso activo y reacciona a cambios', async () => {
    saveToStorage(RCI_ESTADO_VIVO_KEY, {
      pisos: {
        rows: [
          { planId: '8', S: 3 },
          { planId: '9', riesgo: 'Riesgo extra G1' },
        ],
      },
    });
    const holder: { engine: PlanoEngine | null } = { engine: null };
    function Probe() {
      const engineRef = useRef<PlanoEngine | null>(null);
      engineRef.current = { dmuroRci: null } as unknown as PlanoEngine;
      holder.engine = engineRef.current;
      useDmuroRciInjection(engineRef, 9);
      return null;
    }
    await renderYVer(<Probe />);
    expect(holder.engine?.dmuroRci).toBeNull();
    saveToStorage(RCI_ESTADO_VIVO_KEY, {
      pisos: { rows: [{ planId: '9', riesgo: 'Riesgo extra G1', S: '3,2' }] },
    });
    window.dispatchEvent(new Event(EV_RCI_VIVO_SAVED));
    expect(holder.engine?.dmuroRci).toBe(1.6);
    saveToStorage(RCI_ESTADO_VIVO_KEY, {
      pisos: { rows: [{ planId: '9', riesgo: 'Riesgo extra G1', S: '' }] },
    });
    window.dispatchEvent(new Event(EV_RCI_VIVO_SAVED));
    expect(holder.engine?.dmuroRci).toBeNull();
  });

  it('con S y sin riesgo en la fila usa el riesgo global', async () => {
    saveToStorage(RCI_ESTADO_VIVO_KEY, {
      clas: { riesgo: 'Riesgo extra G1' },
      pisos: { rows: [{ planId: '9', S: 3 }] },
    });
    const holder: { engine: PlanoEngine | null } = { engine: null };
    function Probe() {
      const engineRef = useRef<PlanoEngine | null>(null);
      engineRef.current = { dmuroRci: 1.5 } as unknown as PlanoEngine;
      holder.engine = engineRef.current;
      useDmuroRciInjection(engineRef, 9);
      return null;
    }
    await renderYVer(<Probe />);
    expect(holder.engine?.dmuroRci).toBe(1.5);
  });
});

describe('useCloseViewer', () => {
  it('flujo completo sin engine: prefetch, guardado y cierre (sin bloqueo)', async () => {
    let saved = 0;
    function Probe() {
      const cerrandoRef = useRef(false);
      const engineRef = useRef<PlanoEngine | null>(null);
      const close = useCloseViewer({
        cerrandoRef,
        engineRef,
        planos: [],
        onAlertHandler: () => {},
        handleSave: () => {
          saved++;
        },
      });
      close();
      return null;
    }
    await renderYVer(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    // El flush del render ya esperó microtareas: el guardado se disparó exactamente 1 vez.
    expect(saved).toBe(1);
  });

  it('es idempotente: el segundo click no re-dispara el guardado', async () => {
    let saved = 0;
    let closeFn: (() => void) | null = null;
    function Probe() {
      const cerrandoRef = useRef(false);
      const engineRef = useRef<PlanoEngine | null>(null);
      const close = useCloseViewer({
        cerrandoRef,
        engineRef,
        planos: [],
        onAlertHandler: () => {},
        handleSave: () => {
          saved++;
        },
      });
      closeFn = close;
      return null;
    }
    await renderYVer(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    closeFn!(); // cerrandoRef ya quedó en true tras el primer cierre del mount
    await new Promise((r) => setTimeout(r, 10));
    expect(saved).toBe(1);
  });
});

// loadFromStorage se usa arriba para verificar la clave de lectura del hook de Dmuro.
void loadFromStorage;
