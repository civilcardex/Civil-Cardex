import { createRoot } from 'react-dom/client';
import { IsometriaGeneral } from '../src/modules/civilflow/components/workarea/IsometryGeneral.tsx';
import type { useWorkAreaState } from '../src/modules/civilflow/components/useWorkAreaState.ts';
import '../src/modules/civilflow/components/workarea/isometry.css';

const state = {
  plans: [],
  pisos: [],
  profs: [],
  redes: new Set(['af']),
} as unknown as ReturnType<typeof useWorkAreaState>;

createRoot(document.getElementById('root')!).render(
  <div className="iso-workspace" style={{ display: 'flex', height: '95dvh' }}>
    <IsometriaGeneral state={state} />
  </div>,
);
