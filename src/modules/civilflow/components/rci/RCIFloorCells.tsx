/** Celdas especiales de la tabla de pisos RCI (Red Contra Incendio) — Tipologías: el **Nivel**
 *  (desplegable con los niveles/pisos del proyecto — value = planId, la llave de la red del
 *  motor; label = nombre del piso) y las Salidas de manguera del montante como desplegable del
 *  catálogo SALIDAS (NFPA 14). Extraídas de RciTipologias por el guard de líneas. Ej:
 *  <NivelCelda edit planta="1690399…" opciones=[{v,l}] set={fn} /> muestra «Piso 1». */
import type { CSSProperties } from 'react';
import { SALIDAS, salidaPorClase } from '../../utils/rci/RCIRowsModel.ts';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';

/** Ayuda de la columna nivel (a una línea): qué elegir y su efecto. La usa el title del th. */
export const AYUDA_NIVEL =
  'Nivel del edificio al que pertenece esta fila: elige el piso (Piso 1, Sótano 1, Cubierta…). El nivel define de qué red dibujada toma sus datos esta tipología y su altura en el perfil de presiones.';

/** Ayuda de la columna salidas (texto PHELP del HTML de referencia, a una línea): qué opción
 *  elegir según la clase del sistema. La usa el title del th. */
export const AYUDA_SALIDA =
  'Salidas de manguera del montante en este piso (NFPA 14): Ninguna = sin salida; 2½" = válvula para bomberos (Clase I); 1½" = gabinete para ocupantes (Clase II); 2½" + 1½" = las dos (Clase III). Genera el montante y su demanda (250 gpm por salida) y dónde van las válvulas reguladoras.';

/** Valor interno de la opción «Auto» del desplegable de salidas (nunca se guarda: el onChange
 *  lo resuelve a salidaPorClase antes de escribir). */
const AUTO_SALIDA = '__auto__';

/** Estilo base de las celdas de esta tabla (mono centrado, tamaño compacto). */
const CELDA: CSSProperties = { ...IN_CELDA, fontSize: 12 };

/** Celda Nivel: desplegable con los niveles del proyecto (value = planId, la llave de la red
 *  del motor — NUNCA se cambia el dato; el label es el nombre del piso). OFF queda
 *  deshabilitado (gris, sin flecha activa). Si la planta de la fila no está entre las opciones
 *  (plan borrado, clave vieja) se inyecta como opción «(huérfano)» para que SIGA visible.
 *  Ej: planta '1690399…' con opciones → «Piso 1». */
export function NivelCelda({
  edit,
  planta,
  opciones,
  set,
}: {
  edit: boolean;
  planta: string;
  /** Opciones del desplegable: value = planId (llave de la red), label = nombre del piso. */
  opciones: { v: string; l: string }[];
  set: (v: string) => void;
}) {
  const opcionesFinal =
    planta && !opciones.some((o) => o.v === planta)
      ? [{ v: planta, l: `${planta} (huérfano)` }, ...opciones]
      : opciones;
  return celdaEditable(
    edit,
    <select
      value={planta}
      onChange={(e) => set(e.target.value)}
      title={AYUDA_NIVEL}
      style={{ ...CELDA, width: 96 }}
    >
      {opcionesFinal.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>,
  );
}

/** Celda Salidas: el desplegable del catálogo SALIDAS (NFPA 14) al activar EDITAR (el gate del
 *  flag local de la tabla — sin flag, la celda queda en lectura); en lectura muestra el valor
 *  actual (o «Ninguna»). La opción «Auto (por clase)» escribe el estándar de la clase activa
 *  (Clase I → 2½", II → 1½", III → las dos) — el mismo default de la siembra. Escribe
 *  pisos.rows[i].salida. Ej: elegir Auto con Clase II deja '1½"'. */
export function SalidaCelda({
  edit,
  salida,
  nombre,
  clase,
  set,
}: {
  edit: boolean;
  salida: string;
  /** Nombre del piso: entra en el aria-label del select. */
  nombre: string;
  /** Clase del sistema (sp.clase): resuelve la opción «Auto (por clase)». */
  clase: string;
  set: (v: string) => void;
}) {
  const valor = salida || 'Ninguna';
  return celdaEditable(
    edit,
    <select
      value={valor}
      onChange={(e) => {
        const v = e.target.value;
        set(v === AUTO_SALIDA ? salidaPorClase(clase) : v);
      }}
      aria-label={`Salida de manguera en ${nombre}`}
      title={AYUDA_SALIDA}
      style={{ ...CELDA, width: 110 }}
    >
      <option value={AUTO_SALIDA}>Auto (por clase)</option>
      {SALIDAS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>,
  );
}
