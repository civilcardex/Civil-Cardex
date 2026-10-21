import React from 'react';
import type { Tramo } from '../../context/tramosReducer';
import { pisoCorto } from '../../constants';
import { fmt, sectorDe } from '../../utils/formatUtils.ts';
import { parseDecimalInput } from '../../utils/parseDecimal.ts';
import { hunterK, computeDesignRow } from './rowPhysics.ts';
import { chequeoPresionAparato } from '../../utils/waterRowsShared.ts';
import { perfilDe } from '../../constants/countryStandards';
import { leerHeredadosPresion } from '../../utils/propagation';
import { LazyDecimalInput } from '../shared/LazyDecimalInput.tsx';
import ChipList from '../shared/ChipList.tsx';
import { writeNSalidasToDrawing } from '../../utils/drawingWrites/otros';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { useState } from 'react';

/** Estilo compacto del input de presión (misma pinta del LazyNumInput que reemplaza). */
const PRESION_INP: React.CSSProperties = {
  width: 44,
  textAlign: 'center',
  padding: 0,
  fontSize: 9,
};

/** Chips de la columna "Otros Ramales": los tramos conectados al de la fila, cada uno con su UC (Unidades de Consumo) total en el tooltip. Sin conexiones muestra un guion. */
function OtrosRamalesChips({
  connectedKeys,
  tramos,
  displayTotalMap,
  colorVar,
}: {
  connectedKeys: string[];
  tramos: Tramo[];
  displayTotalMap: Record<string, number>;
  colorVar: string;
}) {
  return (
    <ChipList
      items={connectedKeys.map((childKey) => {
        const rId = sectorDe(childKey);
        const childTramo = tramos.find((tr) => (tr._key || tr.id) === childKey);
        const childOwnKey = childTramo?._key || childTramo?.id || childKey;
        const childTotalUd = displayTotalMap[childOwnKey] || 0;
        return { key: childKey, label: rId, title: `${rId} (${childTotalUd.toFixed(2)} UC)` };
      })}
      colorVar={colorVar}
      fontSize={9}
      pad="1px 1px"
    />
  );
}

/** Commit numérico del input perezoso: '' → undefined (borra el dato); parse inválido → sin cambio (acepta coma es-locale). */
const numCommit =
  (onSave: (v: number | undefined) => void) =>
  (s: string): void => {
    const t = s.trim();
    if (t === '') return onSave(undefined);
    const n = parseDecimalInput(t);
    if (n != null) onSave(n);
  };

const WaterNetworkDesign_S2: React.CSSProperties = {
  width: '100%',
  padding: '3px 4px',
  border: '1px solid #3a494a',
  borderRadius: 3,
  background: '#1e2024',
  color: '#e2e2e8',
  fontSize: 10.5,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  maxWidth: 120,
};

