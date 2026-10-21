import React from 'react';
import { FilaCanalRow } from './rainChannels/ChannelRow.tsx';
import EditButton from './shared/EditButton.tsx';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { pisoCorto, DIAM_BAN } from '../constants';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { loadFromStorage } from '../services/storageService.ts';
import { useRainwater } from '../context/RainwaterContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { writeCanalDimsToDrawing } from '../utils/writeDiameterToDrawing.ts';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';
import { sectorDe } from '../utils/formatUtils.ts';
import { entradaPor } from '../utils/diamLookup';
import { repartirOtrasCanal } from '../utils/rainwaterRows.ts';
import type { DrawingData } from '../utils/drawingSync.ts';
import { EV_SAN_SYNC, EV_HIDRO_SYNC, EV_STORAGE } from '../utils/fixtureEvents.ts';

// Encabezados compactos (orig. usuario: sin scroll horizontal): wrap a 2-3 líneas.
const thL: React.CSSProperties = {
  fontSize: 10,
  textAlign: 'center',
  padding: '1px 2px',
  whiteSpace: 'normal',
};
const thG: React.CSSProperties = { ...thL, fontWeight: 700, letterSpacing: 0.3 };
const thOk: React.CSSProperties = { ...thL };

export default function ChequeoCanalesLluvias() {
  const [edit, setEdit] = React.useState(false);
  const tablaRef = useStickyThead2Offset();
  const {
    canalesLl,
    updCanalLL,
    updCanalSector,
    conRecolectora,
    canalBajantes,
    updBajanteLL,
    setMaterialCanal,
  } = useRainwater();
  const { plans } = usePlans();
  // ── Canal = Σ bajantes asociados (REQ: fuente única = overrides de los BAJANTES) ──
  // Con bajantes asociados, las celdas Parcial/Otras/Material cubierta muestran el valor
  // DERIVADO del context (canalesLlAuto ya lo calcula con areaParcialBajanteLl) y al editar
  // se escribe updBajanteLL en CADA asociado — así la tabla de bajantes y esta leen el mismo
  // override y sincronizan en vivo. Sin asociados → override propio del canal (como hoy).
  const asociadosDe = (drawId?: string): string[] => (drawId ? canalBajantes[drawId] || [] : []);
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
      asociados.forEach((chip, i) => updBajanteLL(sectorDe(chip), 'areaOtras', vals[i] ?? 0));
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

  // Materiales: routing único del contexto (setMaterialCanal directo — la
  // misma que usan panel y menú). Los materiales viven en el override, no en el glifo.

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
    window.addEventListener(EV_STORAGE, bump);
    window.addEventListener(EV_SAN_SYNC, bump as EventListener);
    window.addEventListener(EV_HIDRO_SYNC, bump as EventListener);
    return () => {
      window.removeEventListener(EV_STORAGE, bump);
      window.removeEventListener(EV_SAN_SYNC, bump as EventListener);
      window.removeEventListener(EV_HIDRO_SYNC, bump as EventListener);
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
          rawPulg && rawPulg > 0 ? rawPulg : (entradaPor(DIAM_BAN, 'nom', b.dNominal)?.pulg ?? 0);
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
                canalesLl.map((c) => (
                  <FilaCanalRow
                    c={c}
                    diamPulgPorChip={diamPulgPorChip}
                    canalBajantes={canalBajantes}
                    onCanalField={onCanalField}
                    setMaterialCanal={setMaterialCanal}
                    edit={edit}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
