/**
 * Extractor RCI (Red Contra Incendio): convierte los trazos dibujados (red RCI del PlanoEngine)
 * al estado del motor de cálculo `RciState` — la parte "gris con candado" — y conserva lo
 * "amarillo" (lo digitado por el diseñador) al re-exportar.
 *
 * extraerGris lee por piso el doc de trazos (el que vive en `TRAZOS_PREFIX + plano.id`; el
 * consumidor UI lo carga como hace GasDesign: `loadFromStorage(TRAZOS_PREFIX + plano.id)` y
 * filtra `net === 'rci' && tipo !== 'tributario'` en ramales, `net === 'rci' && tipo ===
 * 'montante'` en bajantes) y arma, para cada piso con trazos RCI: ramales y tramos EN EL ORDEN
 * DEL DIBUJO (el primero es el más remoto — regla HU), nombres generados R1…/T1…, ids ESTABLES
 * `"<planId>|<idTrazo>"` (renombrar en el dibujo cambia `code`, no `id`), nudos A, B, C… desde
 * lo más remoto hasta la derivación (última letra, donde conecta el montante), el tramo hacia la
 * derivación con L = planta + bajada (techo − altDeriv) y sus 2 codos, y los rociadores dibujados
 * por ramal. La red se guarda bajo la clave del planId (id estable del piso); el amarillo de la
 * tipología/clasificación decide después qué red usa cada tipología.
 *
 * mezclarOverrides(gris, prev) re-arma el estado completo: lo gris se re-extrae (geometría) y lo
 * amarillo sobrevive POR ID ESTABLE (nunca por nombre — renombrar en el plano no pierde datos),
 * incluidas las claves de red que la UI edita (raiz, zRam, cotas de nudos) y el orden manual de
 * los ramales. Todo id del prev que quede sin dueño en el gris se reporta en `huerfanos` (con
 * sus datos, para que la UI avise y permita rescatarlo) — jamás se borra en silencio.
 *
 * Simplificaciones Fase 1 (documentadas): techo 5.30 m por defecto (la tipología lo pasará vía
 * `opciones.techo`); el tronco es lineal (si se ramifica se toma la ruta más larga y se avisa);
 * un ramal se conecta donde su punta toca el tronco, o hereda el nudo del ramal ya conectado con
 * el que toca (cadena ramal→ramal); la tee con giro la lleva el elemento ENTRANTE al nudo (su
 * flujo gira) salvo que el dibujo ya traiga una tee en ese vértice; la derivación no lleva
 * auto-tee; un tronco sin un solo nudo de ramales no se exporta (aviso).
 */

import { ESP_DEF } from '../../lib/rci/tables.ts';
import type {
  MontCfg,
  MontanteCfg,
  PisoRow,
  RciGabinete,
  RciState,
  Red,
  TuberiaRow,
} from '../../lib/rci/types.ts';
import type { DrawingData } from '../drawingSyncTypes.ts';
import { extraerRedDePiso, ALT_DERIV_DEF, MAT_DEF, TECHO_DEF } from './ExtractNetwork.ts';
import type { AvisoRci } from './ExtractNetwork.ts';

export type { AvisoRci } from './ExtractNetwork.ts';

/** Versión del formato de extracción/mezcla: súbelo cuando cambie la forma del estado gris. */
export const RCI_FORMAT_VERSION = 1;

/** Un piso del proyecto con sus trazos: el consumidor lee el doc del storage
 *  (`TRAZOS_PREFIX + planId`) y pasa { id, label, npt } reales del plano. */
export interface PisoRciFuente {
  /** Id del plano: la identidad ESTABLE del piso (renombrar el piso no la cambia). */
  planId: string;
  /** Nombre real del piso (el que muestra el proyecto). */
  label: string;
  /** NPT (Nivel de Piso Terminado) del piso, en m. */
  npt: number;
  /** Doc de trazos del piso (crudo, tal como lo devuelve loadFromStorage). */
  doc: DrawingData | null;
}

/** Opciones de extracción: la tipología (fase siguiente) pasará aquí su techo real. */
export interface OpcionesExtract {
  /** Altura del techo en m sobre el NPT; 5.3 por defecto en Fase 1. */
  techo?: number;
}

