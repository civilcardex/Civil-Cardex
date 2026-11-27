import { useContext } from 'react';
import { useParams } from 'react-router';
import WorkArea from '../components/WorkAreaCivilFlow.tsx';
import { usePageMeta } from '../../../hooks/usePageMeta.ts';
import { ProjectContext } from '../context/ProjectContext.tsx';
import { PlansContext } from '../context/PlansContext.tsx';
import { EnlaceLegacyBanner } from './EnlaceLegacyBanner.tsx';
import { useProyectoCargado } from '../hooks/useProjectLoaded';
import { useProyectoPorUrl } from '../../../hooks/useProyectoPorUrl.ts';
import { parseFlowSplat, rutaFlow } from '../components/workarea/tabRoute.ts';
import { CargandoProyecto } from '../components/shared/LoadingProject';

/** Abre el proyecto del enlace (/civilflowareatrabajo/:id) o el activo si no hay id. Si el id cambió, recarga todo para no mezclar dibujos entre proyectos. Ej: uuid del activo. */
function WorkAreaCivilFlowPage() {
  usePageMeta(
    'Área de trabajo',
    'Área de trabajo de CivilCardex. Diseño de redes hidráulicas, sanitarias, gas, aguas lluvias y equipos a presión.',
  );
  const { '*': splat } = useParams<{ '*': string }>();
  const { proyectoId, tab: tabUrl, legacyId } = parseFlowSplat(splat);
  // Enlace con id no-uuid: el lookup num→uuid es imposible (la columna legacy_num fue
  // dropeada) — banner en vez de abrir el proyecto ACTIVO en silencio (el usuario dibujaría
  // creyendo estar en el proyecto del enlace viejo).
  const enlaceLegacy = legacyId != null;
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);
  // Gate de carga global: no se monta el workspace hasta que planos + trazos + sync + tramos
  // estén listos (las tablas de diseño nacen con datos). Con tope de 10 s — nunca bloquea.
  const { listo: cargaLista } = useProyectoCargado();
  // Switch pendiente evaluado EN RENDER: la URL ya apunta a otro proyecto — nunca montar
  // el workspace del proyecto viejo, aunque el efecto aún no haya arrancado.
  const { switching } = useProyectoPorUrl(proyectoId, (id) => rutaFlow(id, tabUrl), {
    projectCtx,
    plansCtx,
  });

  // Hook ANTES de cualquier early return (reglas-de-hooks), incluido el banner legacy de

  // Enlace con id no-uuid (numérico legacy): banner + link al perfil, SIN montar workspace.
  if (enlaceLegacy) return <EnlaceLegacyBanner />;

  // Una sola pantalla percibida al abrir/cambiar proyecto: el Suspense del chunk y estos dos
  // gates usan el mismo texto (antes encadenaban "Cargando planos y redes…" → "Abriendo
  // proyecto…" → "Cargando proyecto…").
  if (switching || !cargaLista) {
    return <CargandoProyecto />;
  }
  return (
    <main className="h-full">
      <h1 className="sr-only">Área de trabajo</h1>
      <WorkArea tabInicial={tabUrl} />
    </main>
  );
}

export default WorkAreaCivilFlowPage;
