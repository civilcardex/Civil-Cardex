import { perfilDe, type PerfNormas } from '../../constants/normasPais';
import { useProyecto } from '../../context/ProjectContext';

// País del proyecto → notas normativas de los visores 3D de isometría (orig. usuario: donde la
// norma es POR PAÍS y no universal, la nota cita la del país del proyecto; NFPA/UL/ISO quedan
// como internacionales). Sin país en el proyecto → Colombia (comportamiento histórico).

/** Perfil normativo del país del proyecto activo. Falla a Colombia si no hay país; requiere
 *  estar bajo ProjectProvider (los 4 visores 3D lo están). */
export function usePerfilIso(): PerfNormas {
  const { proy } = useProyecto();
  return perfilDe(proy?.pais);
}