/** Lo que el dibujo dijo del montante de derivación; null = el dibujo no lo trae (al mezclar
 *  sobrevive lo digitado). Ej: { altDeriv: 2.8 } cuando la Fase 2 escriba altDeriv en el montante. */
export interface MontDibujo {
  mat: string | null;
  dn: string | null;
  altDeriv: number | null;
}

/** Lo que extraerGris produce: el estado gris completo + lo que el dibujo dijo del montante. */
export interface GrisRci {
  /** RciState con la parte gris llena y lo amarillo en vacíos (listo para mezclar o mostrar). */
  estado: RciState;
  /** Datos del montante leídos del dibujo (lo ausente queda null y sobrevive lo digitado). */
  montDibujo: MontDibujo;
  /** Gabinetes GABn leídos del dibujo, por planId de piso. La salida de cada piso y la ruta
   *  de montantes/gabinetes nacen de aquí (gris). */
  gabinetes: RciGabinete[];
  /** Avisos para la UI (piso sin montante conectado, tronco ramificado, ramal flotante…). */
  avisos: AvisoRci[];
}

/** Datos digitados que quedaron sin dueño tras re-exportar (la UI avisa, nunca borra en silencio). */
export interface HuerfanoRci {
  /** Qué era: ramal/tramo de una red, un piso, una red entera o un montante. */
  tipo: 'ramal' | 'tramo' | 'piso' | 'red' | 'montante';
  /** Clave de la red dueña (para ramal/tramo/red). */
  red?: string;
  /** Id estable que tenía (fila `id`, planId del piso o clave de la red). */
  id: string;
  /** Nombre que mostraba (para el mensaje de la UI). */
  nombre: string;
  /** La fila digitada completa, por si la UI quiere rescatarla. */
  fila?: TuberiaRow | PisoRow;
}

/** Resultado de mezclarOverrides: el estado completo (gris fresco + amarillo conservado),
 *  la lista de huérfanos y la versión del formato. */
export interface MezclaRci {
  estado: RciState;
  huerfanos: HuerfanoRci[];
  formatVersion: number;
}

/** Extrae la parte "gris con candado" del estado RCI desde los trazos dibujados de cada piso.
 *  Ej: extraerGris([{ planId: '7', label: 'P1', npt: 0, doc }]).estado.redes['7'].ramales[0].dib = 5. */
export function extraerGris(pisos: readonly PisoRciFuente[], opciones?: OpcionesExtract): GrisRci {
  const techo = opciones?.techo ?? TECHO_DEF;
  const avisos: AvisoRci[] = [];

  /* Pisos: uno por plano, ordenados por NPT (el motor los agrupa y calcula en ese orden).
     La SALIDA es GRIS: 'Sí' si el piso tiene gabinete GAB dibujado, 'Ninguna' si no. */
  const filasPiso: (PisoRow & { planId: string })[] = pisos
    .map((p) => ({
      nombre: p.label,
      npt: p.npt,
      planId: p.planId,
      uso: '',
      planta: '',
      riesgo: '',
      sistema: '',
      htecho: '',
      qr: '',
      constr: '',
      techoIncl: '',
      ocultoComb: '',
      K: '',
      S: '',
      L: '',
      salida: 'Ninguna',
      tip: 'auto',
    }))
    .sort((a, b) => a.npt - b.npt);
  const idxPorPlanId = new Map<string, number>();
  filasPiso.forEach((f, i) => idxPorPlanId.set(f.planId, i));

  /* Redes: una por piso con trazos RCI, bajo la clave del planId (id estable del piso).
     El montante activo (Fase 1) = el del primer piso con red extraída. */
  const redes: Record<string, Red> = {};
  const montantes: MontanteCfg[] = [];
  const gabinetes: RciGabinete[] = [];
  const planesConGab = new Set<string>();
  let mont: MontCfg = {
    mat: MAT_DEF,
    dn: 'auto',
    hS: 1.2,
    hD: ALT_DERIV_DEF,
    zBase: 0,
    holgura: 0,
    cuarto: [],
  };
  let montDibujo: MontDibujo = { mat: null, dn: null, altDeriv: null };
  for (const piso of pisos) {
    const rdp = extraerRedDePiso(piso, techo, avisos);
    for (const gab of rdp.gabinetes) {
      gabinetes.push({ ...gab, planId: piso.planId });
      planesConGab.add(piso.planId);
    }
    if (!rdp.red) continue;
    redes[piso.planId] = rdp.red;
    const idx = idxPorPlanId.get(piso.planId);
    montantes.push({
      id: `${piso.planId}|${rdp.idMont}`,
      nombre: rdp.nombreMont,
      pisos: idx === undefined ? [] : [idx],
    });
    if (montantes.length === 1) {
      mont = {
        mat: rdp.matMont || MAT_DEF,
        dn: rdp.dnMont || 'auto',
        hS: 1.2,
        hD: rdp.altDeriv ?? ALT_DERIV_DEF,
        zBase: 0,
        holgura: 0,
        cuarto: [],
      };
      montDibujo = { mat: rdp.matMont || null, dn: rdp.dnMont || null, altDeriv: rdp.altDeriv };
    }
  }
  /* Salida GRIS por piso: con GAB dibujado = 'Sí'. */
  for (const f of filasPiso) if (planesConGab.has(f.planId)) f.salida = 'Sí';

  return {
    estado: estadoVacio(filasPiso, redes, montantes, mont, gabinetes),
    montDibujo,
    gabinetes,
    avisos,
  };
}

