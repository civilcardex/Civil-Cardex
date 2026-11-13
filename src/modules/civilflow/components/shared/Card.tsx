/** Tarjeta contenedora genérica (borde, fondo, título opcional) de paneles y formularios.
 *  Ej: las tarjetas de la pestaña Info son este componente con distinto título. */
import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconImg?: string;
  /** Clase extra para el <img> del icono (antes iconImgStyle). */
  iconClassName?: string;
  className?: string;
  /** Clase extra para el header. */
  headerClassName?: string;
  /** Clase extra para el cuerpo (p. ej. `card-b-p0` para tablas con padding 0). */
  bodyClassName?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const Card = React.memo(function Card({
  title,
  subtitle,
  icon,
  iconImg,
  iconClassName,
  className = '',
  headerClassName,
  bodyClassName,
  headerRight,
  children,
}: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || icon || iconImg || headerRight) && (
        <div className={`card-h card-h-col${headerClassName ? ` ${headerClassName}` : ''}`}>
          <div className="card-h-row">
            <div className="card-h-left">
              {iconImg ? (
                <img
                  src={iconImg}
                  alt=""
                  width={18}
                  height={18}
                  className={`card-icon${iconClassName ? ` ${iconClassName}` : ''}`}
                  loading="lazy"
                />
              ) : null}
              {icon}
              {title && <h3 className="card-t">{title}</h3>}
            </div>
            {headerRight && <div>{headerRight}</div>}
          </div>
          {subtitle && <span className="card-s">{subtitle}</span>}
        </div>
      )}
      <div className={`card-b card-b-tight${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {children}
      </div>
    </div>
  );
});

export default Card;
