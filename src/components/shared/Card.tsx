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
  headerRight?: React.ReactNode;
}

const Card = React.memo(function Card({ title, subtitle, icon, iconImg, iconImgStyle, className = '', style, headerStyle, bodyStyle, bodyClassName = 'card-b', headerRight, children }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || icon || iconImg || headerRight) && (
        <div className="card-h" style={{ display: 'flex', flexDirection: 'column', ...headerStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {iconImg ? <img src={iconImg} alt=""  width={18} height={18} style={{width:18,height:18, ...iconImgStyle }}  loading="lazy" /> : null}
              {icon}
              {title && <h3 className="card-t">{title}</h3>}
            </div>
            {headerRight && <div>{headerRight}</div>}
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
