import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { ListaItemPanel } from './ListItemPanel.tsx';

export function CategoriasApuPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (categoria: string) => state.apus.filter((a) => a.categoria === categoria).length;
  }, [state.apus]);

  return (
    <ListaItemPanel
      title="Categorías de APU"
      icon="categorias_de_apu"
      items={state.categorias_apu}
      onChange={(categorias_apu) =>
        patch({ categorias_apu, config_listas: { ...state.config_listas, categorias_apu } })
      }
      prefix="CAT"
      labelField="categoria"
      labelHeader="Categoría"
      countUsage={countUsage}
      usageLabel="APU(s)"
    />
  );
}
