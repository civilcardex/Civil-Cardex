// Tipos, helpers de columna de aparato, formato y estilos compartidos de la tabla Rejillas.
import React from 'react';
import { devError } from '../../../../utils/devError';
import { CAT_GAS } from '../../constants/engineeringDataGas';
import type { GrupoGasod } from '../../constants/rejillasNTC3631';
import { APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { fmt } from '../../utils/formatUtils';
import type { RejOverride } from './rejillasStorage';

/** Índice id→entrada del catálogo NTC 3728: la potencia de cada aparato es fija (no editable). */
export const CAT_GAS_BY_ID = new Map(CAT_GAS.map((c) => [c.id, c]));

/** Alias de ids de APARATOS_DEF → ids de CAT_GAS (históricos: el catálogo llama
 *  distinto a las secadoras, sauna y baño turco). */
export const ALIAS_CAT_GAS: Record<string, string> = {
  sec_g: 'srg',
  sec_p: 'srp',
  sauna: 'bs',
  turco: 'bt',
};
// Formato numérico de la tabla: punto decimal y 2 decimales (redondeado), igual que el resto
// de las tablas de diseño (antes: toLocaleString es-CO con coma).
export const num = (x: number | undefined | null, d = 2) => fmt(+(x ?? 0) || 0, d);

/** Fila de la tabla Tipologías: sector del dibujo + overrides + columnas de aparato. */
export interface RejFila {
  key: string;
  areaId: string;
  planId: string;
  planLbl: string;
  sector: string;
  apto: string;
  piso: string;
  areaM2: number;
  altoM: number;
  mono: boolean;
  sol: string;
  vadj: number;
  padj: number;
  aconec: number;
  /** Columnas de aparato: uno por id asignado + slots vacíos extra (＋ del título). */
  aparatos: Array<{
    id: string;
    cant: number;
    /** kW fijo del catálogo NTC 3728 según el tipo de gas del proyecto (no editable). */
    kw: number;
    tipo: 'A' | 'B' | 'C';
    clave: string;
    vacio: boolean;
  }>;
}

/** Cambia el aparato de una columna: consume el slot si estaba vacío o reemplaza el id
 *  en su clave de origen conservando la cantidad (bidireccional con el visor). */
export function onAparatoCol(
  f: RejFila,
  colIdx: number,
  nuevoId: string,
  setOv: (key: string, patch: RejOverride) => void,
): void {
  const col = f.aparatos[colIdx];
  if (!col || col.id === nuevoId) return;
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[col.clave] || {}) };
    // No pisar un aparato ya presente en el sector: alerta y fuera, sin tocar disco.
    if (nuevoId && cur[nuevoId] !== undefined) {
      window.alert('Ese aparato ya existe en este sector');
      return;
    }
    if (col.vacio) {
      // El slot sintético se consume (→ columna real si eligen aparato, se libera si "— etc —").
      setOv(f.areaId, {
        slotsExtra: Math.max(0, (f.aparatos.filter((a) => a.vacio).length || 1) - 1),
      });
      if (!nuevoId) return; // nada en disco que tocar al vaciar un slot sin entrada
    }
    delete cur[col.id];
    // Vaciar la columna (— etc —): solo borra el id en su clave, nunca escribe la clave ''.
    if (nuevoId) cur[nuevoId] = col.cant;
    const next = { ...disk };
    if (Object.keys(cur).length === 0) delete next[col.clave];
    else next[col.clave] = cur;
    saveToStorage(APARATOS_BY_TRAMO_KEY, next);
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.onAparatoCol:', e);
  }
}

/** Cantidad exacta de una columna: escribe en su clave de origen (área o ramal). */
export function setCantCol(f: RejFila, colIdx: number, cant: number): void {
  const col = f.aparatos[colIdx];
  if (!col || col.vacio || cant < 0) return;
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[col.clave] || {}) };
    if (cant === 0) delete cur[col.id];
    else cur[col.id] = cant;
    saveToStorage(APARATOS_BY_TRAMO_KEY, { ...disk, [col.clave]: cur });
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.setCantCol:', e);
  }
}

/** Elimina una columna de aparato: libera el slot si estaba vacío; si es un gasodoméstico,
 *  lo quita SOLO en la clave de origen del sector (el sweep del plano entero borraba la
 *  misma columna en otros sectores: pérdida silenciosa). */
export function quitarColumna(
  f: RejFila,
  colIdx: number,
  setOv: (key: string, patch: RejOverride) => void,
): void {
  const col = f.aparatos[colIdx];
  if (!col) {
    devError('RejillasVentilacion.quitarColumna: columna inexistente', colIdx, f.aparatos.length);
    return;
  }
  if (col.vacio) {
    setOv(f.areaId, {
      slotsExtra: Math.max(0, (f.aparatos.filter((a) => a.vacio).length || 1) - 1),
    });
    return;
  }
  const clave = col.clave;
  const id = col.id;
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const cur = { ...(disk[clave] || {}) };
    if (cur[id] === undefined) {
      // La fila de la tabla quedó desalineada del disco: rastro para diagnosticar el "− no hace nada".
      devError('RejillasVentilacion.quitarColumna: id ausente en su clave', clave, id);
      return;
    }
    delete cur[id];
    const next = { ...disk };
    if (Object.keys(cur).length === 0) delete next[clave];
    else next[clave] = cur;
    saveToStorage(APARATOS_BY_TRAMO_KEY, next);
    window.dispatchEvent(new Event('aparatos-clear'));
  } catch (e) {
    devError('RejillasVentilacion.quitarColumna:', e);
  }
}

/** Gasodomésticos por grupo según el aparato (ids de APARATOS_DEF grupo 'g'). */
export function grupoDe(apId: string): GrupoGasod | null {
  if (/^est/.test(apId)) return 'estufa';
  if (/^cal/.test(apId)) return 'calent';
  return 'otros';
}

/** Estado + datos derivados del módulo (compartido por la tabla y la página de alzado). */

export const TD: React.CSSProperties = {
  border: '1px solid var(--line)',
  padding: '2px 5px',
  fontSize: 12.5,
  fontFamily: 'var(--mono)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  color: 'var(--txt)',
};
export const TH: React.CSSProperties = {
  ...TD,
  background: 'var(--bg3)',
  fontWeight: 600,
  fontSize: 11.5,
  color: 'var(--txt3)',
  fontFamily: 'var(--mono)',
  textTransform: 'uppercase',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
  lineHeight: 1.15,
};
/** Sub-título bajo un grupo (fila 2 del encabezado). */
export const THS: React.CSSProperties = { ...TH, fontSize: 11 };
/** Campo editable con el MISMO estilo que las demás tablas de diseño (bg2 + borde line +
 *  radius 2, texto centrado). .no-spin (index.css) oculta las flechas de los number. */
export const INP: React.CSSProperties = {
  width: '100%',
  minWidth: 44,
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt)',
  fontFamily: 'var(--mono)',
  fontSize: 11.5,
  textAlign: 'center',
  padding: '1px 2px',
};
export const SEL: React.CSSProperties = { ...INP, minWidth: 60 };
/** Valor NO editable (patrón Diseño de red sanitario): texto plano hasta activar edición. */
export const TXT: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11.5,
  color: 'var(--txt)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};
export const THG: React.CSSProperties = {
  ...TH,
  fontSize: 12,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  borderBottom: '2px solid var(--line)',
};
