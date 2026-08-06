import { NETS } from './PlanoState';
import type { PlanoRamal, PlanoBajante } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';

export {
  _renumberRamales,
  _renumberBajantes,
  _renumberMontantes,
  _renumberAreas,
} from './networkRenumber';
export { calcSanitaryAccessories, calcHydroAccessories } from './networkSanitary';

export function getElementsByNet(
  engine: IPlanoEngineCore,
  netId: string,
): Array<{
  type: string;
  id: string;
  label: string;
  totalL: number;
  segs: number;
  piso: string;
  tipo: string;
  padre?: string | null;
  pendiente?: number;
  diametro?: string;
}> {
  const items: Array<{
    type: string;
    id: string;
    label: string;
    totalL: number;
    segs: number;
    piso: string;
    tipo: string;
    padre?: string | null;
    pendiente?: number;
    diametro?: string;
  }> = [];
  for (const r of engine.ramales) {
    if (r.net === netId) {
      items.push({
        type: 'ramal',
        id: r.id,
        label: r.label || r.id,
        totalL: r.totalL || 0,
        segs: r.pts ? Math.max(0, r.pts.length - 1) : 0,
        piso: r.piso || '',
        tipo: r.tipo || 'ramal',
        padre: r.padre || null,
        pendiente: r.pendiente,
        diametro: r.diametro,
      });
    }
  }
  for (const b of engine.bajantes) {
    if (b.net === netId) {
      items.push({
        type: 'bajante',
        id: b.id,
        label: b.code || b.id,
        totalL: b.totalL || 0,
        segs: 0,
        piso: b.piso || '',
        tipo: b.tipo || 'bajante',
        pendiente: b.pendiente,
        diametro: b.dNominal,
      });
    }
  }
  return items;
}

export function setNetHidden(engine: IPlanoEngineCore, netId: string, hidden: boolean): void {
  if (hidden) engine._hiddenNets.add(netId);
  else engine._hiddenNets.delete(netId);
  engine.render();
}

export function setNetLocked(engine: IPlanoEngineCore, netId: string, locked: boolean): void {
  if (locked) engine._lockedNets.add(netId);
  else engine._lockedNets.delete(netId);
  engine.render();
}

export function clearNet(engine: IPlanoEngineCore, netId: string): void {
  engine.ramales = engine.ramales.filter((r) => r.net !== netId);
  engine.bajantes = engine.bajantes.filter((b) => b.net !== netId);
  engine.areas = engine.areas.filter((a) => a.net !== netId);
  // Los fantasmas entre pisos (y sus ramales conector Ldesvio) pertenecen a la MISMA red que su
  // bajante origen — limpiar esa red deja líneas punteadas apuntando a bajantes que ya no
  // existen. Se eliminan juntos para que ningún fantasma obsoleto sobreviva a su padre.
  engine.crossFloorGhosts = engine.crossFloorGhosts.filter((g) => g.net !== netId);
  if (engine.selectedGhostId) {
    const stillExists = engine.crossFloorGhosts.find((g) => g.id === engine.selectedGhostId);
    if (!stillExists) {
      engine.selectedGhostId = null;
      engine._isGhostSel = false;
      engine._emitSelect(null);
    }
  }
  if (engine.textAnnots) engine.textAnnots.length = 0;
  if (engine.dims) engine.dims.length = 0;
  engine._netCounts[netId] = { ramal: 0, tributario: 0 };
  engine.activeRamal = null;
  if (engine.selId) {
    const stillExists =
      engine.ramales.find((r) => r.id === engine.selId) ||
      engine.bajantes.find((b) => b.id === engine.selId);
    if (!stillExists) {
      engine.selId = null;
      engine._emitSelect(null);
    }
  }
  engine.render();
  engine._markDirty();
}

export function setPadreTributario(engine: IPlanoEngineCore, ramalId: string | null): void {
  if (engine.tipoTramo !== 'tributario') return;
  const padre = engine.ramales.find(
    (r) => r.id === ramalId && r.net === engine.activeNet && r.tipo === 'ramal',
  );
  engine.padreTributario = padre ? padre.id : null;
  engine.render();
}

export function getPadreTributario(engine: IPlanoEngineCore): PlanoRamal | null {
  if (!engine.padreTributario) return null;
  return (engine.ramales.find((r) => r.id === engine.padreTributario) as PlanoRamal) || null;
}

export function getRamalesPadre(engine: IPlanoEngineCore): PlanoRamal[] {
  return engine.ramales.filter(
    (r) => r.net === engine.activeNet && r.tipo === 'ramal',
  ) as unknown as PlanoRamal[];
}

