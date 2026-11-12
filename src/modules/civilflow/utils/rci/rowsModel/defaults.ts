/** Catálogos de los desplegables del diseño RCI (las opciones que ofrecen los select) y la
 *  siembra de los amarillos de un proyecto nuevo. Puro: sin React ni storage.
 *  Ej: RIESGOS[0] = 'Riesgo leve' (la primera opción del select de riesgo). */

import { HZ, NOM, PIPES } from '../../../lib/rci/tables.ts';
import type { PisoRow, RciState, Red } from '../../../lib/rci/types.ts';

/* ============================ Catálogos de los desplegables ============================ */

/** Sí/No tal como lo guardan los selectores del motor (isSi lee exactamente "Sí"). */
export const SINO = ['Sí', 'No'] as const;
/** Decisión por piso: auto la calcula el motor, Sí/No la fuerza el diseñador. */
export const AUTO_SI_NO = ['auto', 'Sí', 'No'] as const;
/** Sistemas de NFPA 13 que cubre el cálculo. */
export const SISTEMAS = ['Húmedo', 'Seco'] as const;
/** Clasificaciones de riesgo (la llave de HZ) + pisos sin rociadores. */
export const RIESGOS: string[] = [...Object.keys(HZ), 'Sin rociadores'];
/** Construcción del techo (define la cobertura máxima en riesgo leve). */
export const CONSTR_OPCIONES = [
  'No combustible / no obstruida',
  'Combustible obstruida',
  'Combustible, elementos < 0,91 m',
] as const;
/** Clases de sistema de montantes (NFPA 14). */
export const CLASES_SP = ['Clase I', 'Clase II', 'Clase III'] as const;
/** Materiales comerciales (la llave de PIPES). */
export const MATERIALES: string[] = Object.keys(PIPES);
/** Diámetros nominales comerciales, con "auto" primero (el motor elige por velocidad). */
export const DIAMETROS = ['auto', ...NOM] as const;
/** Zonas de amenaza sísmica; vacío = auto con el perfil del país. */
export const ZONAS_SIS = ['', 'Baja', 'Intermedia', 'Alta'] as const;

/* ============================ Semillas del proyecto nuevo ============================ */

/** ¿El campo NumIn/texto está sin llenar? ("" / null / undefined). */
const vacio = (v: unknown): boolean => v === '' || v === null || v === undefined;

/**
 * Siembra los amarillos de un estado recién extraído con los valores del "Nuevo proyecto" del
 * HTML de referencia (los mismos defaults: riesgo leve, húmedo, K 5.6, S×L 4.30×3.53…) y mapea
 * cada piso a la red extraída de SU plano (planta = planId). Solo llena lo VACÍO: los datos
 * digitados jamás se tocan (idempotente — llamar tras cada mezcla es seguro).
 * OJO: el motor lee la planta del piso en MAYÚSCULAS para buscar la red (st.redes[planta]);
 * los planIds del proyecto son numéricos (invariantes a mayúsculas), así que planta = planId
 * siempre matchea la clave que el extractor puso en st.redes.
 * Ej: sembrarRci(estadoVacio, 'Torre Norte').clas.riesgo = 'Riesgo leve'.
 */
export function sembrarRci(est: RciState, metaProyecto = ''): RciState {
  let cambio = false;
  const graba = <T>(actual: T, defecto: T): T => {
    if (!vacio(actual)) return actual;
    if (vacio(defecto)) return actual;
    cambio = true;
    return defecto;
  };

  const meta = {
    ...est.meta,
    proyecto: graba(est.meta.proyecto, metaProyecto),
  };
  const local = { ...est.local };
  const clas = {
    ...est.clas,
    /* Categóricos con default de referencia (el cálculo necesita riesgo/sistema); los
     * NUMÉRICOS y BOOLEANOS nacen VACÍOS (ped. usuario) — el motor los resuelve con sus
     * defaults de norma al calcular y el diseñador los digita donde importa. */
    riesgo: graba(est.clas.riesgo, 'Riesgo leve'),
    sistema: graba(est.clas.sistema, 'Húmedo'),
  };
  const roc = { ...est.roc };
  const tub = { ...est.tub };
  const mang = { ...est.mang };
  const sp = {
    ...est.sp,
    clase: graba(est.sp.clase, 'Clase III'),
  };
  const sia = { ...est.sia };
  const bomba = { ...est.bomba };
  /* Cuarto de bombas SIN seed (ped. usuario: nada fabricado) — el diseñador llena la fila
   * Base→CB en Entradas → Selección de bomba. */
  const mont = { ...est.mont };

  /* Por piso SOLO se siembra la planta (mapeo piso→red, ver doc de arriba) y la DMR (distancia
   * máxima de rociador a muro): los criterios, la salida y la tipología NO se copian — la salida
   * la fija el dibujo (gabinetes GAB) y lo demás lo digita el diseñador (ped. usuario: nada
   * fabricado). La DMR nace con la global del proyecto para que los proyectos viejos muestren en
   * Pisos del edificio el valor que el motor ya aplica. */
  const rows = est.pisos.rows.map((r) => {
    let fila = r;
    if (vacio(r.planta)) {
      cambio = true;
      const planId = String((r as PisoRow & { planId?: string }).planId || '');
      fila = { ...fila, planta: planId || 'A' };
    }
    if (vacio(r.Dmuro) && !vacio(roc.Dmuro)) {
      cambio = true;
      fila = { ...fila, Dmuro: roc.Dmuro };
    }
    return fila;
  });

  /* Material de cada red (el selector "Material de los ramales" del HTML, amarillo): si el
     dibujo no trae material en los trazos, el motor no encuentra diámetro para los tramos —
     se siembra el de referencia y las filas vacías heredan el de su red. Si luego se dibuja
     un material, el gris manda sobre el sembrado (mezclarOverrides). */
  const redes: Record<string, Red> = {};
  let redesCambio = false;
  for (const [clave, red] of Object.entries(est.redes)) {
    const matRed = vacio(red.mat) ? 'Acero SCH 40' : red.mat;
    let nFilas = 0;
    const ramales = red.ramales.map((r) => {
      if (!vacio(r.mat)) return r;
      nFilas++;
      return { ...r, mat: matRed };
    });
    const tramos = red.tramos.map((t) => {
      if (!vacio(t.mat)) return t;
      nFilas++;
      return { ...t, mat: matRed };
    });
    const cambioRed = vacio(red.mat) || nFilas > 0;
    if (cambioRed) {
      cambio = true;
      redesCambio = true;
      redes[clave] = { ...red, mat: matRed, ramales, tramos };
    } else {
      redes[clave] = red;
    }
  }

  if (!cambio) return est;
  return {
    ...est,
    meta,
    local,
    clas,
    roc,
    tub,
    mang,
    sp,
    sia,
    bomba,
    mont,
    ...(redesCambio ? { redes } : {}),
    pisos: { ...est.pisos, rows },
  };
}
