import { useRef } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { aparatoEnExtremoInvalido } from '../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { diamPulgFromLabel } from '../../utils/diamInchesFromLabel.ts';

interface UseViewerDirtySweepRes {
  /** Barre el motor buscando aparatos en extremo inviables (alerta 1× por ramal) y sube el
   *  diámetro de bajantes/montantes por debajo de su ramal conectado. Silencio durante la
   *  ventana de supresión. */
  barreAparatos: (eng: PlanoEngine) => void;
  /** Abre la ventana anti-alerta por un borrado y limpia el dedupe de los ids (el renumerado
   *  reutiliza ids y no debe heredar la supresión del ramal borrado). */
  suprimirPorBorrado: (ids: string[]) => void;
}

/** Sweep del onDirty del visor: alertas de aparato inviable + auto-bump de diámetros.
 *  Extraído verbatim de PdfViewer — las 2 refs de dedupe/supresión viven aquí. */
export function useViewerDirtySweep(): UseViewerDirtySweepRes {
  // Ítem 2 (rev 2): dedupe de la alerta de estado inviable — el ramal se alerta UNA vez por
  // sesión mientras siga inválido (se rehabilita al corregirse).
  const aparatoFlowAlertedRef = useRef<Set<string>>(new Set());
  // Orig. usuario: al BORRAR un ramal no debe salir la alerta — los estados intermedios
  // del borrado (splits a medio re-unir, renumerado) disparaban el sweep. Ventana de
  // supresión + limpieza del dedupe para los ids borrados (el renumerado los reutiliza).
  const suprimirAparatoSweepHastaRef = useRef(0);

  const barreAparatos = (eng: PlanoEngine): void => {
    if (Date.now() >= suprimirAparatoSweepHastaRef.current) {
      for (const r of eng.ramales) {
        if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes, r, eng.nivelActual?.label)) {
          if (!aparatoFlowAlertedRef.current.has(r.id)) {
            aparatoFlowAlertedRef.current.add(r.id);
            eng.triggerAlert(
              'Aparato no permitido',
              `El ramal ${r.label || r.id} tiene un aparato en un extremo inválido: está conectado a la red (T/Y/bajante) o el flujo va en su contra. El aparato solo va en el extremo libre hacia el que apunta el flujo. Quita el aparato, invierte la dirección del ramal o muévelo al extremo correcto.`,
            );
          }
        } else {
          aparatoFlowAlertedRef.current.delete(r.id);
        }
      }
      // Diámetro de bajante/montante por debajo del ramal conectado (orig. usuario): NO
      // alerta — se SUBE solo al mayor ramal conectado. El cambio manual del montante por
      // debajo sí bloquea con alerta (pushBajanteDiameterToRamales); esto cura estados
      // residuales que escaparon por cualquier vía.
      for (const b of eng.bajantes) {
        if ((b.tipo !== 'bajante' && b.tipo !== 'montante') || b.isFantasma) continue;
        const bIn = b.dNominal ? diamPulgFromLabel(String(b.dNominal).replace(/-/g, ' ')) : 0;
        if (!(bIn > 0)) continue;
        const ids = new Set([...(b.recibeDeIds || []), ...(b.alimentaIds || [])]);
        let topDiam = 0;
        let topLabel = '';
        for (const r of eng.ramales) {
          if (r.net !== b.net) continue;
          const rIn = r.diametro ? diamPulgFromLabel(String(r.diametro).replace(/-/g, ' ')) : 0;
          if (!(rIn > bIn)) continue;
          const conectado =
            ids.has(r.id) ||
            (r.pts != null &&
              r.pts.length >= 2 &&
              (Math.hypot(r.pts[0][0] - b.x, r.pts[0][1] - b.y) < 2.0 ||
                Math.hypot(r.pts[r.pts.length - 1][0] - b.x, r.pts[r.pts.length - 1][1] - b.y) <
                  2.0));
          if (conectado && rIn > topDiam) {
            topDiam = rIn;
            topLabel = r.diametro || '';
          }
        }
        if (topLabel) b.dNominal = topLabel;
      }
    }
  };

  const suprimirPorBorrado = (ids: string[]): void => {
    suprimirAparatoSweepHastaRef.current = Date.now() + 2000;
    for (const id of ids) aparatoFlowAlertedRef.current.delete(id);
  };

  return { barreAparatos, suprimirPorBorrado };
}
