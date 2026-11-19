/** Página Cisterna del diseño de ep (Equipo de Presión) — doctrina EPC (F2, ped. 2026-11-19):
 *  tabla de usos con dotaciones referenciales editables (12 categorías), geometría
 *  (altura útil / sedimentos / borde libre / 2 compartimentos), sumergencia ANSI/HI 9.8,
 *  reserva RCI bajo la toma, volumen construido con cotas (fondo/toma/NAM/NAV/losa),
 *  reposición (Q acometida ≥ Q reposición) y SVGs de planta y corte. El cálculo vive en
 *  epEngine.calcularEpc (única fuente); NPSH usa Patm por altitud y Pv Antoine (sin digitado). */
import React from 'react';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { LazyInp, Param, type EPData } from './EPShared';
import { calcEpc } from './epAdapter.ts';
import { EP_USO_CAT } from './epEngine.ts';
import { svgCorteCis, svgPlantaCis } from './epSvgCis.ts';

interface EPCisternaPageProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

const fmtMca = (v: number): string => (v !== 0 ? v.toFixed(2) : '—');

export default function EPCisternaPage({ ep, updEP }: EPCisternaPageProps) {
  const isRed = ep.modo === 'red';
  const [editSuc, setEditSuc] = React.useState(false);
  const [editCis, setEditCis] = React.useState(false);
  const [editNpsh, setEditNpsh] = React.useState(false);
  const [vista, setVista] = React.useState<'corte' | 'planta'>('corte');

  const calc = React.useMemo(() => calcEpc(ep), [ep]);
  const cis = calc.cis;
  const usos = React.useMemo(() => {
    try {
      return (JSON.parse(ep.usos || '[]') as Array<{ k: number; c: number; d: number }>).filter(
        (u) => EP_USO_CAT[u.k],
      );
    } catch {
      return [];
    }
  }, [ep.usos]);

  const setUsos = (arr: Array<{ k: number; c: number; d: number }>): void =>
    updEP('usos', JSON.stringify(arr));
  const updUso = (i: number, f: 'k' | 'c' | 'd', v: string | number): void => {
    const arr = usos.map((u, j) =>
      j === i ? { ...u, [f]: f === 'k' ? Number(v) : Number(v) || 0 } : u,
    );
    if (f === 'k') arr[i].d = EP_USO_CAT[Number(v)][2];
    setUsos(arr);
  };

  const cdia = calc.cdia;
  const npshEvaluable = Number(ep.npshr) > 0 || isRed;
  const npshrV = Number(ep.npshr) || 0;
  const npshOk = calc.npshd >= Math.max(3, npshrV + 0.5);

  const svgCis = cis
    ? vista === 'corte'
      ? svgCorteCis(cis, Number(ep.zcis), calc.vincendio > 0)
      : svgPlantaCis(cis)
    : '';

  return (
    <div className="flex-col-8">
      {isRed && (
        <div role="status" className="ep-warn-banner">
          Esta página aplica con Succión desde cisterna — cámbiate de modo en Datos de entrada.
        </div>
      )}
      <div className="flex-row-8">
        <div className="flex-col-min">
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp"
            iconClassName="card-icon-20"
            title="5. Datos de succión desde cisterna"
            bodyClassName="card-b-p0"
            headerRight={<EditButton edit={editSuc} setEdit={setEditSuc} />}
          >
            <Tbl
              tableClassName="tbl-calc-fixed"
              caption="Datos de succión desde cisterna"
              thClassName="tbl-th-r"
              tdClassName="tbl-td-r"
              cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
              tips={[
                'Nombre del parámetro.',
                'Valor calculado o ingresado.',
                'Unidad del valor.',
                'Fórmula o referencia normativa del cálculo.',
              ]}
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
                  <span className="ep-bold">
                    HMT modo CISTERNA = P objetivo + Hf_otros + (z_bomba − z_cis) + Hf_suc
                  </span>,
                  <span className="ep-mb">{fmtMca(calc.hmt)}</span>,
                  'm.c.a.',
                  'Motor: a la P objetivo del variador',
                ],
              ]}
            />
          </Card>
          {/* Cisterna: usos, geometría y reposición (ped. 2026-11-19). */}
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/config_bombas.webp"
            iconClassName="card-icon-20"
            title="6. Cisterna · usos, geometría y reposición"
            bodyClassName="card-b-p4"
            headerRight={<EditButton edit={editCis} setEdit={setEditCis} />}
          >
            <div className="ep-tiny-caption">
              1 · Consumo diario por usos — dotaciones <b>referenciales</b>: ajústelas a la norma
              del país
            </div>
            <table className="ep-usos">
              <thead>
                <tr>
                  <th>Uso</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Dotación</th>
                  <th>L/d</th>
                  <th>%</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {usos.map((u, i) => {
                  const cat = EP_USO_CAT[u.k];
                  const q = u.c * u.d;
                  return (
                    <tr key={i}>
                      <td>
                        <select
                          value={String(u.k)}
                          onChange={(e) => updUso(i, 'k', e.target.value)}
                          aria-label={`Uso ${i + 1}`}
                          disabled={!editCis}
                        >
                          {EP_USO_CAT.map((x, j) => (
                            <option key={x[0]} value={String(j)}>
                              {x[0]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={String(u.c)}
                          onChange={(e) => updUso(i, 'c', e.target.value)}
                          aria-label={`Cantidad ${i + 1}`}
                          disabled={!editCis}
                        />
                      </td>
                      <td className="ep-dim">{cat[1]}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={String(u.d)}
                          onChange={(e) => updUso(i, 'd', e.target.value)}
                          aria-label={`Dotación ${i + 1}`}
                          title={`L/${cat[1]}·d · referencial ${cat[2]}`}
                          disabled={!editCis}
                        />
                      </td>
                      <td className="ep-num">{cdia ? q.toFixed(0) : '0'}</td>
                      <td className="ep-num">{cdia ? Math.round((100 * q) / cdia) : 0}%</td>
                      <td>
                        <button
                          type="button"
                          className="ep-uso-x"
                          onClick={() => setUsos(usos.filter((_, j) => j !== i))}
                          aria-label={`Quitar uso ${i + 1}`}
                          disabled={usos.length <= 1 || !editCis}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ep-usos-foot">
              <button
                type="button"
                className="ep-btn-lt"
                onClick={() => setUsos([...usos, { k: 1, c: 0, d: EP_USO_CAT[1][2] }])}
                disabled={!editCis}
              >
                + Agregar uso
              </button>
              <span className="ep-dim">
                Consumo diario <b>{cdia.toFixed(0)} L/d</b> = {(cdia / 1000).toFixed(2)} m³/d ·
                caudal medio {(cdia / 86400).toFixed(3)} L/s
              </span>
            </div>
            <Tbl
              tableClassName="tbl-calc-fixed"
              caption="Geometría y reposición"
              thClassName="tbl-th-r"
              tdClassName="tbl-td-r"
              cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
              tips={[
                'Nombre del parámetro.',
                'Valor calculado o ingresado.',
                'Unidad del valor.',
                'Fórmula o referencia normativa del cálculo.',
              ]}
              rows={[
                [
                  <Param name="Días de autonomía" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="diasAut"
                    ariaLabel="Días de autonomía"
                    disabled={!editCis}
                  />,
                  'días',
                  'Mínimo 1',
                ],
                [
                  <Param name="Reserva contra incendio" sub="BCI — 0 si no aplica" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="bciL"
                    ariaLabel="Reserva contra incendio"
                    disabled={!editCis}
                  />,
                  'L',
                  'Queda bajo la toma doméstica: las bombas no la consumen',
                ],
                [
                  <Param name="Altura útil" sub="Entre NAM y NAV" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="cisHu"
                    ariaLabel="Altura útil"
                    disabled={!editCis}
                  />,
                  'm',
                  'Típ. 1,5–3,0 · define el área en planta',
                ],
                [
                  <Param name="Sedimentos" sub="Bajo la toma" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="cisHs"
                    ariaLabel="Sedimentos"
                    disabled={!editCis}
                  />,
                  'm',
                  'Típ. 0,10–0,15',
                ],
                [
                  <Param name="Borde libre" sub="NAV → losa; rebose en el NAV" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    field="cisBl"
                    ariaLabel="Borde libre"
                    disabled={!editCis}
                  />,
                  'm',
                  'Típ. 0,30',
                ],
                [
                  <Param
                    name="Dos compartimentos"
                    sub="50 % c/u · se lava uno sin suspender el servicio"
                  />,
                  <input
                    type="checkbox"
                    checked={ep.cisDc === 'true'}
                    onChange={(e) => updEP('cisDc', e.target.checked ? 'true' : 'false')}
                    aria-label="Dos compartimentos"
                    disabled={!editCis}
                  />,
                  '',
                  'Llenado, succión y desagüe independientes',
                ],
                ...(cis
                  ? ([
                      [
                        <span className="ep-note-600">
                          Dimensiones internas {cis.nC === 2 ? '(2 compartimentos)' : ''}
                        </span>,
                        <span className="ep-m">
                          {cis.nC === 2 ? '2 × ' : ''}
                          {cis.lC.toFixed(2)} × {cis.bC.toFixed(2)} m
                        </span>,
                        '',
                        `Área necesaria ${cis.An.toFixed(2)} m² (relación 2:1, redondeo a 0,05 m)`,
                      ],
                      [
                        <span className="ep-note-600">
                          Sumergencia S = D·(1 + 2,3·Fr) · ANSI/HI 9.8
                        </span>,
                        <span className="ep-m">
                          {cis.subS.toFixed(2)} m · D {F3mm(cis.dS)} · V {cis.vS.toFixed(2)} · Fr{' '}
                          {cis.frS.toFixed(2)}
                        </span>,
                        'm',
                        'La campana de succión requiere esta lámina de agua',
                      ],
                      ...(calc.vincendio > 0
                        ? ([
                            ['Altura reserva RCI', cis.hrci.toFixed(2), 'm', 'V RCI / A en planta'],
                          ] as React.ReactNode[][])
                        : []),
                      [
                        <span className="ep-bold">Volumen construido = A × H</span>,
                        <span className="ep-mb">
                          {cis.vgeo.toFixed(1)} m³ · H {cis.hTot.toFixed(2)} m
                        </span>,
                        '',
                        `Cotas: fondo ${cis.zFondo.toFixed(2)} · toma ${cis.zToma.toFixed(2)} · NAM ${Number(ep.zcis).toFixed(2)} · NAV ${cis.zNAV.toFixed(2)} · losa ${cis.zLosa.toFixed(2)}`,
                      ],
                      [
                        <Param name="Q acometida" sub="Medidor y presión de la red" />,
                        <LazyInp
                          ep={ep}
                          updEP={updEP}
                          field="cisQa"
                          ariaLabel="Q acometida"
                          disabled={!editCis}
                        />,
                        'L/s',
                        'Vacío = sin verificar',
                      ],
                      [
                        <Param name="Horas de suministro" sub="Servicio de la red pública" />,
                        <LazyInp
                          ep={ep}
                          updEP={updEP}
                          field="cisHsum"
                          ariaLabel="Horas de suministro"
                          disabled={!editCis}
                        />,
                        'h/d',
                        '24 = continuo',
                      ],
                      [
                        <span className="ep-bold">Verificación Q acometida ≥ Q reposición</span>,
                        <span
                          className={
                            cis.repOk == null ? 'ep-npsh-na' : cis.repOk ? 'ep-ok' : 'ep-err'
                          }
                        >
                          {cis.repOk == null
                            ? '— ingrese Q acometida'
                            : cis.repOk
                              ? `✓ cumple · requiere ${cis.qrep.toFixed(2)} L/s`
                              : `✗ no cumple · requiere ${cis.qrep.toFixed(2)} L/s${cis.tLlen != null ? ` · llenado ${cis.tLlen.toFixed(1)} h` : ''}`}
                        </span>,
                        '',
                        `Q reposición = consumo diario / ${cis.hsum} h`,
                      ],
                    ] as React.ReactNode[][])
                  : []),
              ]}
            />
          </Card>
        </div>
        <Card
          className="ep-card-col-fill"
          iconImg="/iconos_civilflow/diseno_redes/equipos/altura_manometrica.webp"
          iconClassName="card-icon-20"
          title="7. Verificación NPSH — cavitación"
          bodyClassName="card-b-p4"
          headerRight={<EditButton edit={editNpsh} setEdit={setEditNpsh} />}
        >
          <Tbl
            tableClassName="tbl-calc-fixed"
            caption="Verificación NPSH"
            thClassName="tbl-th-r"
            tdClassName="tbl-td-r"
            colClasses={['tbl-w-34', undefined, undefined, 'tbl-w-26']}
            cols={['Parámetro', 'Valor', 'Unidad', 'Fórmula / Referencia']}
            tips={[
              'Nombre del parámetro.',
              'Valor calculado o ingresado.',
              'Unidad del valor.',
              'Fórmula o referencia normativa del cálculo.',
            ]}
            rows={[
              [
                <span className="ep-note-600">Presión atmosférica (altitud del proyecto)</span>,
                <span className="ep-m">{fmtMca(calc.patm)}</span>,
                'm.c.a.',
                'Patm = 10,33·(1 − 2,2557·10⁻⁵·h)^5,2559 — de la altitud digitada en Entradas',
              ],
              [
                <span className="ep-note-600">Presión de vapor (temperatura del agua)</span>,
                <span className="ep-m">{fmtMca(calc.pvMca)}</span>,
                'm.c.a.',
                'Ecuación de Antoine — de la temperatura digitada en Entradas',
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
                <span className="ep-bold">NPSH disponible</span>,
                <span className={calc.npshd < 3 ? 'ep-err' : 'ep-ok'}>
                  {calc.npshd.toFixed(2)}
                </span>,
                'm',
                isRed
                  ? 'Patm + Pred − Hf_cuarto,suc − Pv'
                  : 'Patm + (z_cis − z_bomba) − Hf_suc − Hf_cuarto,suc − Pv',
              ],
              [
                <span className="ep-bold">Verificación NPSHd ≥ máx(3 · NPSHr + 0,5) m</span>,
                <span className={!npshEvaluable ? 'ep-npsh-na' : npshOk ? 'ep-ok' : 'ep-err'}>
                  {!npshEvaluable
                    ? '— puebla NPSHr para evaluar contra el fabricante'
                    : npshOk
                      ? '✓ Sin riesgo de cavitación'
                      : '⚠ RIESGO DE CAVITACIÓN — revisar'}
                </span>,
                '',
                '',
              ],
            ]}
          />
          {svgCis ? (
            <div className="ep-cis-svg-wrap">
              <div className="ep-cis-view">
                <button
                  type="button"
                  className={vista === 'corte' ? 'ep-cis-vb on' : 'ep-cis-vb'}
                  onClick={() => setVista('corte')}
                >
                  Corte
                </button>
                <button
                  type="button"
                  className={vista === 'planta' ? 'ep-cis-vb on' : 'ep-cis-vb'}
                  onClick={() => setVista('planta')}
                >
                  Planta
                </button>
              </div>
              {/* SVG generado por el módulo con valores numéricos formateados — sin texto de usuario. */}
              <div
                style={{ maxHeight: '44vh', overflow: 'auto' }}
                dangerouslySetInnerHTML={{ __html: svgCis }}
              />
              <p className="ep-dim">Esquema no a escala · cotas en m</p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/** dInt del DN de succión en mm (para la nota de sumergencia). */
function F3mm(d: number): string {
  return `${Math.round(d * 1000)} mm`;
}
