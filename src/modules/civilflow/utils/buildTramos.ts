import { readSanDrawingSync, readHydroDrawingSync } from './drawingSync';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import { parseDescargaEnId } from './parseDescargaEnId';
import { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
import { loadFromStorage, loadPlanTrazos, savePlanTrazos } from '../services/storageService';
import { pisoLbl, pisoCorto } from '../constants';
import type { Tramo } from '../context/tramosReducer';

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

/**
 * Construye objetos de tramo para una familia dada (af/ac) a partir de los planos de dibujo,
 * los datos hidro y los conteos de aparatos. Auto-detecta conexiones de contador/calentador en
 * los extremos de ramal y genera ramales de relleno AC-01.
 * @param family - Familia de red: 'af' o 'ac'.
 * @param planes - Planos de dibujo claveados por `family_level`.
 * @param hidroData - Datos de accesorios hidro claveados por `family_elementId_planId`.
 * @param aparatos - Conteos de aparatos claveados por clave de aparatos.
 * @returns Array de objetos Tramo para la familia.
 */
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
    const raw = loadPlanTrazos(String(planId));
    let drawingBajantes: DrawingBajante[] = [];
    let drawingData: { ramales?: DrawingRamal[]; bajantes?: DrawingBajante[] } | null = null;
    if (raw) {
      drawingData = raw as unknown as { ramales?: DrawingRamal[]; bajantes?: DrawingBajante[] };
      if (typeof drawingData === 'string') {
        try {
          drawingData = JSON.parse(drawingData);
        } catch {
          /* ignore */
        }
      }
      drawingBajantes = drawingData?.bajantes || [];
    }

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

            if (drawingData) {
              for (const drawingRamal of drawingData.ramales || []) {
                if (drawingRamal.id === r.id) {
                  drawingRamal.ini = newIni;
                  drawingRamal.fin = newFin;
                  break;
                }
              }
              savePlanTrazos(String(planId), drawingData);
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
      const apKey = r._aparatosKey || `${family}_${r.id}_${planId}`;
      // Un stub de calentador persistido (AC-01-{calId}, escrito por saveTrazosToDB para que los
      // fixtures del bajante CALENTn sobrevivan) lee su propia clave `ac_AC-01-<calId>_<planId>`
      // del sync, pero el espejo de FixturesPanel pone los conteos bajo `ac_<calId>_<planId>` —
      // fusionar ambos.
      let fixturesMap = aparatos[apKey] || {};
      if (family === 'ac' && r.id.startsWith('AC-01-')) {
        const calId = r.id.slice('AC-01-'.length);
        fixturesMap = {
          ...(aparatos[`af_${calId}_${planId}`] || {}),
          ...(aparatos[`ac_${calId}_${planId}`] || {}),
          ...fixturesMap,
        };
      }
      const extra = hidroData[apKey] || {};
      let dznSalidas = r.nSalidas || 1;
      let dzLvert = Number(r.lvert ?? r.dz ?? 0);
      if (drawingData) {
        const dr = (drawingData.ramales || []).find((x) => x.id === r.id);
        if (dr) {
          if (!dznSalidas) dznSalidas = dr.nSalidas || 1;
          if (dzLvert === 0 || dzLvert === undefined)
            dzLvert = parseFloat(String(dr.lvert ?? dr.dz)) || 0;
        }
      }
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
        _nivelLabel: pisoLbl(
          typeof r.piso === 'number' ? r.piso : parseInt(String(r.piso || nivel)),
        ),
      });
    }

    if (family === 'af') {
      const contadores = drawingBajantes.filter(
        (b) => b.tipo === 'contador' && (b.net === 'af' || !b.net),
      );
      for (const cnt of contadores) {
        const cntId = cnt.code || cnt.id;
        const hasAC1 = incoming.some(
          (r) => r.fin === cntId && (((r.ini as string) || '').startsWith('RP') || r.ini === 'RP'),
        );
        if (!hasAC1) {
          const rId = `AC-01-${cntId}`;
          const apKey = `af_${cntId}_${planId}`;
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
        }
      }
    } else if (family === 'ac') {
      const calentadores = drawingBajantes.filter(
        (b) => b.tipo === 'calentador' && (b.net === 'ac' || !b.net),
      );
      for (const cal of calentadores) {
        const calId = cal.code || cal.id;
        const hasAC1 = incoming.some((r) => r.fin === calId && r.ini === 'AF');
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
        }
      }
    }
  }
  return incoming;
}

/**
 * Carga los tramos sanitarios y de aguas lluvias (san/ll) desde los datos de sync de dibujo.
 * Separa en arrays sanIncoming (saneamiento) y llIncoming (aguas lluvias).
 * @returns Objeto con arrays `sanIncoming` y `llIncoming` de objetos Tramo.
 */
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
    const piso = parseInt(nivel);
    const fmtNivel = (v: unknown): string => {
      const n = Number(v);
      if (!isNaN(n)) return pisoCorto(n);
      return String(v ?? '');
    };
    const venRamales = (plane.ramales || []).filter((r) => r._net === 'vent' || r.net === 'vent');
    const venMap = new Map<string, { diametro: string; rId: string; rPlanId: string | number }>();
    for (const vr of venRamales) {
      if (vr.descargaEnId) {
        const parts = parseDescargaEnId(vr.descargaEnId, String(planId));
        if (parts[0] === String(planId))
          venMap.set(parts[1], { diametro: vr.diametro || '', rId: vr.id, rPlanId: planId });
      }
    }

    for (const r of plane.ramales || []) {
      if (r._net === 'vent' || r.net === 'vent') continue;
      if (isLdesvioRamalId(r.id)) continue;
      const apKey = r._aparatosKey || `${r._net || 'san'}_${r.id}_${planId}`;
      const hd = hidroData[apKey] || {};
      const tramo: Tramo = {
        _key: `${r.id}-${planId}`,
        id: r.id,
        piso,
        planId: String(planId),
        _nivelLabel: fmtNivel(r.piso || nivel),
        _net: r._net || r.net || '',
        tipo: r.tipo || 'ramal',
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
      // Los glifos de canal (tipo:'canal') viven en su propia tabla (canalesLlAuto lee
      // drawnCanalGlyphs directo de storage) — excluirlos aquí evita que aparezcan como
      // bajantes en la tabla de chequeo de bajantes de aguas lluvias.
      if (b.tipo === 'canal') continue;
      const apKey = b._aparatosKey || `${b._net || 'san'}_${b.id}_${planId}`;
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

/**
 * Carga los tramos de agua fría (af) y agua caliente (ac) desde los datos de sync de dibujo
 * hidro. Delega en {@link buildTramos} para cada familia.
 * @returns Objeto con arrays `afIncoming` y `acIncoming` de objetos Tramo.
 */
export function loadAfAcTramos() {
  const sync = readHydroDrawingSync();
  const planes = sync.planes as unknown as Record<string, DrawingPlane>;
  const hidroData = (sync.hidroData as Record<string, HidroEntry>) || {};
  const aparatos = (sync.aparatosByTramo as Record<string, Record<string, number>>) || {};

  const afIncoming = buildTramos('af', planes, hidroData, aparatos);
  const acIncoming = buildTramos('ac', planes, hidroData, aparatos);

  return { afIncoming, acIncoming };
}
