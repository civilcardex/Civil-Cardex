import { useMemo } from 'react';
import { useRainwater, type BajanteLL } from '../context/RainwaterContext';
import { useTramos } from '../context/TramosContext';
import EditButton from './shared/EditButton';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { writeBajantePropToDrawing } from '../utils/writeDiameterToDrawing';
import {
  buildLlBajanteAssociations,
  computeCanalBajanteRamalKeys,
  maxRamalPulgDeBajante,
  areaParcialBajanteLl,
} from '../utils/rainwaterRows';
import ChipList from './shared/ChipList';
import { usePlans } from '../context/PlansContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { chequeoBajanteLluvia } from '../utils/calcRainwater';
import { avisarDiametroInvalido } from '../utils/diametroValidation';
import { renderStatus } from '../utils/componentHelpers';
import { parseDescargaEnId } from '../utils/parseDescargaEnId';
import { DIAM_BAN, DIAM_BAN_LL, pisoCorto } from '../constants';
import { MATERIALES_CUBIERTA_LL, cDeCubierta } from '../constants/engineeringDataMaterials';
import { fmt } from '../utils/formatUtils';
import React from 'react';
import type { DrawingData } from '../utils/drawingSync';
import { sanitizarInputDecimal } from '../utils/parseDecimal';

