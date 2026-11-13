import { type ReactNode } from 'react';

interface SectionAccordionProps {
  section: {
    title: string;
    body: ReactNode;
    /** Id de la categoría: fija --cat-color/--section-color por CSS (docs.css). */
    categoryId?: string;
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
      <mark className="docs-mark">{title.slice(idx, idx + t.length)}</mark>
      {title.slice(idx + t.length)}
    </>
  );
}

/** Acordeón de una sección de la página /docs: título clicable que abre/cierra; el cuerpo SIEMPRE queda montado (los crawlers leen el contenido cerrado). Ej: clic en "Hazen-Williams" y se despliega su fórmula. */
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
      className="docs-section border border-outline-variant rounded-lg overflow-hidden bg-surface-container"
      data-section-color
      data-cat={section.categoryId}
      data-open={isOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isOpen}
        aria-controls={domContentId}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high"
      >
        <span
          className={`material-symbols-outlined text-lg! transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        >
          chevron_right
        </span>
        <span className="text-[13px] font-semibold text-on-surface">
          {resaltar(section.title, query)}
        </span>
        {showCategory && (
          <span className="docs-section-chip text-[10px] px-2 py-0.5 rounded font-mono">
            {section.categoryName}
          </span>
        )}
        <span className="ml-auto material-symbols-outlined text-on-surface-variant text-sm!">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {/* Cuerpo SIEMPRE montado (SEO: crawlers sin JS leen la documentación cerrada);
          oculto con display:none en vez de desmontarse. */}
      <div
        id={domContentId}
        className={`px-4 pb-4 pt-1 border-t border-outline-variant docs-body ${isOpen ? 'animate-fade-in' : 'hidden'}`}
        hidden={!isOpen}
      >
        {section.body}
      </div>
    </div>
  );
}
