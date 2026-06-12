import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconImg?: string;
  iconImgStyle?: React.CSSProperties;
  className?: string;
  style?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  bodyClassName?: string;
  children: React.ReactNode;
}

const Card = React.memo(function Card({ title, subtitle, icon, iconImg, iconImgStyle, className = '', style, headerStyle, bodyStyle, bodyClassName = 'card-b', children }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || icon || iconImg) && (
        <div className="card-h" style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {iconImg ? <img src={iconImg} alt="" style={{ width: 18, height: 18, ...iconImgStyle }} /> : null}
            {icon}
            {title && <span className="card-t">{title}</span>}
          </div>
          {subtitle && <span className="card-s">{subtitle}</span>}
        </div>
      )}
      <div className={bodyClassName} style={{ padding: 1, ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
});

export default Card;
