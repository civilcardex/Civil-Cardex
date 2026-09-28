import React from 'react';
import Card from '../shared/Card';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton';
import { LazyInp, Param, type EPData } from './EPShared';
import { calcularCisterna } from './epCalculos';

interface EPCisternaPageProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

const M = { fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--txt)' } as const;
const MB = { fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--txt)' } as const;
const OK = { fontFamily: 'var(--mono)', fontWeight: 700, color: '#22c55e' };
const ERR = { fontFamily: 'var(--mono)', fontWeight: 700, color: '#ef5350' };
const TH_R = { fontSize: 11, padding: '2px 4px' };
const TD_R = { fontSize: 11, padding: '3px 4px' };
const fmtMca = (v: number) => (v !== 0 ? v.toFixed(2) : '—');

/** Página Cisterna (Excel hoja CISTERNA): datos de succión + verificación NPSH.
 *  Solo aplica con modo = cisterna; en modo RED muestra aviso. */
export default function EPCisternaPage({ ep, updEP }: EPCisternaPageProps) {
  const isRed = ep.modo === 'red';
  const [editVol, setEditVol] = React.useState(false);
  const [editNpsh, setEditNpsh] = React.useState(false);
  const [editSuc, setEditSuc] = React.useState(false);
  // Única fuente de las fórmulas (antes triplicadas contra EPVerificationPage y el test).
  const c = calcularCisterna(ep);
  const HgTotal = c.HgTotal;
  const HfTotal = c.HfTotal;
  const HMT = c.HMT;
  const npshd = c.npshd;
  // Veredicto NPSH solo con los 3 inputs poblados: los defaults vacíos daban npshd<0 y
  // "⚠ RIESGO DE CAVITACIÓN" en rojo antes de tocar nada (falsa alarma).
  const npshOk = c.npshOk;
  const npshEvaluable = c.npshEvaluable;
  const volConsumo = c.volConsumo;
  const volTotal = c.volTotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {isRed && (
        <div
          role="status"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--r)',
            border: '1px solid rgba(255,152,0,.4)',
            background: 'rgba(255,152,0,.08)',
            color: '#ffb74d',
            fontSize: 12,
            fontFamily: 'var(--mono)',
          }}
        >
          Esta página aplica con Succión desde cisterna — cámbiate de modo en Datos de entrada.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
          <Card
            style={{ display: 'flex', flexDirection: 'column' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp"
            iconImgStyle={{ width: 20, height: 20 }}
            title="5. Datos de succión desde cisterna"
            bodyStyle={{ padding: 0 }}
            headerRight={<EditButton edit={editSuc} setEdit={setEditSuc} />}
          >
            <Tbl
              tableStyle={{ tableLayout: 'fixed' }}
              caption="Datos de succión desde cisterna"
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
              rows={[
                [
                  <Param
                    name="Nivel mínimo cisterna"
                    sub="z_cis / NAM — negativo = bajo el equipo"
                  />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="zcis"
                    ariaLabel="Nivel mínimo cisterna"
                    disabled={!editSuc}
                  />,
                  'm',
                  'Planos / topografía',
                ],
                [
                  <Param
                    name="Pérdidas tubería succión"
                    sub="Hf_suc — fondo de cisterna → bomba"
                  />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="hfcis"
                    ariaLabel="Pérdidas tubería succión cisterna"
                    disabled={!editSuc}
                  />,
                  'm.c.a.',
                  'Incluye accesorios y pie de válvula',
                ],
                [
                  <span style={{ fontWeight: 600 }}>Hg_total = z_top − z_cis</span>,
                  <span style={M}>{fmtMca(HgTotal)}</span>,
                  'm.c.a.',
                  'Del nivel mínimo de la cisterna al punto crítico',
                ],
                [
                  <span style={{ fontWeight: 600 }}>
                    Hf_total = MAX(Hf_ac, Hf_acs) + Hf_otros + Hf_suc
                  </span>,
                  <span style={M}>{fmtMca(HfTotal)}</span>,
                  'm.c.a.',
                  'Pérdidas red + pérdidas succión cisterna',
                ],
                [
                  <span style={{ fontWeight: 700 }}>
                    HMT modo CISTERNA = Hg_total + Hf_total + Pmin
                  </span>,
                  <span style={MB}>{fmtMca(HMT)}</span>,
                  'm.c.a.',
                  'Sin descuento de Pred',
                ],
              ]}
            />
          </Card>
          {/* Excel hoja CISTERNA §2. */}
          <Card
            style={{ display: 'flex', flexDirection: 'column' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/config_bombas.webp"
            iconImgStyle={{ width: 20, height: 20 }}
            title="6. Volumetría de la cisterna"
            bodyStyle={{ padding: 0 }}
            headerRight={<EditButton edit={editVol} setEdit={setEditVol} />}
          >
            <Tbl
              tableStyle={{ tableLayout: 'fixed' }}
              caption="Volumetría de la cisterna"
              thStyle={TH_R}
              tdStyle={TD_R}
              cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
              rows={[
                [
                  <Param name="Dotación diaria" sub="Por usuario" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editVol}
                    field="dotL"
                    ariaLabel="Dotación diaria"
                  />,
                  'L/u·día',
                  'RAS 2000 Tab. B.2.2 · Residencial 150–200 · Oficinas 20–25',
                ],
                [
                  <Param name="Número de usuarios" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editVol}
                    field="nUsuarios"
                    ariaLabel="Número de usuarios"
                  />,
                  'ud',
                  'Población de diseño',
                ],
                [
                  <Param name="Días de autonomía" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editVol}
                    field="diasAut"
                    ariaLabel="Días de autonomía"
                  />,
                  'días',
                  'RAS 2000 § B.3 · Mínimo 1',
                ],
                [
                  <Param name="Reserva contra incendio" sub="BCI — 0 si no aplica" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editVol}
                    field="bciL"
                    ariaLabel="Reserva contra incendio"
                  />,
                  'L',
                  'NFPA 13/14 · NSR-10 K',
                ],
                [
                  <span style={{ fontWeight: 600 }}>Volumen consumo = Dot × N × Días</span>,
                  <span style={M}>{volConsumo.toFixed(2)}</span>,
                  'L',
                  '',
                ],
                [
                  <span style={{ fontWeight: 700 }}>Volumen total cisterna</span>,
                  <span style={MB}>
                    {volTotal.toFixed(2)} L = {(volTotal / 1000).toFixed(2)} m³
                  </span>,
                  '',
                  'Consumo + incendio',
                ],
              ]}
            />
          </Card>
        </div>
        <Card
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/altura_manometrica.webp"
          iconImgStyle={{ width: 20, height: 20 }}
          title="7. Verificación NPSH — cavitación"
          bodyStyle={{ padding: 0 }}
          headerRight={<EditButton edit={editNpsh} setEdit={setEditNpsh} />}
        >
          <Tbl
            tableStyle={{ tableLayout: 'fixed' }}
            caption="Verificación NPSH"
            thStyle={TH_R}
            tdStyle={TD_R}
            // Parámetro más ancho (nombres largos de NPSH); Fórmula más angosta.
            colStyles={[
              { width: '34%', whiteSpace: 'normal' },
              undefined,
              undefined,
              { width: '26%', whiteSpace: 'normal' },
            ]}
            cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
            rows={[
              [
                <Param name="Presión atmosférica local" sub="Patm" />,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  field="patm"
                  ariaLabel="Presión atmosférica local"
                  disabled={!editNpsh}
                />,
                'm.c.a.',
                'Bogotá ~8.60 · Nivel del mar 10.33',
              ],
              [
                <Param name="Presión de vapor del agua" sub="Pv" />,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  field="pv"
                  ariaLabel="Presión de vapor del agua"
                  disabled={!editNpsh}
                />,
                'm.c.a.',
                '20°C 0.24 · 40°C 0.77 · 60°C 2.03',
              ],
              [
                <Param name="NPSHr requerido" sub="Curva del fabricante para Qb" />,
                <LazyInp
                  ep={ep}
                  updEP={updEP}
                  field="npshr"
                  ariaLabel="NPSH requerido"
                  disabled={!editNpsh}
                />,
                'm',
                'Dato del fabricante',
              ],
              [
                <span style={{ fontWeight: 600 }}>NPSHd disponible</span>,
                <span style={M}>{npshd.toFixed(2)}</span>,
                'm',
                'Patm − Pv − |z_cis| − Hf_suc',
              ],
              [
                <span style={{ fontWeight: 700 }}>Verificación NPSHd ≥ NPSHr + 0.5 m</span>,
                <span
                  style={!npshEvaluable ? { fontWeight: 600, color: '#849495' } : npshOk ? OK : ERR}
                >
                  {!npshEvaluable
                    ? '— puebla Patm, Pv y NPSHr para evaluar'
                    : npshOk
                      ? '✓ Sin riesgo de cavitación'
                      : '⚠ RIESGO DE CAVITACIÓN — revisar'}
                </span>,
                '',
                '',
              ],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
