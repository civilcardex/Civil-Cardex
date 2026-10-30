import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { ListaItemPanel } from './ListItemPanel.tsx';

/** Panel de orígenes de insumo (ej: 'Comprado', 'Preparado en obra'); uno con insumos asociados no se borra. */
export function OrigenesPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.insumos.filter((x) => x.origen === nombre).length;
  }, [state.insumos]);

  return (
    <ListaItemPanel
      title="Orígenes de insumo"
      icon="origenes_de_insumo"
      items={state.config_listas.origenes}
      onChange={(origenes) => patch({ config_listas: { ...state.config_listas, origenes } })}
      prefix="OR"
      labelField="nombre"
      labelHeader="Origen"
      countUsage={countUsage}
      usageLabel="insumo(s)"
    />
  );
}
