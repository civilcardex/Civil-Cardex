/** Pantalla de diseño de la red contra incendio (RCI), con el layout del HTML de referencia:
 *  barra superior (Guía · piso activo · estado), pestañas horizontales y cada página con
 *  sub-pestañas verticales. Conecta el dibujo con el motor: (1) extrae la parte GRIS de los
 *  trazos RCI (extraerGris), (2) mezcla lo AMARILLO digitado que sobrevivió en BD
 *  (mezclarOverrides por id estable), (3) calcula (clasificar + compute) y (4) guarda con
 *  debounce (saveRciDatos). La edición va POR TABLA (useEditarTabla + EditTablaBtn de cada
 *  GrupoTabla/tabla), sin EDITAR global. Ej: al marcar "Fluyen" en un ramal, la derivación y la
 *  bomba se recalculan al instante y quedan guardadas. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedEffect } from '../../../../hooks/useDebouncedEffect.ts';
import { usePlans } from '../../context/PlansContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { loadFromStorage, getActiveProyectoId } from '../../services/storageService.ts';
import { loadRciDatos, saveRciDatos } from '../../services/projectDataService.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { pisoLbl } from '../../constants/index.ts';
import { extraerGris, mezclarOverrides } from '../../utils/rci/extract.ts';
import { TECHO_DEF } from '../../utils/rci/ExtractNetwork.ts';
import type { PisoRciFuente } from '../../utils/rci/extract.ts';
import { sembrarRci } from '../../utils/rci/RCIRowsModel.ts';
import { SUBS_POR_TAB } from '../../utils/rci/RCIRowsModelExtras.ts';
import { clasificar, compute, num } from '../../lib/rci/index.ts';
import type { RciState, TipCalc } from '../../lib/rci/types.ts';
import type { DrawingData } from '../../utils/drawingSyncTypes.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';
import {
  AvisosRci,
  NavRciProvider,
  TabBarRci,
  COLOR_ESTADO,
  type RciCtx,
  type TabRci,
} from './RCIUI.tsx';
import RciInputs from './RCIInputs.tsx';
import { RciTipologias } from './RCITypologies.tsx';
import { RciRociadores } from './RCISprinklers.tsx';
import { RciHidraulica } from './RCIHydraulics.tsx';
import RciGabinetes from './RCICabinets.tsx';
import RciPerfil from './RCIProfile.tsx';
import { RciBombaTanque } from './RCIPumpTank.tsx';
import { RciSismo } from './RCISeismic.tsx';
import { RciVerificaciones } from './RCIChecks.tsx';
import RciGuiaModal from './RCIGuideModal.tsx';
import AccesoriosDiamPage from '../FittingsDiamPage.tsx';

/** Rótulo legible de un huérfano del merge (dato digitado cuyo dibujo dejó de existir). */
const TIPO_HUERFANO: Record<string, string> = {
  ramal: 'El ramal',
  tramo: 'El tramo',
  piso: 'El piso',
  red: 'La red',
  montante: 'El montante',
};

/** Primera sub-pestaña visible de una pestaña (default al entrar sin destino). */
function primeraSub(tab: TabRci): string | null {
  const subs = SUBS_POR_TAB[tab];
  return subs && subs.length ? subs[0].id : null;
}

/** Componente raíz (el export default): monta el shell de pestañas y corre en vivo el ciclo
 *  extraer → mezclar → calcular → guardar que describe la cabecera. Ej: <RciDesign /> extrae
 *  los pisos confirmados al montar y recalcula la bomba al marcar "Fluyen" en un ramal. */
