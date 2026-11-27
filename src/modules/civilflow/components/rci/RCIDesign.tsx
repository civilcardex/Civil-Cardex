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
import { focusRciInput } from './RCIInputTableScroll.tsx';
import { usePlans } from '../../context/PlansContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { perfilRciDe } from '../../constants/rciCountryStandards.ts';
import {
  loadFromStorage,
  saveToStorage,
  getActiveProyectoId,
} from '../../services/storageService.ts';
import { loadRciDatos, saveRciDatos } from '../../services/projectDataService.ts';
import {
  TRAZOS_PREFIX,
  RCI_ESTADO_VIVO_KEY,
  VISOR_ACTIVE_PLAN_ID_KEY,
} from '../../constants/storage-keys.ts';
import { EV_TRAZOS_SAVED, EV_PLAN_LOADED, emitRciVivoSaved } from '../../utils/fixtureEvents.ts';
import { pisoLbl } from '../../constants/index.ts';
import { extraerGris, mezclarOverrides } from '../../utils/rci/extract.ts';
import { TECHO_DEF } from '../../utils/rci/ExtractNetwork.ts';
import type { PisoRciFuente } from '../../utils/rci/extract.ts';
import { sembrarRci } from '../../utils/rci/RCIRowsModel.ts';
import { SUBS_POR_TAB } from '../../utils/rci/RCIRowsModelExtras.ts';
import { clasificar, compute, num } from '../../lib/rci/index.ts';
import type { CentroRociador, DibujoPiso } from '../../lib/rci/checks.ts';
import type { RciState, TipCalc } from '../../lib/rci/types.ts';
import { escalaDeDoc } from '../../utils/planScale.ts';
import { factorMPorPx } from '../../lib/PlanoEngine/planoCoords.ts';
import { puntoEnORectangulo } from '../../lib/shared/geometry.ts';
import { rociadorFluye } from '../../lib/PlanoEngine/RCIAutoDraw.ts';
import type { DrawingData } from '../../utils/drawingSyncTypes.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';
import {
  AvisosRci,
  NavRciProvider,
  TABS_RCI,
  TabBarRci,
  COLOR_ESTADO,
  type RciCtx,
  type TabRci,
} from './RCIUI.tsx';
import RciInputs from './RCIInputs.tsx';
import { RciTipologias } from './RCITypologies.tsx';
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

/** PAÍS → NORMATIVA (ped. usuario): aplica el marco legal del perfil del país del proyecto
 *  al estado RCI SIEMPRE que meta.pais difiera del país del proyecto (cambiar país ES cambiar
 *  de marco legal). Si coincide no toca nada — lo digitado propio (ocupLocal, artículos
 *  editados) se conserva. Corre en la CARGA del estado (no en un efecto aparte: al montar
 *  estadoRef es null y el efecto aparte no volvería a correr — país nunca aplicado). Corre
 *  también al cambiar el país con el módulo abierto (proy.pais es dep del efecto de carga).
 *  Ej: proyecto 'Perú' con estado CO → codLocal/refRoc/exigeSP/sismo del perfil PE y
 *  meta.pais = 'Perú'; segunda pasada → no-op. */
