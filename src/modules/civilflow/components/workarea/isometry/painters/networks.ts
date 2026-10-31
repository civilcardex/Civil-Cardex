import { NETS } from '../../../../lib/PlanoEngine/PlanoState.ts';
import { splitPtr } from '../../../../utils/keys.ts';
import { dibujaCodoIso } from '../codoIso.ts';
import {
  CODO_CIRC,
  CODO_RADIO,
  agrupaCodos,
  construyeJuncCodo,
  extremosVerticales,
  hayVerticalArriba,
  ladoDelCodo,
  nivelDePlanId,
  preparaCodos,
  recortaExtremoCodo,
  recortaVerticalAlCodo,
  unionDeGrupo,
  unionEnExtremo,
  verticalPasaAlOtroLado,
  type CodoPrep,
} from '../recorteCodo.ts';
import { project, ISO_SCALE, type IsoRamal, type IsoBajante } from '../geometry';
import { drawIsoCuboid } from '../isoDrawUtils.ts';
import type { IsoSegment } from '../useIsometryInteraction.ts';
import type { PlanItem } from '../../../../context/PlansContext.tsx';
import type { VistaIso } from './isoView.ts';

/** Resuelve a dónde cae una bajante/montante con asociación entre pisos: el z del destino y el
 * elemento destino (ramal o bajante real). Primero la BOMBA asociada (bombaEnId), luego el
 * fantasma cross-floor (targetBajanteId), y como respaldo el descargaEnId crudo. Ej: un montante
 * de ac (Agua Caliente) con descargaEnId al piso 1 devuelve el z del P1 y el bajante de abajo. */
function resuelveDestinoBajante(
  b: IsoBajante,
  netData: { ramales: IsoRamal[]; bajantes: IsoBajante[] },
  nptMap: Record<number, number>,
): {
  targetZ: number;
  targetRamal: IsoRamal | null | undefined;
  targetBajante: IsoBajante | null;
} {
  let targetZ = nptMap[b.planNivel] || 0;
  // Resuelve el bajante destino REAL para una asociación bajante-a-bajante a través de su
  // CrossFloorGhost (applyBajanteAssociation siempre crea uno, en el propio piso del
  // destino, registrando ghost.targetBajanteId) — el (x,y) PROPIO del ghost refleja las
  // coordenadas crudas del ORIGEN y aquí solo sirve para localizar a qué piso/bajante
  // apunta, nunca como ancla del conector: los dos extremos de abajo se fuerzan sobre el
  // (x,y) del bajante destino REAL, produciendo un recorrido vertical único y recto (mismo
  // x,y en todo el tramo, solo cambia z) que cae exactamente sobre la posición dibujada del
  // destino, como debe leerse un diagrama de bajante sin importar el desfase incidental en
  // las coordenadas crudas del plano de origen. Los bajantes `_isCrossFloorGhost` nunca
  // resuelven aquí su propio descargaEnId inverso — eso dibujaría esta misma conexión una
  // segunda vez, desde el otro extremo.
  let targetRamal = null;
  let targetBajante = null;
  // BOMBA asociada (orig. usuario): `bombaEnId` en la bajante superior resuelve a la
  // bomba del piso inferior — la columna de la bajante baja hasta el piso de la bomba
  // (alineados: unión vertical continua en el mismo x,y; desalineados: dos columnas y el
  // desvío lo cubre el ramal LD_ del piso de la bomba, que ya se dibuja como ramal).
  if (b.bombaEnId?.includes('|') && !b._isCrossFloorGhost) {
    const [pPlan, pId] = splitPtr(b.bombaEnId, '');
    targetBajante =
      netData.bajantes.find(
        (bb) => !bb._isCrossFloorGhost && bb.id === pId && String(bb.planId) === pPlan,
      ) || null;
    if (targetBajante) {
      targetZ = nptMap[targetBajante.planNivel] || 0;
    }
  } else if (b.descargaEnId && !b._isCrossFloorGhost) {
    const ownRef = `${b.planId}|${b.id}`;
    const ghost = netData.bajantes.find(
      (bb) => bb._isCrossFloorGhost && bb.descargaEnId === ownRef,
    );
    if (ghost?.targetBajanteId) {
      targetBajante =
        netData.bajantes.find(
          (bb) =>
            !bb._isCrossFloorGhost && bb.id === ghost.targetBajanteId && bb.planId === ghost.planId,
        ) || null;
    }
    if (targetBajante) {
      targetZ = nptMap[targetBajante.planNivel] || 0;
    } else {
      // Respaldo defensivo para datos incompletos/desactualizados que no tienen ghost.
      const parts = splitPtr(b.descargaEnId, b.planId);
      const targetPlanId = parts[0];
      const targetId = parts[1];
      targetRamal = netData.ramales.find(
        (rr) => rr.id === targetId && String(rr.planId) === String(targetPlanId),
      );
      if (targetRamal) {
        targetZ = nptMap[targetRamal.planNivel] || 0;
      } else {
        targetBajante =
          netData.bajantes.find(
            (bb) =>
              !bb._isCrossFloorGhost &&
              bb.id === targetId &&
              String(bb.planId) === String(targetPlanId),
          ) || null;
        if (targetBajante) {
          targetZ = nptMap[targetBajante.planNivel] || 0;
        }
      }
    }
  }
  return { targetZ, targetRamal, targetBajante };
}

