import { useEffect, useRef, useState } from 'react';
import Navbar from '../../../components/Navbar.tsx';
import { docData } from './docs/data';
import { practicalGuides, type DocCategory } from './docs/data/practicalGuides.ts';
import SectionAccordion from './docs/SectionAccordion.tsx';
import { usePageMeta } from '../../../hooks/usePageMeta.ts';
import { metaDeRuta } from '../../../seo/routeMeta.ts';
import { sinAcentos } from '../constants/helpers.ts';

/** Saca el texto plano de un bloque de la doc para poder buscarlo: baja por los hijos de
 *  cada pieza de React y junta solo letras y números (sin clases ni etiquetas). */
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
const domId = (key: string): string => sinAcentos(key.toLowerCase()).replace(/[^a-z0-9]+/g, '-');

/** Agrupación de categorías por módulo (pedido del cliente: la doc se navega por módulo).
 *  Las claves SON las de docData (data/index.ts) — aunque el archivo fuente se llame
 *  hydraulics.tsx etc., la clave exportada sigue en español. */
const MODULOS: { label: string; nota: string; cats: string[] }[] = [
  {
    label: 'Civil Flow',
    nota: 'Diseño hidrosanitario',
    cats: [
      'manual',
      'hidraulica',
      'sanitarias',
      'lluvias',
      'agua_fria',
      'agua_caliente',
      'gas',
      'rci',
      'equipos',
      'normas_pais',
      'tablas',
      'formulas',
    ],
  },
  {
    label: 'Civil Manager',
    nota: 'Costos y presupuestos',
    cats: ['manager'],
  },
];

const categories = (Object.entries(docData) as [DocCategory, (typeof docData)[DocCategory]][]).map(
  ([id, data]) => {
    const guide = practicalGuides[id];
    const practical = {
      title: 'En la práctica',
      body: (
        <div className="docs-practical">
          <header className="docs-practical-intro">
            <span className="material-symbols-outlined docs-practical-icon" aria-hidden="true">
              tips_and_updates
            </span>
            <div>
              <p className="docs-practical-eyebrow">Guía de aplicación</p>
              <p className="docs-practical-case">{guide.caso}</p>
            </div>
          </header>
          <div className="docs-practical-layout">
            <div className="docs-practical-grid">
              <article className="docs-practical-card">
                <span className="docs-practical-step">PREPARA</span>
                <h3>Antes de empezar</h3>
                <p>{guide.prepara}</p>
              </article>
              <article className="docs-practical-card">
                <span className="docs-practical-step">COMPRUEBA</span>
                <h3>Lectura del resultado</h3>
                <p>{guide.revisa}</p>
              </article>
              <article className="docs-practical-card">
                <span className="docs-practical-step">EVITA</span>
                <h3>Punto de atención</h3>
                <p>{guide.evita}</p>
              </article>
              <article className="docs-practical-card">
                <span className="docs-practical-step">AL TERMINAR</span>
                <h3>Resultado esperado</h3>
                <p>{guide.resultado}</p>
              </article>
            </div>
            <article className="docs-practical-flow">
              <div className="docs-practical-flow-heading">
                <span className="material-symbols-outlined" aria-hidden="true">
                  route
                </span>
                <div>
                  <span className="docs-practical-step">RECORRIDO RECOMENDADO</span>
                  <h3>Flujo sugerido</h3>
                </div>
              </div>
              <ol>
                {guide.pasos.map((paso, index) => (
                  <li key={paso}>
                    <span aria-hidden="true">{index + 1}</span>
                    {paso}
                  </li>
                ))}
              </ol>
            </article>
          </div>
          <footer className="docs-practical-footer">
            <span className="material-symbols-outlined" aria-hidden="true">
              conversion_path
            </span>
            <span>Continúa con</span>
            <a href={`#${guide.relacionada}`}>
              {docData[guide.relacionada].name}
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_forward
              </span>
            </a>
          </footer>
        </div>
      ),
    };
    const sections = [...data.sections, practical].map((section) => ({
      ...section,
      categoryColor: data.color,
      categoryName: data.name,
      categoryId: id,
    }));
    return { id, ...data, sections };
  },
);
const searchableText = new Map<string, string>(
  categories.flatMap((category) =>
    category.sections.map(
      (s) => [`${s.categoryId}:${s.title}`, nodeText(s.body).toLowerCase()] as const,
    ),
  ),
);

