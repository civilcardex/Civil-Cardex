import { useEffect } from 'react';

function setMeta(prop: string, name: string, content: string, prev: Record<string, string | null>) {
  const sel = prop === 'property' ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(prop, name);
    document.head.appendChild(el);
  }
  prev[sel] = el.getAttribute('content');
  el.setAttribute('content', content);
}

export function usePageMeta(title: string, description?: string, noindex?: boolean) {
  useEffect(() => {
    const prev: Record<string, string | null> = {};
    const fullTitle = title ? `${title} | Civil Cardex` : 'Civil Cardex';

    const prevTitle = document.title;
    document.title = fullTitle;
    setMeta('property', 'og:title', fullTitle, prev);
    setMeta('name', 'twitter:title', fullTitle, prev);

    if (description) {
      setMeta('name', 'description', description, prev);
      setMeta('property', 'og:description', description, prev);
      setMeta('name', 'twitter:description', description, prev);
    }

    if (noindex) {
      setMeta('name', 'robots', 'noindex, nofollow', prev);
    }

    // sin query ni fragment: en /restablecer el hash contiene tokens de recovery
    const url = window.location.href.split(/[?#]/)[0];
    setMeta('property', 'og:url', url, prev);

    const canonical = window.location.origin + window.location.pathname;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    const prevHref = link.getAttribute('href');
    link.setAttribute('href', canonical);

    return () => {
      document.title = prevTitle;
      for (const [sel, val] of Object.entries(prev)) {
        const el = document.querySelector(sel);
        if (!el) continue;
        if (val === null)
          el.remove(); // el meta lo creó este mount: no debe sobrevivirlo
        else el.setAttribute('content', val);
      }
      if (prevHref && link) link.setAttribute('href', prevHref);
    };
  }, [title, description, noindex]);
}