/** Estado completo con lo gris lleno y lo amarillo en vacíos (lo rellena el diseñador o el merge). */
function estadoVacio(
  filasPiso: (PisoRow & { planId: string })[],
  redes: Record<string, Red>,
  montantes: MontanteCfg[],
  mont: MontCfg,
  gabinetes: RciGabinete[],
): RciState {
  return {
    meta: { proyecto: '', pais: '', ciudad: '', disenador: '', revision: '' },
    local: {
      codLocal: '',
      ocupLocal: '',
      exigeRoc: '',
      refRoc: '',
      exigeSP: '',
      refSP: '',
      adopNac: '',
      normElec: '',
      reqSismo: '',
      normSis: '',
      parSismo: '',
      zonaSis: '',
      cp: '',
      losaRestr: '',
    },
    clas: {
      almacen: '',
      arrumeH: '',
      riesgo: '',
      sistema: '',
      qr: '',
      htecho: '',
      constr: '',
      techoIncl: '',
      ocultoComb: '',
    },
    roc: { K: '', Pmin: '', S: '', L: '', Dmuro: '' },
    tub: { Vmax: '', Pcomp: '' },
    mang: { mangBomba: '', mangTanque: '', duracion: '' },
    sp: { clase: '', num: '', rociado: '', diam: '', zMinSalida: '' },
    bomba: {
      margen: '',
      qrManual: '',
      fchurn: '',
      etaN: '',
      eta150: '',
      fs: '',
      zFondo: '',
      hmin: '',
      hmax: '',
      matSuc: '',
      dnSuc: '',
      lSuc: '',
      c90: '',
      tee: '',
      comp: '',
      chq: '',
      altitud: '',
      patmManual: '',
      tagua: '',
      npshr: '',
      margenNpsh: '',
      qjockey: '',
    },
    tanque: { vextra: '' },
    sia: {
      n: '',
      entradas: '',
      rosca: '',
      npt: '',
      h: '',
      mat: '',
      dn: '',
      L: '',
      c90: '',
      tee: '',
      chq: '',
      cierre: '',
      drenaje: '',
      hidrante: '',
    },
    inf: { secs: {}, matricula: '', revs: [] },
    montantes,
    redes,
    mont,
    gabinetes,
    esp: ESP_DEF(),
    pisos: {
      zBomba: 0,
      activa: '',
      rep: {},
      estado: {},
      gen: { sot: 0, pis: filasPiso.length, h: 3, hs: 3, z1: 0 },
      rows: filasPiso,
    },
    notas: '',
  };
}

/** Conserva lo digitado: el valor del prev salvo que sea vacío (entonces manda lo gris). */
function siPrev<T>(vPrev: T | undefined, vGris: T): T {
  return vPrev === undefined || vPrev === null || (vPrev as unknown as string) === ''
    ? vGris
    : vPrev;
}

