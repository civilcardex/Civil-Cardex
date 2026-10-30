import { NETS } from '../../../../lib/PlanoEngine/PlanoState.ts';
import { project, ISO_SCALE, type IsoRamal, type IsoBajante } from '../geometry';
import { hexA, type IsoPt } from '../isoDrawUtils.ts';
import type { VistaIso } from './isoView.ts';

/** Pase 2 de la isometría: dibuja TODOS los canales (de ll, Lluvias, y de cualquier otra red)
 * en una pasada propia ANTES de las redes — la cara blanca opaca de la canaleta taparía cualquier
 * bajante/ramal pintado después, así que ir primero deja las tuberías que caen dentro visibles.
 * Ej: un bajante de af (Agua Fría) dentro de un canal de lluvia se dibuja ENCIMA del canal. */
export function pintaCanales(args: {
  ctx: CanvasRenderingContext2D;
  dataByNet: Record<string, { ramales: IsoRamal[]; bajantes: IsoBajante[] }>;
  activeNets: Set<string>;
  profByNet: Record<string, number>;
  nptMap: Record<number, number>;
  selTramo: string | null;
  vista: VistaIso;
  getIsoCoords: (px: number, py: number, nivel: number) => { x: number; y: number };
  getZPix: (zMm: number, nivel?: number) => number;
}): void {
  const { ctx, dataByNet, activeNets, profByNet, nptMap, selTramo, vista, getIsoCoords, getZPix } =
    args;
  const { rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy } = vista;
  // Los canales se dibujan PRIMERO, en un pase propio ANTES de todas las redes: la cara blanca
  // opaca de la canaleta taparía cualquier bajante dibujado después del pase de su red
  // (ac/af/gas van antes que ll en el orden alfabético de redes, y un bajante de esas redes
  // puede quedar dentro del canal). Así, cualquier bajante/ramal que caiga dentro del canal se
  // dibuja encima — igual que en el plano, donde el rectángulo del canal es el fondo.
  const projPtCanal = (px: number, py: number, pz: number) =>
    project(px, py, pz, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
  for (const [netId, netData] of Object.entries(dataByNet)) {
    if (!activeNets.has(netId)) continue;
    const netColorCanal = NETS.find((n) => n.id === netId)?.col || '#888';
    const profCanal = profByNet[netId] ?? 0;
    for (const b of netData.bajantes) {
      if (b._isCrossFloorGhost || b.tipo !== 'canal') continue;
      // Marco efectivo en METROS (misma regla que canalMarco del motor, sin engine): con
      // `angulo` se respeta; sin él (legacy) el flowDir manda y sin flowDir la forma
      // (base>longitud→90°). Los shifts de origen van en metros (getIsoCoords es lineal).
      let baseM = (b.base || 0) / 100;
      let longM = (b.longitud || 0) / 100;
      const altM = (b.altura || 0) / 100;
      if (longM <= 0.001 || baseM <= 0.001 || altM <= 0.001) continue;
      let angC = 0;
      let shU = 0;
      let shV = 0;
      if (b.angulo != null) {
        angC = (b.angulo * Math.PI) / 180;
      } else {
        const dir = (b as { _canalFlowDir?: string })._canalFlowDir;
        if (dir === 'izquierda') {
          angC = Math.PI;
          shU = longM;
          shV = baseM;
        } else if (dir === 'arriba') {
          angC = -Math.PI / 2;
          shV = baseM;
          const t = longM;
          longM = baseM;
          baseM = t;
        } else if (dir === 'abajo' || baseM > longM) {
          angC = Math.PI / 2;
          shU = longM;
          const t = longM;
          longM = baseM;
          baseM = t;
        }
      }
      const selKey = `${netId}:${b.planId}:${b.id}`;
      const isSel = selKey === selTramo;
      const hl = isSel ? '#FFEB3B' : netColorCanal;
      const zC = (nptMap[b.planNivel] || 0) - profCanal * 1000;
      const zPixC = getZPix(zC, b.planNivel);
      const iso0raw = getIsoCoords(b.x, b.y, b.planNivel);
      const iso0 = { x: iso0raw.x + shU * ISO_SCALE, y: iso0raw.y + shV * ISO_SCALE };
      // Ejes del canal en espacio iso (unitarios): U = eje largo, V = base. Con ángulo 0
      // son (1,0)/(0,1) — idéntico al código anterior.
      const ux = Math.cos(angC);
      const uy = Math.sin(angC);
      const P = (suM: number, tvM: number, pz: number) =>
        projPtCanal(
          iso0.x + (ux * suM - uy * tvM) * ISO_SCALE,
          iso0.y + (uy * suM + ux * tvM) * ISO_SCALE,
          pz,
        );
      // Esquinas superiores del rectángulo de abertura (símbolo en planta)
      const pA = P(0, 0, zPixC);
      const pB = P(longM, 0, zPixC);
      const pC = P(longM, baseM, zPixC);
      const pD = P(0, baseM, zPixC);
      // Altura de pared (editable)
      const wall = altM;
      const bottomZ = zPixC + wall * ISO_SCALE;
      // Vértices del corte escalonado (muesca en el extremo izquierdo, sobre la pared trasera)
      // La muesca rebaja el borde superior de la pared trasera (lateral del canal) en el
      // extremo izquierdo: ocupa el 30% del ancho de la base y baja al 50% de la altura de
      // pared. Crea una cara escalonada vertical en ángulo recto visible desde el lateral.
      const notchH = wall * 0.25 * ISO_SCALE; // profundidad de la muesca EXTERIOR (somera, 25%)
      const notchZ = zPixC + notchH; // nivel del escalón
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = hl;
      ctx.lineWidth = 1.2;
      const quad = (a: IsoPt, b2: IsoPt, c2: IsoPt, d2: IsoPt) => {
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b2.sx, b2.sy);
        ctx.lineTo(c2.sx, c2.sy);
        ctx.lineTo(d2.sx, d2.sy);
        ctx.closePath();
      };
      // Perfil hueco rectangular SIN TAPA con muesca escalonada en ángulo recto por ABAJO:
      //   - Pared trasera: flotante — la muesca le quita el tramo inferior (zB..zM) a lo largo
      //     de TODO el canal, dejando solo la mitad superior (zM..zT)
      //   - Cara del escalón: vertical en ángulo recto que sube desde el piso hasta la base de
      //     la pared trasera flotante, a todo lo largo (el corte visible desde los laterales)
      //   - Pared delantera y piso completos
      ctx.fillStyle = hexA(netColorCanal, 0.18);
      // pN toma (su, tv) en METROS sobre los ejes U/V del canal (no iso crudo): las llamadas
      // de abajo no cambian — xL/xR son su a lo largo, yB..yF3 son tv a lo ancho.
      const pN = (su: number, tv: number, pz: number) => P(su, tv, pz);
      const xL = 0;
      const xR = longM;
      const yB = 0;
      const yF = baseM;
      const zT = zPixC;
      const zM = notchZ; // nivel del escalón
      const zB = bottomZ;
      // Región de las muescas: corren a TODO lo largo del canal (eje U). Las muescas se ven como
      // ESCALONES que BAJAN hacia el centro del canal: la muesca exterior (junto a cada pared,
      // 15% del ancho) es somera — se quita POR ABAJO el 25% de la altura (zB..zM) y la pared
      // flota desde ahí; la muesca interior escalonada (10% del ancho, arranca donde termina la
      // exterior) es más profunda — se quita hasta el 75% de la altura (zB..zM2). El piso
      // (nivel zB) queda solo en la franja central.
      const yB2 = baseM * 0.15; // borde interior de la muesca trasera exterior
      const yB3 = baseM * 0.25; // borde interior de la muesca trasera interior
      const yF2 = baseM * 0.85; // borde interior de la muesca delantera exterior
      const yF3 = baseM * 0.75; // borde interior de la muesca delantera interior
      const zM2 = zPixC + wall * 0.75 * ISO_SCALE; // nivel del escalón interior (profundo, 75%)

      // Piso (base inferior) — solo la franja central fuera de las muescas
      quad(pN(xL, yB3, zB), pN(xR, yB3, zB), pN(xR, yF3, zB), pN(xL, yF3, zB));
      ctx.fill();
      ctx.stroke();

      // Pared trasera — flotante: solo la mitad superior (zM..zT), a todo lo largo del canal
      quad(pN(xL, yB, zM), pN(xR, yB, zM), pN(xR, yB, zT), pN(xL, yB, zT));
      ctx.fill();
      ctx.stroke();
      // Superficie del escalón trasero exterior (horizontal, techo de la muesca, zM)
      quad(pN(xL, yB, zM), pN(xR, yB, zM), pN(xR, yB2, zM), pN(xL, yB2, zM));
      ctx.fill();
      ctx.stroke();
      // Pared vertical del escalón trasero (entre el nivel zM y el nivel zM2, en yB2)
      quad(pN(xL, yB2, zM2), pN(xR, yB2, zM2), pN(xR, yB2, zM), pN(xL, yB2, zM));
      ctx.fill();
      ctx.stroke();
      // Superficie del escalón trasero interior (horizontal, techo de la muesca interior, zM2)
      quad(pN(xL, yB2, zM2), pN(xR, yB2, zM2), pN(xR, yB3, zM2), pN(xL, yB3, zM2));
      ctx.fill();
      ctx.stroke();
      // Cara del escalón trasero interior (del piso zB al nivel zM2, en yB3)
      quad(pN(xL, yB3, zB), pN(xR, yB3, zB), pN(xR, yB3, zM2), pN(xL, yB3, zM2));
      ctx.fill();
      ctx.stroke();

      // Pared delantera — flotante (espejo de la trasera): solo la mitad superior (zM..zT)
      quad(pN(xL, yF, zM), pN(xR, yF, zM), pN(xR, yF, zT), pN(xL, yF, zT));
      ctx.fill();
      ctx.stroke();
      // Superficie del escalón delantero exterior (zM)
      quad(pN(xL, yF2, zM), pN(xR, yF2, zM), pN(xR, yF, zM), pN(xL, yF, zM));
      ctx.fill();
      ctx.stroke();
      // Pared vertical del escalón delantero (entre zM y zM2, en yF2)
      quad(pN(xL, yF2, zM2), pN(xR, yF2, zM2), pN(xR, yF2, zM), pN(xL, yF2, zM));
      ctx.fill();
      ctx.stroke();
      // Superficie del escalón delantero interior (zM2)
      quad(pN(xL, yF3, zM2), pN(xR, yF3, zM2), pN(xR, yF2, zM2), pN(xL, yF2, zM2));
      ctx.fill();
      ctx.stroke();
      // Cara del escalón delantero interior (del piso zB al nivel zM2, en yF3)
      quad(pN(xL, yF3, zB), pN(xR, yF3, zB), pN(xR, yF3, zM2), pN(xL, yF3, zM2));
      ctx.fill();
      ctx.stroke();

      // Cara del extremo izquierdo (perfil escalonado con las muescas por abajo) — wireframe
      ctx.beginPath();
      ctx.moveTo(pN(xL, yB, zM).sx, pN(xL, yB, zM).sy);
      ctx.lineTo(pN(xL, yB, zT).sx, pN(xL, yB, zT).sy);
      ctx.lineTo(pN(xL, yF, zT).sx, pN(xL, yF, zT).sy);
      ctx.lineTo(pN(xL, yF, zM).sx, pN(xL, yF, zM).sy);
      ctx.lineTo(pN(xL, yF2, zM).sx, pN(xL, yF2, zM).sy);
      ctx.lineTo(pN(xL, yF2, zM2).sx, pN(xL, yF2, zM2).sy);
      ctx.lineTo(pN(xL, yF3, zM2).sx, pN(xL, yF3, zM2).sy);
      ctx.lineTo(pN(xL, yF3, zB).sx, pN(xL, yF3, zB).sy);
      ctx.lineTo(pN(xL, yB3, zB).sx, pN(xL, yB3, zB).sy);
      ctx.lineTo(pN(xL, yB3, zM2).sx, pN(xL, yB3, zM2).sy);
      ctx.lineTo(pN(xL, yB2, zM2).sx, pN(xL, yB2, zM2).sy);
      ctx.lineTo(pN(xL, yB2, zM).sx, pN(xL, yB2, zM).sy);
      ctx.closePath();
      ctx.stroke();

      // Cara del extremo derecho (perfil escalonado, espejo) — wireframe
      ctx.beginPath();
      ctx.moveTo(pN(xR, yB, zM).sx, pN(xR, yB, zM).sy);
      ctx.lineTo(pN(xR, yB, zT).sx, pN(xR, yB, zT).sy);
      ctx.lineTo(pN(xR, yF, zT).sx, pN(xR, yF, zT).sy);
      ctx.lineTo(pN(xR, yF, zM).sx, pN(xR, yF, zM).sy);
      ctx.lineTo(pN(xR, yF2, zM).sx, pN(xR, yF2, zM).sy);
      ctx.lineTo(pN(xR, yF2, zM2).sx, pN(xR, yF2, zM2).sy);
      ctx.lineTo(pN(xR, yF3, zM2).sx, pN(xR, yF3, zM2).sy);
      ctx.lineTo(pN(xR, yF3, zB).sx, pN(xR, yF3, zB).sy);
      ctx.lineTo(pN(xR, yB3, zB).sx, pN(xR, yB3, zB).sy);
      ctx.lineTo(pN(xR, yB3, zM2).sx, pN(xR, yB3, zM2).sy);
      ctx.lineTo(pN(xR, yB2, zM2).sx, pN(xR, yB2, zM2).sy);
      ctx.lineTo(pN(xR, yB2, zM).sx, pN(xR, yB2, zM).sy);
      ctx.closePath();
      ctx.stroke();

      // Abertura superior (borde del perfil hueco, sin relleno) — contorno fino
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexA(netColorCanal, 0.9);
      quad(pA, pB, pC, pD);
      ctx.stroke();
      if (isSel) {
        // Seleccionado: contorno amarillo más grueso en la cara de apertura + etiqueta de
        // código encima
        ctx.lineWidth = 2.5;
        quad(pA, pB, pC, pD);
        ctx.stroke();
        const rectCenter = P(longM / 2, baseM / 2, zPixC);
        const topSy = Math.min(pA.sy, pB.sy, pC.sy, pD.sy);
        ctx.fillStyle = '#FFEB3B';
        ctx.font = 'bold 11px Geist,monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.code || b.id, rectCenter.sx, topSy - 6);
      }
      ctx.restore();
    }
  }
}
