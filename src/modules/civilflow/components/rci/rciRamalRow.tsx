/**
 * Una fila de la tabla de ramales RCI, memoizada. Se extrae de RCIRamalesTable para que abrir
 * el panel de ayuda (o cambiar estado local del padre) no repinta las 23 celdas de cada ramal.
 * Ej: alternar «Ver ayuda» deja intactas las filas R1/R2/R3.
 */
import { memo } from 'react';
import { anchoValor, celdaEditable, TDC, CELDA } from './RCIEditableCell.tsx';
import type { FilaRamalRci } from '../../utils/rci/RCIRowsModel.ts';
import { DIAM_BY_MAT, diamListPorMaterial } from '../../constants/engineeringDataMaterials.ts';
import type { Red } from '../../lib/rci/types.ts';

/** Nombre EXACTO de la etiqueta del trazo en el dibujo (RRCI1…): vive en f.id tras el «|»
 *  (planId|idTrazo). Sin id estable (fila de ejemplo) cae al nombre calculado R1… */
const nombreDibujoDe = (f: FilaRamalRci): string => {
  const id = String(f.id || '');
  return id.includes('|') ? id.slice(id.indexOf('|') + 1) : f.nombre;
};
/** Opciones del desplegable Ø = MISMAS del dibujo (diamListPorMaterial resuelve el alias de
 *  migración rci); material vacío/desconocido → la default rci (Acero SCH 40). 'auto' primero. */
const diamOpcionesDe = (mat: string): string[] => [
  'auto',
  ...(diamListPorMaterial(mat).length
    ? diamListPorMaterial(mat).map((d) => d.n)
    : (DIAM_BY_MAT['Acero SCH 40'] || []).map((d) => d.n)),
];

/** Tipos de rociador del ramal (v1.7.80) y su abreviatura en la celda. */
const TROC = ['Colgante', 'Montante', 'Oculto', 'Colgante seco'] as const;
const TROC_C: Record<string, string> = {
  Colgante: 'Colg.',
  Montante: 'Mont.',
  Oculto: 'Oculto',
  'Colgante seco': 'C. seco',
};

/** S digitada del ramal (vacío = usa la del proyecto). */
function sDeRamal(red: Red | undefined, i: number): string {
  const r = red?.ramales[i];
  return r && r.S !== undefined && r.S !== null ? String(r.S) : '';
}

/** Cota propia digitada del ramal (vacío = la cota de los ramales). */
function zrDeRamal(red: Red | undefined, i: number): string {
  const r = red?.ramales[i];
  return r && r.zr !== undefined && r.zr !== null ? String(r.zr) : '';
}

export interface RciRamalRowProps {
  f: FilaRamalRci;
  i: number;
  red: Red | undefined;
  editRam: boolean;
  setRamal: (i: number, k: 'dn' | 'mat' | 'S' | 'zr' | 'troc') => (v: string) => void;
  sProyecto: string;
  zRamTxt: string;
}

function RciRamalRow_({ f, i, red, editRam, setRamal, sProyecto, zRamTxt }: RciRamalRowProps) {
  const zrTxt = zrDeRamal(red, i);
  return (
    <tr key={f.id || i}>
      <td
        className="c"
        style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
        title="Etiqueta del trazo en el dibujo"
      >
        {nombreDibujoDe(f)}
      </td>
      <td className="c" style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}>
        {f.rocIni !== null ? `Roc ${f.rocIni}` : '—'}
      </td>
      <td className="c" style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}>
        {f.con || '—'}
      </td>
      <td className="c" style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}>
        {f.dib ?? '—'}
      </td>
      <td className="c" style={TDC}>
        {/* LECTURA (ped. usuario 2026-11-19): la cantidad de rociadores que fluyen
         *  SIEMPRE sale del dibujo (contados por el extractor + reparto automático
         *  del compute) — el override manual de este campo se retiró. */}
        {f.fluyen ?? '—'}
      </td>
      <td className="c" style={{ padding: '1px 2px' }}>
        {celdaEditable(
          editRam,
          <select
            value={f.troc}
            onChange={(e) => setRamal(i, 'troc')(e.target.value)}
            aria-label={`Tipo de rociador de ${f.nombre}`}
            style={{ ...CELDA, width: 66 }}
          >
            {TROC.map((n) => (
              <option key={n} value={n}>
                {TROC_C[n]}
              </option>
            ))}
          </select>,
        )}
      </td>
      <td className="c" style={{ padding: '1px 2px' }}>
        {celdaEditable(
          editRam,
          <select
            value={f.dn}
            onChange={(e) => setRamal(i, 'dn')(e.target.value)}
            title="Diámetro único del ramal. Auto: el menor que cumple la velocidad máxima. Mismas opciones que el desplegable del dibujo"
            style={{ ...CELDA, width: anchoValor(f.dn) }}
          >
            {diamOpcionesDe(f.mat).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>,
        )}
      </td>
      <td className="c" style={{ padding: '1px 2px' }}>
        {celdaEditable(
          editRam,
          <input
            type="number"
            step="any"
            value={sDeRamal(red, i)}
            placeholder={sProyecto}
            onChange={(e) => setRamal(i, 'S')(e.target.value)}
            aria-label={`Separación S de ${f.nombre}`}
            style={{ ...CELDA, width: 52 }}
          />,
        )}
      </td>
      <td
        className="c"
        style={{ ...TDC, background: 'var(--bg3)', color: 'var(--txt3)' }}
        title="Del dibujo (con la bajada si llega a la derivación)"
      >
        {f.Lr !== null ? f.Lr.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ padding: '1px 2px' }}>
        {celdaEditable(
          editRam,
          <input
            type="number"
            step="any"
            value={zrTxt}
            placeholder={zRamTxt || '0'}
            onChange={(e) => setRamal(i, 'zr')(e.target.value)}
            aria-label={`Cota de ${f.nombre}`}
            style={{ ...CELDA, width: 56 }}
          />,
        )}
      </td>
      <td className="c" style={TDC}>
        {f.rocIni !== null
          ? f.rocIni === f.rocFin
            ? `${f.rocIni}`
            : `${f.rocIni}–${f.rocFin}`
          : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.brazo !== null ? f.brazo.toFixed(2) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.dnUsado || '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Pf !== null ? f.Pf.toFixed(2) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Pe !== null ? f.Pe.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ ...TDC, fontWeight: 600 }}>
        {f.Q !== null ? f.Q.toFixed(2) : '—'}
      </td>
      <td className="c" style={{ ...TDC, fontWeight: 600 }}>
        {f.P !== null ? f.P.toFixed(2) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Keq !== null ? f.Keq.toFixed(3) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Vmax !== null ? f.Vmax.toFixed(2) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Qeq !== undefined && f.Qeq !== null ? f.Qeq.toFixed(2) : '—'}
      </td>
      <td className="c" style={TDC}>
        {f.Peq !== undefined && f.Peq !== null ? f.Peq.toFixed(2) : '—'}
      </td>
      <td
        className="c"
        style={{
          ...TDC,
          color: f.ok ? 'var(--succ, #5DBB83)' : 'var(--err, #F04545)',
          fontWeight: 700,
        }}
      >
        {f.ok ? 'OK' : 'revisar'}
      </td>
    </tr>
  );
}

export const RciRamalRow = memo(RciRamalRow_);
