/**
 * Panel "Diámetros y especificación" del ep (Equipo de Presión): tablas 13-15 con setpoint/tanque hidroneumático, diámetros nominales de los ramales y especificación técnica, más los DN (diámetros nominales) que el usuario puede imponer.
 * Ej: si el usuario fija DN 32 en la succión, la tabla muestra la velocidad real que eso provoca.
 * Extracción verbatim de la rama results de EPVerificationPage; el cálculo vive en epEngine.ts y llega por props ya adaptado.
 */
import React from 'react';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { LazyInp, Param, type EPData } from './EPShared';
import { fmtBar, fmtGpm, fmtL, fmtLps, fmtM3h, fmtMca, fmtMm, fmtMs } from './epCalcs.ts';
import { type EpCalc } from './epAdapter.ts';
import { dec } from '../../utils/parseDecimal.ts';

interface EPResultsPanelProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Resultado de calcEpc(ep) vía epAdapter — la página lo memoiza y reparte a los paneles. */
  calc: EpCalc;
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
    <div className="flex-row-10">
      <div className="ep-card-col-fill">
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp"
          iconClassName="card-icon-22"
          title="13. Presión de setpoint y tanque hidroneumático"
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Presión de setpoint y tanque hidroneumático"
            thClassName="tbl-th-r"
            tdClassName="tbl-td-r"
            cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula']}
            tips={[
              'Nombre del parámetro.',
              'Valor calculado o ingresado.',
              'Unidad del valor.',
              'Expresión con la que se obtiene el valor.',
            ]}
            rows={[
              [
                'P mínima en la descarga (arranque mín.)',
                <span className="ep-m">{fmtMca(calc.pdesc)}</span>,
                'm.c.a.',
                'P mín. descarga = Hg + Hf_ac + Pmin',
              ],
              [
                'Presión de arranque (≥ P mín. + margen)',
                <span className="ep-m">{fmtMca(calc.Pon)}</span>,
                'm.c.a.',
                'Arranque = P mín. descarga + margen, redondeado hacia arriba',
              ],
              [
                'P objetivo del variador (setpoint)',
                <span className="ep-m">{fmtMca(calc.pset)}</span>,
                'm.c.a.',
                'P objetivo = arranque + banda / 2',
              ],
              [
                'Presión de parada',
                <span className="ep-m">{fmtMca(calc.Poff)}</span>,
                'm.c.a.',
                'Parada = arranque + banda de control',
              ],
              [
                'Presión de arranque en bar',
                <span className="ep-m">{fmtBar(calc.Pon_bar)}</span>,
                'bar',
                'Arranque en m.c.a. × 9.81 / 100',
              ],
              [
                'Presión de parada en bar',
                <span className="ep-m">{fmtBar(calc.Poff_bar)}</span>,
                'bar',
                'Parada en m.c.a. × 9.81 / 100',
              ],
              [
                'P parada máxima admisible (Perfil)',
                <span className="ep-m">{calc.poffmax != null ? fmtMca(calc.poffmax) : '—'}</span>,
                'm.c.a.',
                calc.poffmax != null && calc.poffMca > calc.poffmax
                  ? '⚠ La parada supera la admisible: VRP en los pisos bajos'
                  : 'Del Perfil de presiones: tubería y estática en aparatos',
              ],
              [
                'Tarado sugerido de la válvula de alivio (PSV)',
                <span className="ep-m">{fmtMca(calc.psv)}</span>,
                'm.c.a.',
                'PSV = máx(1,10 × parada · parada + 3); ≤ la admisible de la tubería',
              ],
              [
                'Precarga de nitrógeno N₂ = 0.90 × P_arranque',
                <span className="ep-m">{fmtBar(calc.PN2_bar)}</span>,
                'bar',
                'P_precarga = 0.90 × P_arranque',
              ],
              [
                <span className="ep-note-600">
                  Volumen útil Vu = Qmín × Tc / 4 (Qmín = %Qb · Tc = 3600/arranques)
                </span>,
                <span className="ep-m">{fmtL(calc.Vu)}</span>,
                'L',
                'Vu = Qmín × Tc / 4',
              ],
              [
                <span className="ep-strong-txt-700">
                  Volumen total tanque Vt = Vu / β (Boyle con precarga)
                </span>,
                <span className="ep-mb">{fmtL(calc.Vt)}</span>,
                'L',
                'β = (P₀+Patm)/(P_arr+Patm) − (P₀+Patm)/(P_par+Patm)',
              ],
              [
                'Volumen total tanque Vt',
                <span className="ep-m">{calc.Vt > 0 ? (calc.Vt / 1000).toFixed(2) : '—'}</span>,
                'm³',
                'Vt / 1000',
              ],
            ]}
          />
        </Card>
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp"
          iconClassName="card-icon-22"
          title="14. Diámetros nominales de tuberías del equipo"
          bodyClassName="card-b-p0"
          headerRight={<EditButton edit={editDiametros} setEdit={setEditDiametros} />}
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Diámetros nominales de tuberías del equipo"
            thClassName="tbl-th-r"
            tdClassName="tbl-td-r tbl-td-nowrap"
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
                <span className="ep-m">{fmtLps(calc.Qd)}</span>,
                <span className="ep-m">{calc.vsuc}</span>,
                <span className="ep-m">{fmtMm(calc.rSucColector.diamCalcMm)}</span>,
                <span className="ep-mb">{calc.rSucColector.dn}</span>,
                <span className="ep-m">{fmtMs(calc.rSucColector.vReal)}</span>,
              ],
              [
                'Impulsión colector (Qd)',
                <span className="ep-m">{fmtLps(calc.Qd)}</span>,
                <span className="ep-m">{calc.vimp}</span>,
                <span className="ep-m">{fmtMm(calc.rImpColector.diamCalcMm)}</span>,
                <span className="ep-mb">{calc.rImpColector.dn}</span>,
                <span className="ep-m">{fmtMs(calc.rImpColector.vReal)}</span>,
              ],
              [
                'Succión por bomba (Qb)',
                <span className="ep-m">{fmtLps(calc.Qb)}</span>,
                <span className="ep-m">{calc.vsuc}</span>,
                <span className="ep-m">{fmtMm(calc.rSucBomba.diamCalcMm)}</span>,
                <span className="ep-mb">{calc.rSucBomba.dn}</span>,
                <span className="ep-m">{fmtMs(calc.rSucBomba.vReal)}</span>,
              ],
              [
                'Impulsión por bomba (Qb)',
                <span className="ep-m">{fmtLps(calc.Qb)}</span>,
                <span className="ep-m">{calc.vimp}</span>,
                <span className="ep-m">{fmtMm(calc.rImpBomba.diamCalcMm)}</span>,
                <span className="ep-mb">{calc.rImpBomba.dn}</span>,
                <span className="ep-m">{fmtMs(calc.rImpBomba.vReal)}</span>,
              ],
            ]}
          />
        </Card>
      </div>
      <div className="ep-card-col-fill">
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/setpoint_tanque.webp"
          iconClassName="card-icon-22"
          title="15. Especificación técnica del equipo"
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Especificación técnica del equipo"
            thClassName="tbl-th-r"
            tdClassName="tbl-td-r"
            cols={['Parámetro', 'Valor']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.']}
            rows={[
              [
                'Caudal nominal',
                <span className="ep-m">
                  {fmtLps(calc.Qd)} L/s = {fmtM3h(calc.Qm3h)} m³/h = {fmtGpm(calc.Qgpm)} GPM
                </span>,
              ],
              [
                'Altura manométrica total',
                <span className="ep-m">
                  {fmtMca(calc.HMT)} m.c.a. = {fmtBar((calc.HMT * 9.81) / 100)} bar
                </span>,
              ],
              [
                'Configuración de bombas',
                <span className="ep-m">
                  {calc.nt + dec(ep.nr)} uds: {calc.nt} trabajo + {dec(ep.nr)} reserva · Qb ={' '}
                  {fmtLps(calc.Qb)} L/s c/u
                </span>,
              ],
              [
                'Potencia comercial',
                <span className="ep-m">
                  {calc.nemaSel} HP = {(calc.nemaSel * 0.7457).toFixed(0)} kW (calc:{' '}
                  {calc.Pins_hp > 0 ? calc.Pins_hp.toFixed(2) : '—'} HP)
                </span>,
              ],
              [
                'Setpoint P_arranque / P_paro',
                <span className="ep-m">
                  {fmtBar(calc.Pon_bar)} / {fmtBar(calc.Poff_bar)} bar
                </span>,
              ],
              [
                'Tanque acumulador',
                <span className="ep-m">
                  {fmtL(calc.Vt)} L · Precarga N₂ = {fmtBar(calc.PN2_bar)} bar
                </span>,
              ],
              [
                'DN succión / impulsión',
                <span className="ep-m">
                  DN {calc.rSucColector.dn} / DN {calc.rImpColector.dn} mm (PVC Sch 40)
                </span>,
              ],
              [
                'Control',
                <span className="ep-m">
                  VFD × {calc.nt + dec(ep.nr)} · Transductor 4–20 mA · PLC/SCADA
                </span>,
              ],
              [
                'Normas',
                <span className="ep-ver-mono">
                  NTC 1500:2018 · RAS 2000 Tít. B · NSR-10 Tít. H · NFPA 20
                </span>,
              ],
            ]}
          />
        </Card>
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/diametros_velocidades.webp"
          iconClassName="card-icon-22"
          title="Diámetros seleccionados por el usuario (anulan los recomendados)"
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Diámetros seleccionados por el usuario"
            thClassName="tbl-th-r"
            tdClassName="tbl-td-r"
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
                <span className="ep-m">{fmtMs(calc.sucDiam.Vreal)}</span>,
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
                <span className="ep-m">{fmtMs(calc.impDiam.Vreal)}</span>,
                'm/s',
              ],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
