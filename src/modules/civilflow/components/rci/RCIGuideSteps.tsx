/** Contenido de los 9 pasos de la Guía de diseño RCI (los bodies del GUIDE del HTML de
 *  referencia, portados literales): textos, tablas de criterios y de tipologías, franjas de
 *  estado con los chips de las verificaciones y los esquemas SVG del proyecto. El shell
 *  (nav + botones) vive en RciGuiaModal; este archivo solo dibuja el paso activo.
 *  Ej: <PasoGuia paso={0} ctx={ctx} irGo={(go) => irGo(go)} /> pinta "Clasifique el riesgo".
 *  Los pasos viven en guideSteps/ (uno o dos por archivo, con sus estilos en guideSteps/shared);
 *  aquí queda el despacho del paso activo y el chk() de verificaciones que varios pasos usan. */
import { useMemo } from 'react';
import type { RciCtx } from './RCIUI.tsx';
import type { Verificacion } from '../../lib/rci/types.ts';
import { PREFIJOS_CHK, type PrefijoChk } from './guideSteps/shared.ts';
import { PasoRiesgo } from './guideSteps/stepRisk.tsx';
import { PasoRociadores, PasoRamales } from './guideSteps/stepTracing.tsx';
import { PasoAreaDiseno, PasoRutaCritica } from './guideSteps/stepDesignArea.tsx';
import { PasoTipologias } from './guideSteps/stepTypologies.tsx';
import { PasoListo } from './guideSteps/stepReady.tsx';
import { PasoDibujo, PasoRevision } from './guideSteps/stepDrawing.tsx';

export type { PrefijoChk };

/** El paso activo de la guía: textos del HTML con los datos vivos del proyecto. */
export function PasoGuia({
  paso,
  ctx,
  irGo,
}: {
  paso: number;
  ctx: RciCtx;
  irGo: (go: string[]) => void;
}) {
  const { R } = ctx;
  /** chk(lab) del HTML replicado con Map construido UNA vez (primera verificación cuyo label
   *  empieza con el prefijo): sin búsquedas en bucles (G8). */
  const chkMap = useMemo(() => {
    const m = new Map<PrefijoChk, Verificacion>();
    for (const c of R.checks) {
      for (const p of PREFIJOS_CHK) {
        if (!m.has(p) && c.lab.startsWith(p)) m.set(p, c);
      }
    }
    return m;
  }, [R.checks]);
  const chk = (p: PrefijoChk): string => chkMap.get(p)?.st ?? 'PENDIENTE';

  switch (paso) {
    /* 1 · Clasifique el riesgo */
    case 0:
      return <PasoRiesgo ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 2 · Distribuye los rociadores */
    case 1:
      return <PasoRociadores ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 3 · Organice ramales y tramos */
    case 2:
      return <PasoRamales ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 4 · Ubique el área de diseño */
    case 3:
      return <PasoAreaDiseno ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 5 · Numera la ruta crítica */
    case 4:
      return <PasoRutaCritica ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 6 · Clasifique los pisos */
    case 5:
      return <PasoTipologias ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 7 · ¿Listo para dibujar? */
    case 6:
      return <PasoListo ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 8 · Captura la red en el plano */
    case 7:
      return <PasoDibujo ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
    /* 9 · Revisa el cálculo y las verificaciones */
    default:
      return <PasoRevision ctx={ctx} irGo={irGo} chk={chk} chkMap={chkMap} />;
  }
}
