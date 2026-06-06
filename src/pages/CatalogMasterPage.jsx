import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SANITARIAS = [
  { mat: 'PVC-S', rows: [
    { dn: '1 1/2"', d: 42.68 }, { dn: '2"', d: 54.48 },
    { dn: '3"', d: 76.20 }, { dn: '4"', d: 107.70 }, { dn: '6"', d: 160.04 },
  ]},
];

const VENTILACION = [
  { mat: 'PVC-V', rows: [
    { dn: '1 1/2"', d: 45.22 }, { dn: '2"', d: 56.76 },
    { dn: '3"', d: 79.00 }, { dn: '4"', d: 110.08 },
  ]},
];

const GAS = [
  { mat: 'Acero Galvanizado', K: 57.50, rows: [
    { dn: '3/8', d: 9.50 }, { dn: '1/2', d: 12.70 }, { dn: '3/4', d: 19.00 },
    { dn: '1', d: 25.40 }, { dn: '2', d: 50.80 },
  ]},
  { mat: 'Acero al Carbón', K: 57.50, rows: [
    { dn: '3/8', d: 10.00 }, { dn: '1/2', d: 13.40 }, { dn: '3/4', d: 19.50 },
    { dn: '1', d: 26.00 }, { dn: '2', d: 52.00 },
  ]},
  { mat: 'Cobre Rígido', K: 54.20, rows: [
    { dn: '3/8', d: 8.70 }, { dn: '1/2', d: 10.90 }, { dn: '3/4', d: 17.40 },
  ]},
  { mat: 'Cobre Flexible', K: 54.20, rows: [
    { dn: '3/8', d: 9.00 }, { dn: '1/2', d: 11.20 },
  ]},
  { mat: 'PE al PE', K: 49.00, rows: [
    { dn: '3/8', d: 12.00 }, { dn: '1/2', d: 16.00 },
    { dn: '3/4', d: 20.00 }, { dn: '1', d: 25.00 },
  ]},
  { mat: 'Polietileno', K: 50.60, rows: [
    { dn: '1/2', d: 14.50 }, { dn: '3/4', d: 21.50 }, { dn: '1', d: 27.80 },
  ]},
];

const RCI = [
  { mat: 'Acero al Carbon SCH 10', rows: [
    { dn: '3/4"', d: 22.48 }, { dn: '1"', d: 27.86 }, { dn: '1 1/4"', d: 36.66 },
    { dn: '1 1/2"', d: 42.76 }, { dn: '2"', d: 54.76 }, { dn: '2 1/2"', d: 66.9 },
    { dn: '3"', d: 82.8 }, { dn: '4"', d: 108.2 }, { dn: '5"', d: 134.5 },
    { dn: '6"', d: 161.5 }, { dn: '8"', d: 209.54 }, { dn: '10"', d: 263.44 },
  ]},
  { mat: 'Acero al Carbon SCH 40', rows: [
    { dn: '1/2"', d: 15.76 }, { dn: '3/4"', d: 20.96 }, { dn: '1"', d: 26.64 },
    { dn: '1 1/4"', d: 35.08 }, { dn: '1 1/2"', d: 40.94 }, { dn: '2"', d: 52.48 },
    { dn: '2 1/2"', d: 62.68 }, { dn: '3"', d: 77.92 }, { dn: '4"', d: 102.26 },
    { dn: '5"', d: 128.2 }, { dn: '6"', d: 154.08 }, { dn: '8"', d: 202.74 },
    { dn: '10"', d: 254.46 },
  ]},
  { mat: 'PVC C900 RDE 14', rows: [
    { dn: '4"', d: 104.88 }, { dn: '6"', d: 150.26 }, { dn: '8"', d: 197.08 },
    { dn: '10"', d: 241.62 }, { dn: '12"', d: 287.40 },
  ]},
  { mat: 'PVC C900 RDE 18', rows: [
    { dn: '4"', d: 108.34 }, { dn: '6"', d: 155.84 }, { dn: '8"', d: 204.34 },
    { dn: '10"', d: 250.56 }, { dn: '12"', d: 298.06 },
  ]},
  { mat: 'Acero Galvanizado', rows: [
    { dn: '3/4"', d: 22.48 }, { dn: '1"', d: 27.86 }, { dn: '1 1/4"', d: 36.66 },
    { dn: '1 1/2"', d: 42.76 }, { dn: '2"', d: 54.76 }, { dn: '2 1/2"', d: 66.90 },
    { dn: '3"', d: 82.80 }, { dn: '3 1/2"', d: 95.50 }, { dn: '4"', d: 108.20 },
    { dn: '6"', d: 161.50 },
  ]},
];

