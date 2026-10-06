import React from 'react';

interface PageNavProps {
  page: number;
  setPage: (page: number) => void;
  total: number;
  labels?: string[];
  color?: string;
  onPageHover?: (page: number) => void;
}

function PageNav({ page, setPage, total, labels, color, onPageHover }: PageNavProps) {
  // Sin flechas prev/next (orig. usuario): solo botones numerados con etiqueta.
  return (
    <nav
      aria-label="Paginación"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'center',
        padding: '6px 0',
        flexShrink: 0,
      }}
    >
      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => setPage(p)}
          onMouseEnter={() => onPageHover?.(p)}
          aria-current={p === page ? 'page' : undefined}
          style={{
            padding: '6px 16px',
            border: `1.5px solid ${p === page ? color || 'var(--acc)' : 'var(--line)'}`,
            borderRadius: 'var(--r)',
            background: p === page ? `${color || 'var(--acc)'}18` : 'var(--bg3)',
            color: p === page ? color || 'var(--acc)' : 'var(--txt2)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--body)',
            fontWeight: p === page ? 700 : 500,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {labels?.[p - 1] || `Pág ${p}`}
        </button>
      ))}
    </nav>
  );
}

export default React.memo(PageNav);
