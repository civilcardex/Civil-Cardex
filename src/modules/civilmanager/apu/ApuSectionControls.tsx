import { ActionIcon } from '../shared/icons.tsx';
import { fmtMoneda } from '../calc.ts';

/** Botón de borrar fila de recurso, idéntico en las 4 secciones del APU (MO (Mano de Obra)/
 *  equipos/insumos/transporte). Ej: <BtnDelRecurso onClick={() => del(i)} />. */
export function BtnDelRecurso({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cm-btn-icon" onClick={onClick} aria-label="Eliminar recurso">
      <ActionIcon name="delete" label="Eliminar recurso" color="var(--err)" />
    </button>
  );
}

/** Pie de sección del APU: botón "+ {textoAdd}" y "{etiqueta}: {valor}" a la derecha. Ej:
 *  <PieSeccionApu textoAdd="Agregar Recurso" onAdd={add} etiqueta="Subtotal MO" valor={subtotal} />. */
export function PieSeccionApu(props: {
  textoAdd: string;
  onAdd: () => void;
  etiqueta: string;
  valor: number;
}): React.JSX.Element {
  return (
    <div className="cm-xl-foot">
      <button type="button" className="cm-btn cm-btn-ok" onClick={props.onAdd}>
        {props.textoAdd}
      </button>
      <span className="cm-flex-1" />
      <span className="cm-label-11">
        {props.etiqueta}: <b>{fmtMoneda(props.valor)}</b>
      </span>
    </div>
  );
}
