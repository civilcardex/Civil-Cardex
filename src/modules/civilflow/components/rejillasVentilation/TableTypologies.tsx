// TablaTipologias: la tabla de 24 columnas por sector (aparatos en subfilas, modo borrado
// por celda con confirmación). Extraída del hub — incluye el rediseño de subfilas y los
// fixes de borrado de la ronda 2026-10-06 (no es movimiento verbatim puro).
import React, { useEffect, useRef, useState } from 'react';
import { APARATOS_DEF } from '../../constants/engineeringDataFixtures.ts';
import { SOL } from '../../constants/rejillasNTC3631';
import { clasifRecinto, solucionAplicada } from '../../utils/rejillasCalc.ts';
import type { RejResultado } from '../../utils/rejillasCalc.ts';
import { num, onAparatoCol, quitarColumna, setCantCol } from './rejillasShared.ts';
import type { RejFila } from './rejillasShared.ts';
import type { OverridesMap, RejOverride } from './rejillasStorage.ts';
import { useStickyThead2Offset } from '../shared/useStickyThead2Offset';
import { TablaTipologiasConfirmDel, TablaTipologiasHeader } from './typologiesChrome.tsx';

export function TablaTipologias({
  filas,
  resultados,
  gas,
  edit,
  sel,
  onSelect,
  onOv,
  overrides,
}: {
  filas: RejFila[];
  resultados: RejResultado[];
  gas: 'natural' | 'glp';
  edit: boolean;
  sel: number;
  onSelect: (i: number) => void;
  onOv: (key: string, patch: RejOverride) => void;
  overrides: OverridesMap;
}) {
  const tablaRef = useStickyThead2Offset();
  // Modo "eliminar aparato": activado con el − del header (solo edición); el clic se hace
  // sobre las celdas de la subfila (Aparato/UN/P/Tipo), con confirmación (ped. usuario).
  const [borrandoSub, setBorrandoSub] = useState(false);
  // Confirmación de borrado de aparato (dialog propio, sin confirm nativo).
  const [confirmDel, setConfirmDel] = useState<{ f: (typeof filas)[number]; ci: number } | null>(
    null,
  );
  /** Foco inicial del diálogo de borrado (a11y: sin autofocus JSX — el linter lo veta). */
  const cancelarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDel) cancelarRef.current?.focus();
  }, [confirmDel]);
  // El modo borrado es hijo de la edición: apagar EditButton lo cancela — sin esto los
  // onClick de fila seguían vivos y borraban gasodomésticos con la edición deshabilitada.
  // Ajuste de estado durante render (patrón del modal de checkout): resetear al togglear.
  const [borrPrevEdit, setBorrPrevEdit] = useState(edit);
  if (edit !== borrPrevEdit) {
    setBorrPrevEdit(edit);
    if (!edit) setBorrandoSub(false);
  }
  // ¿El modo borrado está realmente armado? (edit ON + banner ON).
  const enModoBorrado = edit && borrandoSub;
  // Encabezado de 2 filas como la tabla de referencia: grupos arriba, subcolumnas abajo.
  // Los aparatos viven en SUBFILAS bajo el sector (Aparato/UN/P/Tipo) — una por aparato.
  // Sub-campo apilado: etiqueta mini + control.
  return (
    // Solo scroll horizontal aquí: el scroll VERTICAL es el del contenido de la tarjeta
    // (un solo scroller — el tope propio de la tabla daba doble scroll, orig. usuario).
    <div className="rt-scroll-x">
      {borrandoSub && (
        <div role="status" className="rt-borrar-banner">
          Haz clic en la subfila del aparato a eliminar
          <button type="button" onClick={() => setBorrandoSub(false)} className="rt-cancel-borrado">
            Cancelar
          </button>
        </div>
      )}
      <table ref={tablaRef} className="tbl">
        <TablaTipologiasHeader
          filas={filas}
          edit={edit}
          borrandoSub={borrandoSub}
          onAdd={() => {
            const f = filas[sel < 0 ? 0 : sel];
            if (f)
              onOv(f.areaId, { slotsExtra: (f.aparatos.filter((a) => a.vacio).length || 0) + 1 });
          }}
          onToggleBorrar={() => setBorrandoSub((v) => !v)}
        />
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={24} className="rt-td rt-td-empty">
                Sin sectores: dibuja en el visor un <strong>Área</strong> con la pestaña{' '}
                <strong>Gas</strong> activa (y la subred Rejillas de ventilación encendida en Redes
                activas), nómbrala y asígnale gasodomésticos desde el panel derecho.
              </td>
            </tr>
          )}
          {filas.map((f, i) => {
            const res = resultados[i];
            // Hidratación async: filas puede adelantar a resultados → sin guard crashea el render.
            if (!res) return null;
            const [cl, ccol] = clasifRecinto(res);
            const insuficiente =
              !f.mono && res.estado !== 'vacio' && res.modo !== 'estanco' && res.V < res.Vreq;
            const usaAdj = insuficiente && (f.sol.startsWith('int') || f.sol.startsWith('comb'));
            const usaCon = insuficiente && f.sol === 'ext-m2' && gas !== 'glp';
            const hayAb = res.aberturas.length > 0;
            const sup = res.aberturas.find((a) => a.pos === 'sup' || a.pos === 'int');
            const inf = res.aberturas.find((a) => a.pos === 'inf');
            const ef = hayAb ? Math.min(...res.aberturas.map((a) => a.libreReal)) : null;
            const nE = res.alertas.filter((a) => a.e).length;
            const nW = res.alertas.length - nE;
            const est =
              res.estado === 'vacio'
                ? ''
                : nE
                  ? `${nE} crítica${nE > 1 ? 's' : ''}`
                  : nW
                    ? `Cumple · ${nW} obs.`
                    : 'Cumple';
            // Clase de color del estado (vacío = tenue, nE = rojo, nW = ámbar, ok = verde).
            const estColCls =
              res.estado === 'vacio'
                ? 'rt-td-dim'
                : nE
                  ? 'rt-est-e'
                  : nW
                    ? 'rt-est-w'
                    : 'rt-est-ok';
            const rejLarga = (a: NonNullable<(typeof res.aberturas)[number]>) =>
              a.ref
                ? `${a.n > 1 ? `${a.n} × ` : ''}${a.ref.marca} ${a.ref.ref} — ${a.ref.ext} cm`
                : `Especial ${a.w} × ${a.h} cm (definir con fabricante)`;
            const nSub = Math.max(1, f.aparatos.length);
            // Subfila de aparato: 4 tds (Aparato/UN/P/Tipo). UN, P y Tipo son columnas de
            // la tabla (ped. usuario); cada aparato agregado abre una subfila bajo el sector.
            const subAparato = (ap: (typeof f.aparatos)[number] | undefined, ci: number) => {
              // Borrado SOLO desde las celdas de la subfila (la fila entera era zona de
              // muerte: un clic en el select "Solución" o en la columna Rejillas eliminaba
              // el aparato sin confirmación), con confirmación y solo en modo armado.
              const borrarEsta = (e: React.MouseEvent) => {
                if (!enModoBorrado) return;
                e.stopPropagation();
                // Dialog de la app en vez del confirm nativo del navegador (ped. usuario).
                setConfirmDel({ f, ci });
              };
              // Los controles tragan el click en modo borrado: editar no debe costar
              // un confirm (el click burbujeaba al <td onClick={borrarEsta}>).
              const tragaClick = (e: React.MouseEvent) => {
                if (enModoBorrado) e.stopPropagation();
              };
              const tdBorra = (
                extraClass?: string,
              ): React.HTMLAttributes<HTMLTableCellElement> & { className: string } => ({
                onClick: borrarEsta,
                className: `rt-td rt-borra-cell${enModoBorrado ? ' rt-borrando' : ''}${
                  extraClass ? ` ${extraClass}` : ''
                }`,
              });
              return (
                <>
                  <td {...tdBorra()}>
                    <select
                      onClick={tragaClick}
                      aria-label={`Gasodoméstico subfila ${ci + 1} sector ${i + 1}`}
                      title={
                        APARATOS_DEF.find((a) => a.id === ap?.id)?.nombre ||
                        'Gasodoméstico de esta subfila (— etc — libera el slot). Suma su potencia al sector.'
                      }
                      value={ap?.id ?? ''}
                      disabled={!edit}
                      onChange={(e) => onAparatoCol(f, ci, e.target.value, onOv)}
                      className="rt-sel rt-sel-full"
                    >
                      <option value="">Elegir</option>
                      {APARATOS_DEF.filter(
                        (a) =>
                          a.grupo === 'g' && !f.aparatos.some((o) => o !== ap && o.id === a.id),
                      ).map((a) => (
                        <option key={a.id} value={a.id} title={a.nombre}>
                          {a.sigla.replace(/:$/, '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td {...tdBorra()}>
                    {edit && ap && !ap.vacio ? (
                      <input
                        onClick={tragaClick}
                        aria-label={`UN subfila ${ci + 1} sector ${i + 1}`}
                        className="no-spin rt-inp rt-inp-11"
                        type="number"
                        min="0"
                        value={ap.cant}
                        onChange={(e) =>
                          setCantCol(f, ci, Math.max(0, parseInt(e.target.value) || 0))
                        }
                      />
                    ) : (
                      // Slot "— etc —" (vacio): sin unidades — cant=1 es solo el init del slot.
                      <span className="rt-txt">{ap && !ap.vacio && ap.cant ? ap.cant : '—'}</span>
                    )}
                  </td>
                  <td {...tdBorra('rt-td-kw')}>
                    {/* Botón real (no <td onClick>): el borrado tiene que ser alcanzable
                        con teclado (WCAG 2.1.1). Un <td> con onClick no es enfocable. */}
                    <button
                      type="button"
                      onClick={borrarEsta}
                      title="Potencia nominal en kW del aparato — la fija el catálogo NTC 3728 según el tipo de gas del proyecto (alimenta el requerimiento de ventilación)."
                      aria-label={`Borrar potencia nominal${ap && ap.id ? ` de ${ap.id}` : ''}`}
                      className="rt-reset-btn"
                    >
                      {ap && ap.id ? num(ap.kw, 2) : '—'}
                    </button>
                  </td>
                  <td {...tdBorra()}>
                    {edit && ap && !ap.vacio ? (
                      <select
                        onClick={tragaClick}
                        aria-label={`Tipo subfila ${ci + 1} sector ${i + 1}`}
                        title="Tipo de recinto A/B/C (NTC 3631): define el coeficiente cm²/kW de las aberturas."
                        value={ap.tipo}
                        onChange={(e) =>
                          onOv(f.areaId, {
                            tipoById: {
                              ...(overrides[f.areaId]?.tipoById || {}),
                              ...(ap.id ? { [ap.id]: e.target.value as 'A' | 'B' | 'C' } : {}),
                            },
                          })
                        }
                        className="rt-sel rt-sel-34"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    ) : (
                      <span className="rt-txt" title="Tipo de recinto A/B/C (NTC 3631)">
                        {ap && !ap.vacio && ap.id ? ap.tipo : '—'}
                      </span>
                    )}
                  </td>
                </>
              );
            };
            // key en la RAÍZ del item del map (el Fragment, no el <tr> interno): sin esto
            // React reconcilia por índice y remonta todas las filas posteriores a un
            // borrado/inserción (inputs Apto/Sector perdían foco).
            return (
              <React.Fragment key={f.key}>
                <tr
                  onClick={() => {
                    if (enModoBorrado) return; // el borrado vive SOLO en las celdas de la subfila
                    onSelect(i);
                  }}
                  // Fila seleccionable por teclado (WCAG 2.1.1): role + tabIndex + Enter.
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (enModoBorrado) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(i);
                    }
                  }}
                  className="rt-row-click"
                >
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {i + 1}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {edit ? (
                      <input
                        aria-label={`Apto sector ${i + 1}`}
                        value={f.apto}
                        readOnly={!edit}
                        onChange={(e) => onOv(f.areaId, { apto: e.target.value })}
                        className="rt-inp"
                      />
                    ) : (
                      <span className="rt-txt">{f.apto || '—'}</span>
                    )}
                  </td>
                  {/* Sector en 2 líneas: input editable arriba, nivel (no editable) abajo. */}
                  <td
                    rowSpan={nSub}
                    className={
                      i === sel ? 'rt-td rt-td-selected rt-td-hidden' : 'rt-td rt-td-hidden'
                    }
                  >
                    <div className="rt-grid-1">
                      {edit ? (
                        <input
                          aria-label={`Nombre del sector ${i + 1}`}
                          value={f.sector}
                          readOnly={!edit}
                          onChange={(e) => onOv(f.areaId, { sector: e.target.value })}
                          className="rt-inp"
                        />
                      ) : (
                        <span className="rt-txt">{f.sector || '—'}</span>
                      )}
                      <span
                        title="Nivel del plano donde está dibujado el sector (alimenta la restricción de sótanos)."
                        className="rt-piso-legend"
                      >
                        {f.piso}
                      </span>
                    </div>
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {num(f.areaM2, 2)}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {edit ? (
                      <input
                        aria-label={`Alto del sector ${i + 1}`}
                        className="no-spin rt-inp"
                        type="number"
                        step="0.01"
                        value={f.altoM}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { altoM: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                      />
                    ) : (
                      <span className="rt-txt">{num(f.altoM, 2)}</span>
                    )}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {edit ? (
                      <select
                        aria-label={`Mono espacio sector ${i + 1}`}
                        value={f.mono ? 'si' : 'no'}
                        onChange={(e) => onOv(f.areaId, { mono: e.target.value === 'si' })}
                        className="rt-sel"
                      >
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    ) : (
                      <span className="rt-txt">{f.mono ? 'Sí' : 'No'}</span>
                    )}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {res.estado === 'vacio'
                      ? ''
                      : f.mono || res.modo === 'estanco'
                        ? 'N.A.'
                        : num(res.V, 1)}
                  </td>
                  {/* Sin aparatos: sin subfila — una celda — hasta que el ＋ agregue una. */}
                  {f.aparatos.length === 0 ? (
                    <td colSpan={4} className="rt-td rt-td-dim">
                      —
                    </td>
                  ) : (
                    subAparato(f.aparatos[0], 0)
                  )}
                  <td
                    rowSpan={nSub}
                    className={i === sel ? 'rt-td rt-td-selected rt-td-bold' : 'rt-td rt-td-bold'}
                  >
                    {res.estado === 'vacio' ? '' : num(res.P)}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {res.estado === 'vacio'
                      ? ''
                      : f.mono || res.modo === 'estanco'
                        ? 'N.A.'
                        : num(res.Vreq, 1)}
                  </td>
                  <td
                    rowSpan={nSub}
                    className={`${i === sel ? 'rt-td rt-td-selected rt-td-11 rt-td-clasif rt-td-wrap' : 'rt-td rt-td-11 rt-td-clasif rt-td-wrap'}${
                      ccol === 'e'
                        ? ' rt-est-e'
                        : ccol === 'w'
                          ? ' rt-est-w'
                          : ccol === 'ok'
                            ? ' rt-est-ok'
                            : ''
                    }`}
                  >
                    {cl}
                  </td>
                  <td
                    rowSpan={nSub}
                    className={
                      i === sel ? 'rt-td rt-td-selected rt-td-min-130' : 'rt-td rt-td-min-130'
                    }
                  >
                    <select
                      aria-label={`Solución de ventilación del sector ${i + 1}`}
                      value={f.sol}
                      onChange={(e) => onOv(f.areaId, { sol: e.target.value })}
                      className="rt-sel rt-sel-128"
                    >
                      {Object.entries(SOL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {usaAdj ? (
                      <input
                        aria-label={`Volumen recinto adjunto ${i + 1}`}
                        type="number"
                        step="0.1"
                        value={f.vadj}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { vadj: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        className="rt-inp"
                      />
                    ) : (
                      ''
                    )}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {usaAdj ? (
                      <input
                        aria-label={`Potencia recinto adjunto ${i + 1}`}
                        type="number"
                        step="0.1"
                        value={f.padj}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { padj: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        className="rt-inp"
                      />
                    ) : (
                      ''
                    )}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {usaCon ? (
                      <input
                        aria-label={`Área conectores ${i + 1}`}
                        type="number"
                        value={f.aconec}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { aconec: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        className="rt-inp"
                      />
                    ) : (
                      ''
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    className={
                      i === sel
                        ? 'rt-td rt-td-selected rt-td-11 rt-td-max-130 rt-td-wrap'
                        : 'rt-td rt-td-11 rt-td-max-130 rt-td-wrap'
                    }
                  >
                    {solucionAplicada(res)}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {hayAb ? num(res.aberturas[0].libre, 0) : ''}
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {hayAb ? (res.coef ?? '—') : ''}
                  </td>
                  <td
                    rowSpan={nSub}
                    className={
                      i === sel
                        ? 'rt-td rt-td-selected rt-td-11 rt-td-left rt-td-wrap'
                        : 'rt-td rt-td-11 rt-td-left rt-td-wrap'
                    }
                  >
                    <div
                      title={
                        sup
                          ? `REJILLA SUPERIOR/ÚNICA: área libre requerida ${num(sup.libre, 0)} cm². ${sup.ubic}. ${sup.ref ? `Ref. ${sup.ref.marca} ${sup.ref.ref} (${sup.ref.tipo}, área efectiva ${sup.n > 1 ? sup.n + ' × ' : ''}${sup.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                          : 'Sin rejilla superior requerida.'
                      }
                    >
                      <b className="rt-txt2">Superior:</b>{' '}
                      {sup ? rejLarga(sup) : <span className="rt-td-dim">N.A.</span>}
                    </div>
                    <div
                      title={
                        inf
                          ? `REJILLA INFERIOR: área libre requerida ${num(inf.libre, 0)} cm². ${inf.ubic}. ${inf.ref ? `Ref. ${inf.ref.marca} ${inf.ref.ref} (${inf.ref.tipo}, área efectiva ${inf.n > 1 ? inf.n + ' × ' : ''}${inf.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                          : 'Sin rejilla inferior requerida.'
                      }
                    >
                      <b className="rt-txt2">Inferior:</b>{' '}
                      {inf ? rejLarga(inf) : <span className="rt-td-dim">N.A.</span>}
                    </div>
                  </td>
                  <td rowSpan={nSub} className={i === sel ? 'rt-td rt-td-selected' : 'rt-td'}>
                    {ef !== null ? num(ef, 0) : ''}
                  </td>
                  <td
                    rowSpan={nSub}
                    className={`${i === sel ? 'rt-td rt-td-selected rt-td-11 rt-td-600' : 'rt-td rt-td-11 rt-td-600'} ${estColCls}`}
                  >
                    {est}
                  </td>
                </tr>
                {f.aparatos.slice(1).map((ap, ci) => (
                  <tr
                    key={f.key + '-ap' + ci}
                    onClick={() => {
                      if (enModoBorrado) return; // el borrado vive SOLO en las celdas de la subfila
                      onSelect(i);
                    }}
                    className={`rt-row-click${i === sel ? ' rt-subrow-selected' : ''}`}
                  >
                    {subAparato(ap, ci + 1)}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {confirmDel && (
        <TablaTipologiasConfirmDel
          sector={confirmDel.f.sector}
          cancelarRef={cancelarRef}
          onCancelar={() => setConfirmDel(null)}
          onConfirmar={() => {
            quitarColumna(confirmDel.f, confirmDel.ci, onOv);
            setConfirmDel(null);
            setBorrandoSub(false);
          }}
        />
      )}
    </div>
  );
}
