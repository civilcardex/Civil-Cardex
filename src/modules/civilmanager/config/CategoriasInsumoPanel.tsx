import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { ListaItemPanel } from './ListaItemPanel';

export function CategoriasInsumoPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.insumos.filter(x => x.categoria === nombre).length;
  }, [state.insumos]);

  return (
    <ListaItemPanel
      title="Categorías de Insumo"
      items={state.config_listas.categorias_insumo}
      onChange={categorias_insumo => patch({ config_listas: { ...state.config_listas, categorias_insumo } })}
      prefix="CI"
      labelField="nombre"
      labelHeader="Categoría"
      countUsage={countUsage}
      usageLabel="insumo(s)"
    />
  );
}
