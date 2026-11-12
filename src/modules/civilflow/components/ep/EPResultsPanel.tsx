/**
 * Panel "Diámetros y especificación" del ep (Equipo de Presión): tablas 13-15 con setpoint/tanque hidroneumático, diámetros nominales de los ramales y especificación técnica, más los DN (diámetros nominales) que el usuario puede imponer.
 * Ej: si el usuario fija DN 32 en la succión, la tabla muestra la velocidad real que eso provoca.
 * Extracción verbatim de la rama results de EPVerificationPage; el cálculo vive en epCalcs.calcularEp y llega por props.
 */
import React from 'react';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { LazyInp, M, MB, Param, type EPData } from './EPShared';
import {
  fmtBar,
  fmtGpm,
  fmtL,
  fmtLps,
  fmtM3h,
  fmtMca,
  fmtMm,
  fmtMs,
  type EpVerifCalc,
} from './epCalcs.ts';
import { TH_R, TD_R } from '../../styles/sharedTableStyles.ts';
import { dec } from '../../utils/parseDecimal.ts';

interface EPResultsPanelProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Resultado de calcularEp(ep) — la página orquestadora lo memoiza y lo reparte a los paneles. */
  calc: EpVerifCalc;
  editDiametros: boolean;
  setEditDiametros: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EPResultsPanel({
  ep,
  updEP,
  calc,
  editDiametros,
  setEditDiametros,
}: EPResultsPanelProps) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title="13. Presión de setpoint y tanque hidroneumático"
          bodyStyle={{ padding: 0 }}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Presión de setpoint y tanque hidroneumático"
            thStyle={TH_R}
            tdStyle={TD_R}
            cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula']}
            tips={[
              'Nombre del parámetro.',
              'Valor calculado o ingresado.',
              'Unidad del valor.',
              'Expresión con la que se obtiene el valor.',
            ]}
            rows={[
              [
                'Presión de arranque',
                <span style={M}>{fmtMca(calc.Pon)}</span>,
                'm.c.a.',
                'P_arranque = HMT',
              ],
              [
                'Presión de paro',
                <span style={M}>{fmtMca(calc.Poff)}</span>,
                'm.c.a.',
                'P_paro = P_arranque × 1.10',
              ],
              [
                'Presión de arranque en bar',
                <span style={M}>{fmtBar(calc.Pon_bar)}</span>,
                'bar',
                'P_arranque = HMT × 9.81 / 100',
              ],
              [
                'Presión de paro en bar',
                <span style={M}>{fmtBar(calc.Poff_bar)}</span>,
                'bar',
                'P_paro = P_arranque × 1.10',
              ],
              [
                'Precarga de nitrógeno N₂ = 0.90 × P_arranque',
                <span style={M}>{fmtBar(calc.PN2_bar)}</span>,
                'bar',
                'P_precarga = 0.90 × P_arranque',
              ],
              [
                <span style={{ fontWeight: 600 }}>Volumen útil Vu = Qd × 60 / (4 × n)</span>,
                <span style={M}>{fmtL(calc.Vu)}</span>,
                'L',
                'Vu = Qd × 60 / (4 × n)',
              ],
              [
                <span style={{ fontWeight: 700, color: 'var(--txt)' }}>
                  Volumen total tanque Vt = Vu / α
                </span>,
                <span style={MB}>{fmtL(calc.Vt)}</span>,
                'L',
                'Vt = Vu / α',
              ],
              [
                'Volumen total tanque Vt',
                <span style={M}>{calc.Vt > 0 ? (calc.Vt / 1000).toFixed(2) : '—'}</span>,
                'm³',
                'Vt / 1000',
              ],
            ]}
          />
        </Card>
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title="14. Diámetros nominales de tuberías del equipo"
          bodyStyle={{ padding: 0 }}
          headerRight={<EditButton edit={editDiametros} setEdit={setEditDiametros} />}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Diámetros nominales de tuberías del equipo"
            thStyle={TH_R}
            tdStyle={{ ...TD_R, width: '1%', whiteSpace: 'nowrap' }}
            cols={['Ramal', 'Q (L/s)', 'V diseño (m/s)', 'D calc (mm)', 'DN (mm)', 'V real (m/s)']}
            tips={[
              'Ramal del equipo.',
              'Caudal de diseño del ramal (L/s).',
              'Velocidad de diseño (m/s).',
              'Diámetro calculado (mm).',
              'Diámetro nominal comercial (mm).',
              'Velocidad real con el diámetro nominal (m/s).',
            ]}
            rows={[
              [
                'Succión colector (Qd)',
                <span style={M}>{fmtLps(calc.Qd)}</span>,
                <span style={M}>{calc.vsuc}</span>,
                <span style={M}>{fmtMm(calc.rSucColector.diamCalcMm)}</span>,
                <span style={MB}>{calc.rSucColector.dn}</span>,
                <span style={M}>{fmtMs(calc.rSucColector.vReal)}</span>,
              ],
              [
                'Impulsión colector (Qd)',
                <span style={M}>{fmtLps(calc.Qd)}</span>,
                <span style={M}>{calc.vimp}</span>,
                <span style={M}>{fmtMm(calc.rImpColector.diamCalcMm)}</span>,
                <span style={MB}>{calc.rImpColector.dn}</span>,
                <span style={M}>{fmtMs(calc.rImpColector.vReal)}</span>,
              ],
              [
                'Succión por bomba (Qb)',
                <span style={M}>{fmtLps(calc.Qb)}</span>,
                <span style={M}>{calc.vsuc}</span>,
                <span style={M}>{fmtMm(calc.rSucBomba.diamCalcMm)}</span>,
                <span style={MB}>{calc.rSucBomba.dn}</span>,
                <span style={M}>{fmtMs(calc.rSucBomba.vReal)}</span>,
              ],
              [
                'Impulsión por bomba (Qb)',
                <span style={M}>{fmtLps(calc.Qb)}</span>,
                <span style={M}>{calc.vimp}</span>,
                <span style={M}>{fmtMm(calc.rImpBomba.diamCalcMm)}</span>,
                <span style={MB}>{calc.rImpBomba.dn}</span>,
                <span style={M}>{fmtMs(calc.rImpBomba.vReal)}</span>,
              ],
            ]}
          />
        </Card>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title="15. Especificación técnica del equipo"
          bodyStyle={{ padding: 0 }}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Especificación técnica del equipo"
            thStyle={TH_R}
            tdStyle={TD_R}
            cols={['Parámetro', 'Valor']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.']}
            rows={[
              [
                'Caudal nominal',
                <span style={M}>
                  {fmtLps(calc.Qd)} L/s = {fmtM3h(calc.Qm3h)} m³/h = {fmtGpm(calc.Qgpm)} GPM
                </span>,
              ],
              [
                'Altura manométrica total',
                <span style={M}>
                  {fmtMca(calc.HMT)} m.c.a. = {fmtBar((calc.HMT * 9.81) / 100)} bar
                </span>,
              ],
              [
                'Configuración de bombas',
                <span style={M}>
                  {calc.nt + dec(ep.nr)} uds: {calc.nt} trabajo + {dec(ep.nr)} reserva · Qb ={' '}
                  {fmtLps(calc.Qb)} L/s c/u
                </span>,
              ],
              [
                'Potencia comercial',
                <span style={M}>
                  {calc.nemaSel} HP = {(calc.nemaSel * 0.7457).toFixed(0)} kW (calc:{' '}
                  {calc.Pins_hp > 0 ? calc.Pins_hp.toFixed(2) : '—'} HP)
                </span>,
              ],
              [
                'Setpoint P_arranque / P_paro',
                <span style={M}>
                  {fmtBar(calc.Pon_bar)} / {fmtBar(calc.Poff_bar)} bar
                </span>,
              ],
              [
                'Tanque acumulador',
                <span style={M}>
                  {fmtL(calc.Vt)} L · Precarga N₂ = {fmtBar(calc.PN2_bar)} bar
                </span>,
              ],
              [
                'DN succión / impulsión',
                <span style={M}>
                  DN {calc.rSucColector.dn} / DN {calc.rImpColector.dn} mm (PVC Sch 40)
                </span>,
              ],
              [
                'Control',
                <span style={M}>
                  VFD × {calc.nt + dec(ep.nr)} · Transductor 4–20 mA · PLC/SCADA
                </span>,
              ],
              [
                'Normas',
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt4)' }}>
                  NTC 1500:2018 · RAS 2000 Tít. B · NSR-10 Tít. H · NFPA 20
                </span>,
              ],
            ]}
          />
        </Card>
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title="Diámetros seleccionados por el usuario (anulan los recomendados)"
          bodyStyle={{ padding: 0 }}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Diámetros seleccionados por el usuario"
            thStyle={TH_R}
            tdStyle={TD_R}
            cols={['Parámetro', 'Valor', 'Unidad']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={[
              [
                <Param name="Tubería de succión" sub="Diámetro nominal comercial" />,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editDiametros}
                  field="dnsuc"
                  ariaLabel="Tubería de succión"
                />,
                'mm DN',
              ],
              [
                'Velocidad real en succión',
                <span style={M}>{fmtMs(calc.sucDiam.Vreal)}</span>,
                'm/s',
              ],
              [
                <Param name="Tubería de impulsión" sub="Diámetro nominal comercial" />,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editDiametros}
                  field="dnimp"
                  ariaLabel="Tubería de impulsión"
                />,
                'mm DN',
              ],
              [
                'Velocidad real en impulsión',
                <span style={M}>{fmtMs(calc.impDiam.Vreal)}</span>,
                'm/s',
              ],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
