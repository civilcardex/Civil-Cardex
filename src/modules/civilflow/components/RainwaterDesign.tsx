/**
 * Diseño de la red de ll (Lluvias): tablas de bajantes y canales con diámetro/pendiente escritos al dibujo y chequeo hidráulico por fila (velocidad, régimen por Froude, fuerza tractiva).
 * Ej: bajar la pendiente de un canal puede marcar la fila en rojo si el régimen o la fuerza tractiva salen del rango permitido.
 */
import { useMemo, useCallback, useEffect, useState } from 'react';
import EditButton from './shared/EditButton.tsx';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import EmptyRow from './shared/EmptyRow.tsx';
import { RainwaterTableRow } from './rainwaterTableRow.tsx';
import { useTramos } from '../context/TramosContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { DIAM_OPTIONS } from '../constants';
import { writeDiametroToDrawing } from '../utils/writeDiameterToDrawing.ts';
import { avisarDiametroInvalido } from '../utils/diameterValidation.ts';
import { calcHydraulicCheck } from '../utils/hydraulicCheck.ts';
import { perfilDe } from '../constants/countryStandards';
import { useProyecto } from '../context/ProjectContext.tsx';
import { useRainwater } from '../context/RainwaterContext.tsx';
import {
  buildLlBajanteAssociations,
  computeCanalBajanteRamalKeys,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../utils/rainwaterRows.ts';

export default function DisenoLluvias() {
  const { proy } = useProyecto();
  const [edit, setEdit] = useState(false);
  const tablaRef = useStickyThead2Offset();
  // Borrador del input de pendiente por tramo (commit en blur — mismo patrón que SanitaryDesign).
  const [editingPend, setEditingPend] = useState<Record<string, string>>({});
  const { tramosLl, updTramoLL } = useTramos();
  const { plans } = usePlans();
  const { bajantesLl } = useRainwater();

  const bajanteAssociations = useMemo(
    () => buildLlBajanteAssociations(tramosLl, plans),
    [plans, tramosLl],
  );

  const qMap = useMemo(
    () => computeLlQMap(tramosLl, plans, bajantesLl, bajanteAssociations),
    [tramosLl, bajantesLl, bajanteAssociations, plans],
  );

  const handleDiamChange = useCallback(
    (tramoKey: string, tramoId: string, newPulg: number) => {
      const opt = DIAM_OPTIONS.find((o) => o.pulg === newPulg);
      if (opt && tramoId) {
        // DOCTRINA (decisión 2026-09-24, unificada con el engine): si el ramal sube por
        // ENCIMA del bajante, el bajante AUTO-SUBE (bumpConnectedBajantes en el choke point
        // del engine / followBajanteToMaxRamal en el write) — no se bloquea. El guard que
        // había aquí contradecía ese comportamiento con una alerta.
        const res = writeDiametroToDrawing(tramoId, 'll', opt.label, plans);
        if (!res.ok && res.reason === 'accessory-larger') {
          if (
            avisarDiametroInvalido(
              `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
            )
          )
            return;
        }
        updTramoLL(tramoKey, 'diamDisPulg', newPulg);
      }
    },
    [updTramoLL, plans],
  );

  const tribIds = useMemo(() => getTributarioIds(tramosLl), [tramosLl]);
  // Ramales canal↔bajante: conexión física del bajante al canal recolector, no colector de
  // diseño — fuera de la tabla (orig. usuario).
  const canalBajKeys = useMemo(() => computeCanalBajanteRamalKeys(plans), [plans]);
  const displayTramos = useMemo(
    () =>
      tramosLl.filter(
        (t) =>
          t._key != null &&
          !t.esBajante &&
          !tribIds.has(t._key) &&
          !tribIds.has(t.id) &&
          !canalBajKeys.has(t._key),
      ),
    [tramosLl, tribIds, canalBajKeys],
  );

  // Persiste el punto de control hidráulico (velocidad + relación de llenado) en cada Tramo
  // para que la insignia AGUAS LLUVIAS de InfTab lea un resultado real en vez de los valores por defecto siempre indefinidos.
  useEffect(() => {
    for (const t of displayTramos) {
      if (!t._key) continue;
      const n = t.nmaning ?? 0;
      const sVal = t.sPercent ?? 0;
      const S = sVal > 0 ? sVal / 100 : null;
      const Q = qMap[t._key] || 0;
      const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
      const DintMm = dSel ? dSel.mm : 0;
      let v_real = 0,
        yD = 0,
        qQ0 = 0;
      if (Q > 0 && S != null && S > 0 && n > 0 && DintMm > 0) {
        const hc = calcHydraulicCheck({ Q, S, n, DintMm, lim: perfilDe(proy.pais).san });
        v_real = hc.Vreal;
        yD = Math.round((Math.max(hc.Yc, hc.Yn) / DintMm) * 1000) / 1000;
        qQ0 = hc.qqo;
      }
      if (t.v_real !== v_real) updTramoLL(t._key, 'v_real', v_real);
      if (t.yD !== yD) updTramoLL(t._key, 'yD', yD);
      if (t.qQ0 !== qQ0) updTramoLL(t._key, 'qQ0', qQ0);
    }
  }, [displayTramos, qMap, updTramoLL, proy.pais]);

  // Piso de cada bajante (por code/id) para etiquetar los chips "Bajantes asociados" (BAN1-P1).
  const pisoByBajCode = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramosLl) {
      if (!t.esBajante) continue;
      if (t.code) m[t.code] = t.piso;
      m[t.id] = t.piso;
    }
    return m;
  }, [tramosLl]);

  const llRows = useMemo(
    () => computeLlRows(displayTramos, qMap, bajanteAssociations),
    [displayTramos, qMap, bajanteAssociations],
  );

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Diseno_red.webp"
              alt="Diseño red aguas lluvias"
              width={24}
              height={24}
              className="gas-icon-24"
              loading="lazy"
            />{' '}
            Diseño de red aguas lluvias
          </h3>
          <div className="gas-row-auto">
            <span className="card-s">{displayTramos.length} tramos</span>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
        </div>
        <div className="san-pad-16 scroll-top">
          <div className="scroll-inner">
            <table ref={tablaRef} className="ll-fs tbl">
              <thead>
                <tr>
                  <th
                    title="Tramo de la red de aguas lluvias según el dibujo."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Tramo
                  </th>
                  <th
                    title="Punto de inicio del tramo."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Inicio
                  </th>
                  <th
                    title="Punto donde termina el tramo."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Fin
                  </th>
                  <th
                    title="Bajantes que descargan en este tramo."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Bajantes
                    <br />
                    asociados
                  </th>
                  <th
                    title="Caudal de diseño acumulado del tramo (L/s). Unidad: L/s."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Caudal
                  </th>
                  <th
                    title="Rugosidad n del material de la tubería."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Manning
                  </th>
                  <th
                    title="Pendiente del tramo (%) — manda el dibujo. Unidad: porcentaje (%)."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Pendiente
                  </th>
                  <th
                    title={
                      'Diámetro del tramo: calculado, propuesto y su interior. Unidad: pulgadas (").'
                    }
                    scope="col"
                    className="ll-th ll-th-group col-h ok"
                    colSpan={4}
                  >
                    Diámetro
                  </th>
                  <th
                    title="Capacidad máxima del diámetro propuesto (L/s). Unidad: L/s."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Q<sub>o</sub>
                  </th>
                  <th
                    title="Velocidad de salida/capacidad asociada al diámetro (m/s). Unidad: m/s."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    V<sub>o</sub>
                  </th>
                  <th
                    title="Uso de la capacidad: debe ser ≤ 100%."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Q/Q<sub>o</sub>
                  </th>
                  <th
                    title="Velocidad real del flujo con el diámetro propuesto (m/s). Unidad: m/s."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Velocidad
                    <br />
                    real
                  </th>
                  <th
                    title="O.K. si la velocidad está dentro del rango permitido."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Chequeo
                    <br />
                    velocidad
                  </th>
                  <th
                    title="Tirante crítico del flujo (mm). Unidad: mm."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Y<sub>c</sub>
                  </th>
                  <th
                    title="Tirante normal del flujo (mm). Unidad: mm."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Y<sub>n</sub>
                  </th>
                  <th
                    title="Número de Froude del flujo (subcrítico si es menor a 1)."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Froude
                  </th>
                  <th
                    title="Régimen del flujo según el número de Froude."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Flujo
                  </th>
                  <th
                    title="Altura máxima admisible del tirante (mm). Unidad: mm."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Y<sub>max</sub>
                  </th>
                  <th
                    title="Comparación del tirante normal contra el crítico."
                    scope="col"
                    className="ll-th col-h ll"
                    rowSpan={2}
                  >
                    Y<sub>n</sub> vs Y<sub>c</sub>
                  </th>
                  <th
                    title="Esfuerzo de arrastre sobre el tubo; debe superar el mínimo de autolimpieza."
                    scope="col"
                    className="ll-th ll-th-group col-h ven"
                    colSpan={2}
                  >
                    Fuerza Tractiva
                  </th>
                </tr>
                <tr>
                  <th
                    title='Diámetro calculado con el caudal y la pendiente (pulg). Unidad: pulgadas (").'
                    scope="col"
                    className="ll-th col-h ok"
                  >
                    Calculado
                  </th>
                  <th
                    title='Diámetro comercial propuesto (pulg) — editable. Unidad: pulgadas (").'
                    scope="col"
                    className="ll-th col-h ok"
                  >
                    Diseño
                  </th>
                  <th
                    title="Diámetro interior del tubo propuesto (mm). Unidad: mm."
                    scope="col"
                    className="ll-th col-h ok"
                  >
                    Interior
                  </th>
                  <th
                    title="O.K. si el diámetro propuesto cubre el calculado."
                    scope="col"
                    className="ll-th col-h ok"
                  >
                    Chequeo
                  </th>
                  <th
                    title="Fuerza tractiva real del flujo (kg/m²). Unidad: kg/m²."
                    scope="col"
                    className="ll-th col-h ven"
                  >
                    Real
                  </th>
                  <th
                    title="La fuerza tractiva debe superar 0,15 kg/m² (autolimpieza)."
                    scope="col"
                    className="ll-th col-h ven"
                  >
                    &gt;0.15
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayTramos.length === 0 ? (
                  <EmptyRow colSpan={24} fontSize={11.5} />
                ) : (
                  llRows.map((row) => (
                    <RainwaterTableRow
                      key={row.tKey}
                      row={row}
                      pisoByBajCode={pisoByBajCode}
                      edit={edit}
                      draft={editingPend[row.tKey]}
                      setEditingPend={setEditingPend}
                      handleDiamChange={handleDiamChange}
                      updTramoLL={updTramoLL}
                      plans={plans}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
