import React, { useState, useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF, pisoCorto } from "../constants";
import { calcUCparcial } from "../utils/componentHelpers";
import { COEF_HAZEN, CONTADORES } from "../utils/calcHydraulics";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { calcLeAcces } from "../utils/accesoriosUtils";
import { fmtPulg } from "../utils/formatUtils";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
const fmt = (v: unknown, d = 2) => v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);
import Acometida from "./SupplyConnection";

interface WaterNetworkDesignProps {
  networkType: 'af' | 'ac';
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  lookupFn: (pulg: number) => number;
}

const isAf = (t: string) => t === 'af';

function WaterNetworkDesign({ networkType, diamTable, lookupFn }: WaterNetworkDesignProps) {
  const { tramosAf, tramosAc, updTramoAf, updTramoAc, delTramoAf, delTramoAc } = useTramos();
  const { proy } = useProject();
  const { plans } = usePlans();

  const tramos = isAf(networkType) ? tramosAf : tramosAc;
  const updTramo = isAf(networkType) ? updTramoAf : updTramoAc;
  const delTramo = isAf(networkType) ? delTramoAf : delTramoAc;
  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const C = COEF_HAZEN;
  const cssClass = networkType;
  const colorVar = `var(--${networkType})`;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const title = isAf(networkType) ? 'agua fr\u00EDa' : 'agua caliente';
  const icon = isAf(networkType) ? 'hidraulica/RAF_Diseno.webp' : 'hidraulica/RAC_Diseno.webp';

  const DIAM_OPTS = useMemo(() => {
    return diamTable.map(d => ({ pulg: d.pulg, nominal: d.nominal, label: d.nominal, dInt: d.dInt }));
  }, [diamTable]);

  const [diamIntMap, setDiamIntMap] = useState<Record<string, number>>({});
  const [diamNomMap, setDiamNomMap] = useState<Record<string, string>>({});

  const handleDiamChange = useCallback((tramoId: string, nominal: string) => {
    const opt = DIAM_OPTS.find(o => o.nominal === nominal);
    if (!opt) return;
    const pulg = opt.pulg;
    updTramo(tramoId, 'diamDisPulg', pulg);
    setDiamIntMap(prev => ({ ...prev, [tramoId]: opt.dInt }));
    setDiamNomMap(prev => ({ ...prev, [tramoId]: opt.nominal }));
    writeDiametroToDrawing(tramoId, networkType, opt.label, plans);
  }, [updTramo, DIAM_OPTS, plans, networkType]);

  const handleDelete = useCallback((tramoId: string) => {
    delTramo(tramoId);
    deleteRamalFromDrawing(tramoId, networkType, plans);
  }, [delTramo, plans, networkType]);

  const AP = useMemo(
    () =>
      ucIds.map((id) => {
        const a = APARATOS_DEF.find((x) => x.id === id);
        return a ? { id: a.id, uc: a[ucField] } : null;
      }).filter(Boolean),
    [ucIds, ucField]
  );

  const [presIniEdit, setPresIniEdit] = useState(() => new Map());
  const [presFinEdit, setPresFinEdit] = useState(() => new Map());

  const setPresIni = useCallback((tramoId: string, v: number) => {
    setPresIniEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const setPresFin = useCallback((tramoId: string, v: number) => {
    setPresFinEdit((prev) => {
      const next = new Map(prev);
      next.set(tramoId, v);
      return next;
    });
  }, []);

  const [conexiones, conexionesDisplay, componentTotalMap] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }

      const ramales = (data.ramales || []).filter((r: any) => r.net === networkType);
      const bajantes = (data.bajantes || []).filter((b: any) => b.net === networkType);

      const distToSegment = (p: number[], a: number[], b: number[]) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
        let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      };

      const distToPolyline = (p: number[], pts: number[][]) => {
        let minDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const d = distToSegment(p, pts[i], pts[i + 1]);
          if (d < minDist) minDist = d;
        }
        return minDist;
      };

      for (const r of ramales) {
        if (!r.pts || r.pts.length < 2) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const rKey = `${r.id}-${plan.id}`;

        let connection: { type: 'bajante' | 'ramal'; id: string } | null = null;

        const checkEndpoint = (pt: number[]) => {
          for (const b of bajantes) {
            const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
            const dist = Math.hypot(pt[0] - b.x, pt[1] - b.y);
            if (isExplicit || dist < 2.0) {
              return { type: 'bajante' as const, id: b.id };
            }
          }
          let bestRx: any = null;
          let minDist = Infinity;
          for (const rx of ramales) {
            if (rx.id === r.id) continue;
            if (!rx.pts || rx.pts.length < 2) continue;
            const dist = distToPolyline(pt, rx.pts);
            if (dist < 2.0 && dist < minDist) {
              minDist = dist;
              bestRx = rx;
            }
          }
          if (bestRx) {
            return { type: 'ramal' as const, id: bestRx.id };
          }
          return null;
        };

        connection = checkEndpoint(pEnd) || checkEndpoint(pStart);

        if (connection) {
          const targetKey = `${connection.id}-${plan.id}`;
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          calculoMap[targetKey].push(rKey);
        }
      }
    }

    // Build undirected adjacency list for all tramos
    const adj: Record<string, string[]> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      adj[key] = [];
    }

    for (const [parentKey, children] of Object.entries(calculoMap)) {
      if (!adj[parentKey]) adj[parentKey] = [];
      for (const childKey of children) {
        if (!adj[childKey]) adj[childKey] = [];
        if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
        if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
      }
    }

    // Helper to run BFS to get direct neighbors (excluding startKey, stopping traversal at any main ramal node)
    const getConnectedNeighbors = (startKey: string): string[] => {
      const results = new Set<string>();
      const visited = new Set<string>();
      const queue = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node !== startKey) {
          const tr = tramos.find(x => (x._key || x.id) === node);
          const isMainRamal = tr && tr.tipo !== 'tributario' && !tr.esBajante;
          if (isMainRamal) {
            results.add(node);
            continue; // Stop traversal at this main ramal
          }
        }
        for (const neighbor of adj[node] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      return Array.from(results);
    };

    const displayMap: Record<string, string[]> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      if (t.tipo !== 'tributario' && !t.esBajante) {
        displayMap[key] = getConnectedNeighbors(key);
      }
    }

    // Find connected components in the undirected display graph
    const compVisited = new Set<string>();
    const components: string[][] = [];

    for (const node of Object.keys(displayMap)) {
      if (!compVisited.has(node)) {
        const comp: string[] = [];
        const q = [node];
        compVisited.add(node);
        while (q.length > 0) {
          const curr = q.shift()!;
          comp.push(curr);
          for (const neigh of displayMap[curr] || []) {
            if (!compVisited.has(neigh)) {
              compVisited.add(neigh);
              q.push(neigh);
            }
          }
        }
        components.push(comp);
      }
    }

    const getRootScore = (key: string): number => {
      const parts = key.split('-');
      const id = parts[0];
      const match = id.match(/^([a-zA-Z]+)(\d+)?$/);
      if (!match) return 99999999;
      const prefix = match[1].toUpperCase();
      const num = match[2] ? parseInt(match[2]) : 99999999;
      if (prefix === 'RAF' || prefix === 'RAC' || prefix === 'RS' || prefix === 'RALL') {
        return num; // main inputs have lowest scores
      }
      if (prefix === 'MAF' || prefix === 'MAC' || prefix === 'BAN' || prefix === 'BALL') {
        return num + 1000;
      }
      return num + 1000000;
    };

    const orientedConexiones: Record<string, string[]> = {};
    const orientedVisited = new Set<string>();

    for (const comp of components) {
      let root = comp[0];
      let minScore = getRootScore(root);
      for (const node of comp) {
        const score = getRootScore(node);
        if (score < minScore) {
          minScore = score;
          root = node;
        }
      }

      const q = [root];
      orientedVisited.add(root);
      while (q.length > 0) {
        const parent = q.shift()!;
        if (!orientedConexiones[parent]) orientedConexiones[parent] = [];
        for (const child of displayMap[parent] || []) {
          if (!orientedVisited.has(child)) {
            orientedVisited.add(child);
            orientedConexiones[parent].push(child);
            q.push(child);
          }
        }
      }
    }

    // Compute connected-component totals: each tramo's Total = sum of all tramos in its component
    const tramoById: Record<string, any> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      tramoById[key] = t;
    }
    const parcialMap: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      parcialMap[key] = calcUCparcial(t, AP as any, "uc");
    }
    const componentTotalMap: Record<string, number> = {};
    const compVisited2 = new Set<string>();
    for (const t of tramos) {
      const startKey = t._key || t.id;
      if (compVisited2.has(startKey)) continue;
      // BFS to find all nodes in this connected component
      const comp: string[] = [];
      const q = [startKey];
      compVisited2.add(startKey);
      while (q.length > 0) {
        const cur = q.shift()!;
        comp.push(cur);
        for (const nb of adj[cur] || []) {
          if (!compVisited2.has(nb) && tramoById[nb]) {
            compVisited2.add(nb);
            q.push(nb);
          }
        }
      }
      const compTotal = comp.reduce((s, k) => s + (parcialMap[k] || 0), 0);
      for (const k of comp) componentTotalMap[k] = compTotal;
    }

    return [orientedConexiones, displayMap, componentTotalMap] as const;
  }, [plans, tramos, networkType]);

  const propiaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      m[key] = calcUCparcial(t, AP as any, "uc");
    }
    return m;
  }, [tramos, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () => tramos.filter(t => t.tipo !== 'tributario' && !t.esBajante).sort((a, b) => (b.piso || 0) - (a.piso || 0)),
    [tramos]
  );

  const [acoContIx, setAcoContIx] = useState(2);
  const [acoMonName, setAcoMonName] = useState('Mon');
  const [acoRedContDiam, setAcoRedContDiam] = useState(0.75);
  const [acoContMonDiam, setAcoContMonDiam] = useState(1.25);
  const [acoL1, setAcoL1] = useState({ h: 10.00, v: 0.00, le: 0.47 });
  const [acoL2, setAcoL2] = useState({ h: 7.54, v: 0.00, le: 0.00 });
  const [acoPini, setAcoPini] = useState(20.00);
  const [acoLeMed, setAcoLeMed] = useState(0);

  const contadorSel = CONTADORES[acoContIx] || CONTADORES[0];

  const ucTotal = useMemo(() => {
    let s = 0;
    for (const t of tramos) {
      const key = t._key || t.id;
      s += (propiaMap[key] || 0) as number;
    }
    return s;
  }, [tramos, propiaMap]);

  const Qaco = useMemo(() => ucTotal > 0
    ? Math.round((0.1163 * Math.pow(ucTotal, 0.6875)) * 1000) / 1000
    : 0, [ucTotal]);
  const sqrtQaco = useMemo(() => Qaco > 0 ? Math.round(Math.sqrt(Qaco) * 100) / 100 : 0, [Qaco]);

  const calcFila = (pulg: number, h: number, v: number, le: number, pIn: number) => {
    const dInt: number = pulg > 0 ? ((diamTable.find(d => Math.abs(d.pulg - pulg) < 0.01) || {}).dInt || 0) : 0;
    const V = Qaco > 0 && dInt > 0
      ? Math.round((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt) * 10) / 10
      : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct = V > 0 && dInt > 0
      ? Math.round(((60.1 * Math.pow(V, 1.852)) / (Math.pow(C, 1.852) * Math.pow(dInt, 1.167))) / 100 * 10000) / 10000
      : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
    const Pfin = +(pIn + (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const acoL1LeTotal = acoL1.le + acoLeMed;
  const f1 = calcFila(acoRedContDiam, acoL1.h, acoL1.v, acoL1LeTotal, acoPini);
  const f2 = calcFila(acoContMonDiam, acoL2.h, acoL2.v, acoL2.le, f1.Pfin);
  const hfContador = Qaco > 0 && contadorSel.qn_lps > 0
    ? Math.round(10 * Math.pow(Qaco / contadorSel.qn_lps, 2) * 100) / 100
    : 0;
  const pResidual = +((f1.Pfin - f2.Pfin).toFixed(2));
  const okPresion = f1.Pfin > f2.Pfin;

  return (
    <>
      <div className="card">
        <div className="card-h">
          <h3 className="card-t"><img src={`/iconos_diseno_redes/${icon}`} alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red {title}</h3>
          <span className="card-s">{tramosOrden.length} tramos</span>
        </div>
        <div className="scroll-top" style={{ padding: "6px" }}>
          <div className="scroll-inner" style={{ minWidth: "max-content" }}>
            <table className="tbl" style={{ fontSize: 11, tableLayout: "auto", width: "100%" }}>
              <caption style={{position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>{`Diseño de red ${title}`}</caption>
              <colgroup>
                <col style={{width:"7%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"8%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"7%"}}/>
                <col style={{width:"4%"}}/>
                <col style={{width:"2.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"4.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"3.5%"}}/>
                <col style={{width:"6%"}}/>
                <col style={{width:"6%"}}/>
                <col style={{width:"2%"}}/>
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Tramo</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>PISO</th>
                  <th scope="col" className={`col-h ${cssClass}`} colSpan={3} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>UND consumo</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>#Desc</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>K</th>
                  <th scope="col" className={`col-h ${cssClass}`} rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Q (l/s)</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>√Q</th>
                  <th scope="col" className="col-h ok" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>DIAMETRO</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>C</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>V mm/s</th>
                  <th scope="col" className="col-h" colSpan={4} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>LONG (m)</th>
                  <th scope="col" className="col-h" colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>Hf</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>ΔZ (m)</th>
                  <th scope="col" className={`col-h ${cssClass}`} colSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9 }}>P final (mca)</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{ textAlign: "center", padding: "2px 1px", fontSize:9, width:14 }}></th>
                </tr>
                <tr>
                  <th scope="col" className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Prop</th>
                  <th scope="col" className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Ramales<br/>asociados</th>
                  <th scope="col" className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Total</th>
                  <th scope="col" className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Diseño</th>
                  <th scope="col" className="col-h ok" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Int mm</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Horizontal</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>V</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Le</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>Tot</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>%</th>
                  <th scope="col" className="col-h" style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>m</th>
                  <th scope="col" className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>INI</th>
                  <th scope="col" className={`col-h ${cssClass}`} style={{ textAlign: "center", padding: "0 1px", fontSize:8 }}>FIN</th>
                </tr>
              </thead>
              <tbody>
                {tramosOrden.length === 0 && (
                  <tr>
                    <td colSpan={23} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                )}
                {tramosOrden.map((t) => {
                  const ownKey = t._key || t.id;
                  const propia = (propiaMap[ownKey] || 0) as number;
                  const total = (componentTotalMap[ownKey] || 0) as number;
                  const nDesc = t.nSalidas || 0;
                  const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
                  const Qprob = total > 0 && K > 0 ? Math.round(K * (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000) / 1000 : 0;
                  const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
                  const disPulg = t.diamDisPulg || 0;
                  const internoMm = diamIntMap[ownKey] || lookupFn(disPulg) || 0;
                  const Vmms = Qprob > 0 && internoMm > 0 ? Math.round((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm) * 10) / 10 : 0;
                  const H = t.totalL || t.Lh || 0;
                  const Vvert = t.Lv || t.deltaZ || 0;
                  const Le = calcLeAcces(t.accesorios ?? {}, disPulg, C);
                  const Lt = H + Vvert + Le;
                  const hfPct = Vmms > 0 && C > 0 && internoMm > 0 ? Math.round(((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(C, 1.852) * Math.pow(internoMm, 1.167))) / 100 * 10000) / 10000 : 0;
                  const hfM = Lt > 0 && hfPct > 0 ? Math.round((Lt * hfPct) / 10 * 100) / 100 : 0;
                  const dZ = Vvert;
                  const PinCalc = pRed;
                  const PfinCalc = PinCalc + dZ - hfM;
                  const Pin = presIniEdit.has(ownKey) ? presIniEdit.get(ownKey) : PinCalc;
                  const Pfin = presFinEdit.has(ownKey) ? presFinEdit.get(ownKey) : PfinCalc;
                  const vCumple = Vmms >= 500 && Vmms <= 2500;
                  return (
                    <tr key={ownKey}>
                      <td className="c" style={{ padding: "0 1px"}}><span className="sigla" style={{fontSize:11, padding:"1px 4px"}}>{t.id}</span></td>
                      <td className="c" style={{padding:"0 1px",color:"var(--txt2)",fontSize:11}}>{pisoCorto(t.piso)}</td>
                      <td className="c td-mono">{fmt(propia,2)}</td>
                      <td className="c" style={{padding:'2px 4px',minWidth:60,maxWidth:120}}>
                        {(() => {
                          const connectedKeys = conexionesDisplay[ownKey] || [];
                          return connectedKeys.length === 0 ? (
                            <span style={{fontSize:9,color:'var(--txt3)'}}>—</span>
                          ) : (
                            <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',alignItems:'center'}}>
                              {connectedKeys.map(childKey => {
                                const parts = childKey.split('-');
                                const rId = parts[0];
                                const childTramo = tramos.find(tr => (tr._key || tr.id) === childKey);
                                const childOwnKey = childTramo?._key || childTramo?.id || childKey;
                                const childTotalUd = (componentTotalMap[childOwnKey] || 0) as number;
                                return (
                                  <span key={childKey}
                                    title={`${rId} (${childTotalUd.toFixed(2)} UC)`}
                                    style={{fontSize:9,padding:'1px 3px',border:`1px solid ${colorVar}`,borderRadius:3,color:colorVar,fontFamily:'var(--mono)',lineHeight:1.3}}>
                                    {rId}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="c td-mono-b">{fmt(total,2)}</td>
                      <td className="c td-mono">{nDesc>0?nDesc:"—"}</td>
                      <td className="c td-mono-b">{K>0?fmt(K,2):"—"}</td>
                      <td className="c td-mono-b">{Qprob>0?fmt(Qprob,2):"—"}</td>
                      <td className="c td-mono">{raizQ>0?fmt(raizQ,2):"—"}</td>
                       <td className="c" style={{padding:"0 1px"}}>
                        <select aria-label="Diámetro diseño" value={diamNomMap[ownKey] || ''} onChange={e=>handleDiamChange(ownKey, e.target.value)}
                          style={{fontSize:10,padding:"0 1px",border:"1px solid var(--line)",borderRadius:1,background:"var(--bg2)",color:"var(--txt)",cursor:"pointer",maxWidth:120}}>
                          <option value="">—</option>
                          {DIAM_OPTS.map(o=><option key={o.nominal} value={o.nominal}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="c td-mono">{internoMm>0?fmt(internoMm,2):"—"}</td>
                      <td className="c td-mono">{C}</td>
                      <td className="c" style={{fontWeight:600,padding:"0 1px",fontSize:11,background:Vmms>0&&vCumple?"rgba(34,197,94,.25)":Vmms>0?"rgba(239,68,68,.25)":"transparent"}}>{Vmms>0?fmt(Vmms,2):"—"}</td>
                      <td className="c td-mono">{H>0?fmt(H,2):"—"}</td>
                      <td className="c td-mono">{Vvert>0?fmt(Vvert,2):"—"}</td>
                      <td className="c td-mono">{Le>0?fmt(Le,2):"—"}</td>
                      <td className="c td-mono-b">{Lt>0?fmt(Lt,2):"—"}</td>
                      <td className="c td-mono">{hfPct>0?fmt(hfPct,2):"—"}</td>
                      <td className="c td-mono-b">{hfM>0?fmt(hfM,2):"—"}</td>
                      <td className="c td-mono">{dZ>0?fmt(dZ,2):"—"}</td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" aria-label="Presión inicial" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11}} value={Pin} step={0.1} onChange={e=>setPresIni(ownKey,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><input type="number" aria-label="Presión final" className="ni" style={{width:44,textAlign:"center",padding:0,fontSize:11}} value={Pfin} step={0.1} onChange={e=>setPresFin(ownKey,parseFloat(e.target.value)||0)}/></td>
                      <td className="c" style={{padding:"0 1px"}}><button onClick={()=>handleDelete(ownKey)} title="Eliminar" style={{border:"none",background:"transparent",color:"var(--txt3)",cursor:"pointer",fontSize:11,padding:"2px 6px",lineHeight:1}}>&#x2715;</button></td>
                    </tr>
                  );
                })}


              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAf(networkType) && (
        <Acometida
          ucTotal={ucTotal} Qaco={Qaco} sqrtQaco={sqrtQaco}
          contadorSel={contadorSel} acoContIx={acoContIx} setAcoContIx={setAcoContIx}
          acoMonName={acoMonName} setAcoMonName={setAcoMonName}
          acoRedContDiam={acoRedContDiam} setAcoRedContDiam={setAcoRedContDiam}
          acoContMonDiam={acoContMonDiam} setAcoContMonDiam={setAcoContMonDiam}
          acoL1={acoL1} setAcoL1={setAcoL1}
          acoL2={acoL2} setAcoL2={setAcoL2}
          acoPini={acoPini} setAcoPini={setAcoPini}
          acoLeMed={acoLeMed} setAcoLeMed={setAcoLeMed}
          f1={f1 as any} f2={f2 as any} hfContador={hfContador}
          pResidual={pResidual} okPresion={okPresion}
          AF_DIAM_OPTS={DIAM_OPTS}
        />
      )}

    </>
  );
}
export default React.memo(WaterNetworkDesign);