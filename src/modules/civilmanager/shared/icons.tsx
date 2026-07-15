export type NavIconName =
  | 'catalogos'
  | 'apus'
  | 'proyectos'
  | 'programacion'
  | 'control_costes'
  | 'reportes'
  | 'configuracion'
  | 'colaboradores'
  | 'cuadrilla'
  | 'equipos'
  | 'insumos'
  | 'proveedores';

interface NavIconProps {
  name: NavIconName;
  size?: number;
  alt: string;
}

/** Ícono de navegación (sección/sub-tab), copiado desde el prototipo a public/iconos_civilmanager/. */
export function NavIcon({ name, size = 18, alt }: NavIconProps) {
  return (
    <img
      src={`/iconos_civilmanager/${name}.svg`}
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      loading="lazy"
      alt={alt}
    />
  );
}

interface ActionIconProps {
  name: string;
  label: string;
  className?: string;
  color?: string;
}

/** Ícono de acción genérico (editar/borrar/agregar/etc.) vía Material Symbols. */
export function ActionIcon({ name, label, className, color }: ActionIconProps) {
  return (
    <span className={`material-symbols-outlined ${className ?? ''}`} style={{ fontSize: 16, color }} role="img" aria-label={label}>
      {name}
    </span>
  );
}
