import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { ListaItemPanel } from './ListaItemPanel';

export function TiposEquipoPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.equipos.filter(e => e.tipo === nombre).length;
  }, [state.equipos]);

  return (
    <ListaItemPanel
      title="Tipos de Equipo"
      items={state.config_listas.tipos_equipo}
      onChange={tipos_equipo => patch({ config_listas: { ...state.config_listas, tipos_equipo } })}
      prefix="TE"
      labelField="nombre"
      labelHeader="Tipo"
      countUsage={countUsage}
      usageLabel="equipo(s)"
    />
  );
}
