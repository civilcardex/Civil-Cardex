import { createRoot } from 'react-dom/client';
import { IsometriaGeneral } from '../src/modules/civilflow/components/workarea/IsometryGeneral.tsx';
import type { useWorkAreaState } from '../src/modules/civilflow/components/useWorkAreaState.ts';
import '../src/modules/civilflow/components/workarea/isometry.css';

const state = {
  /* Un plano CONFIRMADO con nivel: sin esto el aviso «No hay planos para dibujar» cubre el
   * lienzo (ped. 2026-11-26) y los gestos de la prueba no tienen canvas utilizable. */
  plans: [
    {
      id: 1,
      name: 'Plano de prueba',
      status: 'confirmed',
      nivel: 1,
      scale: 100,
      file: new File([], 'plano.pdf', { type: 'application/pdf' }),
    },
  ],
  pisos: [],
  profs: [],
  redes: new Set(['af']),
} as unknown as ReturnType<typeof useWorkAreaState>;

createRoot(document.getElementById('root')!).render(
  <div className="iso-workspace" style={{ display: 'flex', height: '95dvh' }}>
    <IsometriaGeneral state={state} />
  </div>,
);
