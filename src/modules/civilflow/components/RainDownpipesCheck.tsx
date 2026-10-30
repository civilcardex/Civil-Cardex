/** Chequeo de bajantes de ll (Lluvias): tabla por bajante con área aportada, Q (Caudal) y
 *  diámetro. Ej: BLL1 que drena 120 m² -> fila con su caudal pluvial y diámetro propuesto. */
import { useMemo } from 'react';
import { useRainwater, type BajanteLL } from '../context/RainwaterContext.tsx';
import { useTramos } from '../context/TramosContext.tsx';
import EditButton from './shared/EditButton.tsx';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { writeBajantePropToDrawing } from '../utils/writeDiameterToDrawing.ts';
import {
  buildLlBajanteAssociations,
  computeCanalBajanteRamalKeys,
  maxRamalPulgDeBajante,
  areaParcialBajanteLl,
} from '../utils/rainwaterRows.ts';
import {
  buildAreaDibujoMap,
  buildCanalDeBaj,
  buildRamalesByBajante,
  buildUppersByBajante,
} from '../utils/rainDownpipesDerived.ts';
import { RainDownpipesHeader } from './rainDownpipesHeader.tsx';
import ChipList from './shared/ChipList.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { chequeoBajanteLluvia } from '../utils/calcRainwater.ts';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';
import { renderStatus } from '../utils/componentHelpers.tsx';
import { DIAM_BAN, DIAM_BAN_LL, pisoCorto } from '../constants';
import { MATERIALES_CUBIERTA_LL, cDeCubierta } from '../constants/engineeringDataMaterials.ts';
import { fmt } from '../utils/formatUtils.ts';
import { entradaPor } from '../utils/diamLookup';
import React from 'react';
import { sanitizarInputDecimal } from '../utils/parseDecimal.ts';

interface Row {
  key: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras: metros cuadrados de techo extra que el usuario suma a mano (pedido del cliente); editable, por defecto 0. */
  areaOtras: number;
  /** TOTAL = areaParcial + areaOtras — de ella sale el caudal (Q) del bajante. */
  areaAcum: number;
  intensidad: number;
  /** C, el coeficiente de escorrentía (cuánta lluvia llega al tubo), que sale del material de la cubierta (hoja 1 del cuaderno); 0 si no hay material elegido. */
  coeficienteC: number;
  /** Material de cubierta (nombre completo en MATERIALES_CUBIERTA_LL). */
  materialCubierta: string;
  R: string;
  manning: number;
  diamPropuesto: number;
  /** Bajante dibujado en el plano: lo que escribas en Llenado se guarda también en el trazo (y al revés). */
  drawId?: string;
  drawPlanId?: string;
  nivel: string;
  asociadosSup: string[];
  canalesAsoc: string[];
  ramalesAsoc: string[];
}
// Encabezados compactos viven en rainDownpipesStyles.ts (compartidos con el header extraído).

const RainDownpipesCheck_S1: React.CSSProperties = {
  width: 56,
  padding: '2px 4px',
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt)',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  textAlign: 'center',
};

