import { useEffect } from 'react';

function setMeta(prop: string, name: string, content: string, prev: Record<string, string | null>) {
  const sel = prop === 'property' ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(prop, name);
    document.head.appendChild(el);
  }
  prev[name] = el.getAttribute('content');
  el.setAttribute('content', content);
}

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const prev: Record<string, string | null> = {};
    const fullTitle = title ? `${title} | Civil Core` : 'Civil Core';
    
    const prevTitle = document.title;
    document.title = fullTitle;
    setMeta('property', 'og:title', fullTitle, prev);
    
    if (description) {
      setMeta('name', 'description', description, prev);
      setMeta('property', 'og:description', description, prev);
    }
    
    const url = window.location.href.split('?')[0];
    setMeta('property', 'og:url', url, prev);
    
    const link = document.querySelector('link[rel="canonical"]');
    const prevHref = link?.getAttribute('href');
    if (link) link.setAttribute('href', url);
    
    return () => {
      document.title = prevTitle;
      for (const [name, val] of Object.entries(prev)) {
        if (val === null) continue;
        const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
        if (el) el.setAttribute('content', val);
      }
      if (prevHref && link) link.setAttribute('href', prevHref);
    };
  }, [title, description]);
}