export function setRamalDefaults(
  engine: IPlanoEngineCore,
  d: Partial<{ material: string; diametro: string; pendiente: number }> | null,
): void {
  engine._ramalDefaults = {
    material: d?.material || '',
    diametro: d?.diametro || '',
    pendiente: typeof d?.pendiente === 'number' ? d.pendiente : 0,
  };
}

export function getBajantesFantasma(engine: IPlanoEngineCore): PlanoBajante[] {
  if (!engine.nivelActual) return [];
  return engine.bajantes.filter((b) => {
    if (
      b.tipo === 'contador' ||
      b.tipo === 'calentador' ||
      b.tipo === 'red_publica' ||
      b.tipo === 'canal'
    )
      return false;
    if (b.desplazamientos && b.desplazamientos[engine.nivelActual!.label || '']) return true;
    const base = Math.min(b.nptBase || 0, b.nptCima || 0);
    const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
    const npt = engine.nivelActual!.npt || 0;
    if (npt >= base && npt <= cima) {
      // No mostrar el fantasma de dirección en el nivel del propio padre
      if (b.pisoBase === engine.nivelActual!.label) return false;
      return true;
    }
    const superior = engine.nptLevels
      .filter((l) => (l.npt || 0) > npt)
      .sort((a, b) => (a.npt || 0) - (b.npt || 0))[0]?.npt;
    return superior !== undefined && (b.nptBase === superior || b.nptCima === superior);
  }) as unknown as PlanoBajante[];
}

import { ACC_ABBR } from '../../utils/accessoryAbbreviations';
import { APARATOS_DEF } from '../../constants/engineeringDataFixtures';

// Una unión de codo reventilado es el extremo de un ramal 'vent' coincidiendo con un punto de
// un ramal 'san' (ver el umbral de 0.5 unidades que también usa el renderizador para dibujar el
// símbolo). Toda otra sincronización de puntos coincidentes de este motor (handleDragMove.ts) es
// solo dentro de la misma red — sin esto, arrastrar cualquiera de los dos lados de esta unión
// entre redes la despegaría.
export function findCodoReventiladoLinks(
  engine: IPlanoEngineCore,
  ramal: PlanoRamal,
  ptIdx: number,
): { id: string; ptIdx: number }[] {
  const pt = ramal.pts[ptIdx];
  if (!pt) return [];
  const links: { id: string; ptIdx: number }[] = [];
  const isEndpoint = ptIdx === 0 || ptIdx === ramal.pts.length - 1;

  if (ramal.net === 'vent' && isEndpoint) {
    for (const other of engine.ramales) {
      if (other.net !== 'san' || !other.pts?.length) continue;
      for (let i = 0; i < other.pts.length; i++) {
        if (Math.hypot(other.pts[i][0] - pt[0], other.pts[i][1] - pt[1]) < 0.5) {
          links.push({ id: other.id, ptIdx: i });
        }
      }
    }
  } else if (ramal.net === 'san') {
    for (const other of engine.ramales) {
      if (other.net !== 'vent' || !other.pts?.length) continue;
      [0, other.pts.length - 1].forEach((oi) => {
        if (Math.hypot(other.pts[oi][0] - pt[0], other.pts[oi][1] - pt[1]) < 0.5) {
          links.push({ id: other.id, ptIdx: oi });
        }
      });
    }
  }
  return links;
}