function RciDesign() {
  const { plans } = usePlans();
  const { pisos, proy } = useProject();
  /** Estado RCI vivo (gris + amarillo); null hasta la primera carga+mezcla. */
  const [estado, setEstado] = useState<RciState | null>(null);
  /** Piso activo (planId): gobierna las secciones de rociadores e hidráulica. */
  const [planActivo, setPlanActivo] = useState<string | null>(null);
  /** Mensajes de huérfanos del último merge (avisos, jamás borrado silencioso). */
  const [huerfanos, setHuerfanos] = useState<string[]>([]);
  /** Pestaña activa + la sub-pestaña abierta de cada una (se recuerda al volver). */
  const [tab, setTab] = useState<TabRci>('entradas');
  const [subs, setSubs] = useState<Partial<Record<TabRci, string | null>>>({});
  const [guiaOpen, setGuiaOpen] = useState(false);
  const estadoRef = useRef<RciState | null>(null);
  const cargadoRef = useRef(false);

  /** Fuentes por plano confirmado: label y NPT del piso del proyecto + doc de trazos RCI. */
  const fuentes = useMemo<PisoRciFuente[]>(() => {
    const pisoPorNivel = new Map<string, Piso>();
    for (const p of pisos) pisoPorNivel.set(String(p.n), p);
    const out: PisoRciFuente[] = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      const piso = pisoPorNivel.get(String(plano.nivel));
      const doc = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      out.push({
        planId: String(plano.id),
        label: piso ? pisoLbl(piso.n) : plano.name,
        npt: Number(piso?.npt) || 0,
        doc,
      });
    }
    return out;
  }, [plans, pisos]);

  /** Techo (m) con el que se extrae el gris: el de la tipología del piso activo — la misma vía
   *  que RciHidraulica (tip.roc.HtFt/3.28084, que para la tipología ACTIVA es el htecho de
   *  Entradas). Sin estado cargado aún cae al default del extractor (5.3). */
  const techoGris = useMemo(() => num(estado?.clas.htecho) || TECHO_DEF, [estado]);
  // ponytail: con el siPrev del merge, un zRam ya mezclado no sigue al techo cuando la tipología
  // cambia de htecho — limpiar "Cota de los ramales" lo resincroniza con la cota del dibujo.
  /** La parte gris (geometría del dibujo) se re-extrae cuando cambian planos, pisos o el techo. */
  const gris = useMemo(() => extraerGris(fuentes, { techo: techoGris }), [fuentes, techoGris]);

  /* Carga BD + mezcla: al montar y cada vez que el dibujo cambia. Tras la primera carga el
     amarillo VIVO manda de base (el BD puede quedarse detrás del debounce de guardado). */
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadRciDatos(proyectoId).then((prev: RciState | null) => {
      if (cancelled) return;
      const base = cargadoRef.current && estadoRef.current ? estadoRef.current : prev;
      const mezcla = mezclarOverrides(gris, base);
      const est = sembrarRci(mezcla.estado, proy.nombre);
      estadoRef.current = est;
      setEstado(est);
      cargadoRef.current = true;
      setHuerfanos(
        mezcla.huerfanos.map(
          (h) =>
            `${TIPO_HUERFANO[h.tipo] || 'El dato'} "${h.nombre}" ya no está en el dibujo; sus datos quedan guardados y se rescata al redibujarlo.`,
        ),
      );
      setPlanActivo((cur) => {
        if (cur) return cur;
        const claves = Object.keys(est.redes);
        return claves.length ? claves[0] : null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [gris, proy.nombre]);

  /* Persistencia debounced: cada edición recalcula y guarda 600 ms después de la última tecla. */
  useDebouncedEffect(
    () => {
      const proyectoId = getActiveProyectoId();
      const est = estadoRef.current;
      if (!proyectoId || !est || !cargadoRef.current) return;
      void saveRciDatos(proyectoId, est);
    },
    600,
    [estado],
  );

  const editar = useCallback((fn: (e: RciState) => RciState) => {
    const cur = estadoRef.current;
    if (!cur) return;
    const next = fn(cur);
    estadoRef.current = next;
    setEstado(next);
  }, []);

  const tips = useMemo(() => (estado ? clasificar(estado) : null), [estado]);
  const R = useMemo(() => (estado && tips ? compute(estado, tips) : null), [estado, tips]);

  /** Índice de fila por planId (los ids de plano son estables aunque se renombre el piso). */
  const idxPorPlanId = useMemo(() => {
    const m = new Map<string, number>();
    if (!estado) return m;
    estado.pisos.rows.forEach((r, i) => {
      const pid = (r as { planId?: string }).planId;
      if (pid !== undefined && pid !== null) m.set(String(pid), i);
    });
    return m;
  }, [estado]);

  const planIdActivo = planActivo;
  const idxActivo = planIdActivo ? idxPorPlanId.get(planIdActivo) : undefined;
  const tipIdActivo = tips && idxActivo !== undefined ? (tips.tipOf[idxActivo] ?? null) : null;
  const tipActivo: TipCalc | null = R && tipIdActivo ? (R.edif.typ[tipIdActivo] ?? null) : null;
  const redActiva = planIdActivo && estado ? estado.redes[planIdActivo] : undefined;
  const grisRed = planIdActivo ? gris.estado.redes[planIdActivo] : undefined;
  const pisoNombre = planIdActivo
    ? fuentes.find((f) => f.planId === planIdActivo)?.label || 'Piso'
    : '';

  /** Seleccionar piso marca también la tipología activa del cálculo (la que usa Entradas). */
  const elegirPiso = (pid: string) => {
    setPlanActivo(pid);
    const idx = idxPorPlanId.get(pid);
    const tipId = tips && idx !== undefined ? tips.tipOf[idx] : null;
    if (tipId && estadoRef.current && estadoRef.current.pisos.activa !== tipId) {
      editar((e) => ({ ...e, pisos: { ...e.pisos, activa: tipId } }));
    }
  };

  /** Saltador de navegación (Ir al dato / Ir a… de la guía): conmuta pestaña+sub y enfoca el
   *  campo tras el re-render. El foco/scroll corre en el siguiente frame (React ya pintó). */
  const irA = useCallback(
    (destino: TabRci, sub?: string, campo?: string) => {
      setTab(destino);
      const subDestino = sub ?? subs[destino] ?? primeraSub(destino);
      setSubs((prev) => ({ ...prev, [destino]: subDestino }));
      window.setTimeout(() => {
        if (campo) {
          const el = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.focus({ preventScroll: true });
            return;
          }
        }
        // Sin campo conocido: sube al contenido de la pestaña (primer título visible).
        const seccion = document.querySelector<HTMLElement>('[data-rci-tab-content]');
        seccion?.scrollTo({ top: 0 });
      }, 60);
    },
    [subs],
  );
  const subActiva = subs[tab] ?? primeraSub(tab);
  const nav = useMemo(() => ({ tab, sub: subActiva, irA }), [tab, subActiva, irA]);

  if (!estado || !tips || !R) {
    return (
      <div
        role="status"
        style={{ minHeight: 300, padding: 24, color: 'var(--txt2)', fontSize: 13 }}
      >
        Cargando diseño contra incendio…
      </div>
    );
  }

  /* RciCtx exige `edit`: queda fijo en false — la edición por tabla (useEditarTabla propio)
     reemplazó al botón EDITAR global de la barra; nadie ya lee el flag global. */
  const ctx: RciCtx = { estado, R, tips, edit: false, editar };
  const avisosGris = gris.avisos.map((a) => `${a.piso}: ${a.msg}`);
  const noCumplen = R.count['NO CUMPLE'] || 0;

  /** Conteo por estado para el chip resumen de la barra (clic → Verificaciones/Todas). */
  const conteo: { st: string; n: number }[] = ['CUMPLE', 'NO CUMPLE', 'REVISAR', 'PENDIENTE'].map(
    (st) => ({
      st,
      n: R.count[st] || 0,
    }),
  );

  return (
    <NavRciProvider nav={nav}>
      <div
        className="fu"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}
      >
        {/* Fila superior: las PÁGINAS centradas (mismo patrón que las otras redes). */}
        <TabBarRci tab={tab} setTab={(t) => irA(t)} noCumplen={noCumplen} />
        {/* Segunda fila (sección piso activo): Guía · pisos · estado de verificaciones */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '0 0',
          }}
        >
          <button
            type="button"
            onClick={() => setGuiaOpen(true)}
            style={{
              border: '1px solid var(--rci)',
              background: 'var(--rci)',
              color: '#fff',
              borderRadius: 'var(--r)',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--body)',
            }}
            title="Guía de diseño: los 9 pasos del cálculo, con esquemas de su proyecto"
          >
            Guía de diseño
          </button>
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
            PISO ACTIVO
          </span>
          {/* Desplegable (ped. usuario): con muchos pisos los chips no caben en la fila. */}
          {fuentes.length > 0 ? (
            <select
              value={planIdActivo || ''}
              onChange={(e) => elegirPiso(e.target.value)}
              aria-label="Piso activo"
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--r)',
                padding: '3px 8px',
                fontSize: 12,
                fontFamily: 'var(--body)',
                color: 'var(--txt)',
                background: 'var(--bg3)',
                cursor: 'pointer',
              }}
            >
              {[...fuentes]
                .sort((x, y) => y.npt - x.npt)
                .map((f) => (
                  <option key={f.planId} value={f.planId}>
                    {f.label}
                  </option>
                ))}
            </select>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
              Sin planos confirmados: confirme planos para registrar los pisos.
            </span>
          )}
          {/* Avisos del merge CENTRADOS entre los chips de pisos y los de verificaciones
              (ped. usuario): contenedor flex-1 centrado — los extremos quedan anclados. */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <AvisosRci avisos={[...avisosGris, ...huerfanos]} />
          </div>
          <button
            type="button"
            onClick={() => irA('verificaciones', 'todas')}
            title="Estado de las verificaciones — clic para verlas"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 5,
              alignItems: 'center',
              border: 0,
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {conteo
              .filter((c) => c.n > 0)
              .map((c) => (
                <span
                  key={c.st}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    padding: '1px 7px',
                    borderRadius: 9,
                    color: COLOR_ESTADO[c.st],
                    border: `1px solid ${COLOR_ESTADO[c.st]}`,
                  }}
                >
                  {c.n} {c.st === 'CUMPLE' ? 'cumplen' : c.st.toLowerCase()}
                </span>
              ))}
          </button>
        </div>
        {/* Contenido de la pestaña activa (cada página maneja sus sub-pestañas verticales). */}
        <div
          data-rci-tab-content
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}
        >
          {tab === 'entradas' ? <RciInputs ctx={ctx} /> : null}
          {tab === 'rociadores' ? <RciRociadores ctx={ctx} /> : null}
          {tab === 'tipologias' ? <RciTipologias ctx={ctx} /> : null}
          {tab === 'hidraulica' ? (
            <RciHidraulica
              ctx={ctx}
              planId={planIdActivo}
              tip={tipActivo}
              red={redActiva}
              grisRed={grisRed}
            />
          ) : null}
          {tab === 'gabinetes' ? <RciGabinetes ctx={ctx} /> : null}
          {tab === 'perfil' ? <RciPerfil ctx={ctx} /> : null}
          {tab === 'bomba' ? <RciBombaTanque ctx={ctx} /> : null}
          {tab === 'sismo' ? <RciSismo ctx={ctx} /> : null}
          {tab === 'accesorios' ? <AccesoriosDiamPage net="rci" /> : null}
          {tab === 'verificaciones' ? <RciVerificaciones ctx={ctx} /> : null}
        </div>
      </div>
      {guiaOpen ? (
        <RciGuiaModal ctx={ctx} pisoNombre={pisoNombre} onClose={() => setGuiaOpen(false)} />
      ) : null}
    </NavRciProvider>
  );
}

export default RciDesign;
