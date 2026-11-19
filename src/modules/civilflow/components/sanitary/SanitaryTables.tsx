/**
 * Tabla de diseño de red sanitaria: cabeceras con tooltips por columna (UD, Hunter, Manning,
 * diámetros, Froude, fuerza tractiva) y una fila por ramal con sus inputs de edición. La tabla
 * pinta EXACTAMENTE lo que pintaba SanitaryDesign inline — mismo orden de nodos y estilos.
 * Ej: fila RS1-P1 con 4 UD, K 0.8, Q 0.38 L/s, diámetro diseñado 2" y chequeo "Ok".
 */
import { rangoSanTxt, ftTxt } from '../../constants/countryStandards';
import EmptyRow from '../shared/EmptyRow.tsx';
import { SanitaryTableRow } from './sanitaryTableRow.tsx';
import type { SanRow } from '../../utils/sanitaryRows.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/** Props de la tabla: el modelo ya calculado (useSanitaryRows) + el estado de edición. */
export interface SanitaryTablesProps {
  tablaRef: React.RefObject<HTMLTableElement | null>;
  /** País del proyecto: solo para los tooltips de rango (velocidad / fuerza tractiva). */
  pais: string;
  /** Ramales dibujados: la tabla muestra EmptyRow cuando no hay ninguno. */
  displayTramos: unknown[];
  sanRows: SanRow[];
  conexionesDisplay: Record<string, string[]>;
  /** UD acumuladas por clave (para el título "X UD" de cada insignia "Otros"). */
  componentTotalMap: Record<string, number>;
  /** Clave de tramo -> etiqueta legible (RS1, T1RS1…). */
  keyToLabel: Map<string, string>;
  edit: boolean;
  /** Borradores de pendiente por tramo mientras se escribe en el input. */
  editingPend: Record<string, string>;
  setEditingPend: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleDiamChange: (tramoId: string, newPulg: number) => void;
  plans: PlanItem[];
}

