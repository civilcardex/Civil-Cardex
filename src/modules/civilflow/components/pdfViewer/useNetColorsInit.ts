// Restauración de los colores por red (personalizados por el usuario) al montar el visor:
// primero el override guardado en localStorage (sincronizado a NETS[].col y a la variable CSS
// --<netId>), luego la fuente de verdad en la BD (perfiles.net_colors), que gana sobre el
// restore local porque puede resolver después del mount.
import { useEffect } from 'react';
import { NETS } from '../../lib/PlanoEngine/PlanoState';
import { NET_COLOR_PREFIX } from '../../constants/storage-keys';
import { loadNetColors, applyNetColors } from '../../services/netColorsService';

/** Restaura al montar los colores personalizados por red: primero el override de localStorage
 *  y después la BD (perfiles.net_colors), que gana por resolver después. */
export function useNetColorsInit(): void {
  useEffect(() => {
    for (const net of NETS) {
      try {
        const raw = localStorage.getItem(NET_COLOR_PREFIX + net.id);
        if (raw) {
          const c = (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          })();
          if (typeof c === 'string') {
            document.documentElement.style.setProperty('--' + net.id, c);
            net.col = c;
          }
        } else {
          // Sin override guardado — sincronizar el default de la variable CSS a NETS[].col para
          // que lluvias (cyan #22d3ee por defecto en CSS) no se dibuje con el morado #8B5CF6 fijo
          // en PlanoState.ts.
          const cssVal = getComputedStyle(document.documentElement)
            .getPropertyValue('--' + net.id)
            .trim();
          if (cssVal) net.col = cssVal;
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadNetColors().then((colors) => {
      if (!cancelled) applyNetColors(colors);
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
