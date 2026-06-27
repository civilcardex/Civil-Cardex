import React from 'react'
import { GAS } from '../../constants'
import { CONTADORES, MATERIALES_POR_RED, COEF_FRICCION } from './catalogData'

const HEADER_BG = 'var(--bg3)'
const HEADER_TXT = '#00dce5'
const HEADER_BORDER = 'rgba(0,220,229,0.35)'

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th scope="col" className="td-mono-b" style={{
      background: HEADER_BG,
      color: HEADER_TXT,
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      padding: '4px 8px',
      borderBottom: `1px solid ${HEADER_BORDER}`,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      ...style,
    }}>{children}</th>
  )
}

function Tr({ children, index, style, key: _key }: { children?: React.ReactNode; index: number; style?: React.CSSProperties; key?: React.Key }) {
  const bg = index % 2 === 0 ? 'var(--bg3)' : 'var(--bg)'
  return <tr style={{ background: bg, ...style }}>{children}</tr>
}

function Td({ children, style, mono = false, center = true }: { children?: React.ReactNode; style?: React.CSSProperties; mono?: boolean; center?: boolean }) {
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
  )
}

interface GroupType { mat: string; rows: Array<{ dn: string; d: number }> }
interface GasGroupType { mat: string; K: number; rows: Array<{ dn: string; d: number }> }

