import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { ListaItemPanel } from './ListItemPanel.tsx';

/** Panel de tipos de equipo (ej: 'Excavación', 'Transporte'); uno usado por alguna máquina no se borra. */
export function TiposEquipoPanel() {
  const { state, patch } = useCivilManager();
  const countUsage = useMemo(() => {
    return (nombre: string) => state.equipos.filter((e) => e.tipo === nombre).length;
  }, [state.equipos]);

  return (
    <ListaItemPanel
      title="Tipos de equipo"
      icon="tipos_de_equipo"
      items={state.config_listas.tipos_equipo}
      onChange={(tipos_equipo) =>
        patch({ config_listas: { ...state.config_listas, tipos_equipo } })
      }
      prefix="TE"
      labelField="nombre"
      labelHeader="Tipo"
      countUsage={countUsage}
      usageLabel="equipo(s)"
    />
  );
}
