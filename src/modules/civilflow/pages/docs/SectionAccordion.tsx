import React, { type ReactNode } from 'react';

interface SectionAccordionProps {
  section: {
    title: string;
    body: ReactNode;
    categoryColor?: string;
    categoryName?: string;
  };
  sectionKey: string;
  /** Key ya slugeada (sin espacios/acentos) para los atributos DOM id/aria-controls.
   *  Opcional: cae a sectionKey para consumidores legacy. */
  contentId?: string;
  isOpen: boolean;
  onToggle: (key: string) => void;
  showCategory: boolean;
  /** Término de búsqueda a resaltar en el título (opcional). */
  query?: string;
}

/** Resalta la primera coincidencia del término en el título con <mark>. */
function resaltar(title: string, q?: string): ReactNode {
  const t = q?.trim();
  if (!t) return title;
  const idx = title.toLowerCase().indexOf(t.toLowerCase());
  if (idx < 0) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark style={{ background: '#f5d668', color: '#111317', borderRadius: 2 }}>
        {title.slice(idx, idx + t.length)}
      </mark>
      {title.slice(idx + t.length)}
    </>
  );
}

export default function SectionAccordion({
  section,
  sectionKey,
  contentId,
  isOpen,
  onToggle,
  showCategory,
  query,
}: SectionAccordionProps) {
  const domContentId = `section-content-${contentId ?? sectionKey}`;
  return (
    <div
      className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container"
      data-section-color
      style={
        {
          '--section-color': section.categoryColor,
          borderLeft: isOpen ? `3px solid ${section.categoryColor}` : undefined,
          boxShadow: isOpen ? '0 4px 16px rgb(0 0 0 / 0.28)' : '0 1px 4px rgb(0 0 0 / 0.18)',
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isOpen}
        aria-controls={domContentId}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high"
      >
        <span
          className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        >
          chevron_right
        </span>
        <span className="text-[13px] font-semibold text-on-surface">
          {resaltar(section.title, query)}
        </span>
        {showCategory && (
          <span
            className="text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ color: section.categoryColor, border: '1px solid var(--section-color)' }}
          >
            {section.categoryName}
          </span>
        )}
        <span className="ml-auto material-symbols-outlined text-on-surface-variant text-sm">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div
          id={domContentId}
          className="px-4 pb-4 pt-1 border-t border-outline-variant animate-fade-in docs-body"
        >
          {section.body}
        </div>
      )}
    </div>
  );
}
