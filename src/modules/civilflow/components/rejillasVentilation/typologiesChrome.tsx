// Encabezado de 24 columnas de TablaTipologias (dos <tr>: grupos arriba, subcolumnas
// abajo). JSX 100% estático salvo los botones ＋/− de Gasodomésticos — moverlo fuera del
// cuerpo del map de filas lo saca del re-render de cada sector.
import React from 'react';
import { TH, THG, THS } from './rejillasShared.ts';

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
              onAdd();
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
              onToggleBorrar();
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
        <th style={THS} title="Volumen del recinto, en m³ = Área × Alto">
          Volumen del recinto
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
          title="Potencia nominal, en kW — la fija el catálogo NTC 3728 según el tipo de gas"
        >
          P
        </th>
        <th
          style={THS}
          title="Tipo de recinto A/B/C (NTC 3631): define el coeficiente cm²/kW de las aberturas"
        >
          Tipo
        </th>
        <th style={THS} title="Suma de UN × P sin artefactos Tipo C, en kW">
          Total P
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
          VRA
        </th>
        <th
          style={THS}
          title="Potencia Recinto Adjunto (kW): gasodomésticos del espacio adjunto (sin Tipo C)"
        >
          PRA
        </th>
        <th
          style={THS}
          title="Área Conectores de Evacuación (cm²): suma de secciones π·D²/4 (solo Método 2)"
        >
          ACE
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
      </tr>
    </thead>
  );
}

/**
 * Modal de confirmación de borrado de aparato (reemplaza al confirm nativo). El foco
 * inicial lo maneja el padre (cancelarRef vive allá — a11y: sin autofocus JSX).
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
    <div
      role="presentation"
      onClick={onCancelar}
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* stopPropagation del fondo: clic dentro no cierra (a11y: dialog no interactivo) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Eliminar aparato"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg2, #171a1f)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '18px 20px',
          maxWidth: 340,
          width: '90%',
          boxShadow: '0 12px 40px rgba(0,0,0,.5)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Eliminar aparato</div>
        <div style={{ fontSize: 12.5, color: 'var(--txt2)', marginBottom: 14 }}>
          ¿Eliminar este aparato del sector <b style={{ color: 'var(--txt)' }}>{sector}</b>? Se
          borra su subfila, la cantidad y deja de sumar potencia.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            ref={cancelarRef}
            onClick={onCancelar}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--txt)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: '#F04545',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
