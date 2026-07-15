import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { ListaItemPanel } from './ListaItemPanel';

export function UnidadesTransportePanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.apus.reduce((n, a) => n + a.recursos_transporte.filter(r => r.unidad === nombre).length, 0);
  }, [state.apus]);

  return (
    <ListaItemPanel
      title="Unidades de Transporte"
      items={state.config_listas.unidades_transporte}
      onChange={unidades_transporte => patch({ config_listas: { ...state.config_listas, unidades_transporte } })}
      prefix="UT"
      labelField="nombre"
      labelHeader="Unidad"
      countUsage={countUsage}
      usageLabel="APU(s)"
    />
  );
}