/** Mezcla los nudos de una red: la cota digitada del prev gana en SUS claves (la UI escribe
 *  nodos[raiz].z con "Cota de la derivación") y los nudos nuevos del gris se añaden con la cota
 *  del dibujo (la derivación trae altDeriv; los demás nacen vacíos). Ej: gris {A:{z:''},C:{z:2.5}}
 *  + prev con C=2.9 y sin B → {A:{z:''}, B:{z:''} (nuevo del gris), C:{z:2.9}}. */
function mezclarNodos(grises: Red['nodos'], previos: Red['nodos']): NonNullable<Red['nodos']> {
  const g = grises || {};
  const p = previos || {};
  const sal: NonNullable<Red['nodos']> = {};
  for (const k of Object.keys(g)) sal[k] = { z: siPrev(p[k]?.z, g[k].z ?? '') };
  for (const k of Object.keys(p)) if (!(k in sal)) sal[k] = { ...p[k] };
  return sal;
}

/** Id estable de una fila (campo extra `id`); '' si no lo trae (no se puede emparejar por id). */
function idDe(fila: TuberiaRow | PisoRow): string {
  const v = (fila as { id?: unknown }).id;
  return v === undefined || v === null ? '' : String(v);
}

/** Mezcla lo amarillo del prev sobre el gris recién extraído, POR ID ESTABLE (nunca por nombre):
 *  renombrar en el plano no pierde datos, y todo id del prev sin dueño en el gris se reporta en
 *  `huerfanos` con sus datos (la UI avisa, jamás borra en silencio). Ej: mezclarOverrides(gris,
 *  prev).estado.redes['7'].ramales[0].fluyen === 3 conserva lo digitado. */