function categoryFromHash(): DocCategory {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return categories.find((category) => category.id === hash)?.id ?? 'hidraulica';
}

/** Documentación por módulo, con búsqueda en la categoría activa. Ej.: /docs#gas abre la red de gas. */
function DocsPage() {
  const [activeCat, setActiveCat] = useState(categoryFromHash);
  const categoryHeading = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // Acordeones por módulo del panel izquierdo (orig. usuario), ambos abiertos por defecto.
  const [modsOpen, setModsOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULOS.map((m) => [m.label, true])),
  );
  usePageMeta(metaDeRuta('/docs')?.title, metaDeRuta('/docs')?.description);

  const activeCategory = categories.find((c) => c.id === activeCat);
  useEffect(() => {
    let frame = 0;
    const syncHash = () => {
      setActiveCat(categoryFromHash());
      setOpenSections({});
      setSearch('');
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => categoryHeading.current?.focus());
    };
    window.addEventListener('hashchange', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const filteredSections =
    search.trim() === ''
      ? activeCategory?.sections || []
      : // Buscador SOLO dentro de la categoría activa (ped. usuario): no cruza módulos.
        (activeCategory?.sections || []).filter((s) => {
          const key = `${s.categoryId}:${s.title}`;
          return (
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            searchableText.get(key)?.includes(search.toLowerCase())
          );
        });

  // En búsqueda el listado queda dentro de la categoría activa: el hero sigue representándola.

  const selectCat = (id: DocCategory) => {
    setActiveCat(id);
    setSearch('');
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
      <Navbar />
      <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-64px)] pt-16 overflow-y-auto md:overflow-hidden">
        <nav
          aria-label="Categorías de documentación"
          className="w-full md:w-72 shrink-0 border border-outline-variant bg-surface-container flex flex-col"
        >
          <div className="px-4 py-4 border-b border-outline-variant">
            <span className="block text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
              Categorías
            </span>
          </div>
          <div className="docs-nav-scroll flex-1 overflow-auto docs-scroll">
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
                      data-open={on ? 'true' : 'false'}
                      className="docs-mod-chevron material-symbols-outlined text-base! text-on-surface-variant"
                    >
                      chevron_right
                    </span>
                    <span
                      data-cat={mod.label === 'Civil Flow' ? 'manual' : 'manager'}
                      className="docs-mod-label text-[12px] font-bold tracking-widest uppercase"
                    >
                      {mod.label}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant/60">
                      {mod.nota}
                    </span>
                  </button>
                  {on && (
                    <ul className="docs-list">
                      {mod.cats.map((cid) => {
                        const cat = categories.find((c) => c.id === cid);
                        if (!cat) return null;
                        const sel = activeCat === cid;
                        return (
                          <li key={cid}>
                            <button
                              type="button"
                              onClick={() => selectCat(cat.id)}
                              data-cat={cid}
                              data-selected={sel ? 'true' : 'false'}
                              className={`docs-cat-btn w-full flex items-center gap-3 pl-8 pr-3 py-2.5 text-left transition-colors ${
                                sel
                                  ? 'bg-surface-container-high text-on-surface'
                                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                              }`}
                            >
                              <span
                                data-selected={sel ? 'true' : 'false'}
                                className="docs-cat-icon material-symbols-outlined text-[19px]! rounded-md"
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
            data-cat={activeCategory?.id}
            className="docs-hero mb-4 rounded-xl border border-outline-variant px-5 py-4"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span className="docs-hero-icon material-symbols-outlined rounded-xl">
                {activeCategory?.icon}
              </span>
              <div className="flex-1 min-w-[200px]">
                <h1
                  ref={categoryHeading}
                  tabIndex={-1}
                  className="text-headline-sm font-bold text-on-surface leading-tight"
                >
                  {activeCategory?.name}
                </h1>
                <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">
                  {activeCategory?.desc}
                </p>
              </div>
              <div className="w-full md:w-72">
                <div className="flex items-center border border-outline-variant bg-surface-container px-3 rounded-md">
                  <span className="material-symbols-outlined text-on-surface-variant text-lg!">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar en esta categoría..."
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
                      <span aria-hidden="true" className="material-symbols-outlined text-base!">
                        close
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-0.5">
                {`${filteredSections.length} secciones · categoría ${activeCategory?.id}`}
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
