import { useMemo, useState } from 'react';
import Navbar from '../../../components/Navbar';
import { docData } from './docs/docData';
import SectionAccordion from './docs/SectionAccordion';
import { usePageMeta } from '../../../hooks/usePageMeta';

/** Extrae texto plano de un nodo React — búsqueda honesta sin JSON.stringify (pasa por las
 *  props.children de los elementos, como el hack anterior, pero sin contaminar con clases). */
function nodeText(n: unknown): string {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join(' ');
  const el = n as { props?: { children?: unknown } };
  if (el && typeof el === 'object' && el.props) return nodeText(el.props.children);
  return '';
}

/** Key segura para atributos id/aria-controls DOM: sin espacios ni acentos.
 *  La key de React/estado sigue usando la clave original (cat:titulo). */
const domId = (key: string): string =>
  key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');

/** Agrupación de categorías por módulo (orig. usuario: la doc se navega por módulo). */
const MODULOS: { label: string; nota: string; cats: string[] }[] = [
  {
    label: 'Civil Flow',
    nota: 'Diseño hidrosanitario',
    cats: [
      'hidraulica',
      'sanitarias',
      'lluvias',
      'agua_fria',
      'agua_caliente',
      'gas',
      'equipos',
      'tablas',
      'formulas',
      'manual',
    ],
  },
  {
    label: 'Civil Manager',
    nota: 'Costos y presupuestos',
    cats: ['manager'],
  },
];