export function mezclarOverrides(gris: GrisRci, prev?: RciState | null): MezclaRci {
  const g = gris.estado;
  const huerfanos: HuerfanoRci[] = [];

  /* Secciones 100% amarillas: si el prev las trae, ganan completas. */
  const est: RciState = {
    meta: prev?.meta ?? g.meta,
    local: prev?.local ?? g.local,
    clas: prev?.clas ?? g.clas,
    roc: prev?.roc ?? g.roc,
    tub: prev?.tub ?? g.tub,
    mang: prev?.mang ?? g.mang,
    sp: prev?.sp ?? g.sp,
    bomba: prev?.bomba ?? g.bomba,
    tanque: prev?.tanque ?? g.tanque,
    sia: prev?.sia ?? g.sia,
    inf: prev?.inf ?? g.inf,
    esp: prev?.esp ?? g.esp,
    cmat: prev?.cmat ?? g.cmat,
    auto: prev?.auto,
    notas: prev?.notas ?? g.notas,
    montantes: g.montantes,
    redes: {},
    mont: g.mont,
    gabinetes: g.gabinetes,
    pisos: { ...g.pisos, rows: [] },
  };

  /* Pisos: el gris manda nombre/NPT; el resto del row digitado sobrevive por planId. */
  const prevPisoPorId = new Map<string, PisoRow>();
  for (const f of prev?.pisos?.rows || []) {
    const pid = (f as { planId?: unknown }).planId;
    if (pid !== undefined && pid !== null) prevPisoPorId.set(String(pid), f);
  }
  const planIdsGris = new Set(g.pisos.rows.map((f) => (f as { planId?: string }).planId || ''));
  const filas: PisoRow[] = g.pisos.rows.map((f) => {
    const pid = (f as { planId?: string }).planId || '';
    const p = prevPisoPorId.get(pid);
    return {
      nombre: f.nombre,
      npt: f.npt,
      planId: pid,
      uso: p?.uso ?? f.uso,
      planta: p?.planta ?? f.planta,
      riesgo: p?.riesgo ?? f.riesgo,
      sistema: p?.sistema ?? f.sistema,
      htecho: p?.htecho ?? '',
      qr: p?.qr ?? f.qr,
      constr: p?.constr ?? f.constr,
      techoIncl: p?.techoIncl ?? f.techoIncl,
      ocultoComb: p?.ocultoComb ?? f.ocultoComb,
      K: p?.K ?? '',
      S: p?.S ?? '',
      L: p?.L ?? '',
      /* Salida: el extractor la propone GRIS ('Sí' con GAB dibujado) pero el desplegable de la
       * tabla es EDITABLE de nuevo (ped. usuario) — el valor digitado sobrevive. */
      salida: p?.salida ?? f.salida,
      tip: p?.tip ?? 'auto',
      vreg: p?.vreg,
      vrp: p?.vrp,
    };
  });
  for (const [pid, f] of prevPisoPorId) {
    if (!planIdsGris.has(pid)) huerfanos.push({ tipo: 'piso', id: pid, nombre: f.nombre, fila: f });
  }
  est.pisos = {
    zBomba: prev?.pisos?.zBomba ?? g.pisos.zBomba,
    activa: prev?.pisos?.activa ?? g.pisos.activa,
    rep: prev?.pisos?.rep ?? {},
    estado: prev?.pisos?.estado ?? {},
    gen: prev?.pisos?.gen ?? g.pisos.gen,
    rows: filas,
  };

  /* Redes: geometría gris fresca; lo digitado de cada fila sobrevive por id estable, y las
     claves que la UI edita (raiz/zRam con setRedK, cotas con setZRaiz) conservan el prev. */
  const prevRedes = prev?.redes || {};
  for (const key of Object.keys(g.redes)) {
    const grisRed = g.redes[key];
    const prevRed = prevRedes[key];
    est.redes[key] = {
      raiz: siPrev(prevRed?.raiz, grisRed.raiz ?? ''),
      mat: siPrev(prevRed?.mat, grisRed.mat || ''),
      zRam: siPrev(prevRed?.zRam, grisRed.zRam ?? ''),
      nodos: mezclarNodos(grisRed.nodos, prevRed?.nodos),
      ramales: mezclarFilas(
        grisRed.ramales,
        prevRed?.ramales,
        'ramal',
        key,
        huerfanos,
        new Set(grisRed.ramales.map(idDe)),
      ),
      tramos: mezclarFilas(
        grisRed.tramos,
        prevRed?.tramos,
        'tramo',
        key,
        huerfanos,
        new Set(grisRed.tramos.map(idDe)),
      ),
    };
  }
  for (const key of Object.keys(prevRedes)) {
    if (!(key in g.redes)) huerfanos.push({ tipo: 'red', red: key, id: key, nombre: key });
  }

  /* Montantes: lista gris fresca; los del prev sin dueño se reportan. */
  const idsMontGris = new Set(g.montantes.map((m) => m.id));
  for (const m of prev?.montantes || []) {
    if (!idsMontGris.has(m.id)) huerfanos.push({ tipo: 'montante', id: m.id, nombre: m.nombre });
  }

  /* Montante: material/diámetro/altDeriv del dibujo si lo trae; lo demás digitado sobrevive
     (hS, zBase, holgura y el cuarto de bombas son del diseñador). PURGA del fixture antiguo:
     si el cuarto persistido es EXACTAMENTE la fila Base→CB que sembraba el "Nuevo proyecto"
     (sembrarRci ya no la fabrica), se limpia (ped. usuario: nada hardcodeado). */
  const prevMont = prev?.mont;
  /* La fila del fixture COMPLETA (sembrarRci viejo): { ni:'Base', nf:'CB', mat:'Acero SCH 10',
     dn:'auto', L:5, tee:1, comp:1, ret:1, esp:'', zi:0, zf:0 }. Comparar TODOS los campos:
     una fila real del diseñador que empiece Base→CB con L=5 no se purga. */
  const cero = (v: unknown): boolean => v === 0 || v === '0' || v === '';
  const esCuartoFixture = (cuarto: MontCfg['cuarto']): boolean =>
    cuarto.length === 1 &&
    cuarto[0].ni === 'Base' &&
    cuarto[0].nf === 'CB' &&
    cuarto[0].mat === 'Acero SCH 10' &&
    (cuarto[0].dn === 'auto' || cuarto[0].dn === '') &&
    (cuarto[0].L === 5 || cuarto[0].L === '5') &&
    cuarto[0].tee === 1 &&
    cuarto[0].comp === 1 &&
    cuarto[0].ret === 1 &&
    cero(cuarto[0].zi) &&
    cero(cuarto[0].zf) &&
    !cuarto[0].esp &&
    !cuarto[0].leqOtros;
  const cuartoPrev = prevMont?.cuarto;
  est.mont = {
    mat: gris.montDibujo.mat ?? siPrev(prevMont?.mat, g.mont.mat),
    dn: gris.montDibujo.dn ?? siPrev(prevMont?.dn, g.mont.dn),
    hS: prevMont?.hS ?? g.mont.hS,
    hD: gris.montDibujo.altDeriv ?? siPrev(prevMont?.hD, g.mont.hD),
    zBase: prevMont?.zBase ?? g.mont.zBase,
    holgura: prevMont?.holgura ?? g.mont.holgura,
    cuarto: cuartoPrev && !esCuartoFixture(cuartoPrev) ? cuartoPrev : g.mont.cuarto,
  };

  return { estado: est, huerfanos, formatVersion: RCI_FORMAT_VERSION };
}

