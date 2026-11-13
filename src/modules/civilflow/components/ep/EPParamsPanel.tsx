/**
 * Panel "Cálculo hidráulico y potencia" del ep (Equipo de Presión): tablas 8-12 con parámetros editables del equipo, potencia comercial, caudales, HMT (altura manométrica total) y potencia de la bomba.
 * Ej: si la HMT sale negativa, la tabla 11 marca ✗ en rojo — la bomba no puede vencer el desnivel.
 * Extracción verbatim de la rama section==='params' de EPVerificationPage; el cálculo vive en epCalcs.calcularEp y llega por props.
 */
import React from 'react';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { COMM_HP } from './calcs.ts';
import { LazyInp, type EPData } from './EPShared';
import { fmtGpm, fmtHp, fmtLps, fmtM3h, fmtW, type EpVerifCalc } from './epCalcs.ts';

interface EPParamsPanelProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Resultado de calcularEp(ep) — la página orquestadora lo memoiza y lo reparte a los paneles. */
  calc: EpVerifCalc;
  editParams: boolean;
  setEditParams: React.Dispatch<React.SetStateAction<boolean>>;
  editPComercial: boolean;
  setEditPComercial: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EPParamsPanel({
  ep,
  updEP,
  calc,
  editParams,
  setEditParams,
  editPComercial,
  setEditPComercial,
}: EPParamsPanelProps) {
  return (
    <div className="flex-row-8">
      <div className="flex-col-min">
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/parametros_equipo.webp"
          iconClassName="card-icon-20"
          title="8. Parámetros del equipo — Datos del fabricante"
          bodyClassName="card-b-p0"
          headerRight={<EditButton edit={editParams} setEdit={setEditParams} />}
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Parámetros del equipo"
            thClassName="tbl-th-s"
            tdClassName="tbl-td-s"
            cols={['Parámetro', 'Valor', 'Unidad']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={[
              [
                'Eficiencia bomba (η_b)',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="etab"
                  ariaLabel="Eficiencia bomba"
                />,
                'dec',
              ],
              [
                'Eficiencia motor (η_m)',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="etam"
                  ariaLabel="Eficiencia motor"
                />,
                'dec',
              ],
              [
                'Factor de seguridad potencia',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="fs"
                  ariaLabel="Factor de seguridad potencia"
                />,
                'dec',
              ],
              [
                <span className="ep-note-600">
                  {`Ciclos/hora (n)  `}
                  {calc.ciclos > 10 ? (
                    <span className="ep-err-solid">No O.K.</span>
                  ) : (
                    <span className="ep-ok-solid">OK</span>
                  )}
                </span>,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="ciclos"
                  ariaLabel="Ciclos por hora"
                />,
                'arr/h',
              ],
              [
                'Fracción útil tanque (α)',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="alfa"
                  ariaLabel="Fracción útil tanque"
                />,
                'dec',
              ],
              [
                'Velocidad succión (V_suc)',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="vsuc"
                  ariaLabel="Velocidad succión"
                />,
                'm/s',
              ],
              [
                'Velocidad impulsión (V_imp)',
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  disabled={!editParams}
                  field="vimp"
                  ariaLabel="Velocidad impulsión"
                />,
                'm/s',
              ],
            ]}
          />
        </Card>
        {/* Tablas 6 y 7 debajo de la 5, subdividiendo su columna. */}
        <div className="flex-row-8">
          <Card
            className="ep-card-col-fill"
            iconImg="/iconos_civilflow/diseno_redes/equipos/pot_comercial_seleccionada.webp"
            iconClassName="card-icon-20"
            title="9. Potencia comercial seleccionada"
            bodyClassName="card-b-p5x8"
            headerRight={<EditButton edit={editPComercial} setEdit={setEditPComercial} />}
          >
            <div className="ep-tiny-caption">
              P calculada ={' '}
              <strong className="ep-strong-txt">
                {calc.Pins_hp > 0 ? calc.Pins_hp.toFixed(2) : '—'} HP
              </strong>{' '}
              · Comercial superior:{' '}
              <strong className="ep-strong-txt-700">{calc.autoNema} HP</strong>
            </div>
            <select
              aria-label="Potencia comercial"
              disabled={!editPComercial}
              value={ep.pcomercial || ''}
              onChange={(e) => updEP('pcomercial', e.target.value)}
              className="ep-sel ep-sel-10"
              data-editing={editPComercial ? 'true' : 'false'}
            >
              <option value="">Seleccione</option>
              {COMM_HP.map(({ hp, kw }) => (
                <option key={hp} value={String(hp)}>
                  {hp} HP ({kw} kW)
                </option>
              ))}
            </select>
            <div className="flex-row-6">
              <span className="ep-tiny-nowrap">O ingrese valor:</span>
              <LazyInp
                ep={ep}
                updEP={updEP}
                disabled={!editPComercial}
                field="pcomercial"
                ariaLabel="Potencia comercial"
                className="ds-si-46"
              />
              <span className="ep-hp-label">HP</span>
            </div>
          </Card>
          <Card
            className="ep-card-col-fill"
            iconImg="/iconos_civilflow/diseno_redes/equipos/caudales.webp"
            iconClassName="card-icon-20"
            title="10. Caudal de diseño del equipo"
            bodyClassName="card-b-p0"
          >
            <Tbl
              tableClassName="tbl-calc-fixed"
              caption="Caudales"
              thClassName="tbl-th-s"
              tdClassName="tbl-td-s"
              cols={['Parámetro', 'Valor', 'Ud.']}
              tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
              rows={[
                ['Qd = MAX(Qac, Qasc)', <span className="ep-m">{fmtLps(calc.Qd)}</span>, 'L/s'],
                ['Qd en m³/h', <span className="ep-m">{fmtM3h(calc.Qm3h)}</span>, 'm³/h'],
                ['Qd en GPM', <span className="ep-m">{fmtGpm(calc.Qgpm)}</span>, 'GPM'],
                ['Qb = Qd / Nt', <span className="ep-m">{fmtLps(calc.Qb)}</span>, 'L/s'],
              ]}
            />
          </Card>
        </div>
      </div>
      <div className="flex-col-min">
        {/* Boceto usuario: izquierda 5 + fila 6|7; derecha 8 arriba y 9 abajo. */}
        {/* Derecha: 8 arriba y 9 abajo. */}
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/altura_manometrica.webp"
          iconClassName="card-icon-20"
          title={`${calc.isRed ? '11. Altura manométrica total — Succión directa' : '11. Altura manométrica total — Succión desde cisterna'}`}
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Altura manométrica total"
            thClassName="tbl-th-s"
            tdClassName="tbl-td-s"
            cols={['Parámetro', 'Valor', 'Unidad']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={(() => {
              const r: React.ReactNode[][] = [];
              r.push([
                // RED: z_top − z_bomba · CISTERNA: z_top − z_cis (Excel CISTERNA C8).
                calc.isRed ? 'Desnivel geométrico' : 'Desnivel total Hg (z_top − z_cis)',
                <span className={calc.hgOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.hgOk ? `✓ ${calc.Hg.toFixed(2)}` : `✗ ${calc.Hg.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                // Excel C73: "Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros" (incluye otros).
                // En cisterna el Excel solo trae Hf_total (C9) — la fila "críticas" es de RED.
                calc.isRed ? 'Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros' : 'Hf total',
                <span className={calc.hfOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.hfOk
                    ? `✓ ${(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf).toFixed(2)}`
                    : `✗ ${(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf).toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                'Presión mínima punto crítico',
                <span className={calc.pminOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.pminOk ? `✓ ${calc.pmin.toFixed(2)}` : `✗ ${calc.pmin.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              if (calc.isRed)
                r.push([
                  'Presión disponible acometida',
                  <span className={calc.predOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                    {calc.predOk ? `✓ ${calc.pred.toFixed(2)}` : `✗ ${calc.pred.toFixed(2)}`}
                  </span>,
                  'm.c.a.',
                ]);
              r.push([
                <span className="ep-bold">Altura manométrica total HMT</span>,
                <span className={calc.hmtOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.hmtOk ? `✓ ${calc.HMT.toFixed(2)}` : `✗ ${calc.HMT.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                'Verificación presión máxima del sistema',
                calc.alertaPmax ? (
                  <span className="ep-err">
                    ⚠ {calc.HMT.toFixed(2)} &gt; {calc.pmax.toFixed(2)}
                  </span>
                ) : (
                  <span className="ep-ok">✓ HMT dentro del límite</span>
                ),
                'm.c.a.',
              ]);
              return r;
            })()}
          />
        </Card>

        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/potencia_bomba.webp"
          iconClassName="card-icon-20"
          title="12. Potencia de la bomba"
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Potencia de la bomba"
            thClassName="tbl-th-s"
            tdClassName="tbl-td-s"
            cols={['Parámetro', 'Valor', 'Ud.']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={[
              ['Potencia hidráulica', <span className="ep-m">{fmtW(calc.Phid)}</span>, 'W'],
              ['Potencia al freno', <span className="ep-m">{fmtW(calc.Pfreno_w)}</span>, 'W'],
              ['Potencia al freno', <span className="ep-m">{fmtHp(calc.Pfreno_hp)}</span>, 'HP'],
              [
                'Potencia calculada con factor de seguridad',
                <span className="ep-m">
                  {calc.Pins_hp > 0
                    ? `${calc.Pins_hp.toFixed(2)} HP / ${calc.Pins_kw > 0 ? calc.Pins_kw.toFixed(2) : '—'} kW`
                    : '—'}
                </span>,
                '',
              ],
              [
                'Potencia comercial seleccionada',
                <span className="ep-mb">{calc.nemaSel}</span>,
                'HP',
              ],
              [
                'Margen potencia comercial vs calculada',
                <span className={calc.pComercialOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.pComercialOk
                    ? `+${calc.margenPct.toFixed(1)}%`
                    : `${calc.margenPct.toFixed(1)}%`}
                </span>,
                '%',
              ],
              [
                'Verificación potencia comercial',
                <span className={calc.pComercialOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.pComercialOk ? '✓ Adecuada' : '⚠ Insuficiente'}
                </span>,
                '',
              ],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
