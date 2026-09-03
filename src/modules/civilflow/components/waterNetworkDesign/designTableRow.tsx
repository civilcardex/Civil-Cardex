import React from 'react';
import type { Tramo } from '../../context/tramosReducer';
import { pisoCorto } from '../../constants';
import { fmt } from '../../utils/formatUtils';
import { hunterK, computeDesignRow } from './rowPhysics';
import { OtrosRamalesChips } from './otrosRamalesChips';
import { LazyNumInput } from './lazyNumInput';

const WaterNetworkDesign_S2: React.CSSProperties = {
  width: '100%',
  padding: '3px 4px',
  border: '1px solid #3a494a',
  borderRadius: 3,
  background: '#1e2024',
  color: '#e2e2e8',
  fontSize: 9,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  maxWidth: 120,
};

// Una fila de la tabla de diseño de red: calcula su propia física (caudal de Hunter, diámetro
// efectivo, velocidades y pérdidas vía computeDesignRow) y renderiza las 23 columnas, incluyendo
// el selector de diámetro y las presiones editables cuando la tabla está en modo edición.
/** Una fila de la tabla de diseño de red: calcula su propia física (caudal de Hunter,
 *  diámetro efectivo, velocidad y pérdidas) y renderiza las 23 columnas, con el selector de
 *  diámetro y las presiones editables en modo edición. */
export function DesignTableRow({
  t,
  tr2,
  Qaco,
  qprobMap,
  propia,
  displayTotalMap,
  conexionesDisplay,
  tramos,
  colorVar,
  diamOpts,
  diamNomMap,
  diamIntMap,
  lookupFn,
  edit,
  handleDiamChange,
  setPresIni,
  setPresFin,
  pRed,
  pressureByKey,
}: {
  t: Tramo;
  tr2: Tramo | null;
  Qaco: number;
  qprobMap: Record<string, number>;
  propia: number;
  displayTotalMap: Record<string, number>;
  conexionesDisplay: Record<string, string[]>;
  tramos: Tramo[];
  colorVar: string;
  diamOpts: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  diamNomMap: Record<string, string>;
  diamIntMap: Record<string, number>;
  lookupFn: (pulg: number) => number;
  edit: boolean;
  handleDiamChange: (tramoId: string, nominal: string) => void;
  setPresIni: (tramoId: string, v: number | undefined) => void;
  setPresFin: (tramoId: string, v: number | undefined) => void;
  pRed: number;
  pressureByKey: Record<string, { Pin: number; Pfin: number }>;
}) {
  const ownKey = t._key || t.id;
  const isTr2 = t === tr2;
  const total = displayTotalMap[ownKey] || 0;
  const nDesc = t.nSalidas || 0;
  const K = hunterK(nDesc);
  const Qprob = isTr2 ? Qaco : qprobMap[ownKey] || 0;
  const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
  const calc = computeDesignRow(t, {
    qprob: Qprob,
    diamOpts,
    diamNomMap,
    diamIntMap,
    lookupFn,
  });
  const { Pin, Pfin } = pressureByKey[ownKey] ?? { Pin: pRed, Pfin: pRed };
  const vCumple = calc.Vmms >= 500 && calc.Vmms <= 2500;
  return (
    <tr>
      <td className="c" style={{ padding: '0 1px' }}>
        <span className="sigla" style={{ fontSize: 9, padding: '1px 4px' }}>
          {t.id}
        </span>
      </td>
      <td className="c td-mono" style={{ padding: '0 1px', fontSize: 9 }}>
        {t.ini && typeof t.ini === 'object' ? `${t.ini.x},${t.ini.y}` : t.ini || '—'}
      </td>
      <td className="c td-mono" style={{ padding: '0 1px', fontSize: 9 }}>
        {t.fin && typeof t.fin === 'object' ? `${t.fin.x},${t.fin.y}` : t.fin || '—'}
      </td>
      <td className="c" style={{ padding: '0 1px', color: 'var(--txt2)', fontSize: 9 }}>
        {pisoCorto(t.piso)}
      </td>
      <td className="c td-mono">{fmt(propia, 2)}</td>
      <td className="c" style={{ padding: '1px 2px', minWidth: 60, maxWidth: 120 }}>
        <OtrosRamalesChips
          connectedKeys={conexionesDisplay[ownKey] || []}
          tramos={tramos}
          displayTotalMap={displayTotalMap}
          colorVar={colorVar}
        />
      </td>
      <td className="c td-mono-b">{fmt(total, 2)}</td>
      <td className="c td-mono">{nDesc > 0 ? nDesc : '—'}</td>
      <td className="c td-mono-b">{K > 0 ? fmt(K, 2) : '—'}</td>
      <td className="c td-mono-b">{Qprob > 0 ? fmt(Qprob, 3) : '—'}</td>
      <td className="c td-mono">{raizQ > 0 ? fmt(raizQ, 2) : '—'}</td>
      <td className="c" style={{ padding: '0 1px' }}>
        <select
          aria-label="Diámetro diseño"
          value={calc.matchedOpt?.nominal || ''}
          disabled={!edit}
          onChange={(e) => handleDiamChange(ownKey, e.target.value)}
          style={WaterNetworkDesign_S2}
        >
          <option value="">—</option>
          {diamOpts.map((o) => (
            <option key={o.nominal} value={o.nominal}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="c td-mono">{calc.internoMm > 0 ? fmt(calc.internoMm, 2) : '—'}</td>
      <td className="c td-mono">{calc.cHW}</td>
      <td
        className="c"
        style={{
          fontWeight: 600,
          padding: '0 1px',
          fontSize: 9,
          background:
            calc.Vmms > 0 && vCumple
              ? 'rgba(34,197,94,.25)'
              : calc.Vmms > 0
                ? 'rgba(239,68,68,.25)'
                : 'transparent',
        }}
      >
        {calc.Vmms > 0 ? fmt(calc.Vmms, 2) : '—'}
      </td>
      <td className="c td-mono">{calc.H > 0 ? fmt(calc.H, 2) : '—'}</td>
      <td className="c td-mono">{calc.Vvert != null ? fmt(calc.Vvert, 2) : '—'}</td>
      <td className="c td-mono">{calc.Le > 0 ? fmt(calc.Le, 2) : '—'}</td>
      <td className="c td-mono-b">{calc.Lt > 0 ? fmt(calc.Lt, 2) : '—'}</td>
      <td className="c td-mono">{calc.hfPct != null ? fmt(calc.hfPct, 2) : '—'}</td>
      <td className="c td-mono-b">{calc.hfM != null ? fmt(calc.hfM, 2) : '—'}</td>
      <td className="c" style={{ padding: '0 1px' }}>
        <LazyNumInput
          label="Presión inicial"
          val={fmt(Pin, 2)}
          disabled={!edit}
          onSave={(v) => setPresIni(ownKey, v)}
        />
      </td>
      <td className="c" style={{ padding: '0 1px' }}>
        <LazyNumInput
          label="Presión final"
          val={fmt(Pfin, 2)}
          disabled={!edit}
          onSave={(v) => setPresFin(ownKey, v)}
        />
      </td>
    </tr>
  );
}
