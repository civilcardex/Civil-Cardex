import { useEffect } from 'react';

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Civil Core` : 'Civil Core';
    
    let prevDescription: string | null = null;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        prevDescription = meta.getAttribute('content');
        meta.setAttribute('content', description);
      }
    }
    
    const link = document.querySelector('link[rel="canonical"]');
    const prevHref = link?.getAttribute('href');
    if (link) {
      link.setAttribute('href', window.location.href.split('?')[0].split('#')[0]);
    }
    
    return () => {
      document.title = prevTitle;
      if (prevDescription !== null) {
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', prevDescription);
      }
      if (prevHref && link) link.setAttribute('href', prevHref);
    };
  }, [title, description]);
}