/** ¿Se dibuja esta bajante/montante con el filtro de pisos activo? Una bajante de un piso
 *  oculto se dibuja igual si su descarga cae en un piso visible (la tubería cruza). */
function bajanteVisible(
  b: IsoBajante,
  pisosVisibles: Set<number> | null,
  confirmedPlanos: PlanItem[],
): boolean {
  if (!pisosVisibles || pisosVisibles.has(b.planNivel)) return true;
  if (!b.descargaEnId) return false;
  return pisosVisibles.has(nivelDePlanId(confirmedPlanos, splitPtr(b.descargaEnId, '')[0]) ?? NaN);
}

/** Pase 3 de la isometría: dibuja las redes activas — primero los ramales (con recorte exacto
 * de codos) y luego las bajantes/montantes de cada red, con su conector entre pisos resuelto y
 * el círculo con flecha de dirección en su piso propio. Ej: la red san (Sanitaria) pinta sus
 * ramales en el color de la red y cada bajante como columna vertical con flecha "Baja". */
export function pintaRedes(args: {
  ctx: CanvasRenderingContext2D;
  dataByNet: Record<string, { ramales: IsoRamal[]; bajantes: IsoBajante[] }>;
  activeNets: Set<string>;
  profByNet: Record<string, number>;
  nptMap: Record<number, number>;
  selTramo: string | null;
  pisosVisibles: Set<number> | null;
  confirmedPlanos: PlanItem[];
  segments: IsoSegment[];
  vista: VistaIso;
  getIsoCoords: (px: number, py: number, nivel: number) => { x: number; y: number };
  getZPix: (zMm: number, nivel?: number) => number;
}): void {
  const {
    ctx,
    dataByNet,
    activeNets,
    profByNet,
    nptMap,
    selTramo,
    pisosVisibles,
    confirmedPlanos,
    segments,
    vista,
    getIsoCoords,
    getZPix,
  } = args;
  const { rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy } = vista;
  // Dibuja cada red activa
  for (const [netId, netData] of Object.entries(dataByNet)) {
    if (!activeNets.has(netId)) continue;
    const netColor = NETS.find((n) => n.id === netId)?.col || '#888';
    const prof = profByNet[netId] ?? 0;

    ctx.strokeStyle = netColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const projPt = (px: number, py: number, pz: number) =>
      project(px, py, pz, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);

    // Codos 90° de bajantes/montantes PREPARADOS antes del loop de ramales: por elemento
    // con ramal conectado calcula el vértice (intersección ramal × vertical del centro),
    // el lado donde el tubo sigue y el recorte EXACTO del ramal a su tangencia.
    const proyectaNet = (iso: { x: number; y: number }, zP: number) =>
      project(iso.x, iso.y, zP, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
    const codoJunc = construyeJuncCodo(netData.bajantes, pisosVisibles, confirmedPlanos);
    const codo = preparaCodos({
      bajantes: netData.bajantes,
      ramales: netData.ramales,
      proyecta: proyectaNet,
      isoDe: getIsoCoords,
      nptMap,
      prof,
      getZPix,
      zoom,
    });
    // Tramos verticales proyectados (una pasada): sirven para saber si el codo es PASANTE —
    // otra bajante/montante de la red llega a la unión desde el lado opuesto (piso vecino) y
    // entonces la vertical NO se recorta. Solo tipos con tubo real (bajante/montante).
    const spansVert: Array<{ sx: number; syMin: number; syMax: number }> = [];
    for (const bb of netData.bajantes) {
      if (bb._isCrossFloorGhost || (bb.tipo !== 'bajante' && bb.tipo !== 'montante')) continue;
      if (!bajanteVisible(bb, pisosVisibles, confirmedPlanos)) continue;
      const { targetZ: tz } = resuelveDestinoBajante(bb, netData, nptMap);
      const { baseZ: bz, cimaZ: cz } = extremosVerticales(
        bb.tipo,
        bb.direccion,
        nptMap[bb.planNivel] || 0,
        tz,
      );
      const profBB = profByNet[bb.net] ?? 0;
      const isoBB = getIsoCoords(bb.x, bb.y, bb.planNivel);
      const pb = proyectaNet(isoBB, getZPix(bz - profBB * 1000, bb.planNivel));
      const pc = proyectaNet(isoBB, getZPix(cz - profBB * 1000, bb.planNivel));
      spansVert.push({ sx: pb.sx, syMin: Math.min(pb.sy, pc.sy), syMax: Math.max(pb.sy, pc.sy) });
    }

    // Rectángulo acostado en el plano del piso (cajas CAN/CALL y red_publica): esquinas en
    // unidades iso (1 m = ISO_SCALE) proyectadas a los 4 vértices, solo trazo.
    const drawIsoRect = (
      iso: { x: number; y: number },
      zPix: number,
      wM: number,
      dM: number,
      stroke: string,
      lw: number,
    ) => {
      const hw = (wM / 2) * ISO_SCALE;
      const hd = (dM / 2) * ISO_SCALE;
      const corners: [number, number][] = [
        [iso.x - hw, iso.y - hd],
        [iso.x + hw, iso.y - hd],
        [iso.x + hw, iso.y + hd],
        [iso.x - hw, iso.y + hd],
      ];
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const pr = project(
          corners[i][0],
          corners[i][1],
          zPix,
          rotZ,
          rotX,
          scaleZ,
          zoom,
          offX,
          offY,
          cx,
          cy,
        );
        if (i === 0) ctx.moveTo(pr.sx, pr.sy);
        else ctx.lineTo(pr.sx, pr.sy);
      }
      ctx.closePath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    for (const r of netData.ramales) {
      // Piso oculto por el usuario → fuera (los ramales no cruzan pisos).
      if (pisosVisibles && !pisosVisibles.has(r.planNivel)) continue;
      // `prof` (Parámetros de Diseño > Materiales por red > "Profundidad de instalación
      // respecto a NPT") se guarda NEGATIVO para instalaciones bajo losa (p. ej. sanitaria
      // -0.70). En esta proyección un z MÁS POSITIVO se renderiza MÁS ABAJO en pantalla (ver
      // project() en geometry.ts: y2 crece con z en el rotX=-45° por defecto), por lo que una
      // profundidad negativa debe RESTARSE para empujar el trazo hacia abajo — sumarla (el
      // comportamiento anterior) empujaba los trazos hacia arriba.
      const z = (nptMap[r.planNivel] || 0) - prof * 1000;
      const z_pix = getZPix(z, r.planNivel);
      const pts = r.pts;
      if (pts.length < 2) continue;
      // Extremo que toca un bajante/montante CON codo: recorte exacto a la tangencia
      // (distancia preparada por preparaCodos; si no hay prep, sin recorte). Clave con planId:
      // el mismo id de ramal existe en varios pisos y todos se dibujan en la isometría.
      const t0C = codo.porRamal.get(`${r.planId}:${r.id}:0`);
      const tLC = codo.porRamal.get(`${r.planId}:${r.id}:1`);
      const k0 =
        t0C !== undefined ||
        codoJunc.has(`${Math.round(pts[0][0] * 10)}|${Math.round(pts[0][1] * 10)}|${r.planNivel}`);
      const kL =
        tLC !== undefined ||
        codoJunc.has(
          `${Math.round(pts[pts.length - 1][0] * 10)}|${Math.round(pts[pts.length - 1][1] * 10)}|${r.planNivel}`,
        );
      const selKey = `${netId}:${r.planId}:${r.id}`;
      const isSel = selKey === selTramo;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p =
          k0 && i === 0
            ? recortaExtremoCodo(pts[0], pts[1], t0C ?? 0)
            : kL && i === pts.length - 1
              ? recortaExtremoCodo(pts[pts.length - 1], pts[pts.length - 2], tLC ?? 0)
              : pts[i];
        const iso = getIsoCoords(p[0], p[1], r.planNivel);
        const pr = project(iso.x, iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        if (i === 0) ctx.moveTo(pr.sx, pr.sy);
        else ctx.lineTo(pr.sx, pr.sy);
      }
      ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
      ctx.lineWidth = isSel ? 3.5 : 2;
      ctx.stroke();
      for (let i = 1; i < pts.length; i++) {
        const iso1 = getIsoCoords(pts[i - 1][0], pts[i - 1][1], r.planNivel);
        const iso2 = getIsoCoords(pts[i][0], pts[i][1], r.planNivel);
        const a = project(iso1.x, iso1.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        const b = project(iso2.x, iso2.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        segments.push({
          sx1: a.sx,
          sy1: a.sy,
          sx2: b.sx,
          sy2: b.sy,
          z: z_pix,
          id: selKey,
          label: r.label || r.id,
          isBaj: false,
          netId,
        });
      }

      if (isSel) {
        const midI = Math.floor(pts.length / 2);
        const isoMid = getIsoCoords(pts[midI][0], pts[midI][1], r.planNivel);
        const mp = project(isoMid.x, isoMid.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        ctx.fillStyle = '#FFEB3B';
        ctx.font = 'bold 11px Geist,monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const lbl = `${r.label || r.id} L=${r.totalL}m`;
        ctx.fillText(lbl, mp.sx, mp.sy - 8);
      }
    }

    for (const b of netData.bajantes) {
      // Piso oculto (orig. usuario): fuera, SALVO bajantes con asociación entre pisos cuyo
      // destino (descargaEnId) esté en un piso visible — la tubería cruza y conecta con lo
      // que sí se ve, se dibuja igual.
      if (!bajanteVisible(b, pisosVisibles, confirmedPlanos)) continue;
      // Un CrossFloorGhost solo se consulta como referencia (a qué bajante real se conecta este
      // origen y en qué piso) — ver las llamadas a `netData.bajantes.find` más abajo. Ya no
      // necesita representación visual propia: el conector real origen→destino ahora se ancla
      // directamente sobre la posición del bajante destino real, así que dibujar aquí el stub
      // de un solo piso del ghost solo dejaba un segmento de bajante huérfano en las coordenadas
      // del ghost (= las crudas del origen), sin conectar con nada.
      if (b._isCrossFloorGhost) continue;

      // Calentador/contador se renderizan como cajas de equipo 3D en el piso, en lugar de un
      // stub de bajante.
      if (b.tipo === 'calentador' || b.tipo === 'contador') {
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;
        const zB = (nptMap[b.planNivel] || 0) - prof * 1000;
        const zPixB = getZPix(zB, b.planNivel);
        const isoB = getIsoCoords(b.x, b.y, b.planNivel);
        const dims =
          b.tipo === 'calentador' ? { w: 0.5, d: 0.5, h: 0.5 } : { w: 0.25, d: 0.25, h: 0.25 };
        drawIsoCuboid(
          ctx,
          projPt,
          isoB.x,
          isoB.y,
          zPixB,
          dims.w,
          dims.d,
          dims.h,
          netColor,
          isSel ? '#FFEB3B' : netColor,
          isSel,
        );
        if (isSel) {
          const topC = projPt(isoB.x, isoB.y, zPixB + dims.h * ISO_SCALE);
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(b.code || b.id, topC.sx, topC.sy - 6);
        }
        continue;
      }

      // Los canales ya se dibujaron en la pasada de fondo anterior.
      if (b.tipo === 'canal') continue;

      // Cajas CAN/CALL: doble cuadrado SOLO trazo acostado en el plano del piso (espejo
      // del símbolo 2D) — sin stub vertical, sin círculo, sin triángulo de dirección.
      if (b.tipo === 'caja_san' || b.tipo === 'caja_ll') {
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;
        const zB = (nptMap[b.planNivel] || 0) - prof * 1000;
        const zPixB = getZPix(zB, b.planNivel);
        const isoB = getIsoCoords(b.x, b.y, b.planNivel);
        const stroke = isSel ? '#FFEB3B' : netColor;
        // exterior 1.0×1.0 m, interior 0.7×0.7 m (cuadrados, espejo del 2D)
        drawIsoRect(isoB, zPixB, 1.0, 1.0, stroke, isSel ? 3 : 2);
        drawIsoRect(isoB, zPixB, 0.7, 0.7, stroke, isSel ? 3 : 2);
        if (isSel) {
          const cc = projPt(isoB.x, isoB.y, zPixB);
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(b.code || b.id, cc.sx, cc.sy - 8);
        }
        continue;
      }

      // red_publica: cuadrado pequeño con "RP" a nivel del piso.
      if (b.tipo === 'red_publica') {
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;
        const zB = (nptMap[b.planNivel] || 0) - prof * 1000;
        const zPixB = getZPix(zB, b.planNivel);
        const isoB = getIsoCoords(b.x, b.y, b.planNivel);
        const stroke = isSel ? '#FFEB3B' : netColor;
        drawIsoRect(isoB, zPixB, 0.45, 0.45, stroke, isSel ? 3 : 2);
        const cc = projPt(isoB.x, isoB.y, zPixB);
        ctx.fillStyle = stroke;
        ctx.font = 'bold 10px Geist,monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RP', cc.sx, cc.sy);
        continue;
      }

      const profB = profByNet[b.net] ?? 0;
      const currentZ = nptMap[b.planNivel] || 0;
      const { targetZ, targetRamal, targetBajante } = resuelveDestinoBajante(b, netData, nptMap);

      const lo = Math.min(currentZ, targetZ);
      // nptMap usa z NEGATIVO para los pisos (P1=-2700, P2=-5400...) y la proyección renderiza
      // un z más negativo MÁS ARRIBA en pantalla. Por eso el stub de una bajante sin destino
      // debe extenderse hacia el z MÁS NEGATIVO (SUBE = hacia arriba) y hacia el menos negativo
      // (BAJA = hacia abajo). Misma corrección de signo que en el z del ramal: profB es
      // negativo para bajo losa, por lo que se resta.
      const { baseZ, cimaZ } = extremosVerticales(b.tipo, b.direccion, currentZ, targetZ);
      const baseZ_pix = getZPix(baseZ - profB * 1000, b.planNivel);
      const cimaZ_pix = getZPix(cimaZ - profB * 1000, b.planNivel);

      let targetPt: number[] | null = null;
      let targetPlanNivel: number | null = null;
      if (targetRamal && targetRamal.pts.length > 0) {
        // Extremo del ramal destino más cercano al (x,y) propio de la bajante — no siempre es
        // pts[0], que podría ser el extremo lejano de un ramal largo y orientar mal el conector.
        // Comparación en coords ISO (cada punto por el origen de SU piso): px crudos de
        // láminas distintas no significan el mismo punto físico cuando las hojas están corridas.
        const bIsoCmp = getIsoCoords(b.x, b.y, b.planNivel);
        const firstIsoCmp = getIsoCoords(
          targetRamal.pts[0][0],
          targetRamal.pts[0][1],
          targetRamal.planNivel,
        );
        const lastPt = targetRamal.pts[targetRamal.pts.length - 1];
        const lastIsoCmp = getIsoCoords(lastPt[0], lastPt[1], targetRamal.planNivel);
        const distToFirst = Math.hypot(firstIsoCmp.x - bIsoCmp.x, firstIsoCmp.y - bIsoCmp.y);
        const distToLast = Math.hypot(lastIsoCmp.x - bIsoCmp.x, lastIsoCmp.y - bIsoCmp.y);
        targetPt = distToFirst <= distToLast ? targetRamal.pts[0] : lastPt;
        targetPlanNivel = targetRamal.planNivel;
      } else if (targetBajante) {
        targetPt = [targetBajante.x, targetBajante.y];
        targetPlanNivel = targetBajante.planNivel;
      }
      // Layout nuevo (regla del usuario): el tramo vertical de una asociación bajante-bajante cae
      // en el (x,y) PROPIO de la bajante superior — en el piso inferior esa posición es
      // exactamente el anillo fantasma (desplazamientos del bajante destino), y de ahí el
      // Ldesvio (dibujado como ramal del piso inferior, misma cota) cubre el desvío hasta la
      // bajante destino real. Antes ambos extremos se forzaban al (x,y) del destino, pisando
      // el dibujo real del desvío.
      const ownIso = getIsoCoords(b.x, b.y, b.planNivel);
      const baseIso = ownIso;
      const cimaIso = ownIso;
      const pBase = project(
        baseIso.x,
        baseIso.y,
        baseZ_pix,
        rotZ,
        rotX,
        scaleZ,
        zoom,
        offX,
        offY,
        cx,
        cy,
      );
      const pCima = project(
        cimaIso.x,
        cimaIso.y,
        cimaZ_pix,
        rotZ,
        rotX,
        scaleZ,
        zoom,
        offX,
        offY,
        cx,
        cy,
      );
      const selKey = `${netId}:${b.planId}:${b.id}`;
      const isSel = selKey === selTramo;

      // Círculo + indicador de dirección en el PISO PROPIO de la bajante (currentZ), no en el
      // extremo del destino ni en el del stub: para una bajante SUBE es el extremo inferior del
      // recorrido y para una BAJA el superior, y con ghost/destino en otro piso el símbolo
      // sigue presidiendo su propio piso (el círculo se desliza por la línea del conector hasta
      // la altura de currentZ).
      const floorZ_pix = getZPix(currentZ - profB * 1000, b.planNivel);
      const floorPt = project(
        ownIso.x,
        ownIso.y,
        floorZ_pix,
        rotZ,
        rotX,
        scaleZ,
        zoom,
        offX,
        offY,
        cx,
        cy,
      );
      // Codos del elemento: TODOS los ramales conectados, cada uno con su vértice y su
      // dirección. Se AGRUPAN por punto de unión: un bajante puede tener una esquina en su
      // piso y otra en el de descarga (columna entre pisos) — cada grupo lleva su lado y su
      // recorte. La flecha va junto al grupo más cercano al piso propio del elemento.
      const preps = codo.porBajante.get(`${b.planId}:${b.id}`) ?? [];
      const esquinas: Array<{
        preps: CodoPrep[];
        u: { sx: number; sy: number };
        lado: 'arriba' | 'abajo';
      }> = [];
      for (const g of agrupaCodos(preps, 2)) {
        const u = unionDeGrupo(g);
        // `origenId` (recibe del piso superior) solo manda 'arriba' si hay una vertical
        // DIBUJADA que llega desde arriba; si no, el arco iría flotando y la tubería visible
        // seguiría hacia abajo (el "codo al revés" de la captura del usuario).
        const lado = ladoDelCodo(pBase, pCima, u, !!b.origenId && hayVerticalArriba(u, spansVert));
        esquinas.push({ preps: g, u, lado });
      }
      // Recorte de la vertical en la tangencia: sin él queda el "pico" recto unión→tangencia
      // asomando por dentro de la curva. SOLO si el arco va del lado del propio tramo vertical,
      // la unión cae en un EXTREMO y el tubo MUERE ahí — si otra vertical de la red llega por
      // el otro lado es un tee pasante y la línea principal sigue recta (recortarla dejaría un
      // hueco). Se aplica por esquina: una columna entre pisos puede recortarse en sus DOS
      // extremos (codo en el piso propio y en el de descarga).
      let vBase = pBase;
      let vCima = pCima;
      for (const e of esquinas) {
        if (
          e.lado === ladoDelCodo(pBase, pCima, e.u, false) &&
          unionEnExtremo(e.u, pBase, pCima) &&
          !verticalPasaAlOtroLado(e.lado, e.u, spansVert)
        ) {
          const rec = recortaVerticalAlCodo(vBase, vCima, e.u, CODO_RADIO * zoom, e.lado);
          vBase = rec.base;
          vCima = rec.cima;
        }
      }

      ctx.beginPath();
      ctx.moveTo(vBase.sx, vBase.sy);
      ctx.lineTo(vCima.sx, vCima.sy);
      ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
      ctx.lineWidth = isSel ? 3.5 : 2;
      ctx.stroke();

      const circR = CODO_CIRC * zoom;
      const isSubeDir = b.direccion ? b.direccion === 'sube' : b.tipo === 'montante';
      const dirY = isSubeDir ? -1 : 1;
      // Con codo, la flecha se despega en DIAGONAL hacia FUERA de la esquina (orig. usuario:
      // desplazada a lo largo del flujo quedaba ENCIMA de la tuberita vertical del tramo que
      // sigue). Se promedian las bisectrices NORMALIZADAS de cada arco: con ramales simétricos
      // sumar las direcciones crudas dejaba la flecha sobre la vertical, dentro del abanico.
      // Sin codo queda en floorPt como siempre.
      let esqMarc: (typeof esquinas)[number] | null = null;
      let dMarc = Infinity;
      for (const e of esquinas) {
        const d = Math.hypot(e.u.sx - floorPt.sx, e.u.sy - floorPt.sy);
        if (d < dMarc) {
          dMarc = d;
          esqMarc = e;
        }
      }
      let marcX = floorPt.sx;
      let marcY = floorPt.sy;
      if (esqMarc) {
        const fd = { x: 0, y: esqMarc.lado === 'arriba' ? -1 : 1 };
        let bx = 0;
        let by = 0;
        for (const p of esqMarc.preps) {
          if (Math.abs(p.dir.x * fd.x + p.dir.y * fd.y) > 0.9) continue; // sin arco
          const bx1 = fd.x + p.dir.x;
          const by1 = fd.y + p.dir.y;
          const bl1 = Math.hypot(bx1, by1) || 1;
          bx += bx1 / bl1;
          by += by1 / bl1;
        }
        const bl = Math.hypot(bx, by);
        if (bl > 0.01) {
          const dM = (CODO_RADIO + CODO_CIRC + 4) * zoom;
          marcX = esqMarc.u.sx - (bx / bl) * dM;
          marcY = esqMarc.u.sy - (by / bl) * dM;
        }
      }
      ctx.save();
      ctx.strokeStyle = netColor;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#14161a';
      ctx.beginPath();
      ctx.arc(marcX, marcY, circR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Triángulo de dirección dentro del círculo
      ctx.fillStyle = netColor;
      ctx.beginPath();
      const triS = circR * 0.5;
      ctx.moveTo(marcX, marcY + dirY * triS);
      ctx.lineTo(marcX - triS, marcY - dirY * triS * 0.3);
      ctx.lineTo(marcX + triS, marcY - dirY * triS * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Curva del codo 90° (orig. usuario): empalme tangente entre CADA ramal conectado y el
      // tubo vertical, con vértice en la intersección real de las dos líneas y el lado del
      // grupo (donde el tubo sigue). La flecha círculo+triángulo de arriba se dibuja aparte.
      for (const e of esquinas) {
        for (const prep of e.preps) {
          dibujaCodoIso({
            ctx,
            vertex: prep.vertex,
            ramalDir: prep.dir,
            lado: e.lado,
            R: CODO_RADIO * zoom,
            color: netColor,
            sel: isSel,
          });
        }
      }

      segments.push({
        sx1: pBase.sx,
        sy1: pBase.sy,
        sx2: pCima.sx,
        sy2: pCima.sy,
        z: (baseZ_pix + cimaZ_pix) / 2,
        id: selKey,
        label: b.code || b.id,
        isBaj: true,
        netId,
      });

      if (targetPt && targetPlanNivel !== null && !targetBajante) {
        const rIso = getIsoCoords(targetPt[0], targetPt[1], targetPlanNivel);
        const rZ_pix = getZPix(targetZ - profB * 1000, targetPlanNivel);
        const rProj = project(rIso.x, rIso.y, rZ_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
        let connectionPoint = targetZ === lo ? pBase : pCima;
        // Codo entre pisos: el conector arranca en la TANGENCIA del arco, no en el vértice —
        // así la curva y la recta quedan empalmadas. El ramal alineado no lleva conector
        // (dConn <= 2): preparaCodos recortó el propio ramal en su tangencia.
        for (const p of preps) {
          if (p.leg !== 'conector') continue;
          connectionPoint = {
            sx: p.vertex.sx + p.dir.x * CODO_RADIO * zoom,
            sy: p.vertex.sy + p.dir.y * CODO_RADIO * zoom,
          };
        }
        const dConn = Math.hypot(rProj.sx - connectionPoint.sx, rProj.sy - connectionPoint.sy);
        if (dConn > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(connectionPoint.sx, connectionPoint.sy);
          ctx.lineTo(rProj.sx, rProj.sy);
          // Sólido (orig. usuario: en iso no van marcadores punteados) — es tubería real
          // hacia el ramal de descarga, color de la red.
          ctx.strokeStyle = netColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (isSel) {
        const mid = { sx: (pBase.sx + pCima.sx) / 2, sy: (pBase.sy + pCima.sy) / 2 };
        const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
        const lbl1 = dInches > 0 ? `${b.code || b.id}:${dInches}"` : `${b.code || b.id}`;
        const dirText = b.direccion === 'sube' ? 'Sube' : b.direccion === 'baja' ? 'Baja' : '';
        ctx.fillStyle = '#FFEB3B';
        ctx.font = 'bold 11px Geist,monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(lbl1, mid.sx, mid.sy - 8);
        if (dirText) {
          ctx.font = '10px Geist,monospace';
          ctx.fillText(dirText, mid.sx, mid.sy - 8 + 13);
        }
      }
    }
  }
}