export function autoDetectRamalConnections(engine: IPlanoEngineCore): void {
  const lvlLabel = engine.nivelActual?.label ?? '';
  const ACC_LABELS = ACC_ABBR;

  const findEndpointTarget = (
    r: PlanoRamal,
    pt: number[],
  ): { code: string; isAcc: boolean; ref: PlanoBajante | PlanoRamal | null } | null => {
    const ptDist = (b: { x: number; y: number }) => Math.hypot(pt[0] - b.x, pt[1] - b.y);

    const dispMap = (b: PlanoBajante) => {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      return { x: b.x + (disp.dx || 0), y: b.y + (disp.dy || 0) };
    };

    let bestBaj: PlanoBajante | null = null;
    let bestBajDist = Infinity;
    for (const b of engine.bajantes) {
      if (b.net !== r.net) continue;
      const pos = dispMap(b);
      const d = ptDist(pos);
      if (d < bestBajDist) {
        bestBajDist = d;
        bestBaj = b;
      }
    }
    if (bestBaj && bestBajDist <= 0.5) {
      const code = bestBaj.code || bestBaj.id;
      return { code, isAcc: false, ref: bestBaj };
    }

    let bestRam: PlanoRamal | null = null;
    let bestRamDist = Infinity;
    for (const rr of engine.ramales) {
      if (rr === r) continue;
      if (rr.net !== r.net) continue;
      if (!rr.pts || rr.pts.length < 1) continue;
      for (const pt2 of rr.pts) {
        const d = ptDist({ x: pt2[0], y: pt2[1] });
        if (d < bestRamDist) {
          bestRamDist = d;
          bestRam = rr;
        }
      }
    }
    if (bestRam && bestRamDist <= 0.5) {
      const code = bestRam.label || bestRam.id;
      return { code, isAcc: false, ref: bestRam };
    }

    return null;
  };

  for (const r of engine.ramales) {
    const pts = r.pts || [];
    if (pts.length < 2) continue;

    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];

    const accIni = r.accesorioInicio;
    const appIni = r.aparatoInicio;
    let tStart = null;
    if (appIni) {
      const def = APARATOS_DEF.find((x) => x.id === appIni);
      const name = def ? def.sigla.replace(':', '').trim() : appIni;
      tStart = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else if (accIni) {
      const name = ACC_LABELS[accIni] || accIni;
      tStart = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else {
      tStart = findEndpointTarget(r, pStart);
      // Guardia de dirección de flujo: un bajante 'baja' en pts[0] crearía exactamente el estado
      // inválido del reporte de bug (RS5-P1 con flecha saliendo de un BAN4-P1 "Baja"). Se descarta
      // tStart si el objetivo auto-detectado es un bajante 'baja' — misma regla que usa la ruta de
      // creación activa.
      if (tStart && tStart.ref && (tStart.ref as PlanoBajante).direccion === 'baja') {
        tStart = null;
      }
    }

    const accFin = r.accesorioFin;
    const appFin = r.aparatoFin;
    let tEnd = null;
    if (appFin) {
      const def = APARATOS_DEF.find((x) => x.id === appFin);
      const name = def ? def.sigla.replace(':', '').trim() : appFin;
      tEnd = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else if (accFin) {
      const name = ACC_LABELS[accFin] || accFin;
      tEnd = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else {
      tEnd = findEndpointTarget(r, pEnd);
    }

    let newIni = r.ini || '';
    let newFin = r.fin || '';

    if (tStart && tEnd && tStart.ref && tEnd.ref) {
      const refS = tStart.ref;
      const refE = tEnd.ref;
      const isStartCont = refS.tipo === 'contador';
      const isStartMon = refS.tipo === 'montante';
      const isEndCont = refE.tipo === 'contador';
      const isEndMon = refE.tipo === 'montante';

      if ((isStartCont && isEndMon) || (isStartMon && isEndCont)) {
        newIni = isStartCont ? tStart.code : tEnd.code;
        newFin = isStartMon ? tStart.code : tEnd.code;
      } else {
        newIni = tStart.code;
        newFin = tEnd.code;
      }
    } else {
      if (tStart) newIni = tStart.code;
      else newIni = '';
      if (tEnd) newFin = tEnd.code;
      else newFin = '';
    }

    if (r.ini !== newIni || r.fin !== newFin) {
      r.ini = newIni;
      r.fin = newFin;
    }
  }
}

/**
 * Auto-detect contador → red pública connection. Creates linking ramales.
 */
export function ensureRpCntRamal(engine: IPlanoEngineCore): void {
  const nets = ['af', 'ac'];
  for (const netId of nets) {
    const contadores = engine.bajantes.filter((b) => b.tipo === 'contador' && b.net === netId);
    for (const cnt of contadores) {
      const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica' && b.net === netId);
      if (rps.length === 0) continue;
      let nearestRP = rps[0];
      let minDist = Infinity;
      for (const rp of rps) {
        const d = Math.hypot(rp.x - cnt.x, rp.y - cnt.y);
        if (d < minDist) {
          minDist = d;
          nearestRP = rp;
        }
      }
      const rpId = nearestRP.code || nearestRP.id;
      const cntId = cnt.code || cnt.id;
      const alreadyConnected = engine.ramales.some(
        (r) =>
          r.net === netId &&
          ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId)),
      );
      if (alreadyConnected) continue;
      const net = NETS.find((n) => n.id === netId);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[netId]) engine._netCounts[netId] = { ramal: 0, tributario: 0 };
      engine._netCounts[netId].ramal++;
      const ramCnt = engine._netCounts[netId].ramal;
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: netId,
        _net: netId,
        tipo: 'ramal',
        padre: null,
        pts: [
          [nearestRP.x, nearestRP.y],
          [cnt.x, cnt.y],
        ],
        totalL: +engine.pxToM(Math.hypot(cnt.x - nearestRP.x, cnt.y - nearestRP.y)).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: String(engine.nivelActual?.n ?? ''),
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + cnt.x) / 2,
        labelY: (nearestRP.y + cnt.y) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
        bloqueado: true,
      });
    }
  }
}
