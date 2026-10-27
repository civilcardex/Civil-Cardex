import { splitPtr } from './keys.ts';
import { readSanDrawingSync, readHydroDrawingSync } from './drawingSync.ts';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { diamPulgFromLabel } from './diamInchesFromLabel.ts';
import { countKey } from './keys.ts';
import { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys.ts';
import { loadFromStorage, loadPlanTrazos, savePlanTrazos } from '../services/storageService.ts';
import { pisoLbl, pisoCorto } from '../constants';
// ponytail: loadPlanTrazos kept for lazy write-back only — read path uses plane.bajantes/ramales directly to avoid second JSON.parse per plane
import type { Tramo } from '../context/tramosReducer';

/** Aparatos heredados de un montante: el libro de herencia que la asociación entre pisos
 *  deja en el montante de destino (`ucAplicado`). Se toma el MÁXimo por aparato (no la suma):
 *  el libro tiene una entrada por pieza que recibió la carga (el Ldesvio y los ramales del
 *  destino) y todas llevan la MISMA — sumarlas las contaría varias veces.
 *  Ej: un montante con 2 inodoros y 1 lavamanos heredados de arriba -> { ino: 2, lvm: 1 }. */
export function heredadoDeMontante(b: {
  origenId?: string | null;
  descargaEnId?: string | null;
  ucAplicado?: Record<string, Record<string, number>>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Object.values(b.ucAplicado || {}))
    for (const [k, v] of Object.entries(m)) out[k] = Math.max(out[k] || 0, Number(v) || 0);
  return out;
}

interface DrawingRamal {
  id: string;
  label?: string;
  ini?: string;
  fin?: string;
  pts?: number[][];
  piso?: number | string;
  tipo?: string;
  net?: string;
  _net?: string;
  diametro?: string;
  diamPulg?: number;
  material?: string;
  totalL?: number;
  nSalidas?: number;
  lvert?: string | number;
  dz?: string | number;
  _aparatosKey?: string;
  padre?: string | null;
  caudal?: number;
  maning?: number;
  pendiente?: number;
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  descargaEnId?: string | null;
  recibeDeIds?: string[];
  esCanalId?: string | null;
}

interface DrawingBajante {
  id: string;
  code?: string;
  tipo?: string;
  net?: string;
  _net?: string;
  x: number;
  y: number;
  piso?: number | string;
  pisoBase?: string | number;
  pisoCima?: string | number;
  desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  recibeDeIds?: string[];
  ini?: string;
  fin?: string;
  capacidad?: string;
  diamPulg?: number;
  area_m2?: number;
  nSalidas?: number;
  bajR?: number;
  bajLong?: number;
  bajFDarcy?: number;
  ventDprop?: number;
  maning?: number;
  descargaEnId?: string | null;
  /** Enlace con otro piso: el montante es el destino de una asociación entre pisos. */
  origenId?: string | null;
  /** Libro de herencia (lo que el piso de arriba dejó aplicado en este montante). */
  ucAplicado?: Record<string, Record<string, number>>;
  _aparatosKey?: string;
}

interface DrawingPlane {
  planoId?: string | number;
  ramales?: DrawingRamal[];
  bajantes?: DrawingBajante[];
}

interface HidroEntry {
  accesorios?: Record<string, number>;
  Lh?: number;
  dNominal?: string | number;
  material?: string;
  nSalidas?: number;
}

/** Convierte el dibujo en tramos de af (Agua Fria)/ac (Agua Caliente), detectando solo si hay contador o calentador en los extremos (lo demás lo calculan las tablas).
 *  @param family - familia ('af' o 'ac').
 *  @param planes - planos por `family_level`.
 *  @param hidroData - accesorios hidro por clave.
 *  @param aparatos - conteos por clave.
 *  @returns tramos de la familia. */
export function buildTramos(
  family: string,
  planes: Record<string, DrawingPlane>,
  hidroData: Record<string, HidroEntry>,
  aparatos: Record<string, Record<string, number>>,
) {
  const incoming: Tramo[] = [];

  for (const [key, plane] of Object.entries(planes)) {
    if (!key.startsWith(family + '_')) continue;
    const nivel = parseInt(key.slice(family.length + 1));
    const planId = plane.planoId || '';
    // ponytail: eliminate second loadPlanTrazos+JSON.parse per plane — plane already carries filtered ramales/bajantes from drawingSync
    const drawingBajantes: DrawingBajante[] = (plane.bajantes || []) as DrawingBajante[];

    for (const r of plane.ramales || []) {
      const rId = r.id;
      if (isLdesvioRamalId(rId)) continue;
      let ini = String(r.ini || '');
      let fin = String(r.fin || '');

      if ((family === 'af' || family === 'ac') && drawingBajantes.length > 0) {
        const pts = r.pts || [];
        if (pts.length >= 2) {
          const pStart = pts[0];
          const pEnd = pts[pts.length - 1];
          const floorNum = typeof r.piso === 'number' ? r.piso : parseInt(String(r.piso || nivel));
          const lvlLabel = pisoLbl(floorNum);

          const findConnectedBajante = (pt: number[]) => {
            for (const b of drawingBajantes) {
              const disp = b.desplazamientos?.[lvlLabel] || {};
              const bx = b.x + (disp.dx || 0);
              const by = b.y + (disp.dy || 0);
              const isExplicit =
                b.recibeDeIds &&
                (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
              const dist = Math.hypot(pt[0] - bx, pt[1] - by);
              if (isExplicit) {
                const otherPt = pt === pStart ? pEnd : pStart;
                const otherDist = Math.hypot(otherPt[0] - bx, otherPt[1] - by);
                if (dist < otherDist) return b;
              } else if (dist < 2.0) {
                return b;
              }
            }
            return null;
          };

          const bStart = findConnectedBajante(pStart);
          const bEnd = findConnectedBajante(pEnd);

          let newIni = r.ini || '';
          let newFin = r.fin || '';

          if (bStart && bEnd) {
            const isStartCont = bStart.tipo === 'contador';
            const isStartMon = bStart.tipo === 'montante';
            const isEndCont = bEnd.tipo === 'contador';
            const isEndMon = bEnd.tipo === 'montante';

            if ((isStartCont && isEndMon) || (isStartMon && isEndCont)) {
              const cont = isStartCont ? bStart : bEnd;
              const mon = isStartMon ? bStart : bEnd;
              newIni = cont.code || cont.id;
              newFin = mon.code || mon.id;
            } else {
              newIni = bStart.code || bStart.id;
              newFin = bEnd.code || bEnd.id;
            }
          } else {
            if (bStart) {
              newIni = bStart.code || bStart.id;
            }
            if (bEnd) {
              newFin = bEnd.code || bEnd.id;
            }
          }

          if (r.ini !== newIni || r.fin !== newFin) {
            r.ini = newIni;
            r.fin = newFin;
            // ponytail: lazy write-back — load full trazos only when correction needed, keep read path free of JSON.parse
            const raw = loadPlanTrazos(String(planId));
            if (raw) {
              let full = raw as unknown as {
                ramales?: DrawingRamal[];
                bajantes?: DrawingBajante[];
              };
              if (typeof full === 'string') {
                try {
                  full = JSON.parse(full as unknown as string);
                } catch {
                  full = null as unknown as typeof full;
                }
              }
              if (full?.ramales) {
                for (const dr of full.ramales) {
                  if (dr.id === r.id) {
                    dr.ini = newIni;
                    dr.fin = newFin;
                    break;
                  }
                }
                savePlanTrazos(String(planId), full);
              }
            }
          }
          ini = newIni;
          fin = newFin;
        }
      }

      const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

      const isAC1 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
        if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B'))
          return true;
        return false;
      })();
      const isAC2 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
        if (isContador(ini)) return true;
        if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
        return false;
      })();

      // Leer SIEMPRE la clave propia de este ramal — FixturesPanel escribe fixtures/hidroData
      // anclados a la clave del elemento seleccionado (storageKey = `${net}_${targetId}_${planId}`).
      // Re-mapear la clave de un ramal isAC1 a la del contador aquí hacía leer silenciosamente
      // cualquier dato perdido bajo `af_${cntId}_${planId}` en vez de sus fixtures asignados
      // (UD fantasma).
      const apKey = r._aparatosKey || countKey(family, r.id, planId);
      // Un stub de calentador persistido (AC-01-{calId}, escrito por saveTrazosToDB para que los
      // fixtures del bajante CALENTn sobrevivan) lee su propia clave `ac_AC-01-<calId>_<planId>`
      // del sync, pero el espejo de FixturesPanel pone los conteos bajo `ac_<calId>_<planId>` —
      // fusionar ambos.
      let fixturesMap = aparatos[apKey] || {};
      if (family === 'ac' && r.id.startsWith('AC-01-')) {
        const calId = r.id.slice('AC-01-'.length);
        fixturesMap = {
          ...(aparatos[countKey('af', calId, planId)] || {}),
          ...(aparatos[countKey('ac', calId, planId)] || {}),
          ...fixturesMap,
        };
      }
      const extra = hidroData[apKey] || {};
      const dznSalidas = r.nSalidas || 1;
      const dzLvert = Number(r.lvert ?? r.dz ?? 0);
      incoming.push({
        _key: `${rId}-${planId}`,
        id: rId,
        label: r.label || r.id,
        piso: nivel,
        planId: String(planId),
        _net: r._net || family,
        tipo: r.tipo || 'ramal',
        esBajante: false,
        fixtures: fixturesMap,
        _aparatosKey: apKey,
        accesorios: extra.accesorios || {},
        Lh: extra.Lh || 0,
        Lv: family === 'ac' && (isAC1 || isAC2) ? 0 : dzLvert,
        nSalidas: dznSalidas,
        recibeDe: [],
        descripcion: '',
        ini: ini,
        fin: fin,
        diamDisPulg: diamPulgFromLabel(r.diametro || '') || r.diamPulg || 0,
        diametroOriginal: r.diametro || '',
        material: r.material || '',
        totalL: r.totalL || 0,
        padre: r.padre ?? null,
        _nivelLabel: pisoLbl(
          typeof r.piso === 'number' ? r.piso : parseInt(String(r.piso || nivel)),
        ),
      });
    }

    // Montantes af/ac como filas esBajante (orig. usuario): aparecen en Cálculo UC con
    // todos sus aparatos asociados.
    if (family === 'af' || family === 'ac') {
      for (const b of drawingBajantes) {
        if (b.tipo !== 'montante') continue;
        const apKey =
          (b as unknown as { _aparatosKey?: string })._aparatosKey ||
          countKey(family, b.id, planId);
        // Espejo display (réplica sanitaria): propios + ramales asociados por ini/fin
        // (mains, no tributarios — su carga ya vive plegada en el padre). La Σ vertical
        // usa `fixtures` (propios), así el espejo nunca duplica.
        const propios = aparatos[apKey] || {};
        const codigos = new Set([b.code || '', b.id]);
        // Montante ASOCIADO a otro piso: el LIBRO de herencia es la única fuente (misma
        // doctrina del espejo sanitario: libro si lo hay, si no el agregado del árbol).
        // Sumar además los ramales que lo tocan cuenta DOS veces la misma carga — el ramo
        // que lo alimenta ya la trae — y el montante de destino quedaba con el doble de UC
        // (orig. usuario: el montante debe quedar con los MISMOS aparatos que el de arriba).
        const libro = b.origenId || b.descargaEnId ? heredadoDeMontante(b) : {};
        const agg: Record<string, number> = { ...propios };
        for (const t of incoming) {
          if (Object.keys(libro).length) break;
          if (t.tipo === 'tributario' || t.esBajante) continue;
          const toca =
            (typeof t.ini === 'string' && codigos.has(t.ini)) ||
            (typeof t.fin === 'string' && codigos.has(t.fin));
          if (!toca) continue;
          for (const [k, v] of Object.entries(t.fixtures || {})) agg[k] = (agg[k] || 0) + v;
        }
        // El libro manda: son los aparatos que el piso de arriba dejó en este montante.
        if (Object.keys(libro).length) {
          for (const k of Object.keys(agg)) delete agg[k];
          Object.assign(agg, libro);
        }
        incoming.push({
          fixturesAgg: agg,
          _key: `${b.id}-${planId}`,
          id: b.id,
          label:
            (b as unknown as { label?: string }).label ||
            (b as unknown as { code?: string }).code ||
            b.id,
          piso: nivel,
          planId: String(planId),
          _net: family,
          tipo: 'montante',
          esBajante: true,
          _aparatosKey: apKey,
          fixtures: aparatos[apKey] || {},
          recibeDe: [],
          descripcion: '',
        } as unknown as Tramo);
      }
    }

    if (family === 'af') {
      const contadores = drawingBajantes.filter(
        (b) => b.tipo === 'contador' && (b.net === 'af' || !b.net),
      );
      // Índice de los finales de entrada que VIENEN de una acometida RP: el .some por cada
      // contador era O(contadores × incoming) — con el índice es O(1) por contador.
      // Se actualiza al añadir los ramalesacademy que se crean aquí (su `ini` es 'RP').
      const finesDesdeRP = new Set<string>(
        incoming
          .filter((r) => ((r.ini as string) || '').startsWith('RP') || r.ini === 'RP')
          .map((r) => r.fin as string),
      );
      for (const cnt of contadores) {
        const cntId = cnt.code || cnt.id;
        const hasAC1 = finesDesdeRP.has(cntId);
        if (!hasAC1) {
          const rId = `AC-01-${cntId}`;
          const apKey = countKey('af', cntId, planId);
          const extra = hidroData[apKey] || {};
          const pisoCnt =
            typeof cnt.piso === 'number' ? cnt.piso : parseInt(String(cnt.pisoBase || nivel));
          incoming.push({
            _key: `${rId}-${planId}`,
            id: rId,
            piso: isNaN(pisoCnt) ? nivel : pisoCnt,
            planId: String(planId),
            _net: 'af',
            tipo: 'ramal',
            esBajante: false,
            _aparatosKey: apKey,
            fixtures: aparatos[apKey] || {},
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0,
            Lv: 0,
            nSalidas: 1,
            recibeDe: [],
            descripcion: '',
            ini: 'RP',
            fin: cntId,
            diamDisPulg: extra.dNominal ? diamPulgFromLabel(String(extra.dNominal)) : 0,
            diametroOriginal: extra.dNominal ? String(extra.dNominal) : '',
            material: extra.material || '',
            totalL: 0,
            _nivelLabel: pisoLbl(isNaN(pisoCnt) ? nivel : pisoCnt),
          });
          // El ramal recién creado es una acometida RP: su final queda "ocupado" para el
          // siguiente contador (mismo criterio que el .some que esto reemplaza).
          finesDesdeRP.add(cntId);
        }
      }
    } else if (family === 'ac') {
      const calentadores = drawingBajantes.filter(
        (b) => b.tipo === 'calentador' && (b.net === 'ac' || !b.net),
      );
      // Mismo índice para AC: finales de entrada que vienen de un ramal con `ini` = 'AF'.
      const finesDesdeAF = new Set<string>(
        incoming.filter((r) => r.ini === 'AF').map((r) => r.fin as string),
      );
      for (const cal of calentadores) {
        const calId = cal.code || cal.id;
        const hasAC1 = finesDesdeAF.has(calId);
        if (!hasAC1) {
          const rId = `AC-01-${calId}`;
          const apKey = `ac_${calId}_${planId}`;
          // Los fixtures del calentador pueden haberse escrito bajo la clave AF cuando el usuario
          // los asignó anclado a la red AF (ver la regla netId del calentador en FixturesPanel) —
          // fusionar ambos para que nada ya guardado se pierda.
          const calAfKey = `af_${calId}_${planId}`;
          const extra = { ...(hidroData[calAfKey] || {}), ...(hidroData[apKey] || {}) };
          const pisoCal =
            typeof cal.piso === 'number' ? cal.piso : parseInt(String(cal.pisoBase || nivel));
          incoming.push({
            _key: `${rId}-${planId}`,
            id: rId,
            piso: isNaN(pisoCal) ? nivel : pisoCal,
            planId: String(planId),
            _net: 'ac',
            tipo: 'ramal',
            esBajante: false,
            _aparatosKey: apKey,
            fixtures: { ...(aparatos[calAfKey] || {}), ...(aparatos[apKey] || {}) },
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0,
            Lv: 0,
            nSalidas: 1,
            recibeDe: [],
            descripcion: '',
            ini: 'AF',
            fin: calId,
            diamDisPulg: extra.dNominal ? diamPulgFromLabel(String(extra.dNominal)) : 0,
            diametroOriginal: extra.dNominal ? String(extra.dNominal) : '',
            material: extra.material || '',
            totalL: 0,
            _nivelLabel: pisoLbl(isNaN(pisoCal) ? nivel : pisoCal),
            calCapacidad: cal.capacidad || '',
          });
          // El ramal recién creado entra por 'AF': su final queda ocupado para el siguiente
          // calentador (mismo criterio que el .some que esto reemplaza).
          finesDesdeAF.add(calId);
        }
      }
    }
  }
  return incoming;
}

