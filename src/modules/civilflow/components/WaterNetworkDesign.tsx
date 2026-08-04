import React, { useState, useMemo, useEffect } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import type { Tramo } from '../context/tramosReducer';
import { useProyecto } from '../context/ProyectoContext';
import { usePlans } from '../context/PlansContext';
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF, pisoCorto, matHazenC } from '../constants';
import { calcUCparcial } from '../utils/componentHelpers';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import {
  writeDiametroToDrawing,
  writeContadorDiamToDrawing,
  findContadorBajante,
} from '../utils/writeDiameterToDrawing';
import { calcLeAcces } from '../utils/accesoriosUtils';
import { fmt } from '../utils/formatUtils';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { distToPolyline } from '../lib/shared/geometry';
import { computeDirectedTotals } from '../lib/shared/connectionGraph';
import type { DrawingData, RawElement } from '../utils/drawingSync';
import Acometida from './SupplyConnection';

interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}
const WaterNetworkDesign_S1: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const WaterNetworkDesign_S2: React.CSSProperties = {
  width: '100%',
  padding: '3px 4px',
  border: '1px solid #3a494a',
  borderRadius: 3,
  background: '#1e2024',
  color: '#e2e2e8',
  fontSize: 9,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  maxWidth: 120,
};

function LazyNumInput({
  val,
  onSave,
  label,
  disabled = false,
}: {
  val: number | string;
  onSave: (v: number | undefined) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [str, setStr] = React.useState(val != null ? val.toString() : '');
  const [prevVal, setPrevVal] = React.useState(val);
  if (val !== prevVal) {
    setPrevVal(val);
    setStr(val != null ? val.toString() : '');
  }
  const blur = () => {
    if (str.trim() === '') return onSave(undefined);
    const n = parseFloat(str);
    if (!isNaN(n)) onSave(n);
    else setStr(val != null ? val.toString() : '');
  };
  return (
    <input
      type="number"
      aria-label={label}
      step="any"
      className="ni"
      disabled={disabled}
      style={{ width: 44, textAlign: 'center', padding: 0, fontSize: 9 }}
      value={str}
      onChange={(e) => setStr(e.target.value)}
      onBlur={blur}
      onKeyDown={(e) => e.key === 'Enter' && blur()}
    />
  );
}

interface WaterNetworkDesignProps {
  networkType: 'af' | 'ac';
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  lookupFn: (pulg: number) => number;
}

const isAf = (t: string) => t === 'af';

const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

// Same sigla → code transform the drawing engine already applies when it writes a fixture's
// abbreviation into a ramal's ini/fin (PlanoEngineNetwork.ts): "Duc:" -> "DUC". Reusing it here
// means a tramo's ini/fin matches directly, no separate lookup table to keep in sync.
const APARATO_PMAX_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map((a) => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmax]),
);
const HEATER_LOSS_FACTOR = 0.9;

const isAC1 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B'))
    return true;
  return false;
};

const isAC2 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
  if (isContador(ini)) return true;
  if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
  return false;
};

