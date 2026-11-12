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
import { LazyInp, M, MB, type EPData } from './EPShared';
import { fmtGpm, fmtHp, fmtLps, fmtM3h, fmtW, type EpVerifCalc } from './epCalcs.ts';
import { SI } from '../../styles/sharedTableStyles.ts';

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

const OK = { fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ok)' };
const ERR = { fontFamily: 'var(--mono)', fontWeight: 700, color: '#ef5350' };

const TH_S = { fontSize: 10, padding: '2px 4px' };
const TD_S = { fontSize: 10, padding: '2px 4px' };

const selStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--line)',
  background: 'var(--bg2)',
  color: 'var(--txt)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 600,
  boxSizing: 'border-box',
};

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
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/parametros_equipo.webp"
          iconImgStyle={{ width: 20, height: 20 }}
          title="8. Parámetros del equipo — Datos del fabricante"
          bodyStyle={{ padding: 0 }}
          headerRight={<EditButton edit={editParams} setEdit={setEditParams} />}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Parámetros del equipo"
            thStyle={TH_S}
            tdStyle={TD_S}
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
                <span style={{ fontWeight: 600 }}>
                  {`Ciclos/hora (n)  `}
                  {calc.ciclos > 10 ? (
                    <span style={{ fontWeight: 700, color: '#ef5350' }}>No O.K.</span>
                  ) : (
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>OK</span>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Card
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/pot_comercial_seleccionada.webp"
            iconImgStyle={{ width: 20, height: 20 }}
            title="9. Potencia comercial seleccionada"
            bodyStyle={{ padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}
            headerRight={<EditButton edit={editPComercial} setEdit={setEditPComercial} />}
          >
            <div style={{ fontSize: 10, color: 'var(--txt3)' }}>
              P calculada ={' '}
              <strong style={{ color: 'var(--txt)' }}>
                {calc.Pins_hp > 0 ? calc.Pins_hp.toFixed(2) : '—'} HP
              </strong>{' '}
              · Comercial superior:{' '}
              <strong style={{ color: 'var(--txt)', fontWeight: 700 }}>{calc.autoNema} HP</strong>
            </div>
            <select
              aria-label="Potencia comercial"
              disabled={!editPComercial}
              value={ep.pcomercial || ''}
              onChange={(e) => updEP('pcomercial', e.target.value)}
              style={{
                ...selStyle,
                fontSize: 10,
                padding: '4px 6px',
                cursor: editPComercial ? 'pointer' : 'default',
                opacity: editPComercial ? 1 : 0.7,
              }}
            >
              <option value="">Seleccione</option>
              {COMM_HP.map(({ hp, kw }) => (
                <option key={hp} value={String(hp)}>
                  {hp} HP ({kw} kW)
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                O ingrese valor:
              </span>
              <LazyInp
                ep={ep}
                updEP={updEP}
                disabled={!editPComercial}
                field="pcomercial"
                ariaLabel="Potencia comercial"
                style={{ ...SI, width: 46, fontSize: 10, padding: '2px 4px' }}
              />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                }}
              >
                HP
              </span>
            </div>
          </Card>
          <Card
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/caudales.webp"
            iconImgStyle={{ width: 20, height: 20 }}
            title="10. Caudal de diseño del equipo"
            bodyStyle={{ padding: 0 }}
          >
            <Tbl
              tableStyle={{ tableLayout: 'fixed' }}
              caption="Caudales"
              thStyle={TH_S}
              tdStyle={TD_S}
              cols={['Parámetro', 'Valor', 'Ud.']}
              tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
              rows={[
                ['Qd = MAX(Qac, Qasc)', <span style={M}>{fmtLps(calc.Qd)}</span>, 'L/s'],
                ['Qd en m³/h', <span style={M}>{fmtM3h(calc.Qm3h)}</span>, 'm³/h'],
                ['Qd en GPM', <span style={M}>{fmtGpm(calc.Qgpm)}</span>, 'GPM'],
                ['Qb = Qd / Nt', <span style={M}>{fmtLps(calc.Qb)}</span>, 'L/s'],
              ]}
            />
          </Card>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
        {/* Boceto usuario: izquierda 5 + fila 6|7; derecha 8 arriba y 9 abajo. */}
        {/* Derecha: 8 arriba y 9 abajo. */}
        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/altura_manometrica.webp"
          iconImgStyle={{ width: 20, height: 20 }}
          title={`${calc.isRed ? '11. Altura manométrica total — Succión directa' : '11. Altura manométrica total — Succión desde cisterna'}`}
          bodyStyle={{ padding: 0 }}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Altura manométrica total"
            thStyle={TH_S}
            tdStyle={TD_S}
            cols={['Parámetro', 'Valor', 'Unidad']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={(() => {
              const r: React.ReactNode[][] = [];
              r.push([
                // RED: z_top − z_bomba · CISTERNA: z_top − z_cis (Excel CISTERNA C8).
                calc.isRed ? 'Desnivel geométrico' : 'Desnivel total Hg (z_top − z_cis)',
                <span style={calc.hgOk ? OK : ERR}>
                  {calc.hgOk ? `✓ ${calc.Hg.toFixed(2)}` : `✗ ${calc.Hg.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                // Excel C73: "Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros" (incluye otros).
                // En cisterna el Excel solo trae Hf_total (C9) — la fila "críticas" es de RED.
                calc.isRed ? 'Hf crítica = MAX(Hf_ac, Hf_acs) + Hf_otros' : 'Hf total',
                <span style={calc.hfOk ? OK : ERR}>
                  {calc.hfOk
                    ? `✓ ${(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf).toFixed(2)}`
                    : `✗ ${(calc.isRed ? calc.HfCrit + calc.hfotros : calc.Hf).toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                'Presión mínima punto crítico',
                <span style={calc.pminOk ? OK : ERR}>
                  {calc.pminOk ? `✓ ${calc.pmin.toFixed(2)}` : `✗ ${calc.pmin.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              if (calc.isRed)
                r.push([
                  'Presión disponible acometida',
                  <span style={calc.predOk ? OK : ERR}>
                    {calc.predOk ? `✓ ${calc.pred.toFixed(2)}` : `✗ ${calc.pred.toFixed(2)}`}
                  </span>,
                  'm.c.a.',
                ]);
              r.push([
                <span style={{ fontWeight: 700 }}>Altura manométrica total HMT</span>,
                <span style={calc.hmtOk ? OK : ERR}>
                  {calc.hmtOk ? `✓ ${calc.HMT.toFixed(2)}` : `✗ ${calc.HMT.toFixed(2)}`}
                </span>,
                'm.c.a.',
              ]);
              r.push([
                'Verificación presión máxima del sistema',
                calc.alertaPmax ? (
                  <span style={ERR}>
                    ⚠ {calc.HMT.toFixed(2)} &gt; {calc.pmax.toFixed(2)}
                  </span>
                ) : (
                  <span style={OK}>✓ HMT dentro del límite</span>
                ),
                'm.c.a.',
              ]);
              return r;
            })()}
          />
        </Card>

        <Card
          style={{ display: 'flex', flexDirection: 'column' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/potencia_bomba.webp"
          iconImgStyle={{ width: 20, height: 20 }}
          title="12. Potencia de la bomba"
          bodyStyle={{ padding: 0 }}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Potencia de la bomba"
            thStyle={TH_S}
            tdStyle={TD_S}
            cols={['Parámetro', 'Valor', 'Ud.']}
            tips={['Nombre del parámetro.', 'Valor calculado o ingresado.', 'Unidad del valor.']}
            rows={[
              ['Potencia hidráulica', <span style={M}>{fmtW(calc.Phid)}</span>, 'W'],
              ['Potencia al freno', <span style={M}>{fmtW(calc.Pfreno_w)}</span>, 'W'],
              ['Potencia al freno', <span style={M}>{fmtHp(calc.Pfreno_hp)}</span>, 'HP'],
              [
                'Potencia calculada con factor de seguridad',
                <span style={M}>
                  {calc.Pins_hp > 0
                    ? `${calc.Pins_hp.toFixed(2)} HP / ${calc.Pins_kw > 0 ? calc.Pins_kw.toFixed(2) : '—'} kW`
                    : '—'}
                </span>,
                '',
              ],
              ['Potencia comercial seleccionada', <span style={MB}>{calc.nemaSel}</span>, 'HP'],
              [
                'Margen potencia comercial vs calculada',
                <span style={calc.pComercialOk ? OK : ERR}>
                  {calc.pComercialOk
                    ? `+${calc.margenPct.toFixed(1)}%`
                    : `${calc.margenPct.toFixed(1)}%`}
                </span>,
                '%',
              ],
              [
                'Verificación potencia comercial',
                <span style={calc.pComercialOk ? OK : ERR}>
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