function aplicarPerfilPais(e: RciState, pais: string | undefined): RciState {
  const nuevo = (pais || 'Colombia').trim();
  const p = perfilRciDe(nuevo);
  if ((e.meta.pais || '').trim() === nuevo) {
    const { exigeSP, exigeRoc, reqSismo } = e.local;
    return {
      ...e,
      local: {
        ...e.local,
        exigeSP: exigeSP === '' || exigeSP == null ? p.exigeSP : exigeSP,
        exigeRoc: exigeRoc === '' || exigeRoc == null ? p.exigeRoc : exigeRoc,
        reqSismo: reqSismo === '' || reqSismo == null ? (p.reqSismo ? 'Sí' : 'No') : reqSismo,
      },
    };
  }
  const L = { ...e.local };
  L.codLocal = p.codLocal;
  L.exigeRoc = p.exigeRoc;
  L.refRoc = p.refRoc;
  L.exigeSP = p.exigeSP;
  L.refSP = p.refSP;
  L.adopNac = p.adopNac;
  L.normElec = p.normElec;
  /* Sísmico: el perfil manda en las dos direcciones — país con regla sísmica la enciende con
   * su norma/parámetro; país sin regla la apaga (antes quedaba encendido del país anterior). */
  L.reqSismo = p.reqSismo ? 'Sí' : 'No';
  if (p.reqSismo) {
    L.normSis = p.normSis || L.normSis;
    L.parSismo = p.parLabel || L.parSismo;
  }
  return { ...e, meta: { ...e.meta, pais: nuevo }, local: L };
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
  const [guiaOpen, setGuiaOpen] = useState(false);
  /** Pestaña activa + la sub-pestaña abierta de cada una (se recuerda al volver). */
  const [tab, setTab] = useState<TabRci>('entradas');
  const [subs, setSubs] = useState<Partial<Record<TabRci, string | null>>>({});
  const estadoRef = useRef<RciState | null>(null);
  const cargadoRef = useRef(false);
  /* Tick que refresca TODO lo leído del doc de trazos cuando el autosave del visor escribe
   * (muros/ramales/rociadores nuevos): sin él «Ramales del piso» y las verificaciones leían el
   * doc rancio de al montar (orig. usuario). Se consume en fuentes/dibujo/rectFuego. */
  const [trazosTick, setTrazosTick] = useState(0);
  useEffect(() => {
    const h = (): void => setTrazosTick((t) => t + 1);
    window.addEventListener(EV_TRAZOS_SAVED, h);
    return () => window.removeEventListener(EV_TRAZOS_SAVED, h);
  }, []);

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
    // ponytail: trazosTick es la dependencia viva (EV_TRAZOS_SAVED del autosave del visor) —
    // sin él, los ramales/muros/rociadores dibujados DESPUÉS de montar RCI no llegaban a
    // «Ramales del piso» ni a las verificaciones (doc rancio, orig. usuario).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, pisos, trazosTick]);

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
      const est = aplicarPerfilPais(sembrarRci(mezcla.estado, proy.nombre), proy.pais);
      estadoRef.current = est;
      setEstado(est);
      cargadoRef.current = true;
      setHuerfanos(
        mezcla.huerfanos.map((h) => {
          const nombre = h.nombre.trim();
          const nombreLegible = nombre && !/^\d+$/.test(nombre) ? ` "${nombre}"` : '';
          return `${TIPO_HUERFANO[h.tipo] || 'El dato'}${nombreLegible} ya no está en el dibujo; sus datos digitados NO se conservan automáticamente. Redibuje el elemento y vuelva a digitarlos.`;
        }),
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
  }, [gris, proy.nombre, proy.pais]);

  /* Persistencia debounced: cada edición recalcula y guarda 600 ms después de la última tecla.
     Espejo LOCAL junto al guardado: el visor (dibujo automático S/L) lee el valor FRESCO de la
     tabla de Pisos del edificio sin esperar la BD. */
  useDebouncedEffect(
    () => {
      const proyectoId = getActiveProyectoId();
      const est = estadoRef.current;
      if (!proyectoId || !est || !cargadoRef.current) return;
      saveToStorage(RCI_ESTADO_VIVO_KEY, est);
      /* El espejo local cambió → el visor re-inyecta Dmuro al motor (motor no lee storage). */
      emitRciVivoSaved();
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
  const planIdActivo = planActivo;
  /* El piso ACTIVO DEL VISOR manda (orig. usuario: el chequeo de muros es del piso donde
   * dibujas) — antes arrancaba con la 1.ª red extraída y el chequeo evaluaba OTRO piso.
   * Se sincroniza al montar y cada vez que el visor carga un piso. */
  useEffect(() => {
    const sync = (): void => {
      const id = localStorage.getItem(VISOR_ACTIVE_PLAN_ID_KEY);
      if (id) setPlanActivo(id);
    };
    sync();
    window.addEventListener(EV_PLAN_LOADED, sync);
    return () => window.removeEventListener(EV_PLAN_LOADED, sync);
  }, []);
  /** Geometría del piso activo para las verificaciones de dibujo (muros vs ramales, ped.
   *  usuario): guías marcadas esMuro + ramales rci del doc de trazos, convertidos px→m con la
   *  escala del doc. Sin piso activo no hay verificación de muros. */
  const dibujo = useMemo<DibujoPiso | null>(() => {
    if (!planIdActivo) return null;
    const doc = loadFromStorage<DrawingData | null>(
      TRAZOS_PREFIX + planIdActivo,
      null,
    ) as unknown as {
      ramales?: Array<{
        id?: string;
        net?: string;
        tipo?: string;
        pts?: number[][];
        accesorioInicio?: string;
        accesorioFin?: string;
        accMed?: Record<string, string>;
      }>;
      guideLines?: Array<{ esMuro?: boolean; pts?: number[][] }>;
    } | null;
    if (!doc) return null;
    const mPorPx = factorMPorPx(escalaDeDoc(planIdActivo) ?? 0.5);
    const conv = (pts: number[][]): number[][] => pts.map(([x, y]) => [x * mPorPx, y * mPorPx]);
    /* Centros REALES de los rociadores (inicio/fin/cuerpo, fluyan o no). Los círculos de radio
       S se trazan sobre estos centros; la verificación de muro mide la perpendicular desde
       cada centro, no desde el ramal. */
    const rocPts: CentroRociador[] = [];
    const tipoDe = (v: string): CentroRociador['tipo'] => {
      const base = v.split('#')[0].replace(/NF$/, '');
      if (base === 'rociadorMontante') return 'montante';
      if (base === 'rociador') return 'colgante';
      return 'otro';
    };
    for (const r of doc.ramales || []) {
      if (r.net !== 'rci' || r.tipo === 'tributario' || !r.pts) continue;
      const id = r.id || '';
      const añadir = (v: string | undefined, pt: number[] | undefined): void => {
        if (!v || !/rociador/i.test(v) || !pt) return;
        const [x, y] = conv([pt])[0];
        rocPts.push({ x, y, tipo: tipoDe(v), fluye: rociadorFluye(v), ramalId: id });
      };
      añadir(r.accesorioInicio, r.pts[0]);
      añadir(r.accesorioFin, r.pts[r.pts.length - 1]);
      for (const [k, v] of Object.entries(r.accMed || {})) {
        const m = k.match(/^accMed(\d+)$/);
        if (m) añadir(v, r.pts[+m[1]]);
      }
    }
    return {
      planId: planIdActivo,
      muros: (doc.guideLines || []).filter((g) => g.esMuro).map((g) => conv(g.pts || [])),
      ramPts: (doc.ramales || [])
        .filter((r) => r.net === 'rci' && r.tipo === 'ramal')
        .map((r) => conv(r.pts || [])),
      rocPts,
    };
    // ponytail: trazosTick es la dependencia viva — el doc se re-lee de localStorage por tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdActivo, trazosTick]);
  /** Rectángulo de fuego DEFINIDO (área esRectFuego del piso activo) para la sub Rociadores →
   *  Rectángulo de fuego: polígono/rociadores en m + conteo real de ramales y rociadores
   *  dentro (ray casting). Presente solo si el usuario lo marcó en el dibujo. */
  const rectFuego = useMemo<NonNullable<RciCtx['rectFuego']> | null>(() => {
    if (!planIdActivo) return null;
    const doc = loadFromStorage<DrawingData | null>(
      TRAZOS_PREFIX + planIdActivo,
      null,
    ) as unknown as {
      ramales?: Array<{
        id?: string;
        net?: string;
        tipo?: string;
        pts?: number[][];
        accMed?: Record<string, string>;
        accesorioInicio?: string;
        accesorioFin?: string;
      }>;
      areas?: Array<{ esRectFuego?: boolean; net?: string; pts?: number[][]; areaM2?: number }>;
    } | null;
    if (!doc) return null;
    const area = (doc.areas || []).find((a) => a.esRectFuego);
    if (!area || !area.pts || area.pts.length < 3) return null;
    const mPorPx = factorMPorPx(escalaDeDoc(planIdActivo) ?? 0.5);
    const conv = (pts: number[][]): number[][] => pts.map(([x, y]) => [x * mPorPx, y * mPorPx]);
    const ptsM = conv(area.pts);
    const rocPts: number[][] = [];
    const ramalesDentro: string[] = [];
    const ramPtsM: number[][][] = [];
    for (const r of doc.ramales || []) {
      if (r.net !== 'rci' || r.tipo === 'tributario' || !r.pts) continue;
      ramPtsM.push(conv(r.pts));
      /* Solo los rociadores que FLUYEN cuentan como «en operación». El centro dentro O sobre el
       * borde del área se considera cubierto (ray casting + tolerancia en el borde). Se incluyen
       * inicio, fin e intermedios (incluidos los auto-dibujados). */
      let rociadoresDentro = 0;
      const posDe = (pt: number[] | undefined): number[] | null => (pt ? conv([pt])[0] : null);
      const suma = (pt: number[] | null): void => {
        if (!pt) return;
        rocPts.push(pt);
        if (puntoEnORectangulo(pt, ptsM)) rociadoresDentro++;
      };
      suma(rociadorFluye(r.accesorioInicio) ? posDe(r.pts[0]) : null);
      suma(rociadorFluye(r.accesorioFin) ? posDe(r.pts[r.pts.length - 1]) : null);
      const acc = r.accMed || {};
      for (const [k, v] of Object.entries(acc)) {
        if (!rociadorFluye(v)) continue;
        const m = k.match(/^accMed(\d+)$/);
        const idx = m ? +m[1] : -1;
        suma(posDe(r.pts[idx]));
      }
      if (rociadoresDentro > 0 && r.id) ramalesDentro.push(r.id);
    }
    return { ptsM, areaM2: area.areaM2 ?? 0, rocPts, ramalesDentro, ramPtsM };
    // ponytail: trazosTick vive — relectura de localStorage por tick (doc fresco).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdActivo, trazosTick]);
  const R = useMemo(
    () => (estado && tips ? compute(estado, tips, dibujo ?? undefined) : null),
    [estado, tips, dibujo],
  );

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

  const idxActivo = planIdActivo ? idxPorPlanId.get(planIdActivo) : undefined;
  /** Abrevia el nombre de piso para las etiquetas de ramal: «Piso 1» → «P1», «Sótano 1» → «S1». */
  const sufijoDePiso = (nom: string): string => {
    const m = /^Piso (\d+)$/.exec(nom);
    if (m) return `P${m[1]}`;
    const so = /^Sótano (\d+)$/.exec(nom);
    if (so) return `S${so[1]}`;
    return nom === 'Cubierta' ? 'C' : nom;
  };
  /* La tipología activa es UNA sola para Criterios, Rectángulo e Hidráulica (ped. plan
   *  2026-11-27): sale de pisos.activa, no del piso del visor. Hidráulica calcula sobre el
   *  piso REPRESENTATIVO de esa tipología (su red es la que se pinta y edita). */
  const tipActivo: TipCalc | null = R ? (R.edif.active ?? null) : null;
  const planCalculo = tipActivo ? tipActivo.g.planta : planIdActivo;
  const idxCalculo = tipActivo ? tipActivo.g.rep : (idxActivo ?? null);
  const pisoSufijo = sufijoDePiso(
    idxCalculo != null ? String(estado?.pisos.rows[idxCalculo]?.nombre ?? '') : '',
  );
  const redActiva = planCalculo && estado ? estado.redes[planCalculo] : undefined;
  const grisRed = planCalculo ? gris.estado.redes[planCalculo] : undefined;
  const pisoNombre =
    idxCalculo != null
      ? String(estado?.pisos.rows[idxCalculo]?.nombre ?? 'Piso')
      : planIdActivo
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

  /* Sincronía inversa: si el visor/RCI cambia el PISO activo (p. ej. al cargar otro plano),
     la tipología activa pasa a ser la de ESE piso. Así «Piso 1» y «T2 · Piso 2» no quedan
     descuadrados al abrir el proyecto. */
  useEffect(() => {
    if (!planIdActivo || !tips) return;
    const idx = idxPorPlanId.get(planIdActivo);
    const tipId = idx !== undefined ? tips.tipOf[idx] : null;
    if (tipId && estadoRef.current && estadoRef.current.pisos.activa !== tipId) {
      editar((e) => ({ ...e, pisos: { ...e.pisos, activa: tipId } }));
    }
  }, [planIdActivo, tips, idxPorPlanId, editar]);

  /** Seleccionar TIPOLOGÍA mueve también el «Piso activo» al piso representativo de esa
   *  tipología: los dos desplegables siempre apuntan al mismo piso/red. */
  const seleccionarTipologia = (id: string): void => {
    const g = tips?.groups.find((x) => x.id === id);
    const idx = g ? g.rep : null;
    const fila = idx !== null ? estado?.pisos.rows[idx] : null;
    const pid = String(fila?.planId || g?.planta || '');
    if (pid) setPlanActivo(pid);
    if (estadoRef.current?.pisos.activa !== id) {
      editar((e) => ({ ...e, pisos: { ...e.pisos, activa: id } }));
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
        if (campo && focusRciInput(campo)) return;
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
  const ctx: RciCtx = {
    estado,
    R,
    tips,
    edit: false,
    editar,
    seleccionarTipologia,
    rectFuego: rectFuego ?? undefined,
  };
  const avisosGris = gris.avisos.map((a) => `${a.piso}: ${a.msg}`);
  const noCumplen = R.count['NO CUMPLE'] || 0;
  /* El selector de piso activo vive donde el contenido depende del piso: desde Hidráulica en
   * adelante (ped. usuario 2026-11-18 — en Tipologías la tabla ya muestra todos los pisos y
   * el desplegable sobra allí; el rectángulo de fuego por piso se elige en su subpestaña).
   * Entradas y Tipologías muestran TODOS los pisos, ahí el desplegable no aplica. */
  const idxTab = TABS_RCI.findIndex((t) => t.id === tab);
  const idxHid = TABS_RCI.findIndex((t) => t.id === 'hidraulica');
  const verPiso = idxTab >= idxHid;

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
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
      >
        {/* Fila superior: las PÁGINAS centradas (mismo patrón que las otras redes); los CHIPS
         *  de verificaciones al MISMO NIVEL a la derecha (ped. usuario 2026-11-17). Ya NO
         *  absolute (2026-11-23): con la banda partida en dos filas quedaban ENCIMA de las
         *  pestañas (captura portátil) — ahora viven en el flujo flex y nunca tapan nada. */}
        {/* Guía de diseño: la PESTAÑA abre el MODAL (ped. usuario: se comporta como modal,
         *  no como página) — la pestaña activa NO cambia. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TabBarRci
              tab={tab}
              setTab={(t) => {
                if (t === 'guia') {
                  setGuiaOpen(true);
                  return;
                }
                irA(t);
              }}
              noCumplen={noCumplen}
            />
          </div>
          <button
            type="button"
            onClick={() => irA('verificaciones', 'todas')}
            title="Estado de las verificaciones — clic para verlas"
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: 5,
              alignItems: 'center',
              border: 0,
              background: 'none',
              cursor: 'pointer',
              padding: '0 4px',
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
        {/* Segunda fila (sección piso activo): Guía · pisos · avisos del merge */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '0 0',
          }}
        >
          {verPiso ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
                PISO ACTIVO
              </span>
              {/* Desplegable (ped. usuario): con muchos pisos los chips no caben en la fila. Solo
                  en las páginas que calculan por piso (posteriores a Rociadores). */}
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
                  {fuentes
                    .toSorted((x, y) => y.npt - x.npt)
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
            </>
          ) : null}
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
        </div>
        {/* Contenido de la pestaña activa (cada página maneja sus sub-pestañas verticales). */}
        <div data-rci-tab-content className="cf-network-sheet" style={{ paddingRight: 2 }}>
          {tab === 'entradas' ? <RciInputs ctx={ctx} /> : null}
          {tab === 'tipologias' ? <RciTipologias ctx={ctx} /> : null}
          {tab === 'hidraulica' ? (
            <RciHidraulica
              ctx={ctx}
              planId={planCalculo || null}
              pisoLbl={pisoSufijo}
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
