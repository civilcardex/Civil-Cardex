// Encabezado de 24 columnas de TablaTipologias (dos <tr>: grupos arriba, subcolumnas
// abajo). JSX 100% estático salvo los botones ＋/− de Gasodomésticos — moverlo fuera del
// cuerpo del map de filas lo saca del re-render de cada sector.
import React from 'react';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';

/** Props del encabezado: lo mínimo que tocan sus 3 celdas interactivas. */
interface Props {
  filas: { aparatos: unknown[]; areaId: string }[];
  edit: boolean;
  borrandoSub: boolean;
  onAdd: () => void;
  onToggleBorrar: () => void;
}

/**
 * thead de la tabla de tipologías NTC 3631 (Norma Técnica Colombiana de ventilación de
 * recintos con gas): grupos (Recinto/Gasodomésticos/Verificación/Solución/Cálculo/Rejillas)
 * en la fila 1, 24 subcolumnas con tooltips normativos en la fila 2.
 */
export function TablaTipologiasHeader({ filas, edit, borrandoSub, onAdd, onToggleBorrar }: Props) {
  return (
    <thead>
      <tr>
        <th scope="col" rowSpan={2} className="rt-th">
          #
        </th>
        <th scope="col" rowSpan={2} className="rt-th rt-w-56">
          Apto
        </th>
        <th scope="col" className="rt-thg" colSpan={5}>
          Recinto
        </th>
        <th scope="col" className="rt-thg" colSpan={4}>
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
              onAdd();
            }}
            className="rt-add-btn"
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
              onToggleBorrar();
            }}
            data-armed={borrandoSub ? 'true' : 'false'}
            className="rt-del-btn"
          >
            −
          </button>
        </th>
        <th scope="col" className="rt-thg" colSpan={3}>
          Verificación
        </th>
        <th scope="col" className="rt-thg" colSpan={2}>
          Solución
        </th>
        <th scope="col" className="rt-thg" colSpan={4}>
          Cálculo
        </th>
        <th scope="col" className="rt-thg" colSpan={3}>
          Rejillas sugeridas
        </th>
        <th scope="col" rowSpan={2} className="rt-th">
          Estado
        </th>
      </tr>
      <tr>
        <th scope="col" className="rt-ths" title="Nombre del sector (etiqueta del área dibujada)">
          Sector
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Área en planta del sector (m²) — del polígono dibujado"
        >
          Área
        </th>
        <th scope="col" className="rt-ths rt-w-74" title="Altura libre del sector (m)">
          Alto
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Mono espacio: una sola planta, sin muros internos; ambientes divididos solo por muebles (Anexo B)"
        >
          Mono Espacio
        </th>
        <th scope="col" className="rt-ths" title="Volumen del recinto, en m³ = Área × Alto">
          Volumen del recinto
        </th>
        <th
          scope="col"
          className="rt-ths rt-min-120"
          title="Gasodomésticos asignados al sector — el ＋ añade otra subfila"
        >
          Aparato
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Cantidad de unidades de este aparato en el sector"
        >
          UN
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Potencia nominal, en kW — la fija el catálogo NTC 3728 según el tipo de gas"
        >
          P
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Tipo de recinto A/B/C (NTC 3631): define el coeficiente cm²/kW de las aberturas"
        >
          Tipo
        </th>
        <th scope="col" className="rt-ths" title="Suma de UN × P sin artefactos Tipo C, en kW">
          Total P
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Volumen requerido (m³) = 3,4 m³ por kW, sin Tipo C (num. 4.1.1)"
        >
          Volumen Requerido
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Clasificación del recinto según su volumen (num. 4.1)"
        >
          Chequeo Volumen / Clasificación del Recinto
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Estrategia de ventilación del sector (num. 4.1.2, 4.2, 4.3)"
        >
          Tipo de Ventilación
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Volumen Recinto Adjunto (m³): espacio comunicado por aberturas interiores (solo Interior/Combinación)"
        >
          VRA
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Potencia Recinto Adjunto (kW): gasodomésticos del espacio adjunto (sin Tipo C)"
        >
          PRA
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Área Conectores de Evacuación (cm²): suma de secciones π·D²/4 (solo Método 2)"
        >
          ACE
        </th>
        <th scope="col" className="rt-ths" title="Solución que resulta del cálculo">
          Solución aplicada
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Área libre mínima por abertura en cm² (redondeo por arriba)"
        >
          Área Libre Requerida por Abertura
        </th>
        <th scope="col" className="rt-ths" title="Coeficiente en cm²/kW según la solución aplicada">
          Coeficiente de Área
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Rejillas del catálogo sugeridas por área efectiva del fabricante: superior/única (método 1 o 2) e inferior (método 1)"
        >
          Rejillas Sugeridas
        </th>
        <th
          scope="col"
          className="rt-ths"
          title="Área efectiva instalada en cm²: la menor entre las aberturas"
        >
          Área Efectiva Instalada
        </th>
      </tr>
    </thead>
  );
}

/**
 * Modal de confirmación de borrado de aparato (reemplaza al confirm nativo). El foco
 * inicial lo maneja el padre (cancelarRef vive allá — a11y: sin autofocus JSX).
 * Ej: <TablaTipologiasConfirmDel sector="Apt 101" cancelarRef={ref} onCancelar={...} onConfirmar={...} />.
 */
export function TablaTipologiasConfirmDel({
  sector,
  cancelarRef,
  onCancelar,
  onConfirmar,
}: {
  sector: string;
  cancelarRef: React.RefObject<HTMLButtonElement | null>;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <ModalOverlay onClose={onCancelar} ariaLabel="Eliminar aparato">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Eliminar aparato"
        className="modal-shell-card"
      >
        <h3 className="dialog-title">Eliminar aparato</h3>
        <p className="dialog-lead">
          ¿Eliminar este aparato del sector <b className="rt-txt-strong">{sector}</b>? Se borra su
          subfila, la cantidad y deja de sumar potencia.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            ref={cancelarRef}
            onClick={onCancelar}
            className="dialog-btn dialog-btn-ghost"
          >
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className="dialog-btn dialog-btn-danger">
            Eliminar
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