/** La tabla completa (thead + tbody) del diseño sanitario. */
export default function SanitaryTables({
  tablaRef,
  pais,
  displayTramos,
  sanRows,
  conexionesDisplay,
  componentTotalMap,
  keyToLabel,
  edit,
  editingPend,
  setEditingPend,
  handleDiamChange,
  plans,
}: SanitaryTablesProps) {
  // Resumen para lectores de pantalla: la tabla es grande y viva — anunciar UNA línea
  // compacta cuando cambia, no cada celda.
  const noCumple = sanRows.filter((r) =>
    [r.chequeoV, r.chequeoYn, r.chequeoFT, r.chequeoS].some((c) => c?.startsWith('NO CUMPLE')),
  ).length;
  return (
    <div className="scroll-top san-pad-16">
      <div className="scroll-inner">
        <div className="sr-only" role="status" aria-live="polite">
          {`Red sanitaria: ${sanRows.length} tramos, ${noCumple} con chequeo NO CUMPLE`}
        </div>
        <table ref={tablaRef} className="tbl san-fs">
          <caption className="sr-only">Diseño de red sanitaria</caption>
          <thead>
            <tr>
              <th
                title="Tramo de la red sanitaria según el dibujo (ramal o bajante)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="6"
              >
                Tramo
              </th>
              <th
                title="Unidades de descarga (Hunter) que acumula el tramo."
                scope="col"
                className="san-th-grupo col-h san"
                colSpan={3}
              >
                Unidades de descarga
              </th>
              <th
                title="Caudal de diseño del tramo (L/s). Unidad: L/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Caudal
              </th>
              <th
                title="Rugosidad n del material de la tubería."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Manning
              </th>
              <th
                title="Pendiente de diseño del tramo (%) — manda el dibujo. Unidad: porcentaje (%)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Pendiente
              </th>
              <th
                title={
                  'Diámetro del tramo: calculado, propuesto y su interior. Unidad: pulgadas (").'
                }
                scope="col"
                className="san-th-grupo col-h ok"
                colSpan={4}
              >
                Diámetro
              </th>
              <th
                title="Capacidad máxima del diámetro propuesto (L/s). Unidad: L/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                Q<sub>o</sub>
              </th>
              <th
                title="Velocidad de salida/capacidad asociada al diámetro (m/s). Unidad: m/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                V<sub>o</sub>
              </th>
              <th
                title="Uso de la capacidad: debe ser ≤ 100%."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                Q/Q<sub>o</sub>
              </th>
              <th
                title="Velocidad real del flujo con el diámetro propuesto (m/s). Unidad: m/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Velocidad real
              </th>
              <th
                title={`O.K. si la velocidad está dentro del rango permitido: ${rangoSanTxt(pais)}.`}
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Chequeo velocidad
              </th>
              <th
                title="Tirante crítico del flujo (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>c</sub>
              </th>
              <th
                title="Tirante normal del flujo (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>n</sub>
              </th>
              <th
                title="Número de Froude del flujo (subcrítico si es menor a 1)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Froude
              </th>
              <th
                title="Régimen del flujo según el número de Froude."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="6"
              >
                Flujo
              </th>
              <th
                title="Altura máxima admisible del tirante (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>max</sub>
              </th>
              <th
                title="Comparación del tirante normal contra el crítico."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Y<sub>n</sub> vs Y<sub>c</sub>
              </th>
              <th
                title="Esfuerzo de arrastre sobre el tubo; debe superar el mínimo de autolimpieza."
                scope="col"
                className="san-th-grupo col-h ven"
                colSpan={2}
              >
                Fuerza Tractiva
              </th>
            </tr>
            <tr>
              <th
                title="Unidades de descarga generadas en el propio tramo."
                scope="col"
                className="col-h san san-th-sub"
              >
                Propia
              </th>
              <th
                title="Unidades de descarga que llegan de tramos conectados aguas arriba."
                scope="col"
                className="col-h san san-th-sub"
              >
                Otros
              </th>
              <th
                title="Unidades de descarga acumuladas del tramo."
                scope="col"
                className="col-h san san-th-sub"
              >
                Total
              </th>
              <th
                title='Diámetro calculado con el caudal y la pendiente (pulg). Unidad: pulgadas (").'
                scope="col"
                className="col-h ok san-th-sub"
              >
                Calculado
              </th>
              <th
                title='Diámetro comercial propuesto (pulg) — editable. Unidad: pulgadas (").'
                scope="col"
                className="col-h ok san-th-sub"
              >
                Diseño
              </th>
              <th
                title="Diámetro interior del tubo propuesto (mm). Unidad: mm."
                scope="col"
                className="col-h ok san-th-sub"
              >
                Interior
              </th>
              <th
                title="O.K. si el diámetro propuesto cubre el calculado."
                scope="col"
                className="col-h ok san-th-sub"
              >
                Chequeo
              </th>
              <th
                title="Fuerza tractiva real del flujo (kg/m²). Unidad: kg/m²."
                scope="col"
                className="col-h ven san-th-sub"
              >
                Real
              </th>
              <th
                title={`La fuerza tractiva debe superar ${ftTxt(pais)} (autolimpieza).`}
                scope="col"
                className="col-h ven san-th-sub"
              >
                &gt;0.15
              </th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <EmptyRow colSpan={25} fontSize={10.5} />
            ) : (
              sanRows.map((row) => (
                <SanitaryTableRow
                  key={row.tKey}
                  row={row}
                  connectedKeys={conexionesDisplay[row.tKey] || []}
                  componentTotalMap={componentTotalMap}
                  keyToLabel={keyToLabel}
                  edit={edit}
                  draft={editingPend[row.tKey]}
                  setEditingPend={setEditingPend}
                  handleDiamChange={handleDiamChange}
                  plans={plans}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
