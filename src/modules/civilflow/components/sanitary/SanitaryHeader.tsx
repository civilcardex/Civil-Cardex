/**
 * Cabecera de la tarjeta de diseño de red sanitaria: icono + título + contador de tramos/UD
 * (Unidades de Descarga) + botón de edición. Puro presentacional.
 * Ej: 3 ramales con 12 UD en total -> "3 tramos · 12 UD totales".
 */
import EditButton from '../shared/EditButton.tsx';

/** Props de la cabecera: lo que se muestra y el estado de edición que vive en el padre. */
export interface SanitaryHeaderProps {
  /** Ramales mostrados (los que pintan fila en la tabla). */
  cantTramos: number;
  /** Total de UD del proyecto (suma cant * ud de cada aparato). */
  totalUD: number;
  edit: boolean;
  setEdit: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Cabecera de la tarjeta "Diseño de red sanitaria". */
export default function SanitaryHeader({
  cantTramos,
  totalUD,
  edit,
  setEdit,
}: SanitaryHeaderProps) {
  return (
    <div className="card-h">
      <h3 className="card-t">
        <img
          src="/iconos_civilflow/diseno_redes/sanitaria/RS_Diseno.webp"
          alt="Diseño red sanitaria"
          width={24}
          height={24}
          style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
          loading="lazy"
        />{' '}
        Diseño de red sanitaria
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <span className="card-s">
          {cantTramos} tramos · {totalUD} UD totales
        </span>
        <EditButton edit={edit} setEdit={setEdit} />
      </div>
    </div>
  );
}
