/**
 * Panel "Cálculo hidráulico y potencia" del ep (Equipo de Presión): tablas 8-12 con parámetros editables del equipo, potencia comercial, caudales, HMT (altura manométrica total) y potencia de la bomba.
 * Ej: si la HMT sale negativa, la tabla 11 marca ✗ en rojo — la bomba no puede vencer el desnivel.
 * Extracción verbatim de la rama section==='params' de EPVerificationPage; el cálculo vive en epEngine.ts y llega por props ya adaptado.
 */
import React from 'react';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { EP_HP2KW, EP_POT_COM_HP } from './epEngine.ts';
import { LazyInp, type EPData } from './EPShared';
import { fmtGpm, fmtHp, fmtLps, fmtM3h, fmtMca, fmtW } from './epCalcs.ts';
import { fmtUn, unS, type EpUn } from './epUnidades.ts';
import { type EpCalc } from './epAdapter.ts';

interface EPParamsPanelProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Resultado de calcEpc(ep) vía epAdapter — la página lo memoiza y reparte a los paneles. */
  calc: EpCalc;
  editParams: boolean;
  setEditParams: React.Dispatch<React.SetStateAction<boolean>>;
  editPComercial: boolean;
  setEditPComercial: React.Dispatch<React.SetStateAction<boolean>>;
  /** Unidad de presentación activa (solo convierte lo que se ve; el motor sigue en m.c.a.). */
  unidad: EpUn;
}

export default function EPParamsPanel({
  ep,
  updEP,
  calc,
  editParams,
  setEditParams,
  editPComercial,
  setEditPComercial,
  unidad,
}: EPParamsPanelProps) {
  return (
    <div className="flex-row-8" style={{ alignItems: 'flex-start' }}>
      <div className="flex-col-min" style={{ gap: 5 }}>
        {/* Bloque 7a (ped. 2026-11-20): el contrato con el proveedor — lo que el equipo
         *  DEBE garantizar, con la nota de optimización del proveedor. */}
        <Card
          className="ep-card-col"
          iconImg="/iconos_civilflow/diseno_redes/equipos/parametros_equipo.webp"
          iconClassName="card-icon-20"
          title="7. Parámetros de diseño a garantizar"
          bodyClassName="card-b-p0"
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Parámetros de diseño a garantizar"
            thClassName="tbl-th-s"
            tdClassName="tbl-td-s"
            cols={['Parámetro', 'Valor', 'Unidad']}
            tips={['Nombre del parámetro.', 'Valor calculado.', 'Unidad del valor.']}
            rows={[
              ['Caudal de diseño Qd', <span className="ep-m">{fmtLps(calc.Qd)}</span>, 'L/s'],
              [
                'P mínima en la descarga (arranque mín.)',
                <span className="ep-m">{fmtUn(calc.pdesc, unidad)}</span>,
                unS(unidad),
              ],
              [
                'P de parada máxima admisible',
                <span className="ep-m">
                  {calc.poffmax != null ? fmtUn(calc.poffmax, unidad) : '—'}
                </span>,
                unS(unidad),
              ],
              [
                calc.isRed ? 'P mínima en la succión (Pred)' : 'Nivel mínimo de la cisterna (NAM)',
                <span className="ep-m">
                  {calc.isRed ? fmtUn(calc.pred, unidad) : fmtMca(calc.zcis)}
                </span>,
                calc.isRed ? unS(unidad) : 'm',
              ],
              ['NPSH disponible', <span className="ep-m">{fmtMca(calc.npshd)}</span>, 'm'],
              [
                'Presión máxima del sistema',
                <span className="ep-m">{fmtUn(calc.pmax, unidad)}</span>,
                unS(unidad),
              ],
              ['Cota de la descarga', <span className="ep-m">{fmtMca(calc.zbomba)}</span>, 'm'],
              [
                'Bombas de reserva',
                <span className="ep-m">{`≥ ${Math.max(1, calc.nr)}`}</span>,
                'ud',
              ],
            ]}
          />
          <p className="ep-comment" style={{ padding: '4px 10px 8px' }}>
            El proveedor puede optimizar configuración, bombas, potencia, tanque y montaje, siempre
            que garantice estos parámetros.
          </p>
        </Card>
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
      </div>
      <div className="flex-col-min" style={{ gap: 5 }}>
        {/* 9 y 10 una al lado de la otra, arriba de la 11 (ped. usuario 2026-11-20). */}
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
              value={ep.potSel || ''}
              onChange={(e) => updEP('potSel', e.target.value)}
              className="ep-sel ep-sel-10"
              data-editing={editPComercial ? 'true' : 'false'}
            >
              <option value="">Sugerida ({calc.autoNema} HP)</option>
              {EP_POT_COM_HP.filter((p) => p >= calc.Pins_hp * 0.6)
                .slice(0, 12)
                .map((hp) => (
                  <option key={hp} value={String(hp)}>
                    {hp} HP ({EP_HP2KW[hp] || (hp * 0.7457).toFixed(1)} kW)
                  </option>
                ))}
            </select>
            <div className="flex-row-6">
              <span className="ep-tiny-nowrap">O ingrese valor:</span>
              <LazyInp
                ep={ep}
                updEP={updEP}
                disabled={!editPComercial}
                field="potSel"
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
                  {calc.hgOk ? `✓ ${fmtUn(calc.Hg, unidad)}` : `✗ ${fmtUn(calc.Hg, unidad)}`}
                </span>,
                unS(unidad),
              ]);
              r.push([
                // Excel C73: "Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros" (incluye otros).
                // En cisterna el Excel solo trae Hf_total (C9) — la fila "críticas" es de RED.
                calc.isRed ? 'Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros' : 'Hf total',
                <span className={calc.hfOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.hfOk
                    ? `✓ ${fmtUn(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf, unidad)}`
                    : `✗ ${fmtUn(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf, unidad)}`}
                </span>,
                unS(unidad),
              ]);
              r.push([
                'Presión mínima punto crítico',
                <span className={calc.pminOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.pminOk ? `✓ ${fmtUn(calc.pmin, unidad)}` : `✗ ${fmtUn(calc.pmin, unidad)}`}
                </span>,
                unS(unidad),
              ]);
              if (calc.isRed)
                r.push([
                  'Presión disponible acometida',
                  <span className={calc.predOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                    {calc.predOk
                      ? `✓ ${fmtUn(calc.pred, unidad)}`
                      : `✗ ${fmtUn(calc.pred, unidad)}`}
                  </span>,
                  unS(unidad),
                ]);
              r.push([
                <span className="ep-bold">Altura manométrica total HMT</span>,
                <span className={calc.hmtOk ? 'ep-ok-solid' : 'ep-err-solid'}>
                  {calc.hmtOk ? `✓ ${fmtUn(calc.HMT, unidad)}` : `✗ ${fmtUn(calc.HMT, unidad)}`}
                </span>,
                unS(unidad),
              ]);
              r.push([
                'Verificación presión máxima del sistema',
                calc.alertaPmax ? (
                  <span className="ep-err">
                    ⚠ {fmtUn(calc.HMT, unidad)} &gt; {fmtUn(calc.pmax, unidad)}
                  </span>
                ) : (
                  <span className="ep-ok">✓ HMT dentro del límite</span>
                ),
                unS(unidad),
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
