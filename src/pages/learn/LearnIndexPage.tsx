import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { metaDeRuta, ROUTE_META, type ArticuloMeta, type RouteMeta } from '../../seo/routeMeta.ts';

/** Fecha ISO (YYYY-MM-DD) a texto legible en español con mes largo. Ej: '2026-11-11' -> '11 de noviembre de 2026'.
 *  El 'T00:00:00' fuerza medianoche LOCAL: sin él, JS lee la fecha como UTC y en Colombia (UTC-5) muestra el día anterior. */
function fechaLegible(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

/** Índice de la sección Aprende (/aprende): lista los artículos técnicos leyéndolos de ROUTE_META
 *  (entradas con `articulo`), así un artículo nuevo entra al índice solo con registrarlo allá —
 *  aquí no hay lista a mano. Mismo cascarón visual que ArticlePage (superficies oscuras, Navbar,
 *  contenedor max-w-3xl); el JSON-LD lo inyecta el prerender, aquí no se duplica. */
export default function LearnIndexPage() {
  usePageMeta(metaDeRuta('/aprende')?.title, metaDeRuta('/aprende')?.description);
  const articulos = ROUTE_META.filter(
    (m): m is RouteMeta & { articulo: ArticuloMeta } => m.articulo !== undefined,
  );
  return (
    <div className="landing-root min-h-screen bg-surface-bg text-on-surface flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto w-full min-w-0 px-4 py-10">
          <header>
            <p className="text-[11px] font-mono uppercase tracking-widest text-on-surface-variant mb-3">
              Aprende · Ingeniería hidrosanitaria
            </p>
            <h1 className="text-headline-sm font-bold text-on-surface leading-tight">Aprende</h1>
            <p className="text-[14px] text-on-surface-variant mt-3 leading-relaxed">
              Artículos técnicos sobre diseño hidrosanitario a la colombiana: NTC 1500 (Norma
              Técnica Colombiana de instalaciones hidráulicas en edificaciones), RAS 2000
              (Reglamento Técnico del Sector de Agua Potable y Saneamiento Básico) y el método
              Hunter (probabilidad de uso simultáneo), con ejemplos numéricos paso a paso. Cada
              artículo va del concepto al cálculo, listo para aplicar en un proyecto real.
            </p>
          </header>

          <ul className="mt-8 space-y-4">
            {articulos.map((m) => (
              <li key={m.path}>
                <article className="border border-outline-variant rounded-lg p-5 transition-colors hover:border-on-surface-variant">
                  <h2 className="text-[17px] font-bold leading-snug">
                    <Link
                      to={m.path}
                      className="text-on-surface hover:text-primary transition-colors"
                    >
                      {m.title}
                    </Link>
                  </h2>
                  <p className="text-[13.5px] text-on-surface-variant mt-2 leading-relaxed">
                    {m.articulo.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-[12px] text-on-surface-variant">
                    <span aria-hidden="true" className="material-symbols-outlined text-base!">
                      calendar_today
                    </span>
                    <time dateTime={m.articulo.fechaPublicacion}>
                      {fechaLegible(m.articulo.fechaPublicacion)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{m.articulo.autor}</span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
