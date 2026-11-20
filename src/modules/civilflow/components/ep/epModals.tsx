/** Los 3 modales de referencia del EPC (ped. 2026-11-20 — port de mdl-modal del HTML de referencia),
 *  todos sobre ModalShell (regla del repo):
 *  - EpAparatosModal: tabla de 20 aparatos con 3 niveles [Mínima|Confort|Máxima]; click en
 *    una fila carga el confort en Pmin y cierra (igual que setAparato del HTML).
 *  - EpSimbologiaModal: 32 símbolos en 6 grupos, filtrados por montaje.
 *  - EpCisternaModal: usos+geometría+notas a la izquierda y Corte/Planta SVG + tabla
 *    cis-res a la derecha (el contenido del modal usos-modal). */
import React from 'react';
import { ModalShell } from '../../../../components/shared/ModalShell.tsx';
import { EP_APARATOS } from './epAparatos.ts';
import { simbDe } from './epSymbols.ts';
import { svgCorteCis, svgPlantaCis } from './epSvgCis.ts';
import { type EpcR } from './epEngine.ts';

const F = (n: number, d = 2): string =>
  isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

/** Modal de PRESIONES EN APARATOS: click en una fila → confort a Pmin. Ej: <EpAparatosModal
 *  ep={ep} onPick={(i)=>setAparato(i)} cerrar={…}/> con apIdx = -1 para «otro». */