function DocsPage() {
  // Deep-link (orig. usuario): /docs#categoria abre esa categoría directamente (lazy init, sin
  // efecto ni setState-en-render).
  const [activeCat, setActiveCat] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return Object.keys(docData).includes(h) ? h : 'hidraulica';
  });
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // Acordeones por módulo del panel izquierdo (orig. usuario), ambos abiertos por defecto.
  const [modsOpen, setModsOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULOS.map((m) => [m.label, true])),
  );
  usePageMeta(
    'Documentación',
    'Guía completa de CivilCardex. Normas NTC 1500, RAS 2000, NTC 3728. Tutoriales de diseño hidrosanitario y estructural.',
  );

  const categories = Object.entries(docData).map(([id, data]) => ({
    id,
    ...data,
    sections: data.sections.map((s) => ({
      ...s,
      categoryColor: data.color,
      categoryName: data.name,
      categoryId: id,
    })),
  }));
  const activeCategory = categories.find((c) => c.id === activeCat);

  const allSections = categories.flatMap((c) => c.sections);

  // Texto plano por sección, calculado UNA vez (la búsqueda solo compara strings).
  const searchableText = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allSections) map[`${s.categoryId}:${s.title}`] = nodeText(s.body).toLowerCase();
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const filteredSections =
    search.trim() === ''
      ? activeCategory?.sections || []
      : allSections.filter((s) => {
          const key = `${s.categoryId}:${s.title}`;
          return (
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            searchableText[key]?.includes(search.toLowerCase())
          );
        });

  // En búsqueda el listado cruza todas las categorías: el hero deja de representar
  // a la categoría activa (neutro) y el H1 describe lo que realmente se ve.
  const enBusqueda = search.trim().length > 0;
  const heroColor = enBusqueda ? '#6b7480' : (activeCategory?.color ?? '#4D8FF7');

  const selectCat = (id: string) => {
    setActiveCat(id);
    setOpenSections({});
    history.replaceState(null, '', `#${id}`);
  };

  // Expandir/colapsar todo lo visible (orig. usuario: lectura comparativa rápida).
  const setAllOpen = (open: boolean) => {
    const next: Record<string, boolean> = {};
    if (open) for (const s of filteredSections) next[`${s.categoryId}:${s.title}`] = true;
    setOpenSections(next);
  };

  return (
    <div className="landing-root min-h-screen bg-surface-bg flex flex-col">
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: 'Documentación — CivilFlow',
          description: 'Documentación técnica de normas y estándares de ingeniería hidrosanitaria.',
          about: 'NTC 1500, RAS 2000, NSR-10, NFPA 13, ingeniería hidrosanitaria',
        })}
      </script>
      <style>{`::-webkit-scrollbar-thumb{background:#dce3ea}::-webkit-scrollbar-thumb:hover{background:#f0f4f8}::-webkit-scrollbar-track{background:#1a1c20}`}</style>
      <Navbar />
      <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-64px)] pt-16 overflow-y-auto md:overflow-hidden">
        <style>{`
        [data-section-color] .text-primary,
        [data-section-color] .\\!text-primary {
          color: var(--section-color) !important;
        }
        .docs-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .docs-scroll::-webkit-scrollbar-track {
          background: #1a1c20;
        }
        .docs-scroll::-webkit-scrollbar-thumb {
          background: #3a494a;
          border-radius: 3px;
        }
        .docs-scroll::-webkit-scrollbar-thumb:hover {
          background: #4d8ff7;
        }
        /* Cuerpo de documentación: des-aplanado sin tocar los 11 data files — solo
           selectores sobre el markup existente (fórmulas, callouts, definiciones, tablas). */
        .docs-body div.bg-surface-bg.border {
          box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
          border-left: 3px solid var(--section-color);
        }
        .docs-body div[class*="border-l-2"] {
          position: relative;
          background: color-mix(in srgb, var(--section-color) 9%, transparent);
          border-radius: 0 8px 8px 0;
          padding: 8px 12px 8px 34px;
        }
        .docs-body div[class*="border-l-2"]::before {
          content: '\\24D8';
          position: absolute;
          left: 11px;
          top: 8px;
          font-size: 14px;
          color: var(--section-color);
        }
        .docs-body div.grid {
          background: rgb(255 255 255 / 0.02);
          border: 1px solid var(--outline-variant, #3a3a44);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .docs-body table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--outline-variant, #3a3a44);
          border-radius: 8px;
          overflow: hidden;
          font-size: 13px;
        }
        .docs-body table th {
          background: color-mix(in srgb, var(--section-color) 16%, transparent);
          padding: 6px 10px;
          text-align: left;
        }
        .docs-body table td {
          padding: 6px 10px;
          border-top: 1px solid var(--outline-variant, #3a3a44);
        }
        .docs-body table tbody tr:nth-child(even) {
          background: rgb(255 255 255 / 0.025);
        }
      `}</style>
        <nav
          aria-label="Categorías de documentación"
          className="w-full md:w-72 shrink-0 border border-outline-variant bg-surface-container flex flex-col"
        >
          <div className="px-4 py-4 border-b border-outline-variant">
            <span className="block text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
              Categorías
            </span>
          </div>
          <div className="flex-1 overflow-auto docs-scroll" style={{ padding: '4px 0' }}>
            {MODULOS.map((mod) => {
              const on = modsOpen[mod.label] ?? true;
              return (
                <div key={mod.label}>
                  {/* Acordeón de módulo (orig. usuario: doc agrupada por módulo, sin contadores) */}
                  <button
                    type="button"
                    onClick={() =>
                      setModsOpen((p) => ({ ...p, [mod.label]: !(p[mod.label] ?? true) }))
                    }
                    aria-expanded={on}
                    className="w-full flex items-center gap-2 px-4 pt-3 pb-1.5 text-left transition-colors hover:bg-surface-container-low"
                  >
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-base transition-transform duration-200 text-on-surface-variant"
                      style={{ transform: on ? 'rotate(90deg)' : 'none' }}
                    >
                      chevron_right
                    </span>
                    <span
                      className="text-[12px] font-bold tracking-widest uppercase"
                      style={{ color: mod.label === 'Civil Flow' ? '#4D8FF7' : '#A78BFA' }}
                    >
                      {mod.label}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant/60">
                      {mod.nota}
                    </span>
                  </button>
                  {on && (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {mod.cats.map((cid) => {
                        const cat = categories.find((c) => c.id === cid);
                        if (!cat) return null;
                        const sel = activeCat === cid;
                        return (
                          <li key={cid}>
                            <button
                              type="button"
                              onClick={() => selectCat(cid)}
                              className={`w-full flex items-center gap-3 pl-8 pr-3 py-2.5 text-left transition-colors ${
                                sel
                                  ? 'bg-surface-container-high text-on-surface'
                                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                              }`}
                              style={{
                                borderLeft: `3px solid ${sel ? cat.color : 'transparent'}`,
                              }}
                            >
                              <span
                                className="material-symbols-outlined text-[19px] rounded-md"
                                style={{
                                  color: sel ? cat.color : undefined,
                                  background: sel ? `${cat.color}1c` : 'transparent',
                                  padding: 3,
                                }}
                              >
                                {cat.icon}
                              </span>
                              <span className="text-[13px] font-medium leading-tight">
                                {cat.name}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 flex flex-col min-w-0">
          {/* Encabezado de categoría: hero con color — tile grande + gradiente + sombra. */}
          <div
            className="mb-4 rounded-xl border border-outline-variant px-5 py-4"
            style={{
              background: `radial-gradient(420px 120px at 12% 0%, ${heroColor}26, transparent 70%), linear-gradient(135deg, ${heroColor}14, transparent 55%), var(--surface-container)`,
              boxShadow: '0 4px 18px rgb(0 0 0 / 0.25)',
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className="material-symbols-outlined rounded-xl"
                style={{
                  fontSize: 34,
                  color: heroColor,
                  background: `${heroColor}26`,
                  padding: 12,
                  border: `1px solid ${heroColor}44`,
                }}
              >
                {enBusqueda ? 'search' : activeCategory?.icon}
              </span>
              <div className="flex-1 min-w-[200px]">
                <h1 className="text-headline-sm font-bold text-on-surface leading-tight">
                  {enBusqueda ? 'Resultados de búsqueda' : activeCategory?.name}
                </h1>
                <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">
                  {enBusqueda
                    ? `${filteredSections.length} coincidencia(s) en todas las categorías`
                    : activeCategory?.desc}
                </p>
              </div>
              <div className="w-full md:w-72">
                <div className="flex items-center border border-outline-variant bg-surface-container px-3 rounded-md">
                  <span className="material-symbols-outlined text-on-surface-variant text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar en toda la documentación..."
                    aria-label="Buscar documentación"
                    className="flex-1 h-10 px-3 bg-transparent text-on-surface text-[13px] font-mono focus:outline-none"
                  />
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpiar búsqueda"
                      className="text-on-surface-variant hover:text-on-surface"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-base">
                        close
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-0.5">
                {search.trim()
                  ? `${filteredSections.length} coincidencias en todas las categorías`
                  : `${filteredSections.length} secciones · categoría ${activeCategory?.id}`}
              </span>
              <button
                type="button"
                onClick={() => setAllOpen(true)}
                className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 border border-outline-variant rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
              >
                expandir todo
              </button>
              <button
                type="button"
                onClick={() => setOpenSections({})}
                className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 border border-outline-variant rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
              >
                colapsar todo
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-2 pr-1 docs-scroll">
            {filteredSections.map((section) => {
              const sectionKey = `${section.categoryId}:${section.title}`;
              return (
                <div key={sectionKey}>
                  <SectionAccordion
                    section={section}
                    sectionKey={sectionKey}
                    contentId={domId(sectionKey)}
                    isOpen={openSections[sectionKey] ?? false}
                    onToggle={toggleSection}
                    showCategory={search.trim() !== ''}
                    query={search}
                  />
                </div>
              );
            })}
            {filteredSections.length === 0 && (
              <div className="text-center text-on-surface-variant text-[13px] py-12">
                No se encontraron resultados
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DocsPage;
