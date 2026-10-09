import React from 'react';
import EditButton from './shared/EditButton';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import ChipList from './shared/ChipList';
import { renderStatus } from '../utils/componentHelpers';
import { pisoCorto, DIAM_BAN } from '../constants';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { useRainwater } from '../context/RainwaterContext';
import { usePlans } from '../context/PlansContext';
import { writeCanalDimsToDrawing } from '../utils/writeDiameterToDrawing';
import { avisarDiametroInvalido } from '../utils/diametroValidation';
import {
  chequeoCanalLluvia,
  chequeoEmbocaduraLluvia,
  BORDE_LIBRE_CANAL_CM,
} from '../utils/calcRainwater';
import {
  MATERIALES_CUBIERTA_LL,
  MATERIALES_CANAL_LL,
  cDeCubierta,
  nDeCanal,
} from '../constants/engineeringDataMaterials';
import { fmt } from '../utils/formatUtils';
import { repartirOtrasCanal } from '../utils/rainwaterRows';
import type { DrawingData } from '../utils/drawingSync';
import { sanitizarInputDecimal } from '../utils/parseDecimal';

// Encabezados compactos (orig. usuario: sin scroll horizontal): wrap a 2-3 líneas.
const thL: React.CSSProperties = {
  fontSize: 10,
  textAlign: 'center',
  padding: '1px 2px',
  whiteSpace: 'normal',
};
const thG: React.CSSProperties = { ...thL, fontWeight: 700, letterSpacing: 0.3 };
const thOk: React.CSSProperties = { ...thL };

const CANAL_FIELD_LABELS: Record<
  | 'b'
  | 'h'
  | 'pendiente'
  | 'longitud'
  | 'areaOtras'
  | 'intensidad'
  | 'muroVertical'
  | 'bordeLibreCm',
  string
> = {
  b: 'Base (cm)',
  h: 'Altura (cm)',
  pendiente: 'Pendiente (%)',
  longitud: 'Longitud (cm)',
  areaOtras: 'Área otras',
  intensidad: 'Intensidad (mm/hr)',
  muroVertical: 'Muro vertical (m²)',
  bordeLibreCm: 'Borde libre (cm)',
};

const CanalDimField = React.memo(function CanalDimField({
  id,
  field,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  field:
    | 'b'
    | 'h'
    | 'pendiente'
    | 'longitud'
    | 'areaOtras'
    | 'intensidad'
    | 'muroVertical'
    | 'bordeLibreCm';
  value: number;
  onChange: (id: string, field: string, val: number) => void;
  /** Edición gated por el botón EDITAR de la tabla. */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  // Otras (orig. usuario): nunca vacía — muestra 0 cuando el valor es 0.
  const display =
    field === 'areaOtras'
      ? editing
        ? text
        : fmt(value ?? 0, 2)
      : editing
        ? text
        : field === 'intensidad'
          ? value > 0
            ? String(Math.round(value))
            : ''
          : value > 0
            ? fmt(value, 2)
            : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder="0"
      aria-label={CANAL_FIELD_LABELS[field]}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        // Otras en 0 arranca VACÍA al enfocar (orig. usuario: no había que "quitar el 0").
        const vaciar = field === 'areaOtras' && !(value > 0);
        setText(vaciar ? '' : display);
      }}
      onChange={(e) => {
        const raw = sanitizarInputDecimal(e.target.value);
        setText(raw);
      }}
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        // Dimensión física (b/h/longitud/pendiente): negativo = basura de tipeo, no dato.
        const v = Math.max(0, parseFloat(text) || 0);
        onChange(id, field, text === '' ? 0 : v);
      }}
      style={{
        textAlign: 'center',
        fontSize: 10,
        opacity: disabled ? 0.6 : 1,
        padding: '2px 4px',
        width: 38,
        fontFamily: 'var(--mono)',
        background: 'var(--bg2)',
        border: '1px solid var(--line)',
        borderRadius: 2,
        color: 'var(--txt)',
      }}
    />
  );
});