const AGUA_FRIA = [
  { mat: 'PVC-Pr', rows: [
    { dn: '1/2 (RDE 9)', d: 16.60 }, { dn: '1/2 (RDE 13.5)', d: 18.18 },
    { dn: '3/4 (RDE 11)', d: 21.81 }, { dn: '3/4 (RDE 21)', d: 23.63 },
    { dn: '1 (RDE 13.5)', d: 28.48 }, { dn: '1 (RDE 21)', d: 30.20 },
    { dn: '1 1/4 (RDE 21)', d: 38.14 }, { dn: '1 1/2 (RDE 21)', d: 43.68 },
    { dn: '2 (RDE 21)', d: 54.58 }, { dn: '2 1/2 (RDE 21)', d: 66.07 },
    { dn: '3 (RDE 21)', d: 80.42 }, { dn: '4 (RDE 21)', d: 103.42 },
    { dn: '6 (RDE 21)', d: 152.22 },
  ]},
];

const AGUA_CALIENTE = [
  { mat: 'CPVC', rows: [
    { dn: '1/2 (RDE 11)', d: 12.40 }, { dn: '3/4 (RDE 11)', d: 18.20 },
    { dn: '1 (RDE 11)', d: 23.40 }, { dn: '1 1/4 (RDE 11)', d: 28.60 },
    { dn: '1 1/2 (RDE 11)', d: 33.70 }, { dn: '2 (RDE 11)', d: 44.20 },
    { dn: '2 (CPVC SCH 80)', d: 49.25 },
    { dn: '2 1/2 (CPVC SCH 80)', d: 59.00 },
    { dn: '3 (CPVC SCH 80)', d: 73.66 },
  ]},
];

const CONTADORES = [
  { dn: '1/2', q: 0.84 }, { dn: '3/4', q: 1.40 },
  { dn: '1', q: 1.96 }, { dn: '1 1/2', q: 5.60 }, { dn: '2', q: 8.40 },
];

const MATERIALES_POR_RED = [
  { red: 'Sanitaria', mat: 'PVC-S' },
  { red: 'Aguas lluvias', mat: 'PVC-S' },
  { red: 'Ventilacion', mat: 'PVC-V' },
  { red: 'Agua Fria', mat: 'PVC-Pr' },
  { red: 'Agua caliente', mat: 'CPVC' },
  { red: 'Gas', mats: ['Acero Galvanizado', 'Cobre Rigido', 'Cobre Flexible', 'PE al PE', 'Polietileno PEAD', 'Acero al Carbon'] },
  { red: 'Contra Incendio', mats: ['Acero Galvanizado', 'PVC C900', 'Acero al Carbon'] },
];

const COEF_FRICCION = [
  { tipo: 'PVC-S', desc: 'PVC Sanitario', sis: 'Sanitaria', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'N/A' },
  { tipo: 'PVC-S', desc: 'PVC Sanitario', sis: 'Aguas lluvias', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'N/A' },
  { tipo: 'PVC-V', desc: 'PVC Ventilación', sis: 'Ventilacion', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'N/A' },
  { tipo: 'PVC-Pr', desc: 'PVC Presión', sis: 'Agua Fria', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según RDE' },
  { tipo: 'CPVC', desc: 'CPVC Agua caliente', sis: 'Agua caliente', mat: 'CPVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según SDR' },
  { tipo: 'Acero Galvanizado', desc: 'Acero Galvanizado', sis: 'Gas', mat: 'Acero', n: 0.015, c: 120, cu: 100, e: 0.15, pn: 'Según cédula' },
  { tipo: 'Cobre Rígido', desc: 'Cobre Tipo L/K', sis: 'Gas', mat: 'Cobre', n: 0.011, c: 130, cu: 120, e: 0.0015, pn: 'Según tipo' },
  { tipo: 'Cobre Flexible', desc: 'Cobre Flexible', sis: 'Gas', mat: 'Cobre', n: 0.011, c: 130, cu: 120, e: 0.0015, pn: 'Según tipo' },
  { tipo: 'PE al PE', desc: 'PE Baja Densidad', sis: 'Gas', mat: 'PE', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'Según SDR' },
  { tipo: 'Polietileno PEAD', desc: 'Polietileno Alta Densidad', sis: 'Gas', mat: 'PEAD', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'PE80/PE100' },
  { tipo: 'Acero al Carbon', desc: 'Acero Negro', sis: 'Contra Incendio', mat: 'Acero', n: 0.012, c: 120, cu: 100, e: 0.045, pn: 'Según cédula' },
  { tipo: 'Acero Galvanizado', desc: 'Acero Galvanizado', sis: 'Contra Incendio', mat: 'Acero', n: 0.015, c: 120, cu: 100, e: 0.15, pn: 'Según cédula' },
  { tipo: 'PVC C900', desc: 'PVC C900', sis: 'Contra Incendio', mat: 'PVC', n: 0.009, c: 150, cu: 145, e: 0.0015, pn: 'DR 18/25' },
];

const TABS = [
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 3, label: '3' },
  { id: 4, label: '4' },
];