// Área Otras (orig. usuario): SIEMPRE editable — estado local de texto con commit en blur.
// (Un input controlado con value fijo + onChange no-op congela la tipografía: no se podía
// borrar el 0.)
const OtrasField = React.memo(function OtrasField({
  rowKey,
  bajante,
  value,
  onCommit,
  disabled = false,
}: {
  rowKey: string;
  bajante: string;
  value: number;
  onCommit: (bajante: string, v: number) => void;
  /** Edición habilitada solo con el botón EDITAR de la tabla (en LISTO es solo lectura). */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const display = editing ? text : fmt(value ?? 0, 2);
  // Patrón sanitaria (orig. usuario): EDITAR apagado = TEXTO PLANO.
  if (disabled) {
    return (
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
        {fmt(value ?? 0, 2)}
      </span>
    );
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      aria-label="Área otras"
      key={rowKey + '_otras'}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        // Al enfocar un 0 el campo arranca vacío: no hay que "quitar el 0" a mano.
        setText(value > 0 ? fmt(value, 2) : '');
      }}
      onChange={(e) => {
        setText(sanitizarInputDecimal(e.target.value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        // Área física: negativo = basura de tipeo (I·C·A negativo aguas abajo).
        const v = Math.max(0, parseFloat(text) || 0);
        if (bajante) onCommit(bajante, v);
      }}
      style={{ ...RainDownpipesCheck_S1, opacity: disabled ? 0.6 : 1 }}
    />
  );
});

export default function ChequeoBajantesLluvias() {
  const [edit, setEdit] = React.useState(false);
  const tablaRef = useStickyThead2Offset();
  const { bajantesLl, updBajanteLL, canalesLl, canalAlimIds } = useRainwater();
  const canalDeBaj = useMemo(
    () => buildCanalDeBaj(canalesLl, canalAlimIds),
    [canalesLl, canalAlimIds],
  );
  const { tramosLl, updTramoLL } = useTramos();
  const { plans } = usePlans();

  // Las CAJAS de aguas lluvias (CALL, tipo caja_ll) no son bajantes: fuera de la tabla.
  const drawingBajantes = useMemo(() => {
    return tramosLl.filter(
      (t) =>
        t.esBajante &&
        !String(t.code ?? '').startsWith('CALL') &&
        !String(t.id ?? '').startsWith('CALL'),
    );
  }, [tramosLl]);

  const areaDibujoMap = useMemo(() => buildAreaDibujoMap(plans || []), [plans]);

  // (areaAcumMap del total dibujado del piso retirado — orig. usuario: TOTAL = Parcial + Otras,
  // sin fallback al total del piso; el área que no sea la del dibujo se escribe en Otras.)

  // Bajantes del piso superior que descargan en cada bajante: el bajante superior deja
  // descargaEnId = "planId|id" apuntando al inferior (asociación entre pisos) — un escaneo de
  // todos los pisos construye el mapa inverso.
  const uppersByBajante = useMemo(() => buildUppersByBajante(plans || []), [plans]);

  // Ramales asociados a cada bajante: misma BFS que Diseño de red lluvias, invertida
  // (clave de bajante → ids de ramales que le drenan).
  const bajanteAssociations = useMemo(
    () => buildLlBajanteAssociations(tramosLl, plans),
    [tramosLl, plans],
  );
  // Ramales de/descargando al canal: nunca son "ramales asociados" de un bajante.
  const canalRamalKeys = useMemo(() => computeCanalBajanteRamalKeys(plans), [plans]);

  const ramalesByBajante = useMemo(
    () => buildRamalesByBajante(bajanteAssociations, canalRamalKeys, tramosLl, plans || []),
    [bajanteAssociations, tramosLl, plans, canalRamalKeys],
  );

  const rows = useMemo(() => {
    const manualMap = new Map<string, BajanteLL>();
    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      manualMap.set(key, m);
    }

    const usedManual = new Set<string>();
    const out: Row[] = [];

    for (const d of drawingBajantes) {
      const code = d.code || d.id;
      const manual = manualMap.get(code) || manualMap.get(d.id);
      if (manual) usedManual.add(manual.bajante || manual.id);
      const areaDib = areaDibujoMap[code] || areaDibujoMap[d.id] || 0;
      // Parcial = área asociada al bajante en el dibujo (fórmula compartida con el canal);
      // Otras = editable (default 0); TOTAL = Parcial + Otras alimenta el caudal.
      const areaParcial = areaParcialBajanteLl(areaDib, d.area_m2, manual);
      const areaOtras = manual?.areaOtras ?? 0;
      const areaAcum = areaParcial + areaOtras;
      const rVal = d.bajR != null ? (Math.abs(d.bajR - 0.25) < 0.001 ? '1/4' : '7/24') : '7/24';
      out.push({
        key: 'd_' + d.id + '_' + d.piso,
        bajante: code,
        drawId: d.id,
        drawPlanId: String(d.planId ?? ''),
        nivel: pisoCorto(d.piso),
        asociadosSup: uppersByBajante[`${d.planId}|${d.id}`] ?? [],
        canalesAsoc: canalDeBaj.get(`${d.planId}|${d.id}`)
          ? [canalDeBaj.get(`${d.planId}|${d.id}`)!]
          : [],
        ramalesAsoc: ramalesByBajante[`${d.id}-${d.planId}`] ?? [],
        areaParcial,
        areaOtras,
        areaAcum,
        intensidad: manual?.intensidad ?? 100,
        coeficienteC: cDeCubierta(manual?.materialCubierta ?? '') ?? 0,
        materialCubierta: manual?.materialCubierta ?? '',
        R: rVal,
        manning: manual?.manning || 0.009,
        diamPropuesto: d.diamDisPulg || 0,
      });
    }

    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      if (usedManual.has(key)) continue;
      const bajDib = drawingBajantes.find((d) => d.code === m.bajante || d.id === m.bajante);
      const areaDib = areaDibujoMap[m.bajante] || 0;
      // Fórmula compartida con la tabla de dibujo y el canal (areaParcialBajanteLl).
      const areaParcial = areaParcialBajanteLl(areaDib, bajDib?.area_m2, m);
      const areaOtras = m.areaOtras ?? 0;
      const areaAcum = areaParcial + areaOtras;
      out.push({
        key: 'm_' + m.id,
        bajante: m.bajante || m.id,
        nivel: '—',
        asociadosSup: [],
        canalesAsoc: [],
        ramalesAsoc: [],
        areaParcial,
        areaOtras,
        areaAcum,
        intensidad: m.intensidad ?? 100,
        coeficienteC: cDeCubierta(m.materialCubierta ?? '') ?? 0,
        materialCubierta: m.materialCubierta ?? '',
        R: m.R,
        manning: m.manning || 0.009,
        diamPropuesto: m.diamPropuesto,
      });
    }

    return out;
  }, [drawingBajantes, bajantesLl, areaDibujoMap, uppersByBajante, ramalesByBajante, canalDeBaj]);

  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Chequeo_bajantes.webp"
            alt="Chequeo bajantes"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Chequeo capacidad bajantes aguas lluvias
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
      </div>
      <div style={{ padding: '16px', overflowX: 'auto' }}>
        <table
          ref={tablaRef}
          className="tbl"
          style={{
            fontSize: 11,
            // AUTO (no fixed): con 18 columnas el fixed las aplastaba y partía palabras;
            // los minWidth de los th mandan y la tarjeta da scroll horizontal.
            tableLayout: 'auto',
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <RainDownpipesHeader />
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={17}
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    color: 'var(--txt3)',
                    fontSize: 11,
                  }}
                >
                  No hay bajantes de lluvias definidos. Dibuje bajantes en el plano o agréguelos en
                  el panel de entrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const {
                  Q,
                  dCalc: diamCalc,
                  Qcap,
                  cociente,
                  chequeo,
                } = chequeoBajanteLluvia({
                  ...row,
                  areaAcumulada: row.areaAcum || 0,
                });
                return (
                  <tr key={row.key}>
                    <td className="c">
                      <span className="sigla" style={{ fontSize: 11 }}>
                        {/* Sector + piso (orig. usuario): etiqueta tipo BALL1-C. */}
                        {row.bajante || '—'}
                        {row.nivel !== '—' ? `-${row.nivel}` : ''}
                      </span>
                    </td>
                    <td className="c">
                      <ChipList items={row.asociadosSup} />
                    </td>
                    <td className="c">
                      <ChipList items={row.canalesAsoc} />
                    </td>
                    <td className="c">
                      <ChipList items={row.ramalesAsoc} />
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.areaParcial > 0 ? fmt(row.areaParcial, 2) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      {/* Otras (orig. usuario): editable siempre, default 0 — nunca vacía. */}
                      <OtrasField
                        rowKey={row.key}
                        bajante={row.bajante}
                        value={row.areaOtras ?? 0}
                        onCommit={(baj, v) => updBajanteLL(baj, 'areaOtras', v)}
                        disabled={!edit}
                      />
                    </td>
                    <td className="c">
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {row.areaAcum > 0 ? fmt(row.areaAcum, 2) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      {/* Material de cubierta (port hoja 1): abreviatura en la opción con
                      title del nombre completo (hover). Persiste como override. */}
                      {edit ? (
                        <select
                          value={row.materialCubierta}
                          aria-label="Material de cubierta"
                          title={row.materialCubierta || 'Material de cubierta'}
                          onChange={(e) => {
                            if (row.bajante) {
                              updBajanteLL(row.bajante, 'materialCubierta', e.target.value);
                            }
                          }}
                          style={{
                            ...RainDownpipesCheck_S1,
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">—</option>
                          {MATERIALES_CUBIERTA_LL.map((m) => (
                            <option key={m.nombre} value={m.nombre} title={m.nombre}>
                              {m.abrev}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          title={row.materialCubierta || undefined}
                          style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                        >
                          {MATERIALES_CUBIERTA_LL.find(
                            (m) => m.nombre === (row.materialCubierta ?? ''),
                          )?.abrev || '—'}
                        </span>
                      )}
                    </td>
                    <td className="c">
                      {/* C derivado del material (hoja 1, criterio "por material"). */}
                      <span
                        title={row.materialCubierta || undefined}
                        style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                      >
                        {row.coeficienteC > 0 ? row.coeficienteC.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      {/* Intensidad: fórmula del Excel (col. F) — solo lectura. */}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.intensidad > 0 ? row.intensidad : '—'}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11 }}
                    >
                      {Q > 0 ? fmt(Q, 2) : '—'}
                    </td>
                    <td className="c">
                      {/* Llenado r: fijo en el Excel (col. H) — solo lectura, sin desplegable. */}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.R || '7/24'}
                      </span>
                    </td>
                    <td className="c">
                      {/* Manning = n de referencia del coeficiente K (0.009) — fijo, no
                      editable; para otro n se ajusta K·(n ref/n) en la fórmula. */}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {(row.manning || 0.009).toFixed(3)}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11 }}
                    >
                      {diamCalc > 0 ? fmt(diamCalc, 2) : '—'}
                    </td>
                    <td className="c">
                      {edit ? (
                        <select
                          value={entradaPor(DIAM_BAN, 'pulg', row.diamPropuesto)?.nom ?? ''}
                          aria-label="Diámetro propuesto"
                          onChange={(e) => {
                            const nom = e.target.value;
                            const opt = entradaPor(DIAM_BAN, 'nom', nom);
                            // Regla ll: el bajante no puede quedar menor que sus ramales conectados.
                            if (opt && row.drawId) {
                              const maxRamal = maxRamalPulgDeBajante(
                                row.drawId,
                                String(row.drawPlanId ?? ''),
                                tramosLl,
                              );
                              if (maxRamal > 0 && opt.pulg < maxRamal) {
                                if (
                                  avisarDiametroInvalido(
                                    `El diámetro del bajante no puede ser menor al de los ramales conectados (máximo ${maxRamal}"). Sube primero el diámetro de los ramales o selecciona un bajante mayor.`,
                                  )
                                )
                                  return;
                              }
                            }
                            // Bidireccional (orig. usuario): escribe el dNominal del bajante en el
                            // dibujo (engine vivo o storage) y refleja el pulg en el tramo.
                            if (row.drawId && opt) {
                              // Regla entre pisos: si se bloquea, no avanzar optimista.
                              if (
                                writeBajantePropToDrawing(
                                  `${row.drawId}-${row.drawPlanId}`,
                                  'll',
                                  'dNominal',
                                  nom,
                                  plans,
                                ) === false
                              )
                                return;
                              updTramoLL(
                                `${row.drawId}-${row.drawPlanId}`,
                                'diamDisPulg',
                                opt.pulg,
                              );
                            }
                          }}
                          style={{
                            ...RainDownpipesCheck_S1,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">—</option>
                          {/* Legacy: bajantes ll de 1.5" (excluida del catálogo) persisten —
                            sin esta option el select renderiza vacío y un click la borra. */}
                          {row.diamPropuesto === 1.5 && <option value="1-1/2">1-1/2"</option>}
                          {DIAM_BAN_LL.map((d) => (
                            <option key={d.pulg} value={d.nom}>
                              {d.nom}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {row.diamPropuesto > 0
                            ? (entradaPor(DIAM_BAN, 'pulg', row.diamPropuesto)?.nom ??
                              `${row.diamPropuesto}"`)
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11 }}
                    >
                      {Qcap > 0 ? fmt(Qcap, 2) : '—'}
                    </td>
                    <td className="c" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {cociente > 0 ? `${(cociente * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="c" style={{ fontSize: 11 }}>
                      {renderStatus(chequeo)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
