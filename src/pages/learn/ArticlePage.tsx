import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { metaDeRuta, ROUTE_META } from '../../seo/routeMeta.ts';

/** Una sección del artículo: título en <h2> y cuerpo libre (párrafos, tablas, fórmulas). */
export interface ArticleSection {
  titulo: string;
  cuerpo: ReactNode;
}

/** Datos que una instancia de artículo le pasa al cascarón. Ej: { path: '/aprende/hunter-ntc-1500', titulo: '…', secciones: [...] }. */
export interface ArticleData {
  /** Ruta registrada en ROUTE_META: de ahí salen el title/description del cliente. Ej: '/aprende/hunter-ntc-1500'. */
  path: string;
  /** Título único del artículo (el <h1>). Ej: 'Método Hunter en la NTC 1500'. */
  titulo: string;
  /** Bajada: una frase de contexto bajo el título. Ej: 'Por qué el caudal de diseño no es la suma de los caudales de cada aparato.'. */
  bajada: string;
  /** Fecha legible de publicación. Ej: '11 de noviembre de 2026'. */
  fecha: string;
  /** Autor legible (el mismo de ROUTE_META.articulo.autor). Ej: 'Equipo CivilCardex'. */
  autor: string;
  /** Secciones del artículo, en orden de lectura. */
  secciones: ArticleSection[];
  /** Cierre del artículo (CTA hacia la app). */
  cierre: ReactNode;
}

/** Página de artículo técnico (/aprende/<slug>): cascarón reutilizable con el lenguaje visual de
 *  /docs (superficies oscuras, Navbar, tipografía de la app). El <article> lleva un único <h1>
 *  y un <h2> por sección; las metas salen de ROUTE_META y el JSON-LD Article lo inyecta el
 *  prerender (scripts/prerender.mjs) — aquí no se duplica. */
export default function ArticlePage({ data }: { data: ArticleData }) {
  usePageMeta(metaDeRuta(data.path)?.title, metaDeRuta(data.path)?.description);
  return (
    <div className="landing-root min-h-screen bg-surface-bg text-on-surface flex flex-col">
      <Navbar />
      {/* Prosa del artículo: mismo des-aviejecido que .docs-body en /docs, pero sin heredar
          sus selectores (los data files de /docs son de otro módulo). */}
      <main className="flex-1 pt-16">
        <article className="max-w-3xl mx-auto w-full min-w-0 px-4 py-10">
          <header>
            <p className="text-[11px] font-mono uppercase tracking-widest text-on-surface-variant mb-3">
              Aprende · Ingeniería hidrosanitaria
            </p>
            <h1 className="text-headline-sm font-bold text-on-surface leading-tight">
              {data.titulo}
            </h1>
            <p className="text-[14px] text-on-surface-variant mt-3 leading-relaxed">
              {data.bajada}
            </p>
            <div className="flex items-center gap-2 mt-4 text-[12px] text-on-surface-variant">
              <span aria-hidden="true" className="material-symbols-outlined text-base!">
                calendar_today
              </span>
              <time
                dateTime={ROUTE_META.find((m) => m.path === data.path)?.articulo?.fechaPublicacion}
              >
                {data.fecha}
              </time>
              <span aria-hidden="true">·</span>
              <span>{data.autor}</span>
            </div>
          </header>

          {data.secciones.map((s) => (
            <section key={s.titulo} className="mt-8">
              <h2 className="text-[18px] font-bold text-on-surface leading-snug mb-1">
                {s.titulo}
              </h2>
              <div className="article-body">{s.cuerpo}</div>
            </section>
          ))}

          <section className="mt-10">
            <div className="article-body">{data.cierre}</div>
          </section>

          <div className="mt-12 pt-6 border-t border-outline-variant flex flex-wrap gap-3 text-[13px]">
            <Link
              to="/docs"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              ← Toda la documentación técnica
            </Link>
            <Link to="/pricing" className="text-primary hover:underline">
              Ver planes de CivilCardex
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