export function EpAparatosModal({
  apIdx,
  onPick,
  cerrar,
}: {
  apIdx: number;
  onPick: (i: number) => void;
  cerrar: () => void;
}): React.JSX.Element {
  return (
    <ModalShell ariaLabel="Presiones en aparatos" minWidth={640} onClose={cerrar}>
      <div className="ep-imp">
        <button type="button" className="ep-modal-x" aria-label="Cerrar" onClick={cerrar}>
          ✕
        </button>
        <h3 className="ep-imp-h">
          Presiones en aparatos — valores de referencia <span className="ep-dim">(m.c.a.)</span>
        </h3>
        <p className="ep-dim">
          Al elegir un aparato se carga su presión de <b>confort</b> en Pmin. Pmin es editable entre
          la mínima y la máxima; por debajo del confort se acepta con alerta (grifería de baja
          presión). Ajuste a la norma del país y a la ficha del fabricante.
        </p>
        <div className="ep-sb-card">
          <table className="ep-rev-tab ep-ap-tab">
            <thead>
              <tr>
                <th>Aparato</th>
                <th style={{ textAlign: 'right' }}>Mínima</th>
                <th style={{ textAlign: 'right' }}>Confort</th>
                <th style={{ textAlign: 'right' }}>Máxima</th>
              </tr>
            </thead>
            <tbody>
              {EP_APARATOS.map((a, i) => (
                <tr
                  key={a.nombre}
                  className={`ep-ap-row${i === apIdx ? ' sel' : ''}`}
                  onClick={() => {
                    onPick(i);
                    cerrar();
                  }}
                  title={a.nota}
                >
                  <td>
                    {a.nombre}
                    {a.nota ? <i className="ep-dim"> *</i> : null}
                  </td>
                  <td className="n">{F(a.min)}</td>
                  <td className="n ep-ok">{F(a.confort)}</td>
                  <td className="n">{F(a.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ep-dim">
          <b>Mínima:</b> funciona con grifería de baja presión (tanque elevado) · <b>Confort:</b>{' '}
          grifería estándar en sistema presurizado, IPC Tabla 604.3 · <b>Máxima:</b> estática, IPC
          604.8 (80 psi). * Ver nota al pasar el mouse.
        </p>
      </div>
    </ModalShell>
  );
}

/** Modal de SIMBOLOGÍA: 32 términos en 6 grupos (columnas), filtrados por montaje.
 *  Ej: <EpSimbologiaModal modo="red" cerrar={…}/> solo muestra las filas de red. */
export function EpSimbologiaModal({
  modo,
  cerrar,
}: {
  modo: 'red' | 'cisterna';
  cerrar: () => void;
}): React.JSX.Element {
  const filas = simbDe(modo === 'cisterna' ? 'cis' : 'red');
  /* Grupos contiguos → tarjetas: cada grupo con su banda azul y sus filas, en grid de 3
   *  columnas — cabe sin scroll vertical (el columns CSS partía los grupos a mitad). */
  const grupos: Array<{ g: string; filas: typeof filas }> = [];
  for (const x of filas) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult.g === x[0]) ult.filas.push(x);
    else grupos.push({ g: x[0], filas: [x] });
  }
  /* Orden pedido (ped. usuario 2026-11-20): la 1ª columna apila Caudales → Equipo y
   *  tuberías → Cotas y cisterna, una debajo de la otra; Presiones y Control llenan las
   *  otras dos. Grupos no previstos caen al final en su propia tarjeta. */
  const porNombre = new Map(grupos.map((gr) => [gr.g, gr]));
  const quitar = (g: string): (typeof grupos)[number] | undefined => {
    const gr = porNombre.get(g);
    porNombre.delete(g);
    return gr;
  };
  const col1 = [quitar('Caudales'), quitar('Equipo y tuberías'), quitar('Cotas y cisterna')].filter(
    (x): x is (typeof grupos)[number] => !!x,
  );
  const col2 = [quitar('Presiones y alturas')].filter((x): x is (typeof grupos)[number] => !!x);
  const col3 = [quitar('Control y tanque'), ...grupos.filter((g) => porNombre.has(g.g))].filter(
    (x): x is (typeof grupos)[number] => !!x,
  );
  const columnas = [col1, col2, col3];
  const tarjeta = (gr: (typeof grupos)[number]): React.JSX.Element => (
    <div className="ep-sb-card" key={gr.g}>
      <div className="ep-sb-h">{gr.g}</div>
      {gr.filas.map((x, i) => (
        <div className="ep-sb-r" key={`${x[1]}-${i}`}>
          <b>{x[1]}</b>
          <span>
            {x[2]}
            {x[4] ? (
              <i className="ep-dim">
                {' '}
                ({x[4] === 'red' ? 'succión de la red' : 'succión de cisterna'})
              </i>
            ) : null}
          </span>
          <em>{x[3]}</em>
        </div>
      ))}
    </div>
  );
  return (
    <ModalShell ariaLabel="Simbología del módulo EPC" minWidth={1100} onClose={cerrar}>
      <div className="ep-imp">
        <button type="button" className="ep-modal-x" aria-label="Cerrar" onClick={cerrar}>
          ✕
        </button>
        <h3 className="ep-imp-h">Simbología del módulo EPC</h3>
        <div className="ep-sb-grid">
          {columnas.map((col, ci) => (
            <div className="ep-sb-col" key={ci}>
              {col.map(tarjeta)}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

/** Modal de CISTERNA (usos, geometría y reposición) — el contenido del modal usos-modal:
 *  usos+geometría+notas a la izquierda; Corte/Planta SVG + tabla resumen a la derecha.
 *  Requiere modo cisterna (el llamador lo gatea). Ej: <EpCisternaModal calc={calc} …/>. */
export function EpCisternaModal({
  calc,
  ep,
  updEP,
  cerrar,
}: {
  calc: EpcR;
  ep: EPDataLite;
  updEP: (field: string, val: string) => void;
  cerrar: () => void;
}): React.JSX.Element | null {
  const [vista, setVista] = React.useState<'corte' | 'planta'>('corte');
  const cis = calc.cis;
  if (!cis) return null;
  const usos = parseUsosSafe(ep.usos);
  const cdia = calc.cdia;
  const setUso = (i: number, f: 'k' | 'c' | 'd', v: string): void => {
    const arr = usos.map((u, j) =>
      j === i ? { ...u, [f]: f === 'k' ? Number(v) : Number(v) || 0 } : u,
    );
    if (f === 'k') arr[i].d = EP_USO_CAT[Number(v)]?.[2] ?? arr[i].d;
    updEP('usos', JSON.stringify(arr));
  };
  const svg =
    vista === 'corte' ? svgCorteCis(cis, Number(ep.zcis), calc.vincendio > 0) : svgPlantaCis(cis);
  return (
    <ModalShell ariaLabel="Cisterna · usos, geometría y reposición" minWidth={880}>
      <div
        className="ep-imp"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 14 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div className="ep-cis-t">1 · Consumo diario por usos</div>
          <p className="ep-dim">
            Dotaciones <b>referenciales</b>: ajústelas a la norma del país.
          </p>
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
                        onChange={(e) => setUso(i, 'k', e.target.value)}
                        aria-label={`Uso ${i + 1}`}
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
                        onChange={(e) => setUso(i, 'c', e.target.value)}
                        aria-label={`Cantidad ${i + 1}`}
                      />
                    </td>
                    <td className="ep-dim">{cat[1]}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={String(u.d)}
                        onChange={(e) => setUso(i, 'd', e.target.value)}
                        aria-label={`Dotación ${i + 1}`}
                        title={`L/${cat[1]}·d · referencial ${cat[2]}`}
                      />
                    </td>
                    <td className="ep-num">{cdia ? q.toFixed(0) : '0'}</td>
                    <td className="ep-num">{cdia ? Math.round((100 * q) / cdia) : 0}%</td>
                    <td>
                      <button
                        type="button"
                        className="ep-uso-x"
                        onClick={() =>
                          updEP('usos', JSON.stringify(usos.filter((_, j) => j !== i)))
                        }
                        aria-label={`Quitar uso ${i + 1}`}
                        disabled={usos.length <= 1}
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
              onClick={() =>
                updEP('usos', JSON.stringify([...usos, { k: 1, c: 0, d: EP_USO_CAT[1][2] }]))
              }
            >
              + Agregar uso
            </button>
            <span className="ep-dim">
              Consumo diario <b>{cdia.toFixed(0)} L/d</b> = {(cdia / 1000).toFixed(2)} m³/d
            </span>
          </div>
          <div className="ep-cis-t">2 · Geometría y reposición</div>
          <div className="ep-cis-f">
            <label>
              <span>Altura útil</span>
              <input
                type="number"
                step="0.1"
                min="0.3"
                value={ep.cisHu}
                onChange={(e) => updEP('cisHu', e.target.value)}
              />
              <i>m</i>
            </label>
            <label>
              <span>Sedimentos</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={ep.cisHs}
                onChange={(e) => updEP('cisHs', e.target.value)}
              />
              <i>m</i>
            </label>
            <label>
              <span>Borde libre</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={ep.cisBl}
                onChange={(e) => updEP('cisBl', e.target.value)}
              />
              <i>m</i>
            </label>
            <label>
              <span>Q acometida</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={ep.cisQa}
                onChange={(e) => updEP('cisQa', e.target.value)}
              />
              <i>L/s</i>
            </label>
            <label>
              <span>Horas de suministro</span>
              <input
                type="number"
                step="1"
                min="1"
                max="24"
                value={ep.cisHsum}
                onChange={(e) => updEP('cisHsum', e.target.value)}
              />
              <i>h/d</i>
            </label>
            <label style={{ gridTemplateColumns: '1fr auto' }}>
              <span>Dos compartimentos</span>
              <input
                type="checkbox"
                checked={ep.cisDc === 'true'}
                onChange={(e) => updEP('cisDc', e.target.checked ? 'true' : 'false')}
              />
            </label>
          </div>
          <div className="ep-cis-t">3 · Notas</div>
          <ul className="ep-dim" style={{ paddingLeft: 16, lineHeight: 1.4 }}>
            <li>Desagüe y rebose a caja de descarga libre (brecha de aire ≥ 2 Ø) y sifón.</li>
            <li>
              Fondo con pendiente ≥ 1 % hacia el sumidero de lodos; tapas ≥ 0,60 × 0,60 m con borde
              elevado; ventilación con malla.
            </li>
            <li>
              Dimensiones internas libres: espesores, refuerzo e impermeabilización según el diseño
              estructural.
            </li>
          </ul>
          <div className="ep-imp-btns">
            <button type="button" className="ep-btn-az" onClick={cerrar}>
              Listo
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
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
          <div
            style={{ maxHeight: '44vh', overflow: 'auto' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <table className="ep-rev-tab">
            <tbody>
              <tr>
                <td>Dimensiones internas {cis.nC === 2 ? '(2 compartimentos)' : ''}</td>
                <td className="n">
                  {cis.nC === 2 ? '2 × ' : ''}
                  {cis.lC.toFixed(2)} × {cis.bC.toFixed(2)} m
                </td>
              </tr>
              <tr>
                <td>Sumergencia S = D·(1 + 2,3·Fr) · ANSI/HI 9.8</td>
                <td className="n">{cis.subS.toFixed(2)} m</td>
              </tr>
              {calc.vincendio > 0 ? (
                <tr>
                  <td>Altura reserva RCI</td>
                  <td className="n">{cis.hrci.toFixed(2)} m</td>
                </tr>
              ) : null}
              <tr>
                <td>
                  <b>Volumen construido = A × H</b>
                </td>
                <td className="n">
                  <b>{cis.vgeo.toFixed(1)} m³</b>
                </td>
              </tr>
              <tr>
                <td>Q reposición = consumo / {cis.hsum} h</td>
                <td className="n">{cis.qrep.toFixed(2)} L/s</td>
              </tr>
              <tr>
                <td>Q acometida ≥ Q reposición</td>
                <td className={`n ${cis.repOk == null ? 'ep-dim' : cis.repOk ? 'ep-ok' : 'ep-er'}`}>
                  {cis.repOk == null ? 'sin verificar' : cis.repOk ? '✓ cumple' : '✗ no cumple'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ModalShell>
  );
}

// forma mínima de EPData que el modal cisterna lee (evita el import circular)
interface EPDataLite {
  usos: string;
  zcis: string;
  cisHu: string;
  cisHs: string;
  cisBl: string;
  cisQa: string;
  cisHsum: string;
  cisDc: string;
}
const EP_USO_CAT: Array<[string, string, number]> = [
  ['Vivienda', 'hab', 150],
  ['Oficinas', 'm²', 6],
  ['Comercio / locales', 'm²', 6],
  ['Restaurante / cafetería', 'm²', 40],
  ['Hotel / hospedaje', 'huésped', 300],
  ['Educación', 'alumno', 50],
  ['Salud / consultorio', 'consult.', 500],
  ['Gimnasio / club', 'usuario', 60],
  ['Piscina (reposición)', 'm²', 10],
  ['Riego zonas verdes', 'm²', 2],
  ['Parqueadero cubierto', 'm²', 2],
  ['Otro consumo fijo', 'L/d', 1],
];
function parseUsosSafe(json: string): Array<{ k: number; c: number; d: number }> {
  try {
    const arr = JSON.parse(json || '[]') as Array<{ k: number; c: number; d: number }>;
    return Array.isArray(arr) ? arr.filter((u) => u && EP_USO_CAT[u.k]) : [];
  } catch {
    return [];
  }
}
