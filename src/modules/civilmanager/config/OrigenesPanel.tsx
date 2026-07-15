import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { ListaItemPanel } from './ListaItemPanel';

export function OrigenesPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.insumos.filter(x => x.origen === nombre).length;
  }, [state.insumos]);

  return (
    <ListaItemPanel
      title="Orígenes de Insumo"
      items={state.config_listas.origenes}
      onChange={origenes => patch({ config_listas: { ...state.config_listas, origenes } })}
      prefix="OR"
      labelField="nombre"
      labelHeader="Origen"
      countUsage={countUsage}
      usageLabel="insumo(s)"
    />
  );
}
