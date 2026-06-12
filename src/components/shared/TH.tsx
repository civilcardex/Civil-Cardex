import React from 'react';

interface THProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}

const TH = React.memo(function TH({ children, style, className = '', colSpan, rowSpan }: THProps) {
  return (
    <th
      scope="col"
      className={`col-h ${className}`}
      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9, ...style }}
      colSpan={colSpan}
      rowSpan={rowSpan}
    >
      {children}
    </th>
  );
});

export default TH;
