// El pipeline de extracción de UNA red RCI por piso: elige el montante de derivación, camina
// el tronco remoto→derivación, conecta ramales por proximidad (pasadas a punto fijo), reparte
// nudos con letras, conectores a mano y piezas de tronco, y arma las filas R/T del estado.
// Ej: extraerRedDePiso(piso, 5.3, avisos) con la planta del ejemplo → raiz 'C', bajada 2.80.
import { num } from '../../../lib/rci/hydraulics.ts';
import { factorMPorPx } from '../../../lib/PlanoEngine/planoCoords.ts';
import type { TuberiaRow } from '../../../lib/rci/types.ts';
import type { BajanteRaw, DrawingData } from '../../drawingSyncTypes.ts';
import {
  TOL_PUNTO,
  TOL_BAJANTE,
  UMBRAL_GIRO,
  GAP_NUDO,
  RE_TEE,
  RE_CODO90,
  RE_CODO45,
  contarRociadores,
  leerAltDeriv,
  leerMaterial,
  leerDn,
  extremos,
  masCercanoEnPolilinea,
  totalPxDe,
  lonSeg,
  anguloEntre,
  accesoriosDe,
  contarAcc,
  teesEnVertice,
  codoEnVertice,
  letraNudo,
  troncoQueAloja,
  idxDePos,
  dirSalidaTronco,
  mejorConexion,
  ALT_DERIV_DEF,
} from './puras.ts';
import type { AvisoRci, Punto, TrazoDib, TramoTronco, PiezaTronco, RedDePiso } from './types.ts';

/** El montante de derivación de la red: el que recibe al trazo MÁS CERCANO (por código ini/fin
 *  la distancia es 0 — manda el libro del dibujo). Devuelve el montante, su posición y el
 *  EXTREMO del trazo que hace contacto. */
function derivacionDe(
  trazos: readonly TrazoDib[],
  montantesDib: readonly BajanteRaw[],
): { montDer: BajanteRaw; posMont: Punto; pDer: Punto } | null {
  for (const m of montantesDib) {
    const mp = { x: m.x || 0, y: m.y || 0 };
    let mejor: { t: TrazoDib; esA: boolean; d: number } | null = null;
    for (const t of trazos) {
      const porCodigoFin = String(t.el.fin || '') === m.code;
      const porCodigoIni = String(t.el.ini || '') === m.code;
      const dA = porCodigoIni ? 0 : Math.hypot(t.a.x - mp.x, t.a.y - mp.y);
      const dB = porCodigoFin ? 0 : Math.hypot(t.b.x - mp.x, t.b.y - mp.y);
      if (dA < TOL_BAJANTE && (!mejor || dA < mejor.d)) mejor = { t, esA: true, d: dA };
      if (dB < TOL_BAJANTE && (!mejor || dB < mejor.d)) mejor = { t, esA: false, d: dB };
    }
    if (mejor) return { montDer: m, posMont: mp, pDer: mejor.esA ? mejor.t.a : mejor.t.b };
  }
  return null;
}

/** Arma la red RCI de un piso desde sus trazos: camina el tronco desde el montante, reparte
 *  nudos (letras), ramales (R1…) y tramos (T1…) en el orden del dibujo (remoto primero). */
