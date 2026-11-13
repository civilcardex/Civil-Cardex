import React from 'react';
import { GAS } from '../../constants/engineeringDataGas.ts';
import { CONTADORES, MATERIALES_POR_RED, COEF_FRICCION } from './catalogData.ts';
import {
  MATERIALES_CUBIERTA_LL,
  MATERIALES_CANAL_LL,
} from '../../constants/engineeringDataMaterials.ts';
import { normalizeDnLabel } from '../../utils/formatUtils.ts';

function Th({
  children,
  w,
  className = '',
}: {
  children?: React.ReactNode;
  /** Ancho en % (atributo data-w, ver tables.css). */
  w?: string;
  className?: string;
}) {
  return (
    <th scope="col" className={`td-mono-b cat-th ${className}`.trim()} data-w={w}>
      {children}
    </th>
  );
}

function Tr({ children, index }: { children?: React.ReactNode; index: number }) {
  return <tr className={index % 2 === 0 ? 'cat-tr-even' : 'cat-tr-odd'}>{children}</tr>;
}

function Td({
  children,
  mono = false,
  className = '',
}: {
  children?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td className={`cat-td${mono ? ' cat-td-mono' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </td>
  );
}

interface GroupType {
  mat: string;
  rows: Array<{ dn: string; d: number }>;
}
interface GasGroupType {
  mat: string;
  K: number;
  rows: Array<{ dn: string; d: number }>;
}

/** Tabla de diámetros nominales e interiores (mm) agrupados por material (el material ocupa una
 *  celda con rowSpan). La muestra el catálogo maestro; compact = métricas apretadas para caber
 *  en informes. */
export function PipeTable({ groups, compact }: { groups: GroupType[]; compact?: boolean }) {
  return (
    <table className={`cat-table-fixed${compact ? ' cat-table-compact' : ''}`}>
      <caption className="sr-only">Diámetros nominales e interiores por material</caption>
      <thead>
        <tr>
          <Th w="25">Material</Th>
          <Th w="35">Diámetro Nominal</Th>
          <Th w="40">Ø Interior (mm)</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((grp, gi) => {
          let idx = 0;
          return grp.rows.map((r, ri) => (
            <Tr key={`${gi}-${ri}`} index={idx++}>
              {ri === 0 && (
                <td rowSpan={grp.rows.length} className="cat-mat">
                  {grp.mat}
                </td>
              )}
              <Td mono>{normalizeDnLabel(r.dn)}</Td>
              <Td mono>{r.d.toFixed(2)}</Td>
            </Tr>
          ));
        })}
      </tbody>
    </table>
  );
}

/** Tabla de diámetros para la red gas: nominal, interior (mm) y el coeficiente K del material
 *  (su fricción para el cálculo de gas). Sin grupos usa el catálogo global GAS. */
export function GasTable({ groups, compact }: { groups?: GasGroupType[]; compact?: boolean }) {
  let idx = 0;
  const data = groups || GAS;
  return (
    <table className={`cat-table-fixed${compact ? ' cat-table-compact' : ''}`}>
      <caption className="sr-only">
        Diámetros nominales, interiores y coeficiente K para gas
      </caption>
      <thead>
        <tr>
          <Th w="28">Material</Th>
          <Th w="28">Diámetro Nominal</Th>
          <Th w="24">Ø Interior (mm)</Th>
          <Th w="20">Coef. K</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((grp, gi) =>
          grp.rows.map((r: { dn: string; d: number }, ri: number) => (
            <Tr key={`${gi}-${ri}`} index={idx++}>
              {ri === 0 && (
                <td rowSpan={grp.rows.length} className="cat-mat">
                  {grp.mat}
                </td>
              )}
              <Td mono>{normalizeDnLabel(r.dn)}</Td>
              <Td mono>{r.d.toFixed(2)}</Td>
              <Td mono>{grp.K.toFixed(2)}</Td>
            </Tr>
          )),
        )}
      </tbody>
    </table>
  );
}

/** Tabla de caudales nominales (Qn en L/s (litros por segundo)) de contadores de agua por
 *  diámetro — referencia para chequear si el contador del proyecto aguanta el caudal. */
export function ContadoresTable() {
  return (
    <table className="cat-table">
      <caption className="sr-only">Caudales nominales de contadores por diámetro</caption>
      <thead>
        <tr>
          <Th w="50">Diámetro</Th>
          <Th w="50">Qn (LPS)</Th>
        </tr>
      </thead>
      <tbody>
        {CONTADORES.map((c, i) => {
          let label = normalizeDnLabel(c.dn);
          if (!label.endsWith('"') && !label.endsWith('mm')) label += '"';
          return (
            <tr key={i} className={i % 2 === 0 ? 'cat-tr-even' : 'cat-tr-odd'}>
              <Td mono>{label}</Td>
              <Td mono>{c.q.toFixed(2)}</Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Tabla de materiales recomendados por tipo de red. Ej: Agua caliente -> CPVC
 *  (Cloruro de Polivinilo Clorado); Sanitaria -> PVC-S. */
export function MaterialesPorRedTable() {
  return (
    <table className="cat-table">
      <caption className="sr-only">Materiales recomendados por tipo de red</caption>
      <thead>
        <tr>
          <Th w="30" className="cat-th-cmp">
            Red
          </Th>
          <Th className="cat-th-cmp">Materiales</Th>
        </tr>
      </thead>
      <tbody>
        {MATERIALES_POR_RED.map((c, i) => (
          <Tr key={i} index={i}>
            <Td mono className="cat-td-cmp">
              {c.red}
            </Td>
            <Td className="cat-td-cmp">{'mat' in c ? c.mat : c.mats ? c.mats.join(', ') : ''}</Td>
          </Tr>
        ))}
      </tbody>
    </table>
  );
}

/** Coeficiente de escorrentía C por material de cubierta (aguas lluvias) — sin columna de referencia. */
export function EscorrentiaCubiertaTable() {
  return (
    <table className="cat-table">
      <caption className="sr-only">Coeficiente de escorrentía por material de cubierta</caption>
      <thead>
        <tr>
          <Th w="70">Material de cubierta</Th>
          <Th w="30">C</Th>
        </tr>
      </thead>
      <tbody>
        {MATERIALES_CUBIERTA_LL.map((m, i) => (
          <Tr key={m.nombre} index={i}>
            <Td className="cat-td-left">{m.nombre}</Td>
            <Td mono>{m.C.toFixed(2)}</Td>
          </Tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rugosidad que frena el agua (mientras más áspero, más lento). Ej: Manning (formula de flujo en tuberia) n por material de canal, sin referencia. */
export function ManningCanalesLlTable() {
  return (
    <table className="cat-table">
      <caption className="sr-only">Coeficiente de Manning por material (canales)</caption>
      <thead>
        <tr>
          <Th w="70">Material del canal</Th>
          <Th w="30">n</Th>
        </tr>
      </thead>
      <tbody>
        {MATERIALES_CANAL_LL.map((m, i) => (
          <Tr key={m.nombre} index={i}>
            <Td className="cat-td-left">{m.nombre}</Td>
            <Td mono>{m.n.toFixed(3)}</Td>
          </Tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tabla de coeficientes de fricción por tubería: Manning (formula de flujo en tuberia) n,
 *  Hazen-Williams C (y C de uso) y rugosidad ε (mm) — la fuente de las pérdidas de carga que
 *  usan las tablas de dimensionamiento por red. */
export function CoefFriccionTable() {
  return (
    <div className="cat-scroll">
      <table className="cat-table">
        <caption className="sr-only">Coeficientes de fricción por tipo de tubería</caption>
        <thead>
          <tr>
            <th scope="colgroup" colSpan={9} className="cat-th-group">
              Coeficiente fricción tuberías
            </th>
          </tr>
          <tr>
            <th scope="col" className="cat-coef-th" data-w="14">
              Tipo
            </th>
            <th scope="col" className="cat-coef-th" data-w="14">
              Descripción
            </th>
            <th scope="col" className="cat-coef-th" data-w="10">
              Sistema
            </th>
            <th scope="col" className="cat-coef-th" data-w="7">
              Material
            </th>
            <th scope="col" className="cat-coef-th">
              Manning n
            </th>
            <th scope="col" className="cat-coef-th">
              Hazen C
            </th>
            <th scope="col" className="cat-coef-th">
              Hazen C Uso
            </th>
            <th scope="col" className="cat-coef-th">
              Rugosidad ε (mm)
            </th>
            <th scope="col" className="cat-coef-th">
              Presión Nominal
            </th>
          </tr>
        </thead>
        <tbody>
          {COEF_FRICCION.map((c, i) => (
            <tr key={i} className={i % 2 === 0 ? 'cat-tr-even' : 'cat-tr-odd'}>
              <td className="cat-coef-td">{c.tipo}</td>
              <td className="cat-coef-td cat-coef-td-body">{c.desc}</td>
              <td className="cat-coef-td cat-coef-td-body">{c.sis}</td>
              <td className="cat-coef-td cat-coef-td-body">{c.mat}</td>
              <td className="cat-coef-td">{c.n.toFixed(3)}</td>
              <td className="cat-coef-td">{c.c}</td>
              <td className="cat-coef-td">{c.cu}</td>
              <td className="cat-coef-td">{c.e.toFixed(4)}</td>
              <td className="cat-coef-td cat-coef-td-body">{c.pn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