// Una fila de la tabla de diseño de red: calcula su propia física (caudal de Hunter, diámetro
// efectivo, velocidades y pérdidas vía computeDesignRow) y renderiza las 24 columnas, incluyendo
// el selector de diámetro y las presiones editables cuando la tabla está en modo edición.
/** Una fila de la tabla de diseño de red: calcula su propia física (caudal de Hunter (metodo de probabilidad de uso simultaneo), diámetro efectivo, velocidad y pérdidas) y
 * renderiza las 24 columnas, con el selector de diámetro y las presiones editables en modo edición. */
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
  plans,
  updTramo,
  net,
  handleDiamChange,
  setPresIni,
  setPresFin,
  pRed,
  pressureByKey,
  velLim,
  pais,
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
  /** Límites de velocidad del país (mm/s) — normasPais. */
  velLim?: [number, number];
  /** Planes + updTramo + red: Nº de descargas editable y bidireccional con el dibujo. */
  plans: PlanItem[];
  updTramo: (id: string, field: string, val: string | number | boolean) => void;
  net: 'af' | 'ac';
  /** País del proyecto: el chequeo por aparato usa el catálogo NTC hasta que haya catálogo por país. */
  pais?: string;
}) {
  const ownKey = t._key || t.id;
  // Herencia de aparatos af/ac (libro aparatos_heredados_v1): tooltip en la celda propia.
  const hered = leerHeredadosPresion(t._aparatosKey || '');
  const heredTxt = Object.entries(hered)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
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
  // Nº de descargas EDITABLE y BIDIRECCIONAL con el dibujo (patrón sanitaria: input en modo
  // edición, commit → updTramo + writeNSalidasToDrawing; el buildTramos lo re-lee del trazo).
  const [editNs, setEditNs] = useState<string | null>(null);
  const vCumple = calc.Vmms >= (velLim?.[0] ?? 500) && calc.Vmms <= (velLim?.[1] ?? 2500);
  // Chequeo de presión en el aparato conectado (catálogo NTC 1500: pmin ≤ P ≤ pmax en el
  // extremo). Sin catálogo por país todavía: si el país es referencia, el tooltip lo dice.
  const chkP = chequeoPresionAparato(t.ini, t.fin, Pin, Pfin);
  const chkPCita = perfilDe(pais).ref
    ? 'Catálogo NTC 1500 (ref. — sin catálogo nacional verificado)'
    : 'Catálogo NTC 1500';
  return (
    <tr>
      <td className="c" style={{ padding: '0 1px' }}>
        <span className="sigla" style={{ fontSize: 10.5, padding: '1px 4px' }}>
          {t.id}
          {t.piso != null ? `-${pisoCorto(t.piso)}` : ''}
        </span>
      </td>
      <td className="c td-mono" style={{ padding: '0 1px', fontSize: 10.5 }}>
        {t.ini && typeof t.ini === 'object' ? `${t.ini.x},${t.ini.y}` : t.ini || '—'}
      </td>
      <td className="c td-mono" style={{ padding: '0 1px', fontSize: 10.5 }}>
        {t.fin && typeof t.fin === 'object' ? `${t.fin.x},${t.fin.y}` : t.fin || '—'}
      </td>
      <td
        className="c td-mono"
        title={heredTxt ? `Heredados aguas arriba: ${heredTxt}` : undefined}
      >
        {fmt(propia, 2)}
      </td>
      <td className="c" style={{ padding: '1px 2px', minWidth: 60, maxWidth: 120 }}>
        <OtrosRamalesChips
          connectedKeys={conexionesDisplay[ownKey] || []}
          tramos={tramos}
          displayTotalMap={displayTotalMap}
          colorVar={colorVar}
        />
      </td>
      <td className="c td-mono-b">{fmt(total, 2)}</td>
      <td className="c" style={{ padding: '1px 2px' }}>
        {edit ? (
          <input
            type="text"
            inputMode="numeric"
            value={editNs !== null ? editNs : nDesc > 0 ? String(nDesc) : ''}
            placeholder="—"
            aria-label="Número de descargas"
            onChange={(e) => setEditNs(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const raw = editNs !== null ? editNs : '';
              const v = parseInt(raw, 10);
              setEditNs(null);
              if (!Number.isFinite(v) || v < 1) return;
              updTramo(ownKey, 'nSalidas', v);
              writeNSalidasToDrawing(ownKey, net, v, plans);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{
              width: 52,
              textAlign: 'center',
              border: '1px solid #3a494a',
              borderRadius: 3,
              background: '#1e2024',
              color: '#e2e2e8',
              fontSize: 10.5,
              fontFamily: 'var(--mono)',
              padding: '2px 4px',
            }}
          />
        ) : nDesc > 0 ? (
          <span className="td-mono" style={{ fontFamily: 'var(--mono)' }}>
            {nDesc}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="c td-mono-b">{K > 0 ? fmt(K, 2) : '—'}</td>
      <td className="c td-mono-b">{Qprob > 0 ? fmt(Qprob, 3) : '—'}</td>
      <td className="c td-mono">{raizQ > 0 ? fmt(raizQ, 2) : '—'}</td>
      <td className="c" style={{ padding: '0 1px' }}>
        {edit ? (
          <select
            aria-label="Diámetro diseño"
            value={calc.matchedOpt?.nominal || ''}
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
        ) : (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
            {calc.matchedOpt?.label || '—'}
          </span>
        )}
      </td>
      <td className="c td-mono">{calc.internoMm > 0 ? fmt(calc.internoMm, 2) : '—'}</td>
      <td className="c td-mono">{fmt(calc.cHW, 2)}</td>
      <td
        className="c"
        style={{
          fontWeight: 600,
          padding: '0 1px',
          fontSize: 10.5,
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
        {edit ? (
          <LazyDecimalInput
            ariaLabel="Presión inicial"
            value={fmt(Pin, 2)}
            commitOnEnter
            className="ni"
            style={PRESION_INP}
            onCommit={numCommit((v) => setPresIni(ownKey, v))}
          />
        ) : (
          <span className="td-mono" style={{ fontFamily: 'var(--mono)' }}>
            {fmt(Pin, 2)}
          </span>
        )}
      </td>
      <td className="c" style={{ padding: '0 1px' }}>
        {edit ? (
          <LazyDecimalInput
            ariaLabel="Presión final"
            value={fmt(Pfin, 2)}
            commitOnEnter
            className="ni"
            style={PRESION_INP}
            onCommit={numCommit((v) => setPresFin(ownKey, v))}
          />
        ) : (
          <span className="td-mono" style={{ fontFamily: 'var(--mono)' }}>
            {fmt(Pfin, 2)}
          </span>
        )}
      </td>
      <td
        className="c td-mono-b"
        title={`Presión del aparato dentro de su rango: ${chkPCita}.`}
        style={{
          padding: '0 1px',
          fontSize: 10.5,
          background:
            chkP === 'O.K.'
              ? 'rgba(34,197,94,.25)'
              : chkP === 'NO'
                ? 'rgba(239,68,68,.25)'
                : 'transparent',
        }}
      >
        {chkP || '—'}
      </td>
    </tr>
  );
}