const HEADER_BG = 'var(--bg3)';
const HEADER_TXT = '#00dce5';
const HEADER_BORDER = 'rgba(0,220,229,0.35)';

function SectionCard({ title, subtitle, children, scroll, span = 1, maxWidth, compact = false }) {
  return (
    <div className="card" style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: compact ? 'none' : '100%', width: '100%', maxWidth: maxWidth || 'none', alignSelf: compact ? 'start' : 'stretch', boxShadow: '0 1px 0 var(--line)' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <span className="card-t" style={{ fontSize: 12, textTransform: 'uppercase' }}>{title}</span>
        {subtitle && <span className="card-s" style={{ fontSize: 10 }}>{subtitle}</span>}
      </div>
      <div className="card-b" style={{ padding: 0, overflow: scroll ? 'auto' : 'visible', flex: compact ? 0 : 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th className="td-mono-b" style={{
      background: HEADER_BG,
      color: HEADER_TXT,
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      padding: '4px 8px',
      borderBottom: `1px solid ${HEADER_BORDER}`,
      borderTop: `1px solid ${HEADER_BORDER}`,
      textAlign: 'left',
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</th>
  );
}

function Tr({ children, index, style }) {
  const bg = index % 2 === 0 ? 'var(--bg3)' : 'var(--bg)';
  return (
    <tr style={{ background: bg, ...style }}>{children}</tr>
  );
}

function Td({ children, style, mono = false, center = true }) {
  return (
    <td className={mono ? 'td-mono' : ''} style={{
      ...(mono ? {} : { fontFamily: 'var(--body)' }),
      fontSize: 12,
      fontWeight: 500,
      padding: '5px 10px',
      textAlign: center ? 'center' : 'left',
      color: 'var(--txt)',
      borderBottom: '1px solid var(--line)',
      ...style,
    }}>{children}</td>
  );
}

function SanitariasTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '40%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {SANITARIAS.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono center={false} style={{ padding: '2px 8px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function VentilacionTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '40%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {VENTILACION.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono center={false} style={{ padding: '2px 8px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function AguaFriaTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '35%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {AGUA_FRIA.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono center={false} style={{ padding: '2px 8px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function AguaCalienteTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '35%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {AGUA_CALIENTE.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono center={false} style={{ padding: '2px 8px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function GasTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '32%', textAlign: 'center', padding: '5px 6px' }}>Material</Th>
          <Th style={{ textAlign: 'center', padding: '5px 6px' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center', padding: '5px 6px' }}>Diametro Interno (mm)</Th>
          <Th style={{ textAlign: 'center', padding: '5px 6px' }}>Coef. tubería K</Th>
        </tr>
      </thead>
      <tbody>
        {GAS.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono style={{ padding: '3px 6px' }}>{r.dn}</Td>
            <Td mono style={{ padding: '3px 6px' }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
            <Td mono style={{ padding: '3px 6px' }}>{grp.K.toFixed(2)}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function RciTable() {
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '40%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {RCI.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 8px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function RciAceroTable() {
  const groups = RCI.slice(0, 2);
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '40%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 6px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono center={false} style={{ padding: '2px 6px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 6px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function RciGalvTable() {
  const groups = RCI.slice(2);
  let idx = 0;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th style={{ width: '40%', textAlign: 'center' }}>Material</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Nominal</Th>
          <Th style={{ textAlign: 'center' }}>Diametro Interior mm</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((grp, gi) => grp.rows.map((r, ri) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 ? (
              <td rowSpan={grp.rows.length} style={{ padding: '2px 6px', fontSize: 11, fontWeight: 600, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>{grp.mat}</td>
            ) : null}
            <Td mono style={{ padding: '2px 6px', fontSize: 11 }}>{r.dn}</Td>
            <Td mono style={{ padding: '2px 6px', fontSize: 11 }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  );
}

function ContadoresTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '4px 6px', borderBottom: '1px solid rgba(0,220,229,0.35)' }}>
        <span className="td-mono-b" style={{ fontSize: 10, fontWeight: 700, color: '#00dce5',  textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' }}>Diámetro Nominal</span>
        <span className="td-mono-b" style={{ fontSize: 10, fontWeight: 700, color: '#00dce5',  letterSpacing: 0.6, textAlign: 'center' }}>Qn(LPS)</span>
      </div>
      {CONTADORES.map((c, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '3px 6px', borderBottom: i < CONTADORES.length - 1 ? '1px solid var(--line)' : 'none', background: i % 2 === 0 ? 'var(--bg3)' : 'var(--bg)' }}>
          <span className="td-mono" style={{ fontSize: 11, color: 'var(--txt)',  textAlign: 'center' }}>{c.dn}</span>
          <span className="td-mono" style={{ fontSize: 11, color: 'var(--txt)',  fontWeight: 500, textAlign: 'center' }}>{c.q.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function MaterialesPorRedTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {MATERIALES_POR_RED.map((c, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', padding: '4px 8px', borderBottom: i < MATERIALES_POR_RED.length - 1 ? '1px solid var(--line)' : 'none', background: i % 2 === 0 ? 'var(--bg3)' : 'var(--bg)' }}>
          <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--txt)', textAlign: 'center', alignSelf: 'center' }}>{c.red}</span>
          {c.mat && <span className="td-mono" style={{ fontSize: 11, color: 'var(--txt2)',  textAlign: 'center', alignSelf: 'center' }}>{c.mat}</span>}
          {c.mats && (
            <span className="td-mono" style={{ fontSize: 11, color: 'var(--txt2)',  textAlign: 'center', lineHeight: 1.6, alignSelf: 'center' }}>
              {c.mats.slice(0, Math.ceil(c.mats.length / 2)).join(', ')},<br />
              {c.mats.slice(Math.ceil(c.mats.length / 2)).join(', ')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const coefTh = {
  background: HEADER_BG,
  color: HEADER_TXT,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  padding: '5px 8px',
  border: '1px solid var(--line)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const coefTd = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 500,
  padding: '2px 6px',
  textAlign: 'center',
  color: 'var(--txt)',
  border: '1px solid var(--line)',
};

function CoefFriccionTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--line)' }}>
        <thead>
          <tr>
            <td colSpan={9} style={{
              padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13,
               textTransform: 'uppercase', letterSpacing: 0.5,
              background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--txt)',
            }}>
              Coeficiente fricción tuberías
            </td>
          </tr>
          <tr>
            <th style={{ ...coefTh, width: '14%' }}>Tipo Tubería</th>
            <th style={{ ...coefTh, width: '14%' }}>Descripción</th>
            <th style={{ ...coefTh, width: '10%' }}>Sistema</th>
            <th style={{ ...coefTh, width: '7%' }}>Material</th>
            <th style={coefTh}>Manning n</th>
            <th style={coefTh}>Hazen C</th>
            <th style={coefTh}>Hazen C Usado</th>
            <th style={coefTh}>Rugosidad Absoluta ε (mm)</th>
            <th style={coefTh}>Presión Nominal</th>
          </tr>
        </thead>
        <tbody>
          {COEF_FRICCION.map((c, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg3)' : 'var(--bg)' }}>
              <td style={{ ...coefTd, textAlign: 'left' }}>{c.tipo}</td>
              <td style={{ ...coefTd, fontFamily: 'var(--body)', textAlign: 'left' }}>{c.desc}</td>
              <td style={{ ...coefTd, fontFamily: 'var(--body)', textAlign: 'left' }}>{c.sis}</td>
              <td style={{ ...coefTd, fontFamily: 'var(--body)', textAlign: 'left' }}>{c.mat}</td>
              <td style={coefTd}>{c.n.toFixed(3)}</td>
              <td style={coefTd}>{c.c}</td>
              <td style={coefTd}>{c.cu}</td>
              <td style={coefTd}>{c.e}</td>
              <td style={{ ...coefTd, fontFamily: 'var(--body)', textAlign: 'left' }}>{c.pn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pageBtn = {
  padding: '5px 12px', border: '1px solid var(--line)', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer',
  background: 'var(--bg3)', color: 'var(--txt2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .15s', minWidth: 30,
};

export default function CatalogoMaestroPage() {
  const navigate = useNavigate();
  const [subpage, setSubpage] = useState(1);

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--txt)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <button className="td-mono" onClick={() => { sessionStorage.setItem('openTab', 'datos'); navigate('/civilflowareatrabajo'); }}
            style={{
              position: 'absolute', left: 0,
              padding: '5px 11px', background: 'var(--bg3)', border: '1px solid var(--line)',
              borderRadius: 3,               color: 'var(--txt2)', cursor: 'pointer',
               fontWeight: 600, fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
            ← VOLVER
          </button>
          <h1 className="td-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)',  margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Catálogo Maestro
          </h1>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          padding: '12px 0 8px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {subpage === 1 && (
            <>
              <CoefFriccionTable />
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.5fr', gap: 12, flexShrink: 0 }}>
                <SectionCard title="Materiales por red" subtitle="Por sistema" compact>
                  <MaterialesPorRedTable />
                </SectionCard>
                <SectionCard title="Contadores" subtitle="Qn(LPS)" compact>
                  <ContadoresTable />
                </SectionCard>
              </div>
            </>
          )}

          {subpage === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Sanitarias y Aguas lluvias" subtitle="PVC-S · NTC 1500" span={1} compact>
                <SanitariasTable />
              </SectionCard>
              <SectionCard title="Ventilación" subtitle="PVC-V · NTC 1500 §9" span={1} compact>
                <VentilacionTable />
              </SectionCard>
              <SectionCard title="Agua fría" subtitle="PVC-Pr · NTC 1500" span={1} compact>
                <AguaFriaTable />
              </SectionCard>
              <SectionCard title="Agua caliente" subtitle="CPVC · NTC 1500" span={1} compact>
                <AguaCalienteTable />
              </SectionCard>
            </div>
          )}

          {subpage === 3 && (
            <div style={{ width: '100%' }}>
              <SectionCard title="Gas" subtitle="NTC 3728 · múltiples materiales" compact>
                <GasTable />
              </SectionCard>
            </div>
          )}

          {subpage === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Contra Incendio — Acero" subtitle="SCH 10 · SCH 40" compact>
                <RciAceroTable />
              </SectionCard>
              <SectionCard title="Contra Incendio — PVC / Galv." subtitle="C900 RDE · Galvanizado" compact>
                <RciGalvTable />
              </SectionCard>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexShrink: 0, padding: '8px 0 12px', borderTop: '1px solid var(--line)' }}>
          <button onClick={() => setSubpage(Math.max(1, subpage - 1))}
            style={{ ...pageBtn, opacity: subpage === 1 ? 0.3 : 1, cursor: subpage === 1 ? 'default' : 'pointer' }}>
            ←
          </button>
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setSubpage(n)}
              style={{
                ...pageBtn,
                background: subpage === n ? 'rgba(0,220,229,0.15)' : 'var(--bg3)',
                border: `1px solid ${subpage === n ? 'rgba(0,220,229,0.55)' : 'var(--line)'}`,
                color: subpage === n ? '#00dce5' : 'var(--txt2)',
                fontWeight: subpage === n ? 700 : 500,
              }}>
              {n}
            </button>
          ))}
          <button onClick={() => setSubpage(Math.min(4, subpage + 1))}
            style={{ ...pageBtn, opacity: subpage === 4 ? 0.3 : 1, cursor: subpage === 4 ? 'default' : 'pointer' }}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}