/** Lee los tramos de san (Sanitaria) y ll (Lluvias) del dibujo sincronizado (separa lo que descarga de lo que se junta). */
export function loadSanLlTramos() {
  const sync = readSanDrawingSync();
  const planes = sync.planes as unknown as Record<string, DrawingPlane>;
  const hidroData = loadFromStorage<Record<string, HidroEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const sanIncoming: Tramo[] = [];
  const llIncoming: Tramo[] = [];
  const tribIds = new Set<string>();
  for (const [nivel, plane] of Object.entries(planes)) {
    const planId = plane.planoId || nivel;
    for (const r of plane.ramales || []) {
      if (r.tipo === 'tributario') tribIds.add(`${r.id}-${planId}`);
    }
    // Piso desde el VALOR (la clave incluye planId y ya no es parseable como nivel).
    const piso = parseInt(String((plane as { nivel?: string }).nivel ?? nivel));
    const fmtNivel = (v: unknown): string => {
      const n = Number(v);
      if (!isNaN(n)) return pisoCorto(n);
      return String(v ?? '');
    };
    const venRamales = (plane.ramales || []).filter((r) => r._net === 'vent' || r.net === 'vent');
    const venMap = new Map<string, { diametro: string; rId: string; rPlanId: string | number }>();
    for (const vr of venRamales) {
      if (vr.descargaEnId) {
        const parts = splitPtr(vr.descargaEnId, String(planId));
        if (parts[0] === String(planId))
          venMap.set(parts[1], { diametro: vr.diametro || '', rId: vr.id, rPlanId: planId });
      }
    }

    for (const r of plane.ramales || []) {
      if (r._net === 'vent' || r.net === 'vent') continue;
      if (isLdesvioRamalId(r.id)) continue;
      // Ramal de canal (orig. usuario): NO es un ramal de diseño — nace de un canal y su
      // diámetro espeja al bajante asociado. Excluido de las tablas (como el conector
      // automático que reemplaza); su codo 90° baja sí cuenta vía accesorioInicio.
      if (r.esCanalId) continue;
      const apKey = r._aparatosKey || countKey(r._net || 'san', r.id, planId);
      const hd = hidroData[apKey] || {};
      const tramo: Tramo = {
        _key: `${r.id}-${planId}`,
        id: r.id,
        piso,
        planId: String(planId),
        _nivelLabel: fmtNivel(r.piso || nivel),
        _net: r._net || r.net || '',
        tipo: r.tipo || 'ramal',
        _aparatosKey: apKey,
        fixtures:
          (sync.aparatosByTramo as Record<string, Record<string, number>> | undefined)?.[apKey] ||
          {},
        recibeDe: [],
        esBajante: false,
        descripcion: '',
        ini: r.ini || '',
        fin: r.fin || '',
        diamDisPulg: r.diamPulg || 0,
        nSalidas: r.nSalidas || hd.nSalidas || 1,
        totalL: r.totalL || 0,
        nmaning: r.maning ?? 0,
        sPercent: r.pendiente ?? 0,
        bajR: 7 / 24,
        bajLong: 5,
        bajFDarcy: 0.025,
        bajDprop: 0,
        ventDprop: 0,
        ventRamalKey: null,
        label: r.label || r.id,
        diametro: r.diametro || '',
        diamPulg: r.diamPulg || 0,
        accesorioInicio: r.accesorioInicio || '',
        accesorioFin: r.accesorioFin || '',
        diametroInicio: r.diametroInicio || '',
        diametroFin: r.diametroFin || '',
        caudal: r.caudal ?? undefined,
        padre: r.padre ?? null,
        padreTributarioLabel: r.padre
          ? (plane.ramales || []).find((pr) => pr.id === r.padre)?.label || r.padre
          : null,
      };
      if (r._net === 'll') {
        llIncoming.push({ ...tramo, desde: r.ini || '', hasta: r.fin || '' });
      } else {
        sanIncoming.push(tramo);
      }
    }
    for (const b of plane.bajantes || []) {
      // Ventilación y canales no pertenecen a descarga sanitaria
      if (b._net === 'vent' || b.net === 'vent') continue;
      // Los glifos de canal (tipo:'canal') viven en su propia tabla (canalesLlAuto lee
      // drawnCanalGlyphs directo de storage) — excluirlos aquí evita que aparezcan como
      // bajantes en la tabla de chequeo de bajantes de aguas lluvias.
      if (b.tipo === 'canal') continue;
      const apKey = b._aparatosKey || countKey(b._net || 'san', b.id, planId);
      const hd = hidroData[apKey] || {};

      let ventData = venMap.get(b.id);
      if (!ventData) {
        const cVent = venRamales.find(
          (vr) =>
            vr.ini === b.id || vr.fin === b.id || (b.recibeDeIds && b.recibeDeIds.includes(vr.id)),
        );
        if (cVent) ventData = { diametro: cVent.diametro || '', rId: cVent.id, rPlanId: planId };
      }

      const ventRamalDiam = ventData && ventData.diametro ? parseFloat(ventData.diametro) : 0;
      const ventRamalKey = ventData ? `${ventData.rId}-${ventData.rPlanId}` : null;
      const tramo: Tramo = {
        _key: `${b.id}-${planId}`,
        id: b.id,
        piso,
        planId: String(planId),
        _nivelLabel: fmtNivel(b.piso || nivel),
        _net: b._net || b.net || '',
        tipo: 'bajante',
        _aparatosKey: apKey,
        fixtures:
          (sync.aparatosByTramo as Record<string, Record<string, number>> | undefined)?.[apKey] ||
          {},
        recibeDe: [],
        esBajante: true,
        descripcion: '',
        diamDisPulg: b.diamPulg || 0,
        nSalidas: b.nSalidas || hd.nSalidas || 1,
        nmaning: b.maning ?? 0,
        sPercent: 0,
        bajR: b.bajR ?? 7 / 24,
        bajLong: b.bajLong ?? 5,
        bajFDarcy: b.bajFDarcy ?? 0.025,
        bajDprop: b.diamPulg || 0,
        ventDprop: b.ventDprop ?? 0,
        ventRamalDiamPulg: ventRamalDiam,
        ventRamalKey,
        recibeDeIds: b.recibeDeIds || [],
        descargaEnId: b.descargaEnId || null,
        area_m2: b.area_m2 || 0,
        pisoBase: (b.pisoBase || '') as unknown as number,
        pisoCima: (b.pisoCima || '') as unknown as number,
        code: b.code || b.id,
      };
      if (b._net === 'll') {
        llIncoming.push({ ...tramo, desde: b.ini || '', hasta: b.fin || '' });
      } else {
        sanIncoming.push(tramo);
      }
    }
  }
  return { sanIncoming, llIncoming };
}

/** Lee los tramos de af (Agua Fria)/ac (Agua Caliente) con sus accesorios hidráulicos (usa buildTramos). */
export function loadAfAcTramos() {
  const sync = readHydroDrawingSync();
  const planes = sync.planes as unknown as Record<string, DrawingPlane>;
  const hidroData = (sync.hidroData as Record<string, HidroEntry>) || {};
  const aparatos = (sync.aparatosByTramo as Record<string, Record<string, number>>) || {};

  const afIncoming = buildTramos('af', planes, hidroData, aparatos);
  const acIncoming = buildTramos('ac', planes, hidroData, aparatos);

  return { afIncoming, acIncoming };
}
