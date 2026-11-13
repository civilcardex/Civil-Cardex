import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WorkArea from '../components/WorkAreaCivilFlow.tsx';
import { usePageMeta } from '../../../hooks/usePageMeta.ts';
import { ProjectContext } from '../context/ProjectContext.tsx';
import { PlansContext } from '../context/PlansContext.tsx';
import { fetchProyectos } from '../services/projectsService.ts';
import { getActiveProyectoId, setActiveProyectoId } from '../services/storageService.ts';
import { abrirProyectoDesdeUrl } from '../services/workspaceReset.ts';
import { EnlaceLegacyBanner } from './EnlaceLegacyBanner.tsx';
import { useProyectoCargado } from '../hooks/useProjectLoaded';
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
  const navigate = useNavigate();
  // wantsId crudo (parámetro tal cual llega): distingue "sin parámetro" de "parámetro
  // presente pero no-uuid" (id numérico legacy o basura).
  const wantsId = proyectoId ?? null;
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
  const switchPendiente = wantsId != null && wantsId !== getActiveProyectoId();
  const [switching, setSwitching] = useState(switchPendiente);
  const switchingRef = useRef(false);
  // Un segundo switch en la misma sesión quedaba bloqueado (ref sin reset): al asentarse
  // la URL se permite de nuevo (setState idéntico no re-renderiza, no cascada).
  useEffect(() => {
    if (wantsId == null || wantsId === getActiveProyectoId()) {
      switchingRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSwitching(false);
    }
  }, [wantsId]);

  // SOLO sin parámetro: redirect al uuid del proyecto activo. Con parámetro presente NO se
  // redirige nunca al activo (uuid → switch de abajo; no-uuid → banner de enlace legacy):
  // redirigir abriría el proyecto equivocado sin aviso. Sin datos accesibles la página queda
  // funcional sin redirect (URL limpia es cosmética).
  // navigate SPA y NO window.location.replace: los botones internos (cerrar visor,
  // crear proyecto) llegan aquí con navigate('/civilflowareatrabajo') — un replace
  // recargaba TODO el navegador en pleno trabajo (recarga "de la nada"). El workspace
  // ya está vivo con el proyecto activo; solo se corrige la URL.
  useEffect(() => {
    if (proyectoId != null) return;
    const activeId = getActiveProyectoId();
    if (!activeId) return;
    let alive = true;
    void (async () => {
      try {
        const rows = await fetchProyectos();
        if (!alive) return;
        const found = rows.find((r) => r.id === activeId);
        if (found) navigate(rutaFlow(found.id, tabUrl), { replace: true });
      } catch {
        /* cosmético: sin redirect */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tabUrl viaja en el splat; redirect solo cuando falta proyecto
  }, [proyectoId, navigate]);

  useEffect(() => {
    if (wantsId == null || switchingRef.current) return;
    if (wantsId === getActiveProyectoId()) return;
    switchingRef.current = true;
    void (async () => {
      // Fuera del cuerpo síncrono del efecto (regla set-state-in-effect).
      await Promise.resolve();
      setSwitching(true);
      await abrirProyectoDesdeUrl({
        wantsId,
        pausar: () => {
          projectCtx?.pauseCloudSync();
          plansCtx?.pauseCloudSync();
        },
        resetear: () => {
          plansCtx?.resetPlans();
          projectCtx?.resetToDefaults();
        },
        activar: (id) => setActiveProyectoId(String(id)),
        rutaConId: rutaFlow(wantsId, tabUrl),
        rutaBase: '/civilflowareatrabajo',
      });
    })();
    // El volcado corre una sola vez por id entrante; switchingRef evita re-entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsId]);

  // Hook ANTES de cualquier early return (reglas-de-hooks), incluido el banner legacy de

  // Enlace con id no-uuid (numérico legacy): banner + link al perfil, SIN montar workspace.
  if (enlaceLegacy) return <EnlaceLegacyBanner />;

  // Una sola pantalla percibida al abrir/cambiar proyecto: el Suspense del chunk y estos dos
  // gates usan el mismo texto (antes encadenaban "Cargando planos y redes…" → "Abriendo
  // proyecto…" → "Cargando proyecto…").
  if (switchPendiente || switching || !cargaLista) {
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
