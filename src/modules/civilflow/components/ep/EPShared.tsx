/** Datos del formulario del módulo ep (Equipo de Presión): caudales, alturas y pérdidas,
 *  presiones (mín/máx), geometría de cisterna y parámetros de bomba. Todo texto (campos de
 *  entrada); lo comparten las 3 páginas del módulo (entrada, tanque, verificación). */
import React from 'react';
import { LazyDecimalInput } from '../shared/LazyDecimalInput.tsx';
import { EP_UNI, aMca, esCampoPresion, type EpUn } from './epUnidades.ts';

export interface EPData {
  /** Nombre del proyecto y profesional responsable (bloque 1: alimentan memoria y cajetín). */
  proyecto: string;
  elaborado: string;
  qac: string;
  qasc: string;
  hfac: string;
  hfacs: string;
  hfotros: string;
  pred: string;
  pmin: string;
  pmax: string;
  zbomba: string;
  ztop: string;
  zcis: string;
  hfcis: string;
  nt: string;
  nr: string;
  etab: string;
  etam: string;
  fs: string;
  ciclos: string;
  alfa: string;
  vsuc: string;
  vimp: string;
  dnsuc: string;
  dnimp: string;
  modo: 'red' | 'cisterna';
  pcomercial: string;
  /** Cisterna — volumetría (Excel hoja CISTERNA sección 2). */
  dotL: string;
  nUsuarios: string;
  diasAut: string;
  bciL: string;
  /** Cisterna — NPSH (Excel hoja CISTERNA sección 3). */
  patm: string;
  pv: string;
  npshr: string;
  /* ── EPC (ped. usuario 2026-11-19): control con variador, entorno y Perfil ── */
  /** Margen sobre la P mín. descarga para fijar el arranque (m.c.a.). */
  margen: string;
  /** Banda de control del variador arranque→parada (m.c.a.). */
  dif: string;
  /** Caudal mínimo de parada (% de Qb): bajo este el variador detiene la bomba. */
  qminp: string;
  /** Altitud del proyecto (m s.n.m.) — Patm para el NPSH. */
  altitud: string;
  /** Temperatura del agua (°C) — Pv para el NPSH. */
  temp: string;
  /** P parada máxima admisible del Perfil de presiones (m.c.a.; vacío = sin verificar). */
  poffmax: string;
  /** Aparato crítico: índice en la tabla de aparatos (-1 = otro) y su nombre libre. */
  apsel: string;
  apcrit: string;
  /** Material de la tubería del cuarto de bombas (clave de EP_MATS). */
  mat: string;
  /** Hf del cuarto calculada con los accesorios del esquema (método K). */
  hfauto: string;
  /** Potencia comercial elegida por el usuario (HP; vacío = la sugerida). */
  potSel: string;
  /** Cisterna: tabla de usos (JSON [{k,c,d}]), geometría y reposición. */
  usos: string;
  cisHu: string;
  cisHs: string;
  cisBl: string;
  cisQa: string;
  cisHsum: string;
  cisDc: string;
}

/** Semilla del formulario ep (Equipo de Presión): trae los valores típicos de norma ya puestos
 *  (presión mínima 5 m.c.a., eficiencia de bomba 0.65, factor de seguridad 1.15) y el resto
 *  vacío para que el usuario llene lo de SU proyecto. */
export const EP_DEFAULTS: EPData = {
  proyecto: 'Proyecto',
  elaborado: '',
  qac: '',
  qasc: '',
  hfac: '',
  hfacs: '',
  hfotros: '',
  pred: '',
  pmin: '5',
  pmax: '51',
  zbomba: '',
  ztop: '',
  zcis: '',
  hfcis: '',
  nt: '2',
  nr: '1',
  etab: '0.72',
  etam: '0.9',
  fs: '1.25',
  ciclos: '20',
  alfa: '0.30',
  vsuc: '1.2',
  vimp: '2.0',
  dnsuc: '',
  dnimp: '',
  modo: 'red',
  pcomercial: '',
  dotL: '200',
  nUsuarios: '',
  diasAut: '1',
  bciL: '0',
  patm: '',
  pv: '0.24',
  npshr: '',
  /* Defaults EPC (paridad con la prueba de aceptación de la HU). */
  margen: '2',
  dif: '5',
  qminp: '10',
  altitud: '0',
  temp: '20',
  poffmax: '',
  apsel: '9',
  apcrit: 'Ducha',
  mat: 'pvc40',
  hfauto: 'true',
  potSel: '',
  usos: '[{"k":0,"c":192,"d":150}]',
  cisHu: '2',
  cisHs: '0.1',
  cisBl: '0.3',
  cisQa: '',
  cisHsum: '24',
  cisDc: 'false',
};

/** Entrada decimal ligada a un campo de EPData: solo commitea al perder el foco, así el
 *  recálculo del módulo ep (Equipo de Presión) no corre con cada tecla. Con `unidad`, los
 *  campos de PRESIÓN (esCampoPresion) se muestran en la unidad activa y commitean de vuelta
 *  a m.c.a.; el resto de campos pasa tal cual. Ej: el campo Presión mínima es
 *  <LazyInp field="pmin" unidad={unidad} className="ds-si" ariaLabel="..." />. */
export function LazyInp({
  field,
  className = '',
  ariaLabel,
  disabled,
  ep,
  updEP,
  unidad,
}: {
  field: keyof EPData;
  /** Clases extra (variantes .ds-si-*: tamaño, acento…). */
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Unidad de presentación activa del módulo (el almacenamiento sigue en m.c.a.). */
  unidad?: EpUn;
}) {
  const esP = !!unidad && esCampoPresion(field);
  const f = esP ? EP_UNI[unidad!].f : 1;
  const raw = String(ep[field] ?? '');
  const nRaw = parseFloat(raw);
  const mostrar =
    raw === '' || isNaN(nRaw)
      ? raw
      : esP
        ? String(+(nRaw * f).toFixed(EP_UNI[unidad!].d + 1))
        : raw;
  return (
    <LazyDecimalInput
      value={mostrar}
      onCommit={(v) => {
        if (!esP || v === '') {
          updEP(field, v);
          return;
        }
        const n = parseFloat(v.replace(',', '.'));
        updEP(field, isNaN(n) ? v : String(+aMca(n, unidad!).toFixed(6)));
      }}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className={`ds-si${disabled ? ' ds-si-off' : ''}${className ? ` ${className}` : ''}`}
    />
  );
}

/** Etiqueta de un parámetro del formulario ep (Equipo de Presión): nombre en negrita y, si hay,
 *  subtítulo aclaratorio pequeño debajo (ej: unidad o fórmula). */
export const Param = ({ name, sub }: { name: string; sub?: React.ReactNode }) => (
  <div>
    <div className="ep-param-name">{name}</div>
    {sub && <div className="ep-param-sub">{sub}</div>}
  </div>
);

/** Nota gris pequeña del formulario ep (Equipo de Presión): aclaraciones que no son campos,
 *  ej: "Se consideran pérdidas por el método de Hazen-Williams". */
export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span className="ep-comment">{children}</span>
);
