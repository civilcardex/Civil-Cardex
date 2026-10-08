// TablaTipologias: la tabla de 24 columnas por sector (aparatos en subfilas, modo borrado
// por celda con confirmación). Extraída del hub — incluye el rediseño de subfilas y los
// fixes de borrado de la ronda 2026-10-06 (no es movimiento verbatim puro).
import React, { useState } from 'react';
import { APARATOS_DEF } from '../../constants/engineeringDataFixtures';
import { SOL } from '../../constants/rejillasNTC3631';
import { clasifRecinto, solucionAplicada } from '../../utils/rejillasCalc';
import type { RejResultado } from '../../utils/rejillasCalc';
import {
  INP,
  SEL,
  TD,
  TH,
  THG,
  THS,
  TXT,
  num,
  onAparatoCol,
  quitarColumna,
  setCantCol,
} from './rejillasShared';
import type { RejFila } from './rejillasShared';
import type { OverridesMap, RejOverride } from './rejillasStorage';
import { useStickyThead2Offset } from '../shared/useStickyThead2Offset';

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
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      {borrandoSub && (
        <div
          role="status"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '6px 10px',
            background: '#E7786B',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Haz clic en la subfila del aparato a eliminar
          <button
            type="button"
            onClick={() => setBorrandoSub(false)}
            style={{
              border: '1px solid rgba(255,255,255,.5)',
              borderRadius: 4,
              background: 'transparent',
              color: '#fff',
              fontSize: 11,
              cursor: 'pointer',
              padding: '1px 8px',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      <table ref={tablaRef} className="tbl" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={TH}>
              #
            </th>
            <th rowSpan={2} style={{ ...TH, width: 56, minWidth: 56 }}>
              Apto
            </th>
            <th style={THG} colSpan={5}>
              Recinto
            </th>
            <th style={{ ...THG }} colSpan={4}>
              Gasodomésticos
              <button
                type="button"
                aria-label="Añadir un aparato al sector seleccionado"
                title={
                  edit
                    ? 'Añadir un aparato (— etc —) al sector seleccionado'
                    : 'Requiere edición habilitada'
                }
                disabled={!edit}
                onClick={(e) => {
                  e.stopPropagation();
                  const f = filas[sel < 0 ? 0 : sel];
                  if (f)
                    onOv(f.areaId, {
                      slotsExtra: (f.aparatos.filter((a) => a.vacio).length || 0) + 1,
                    });
                }}
                style={{
                  display: 'inline-block',
                  marginLeft: 6,
                  width: 26,
                  textAlign: 'center',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  background: 'var(--bg2)',
                  color: edit ? 'var(--txt2)' : 'var(--txt3)',
                  fontSize: 11,
                  padding: '2px 0',
                  cursor: edit ? 'pointer' : 'not-allowed',
                }}
              >
                ＋
              </button>
              <button
                type="button"
                aria-label="Eliminar un aparato del sector seleccionado"
                title={
                  edit
                    ? 'Eliminar un aparato: haz clic en la subfila a eliminar'
                    : 'Requiere edición habilitada'
                }
                disabled={!edit || !filas.length}
                onClick={(e) => {
                  e.stopPropagation();
                  setBorrandoSub((v) => !v);
                }}
                style={{
                  display: 'inline-block',
                  marginLeft: 4,
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  background: borrandoSub ? '#E7786B' : 'var(--bg2)',
                  color: borrandoSub ? '#fff' : edit ? '#E7786B' : 'var(--txt3)',
                  fontSize: 11,
                  width: 26,
                  textAlign: 'center',
                  padding: '2px 0',
                  cursor: edit ? 'pointer' : 'not-allowed',
                }}
              >
                −
              </button>
            </th>
            <th style={THG} colSpan={3}>
              Verificación
            </th>
            <th style={THG} colSpan={2}>
              Solución
            </th>
            <th style={THG} colSpan={4}>
              Cálculo
            </th>
            <th style={THG} colSpan={3}>
              Rejillas sugeridas
            </th>
            <th rowSpan={2} style={TH}>
              Estado
            </th>
          </tr>
          <tr>
            <th style={THS} title="Nombre del sector (etiqueta del área dibujada)">
              Sector
            </th>
            <th style={THS} title="Área en planta del sector (m²) — del polígono dibujado">
              Área
            </th>
            <th style={{ ...THS, width: 74, minWidth: 74 }} title="Altura libre del sector (m)">
              Alto
            </th>
            <th
              style={THS}
              title="Mono espacio: una sola planta, sin muros internos; ambientes divididos solo por muebles (Anexo B)"
            >
              Mono Espacio
            </th>
            <th style={THS} title="Volumen del recinto (m³) = Área × Alto">
              Volumen del recinto (m³)
            </th>
            <th
              style={{ ...THS, minWidth: 120 }}
              title="Gasodomésticos asignados al sector — el ＋ añade otra subfila"
            >
              Aparato
            </th>
            <th style={THS} title="Cantidad de unidades de este aparato en el sector">
              UN
            </th>
            <th
              style={THS}
              title="Potencia nominal en kW — la fija el catálogo NTC 3728 según el tipo de gas"
            >
              P (kW)
            </th>
            <th
              style={THS}
              title="Tipo de recinto A/B/C (NTC 3631): define el coeficiente cm²/kW de las aberturas"
            >
              Tipo
            </th>
            <th style={THS} title="Suma de UN × P sin artefactos Tipo C (kW)">
              Total P (kW)
            </th>
            <th style={THS} title="Volumen requerido (m³) = 3,4 m³ por kW, sin Tipo C (num. 4.1.1)">
              Volumen Requerido
            </th>
            <th style={THS} title="Clasificación del recinto según su volumen (num. 4.1)">
              Chequeo Volumen / Clasificación del Recinto
            </th>
            <th style={THS} title="Estrategia de ventilación del sector (num. 4.1.2, 4.2, 4.3)">
              Tipo de Ventilación
            </th>
            <th
              style={THS}
              title="Volumen Recinto Adjunto (m³): espacio comunicado por aberturas interiores (solo Interior/Combinación)"
            >
              VRA (m³)
            </th>
            <th
              style={THS}
              title="Potencia Recinto Adjunto (kW): gasodomésticos del espacio adjunto (sin Tipo C)"
            >
              PRA (kW)
            </th>
            <th
              style={THS}
              title="Área Conectores de Evacuación (cm²): suma de secciones π·D²/4 (solo Método 2)"
            >
              ACE (cm²)
            </th>
            <th style={THS} title="Solución que resulta del cálculo">
              Solución aplicada
            </th>
            <th style={THS} title="Área libre mínima por abertura en cm² (redondeo por arriba)">
              Área Libre Requerida por Abertura
            </th>
            <th style={THS} title="Coeficiente en cm²/kW según la solución aplicada">
              Coeficiente de Área
            </th>
            <th
              style={THS}
              title="Rejillas del catálogo sugeridas por área efectiva del fabricante: superior/única (método 1 o 2) e inferior (método 1)"
            >
              Rejillas Sugeridas
            </th>
            <th style={THS} title="Área efectiva instalada en cm²: la menor entre las aberturas">
              Área Efectiva Instalada
            </th>
            <th style={THS}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td
                colSpan={24}
                style={{
                  ...TD,
                  padding: 16,
                  fontSize: 13,
                  color: 'var(--txt2)',
                  whiteSpace: 'normal',
                }}
              >
                Sin sectores: dibuja en el visor un <strong>Área</strong> con la pestaña{' '}
                <strong>Gas</strong> activa (y la subred Rejillas de ventilación encendida en Redes
                activas), nómbrala y asígnale gasodomésticos desde el panel derecho.
              </td>
            </tr>
          )}
          {filas.map((f, i) => {
            const res = resultados[i];
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
                ? 'Sin datos'
                : nE
                  ? `${nE} crítica${nE > 1 ? 's' : ''}`
                  : nW
                    ? `Cumple · ${nW} obs.`
                    : 'Cumple';
            const estCol =
              res.estado === 'vacio' ? 'var(--txt3)' : nE ? '#E7786B' : nW ? '#E3A24F' : '#5DBB83';
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
                if (!window.confirm('¿Eliminar este aparato del sector?')) return;
                quitarColumna(f, ci, onOv);
                setBorrandoSub(false);
              };
              // Los controles tragan el click en modo borrado: editar no debe costar
              // un confirm (el click burbujeaba al <td onClick={borrarEsta}>).
              const tragaClick = (e: React.MouseEvent) => {
                if (enModoBorrado) e.stopPropagation();
              };
              const tdBorra = (
                extra: React.CSSProperties,
              ): React.HTMLAttributes<HTMLTableCellElement> & { style: React.CSSProperties } => ({
                onClick: borrarEsta,
                style: {
                  ...TD,
                  padding: '2px 4px',
                  background: enModoBorrado ? 'rgba(231,120,107,.10)' : undefined,
                  ...extra,
                },
              });
              return (
                <>
                  <td {...tdBorra({})}>
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
                      style={{
                        ...SEL,
                        minWidth: 0,
                        width: '100%',
                        background: 'var(--bg3)',
                        borderRadius: 3,
                      }}
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
                  <td {...tdBorra({})}>
                    {edit && ap && !ap.vacio ? (
                      <input
                        onClick={tragaClick}
                        aria-label={`UN subfila ${ci + 1} sector ${i + 1}`}
                        className="no-spin"
                        type="number"
                        min="0"
                        value={ap.cant}
                        onChange={(e) =>
                          setCantCol(f, ci, Math.max(0, parseInt(e.target.value) || 0))
                        }
                        style={{ ...INP, fontSize: 11, minWidth: 0, padding: '1px 2px' }}
                      />
                    ) : (
                      // Slot "— etc —" (vacio): sin unidades — cant=1 es solo el init del slot.
                      <span style={TXT}>{ap && !ap.vacio && ap.cant ? ap.cant : '—'}</span>
                    )}
                  </td>
                  <td
                    onClick={borrarEsta}
                    title="Potencia nominal en kW del aparato — la fija el catálogo NTC 3728 según el tipo de gas del proyecto (alimenta el requerimiento de ventilación)."
                    style={{
                      ...TD,
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'center',
                      background: enModoBorrado ? 'rgba(231,120,107,.10)' : undefined,
                    }}
                  >
                    {ap && ap.id ? num(ap.kw, 2) : '—'}
                  </td>
                  <td {...tdBorra({})}>
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
                        style={{ ...SEL, fontSize: 11, minWidth: 0, width: 34, padding: '1px 2px' }}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    ) : (
                      <span style={TXT} title="Tipo de recinto A/B/C (NTC 3631)">
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
                  style={{
                    cursor: 'pointer',
                    background: i === sel ? 'rgba(37,99,235,.08)' : undefined,
                  }}
                >
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {i + 1}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {edit ? (
                      <input
                        aria-label={`Apto sector ${i + 1}`}
                        value={f.apto}
                        readOnly={!edit}
                        onChange={(e) => onOv(f.areaId, { apto: e.target.value })}
                        style={INP}
                      />
                    ) : (
                      <span style={TXT}>{f.apto || '—'}</span>
                    )}
                  </td>
                  {/* Sector en 2 líneas: input editable arriba, nivel (no editable) abajo. */}
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 1 }}>
                      {edit ? (
                        <input
                          aria-label={`Nombre del sector ${i + 1}`}
                          value={f.sector}
                          readOnly={!edit}
                          onChange={(e) => onOv(f.areaId, { sector: e.target.value })}
                          style={INP}
                        />
                      ) : (
                        <span style={TXT}>{f.sector || '—'}</span>
                      )}
                      <span
                        title="Nivel del plano donde está dibujado el sector (alimenta la restricción de sótanos)."
                        style={{
                          fontSize: 9.5,
                          fontFamily: 'var(--mono)',
                          color: 'var(--txt3)',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.piso}
                      </span>
                    </div>
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {num(f.areaM2, 2)}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {edit ? (
                      <input
                        aria-label={`Alto del sector ${i + 1}`}
                        className="no-spin"
                        type="number"
                        step="0.01"
                        value={f.altoM}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { altoM: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        style={INP}
                      />
                    ) : (
                      <span style={TXT}>{num(f.altoM, 2)}</span>
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {edit ? (
                      <select
                        aria-label={`Mono espacio sector ${i + 1}`}
                        value={f.mono ? 'si' : 'no'}
                        onChange={(e) => onOv(f.areaId, { mono: e.target.value === 'si' })}
                        style={SEL}
                      >
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    ) : (
                      <span style={TXT}>{f.mono ? 'Sí' : 'No'}</span>
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {f.mono || res.modo === 'estanco' || res.estado === 'vacio'
                      ? 'N.A.'
                      : num(res.V, 1)}
                  </td>
                  {/* Sin aparatos: sin subfila — una celda — hasta que el ＋ agregue una. */}
                  {f.aparatos.length === 0 ? (
                    <td colSpan={4} style={{ ...TD, color: 'var(--txt3)' }}>
                      —
                    </td>
                  ) : (
                    subAparato(f.aparatos[0], 0)
                  )}
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      fontWeight: 700,
                    }}
                  >
                    {num(res.P)}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {f.mono || res.modo === 'estanco' || res.estado === 'vacio'
                      ? 'N.A.'
                      : num(res.Vreq, 1)}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      verticalAlign: 'middle',
                      fontSize: 11,
                      whiteSpace: 'normal',
                      color:
                        ccol === 'e'
                          ? '#E7786B'
                          : ccol === 'w'
                            ? '#E3A24F'
                            : ccol === 'ok'
                              ? '#5DBB83'
                              : undefined,
                    }}
                  >
                    {cl}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      minWidth: 130,
                    }}
                  >
                    <select
                      aria-label={`Solución de ventilación del sector ${i + 1}`}
                      value={f.sol}
                      onChange={(e) => onOv(f.areaId, { sol: e.target.value })}
                      style={{ ...SEL, minWidth: 128, background: 'var(--bg2)' }}
                    >
                      {Object.entries(SOL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
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
                        style={INP}
                      />
                    ) : (
                      'N.A.'
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
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
                        style={INP}
                      />
                    ) : (
                      'N.A.'
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {usaCon ? (
                      <input
                        aria-label={`Área conectores ${i + 1}`}
                        type="number"
                        value={f.aconec}
                        readOnly={!edit}
                        onChange={(e) =>
                          onOv(f.areaId, { aconec: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        style={INP}
                      />
                    ) : (
                      'N.A.'
                    )}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      fontSize: 11,
                      whiteSpace: 'normal',
                      maxWidth: 130,
                    }}
                  >
                    {solucionAplicada(res)}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {hayAb ? num(res.aberturas[0].libre, 0) : 'N.A.'}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {hayAb ? (res.coef ?? '—') : 'N.A.'}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      fontSize: 11,
                      whiteSpace: 'normal',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      title={
                        sup
                          ? `REJILLA SUPERIOR/ÚNICA: área libre requerida ${num(sup.libre, 0)} cm². ${sup.ubic}. ${sup.ref ? `Ref. ${sup.ref.marca} ${sup.ref.ref} (${sup.ref.tipo}, área efectiva ${sup.n > 1 ? sup.n + ' × ' : ''}${sup.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                          : 'Sin rejilla superior requerida.'
                      }
                    >
                      <b style={{ color: 'var(--txt2)' }}>Superior:</b>{' '}
                      {sup ? rejLarga(sup) : <span style={{ color: 'var(--txt3)' }}>N.A.</span>}
                    </div>
                    <div
                      title={
                        inf
                          ? `REJILLA INFERIOR: área libre requerida ${num(inf.libre, 0)} cm². ${inf.ubic}. ${inf.ref ? `Ref. ${inf.ref.marca} ${inf.ref.ref} (${inf.ref.tipo}, área efectiva ${inf.n > 1 ? inf.n + ' × ' : ''}${inf.libreReal} cm²).` : 'Medida especial: definir con el fabricante.'}`
                          : 'Sin rejilla inferior requerida.'
                      }
                    >
                      <b style={{ color: 'var(--txt2)' }}>Inferior:</b>{' '}
                      {inf ? rejLarga(inf) : <span style={{ color: 'var(--txt3)' }}>N.A.</span>}
                    </div>
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{ ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}), ...TD }}
                  >
                    {ef !== null ? num(ef, 0) : 'N.A.'}
                  </td>
                  <td
                    rowSpan={nSub}
                    style={{
                      ...(i === sel ? { background: 'rgba(37,99,235,.08)' } : {}),
                      ...TD,
                      color: estCol,
                      fontWeight: 600,
                      fontSize: 11,
                    }}
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
                    style={{
                      cursor: 'pointer',
                      background: i === sel ? 'rgba(37,99,235,.08)' : undefined,
                    }}
                  >
                    {subAparato(ap, ci + 1)}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
