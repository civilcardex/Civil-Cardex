import { useState } from 'react';
import { useCivilManager } from '../context';
import { EditableSection } from '../shared/EditLock';
import { ProyectosPanel } from './ProjectsPanel';
import { ItemsPanel } from './ItemsPanel';
import { ResumenPanel } from './SummaryPanel';
import { EntregablesPanel } from './DeliverablesPanel';
import { FormularioImportPanel } from './FormImportPanel';
import type { Presupuesto } from '../types';

type Sub = 'proyectos' | 'items' | 'resumen' | 'entregables' | 'formulario';

const SUBS: { id: Sub; label: string }[] = [
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'items', label: 'Ítems' },
  { id: 'resumen', label: 'Resumen AIU' },
  { id: 'entregables', label: 'Entregables' },
  { id: 'formulario', label: 'Importar Formulario' },
];

// Sidebar vertical de sub-pestañas + panel a la derecha (igual que ConfigTab — orig. usuario):
// EDITAR/LISTO arriba a la derecha de la tabla; solo el panel se opaca en lectura.
export function PresupuestosTab() {
  const { state, patch } = useCivilManager();
  const [selId, setSelId] = useState<string | null>(state.presupuestos[0]?.id ?? null);
  const [sub, setSub] = useState<Sub>('proyectos');

  const pres = selId ? (state.presupuestos.find((p) => p.id === selId) ?? null) : null;

  function updatePres(p: Partial<Presupuesto>) {
    if (!pres) return;
    patch({ presupuestos: state.presupuestos.map((x) => (x.id === pres.id ? { ...x, ...p } : x)) });
  }

  return (
    <EditableSection dim={false}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <nav
          aria-label="Presupuestos"
          style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {SUBS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cm-btn ${sub === s.id ? 'cm-btn-primary' : ''}`}
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                padding: '9px 12px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
              onClick={() => setSub(s.id)}
              disabled={s.id !== 'proyectos' && !pres}
              aria-current={sub === s.id ? 'true' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>
          {sub === 'proyectos' && (
            <ProyectosPanel
              selId={selId}
              onSelect={(id) => {
                setSelId(id);
                setSub('items');
              }}
            />
          )}
          {sub === 'items' && pres && <ItemsPanel pres={pres} onUpdate={updatePres} />}
          {sub === 'resumen' && pres && <ResumenPanel pres={pres} onUpdate={updatePres} />}
          {sub === 'entregables' && pres && <EntregablesPanel pres={pres} />}
          {sub === 'formulario' && pres && (
            <FormularioImportPanel pres={pres} onUpdate={updatePres} />
          )}
        </div>
      </div>
    </EditableSection>
  );
}
