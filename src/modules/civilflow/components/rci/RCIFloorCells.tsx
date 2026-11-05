/** Celdas especiales de la tabla de pisos RCI (Red Contra Incendio) — Tipologías: el **Nivel**
 *  (desplegable con los niveles/pisos del proyecto — value = planId, la llave de la red del
 *  motor; label = nombre del piso) y las Salidas de manguera del montante (GRIS: la fija el
 *  dibujo — gabinete GAB sí/no). Extraídas de RciTipologias por el guard de líneas. Ej:
 *  <NivelCelda edit planta="1690399…" opciones=[{v,l}] set={fn} /> muestra «Piso 1». */
import type { CSSProperties } from 'react';
import { celdaEditable, IN_CELDA } from './RCIEditableCell.tsx';

/** Ayuda de la columna nivel (a una línea): qué elegir y su efecto. La usa el title del th. */
export const AYUDA_NIVEL =
  'Nivel del edificio al que pertenece esta fila: elige el piso (Piso 1, Sótano 1, Cubierta…). El nivel define de qué red dibujada toma sus datos esta tipología y su altura en el perfil de presiones.';

/** Ayuda de la columna salidas: GRIS — la salida nace del dibujo (un gabinete GAB en el piso).
 *  La usa el title del th. */
export const AYUDA_SALIDA =
  'Salidas de manguera del montante en este piso (NFPA 14): la fija el DIBUJO — Sí cuando este piso tiene un gabinete (GAB) dibujado, Ninguna cuando no. Cada salida aporta 250 gpm (100 en Clase II) a la demanda del montante.';

/** Estilo base de las celdas de esta tabla (mono centrado, tamaño compacto). */
const CELDA: CSSProperties = { ...IN_CELDA, fontSize: 13 };

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

/** Celda Salidas: GRIS (solo lectura) — la salida la fija el DIBUJO (ped. usuario): 'Sí' si el
 *  piso tiene gabinete GAB dibujado, 'Ninguna' si no (la escribe el extractor). Ej: 'Sí'. */
export function SalidaCelda({ salida }: { salida: string }) {
  const valor = salida || 'Ninguna';
  return (
    <span
      title={`${AYUDA_SALIDA} — se fija con un gabinete (GAB) dibujado en el plano de ese piso`}
      style={{
        fontSize: 13,
        fontFamily: 'var(--mono)',
        color: 'var(--txt3)',
        background: 'var(--bg3)',
        border: '1px solid var(--line)',
        borderRadius: 2,
        padding: '1px 6px',
        display: 'inline-block',
        minWidth: 44,
        textAlign: 'center',
      }}
    >
      {valor === 'Ninguna' ? 'Ninguna' : valor}
    </span>
  );
}