function WaterNetworkDesign({ networkType, diamTable, lookupFn }: WaterNetworkDesignProps) {
  const [edit, setEdit] = useState(false);
  const { tramosAf, tramosAc, updTramoAf, updTramoAc } = useTramos();
  const { proy } = useProyecto();
  const { plans } = usePlans();

  const tramos = isAf(networkType) ? tramosAf : tramosAc;
  const updTramo = isAf(networkType) ? updTramoAf : updTramoAc;

  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const cssClass = networkType;
  const colorVar = `var(--${networkType})`;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const title = isAf(networkType) ? 'agua fr\u00EDa' : 'agua caliente';
  const icon = isAf(networkType) ? 'hidraulica/RAF_Diseno.webp' : 'hidraulica/RAC_Diseno.webp';

  const DIAM_OPTS = diamTable.map((d) => ({
    pulg: d.pulg,
    nominal: d.nominal,
    label: d.nominal,
    dInt: d.dInt,
  }));

  const [diamIntMap, setDiamIntMap] = useState<Record<string, number>>({});
  const [diamNomMap, setDiamNomMap] = useState<Record<string, string>>({});

  const handleDiamChange = (tramoId: string, nominal: string) => {
    const opt = DIAM_OPTS.find((o) => o.nominal === nominal);
    if (!opt) return;
    const pulg = opt.pulg;
    const res = writeDiametroToDrawing(tramoId, networkType, opt.label, plans);
    if (!res.ok && res.reason === 'accessory-larger') {
      // Show the same in-app AlertDialog as the engine path (mirrors
      // ExtremeAccessoryEditor.tsx:110-117 which validates the inverse direction). Without this
      // the design-table write would silently succeed and a wider accessory would later end up
      // drawn around a thinner pipe — physically nonsensical.
      window.dispatchEvent(
        new CustomEvent('civilflow_diametro_validation', {
          detail: {
            title: 'Diámetro no permitido',
            message: `El diámetro del ramal no puede ser menor al del accesorio conectado (${res.accessoryDiam}).`,
          },
        }),
      );
      return;
    }
    updTramo(tramoId, 'diamDisPulg', pulg);
    setDiamIntMap((prev) => ({ ...prev, [tramoId]: opt.dInt }));
    setDiamNomMap((prev) => ({ ...prev, [tramoId]: opt.nominal }));
  };

  const AP = useMemo(
    () =>
      ucIds
        .map((id) => {
          const a = APARATOS_DEF.find((x) => x.id === id);
          return a ? { id: a.id, uc: a[ucField] } : null;
        })
        .filter((x): x is { id: string; uc: number } => x !== null),
    [ucIds, ucField],
  );

  const [presIniEdit, setPresIniEdit] = useState(() => new Map());
  const [presFinEdit, setPresFinEdit] = useState(() => new Map());

  const setPresIni = (tramoId: string, v: number | undefined) => {
    setPresIniEdit((prev) => {
      const next = new Map(prev);
      if (v === undefined) next.delete(tramoId);
      else next.set(tramoId, v);
      return next;
    });
  };

  const setPresFin = (tramoId: string, v: number | undefined) => {
    setPresFinEdit((prev) => {
      const next = new Map(prev);
      if (v === undefined) next.delete(tramoId);
      else next.set(tramoId, v);
      return next;
    });
  };

  const [conexionesDisplay, componentTotalMap, tramoParentOf, pressureRootKey, qpropMap] =
    useMemo(() => {
      const calculoMap: Record<string, string[]> = {};
      // A montante/bajante has no identity preserved across floors — copying a trazo between plans
      // assigns it a brand new id/code (see copyDrawingFromPlan.ts). The only reliable signal that
      // two per-floor elements are the same physical riser is sitting at (roughly) the same x/y on
      // different floors — collected here, linked once every plan has been scanned.
      const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
      // A ramal auto-created at a T/Y junction (autoSplitJunctionAndSumFlow, PlanoEngineDrawing.ts)
      // carries mergesFrom = [idA, idB] — but that only records the ONE pair that triggered the
      // mid-body split. A third (or fourth) ramal terminating at the exact same coordinate attaches
      // via a plain endpoint-to-endpoint join and never gets into mergesFrom at all — yet its
      // proximity-based adjacency edge still needs severing from the OTHER branches at that same
      // point, or its UC leaks into whichever branch it ties-break-connects to. So the real set of
      // "branches at this junction" is discovered by coordinate, not just read off mergesFrom.
      const mergeBranches: Record<string, string[]> = {};
      // Every ramal endpoint, tagged with its plan — used below to find PLAIN (non-mergesFrom)
      // junctions where 3+ ramales meet at one coordinate via ordinary endpoint-to-endpoint drawing
      // (a trunk splitting into branches). `checkEndpoint` below only links each endpoint to its
      // single nearest neighbor, independently per ramal — at a 3-way point that can produce a
      // triangle/cycle of edges (A-B from A's own search, B-C from B's, C-A from C's), and a cycle
      // breaks the single-parent BFS tree computeDirectedTotals relies on, corrupting totals for
      // everyone in the cycle. Pruned back to a cycle-free tree further below.
      const ramalEndpoints: Array<{ key: string; x: number; y: number; planId: string }> = [];

      for (const plan of plans || []) {
        if (plan.nivel == null) continue;
        const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
        if (!raw) continue;
        let data: DrawingData = raw as DrawingData;
        if (typeof raw === 'string') {
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }
        }

        const ramales = (data.ramales || []).filter((r) => r.net === networkType);
        const bajantes = (data.bajantes || []).filter(
          (b): b is BajanteRaw => b.net === networkType,
        );
        for (const r of ramales) {
          if (!r.mergesFrom || !r.pts || r.pts.length === 0) continue;
          const mergedKeyFull = `${r.id}-${plan.id}`;
          // The auto-created ramal always starts exactly at the junction coordinate
          // (autoSplitJunctionAndSumFlow: downstreamPts = [[ep[0],ep[1]], ...]).
          const jc = r.pts[0];
          const branchIds: string[] = [];
          for (const other of ramales) {
            if (other.id === r.id || !other.pts || other.pts.length < 2) continue;
            const oStart = other.pts[0],
              oEnd = other.pts[other.pts.length - 1];
            if (
              Math.hypot(oStart[0] - jc[0], oStart[1] - jc[1]) < 2.0 ||
              Math.hypot(oEnd[0] - jc[0], oEnd[1] - jc[1]) < 2.0
            ) {
              branchIds.push(`${other.id}-${plan.id}`);
            }
          }
          if (branchIds.length > 0) mergeBranches[mergedKeyFull] = branchIds;
        }
        for (const b of bajantes) {
          if (b.x == null || b.y == null) continue;
          bajanteNodes.push({ key: `${b.id}-${plan.id}`, x: b.x, y: b.y, nivel: plan.nivel });
        }
        for (const r of ramales) {
          if (!r.pts || r.pts.length < 2) continue;
          const rKeyFull = `${r.id}-${plan.id}`;
          ramalEndpoints.push({
            key: rKeyFull,
            x: r.pts[0][0],
            y: r.pts[0][1],
            planId: String(plan.id),
          });
          ramalEndpoints.push({
            key: rKeyFull,
            x: r.pts[r.pts.length - 1][0],
            y: r.pts[r.pts.length - 1][1],
            planId: String(plan.id),
          });
        }

        for (const r of ramales) {
          if (!r.pts || r.pts.length < 2) continue;
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const rKey = `${r.id}-${plan.id}`;

          const checkEndpoint = (pt: number[]) => {
            for (const b of bajantes) {
              const isExplicit =
                b.recibeDeIds &&
                (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
              const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
              if (isExplicit) {
                // Explicit link doesn't say which end — assign it to whichever endpoint is
                // geometrically closer, so a bajante at each end each claims its own.
                const otherPt = pt === pEnd ? pStart : pEnd;
                const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
                if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
                continue;
              }
              if (dist < 2.0) {
                return { type: 'bajante' as const, id: b.id };
              }
            }
            let bestRx: RawElement | null = null;
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

          // A ramal can have a bajante at EACH end — check both endpoints independently instead
          // of short-circuiting on the first match, otherwise the second bajante is silently
          // dropped from calculoMap.
          const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
            (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
          );

          for (const connection of connections) {
            const targetKey = `${connection.id}-${plan.id}`;
            if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
            if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
          }
        }
      }

      // Bridge same-position montante/bajante nodes across consecutive floors (see comment above)
      // so a ramal ending at one floor's riser connects through to the next floor's.
      const usedNode = new Set<number>();
      for (let i = 0; i < bajanteNodes.length; i++) {
        if (usedNode.has(i)) continue;
        const group = [bajanteNodes[i]];
        usedNode.add(i);
        for (let j = i + 1; j < bajanteNodes.length; j++) {
          if (usedNode.has(j)) continue;
          if (
            Math.hypot(
              bajanteNodes[j].x - bajanteNodes[i].x,
              bajanteNodes[j].y - bajanteNodes[i].y,
            ) < 2.0
          ) {
            group.push(bajanteNodes[j]);
            usedNode.add(j);
          }
        }
        if (group.length < 2) continue;
        group.sort((a, b) => a.nivel - b.nivel);
        for (let k = 0; k < group.length - 1; k++) {
          const a = group[k].key,
            b = group[k + 1].key;
          if (!calculoMap[a]) calculoMap[a] = [];
          if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
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
      // Sever the edges a mergeOverride will handle explicitly — otherwise the general BFS tree
      // below would ALSO make whichever of the two merging ramales sits closer to root fold the
      // other one (and the merged ramal itself) into IT, on top of the override forcing the merged
      // ramal's total to their sum: the same demand would get counted twice.
      // Also sever any DIRECT k1<->k2 edge: at a 3-way merge point all three ramales' endpoints sit
      // at the exact same coordinate, so the proximity match above (checkEndpoint / distToPolyline)
      // can resolve a source ramal's nearest-neighbor to the OTHER source instead of to the merged
      // ramal (a distance tie broken by array order). Left alone, that stray edge lets one source's
      // total leak into the other's — e.g. RAF1 picking up RAF2's total — even though the merged
      // ramal's own total is already correctly forced to their sum right below.
      for (const [mergedKey, branches] of Object.entries(mergeBranches)) {
        adj[mergedKey] = (adj[mergedKey] || []).filter((k) => !branches.includes(k));
        for (const b of branches) {
          if (adj[b]) adj[b] = adj[b].filter((k) => k !== mergedKey && !branches.includes(k));
        }
      }

      // Plain (non-mergesFrom) junctions: group every ramal endpoint by coordinate (same-plan only)
      // to find every point where 3+ ramales meet via ordinary drawing (a trunk splitting into
      // branches, or several branches arriving at one spot) — `checkEndpoint` above links each
      // endpoint independently to its own single nearest neighbor, which at a 3+-way point can
      // produce a triangle/cycle of edges. A cycle breaks the single-parent-per-node assumption
      // computeDirectedTotals' BFS relies on, corrupting totals for every member of the cycle (not
      // just merge sources — this covers the general case). Prune down to a cycle-free tree per
      // cluster via union-find, without ever disconnecting anyone (only removes an edge that would
      // close a cycle within the same cluster).
      const usedEp = new Set<number>();
      for (let i = 0; i < ramalEndpoints.length; i++) {
        if (usedEp.has(i)) continue;
        const cluster = [ramalEndpoints[i]];
        usedEp.add(i);
        for (let j = i + 1; j < ramalEndpoints.length; j++) {
          if (usedEp.has(j)) continue;
          if (ramalEndpoints[j].planId !== ramalEndpoints[i].planId) continue;
          if (
            Math.hypot(
              ramalEndpoints[j].x - ramalEndpoints[i].x,
              ramalEndpoints[j].y - ramalEndpoints[i].y,
            ) < 2.0
          ) {
            cluster.push(ramalEndpoints[j]);
            usedEp.add(j);
          }
        }
        const memberKeys = Array.from(new Set(cluster.map((c) => c.key)));
        if (memberKeys.length < 2) continue;
        const memberSet = new Set(memberKeys);
        const parent = new Map(memberKeys.map((k) => [k, k]));
        const find = (x: string): string => {
          while (parent.get(x) !== x) x = parent.get(x)!;
          return x;
        };
        for (const a of memberKeys) {
          for (const b of [...(adj[a] || [])]) {
            if (!memberSet.has(b) || a >= b) continue;
            const ra = find(a),
              rb = find(b);
            if (ra === rb) {
              adj[a] = adj[a].filter((k) => k !== b);
              if (adj[b]) adj[b] = adj[b].filter((k) => k !== a);
            } else {
              parent.set(ra, rb);
            }
          }
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
            const tr = tramos.find((x) => (x._key || x.id) === node);
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
      // The merge-branch edges got severed from `adj` above so the directed-tree BFS wouldn't
      // double-count the merged ramal's UC through the general path — but that also hid the source
      // ramales from "Otros Ramales" here, since this reads the same severed `adj`. Add them back
      // explicitly: the merged ramal must display the ramales it was created from. Same tributario/
      // bajante exclusion as every other path into displayMap (getConnectedNeighbors' isMainRamal
      // check) — a merge source that got mistagged tributario (see the existing.tipo guard in
      // autoSplitJunctionAndSumFlow) must not leak into this column either.
      for (const [mergedKey, branches] of Object.entries(mergeBranches)) {
        if (!displayMap[mergedKey]) continue;
        for (const k of branches) {
          const tr = tramos.find((x) => (x._key || x.id) === k);
          if (tr && (tr.tipo === 'tributario' || tr.esBajante)) continue;
          if (!displayMap[mergedKey].includes(k)) displayMap[mergedKey].push(k);
        }
      }
      // A merge source's own "Otros Ramales" row must show NOTHING — not its co-source, and not
      // even the auto-created ramal it feeds (that association is already visible from the OTHER
      // direction: the auto-created ramal's own row lists both sources, via the loop above). Only
      // the auto-created ramal's row should ever show an association for this merge.
      for (const branches of Object.values(mergeBranches)) {
        for (const b of branches) {
          if (displayMap[b]) displayMap[b] = [];
        }
      }

      // Direct the same adjacency from the network's pressure source outward, so each tramo's
      // Pinicial can chain from its actual upstream tramo's Pfinal instead of the flat acometida
      // pressure. AF's source is the trunk tramo (Contador→Mon, isAC2); AC has no acometida of its
      // own — its source is the tramo reaching the calentador, fed from AF (see pressure section).
      const rootT =
        tramos.find(isAC2) ||
        tramos.find(
          (t) =>
            String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
        );
      let rootKey = rootT ? rootT._key || rootT.id : null;
      // Neither heuristic found a root — falls all the way back to computeComponentTotals's
      // undirected whole-component sum otherwise (every tramo showing the identical grand total).
      // Approximate the trunk with the most-connected tramo instead of giving up on direction.
      if (!rootKey) {
        let bestKey: string | null = null,
          bestDeg = -1;
        for (const k of Object.keys(adj)) {
          if (!tramos.some((t) => (t._key || t.id) === k)) continue;
          const deg = adj[k]?.length || 0;
          if (deg > bestDeg) {
            bestDeg = deg;
            bestKey = k;
          }
        }
        if (bestDeg > 0) rootKey = bestKey;
      }

      // Rooted at the actual supply source, not the whole undirected connected component — a branch
      // feeding one fixture must only show its OWN accumulated total, not the entire building's
      // demand just because it's hydraulically part of the same network (see connectionGraph.ts).
      const componentTotalMap = computeDirectedTotals(
        tramos,
        (t) => t._key || t.id,
        adj,
        (t) => calcUCparcial(t, AP, 'uc'),
        rootKey,
      );
      // A chain of merges (R1+R2→R5, then R5+R3→R6) needs R5's own override resolved before R6
      // reads it as a source — Object.entries() has no guarantee of processing sources before their
      // consumers, so a single pass could read a not-yet-overridden (still tree-based, wrong) value
      // for a source that is itself a merge. Iterate to a fixed point instead of a single pass.
      const mergeEntries = Object.entries(mergeBranches);
      for (let pass = 0; pass <= mergeEntries.length; pass++) {
        let changedAny = false;
        for (const [key, branches] of mergeEntries) {
          if (componentTotalMap[key] === undefined) continue;
          const next = branches.reduce((sum, b) => sum + (componentTotalMap[b] || 0), 0);
          if (next !== componentTotalMap[key]) {
            componentTotalMap[key] = next;
            changedAny = true;
          }
        }
        if (!changedAny) break;
      }
      // A ramal that FEEDS a merge (a branch in mergeBranches) must never show a different total
      // just because it happens to be a merge source — its own displayed total stays exactly its
      // own UC/UD, regardless of anything the directed-tree fold picked up for it through some
      // other, non-severed path. Skip branches that are themselves a merge target (nested chains)
      // — those legitimately keep the summed value from the loop above, not their raw own value.
      const allBranchIds = new Set<string>();
      for (const branches of Object.values(mergeBranches)) {
        for (const b of branches) allBranchIds.add(b);
      }
      for (const branchId of allBranchIds) {
        if (mergeBranches[branchId]) continue;
        const t = tramos.find((x) => (x._key || x.id) === branchId);
        if (t) componentTotalMap[branchId] = calcUCparcial(t, AP, 'uc');
      }

      const nodeParentOf: Record<string, string> = {};
      if (rootKey) {
        const visited = new Set<string>([rootKey]);
        const queue = [rootKey];
        while (queue.length > 0) {
          const node = queue.shift()!;
          for (const neighbor of adj[node] || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              nodeParentOf[neighbor] = node;
              queue.push(neighbor);
            }
          }
        }
      }

      // The BFS above walks through bajante/contador/montante junction points too (they're nodes
      // in `adj` but not Tramo objects) — collapse those into the nearest real upstream tramo so
      // callers can go straight from a tramo's key to its governing tramo's key.
      const tramoKeySet = new Set(tramos.map((t) => t._key || t.id));
      const tramoParentOf: Record<string, string> = {};
      for (const t of tramos) {
        const key = t._key || t.id;
        let cur = nodeParentOf[key];
        while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
        if (cur) tramoParentOf[key] = cur;
      }

      // Probable-flow (Hunter curve, K·f(UC)) per tramo — for an auto-created ramal at a T/Y
      // junction, `total` already reads componentTotalMap[key], which was overridden above (line
      // 353-356) to the sum of the two merging branches' UC. So the formula here runs on the
      // correctly combined UC total for every tramo, merged or not — no separate override needed.
      const qpropMap: Record<string, number> = {};
      for (const t of tramos) {
        const key = t._key || t.id;
        const nDesc = t.nSalidas || 0;
        const K =
          nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
        const total = componentTotalMap[key] || 0;
        qpropMap[key] =
          total > 0 && K > 0
            ? Math.round(
                K *
                  (total < 240
                    ? 0.1163 * Math.pow(total, 0.6875)
                    : 0.074 * Math.pow(total, 0.7504)) *
                  1000,
              ) / 1000
            : 0;
      }

      return [displayMap, componentTotalMap, tramoParentOf, rootKey, qpropMap] as const;
    }, [plans, tramos, networkType, AP]);

  const propiaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      m[key] = calcUCparcial(t, AP, 'uc');
    }
    return m;
  }, [tramos, AP]);

  const pRed = parseFloat(proy.p_red) || 20;

  const tramosOrden = useMemo(
    () =>
      tramos
        .filter((t) => t.tipo !== 'tributario' && !t.esBajante && !isAC1(t))
        .sort((a, b) => (b.piso || 0) - (a.piso || 0)),
    [tramos],
  );

  const [acoContIx, setAcoContIx] = useState(2);
  const contIxDeps = networkType === 'af' ? String(plans?.length ?? 0) + '|' + networkType : '';
  const detectedContIx = useMemo(() => {
    if (networkType !== 'af') return null;
    const found = findContadorBajante(plans, networkType);
    if (!found?.bajante.dNominal) return null;
    const dNom = found.bajante.dNominal.replace('½', '1/2').replace('¾', '3/4');
    const idx = CONTADORES_CAT.findIndex((c) => `${c.dn}"` === dNom);
    return idx === -1 ? null : idx;
  }, [plans, networkType]);
  const [previousContIxDeps, setPreviousContIxDeps] = useState(contIxDeps);
  if (contIxDeps !== previousContIxDeps) {
    setPreviousContIxDeps(contIxDeps);
    if (detectedContIx !== null) setAcoContIx(detectedContIx);
  }
  const [acoMonName, setAcoMonName] = useState('Mon');
  const acoContMonDiam = 1.25;
  const [acoL1, setAcoL1] = useState({ h: 10.0, v: 0.0, le: 0.47 });
  const [acoL2, setAcoL2] = useState({ h: 7.54, v: 0.0, le: 0.0 });
  const [acoPini, setAcoPini] = useState(20.0);
  const [acoLeMed, setAcoLeMed] = useState(0);
  const [acoHfMax, setAcoHfMax] = useState(5.0);

  const handleContDiamChange = React.useCallback(
    (dNom: string) => {
      writeContadorDiamToDrawing(dNom, plans, networkType);
    },
    [plans, networkType],
  );

  const tr1 = useMemo(
    () => (isAf(networkType) ? tramos.find((t) => isAC1(t)) : null),
    [tramos, networkType],
  );
  const tr2 = useMemo(
    () => (isAf(networkType) ? tramos.find((t) => isAC2(t)) : null),
    [tramos, networkType],
  );

  const isTr1Drawn = !!tr1;
  const isTr2Drawn = !!tr2;

  const resolvedMonName = useMemo(() => {
    if (tr2) {
      const iniStr = typeof tr2.ini === 'string' ? tr2.ini : '';
      const finStr = typeof tr2.fin === 'string' ? tr2.fin : '';
      if (isContador(iniStr)) return finStr || acoMonName;
      if (isContador(finStr)) return iniStr || acoMonName;
      return iniStr || finStr || acoMonName;
    }
    return acoMonName;
  }, [tr2, acoMonName]);
  const resolvedContMonDiam = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      if (diamNomMap[ownKey]) return diamNomMap[ownKey];
      if (tr2.diametroOriginal) {
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const fallbackPulg = acoContMonDiam || 0.75;
    const match = diamTable.find((o) => Math.abs(o.pulg - fallbackPulg) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  }, [tr2, diamNomMap, acoContMonDiam, diamTable]);

  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = useMemo(() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.0, le };
    }
    return acoL1;
  }, [tr1, acoL1, resolvedRedContDiam, diamTable]);

  const resolvedL2 = useMemo(() => {
    if (tr2) {
      const opt = resolvedContMonDiam
        ? diamTable.find((d) => d.nominal === resolvedContMonDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr2.diamDisPulg || 0;
      const cHW = matHazenC(tr2.material || '') ?? 150;
      const le = calcLeAcces(tr2.accesorios ?? {}, realPulg, cHW);
      return { h: tr2.totalL || tr2.Lh || 0, v: 0.0, le };
    }
    return acoL2;
  }, [tr2, acoL2, resolvedContMonDiam, diamTable]);

  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];

  const ucTotal = useMemo(() => {
    let s = 0;
    for (const t of tramos) {
      const key = t._key || t.id;
      s += propiaMap[key] || 0;
    }
    return s;
  }, [tramos, propiaMap]);

  const Qaco = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return (
          Math.round(
            K *
              (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
              1000,
          ) / 1000
        );
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  }, [ucTotal, tr2, componentTotalMap]);

  const calcFila = (
    nominal: string,
    h: number,
    v: number,
    le: number,
    pIn: number,
    cHW: number,
  ) => {
    const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V =
      Qaco > 0 && dInt > 0
        ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
        : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct =
      Math.round(
        ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
      ) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const cHW2 = matHazenC(tr2?.material || '') ?? 150;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
  );
  const f2 = calcFila(
    resolvedContMonDiam || '',
    resolvedL2.h,
    resolvedL2.v,
    resolvedL2.le,
    f1.Pfin,
    cHW2,
  );
  const hfContador =
    Qaco > 0 && contadorSel.q > 0
      ? Math.round(10 * Math.pow(Qaco / contadorSel.q, 2) * 100) / 100
      : 0;
  const pResidual = +(f1.Pfin - f2.Pfin).toFixed(2);
  const okPresion = f1.Pfin > f2.Pfin;

  // AC has no acometida of its own — it's fed from the water heater, which is itself fed from
  // AF. Read AF's own resolved pressure at that shared calentador node (persisted below) so
  // AC's root tramo can seed from it instead of the flat pRed fallback.
  const afHeaterPfin = useMemo(() => {
    if (isAf(networkType)) return null;
    const heaterTramo = tramosAf.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
    return heaterTramo?.pFin ?? null;
  }, [networkType, tramosAf]);

  // Real tree-based pressure propagation, resolved once per render (recursively, memoized as it
  // goes) instead of every tramo flatly reading the acometida pressure:
  //   1. The network's root (tr2 for AF, the calentador tramo for AC) seeds from its own source.
  //   2. A tramo that begins at a fixture (t.ini matches an aparato sigla) seeds from that
  //      fixture's Pmax — same rule the reference calculation sheet uses.
  //   3. Anything else inherits Pinicial from its actual upstream tramo's Pfinal (tramoParentOf,
  //      the directed version of the same connectivity graph used for UD totals).
  //   4. Orphan/disconnected tramos fall back to pRed, same as today.
  const pressureByKey = useMemo(() => {
    const keyOf = (t: Tramo) => t._key || t.id;
    const byKey = new Map(tramosOrden.map((t) => [keyOf(t), t]));

    // Friction loss / elevation drop for a tramo — same formulas as the table's own
    // Vertical/Pérdidas columns. Needed here (ahead of the row loop) because a child's
    // Pinicial depends on its parent's Pfinal, and tramosOrden is sorted by piso for display,
    // not in tree order.
    const pipeLoss = (t: Tramo) => {
      const ownKey = keyOf(t);
      const isTr2Row = t === tr2;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = t.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      const Qprob = isTr2Row
        ? Qaco
        : total > 0 && K > 0
          ? Math.round(
              K *
                (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
                1000,
            ) / 1000
          : 0;
      const disPulg = t.diamDisPulg || 0;
      const matchedOpt = diamNomMap[ownKey]
        ? DIAM_OPTS.find((o) => o.nominal === diamNomMap[ownKey])
        : (t.diametroOriginal
            ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
            : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
      const internoMm =
        diamIntMap[ownKey] || (matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0);
      const Vmms =
        Qprob > 0 && internoMm > 0
          ? Math.round(((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
          : 0;
      const H = t.totalL || t.Lh || 0;
      const Vvert = t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
      const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
      const cHW = matHazenC(t.material || '') ?? 150;
      const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
      const Lt = H + Vvert + Le;
      const hfPct =
        Vmms > 0 && cHW > 0 && internoMm > 0
          ? Math.round(
              ((60.1 * Math.pow(Vmms, 1.852)) /
                (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) *
                100,
            ) / 100
          : 0;
      const hfM = Lt > 0 && hfPct > 0 ? Math.round(((Lt * hfPct) / 1000) * 100) / 100 : 0;
      return { Vvert, hfM };
    };

    const result: Record<string, { Pin: number; Pfin: number }> = {};
    const resolving = new Set<string>();

    const resolve = (key: string): { Pin: number; Pfin: number } => {
      if (result[key]) return result[key];
      if (resolving.has(key)) return { Pin: pRed, Pfin: pRed }; // cycle guard, shouldn't trigger
      resolving.add(key);

      const t = byKey.get(key);
      if (!t) {
        resolving.delete(key);
        return { Pin: pRed, Pfin: pRed };
      }

      let PinCalc: number;
      if (key === pressureRootKey) {
        PinCalc = isAf(networkType)
          ? f1.Pfin
          : afHeaterPfin != null
            ? afHeaterPfin * HEATER_LOSS_FACTOR
            : pRed;
      } else {
        const fixturePmax = APARATO_PMAX_BY_CODE[String(t.ini || '').toUpperCase()];
        if (fixturePmax !== undefined) {
          PinCalc = fixturePmax;
        } else {
          const parentKey = tramoParentOf[key];
          PinCalc = parentKey ? resolve(parentKey).Pfin : pRed;
        }
      }

      const Pin = presIniEdit.has(key) ? presIniEdit.get(key)! : PinCalc;
      const { Vvert, hfM } = pipeLoss(t);
      const PfinCalc = Pin - Vvert - hfM;
      const Pfin = presFinEdit.has(key) ? presFinEdit.get(key)! : PfinCalc;

      resolving.delete(key);
      result[key] = { Pin, Pfin };
      return result[key];
    };

    for (const t of tramosOrden) resolve(keyOf(t));
    return result;
  }, [
    tramosOrden,
    tr2,
    componentTotalMap,
    Qaco,
    diamNomMap,
    diamIntMap,
    DIAM_OPTS,
    lookupFn,
    tramoParentOf,
    pressureRootKey,
    networkType,
    f1.Pfin,
    afHeaterPfin,
    pRed,
    presIniEdit,
    presFinEdit,
  ]);

  // Persist each tramo's resolved Pfinal so the AC instance of this same component can read
  // AF's pressure at the shared calentador node (see afHeaterPfin above).
  useEffect(() => {
    for (const t of tramosOrden) {
      const ownKey = t._key || t.id;
      const resolved = pressureByKey[ownKey];
      if (resolved && t.pFin !== resolved.Pfin) updTramo(ownKey, 'pFin', resolved.Pfin);
    }
  }, [tramosOrden, pressureByKey, updTramo]);

  // Persist complete row data for memoria final tables
  useEffect(() => {
    const rows = tramosOrden.map((t) => {
      const ownKey = t._key || t.id;
      const propia = propiaMap[ownKey] || 0;
      const total = componentTotalMap[ownKey] || 0;
      const isTr2 = t === tr2;
      const nDesc = t.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      const Qprob2 = isTr2
        ? Qaco
        : total > 0 && K > 0
          ? Math.round(
              K *
                (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
                1000,
            ) / 1000
          : 0;
      const raizQ = Qprob2 > 0 ? Math.round(Math.sqrt(Qprob2) * 100) / 100 : 0;
      const disPulg = t.diamDisPulg || 0;
      const matchedOpt = diamNomMap[ownKey]
        ? DIAM_OPTS.find((o) => o.nominal === diamNomMap[ownKey])
        : (t.diametroOriginal
            ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
            : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
      const internoMm =
        diamIntMap[ownKey] || (matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0);
      const Vmms2 =
        Qprob2 > 0 && internoMm > 0
          ? Math.round(((1000000 * Qprob2) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
          : 0;
      const H = t.totalL || t.Lh || 0;
      const Vvert = t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
      const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
      const cHW2 = matHazenC(t.material || '') ?? 150;
      const Le2 = calcLeAcces(t.accesorios ?? {}, realPulg, cHW2);
      const Lt2 = H + Vvert + Le2;
      const hfPct2 =
        Vmms2 > 0 && cHW2 > 0 && internoMm > 0
          ? Math.round(
              ((60.1 * Math.pow(Vmms2, 1.852)) /
                (Math.pow(cHW2, 1.852) * Math.pow(internoMm, 1.167))) *
                100,
            ) / 100
          : 0;
      const hfM2 = Lt2 > 0 && hfPct2 > 0 ? Math.round(((Lt2 * hfPct2) / 1000) * 100) / 100 : 0;
      const { Pin, Pfin } = pressureByKey[ownKey] ?? { Pin: pRed, Pfin: pRed };
      return {
        id: t.id,
        ini: typeof t.ini === 'string' ? t.ini : '—',
        fin: typeof t.fin === 'string' ? t.fin : '—',
        piso: t.piso,
        udPropia: propia,
        udTotal: total,
        nDesc,
        K,
        Qprob: Qprob2,
        diamEst: raizQ,
        diamDis: matchedOpt?.nominal || '—',
        dInt: internoMm,
        cHW: cHW2,
        Vmms: Vmms2,
        Lh: H,
        Lv: Vvert,
        Le: Le2,
        Lt: Lt2,
        hfPct: hfPct2,
        hfM: hfM2,
        Pin,
        Pfin,
      };
    });
    saveToStorage(`civilflow_memoria_${networkType}_rows`, rows);
  }, [
    tramosOrden,
    componentTotalMap,
    diamNomMap,
    diamIntMap,
    Qaco,
    DIAM_OPTS,
    lookupFn,
    propiaMap,
    tramos,
    pRed,
    pressureByKey,
    networkType,
    tr2,
  ]);

  // Persist the velocity checkpoint (and, for AF, the acometida pressure checkpoint) onto
  // each Tramo so InfTab can show a real OK/Revisar badge instead of nothing at all.
  useEffect(() => {
    for (const t of tramosOrden) {
      const ownKey = t._key || t.id;
      const isTr2 = t === tr2;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = t.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      const Qprob = isTr2
        ? Qaco
        : total > 0 && K > 0
          ? Math.round(
              K *
                (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
                1000,
            ) / 1000
          : 0;
      const disPulg = t.diamDisPulg || 0;
      const matchedOpt = diamNomMap[ownKey]
        ? DIAM_OPTS.find((o) => o.nominal === diamNomMap[ownKey])
        : (t.diametroOriginal
            ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
            : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
      const internoMm =
        diamIntMap[ownKey] || (matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0);
      const Vmms =
        Qprob > 0 && internoMm > 0
          ? Math.round(((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
          : 0;
      const velCumple = Vmms > 0 ? Vmms >= 500 && Vmms <= 2500 : true;
      if (t.velCumple !== velCumple) updTramo(ownKey, 'velCumple', velCumple);
      if (isAf(networkType) && t.presionOk !== okPresion) updTramo(ownKey, 'presionOk', okPresion);
      if (t.qLps !== Qprob) updTramo(ownKey, 'qLps', Qprob);
    }
  }, [
    tramosOrden,
    tr2,
    componentTotalMap,
    diamNomMap,
    diamIntMap,
    Qaco,
    DIAM_OPTS,
    lookupFn,
    okPresion,
    networkType,
    updTramo,
  ]);

  return (
    <>
      <section
        className="card"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'hidden' }}
      >
        <div className="card-h">
          <h3 className="card-t">
            <img
              src={`/iconos_civilflow/diseno_redes/${icon}`}
              alt={`${title}`}
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Diseño de red {title}
          </h3>
          <span className="card-s">{tramosOrden.length} tramos</span>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="scroll-top" style={{ padding: '6px' }}>
            <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
              <table className="tbl" style={{ fontSize: 9, tableLayout: 'auto', width: '100%' }}>
                <caption style={WaterNetworkDesign_S1}>{`Diseño de red ${title}`}</caption>

                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Tramo
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Inicio
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Final
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Piso
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      colSpan={3}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Unidades Consumo
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      No. de descargas
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      K
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Caudal
                      <br />
                      (lps)
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Diámetro
                      <br /> estimado
                    </th>
                    <th
                      scope="col"
                      className="col-h ok"
                      colSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Diámetro
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Coeficiente
                      <br />C
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      rowSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Vel. <br />
                      (mm/s)
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      colSpan={4}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Longitud (m)
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      colSpan={2}
                      style={{
                        textAlign: 'center',
                        padding: '2px 1px',
                        fontSize: 9,
                        whiteSpace: 'nowrap',
                        minWidth: 56,
                      }}
                    >
                      Pérdidas
                      <br />
                      por
                      <br />
                      fricción
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      colSpan={2}
                      style={{ textAlign: 'center', padding: '2px 1px', fontSize: 9 }}
                    >
                      Presión
                    </th>
                  </tr>
                  <tr>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Propia
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Otros Ramales
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="col-h ok"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Diseño
                    </th>
                    <th
                      scope="col"
                      className="col-h ok"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Interno
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Horizontal
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Vertical
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Eq. Accesorios
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      %
                    </th>
                    <th
                      scope="col"
                      className="col-h"
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      m
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Inicial
                    </th>
                    <th
                      scope="col"
                      className={`col-h ${cssClass}`}
                      style={{ textAlign: 'center', padding: '0 1px', fontSize: 9 }}
                    >
                      Final
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tramosOrden.length === 0 && (
                    <tr>
                      <td
                        colSpan={23}
                        style={{
                          padding: '24px 0',
                          textAlign: 'center',
                          color: 'var(--txt3)',
                          fontSize: 9,
                        }}
                      >
                        No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                      </td>
                    </tr>
                  )}
                  {tramosOrden.map((t) => {
                    const ownKey = t._key || t.id;
                    const propia = propiaMap[ownKey] || 0;
                    const isTr2 = t === tr2;
                    const total = componentTotalMap[ownKey] || 0;
                    const nDesc = t.nSalidas || 0;
                    const K =
                      nDesc > 0
                        ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100
                        : 0;
                    const Qprob = isTr2 ? Qaco : qpropMap[ownKey] || 0;
                    const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
                    const disPulg = t.diamDisPulg || 0;

                    const getMatchedOption = () => {
                      if (diamNomMap[ownKey])
                        return DIAM_OPTS.find((o) => o.nominal === diamNomMap[ownKey]);
                      if (t.diametroOriginal) {
                        const match = DIAM_OPTS.find((o) =>
                          t.diametroOriginal?.startsWith(o.nominal),
                        );
                        if (match) return match;
                      }
                      return DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
                    };

                    const matchedOpt = getMatchedOption();
                    const internoMm =
                      diamIntMap[ownKey] || (matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0);
                    const Vmms =
                      Qprob > 0 && internoMm > 0
                        ? Math.round(
                            ((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10,
                          ) / 10
                        : 0;
                    const H = t.totalL || t.Lh || 0;
                    const Vvert =
                      t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
                    const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
                    const cHW = matHazenC(t.material || '') ?? 150;
                    const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
                    const Lt = H + Vvert + Le;
                    const hfPct =
                      Vmms > 0 && cHW > 0 && internoMm > 0
                        ? Math.round(
                            ((60.1 * Math.pow(Vmms, 1.852)) /
                              (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) *
                              100,
                          ) / 100
                        : 0;
                    const hfM =
                      Lt > 0 && hfPct > 0 ? Math.round(((Lt * hfPct) / 1000) * 100) / 100 : 0;
                    const { Pin, Pfin } = pressureByKey[ownKey] ?? { Pin: pRed, Pfin: pRed };
                    const vCumple = Vmms >= 500 && Vmms <= 2500;
                    return (
                      <tr key={ownKey}>
                        <td className="c" style={{ padding: '0 1px' }}>
                          <span className="sigla" style={{ fontSize: 9, padding: '1px 4px' }}>
                            {t.id}
                          </span>
                        </td>
                        <td className="c td-mono" style={{ padding: '0 1px', fontSize: 9 }}>
                          {t.ini && typeof t.ini === 'object'
                            ? `${t.ini.x},${t.ini.y}`
                            : t.ini || '—'}
                        </td>
                        <td className="c td-mono" style={{ padding: '0 1px', fontSize: 9 }}>
                          {t.fin && typeof t.fin === 'object'
                            ? `${t.fin.x},${t.fin.y}`
                            : t.fin || '—'}
                        </td>
                        <td
                          className="c"
                          style={{ padding: '0 1px', color: 'var(--txt2)', fontSize: 9 }}
                        >
                          {pisoCorto(t.piso)}
                        </td>
                        <td className="c td-mono">{fmt(propia, 2)}</td>
                        <td
                          className="c"
                          style={{ padding: '1px 2px', minWidth: 60, maxWidth: 120 }}
                        >
                          {(() => {
                            const connectedKeys = conexionesDisplay[ownKey] || [];
                            return connectedKeys.length === 0 ? (
                              <span style={{ fontSize: 9, color: 'var(--txt3)' }}>—</span>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 2,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                {connectedKeys.map((childKey) => {
                                  const parts = childKey.split('-');
                                  const rId = parts[0];
                                  const childTramo = tramos.find(
                                    (tr) => (tr._key || tr.id) === childKey,
                                  );
                                  const childOwnKey =
                                    childTramo?._key || childTramo?.id || childKey;
                                  const childTotalUd = componentTotalMap[childOwnKey] || 0;
                                  return (
                                    <span
                                      key={childKey}
                                      title={`${rId} (${childTotalUd.toFixed(2)} UC)`}
                                      style={{
                                        fontSize: 9,
                                        padding: '1px 1px',
                                        border: `1px solid ${colorVar}`,
                                        borderRadius: 3,
                                        color: colorVar,
                                        fontFamily: 'var(--mono)',
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {rId}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="c td-mono-b">{fmt(total, 2)}</td>
                        <td className="c td-mono">{nDesc > 0 ? nDesc : '—'}</td>
                        <td className="c td-mono-b">{K > 0 ? fmt(K, 2) : '—'}</td>
                        <td className="c td-mono-b">{Qprob > 0 ? fmt(Qprob, 3) : '—'}</td>
                        <td className="c td-mono">{raizQ > 0 ? fmt(raizQ, 2) : '—'}</td>
                        <td className="c" style={{ padding: '0 1px' }}>
                          <select
                            aria-label="Diámetro diseño"
                            value={matchedOpt?.nominal || ''}
                            disabled={!edit}
                            onChange={(e) => handleDiamChange(ownKey, e.target.value)}
                            style={WaterNetworkDesign_S2}
                          >
                            <option value="">—</option>
                            {DIAM_OPTS.map((o) => (
                              <option key={o.nominal} value={o.nominal}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="c td-mono">{internoMm > 0 ? fmt(internoMm, 2) : '—'}</td>
                        <td className="c td-mono">{cHW}</td>
                        <td
                          className="c"
                          style={{
                            fontWeight: 600,
                            padding: '0 1px',
                            fontSize: 9,
                            background:
                              Vmms > 0 && vCumple
                                ? 'rgba(34,197,94,.25)'
                                : Vmms > 0
                                  ? 'rgba(239,68,68,.25)'
                                  : 'transparent',
                          }}
                        >
                          {Vmms > 0 ? fmt(Vmms, 2) : '—'}
                        </td>
                        <td className="c td-mono">{H > 0 ? fmt(H, 2) : '—'}</td>
                        <td className="c td-mono">{Vvert != null ? fmt(Vvert, 2) : '—'}</td>
                        <td className="c td-mono">{Le > 0 ? fmt(Le, 2) : '—'}</td>
                        <td className="c td-mono-b">{Lt > 0 ? fmt(Lt, 2) : '—'}</td>
                        <td className="c td-mono">{hfPct != null ? fmt(hfPct, 2) : '—'}</td>
                        <td className="c td-mono-b">{hfM != null ? fmt(hfM, 2) : '—'}</td>
                        <td className="c" style={{ padding: '0 1px' }}>
                          <LazyNumInput
                            label="Presión inicial"
                            val={fmt(Pin, 2)}
                            disabled={!edit}
                            onSave={(v) => setPresIni(ownKey, v)}
                          />
                        </td>
                        <td className="c" style={{ padding: '0 1px' }}>
                          <LazyNumInput
                            label="Presión final"
                            val={fmt(Pfin, 2)}
                            disabled={!edit}
                            onSave={(v) => setPresFin(ownKey, v)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {isAf(networkType) && (
        <Acometida
          Qaco={Qaco}
          contadorSel={contadorSel}
          acoContIx={acoContIx}
          setAcoContIx={setAcoContIx}
          acoMonName={resolvedMonName}
          setAcoMonName={setAcoMonName}
          acoRedContDiam={resolvedRedContDiam || ''}
          acoContMonDiam={resolvedContMonDiam || ''}
          acoL1={resolvedL1}
          setAcoL1={setAcoL1}
          acoL2={resolvedL2}
          setAcoL2={setAcoL2}
          acoPini={acoPini}
          setAcoPini={setAcoPini}
          acoLeMed={acoLeMed}
          setAcoLeMed={setAcoLeMed}
          acoHfMax={acoHfMax}
          setAcoHfMax={setAcoHfMax}
          f1={f1}
          f2={f2}
          hfContador={hfContador}
          pResidual={pResidual}
          okPresion={okPresion}
          cHW1={cHW1}
          cHW2={cHW2}
          AF_DIAM_OPTS={DIAM_OPTS}
          isTr1Drawn={isTr1Drawn}
          isTr2Drawn={isTr2Drawn}
          onContDiamChange={handleContDiamChange}
        />
      )}
    </>
  );
}
export default React.memo(WaterNetworkDesign);
