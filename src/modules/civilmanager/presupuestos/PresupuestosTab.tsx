import { useState } from 'react';
import { useCivilManager } from '../context';
import { ProyectosPanel } from './ProyectosPanel';
import { ItemsPanel } from './ItemsPanel';
import { ResumenPanel } from './ResumenPanel';
import { EntregablesPanel } from './EntregablesPanel';
import { FormularioImportPanel } from './FormularioImportPanel';
import type { Presupuesto } from '../types';

type Sub = 'proyectos' | 'items' | 'resumen' | 'entregables' | 'formulario';

const SUBS: { id: Sub; label: string }[] = [
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'items', label: 'Ítems' },
  { id: 'resumen', label: 'Resumen AIU' },
  { id: 'entregables', label: 'Entregables' },
  { id: 'formulario', label: 'Importar Formulario' },
];

export function PresupuestosTab() {
  const { state, patch } = useCivilManager();
  const [selId, setSelId] = useState<string | null>(state.presupuestos[0]?.id ?? null);
  const [sub, setSub] = useState<Sub>('proyectos');

  const pres = selId ? state.presupuestos.find(p => p.id === selId) ?? null : null;

  function updatePres(p: Partial<Presupuesto>) {
    if (!pres) return;
    patch({ presupuestos: state.presupuestos.map(x => (x.id === pres.id ? { ...x, ...p } : x)) });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {SUBS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`cm-btn ${sub === s.id ? 'cm-btn-primary' : ''}`}
            onClick={() => setSub(s.id)}
            disabled={s.id !== 'proyectos' && !pres}
            aria-current={sub === s.id ? 'true' : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'proyectos' && <ProyectosPanel selId={selId} onSelect={id => { setSelId(id); setSub('items'); }} />}
      {sub === 'items' && pres && <ItemsPanel pres={pres} onUpdate={updatePres} />}
      {sub === 'resumen' && pres && <ResumenPanel pres={pres} onUpdate={updatePres} />}
      {sub === 'entregables' && pres && <EntregablesPanel pres={pres} />}
      {sub === 'formulario' && pres && <FormularioImportPanel pres={pres} onUpdate={updatePres} />}
    </div>
  );
}