export default function ChequeoCanalesLluvias() {
  const [edit, setEdit] = React.useState(false);
  const tablaRef = useStickyThead2Offset();
  const { canalesLl, updCanalLL, updCanalSector, conRecolectora, canalBajantes, updBajanteLL } =
    useRainwater();
  const { plans } = usePlans();
  // ── Canal = Σ bajantes asociados (REQ: fuente única = overrides de los BAJANTES) ──
  // Con bajantes asociados, las celdas Parcial/Otras/Material cubierta muestran el valor
  // DERIVADO del context (canalesLlAuto ya lo calcula con areaParcialBajanteLl) y al editar
  // se escribe updBajanteLL en CADA asociado — así la tabla de bajantes y esta leen el mismo
  // override y sincronizan en vivo. Sin asociados → override propio del canal (como hoy).
  const asociadosDe = (drawId?: string): string[] => (drawId ? canalBajantes[drawId] || [] : []);
  const codigoDeChip = (chip: string): string => chip.split('-')[0];
  // Escritura bidireccional con el dibujo (ítem 7 usuario): b/h/longitud/pendiente de filas
  // fromCanal van al glifo (writeCanalDimsToDrawing = manda el dibujo); área/intensidad van
  // al override por sector (updCanalSector); filas manuales usan updCanalLL como siempre.
  const onCanalField = (id: string, field: string, val: number) => {
    const row = canalesLl.find((c) => c.id === id);
    if (!row) return;
    // REQ canal = Σ bajantes: "Otras" con asociados REPARTE el total tecleado entre ellos
    // (repartirOtrasCanal: Σ(escrito) == total, residuo al primero). Escribir el MISMO valor
    // a cada uno inflaba N× (5 → mostraba 15 → 45...). La celda muestra la Σ real vía context.
    if (field === 'areaOtras' && asociadosDe(row.drawId).length > 0) {
      const asociados = asociadosDe(row.drawId);
      const vals = repartirOtrasCanal(val, asociados.length);
      asociados.forEach((chip, i) => updBajanteLL(codigoDeChip(chip), 'areaOtras', vals[i] ?? 0));
      return;
    }
    if (row.fromCanal && row.drawId != null && row.drawPlanId != null) {
      if (field === 'b' || field === 'h' || field === 'longitud' || field === 'pendiente') {
        if (field === 'pendiente' && (val <= 0 || val > 15)) {
          if (
            avisarDiametroInvalido(
              'La pendiente del canal debe ser mayor que 0% y hasta 15%. Se conserva el valor anterior.',
              'Pendiente no permitida',
            )
          )
            return;
        }
        const key =
          field === 'b'
            ? 'base'
            : field === 'h'
              ? 'altura'
              : field === 'longitud'
                ? 'longitud'
                : 'pendiente';
        writeCanalDimsToDrawing(row.drawId, row.drawPlanId, { [key]: val }, plans);
        return;
      }
      if (row.sector) {
        updCanalSector(row.sector, field, val);
        return;
      }
    }
    updCanalLL(id, field, val);
  };

  // Campos de TEXTO (materiales): mismo routing que onCanalField — override por sector en
  // filas fromCanal, estado en manuales. Los materiales viven en el override, no en el glifo.
  // REQ canal = Σ bajantes: "Material cubierta" con asociados escribe en TODOS los bajantes
  // asociados (la celda muestra el material común derivado; mezclados → '' placeholder).
  const onCanalStrField = (id: string, field: string, val: string) => {
    const row = canalesLl.find((c) => c.id === id);
    if (!row) return;
    if (field === 'materialCubierta' && asociadosDe(row.drawId).length > 0) {
      for (const chip of asociadosDe(row.drawId)) {
        updBajanteLL(codigoDeChip(chip), 'materialCubierta', val);
      }
      return;
    }
    if (row.fromCanal && row.sector) {
      updCanalSector(row.sector, field, val);
      return;
    }
    updCanalLL(id, field, val);
  };

  // D propuesto por CHIP de bajante asociado ("BALL1-P1"): el chequeo de embocadura usa el
  // D menor de los asociados (conservador) y el N° de chips como N° de bajantes (port hoja 2
  // AA/Z — columnas rojas del Excel, aquí derivadas del dibujo).
  // Tick de refresco del dibujo (mismo trío de eventos que RainwaterContext): el memo de
  // abajo lee storage crudo — sin tick, cambiar D de un bajante en el visor dejaba las
  // columnas "D baj."/"Lámina" con el valor viejo hasta remontar.
  const [diamTick, setDiamTick] = React.useState(0);
  // Re-escaneo del storage cuando el dibujo sincroniza (el D baj. del colgroup se lee crudo):
  // MISMO trío de eventos que RainwaterContext (antes había un 2º listener duplicado sin el
  // evento de hidro — solo el primero de los dos disparaba dos veces por cambio).
  React.useEffect(() => {
    const bump = () => setDiamTick((n) => n + 1);
    window.addEventListener('storage', bump);
    window.addEventListener('civilflow_san_sync_changed', bump as EventListener);
    window.addEventListener('civilflow_hidro_sync_changed', bump as EventListener);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('civilflow_san_sync_changed', bump as EventListener);
      window.removeEventListener('civilflow_hidro_sync_changed', bump as EventListener);
    };
  }, []);
  const diamPulgPorChip = React.useMemo(() => {
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
      const suf = pisoCorto(plan.nivel);
      for (const b of data.bajantes || []) {
        if (b.net !== 'll' || b.tipo !== 'bajante') continue;
        const chip = `${String(b.code || b.id).split('-')[0]}-${suf}`;
        // El dibujo guarda el diámetro como etiqueta nominal ('4"'); tramos guardan pulg.
        const rawPulg = (b as { diamDisPulg?: number }).diamDisPulg;
        const pulg =
          rawPulg && rawPulg > 0
            ? rawPulg
            : (DIAM_BAN.find((d) => d.nom === b.dNominal)?.pulg ?? 0);
        if (pulg > 0) map[chip] = pulg;
      }
    }
    return map;
    // 'diamTick' en deps es intencional: fuerza el re-escaneo del storage (no se lee directo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, diamTick]);

  return (
    <section className="card">
      <div
        className="card-h"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Chequeo_canal_cubierta.webp"
            alt="Chequeo canal cubierta"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Chequeo capacidad canal recolectora cubierta aguas lluvias
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
      </div>
      {!conRecolectora ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 12 }}>
          Activa el canal recolectora para ver este chequeo.
        </div>
      ) : (
        <div style={{ padding: '12px' }}>
          <table
            ref={tablaRef}
            className="tbl"
            style={{
              fontSize: 10,
              tableLayout: 'fixed',
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            <colgroup>
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '5.5%' }} />
              <col style={{ width: '3.8%' }} />
              <col style={{ width: '3.4%' }} />
              <col style={{ width: '3.8%' }} />
              <col style={{ width: '3.8%' }} />
              <col style={{ width: '3.8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '3.2%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '3.6%' }} />
              <col style={{ width: '3.4%' }} />
              <col style={{ width: '3.2%' }} />
              <col style={{ width: '3.2%' }} />
              <col style={{ width: '3.6%' }} />
              <col style={{ width: '3.4%' }} />
              <col style={{ width: '3.6%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '3.8%' }} />
              <col style={{ width: '4.2%' }} />
              <col style={{ width: '4.2%' }} />
              <col style={{ width: '4.4%' }} />
              <col style={{ width: '4.2%' }} />
              <col style={{ width: '4.2%' }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  title="Canal recolector de cubierta (CNL) según el dibujo."
                  scope="col"
                  className="col-h ll"
                  rowSpan={2}
                  style={thL}
                >
                  Canal
                </th>
                <th
                  title="Bajantes que descargan al canal: definen el N° de bocas y el reparto del caudal."
                  scope="col"
                  className="col-h ll"
                  rowSpan={2}
                  style={thL}
                >
                  Bajantes
                  <br />
                  asociados
                </th>
                <th
                  title="Áreas que drenan al canal (m²)."
                  scope="col"
                  className="col-h ll"
                  colSpan={5}
                  style={thG}
                >
                  ÁREA (m²)
                </th>
                <th
                  title="Método racional aplicado al área efectiva."
                  scope="col"
                  className="col-h ll"
                  colSpan={4}
                  style={thG}
                >
                  CAUDAL DE DISEÑO
                </th>
                <th
                  title="Material, rugosidad y pendiente del canal."
                  scope="col"
                  className="col-h ll"
                  colSpan={3}
                  style={thG}
                >
                  CANAL
                </th>
                <th
                  title="Dimensiones de la sección del canal (cm) — manda el dibujo."
                  scope="col"
                  className="col-h ok"
                  colSpan={4}
                  style={thG}
                >
                  SECCIÓN PROPUESTA
                </th>
                <th
                  title="Capacidad de la sección y uso del canal."
                  scope="col"
                  className="col-h ll"
                  colSpan={2}
                  style={thG}
                >
                  CAPACIDAD (Manning)
                </th>
                <th
                  title="Tirante normal y velocidad del agua en el canal."
                  scope="col"
                  className="col-h ll"
                  colSpan={2}
                  style={thG}
                >
                  FLUJO REAL
                </th>
                <th
                  title="Entrega del canal al bajante: embocadura y su altura de agua."
                  scope="col"
                  className="col-h ll"
                  colSpan={2}
                  style={thG}
                >
                  DESCARGA AL BAJANTE
                </th>
                <th
                  title="Chequeos de capacidad del canal y de la embocadura."
                  scope="col"
                  className="col-h ll"
                  colSpan={2}
                  style={thG}
                >
                  CHEQUEOS
                </th>
              </tr>
              <tr>
                <th
                  title="Área de los bajantes que descargan al canal (m²)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Parcial
                </th>
                <th
                  title="Área adicional no dibujada, editable (m²)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Otras
                </th>
                <th
                  title="Área total = Parcial + Otras (m²)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Total
                </th>
                <th
                  title="Área de muros que descargan sobre el canal (m²)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Muro
                </th>
                <th
                  title="Área efectiva = Total más la mitad del muro vertical."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Efectiva
                </th>
                <th
                  title="Material de la cubierta: define el coeficiente de escorrentía C. Visite el catálogo maestro para más información."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Material
                  <br />
                  cubierta
                </th>
                <th
                  title="Coeficiente de escorrentía del material; sin material elegido el cálculo no se realiza (Q = 0)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Coef.
                  <br />
                  escorr.
                </th>
                <th
                  title="Intensidad de lluvia de diseño (mm/h). Unidad: mm/h."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Intensidad
                </th>
                <th
                  title="Caudal real que llega al canal (L/s). Unidad: L/s."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Q real
                </th>
                <th
                  title="Material del canal: define la rugosidad n. Visite el catálogo maestro para más información."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Material
                  <br />
                  canal
                </th>
                <th
                  title="Rugosidad del material del canal."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Manning
                </th>
                <th
                  title="Pendiente longitudinal del canal (%) — manda el dibujo. Unidad: porcentaje (%)."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Pend.
                </th>
                <th
                  title="Ancho de la base del canal (cm) — editable, escribe al dibujo. Unidad: cm."
                  scope="col"
                  className="col-h ok"
                  style={thOk}
                >
                  Base
                </th>
                <th
                  title="Altura útil del canal (cm) — editable, escribe al dibujo. Unidad: cm."
                  scope="col"
                  className="col-h ok"
                  style={thOk}
                >
                  Altura
                </th>
                <th
                  title="Borde libre sobre el tirante (cm) — editable, default 10. Unidad: cm."
                  scope="col"
                  className="col-h ok"
                  style={thOk}
                >
                  Borde
                </th>
                <th
                  title="Sección total = base más altura más borde libre. Unidad: cm."
                  scope="col"
                  className="col-h ok"
                  style={thOk}
                >
                  Total
                </th>
                <th
                  title="Capacidad máxima de la sección (L/s). Unidad: L/s."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Q máx
                </th>
                <th
                  title="Uso de la capacidad del canal: debe ser ≤ 100%."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Q real/
                  <br />Q máx
                </th>
                <th
                  title="Profundidad del agua en el canal (m). Unidad: m."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Tirante
                </th>
                <th
                  title="Velocidad del agua en el canal (m/s). Unidad: m/s."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Vel.
                </th>
                <th
                  title="Menor diámetro propuesto de los bajantes asociados (pulg). Unidad: pulg."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Diámetro
                  <br />
                  baj.
                </th>
                <th
                  title="Altura de lámina de agua requerida en la embocadura (m). Unidad: m."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Lámina
                </th>
                <th
                  title="O.K. si el canal tiene capacidad para el caudal real."
                  scope="col"
                  className="col-h ll"
                  style={thL}
                >
                  Qreal ≤<br />
                  Qmáx
                </th>
                <th
                  title="O.K. si la lámina requerida cabe en la altura útil; sin bajantes: Revisar."
                  scope="col"
                  className="col-h ok"
                  style={thOk}
                >
                  H ≤ h<br />
                  útil
                </th>
              </tr>
            </thead>
            <tbody>
              {canalesLl.length === 0 ? (
                <tr>
                  <td
                    colSpan={26}
                    style={{
                      padding: '24px 0',
                      textAlign: 'center',
                      color: 'var(--txt3)',
                      fontSize: 10,
                    }}
                  >
                    No hay canales. Dibuja canales recolectores en el visor para que aparezcan aquí.
                  </td>
                </tr>
              ) : (
                canalesLl.map((c) => {
                  // REQ material absoluto: C SOLO del material de cubierta del catálogo —
                  // sin material → 0 → Q=0 y chequeo 'No cumple' (SIN fallback al override
                  // manual coeficienteC ni al 0.0278 de fila nueva). Con bajantes asociados,
                  // c.materialCubierta ya llega DERIVADO del context (fuente única bajantes).
                  const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
                  // REQ usuario: sin material de canal NO hay manning (ni fallback al override
                  // manual ni al persistido) y la fila no calcula ni chequea nada — solo
                  // inputs (n '—', Qreal/Qmax/yn/velocidad/total '—', chequeos vacíos).
                  const matCanal = c.materialCanal ?? '';
                  const nder = nDeCanal(matCanal);
                  const calc =
                    matCanal && nder != null
                      ? chequeoCanalLluvia({
                          ...c,
                          coeficienteC: Cder,
                          manning: nder,
                          muroVertical: c.muroVertical ?? 0,
                          bordeLibreCm: c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM,
                        })
                      : null;
                  const { Qreal, Qmax, yn, velocidad, chequeo } = calc ?? {
                    Qreal: 0,
                    Qmax: 0,
                    yn: 0,
                    velocidad: 0,
                    chequeo: '',
                  };
                  // Sección total y A efectiva SIEMPRE visibles: son composición de
                  // base/altura/borde (del dibujo o defaults) — no dependen del cálculo
                  // hidráulico ni del material del canal (ped. usuario).
                  const bH = c.b || 0;
                  const totalStr =
                    bH > 0 || (c.h || 0) > 0
                      ? `${bH}x${(c.h || 0) + (c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM)}`
                      : '—';
                  const aEfectivaSiempre = (c.areaAcumulada || 0) + 0.5 * (c.muroVertical || 0);
                  // Embocadura (hoja 2 AE/AG; Z/AB/AC/AD rojas quedan internas): N° = bajantes
                  // asociados del canal, D = el menor propuesto (conservador).
                  const items = c.drawId ? canalBajantes[c.drawId] || [] : [];
                  const ds = items.map((ch) => diamPulgPorChip[ch] || 0).filter((x) => x > 0);
                  const emb = calc
                    ? chequeoEmbocaduraLluvia({
                        Qreal,
                        numBajantes: items.length,
                        diamPulg: ds.length ? Math.min(...ds) : 0,
                        hUtilM: (c.h || 0) / 100,
                      })
                    : { Hreq: 0, chequeo: '' };
                  return (
                    <tr key={c.id}>
                      <td className="c">
                        {/* Sector + piso (orig. usuario): etiqueta tipo CNL1-C. */}
                        <span className="sigla" style={{ fontSize: 10 }}>
                          {c.sector || '—'}
                          {c.piso != null ? `-${pisoCorto(c.piso)}` : ''}
                        </span>
                      </td>
                      <td className="c" style={{ padding: '2px 3px', minWidth: 60 }}>
                        {/* Bajantes que descargan a este canal (ítem 8 usuario): chips
                          CODE-PISO, misma lectura que el área parcial. */}
                        {(() => {
                          const items = c.drawId ? canalBajantes[c.drawId] || [] : [];
                          return items.length > 0 ? (
                            <ChipList items={items} />
                          ) : (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>—</span>
                          );
                        })()}
                      </td>
                      <td className="c">
                        {/* Parcial (REQ canal = Σ bajantes): con asociados llega DERIVADO del
                          context = Σ areaParcialBajanteLl de cada bajante (misma fórmula que
                          la tabla de bajantes); sin asociados → fallbacks propios del canal. */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {c.areaParcial ? Number(c.areaParcial).toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Otras (orig. usuario): editable, default 0 — nunca vacía. REQ:
                          con asociados muestra el Σ derivado de los overrides de los bajantes
                          y al editar escribe updBajanteLL en cada uno (fuente única). */}
                        <CanalDimField
                          id={c.id}
                          field="areaOtras"
                          value={c.areaOtras ?? 0}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td className="c">
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {c.areaAcumulada ? Number(c.areaAcumulada).toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Muro vertical (hoja 2 col. D, entrada): m² que descargan al canal. */}
                        <CanalDimField
                          id={c.id}
                          field="muroVertical"
                          value={c.muroVertical ?? 0}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td className="c">
                        {/* A efectiva = A acumulada + 0.5·muro (hoja 2 col. E). */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {Number(aEfectivaSiempre).toFixed(2)}
                        </span>
                      </td>
                      <td className="c">
                        {/* Material de cubierta (hoja 2 col. G): abreviatura + hover completo.
                          REQ canal = Σ bajantes: con asociados muestra el material COMÚN
                          derivado de los bajantes ('' si mezclados) y al escoger escribe
                          materialCubierta a TODOS los asociados (fuente única). */}
                        <select
                          value={c.materialCubierta ?? ''}
                          aria-label="Material de cubierta"
                          title={c.materialCubierta || 'Material de cubierta'}
                          disabled={!edit}
                          onChange={(e) =>
                            onCanalStrField(c.id, 'materialCubierta', e.target.value)
                          }
                          style={{
                            textAlign: 'center',
                            fontSize: 10,
                            opacity: edit ? 1 : 0.6,
                            padding: '2px 2px',
                            width: '100%',
                            minWidth: 0,
                            fontFamily: 'var(--mono)',
                            background: 'var(--bg2)',
                            border: '1px solid var(--line)',
                            borderRadius: 2,
                            color: 'var(--txt)',
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
                        {/* C derivado del material de cubierta (hoja 2, criterio por material). */}
                        <span
                          title={c.materialCubierta || undefined}
                          style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                        >
                          {Cder > 0 ? Cder.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Intensidad editable (ítem 7 usuario): override por sector en filas
                          fromCanal, estado en manuales. */}
                        <CanalDimField
                          id={c.id}
                          field="intensidad"
                          value={c.intensidad ?? 0}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10 }}
                      >
                        {Qreal > 0 ? fmt(Qreal, 2) : '—'}
                      </td>
                      <td className="c">
                        {/* Material del canal (hoja 2 col. J): n derivado del catálogo. */}
                        <select
                          value={c.materialCanal ?? ''}
                          aria-label="Material del canal"
                          title={c.materialCanal || 'Material del canal'}
                          disabled={!edit}
                          onChange={(e) => onCanalStrField(c.id, 'materialCanal', e.target.value)}
                          style={{
                            textAlign: 'center',
                            fontSize: 10,
                            opacity: edit ? 1 : 0.6,
                            padding: '2px 2px',
                            width: '100%',
                            minWidth: 0,
                            fontFamily: 'var(--mono)',
                            background: 'var(--bg2)',
                            border: '1px solid var(--line)',
                            borderRadius: 2,
                            color: 'var(--txt)',
                            cursor: edit ? 'pointer' : 'default',
                          }}
                        >
                          <option value="">—</option>
                          {MATERIALES_CANAL_LL.map((m) => (
                            <option key={m.nombre} value={m.nombre} title={m.nombre}>
                              {m.abrev}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c">
                        {/* n SOLO del material de canal (REQ: sin material → vacío, sin fallback). */}
                        <span
                          title={c.materialCanal || undefined}
                          style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                        >
                          {nder != null && nder > 0 ? nder.toFixed(3) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Pendiente editable y bidireccional con el dibujo (ítem 7 usuario):
                          filas fromCanal escriben al glifo; manuales al estado. */}
                        <CanalDimField
                          id={c.id}
                          field="pendiente"
                          value={c.pendiente ?? 0}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td className="c">
                        {/* Base editable también en filas fromCanal: escribe al glifo
                          (ítem 7 usuario) en vez de mostrar solo lectura. */}
                        <CanalDimField
                          id={c.id}
                          field="b"
                          value={c.b}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td className="c">
                        <CanalDimField
                          id={c.id}
                          field="h"
                          value={c.h}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td className="c">
                        {/* Borde libre editable por fila (hoja 2 col. O; antes fijo 10 cm). */}
                        <CanalDimField
                          id={c.id}
                          field="bordeLibreCm"
                          value={c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM}
                          onChange={onCanalField}
                          disabled={!edit}
                        />
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 10 }}
                      >
                        {totalStr}
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10 }}
                      >
                        {Qmax > 0 ? fmt(Qmax, 2) : '—'}
                      </td>
                      <td className="c">
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {Qmax > 0 && Qreal > 0 ? `${((Qreal / Qmax) * 100).toFixed(2)}%` : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Tirante normal (hoja 2 col. V): iteración de punto fijo en calc. */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {yn > 0 ? yn.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Velocidad (hoja 2 col. W) = Q/(b·yn). */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {velocidad > 0 ? velocidad.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* D bajante (hoja 2 col. AA): el menor de los asociados. */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {ds.length ? `${Math.min(...ds)}"` : '—'}
                        </span>
                      </td>
                      <td className="c">
                        {/* Lámina requerida H = max(vertedero, orificio) (hoja 2 col. AE). */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {emb.Hreq > 0 ? emb.Hreq.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="c" style={{ fontSize: 10 }}>
                        {renderStatus(chequeo)}
                      </td>
                      <td className="c" style={{ fontSize: 10 }}>
                        {renderStatus(emb.chequeo)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