/** Mezcla una lista de filas (ramales o tramos): geometría, nombres y nudos del gris; lo
 *  digitado del prev (fluyen, diámetro si el dibujo calla, S, especiales…) sobrevive por id.
 *  El ORDEN del prev manda (el diseñador lo fija con moverRamal y el reparto de flujos corre
 *  en orden de array); las filas nuevas del gris entran al final y las del prev cuyo id ya no
 *  existe en el gris se reportan como huérfanos. */
function mezclarFilas(
  grises: TuberiaRow[],
  previas: TuberiaRow[] | undefined,
  tipo: 'ramal' | 'tramo',
  redKey: string,
  huerfanos: HuerfanoRci[],
  idsGris: Set<string>,
): TuberiaRow[] {
  const prevPorId = new Map<string, TuberiaRow>();
  for (const f of previas || []) {
    const id = idDe(f);
    if (id) prevPorId.set(id, f);
    else huerfanos.push({ tipo, red: redKey, id: '', nombre: String(f.nombre || ''), fila: f });
  }
  const grisPorId = new Map<string, TuberiaRow>();
  for (const grisFila of grises) grisPorId.set(idDe(grisFila), grisFila);
  const mezclada = (grisFila: TuberiaRow): TuberiaRow => {
    const p = prevPorId.get(idDe(grisFila));
    if (tipo === 'ramal') {
      return {
        ...grisFila,
        ini: siPrev(p?.ini, ''),
        fluyen: siPrev(p?.fluyen, ''),
        dn: grisFila.dn && grisFila.dn !== 'auto' ? grisFila.dn : siPrev(p?.dn, 'auto'),
        mat: grisFila.mat || siPrev(p?.mat, ''),
        S: siPrev(p?.S, ''),
        esp: siPrev(p?.esp, ''),
        leqOtros: siPrev(p?.leqOtros, ''),
        mar: siPrev(p?.mar, ''),
        comp: siPrev(p?.comp, ''),
        ret: siPrev(p?.ret, ''),
        troc: siPrev(p?.troc, ''),
        zr: siPrev(p?.zr, ''),
      };
    }
    return {
      ...grisFila,
      mat: grisFila.mat || siPrev(p?.mat, ''),
      dn: grisFila.dn && grisFila.dn !== 'auto' ? grisFila.dn : siPrev(p?.dn, 'auto'),
      esp: siPrev(p?.esp, ''),
      leqOtros: siPrev(p?.leqOtros, ''),
      mar: siPrev(p?.mar, ''),
      comp: siPrev(p?.comp, ''),
      ret: siPrev(p?.ret, ''),
    };
  };
  const salidas: TuberiaRow[] = [];
  for (const [id] of prevPorId) {
    const grisFila = grisPorId.get(id);
    if (grisFila) salidas.push(mezclada(grisFila));
  }
  for (const grisFila of grises) {
    if (!prevPorId.has(idDe(grisFila))) salidas.push(mezclada(grisFila));
  }
  for (const [id, f] of prevPorId) {
    if (!idsGris.has(id))
      huerfanos.push({ tipo, red: redKey, id, nombre: String(f.nombre || ''), fila: f });
  }
  return salidas;
}