export function extraerRedDePiso(
  piso: { planId: string; label: string; doc: DrawingData | null },
  techo: number,
  avisos: AvisoRci[],
): RedDePiso {
  const vacio: RedDePiso = {
    red: null,
    idMont: '',
    nombreMont: '',
    matMont: '',
    dnMont: '',
    altDeriv: null,
    gabinetes: [],
  };
  const doc = piso.doc;
  if (!doc) return vacio;

  /* Gabinetes GABn dibujados en el piso (ped. usuario: la ruta de gabinetes nace del dibujo).
   * Se leen SIEMPRE — incluso en un piso sin red rci, su GAB cuenta como salida. */
  const gabinetes: { code: string; npt: number }[] = [];
  for (const b of (doc.bajantes || []) as BajanteRaw[]) {
    if (b.net !== 'rci' || b.tipo !== 'gabinete') continue;
    const code = String(b.code || '');
    if (!code) continue;
    gabinetes.push({ code, npt: num((b as { nptBase?: unknown }).nptBase) ?? 0 });
  }

  const trazos: TrazoDib[] = [];
  let orden = 0;
  for (const el of doc.ramales || []) {
    if (el.net !== 'rci' || el.tipo === 'tributario') continue;
    const ext = extremos(el);
    if (!ext) continue;
    trazos.push({
      el,
      id: `${piso.planId}|${el.id}`,
      a: ext[0],
      b: ext[1],
      L: num(el.totalL) ?? 0,
      roci: contarRociadores(el),
      acc: accesoriosDe(el),
      mat: leerMaterial(el),
      dn: leerDn(el),
      orden: orden++,
    });
  }
  if (trazos.length === 0) return { ...vacio, gabinetes };

  const montantesDib: BajanteRaw[] = [];
  for (const b of (doc.bajantes || []) as BajanteRaw[]) {
    if (b.net !== 'rci' || b.tipo !== 'montante' || (b as { isFantasma?: unknown }).isFantasma)
      continue;
    montantesDib.push(b);
  }
  /* PROYECCIÓN (XFG): en pisos superiores el montante NO se redibuja — llega la proyección del
   * piso inferior (crossFloorGhosts de la red rci). Cuenta como punto de derivación igual que
   * un montante real (mismo code/x/y); sin esto P2 decía «ningún montante conectado» con la
   * red bien dibujada. Ej: BRCI1 proyectado en P2 arranca la red de ese piso. */
  for (const g of (doc.crossFloorGhosts || []) as Array<{
    net?: string;
    code?: string;
    x?: number;
    y?: number;
  }>) {
    if (g.net !== 'rci' || !g.code || g.x == null || g.y == null) continue;
    montantesDib.push({
      code: g.code,
      x: g.x,
      y: g.y,
    } as BajanteRaw);
  }

  const deriv = derivacionDe(trazos, montantesDib);
  if (!deriv) {
    avisos.push({
      piso: piso.label,
      msg: 'Tiene trazos pero ningún montante conectado: la red no se exporta.',
    });
    return { ...vacio, gabinetes };
  }
  const { montDer, posMont, pDer } = deriv;

  /* Tronco: cadena de trazos SIN rociadores desde la derivación hacia lo remoto. Si se
     ramifica, se toma la continuación más larga y se avisa (simplificación Fase 1). */
  const enTronco = new Set<number>();
  const tronco: { t: TrazoDib; bajaEsA: boolean }[] = []; // orden derivación → remoto
  let punto: Punto = pDer;
  for (;;) {
    let mejor: TrazoDib | null = null;
    let mejorBajaEsA = false;
    for (const t of trazos) {
      if (t.roci > 0 || enTronco.has(t.orden)) continue;
      const tocaA = Math.hypot(t.a.x - punto.x, t.a.y - punto.y) < TOL_PUNTO;
      const tocaB = Math.hypot(t.b.x - punto.x, t.b.y - punto.y) < TOL_PUNTO;
      if (!tocaA && !tocaB) continue;
      if (!mejor || t.L > mejor.L) {
        mejor = t;
        mejorBajaEsA = tocaA;
      }
    }
    if (!mejor) break;
    enTronco.add(mejor.orden);
    /* `punto` era el extremo de DERIVACIÓN del trazo; el remoto es el opuesto. */
    tronco.push({ t: mejor, bajaEsA: mejorBajaEsA });
    punto = mejorBajaEsA ? mejor.b : mejor.a;
  }
  tronco.reverse(); // orden remoto → derivación
  const totalTronco = tronco.reduce((s, x) => s + x.t.L, 0);
  let acum = 0;
  const troncoPos: TramoTronco[] = tronco.map((x) => {
    const pos = { t: x.t, o: acum, fin: acum + x.t.L, remotoEsA: !x.bajaEsA };
    acum += x.t.L;
    return pos;
  });

  /* Apeaduras de ramales: cada ramal se conecta donde su punta más cercana toca el tronco o el
     montante; si toca otro ramal ya conectado (cadena), hereda su nudo. Pasadas hasta punto
     fijo: los eslabones lejanos entran cuando su vecino ya está conectado. */
  const conexiones = new Map<number, { pos: number; punto: Punto }>();
  /* m/px del doc (tolerancia de paralelos copia pura: su separación en px sale de aquí). */
  const mPorPx = factorMPorPx(num((doc as { scaleM?: unknown }).scaleM) || 0.5);
  let quedan = true;
  while (quedan) {
    quedan = false;
    for (const t of trazos) {
      if (t.roci === 0 || conexiones.has(t.orden)) continue;
      const mejor = mejorConexion(t, troncoPos, posMont, totalTronco, trazos, conexiones, mPorPx);
      if (mejor) {
        conexiones.set(t.orden, mejor);
        quedan = true;
      }
    }
  }
  /* Avisos CONTADOS (ped. usuario: la captura mostraba 2 líneas idénticas): un solo aviso con
     el n.º de ramales excluidos y la salida práctica (paralelos nacen conectados; un ramal
     manual debe tocar la red con su extremo). */
  const sueltos = trazos.filter((t) => t.roci > 0 && !conexiones.has(t.orden));
  if (sueltos.length > 0) {
    avisos.push({
      piso: piso.label,
      msg: `${sueltos.length} ramal(es) con rociadores no tocan la red y NO entran al cálculo: sus extremos deben tocar el montante, el tronco u otro ramal ya conectado. Los paralelos de «Dibujar ramales paralelos» nacen conectados; si lo dibujó a mano, arrastre su extremo hasta la red.`,
    });
  }
  if (conexiones.size === 0) {
    avisos.push({
      piso: piso.label,
      msg: 'El tronco no recibe ningún ramal con rociadores: la red no se exporta.',
    });
    return { ...vacio, gabinetes };
  }

  /* Nudos: clústeres de conexiones por posición (m a lo largo del tronco). Los que caen sobre
     la derivación (± GAP_NUDO) SON la derivación: su letra es la última. */
  const porPos = [...conexiones.entries()]
    .map(([orden, c]) => ({ orden, pos: c.pos }))
    .sort((x, y) => x.pos - y.pos || x.orden - y.orden);
  const nudos: { pos: number; letra: string; ramales: number[] }[] = [];
  const ramalesDeriv: number[] = [];
  for (const c of porPos) {
    if (totalTronco - c.pos < GAP_NUDO) {
      ramalesDeriv.push(c.orden);
      continue;
    }
    const ultimo = nudos[nudos.length - 1];
    if (ultimo && c.pos - ultimo.pos < GAP_NUDO) ultimo.ramales.push(c.orden);
    else nudos.push({ pos: c.pos, letra: letraNudo(nudos.length), ramales: [c.orden] });
  }
  const letraDeriv = letraNudo(nudos.length);
  const conDe = new Map<number, string>();
  for (const n of nudos) for (const r of n.ramales) conDe.set(r, n.letra);
  for (const r of ramalesDeriv) conDe.set(r, letraDeriv);
  const letrasDePos = new Map<string, string>();
  for (const n of nudos) letrasDePos.set(n.pos.toFixed(4), n.letra);
  letrasDePos.set(totalTronco.toFixed(4), letraDeriv);

  /* TRAMOS ENTRE NUDOS trazados a mano (doctrina del HTML 2511/2628: «trace los tramos de nudo
   * a nudo»; «si un ramal alimenta a otro a mitad, el pedazo que lleva los dos caudales es un
   * tramo»): un trazo SIN rociadores que conecta DOS elementos de la red (montante, tronco,
   * ramal ya conectado u otro conector) se exporta como FILA T con letra de nudo en cada
   * contacto — letra existente si cae en un nudo, NUEVA (y el tronco se corta ahí) si no.
   * El puente entre dos elementos que ya comparten nudo (A→A) es redundante: fuera, sin aviso. */
  const conectores: { t: TrazoDib; de: string; a: string }[] = [];
  const enConector = new Set<number>();
  const letraDeContacto = (p: Punto): string | null => {
    if (Math.hypot(p.x - posMont.x, p.y - posMont.y) < TOL_BAJANTE) return letraDeriv;
    /* Tronco: el trazo con contacto MÁS CERCANO gana (los extremos compartidos del tronco
     * podrían matchear dos piezas). */
    let mejorTronco: { pos: number; d: number } | null = null;
    for (const x of troncoPos) {
      const mc = masCercanoEnPolilinea(p, x.t.el.pts || []);
      if (mc.dist < TOL_BAJANTE && (!mejorTronco || mc.dist < mejorTronco.d))
        mejorTronco = { pos: x.o + (x.remotoEsA ? mc.frac : 1 - mc.frac) * x.t.L, d: mc.dist };
    }
    if (mejorTronco) {
      const pos = mejorTronco.pos;
      const cerca = nudos.find((n) => Math.abs(n.pos - pos) < GAP_NUDO);
      if (cerca) return cerca.letra;
      if (totalTronco - pos < GAP_NUDO) return letraDeriv;
      const nueva = {
        pos,
        letra: letraNudo(baseNudos + 1 + nuevosNudos++),
        ramales: [] as number[],
      };
      nudos.push(nueva);
      letrasDePos.set(pos.toFixed(4), nueva.letra);
      return nueva.letra;
    }
    /* Ramal conectado: contacto/proximidad — se elige el MÁS CERCANO de todos (la tolerancia
     * por longitud de un ramal paralelo puede abarcar a su vecino: sin "primero que matchea"
     * el extremo del conector resolvería al ramal equivocado). */
    let mejorRamal: { letra: string; d: number } | null = null;
    for (const t of trazos) {
      if (t.roci === 0 || !conexiones.has(t.orden)) continue;
      const mc = masCercanoEnPolilinea(p, t.el.pts || []);
      const d = Math.max(TOL_PUNTO, (t.L || 0) / mPorPx);
      if (mc.dist < d && (!mejorRamal || mc.dist < mejorRamal.d))
        mejorRamal = { letra: conDe.get(t.orden) || '', d: mc.dist };
    }
    if (mejorRamal) return mejorRamal.letra || null;
    for (const c of conectores) {
      if (Math.hypot(p.x - c.t.a.x, p.y - c.t.a.y) < TOL_PUNTO) return c.de;
      if (Math.hypot(p.x - c.t.b.x, p.y - c.t.b.y) < TOL_PUNTO) return c.a;
    }
    return null;
  };
  let progreso = true;
  /* Letra de un nudo NUEVO creado por un conector: va DESPUÉS de la derivación (que ya tomó
   * letraNudo(baseNudos)) para no chocar con ella. Ej: nudos A,B + deriv C → nuevo = D. */
  const baseNudos = nudos.length;
  let nuevosNudos = 0;
  while (progreso) {
    progreso = false;
    for (const t of trazos) {
      if (t.roci > 0 || enTronco.has(t.orden) || enConector.has(t.orden)) continue;
      const de = letraDeContacto(t.a);
      if (!de) continue;
      const a = letraDeContacto(t.b);
      if (!a || a === de) continue;
      enConector.add(t.orden);
      conectores.push({ t, de, a });
      progreso = true;
    }
  }
  /* Huérfanos reales: trazos sin rociadores fuera del tronco y sin dos contactos de red. */
  const huerfanosT = trazos.filter(
    (t) => t.roci === 0 && !enTronco.has(t.orden) && !enConector.has(t.orden),
  );
  if (huerfanosT.length > 0) {
    avisos.push({
      piso: piso.label,
      msg: `${huerfanosT.length} tramo(s) sin rociadores no conectan la red y no se exportaron: sus extremos deben tocar dos elementos de la red (montante, tronco, ramal o nudo).`,
    });
  }

  /* Piezas de tronco entre posiciones de nudo consecutivas; los accesorios se reparten por su
     posición. La primera pieza (extremo remoto sin nudo) se fusiona con la siguiente: T1 nace
     en el primer nudo y su L absorbe el tramo superior. */
  const cortes: number[] = [0];
  for (const n of nudos) cortes.push(n.pos);
  cortes.push(totalTronco);
  cortes.sort((x, y) => x - y); // los nudos del conector pueden caer a mitad del tronco
  const posiciones: number[] = [];
  for (const c of cortes)
    if (!posiciones.length || c - posiciones[posiciones.length - 1] > 1e-9) posiciones.push(c);

  /* Posición (m en el tronco) de cada accesorio de los trazos del tronco, para repartirlos. */
  const accTronco: { pos: number; tipo: string }[] = [];
  for (const x of troncoPos) {
    const pts = x.t.el.pts || [];
    const totalPx = totalPxDe(pts);
    let lon = 0;
    let iV = 0;
    const ordenados = [...x.t.acc].sort((p, q) => p.idx - q.idx);
    for (const a of ordenados) {
      while (iV < a.idx && iV < pts.length - 1) {
        lon += lonSeg(pts, iV);
        iV++;
      }
      const fracA = lon / totalPx;
      accTronco.push({ pos: x.o + (x.remotoEsA ? fracA : 1 - fracA) * x.t.L, tipo: a.tipo });
    }
  }
  accTronco.sort((p, q) => p.pos - q.pos);

  const piezas: PiezaTronco[] = [];
  const sufijoPorTrazo = new Map<string, number>();
  let ptr = 0;
  for (let i = 0; i < posiciones.length - 1; i++) {
    const posIni = posiciones[i],
      posFin = posiciones[i + 1];
    const accs: { tipo: string }[] = [];
    while (ptr < accTronco.length && accTronco[ptr].pos < posIni - 1e-9) ptr++;
    for (let k = ptr; k < accTronco.length && accTronco[k].pos < posFin - 1e-9; k++)
      accs.push(accTronco[k]);
    const alojFin = troncoQueAloja(troncoPos, posFin, true);
    const alojIni = troncoQueAloja(troncoPos, posIni, false);
    const trazoAncla = (alojIni || alojFin || { t: null }).t;
    if (!trazoAncla) continue;
    const nSuf = (sufijoPorTrazo.get(trazoAncla.id) || 0) + 1;
    sufijoPorTrazo.set(trazoAncla.id, nSuf);
    piezas.push({
      id: nSuf === 1 ? trazoAncla.id : `${trazoAncla.id}#${nSuf}`,
      posIni,
      posFin,
      de: letrasDePos.get(posIni.toFixed(4)) || null,
      a: letrasDePos.get(posFin.toFixed(4)) || letraDeriv,
      c45: contarAcc(accs, RE_CODO45),
      c90: contarAcc(accs, RE_CODO90),
      teeDib: contarAcc(accs, RE_TEE),
      trazoFin: alojFin ? alojFin.t : null,
      idxFin: alojFin ? idxDePos(alojFin, posFin) : 0,
    });
  }
  const piezasUtiles = piezas.filter((p) => p.de !== null);
  if (piezasUtiles.length && piezas.length && piezasUtiles[0] !== piezas[0]) {
    piezasUtiles[0].posIni = piezas[0].posIni;
    piezasUtiles[0].c45 += piezas[0].c45;
    piezasUtiles[0].c90 += piezas[0].c90;
    piezasUtiles[0].teeDib += piezas[0].teeDib;
  }

  const altDeriv = leerAltDeriv(montDer) ?? ALT_DERIV_DEF;

  /* Filas de ramales: orden remoto primero (posición del apeadero ASC, desempate orden de dibujo). */
  const ordenados = trazos
    .filter((t) => t.roci > 0 && conDe.has(t.orden))
    .sort(
      (x, y) =>
        (conexiones.get(x.orden)?.pos ?? 0) - (conexiones.get(y.orden)?.pos ?? 0) ||
        x.orden - y.orden,
    );
  const ramalesRows: TuberiaRow[] = [];
  let iR = 0;
  for (const t of ordenados) {
    const con = conDe.get(t.orden) || '';
    const conecta = conexiones.get(t.orden)!;
    const dA = Math.hypot(t.a.x - conecta.punto.x, t.a.y - conecta.punto.y);
    const dB = Math.hypot(t.b.x - conecta.punto.x, t.b.y - conecta.punto.y);
    const esB = dB <= dA;
    const pts = t.el.pts || [];
    const idxCon = esB ? pts.length - 1 : 0;
    const esLlegada = con === letraDeriv;
    const bajada = esLlegada ? Math.max(0, techo - altDeriv) : 0;
    /* Tee: las dibujadas cuentan; si el flujo gira en el nudo y no hay tee dibujada ahí, 1 auto. */
    const dirEnt = esB
      ? {
          x: pts[pts.length - 1][0] - pts[pts.length - 2][0],
          y: pts[pts.length - 1][1] - pts[pts.length - 2][1],
        }
      : { x: pts[0][0] - pts[1][0], y: pts[0][1] - pts[1][1] };
    const dirSal = dirSalidaTronco(troncoPos, conecta.pos);
    const gira =
      !esLlegada && !!dirSal && anguloEntre(dirEnt.x, dirEnt.y, dirSal.x, dirSal.y) > UMBRAL_GIRO;
    const fila: TuberiaRow = {
      nombre: `R${++iR}`,
      ini: '',
      dib: t.roci,
      fluyen: '',
      mat: t.mat,
      dn: t.dn || 'auto',
      S: '',
      Lr: t.L + bajada,
      c45: contarAcc(t.acc, RE_CODO45),
      c90: contarAcc(t.acc, RE_CODO90) + (esLlegada ? (codoEnVertice(t.acc, idxCon) ? 1 : 2) : 0),
      tee: contarAcc(t.acc, RE_TEE) + (gira && teesEnVertice(t.acc, idxCon) === 0 ? 1 : 0),
      mar: '',
      comp: '',
      ret: '',
      esp: '',
      leqOtros: '',
      zr: '',
      con,
      id: t.id,
    };
    if (esLlegada) {
      fila.desgPlanta = t.L;
      fila.desgBajada = bajada;
    }
    ramalesRows.push(fila);
  }

  /* Filas de tramos: piezas en orden remoto → derivación; la que llega a la derivación carga
     la bajada (techo − altDeriv) y sus 2 codos (o 1 si el quiebre de planta ya está dibujado). */
  const tramosRows: TuberiaRow[] = [];
  let iT = 0;
  for (const p of piezasUtiles) {
    const esLlegada = p.a === letraDeriv;
    const bajada = esLlegada ? Math.max(0, techo - altDeriv) : 0;
    const planta = p.posFin - p.posIni;
    /* Tee del tramo ENTRANTE al nudo p.a: si su flujo gira y no hay tee dibujada ahí, 1 auto. */
    let tee = p.teeDib;
    if (!esLlegada && p.trazoFin) {
      const pts = p.trazoFin.el.pts || [];
      const dirEnt =
        p.idxFin >= 1
          ? {
              x: pts[p.idxFin][0] - pts[p.idxFin - 1][0],
              y: pts[p.idxFin][1] - pts[p.idxFin - 1][1],
            }
          : { x: pts[0][0] - pts[1][0], y: pts[0][1] - pts[1][1] };
      const dirSal = dirSalidaTronco(troncoPos, p.posFin);
      if (
        dirSal &&
        anguloEntre(dirEnt.x, dirEnt.y, dirSal.x, dirSal.y) > UMBRAL_GIRO &&
        teesEnVertice(p.trazoFin.acc, p.idxFin) === 0
      ) {
        tee += 1;
      }
    }
    const fila: TuberiaRow = {
      nombre: `T${++iT}`,
      de: p.de || '',
      a: p.a,
      mat: p.trazoFin?.mat || '',
      dn: p.trazoFin?.dn || 'auto',
      L: planta + bajada,
      c45: p.c45,
      c90:
        p.c90 + (esLlegada && p.trazoFin ? (codoEnVertice(p.trazoFin.acc, p.idxFin) ? 1 : 2) : 0),
      tee,
      mar: '',
      comp: '',
      ret: '',
      esp: '',
      leqOtros: '',
      id: p.id,
      desgPlanta: planta,
    };
    if (esLlegada) fila.desgBajada = bajada;
    tramosRows.push(fila);
  }
  /* Filas T de los CONECTORES trazados a mano (doctrina: son tramos). Después de las piezas
   * del tronco; iT continúa la numeración. desgPlanta = L completa (no llegan a la derivación). */
  for (const c of conectores) {
    tramosRows.push({
      nombre: `T${++iT}`,
      de: c.de,
      a: c.a,
      mat: c.t.mat,
      dn: c.t.dn || 'auto',
      L: c.t.L,
      c45: contarAcc(c.t.acc, RE_CODO45),
      c90: contarAcc(c.t.acc, RE_CODO90),
      tee: contarAcc(c.t.acc, RE_TEE),
      mar: '',
      comp: '',
      ret: '',
      esp: '',
      leqOtros: '',
      id: c.t.id,
      desgPlanta: c.t.L,
    });
  }
  if (piezasUtiles.length === 0 && tronco.length > 0) {
    avisos.push({
      piso: piso.label,
      msg: 'Ningún ramal conecta a lo largo del tronco (solo en la derivación): el tronco no se exporta.',
    });
  }

  const nodos: Record<string, { z: number | string }> = {};
  for (const n of nudos) nodos[n.letra] = { z: '' };
  nodos[letraDeriv] = { z: altDeriv };

  return {
    red: {
      raiz: letraDeriv,
      mat: '',
      zRam: techo,
      nodos,
      ramales: ramalesRows,
      tramos: tramosRows,
    },
    idMont: String(montDer.id),
    nombreMont: montDer.code || 'Montante RCI',
    matMont: leerMaterial(montDer),
    dnMont: leerDn(montDer),
    altDeriv: leerAltDeriv(montDer),
    gabinetes,
  };
}