export function PipeTable({ groups, compact }: { groups: GroupType[]; compact?: boolean }) {
  const cp = compact ? { thPad: '3px 8px', thFs: 11, thLs: 0.5, tdPad: '3px 8px', tdFs: 12, matFs: 14, matPad: '3px 8px', matFw: 700 } : { thPad: '4px 8px', thFs: 10, thLs: 0.6, tdPad: '5px 10px', tdFs: 12, matFs: 11, matPad: '4px 8px', matFw: 600 }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <caption style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        Diámetros nominales e interiores por material
      </caption>
      <thead>
        <tr>
          <Th style={{ width: '25%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Material</Th>
          <Th style={{ width: '35%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Diámetro Nominal</Th>
          <Th style={{ width: '40%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Ø Interior (mm)</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((grp, gi) => {
          let idx = 0
          return grp.rows.map((r, ri) => (
            <Tr key={`${gi}-${ri}`} index={idx++}>
              {ri === 0 && (
                <td rowSpan={grp.rows.length} style={{ padding: cp.matPad, fontSize: cp.matFs, fontWeight: cp.matFw, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderBottom: '1px solid var(--line)' }}>
                  {grp.mat}
                </td>
              )}
              <Td mono center={false} style={{ padding: cp.tdPad, fontSize: cp.tdFs }}>{r.dn}</Td>
              <Td mono style={{ padding: cp.tdPad, fontSize: cp.tdFs }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
            </Tr>
          ))
        })}
      </tbody>
    </table>
  )
}

export function GasTable({ groups, compact }: { groups?: GasGroupType[]; compact?: boolean }) {
  let idx = 0
  const data = groups || GAS
  const cp = compact ? { thPad: '3px 8px', thFs: 11, thLs: 0.5, tdPad: '3px 8px', tdFs: 12, matFs: 14, matPad: '3px 8px', matFw: 700 } : { thPad: '4px 8px', thFs: 10, thLs: 0.6, tdPad: '5px 10px', tdFs: 12, matFs: 11, matPad: '4px 8px', matFw: 600 }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <caption style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        Diámetros nominales, interiores y coeficiente K para gas
      </caption>
      <thead>
        <tr>
          <Th style={{ width: '28%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Material</Th>
          <Th style={{ width: '28%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Diámetro Nominal</Th>
          <Th style={{ width: '24%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Ø Interior (mm)</Th>
          <Th style={{ width: '20%', padding: cp.thPad, fontSize: cp.thFs, letterSpacing: cp.thLs }}>Coef. K</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((grp, gi) => grp.rows.map((r: { dn: string; d: number }, ri: number) => (
          <Tr key={`${gi}-${ri}`} index={idx++}>
            {ri === 0 && (
              <td rowSpan={grp.rows.length} style={{ padding: cp.matPad, fontSize: cp.matFs, fontWeight: cp.matFw, textAlign: 'center', verticalAlign: 'middle', color: 'var(--txt2)', borderBottom: '1px solid var(--line)' }}>
                {grp.mat}
              </td>
            )}
            <Td mono center={false} style={{ padding: cp.tdPad, fontSize: cp.tdFs }}>{r.dn}</Td>
            <Td mono style={{ padding: cp.tdPad, fontSize: cp.tdFs }}>{r.d.toFixed(2).replace(/\.00$/, '')}</Td>
            <Td mono style={{ padding: cp.tdPad, fontSize: cp.tdFs }}>{grp.K.toFixed(2)}</Td>
          </Tr>
        )))}
      </tbody>
    </table>
  )
}

export function ContadoresTable() {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <caption style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        Caudales nominales de contadores por diámetro
      </caption>
      <thead>
        <tr>
          <th scope="col" className="td-mono-b" style={{ fontSize: 12, fontWeight: 700, color: HEADER_TXT, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', padding: '2px 6px', borderBottom: `1px solid ${HEADER_BORDER}`, width: '50%' }}>Diámetro</th>
          <th scope="col" className="td-mono-b" style={{ fontSize: 12, fontWeight: 700, color: HEADER_TXT, letterSpacing: 0.4, textAlign: 'center', padding: '2px 6px', borderBottom: `1px solid ${HEADER_BORDER}`, width: '50%' }}>Qn (LPS)</th>
        </tr>
      </thead>
      <tbody>
        {CONTADORES.map((c, i) => {
          const cellBorder = i < CONTADORES.length - 1 ? '1px solid var(--line)' : 'none'
          return (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg3)' : 'var(--bg)' }}>
              <td className="td-mono" style={{ fontSize: 13, color: 'var(--txt)', textAlign: 'center', padding: '1px 6px', borderBottom: cellBorder }}>{c.dn}</td>
              <td className="td-mono" style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500, textAlign: 'center', padding: '1px 6px', borderBottom: cellBorder }}>{c.q.toFixed(2)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const cmpTd = { padding: '2px 6px', fontSize: 13 }

export function MaterialesPorRedTable() {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <caption style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        Materiales recomendados por tipo de red
      </caption>
      <thead>
        <tr>
          <Th style={{ width: '30%', padding: '2px 6px', fontSize: 12, letterSpacing: 0.4 }}>Red</Th>
          <Th style={{ padding: '2px 6px', fontSize: 12, letterSpacing: 0.4 }}>Materiales</Th>
        </tr>
      </thead>
      <tbody>
        {MATERIALES_POR_RED.map((c, i) => (
          <Tr key={i} index={i}>
            <Td mono center={false} style={cmpTd}>{c.red}</Td>
            <Td center={false} style={cmpTd}>
              {'mat' in c ? c.mat : (c.mats ? c.mats.join(', ') : '')}
            </Td>
          </Tr>
        ))}
      </tbody>
    </table>
  )
}

const coefTh = {
  background: HEADER_BG,
  color: HEADER_TXT,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  padding: '1px 4px',
  borderBottom: `1px solid ${HEADER_BORDER}`,
  textAlign: 'center',
  whiteSpace: 'nowrap',
} as React.CSSProperties

const coefTd = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 500,
  padding: '0px 3px',
  textAlign: 'center',
  color: 'var(--txt)',
  borderBottom: '1px solid var(--line)',
} as React.CSSProperties

export function CoefFriccionTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--line)' }}>
        <caption style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
          Coeficientes de fricción por tipo de tubería
        </caption>
        <thead>
          <tr>
            <th scope="colgroup" colSpan={9} style={{
              padding: '2px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12,
              textTransform: 'uppercase', letterSpacing: 0.3,
              background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--txt)',
            }}>
              Coeficiente fricción tuberías
            </th>
          </tr>
          <tr>
            <th scope="col" style={{ ...coefTh, width: '14%' }}>Tipo</th>
            <th scope="col" style={{ ...coefTh, width: '14%' }}>Descripción</th>
            <th scope="col" style={{ ...coefTh, width: '10%' }}>Sistema</th>
            <th scope="col" style={{ ...coefTh, width: '7%' }}>Material</th>
            <th scope="col" style={coefTh}>Manning n</th>
            <th scope="col" style={coefTh}>Hazen C</th>
            <th scope="col" style={coefTh}>Hazen C Uso</th>
            <th scope="col" style={coefTh}>Rugosidad ε (mm)</th>
            <th scope="col" style={coefTh}>Presión Nominal</th>
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
  )
}