interface Row {
  key: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras (orig. usuario): editable, default 0. */
  areaOtras: number;
  /** TOTAL = areaParcial + areaOtras — alimenta el caudal. */
  areaAcum: number;
  intensidad: number;
  /** Coef. de escorrentía derivado del material de cubierta (port hoja 1); 0 sin material. */
  coeficienteC: number;
  /** Material de cubierta (nombre completo en MATERIALES_CUBIERTA_LL). */
  materialCubierta: string;
  R: string;
  manning: number;
  diamPropuesto: number;
  /** Bajante del dibujo (fila d_): escritura bidireccional de Llenado al trazado. */
  drawId?: string;
  drawPlanId?: string;
  nivel: string;
  asociadosSup: string[];
  canalesAsoc: string[];
  ramalesAsoc: string[];
}
// Encabezados compactos (orig. usuario: la tabla sin scroll horizontal): wrap a 2-3 líneas.
const thC: React.CSSProperties = {
  fontSize: 9.5,
  textAlign: 'center',
  padding: '2px 3px',
  whiteSpace: 'normal',
  // Ancho mínimo por celda de encabezado: sin él, con 18 columnas las palabras parten
  // a la mitad ('MATERIA-L', 'Q CAR.') — ped. usuario estética.
  minWidth: 52,
  hyphens: 'auto',
  overflowWrap: 'anywhere',
};
const thCg: React.CSSProperties = { ...thC, fontWeight: 700, letterSpacing: 0.3 };

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
  /** Edición gated por el botón EDITAR de la tabla. */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const display = editing ? text : fmt(value ?? 0, 2);
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
  // Bajante (`planId|id`) → etiqueta del canal que lo recibe. canalAlimIds trae claves
  // exactas `planId|idBaj` (geométricas + manuales); el inverso alimenta la columna.
  const canalDeBaj = useMemo(() => {
    const inv = new Map<string, string>();
    for (const c of canalesLl) {
      if (!c.drawId) continue;
      for (const combo of canalAlimIds[c.drawId] || []) {
        if (!inv.has(combo)) inv.set(combo, c.sector || c.id);
      }
    }
    return inv;
  }, [canalesLl, canalAlimIds]);
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

  const areaDibujoMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data: DrawingData = raw as DrawingData;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      for (const b of data.bajantes || []) {
        if (b.net === 'll' && b.tipo !== 'canal' && b.area_m2) {
          map[b.code || b.id] = b.area_m2;
          map[b.id] = b.area_m2;
        }
      }
    }
    return map;
  }, [plans]);

  // (areaAcumMap del total dibujado del piso retirado — orig. usuario: TOTAL = Parcial + Otras,
  // sin fallback al total del piso; el área que no sea la del dibujo se escribe en Otras.)

  // Bajantes del piso superior que descargan en cada bajante: el bajante superior deja
  // descargaEnId = "planId|id" apuntando al inferior (asociación entre pisos) — un escaneo de
  // todos los pisos construye el mapa inverso.
  const uppersByBajante = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data: DrawingData = raw as DrawingData;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      const suf = pisoCorto(plan.nivel);
      for (const b of data.bajantes || []) {
        // Cajas CALL fuera: no son bajantes asociados (glifo de captura).
        if (b.net !== 'll' || b.tipo === 'caja_ll' || !b.descargaEnId) continue;
        // Formato canónico 'plan|id'; el LEGACY sin '|' apunta al MISMO plan — sin
        // normalizarlo la columna "asociados" quedaba en — para esos datos viejos.
        const [dPlan, dId] = parseDescargaEnId(b.descargaEnId, plan.id);
        const clave = `${dPlan}|${dId}`;
        if (!map[clave]) map[clave] = [];
        const code = `${b.code || b.id}-${suf}`;
        if (!map[clave].includes(code)) map[clave].push(code);
      }
    }
    return map;
  }, [plans]);

  // Ramales asociados a cada bajante: misma BFS que Diseño de red lluvias, invertida
  // (clave de bajante → ids de ramales que le drenan).
  const bajanteAssociations = useMemo(
    () => buildLlBajanteAssociations(tramosLl, plans),
    [tramosLl, plans],
  );
  // Ramales de/descargando al canal: nunca son "ramales asociados" de un bajante.
  const canalRamalKeys = useMemo(() => computeCanalBajanteRamalKeys(plans), [plans]);

  const ramalesByBajante = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [ramalKey, codes] of Object.entries(bajanteAssociations)) {
      // lastIndexOf: el id del ramal puede contener '-' (patrón AC-01-<id> en otras redes) —
      // split('-') rompería el par id|plan en la primera aparición.
      const sep = ramalKey.lastIndexOf('-');
      const ramalId = sep > 0 ? ramalKey.slice(0, sep) : ramalKey;
      const planId = sep > 0 ? ramalKey.slice(sep + 1) : '';
      // Piso del ramal (de su plano) → etiqueta "RS1-P1" en el chip.
      const nivel = plans?.find((pl) => String(pl.id) === planId)?.nivel;
      const label = nivel != null ? `${ramalId}-${pisoCorto(nivel)}` : ramalId;
      // Ramal de canal: fuera.
      if (canalRamalKeys.has(ramalKey)) continue;
      // Ldesvio: conector de asociación entre pisos, no ramal de drenaje — fuera.
      if (ramalId.startsWith('LD_')) continue;
      for (const code of codes) {
        // Scoping POR PISO: el mismo id de bajante existe en cada piso (BALL1-P1, BALL1-P2) —
        // sin el filtro de planId el find traía el de otro piso y el guard de abajo lo
        // descartaba: columna "Ramales asociados" siempre vacía (incidente 2026-09-25).
        const t = tramosLl.find(
          (x) =>
            x.esBajante && (x.code === code || x.id === code) && String(x.planId ?? '') === planId,
        );
        const k = t?._key;
        if (!k) continue;
        // Solo ramales del MISMO piso del bajante (orig. usuario).
        if (String(t.planId ?? '') !== planId) continue;
        if (!map[k]) map[k] = [];
        if (!map[k].includes(label)) map[k].push(label);
      }
    }
    return map;
  }, [bajanteAssociations, tramosLl, plans, canalRamalKeys]);

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
          <colgroup>
            <col style={{ width: 70 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 54 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 58 }} />
          </colgroup>
          <thead>
            <tr>
              <th
                title="Bajante de aguas lluvias (BALL) según el dibujo."
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={thC}
              >
                Bajante
              </th>
              <th
                title="Bajantes de pisos superiores que descargan en este bajante."
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={thC}
              >
                Bajantes asociados
              </th>
              <th
                title="Canal recolector que recibe este bajante (según el dibujo)."
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={thC}
              >
                Canales
                <br />
                asociados
              </th>
              <th
                title="Ramales de la red de lluvias que drenan a este bajante."
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={thC}
              >
                Ramales asociados
              </th>
              <th
                title="Área de cubierta que drena (m²)."
                scope="col"
                className="col-h ll"
                colSpan={3}
                style={thCg}
              >
                ÁREA (m²)
              </th>
              <th
                title="Método racional: lluvia que cae sobre el área del grupo."
                scope="col"
                className="col-h ll"
                colSpan={4}
                style={thCg}
              >
                CAUDAL DE DISEÑO
              </th>
              <th
                title="Verificación de capacidad y uso del tubo propuesto."
                scope="col"
                className="col-h ll"
                colSpan={6}
                style={thCg}
              >
                CAPACIDAD DEL TUBO (Wyly-Eaton)
              </th>
              <th
                title="Estado del chequeo de diámetros. Unidad: Dcalc ≤ Dprop."
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{ ...thC, width: 84, minWidth: 84, maxWidth: 100 }}
              >
                Chequeo
              </th>
            </tr>
            <tr>
              <th
                title="Área que drena al bajante según el dibujo (m²)."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Parcial
              </th>
              <th
                title="Área adicional no dibujada, editable (m²)."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Otras
              </th>
              <th
                title="Área total = Parcial + Otras (m²)."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Total
              </th>
              <th
                title="Material de la cubierta: define el coeficiente de escorrentía C. Visite el catálogo maestro para más información."
                scope="col"
                className="col-h ll"
                style={{ ...thC, minWidth: 96 }}
              >
                Material
                <br />
                cubierta
              </th>
              <th
                title="Coeficiente de escorrentía del material; sin material elegido el cálculo no se realiza (Q = 0)."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Coeficiente
                <br />
                escorrentía
              </th>
              <th
                title="Intensidad de lluvia de diseño (mm/h). Unidad: mm/h."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Intensidad
              </th>
              <th
                title="Caudal de diseño del bajante (L/s) por método racional. Unidad: L/s."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Caudal
              </th>
              <th
                title="Fracción de la sección del tubo ocupada por el agua (flujo anular)."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Llenado
              </th>
              <th
                title="Rugosidad de referencia del material de la bajante."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Manning
              </th>
              <th
                title="Diámetro que exige el caudal de diseño (pulg). Unidad: pulg."
                scope="col"
                className="col-h ok"
                style={thC}
              >
                Diámetro
                <br />
                calculado
              </th>
              <th
                title="Diámetro comercial propuesto (pulg) — no menor al mayor ramal conectado. Unidad: pulg."
                scope="col"
                className="col-h ok"
                style={thC}
              >
                Diámetro
                <br />
                propuesto
              </th>
              <th
                title="Capacidad del diámetro propuesto (L/s). Unidad: L/s."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Q
                <br />
                capacidad
              </th>
              <th
                title="Qué tan lleno trabaja el tubo: relación entre el caudal de diseño y la capacidad del diámetro propuesto; debe quedar por debajo del 100%."
                scope="col"
                className="col-h ll"
                style={thC}
              >
                Uso
              </th>
            </tr>
          </thead>
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
                      <select
                        value={row.materialCubierta}
                        aria-label="Material de cubierta"
                        title={row.materialCubierta || 'Material de cubierta'}
                        disabled={!edit}
                        onChange={(e) => {
                          if (row.bajante) {
                            updBajanteLL(row.bajante, 'materialCubierta', e.target.value);
                          }
                        }}
                        style={{
                          ...RainDownpipesCheck_S1,
                          width: '100%',
                          opacity: edit ? 1 : 0.6,
                          cursor: edit ? 'pointer' : 'default',
                        }}
                      >
                        <option value="">—</option>
                        {MATERIALES_CUBIERTA_LL.map((m) => (
                          <option key={m.nombre} value={m.nombre} title={m.nombre}>
                            {m.abrev}
                          </option>
                        ))}
                      </select>
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
                      <select
                        value={DIAM_BAN.find((d) => d.pulg === row.diamPropuesto)?.nom ?? ''}
                        aria-label="Diámetro propuesto"
                        disabled={!edit}
                        onChange={(e) => {
                          const nom = e.target.value;
                          const opt = DIAM_BAN.find((d) => d.nom === nom);
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
                            updTramoLL(`${row.drawId}-${row.drawPlanId}`, 'diamDisPulg', opt.pulg);
                          }
                        }}
                        style={{
                          ...RainDownpipesCheck_S1,
                          opacity: edit ? 1 : 0.6,
                          cursor: edit ? 'pointer' : 'default',
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
