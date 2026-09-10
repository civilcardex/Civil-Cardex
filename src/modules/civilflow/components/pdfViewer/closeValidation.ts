// Validación de cierre del visor: se ejecuta al pulsar "Cerrar dibujo" en la barra de redes.
// Bloquea el cierre (con alerta) mientras haya ramales sin UC/UD, elementos sin diámetro o
// bajantes con diámetro inferior al del ramal conectado. Devuelve true si el dibujo puede
// guardarse y cerrarse, false si se levantó alguna alerta.
import { loadFromStorage } from '../../services/storageService';
import { distToPolyline } from '../../lib/shared/geometry';
import type { PlanTrazos } from '../../services/storageService';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { pisoLbl } from '../../constants';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanItem } from '../../context/PlansContext';

type RevisarRamalInput = {
  net?: string;
  id?: string;
  label?: string;
  tipo?: string;
  uc?: number;
  aparatoInicio?: string;
  aparatoFin?: string;
  accesorioInicio?: string;
  accesorioFin?: string;
  fixtures?: Record<string, number>;
  pts?: number[][];
  _tribReversed?: boolean;
  mergesFrom?: unknown;
};

/** Validación de cierre del visor: alerta si hay ramales sin UC/UD, elementos sin diámetro o
 *  bajantes con diámetro menor al del ramal conectado. Devuelve true si el dibujo puede
 *  guardarse y cerrarse. */
export function validateBeforeClose(
  eng: PlanoEngine,
  planos: PlanItem[] | undefined,
  onAlert: (title: string, msg: string) => void,
): boolean {
  // Ítem 10: antes de validar diámetros, todo ramal/tributario debe tener UC/UD o un
  // aparato/accesorio en sus extremos — un ramal sin carga aguas abajo produce una fila
  // vacía en las tablas de diseño. El UC/UD real se asigna en las tablas de diseño vía
  // los conteos de aparatos (fixtures en APARATOS_BY_TRAMO_KEY, clave
  // `${net}_${id}_${planId}`), no en el campo `uc` del motor (que nace en 0) — se lee
  // ese mapa para no marcar ramales que ya tienen UC asignado. Exclusiones confirmadas:
  // red vent (no lleva UC), los Ldesvio de bajante (auto LD_*) y los stubs automáticos
  // de tapón. Los tramos auto-creados por splits (mergesFrom) SÍ se validan: son la
  // continuación aguas abajo que acumula el UC de la cadena.
  const planId = eng._loadedPlanId;
  const aparatosMap = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  // Ítem 10: las exclusiones confirmadas son vent, Ldesvio automáticos (LD_*) y stubs de
  // tapón — más las uniones tee en extremos (la tee conecta ramas que cargan su propio
  // UC/UD). Los tramos auto-creados por splits (mergesFrom) NO se excluyen: acumulan el
  // UC de la cadena y deben aparecer si nadie les asignó aparatos. Lo demás — un extremo
  // con codo, un tributario sin derivación visible, etc. — SÍ se lista si no tiene UC/UD.
  const TEE_END_IDS = new Set([
    'teeDirecto',
    'teeReduccion',
    'teeLado',
    'teeSube',
    'teeBaja',
    'teeTapon',
    'teeLlaveTerminal',
    'te_linea',
    'te_ramal',
  ]);
  const sinUc: { label: string; r: RevisarRamalInput; planFor: number | string | null }[] = [];
  // Tramos CON carga propia (uc/aparatos/fixtures/mapa): alimentadores potenciales del grafo.
  const conUd: { r: RevisarRamalInput; planFor: number | string | null }[] = [];
  const revisados = new Set<string>();
  /** @returns true si el tramo queda CUBIERTO (con carga o no evaluable) — false si se flaggeó. */
  const revisarRamal = (r: RevisarRamalInput, planFor: number | string | null): boolean => {
    if (!r.net || !r.id) return true;
    // Los tramos auto-creados por suma de flujo (mergesFrom, continuación de una
    // bifurcación) ya llevan las UC/UD acumuladas según la dirección de flujo — no
    // deben disparar la alerta de pendientes.
    if (r.mergesFrom) return true;
    // La clave de dedupe INCLUYE el plan: el mismo id de ramal puede existir en
    // varios planos confirmados (pisos replicados), y uno con fixtures en un plano no
    // exime al mismo id en otro — sin el plan, el primer barrido marcaba "revisado" al
    // resto y la lista de UC/UD pendientes quedaba incompleta.
    const clave = `${r.net}_${r.id}_${planFor ?? 'engine'}`;
    if (revisados.has(clave)) return true;
    revisados.add(clave);
    if (r.net === 'vent') return true;
    if (r.id.startsWith('LD_')) return true;
    if (r.accesorioFin === 'tapon' || r.accesorioInicio === 'tapon') return true;
    const tipo = r.tipo || 'ramal';
    if (tipo !== 'ramal' && tipo !== 'tributario') return true;
    if ((r.uc || 0) > 0) {
      conUd.push({ r, planFor });
      return true;
    }
    if (r.aparatoInicio || r.aparatoFin) {
      conUd.push({ r, planFor });
      return true;
    }
    // Aparatos persistidos EN el elemento (PlanoRamal.fixtures — writeDiameterToDrawing/sync los
    // escriben): es carga asignada, igual que el mapa — sin esto, convertir ramal↔tributario
    // (o cualquier edición que recree el tramo) disparaba "UC/UD pendientes" con aparatos vivos
    // (orig. usuario).
    if (r.fixtures && Object.values(r.fixtures).some((v) => Number(v) > 0)) {
      conUd.push({ r, planFor });
      return true;
    }
    if (TEE_END_IDS.has(r.accesorioInicio || '') || TEE_END_IDS.has(r.accesorioFin || ''))
      return true;
    {
      // Cobertura por id Y por etiqueta: datos históricos podem keyear aparatos con la
      // etiqueta visible (T2RS7) mientras el id del engine es un uniq — sin esto el aviso
      // disparaba con aparatos visibles en el panel (orig. usuario).
      const prefixes = [`${r.net}_${r.id}`];
      if (r.label && r.label !== r.id) prefixes.push(`${r.net}_${r.label}`);
      const hasFixtures = Object.keys(aparatosMap).some(
        (k) =>
          prefixes.some((prefix) => k === prefix || k.startsWith(prefix + '_')) &&
          Object.keys(aparatosMap[k]).length > 0,
      );
      if (hasFixtures) {
        conUd.push({ r, planFor });
        return true;
      }
    }
    sinUc.push({ label: r.label || r.id, r, planFor });
    return false;
  };
  // El nivel CARGADO es la autoridad para su net_id Y su ETIQUETA: los pisos replicados
  // guardan copias con ids uniq DISTINTOS pero la misma etiqueta (T3 en P1 y T3 en P2) — si el
  // T3 visible está cubierto, la copia sin aparatos de otro plano no dispara la alerta: el
  // usuario ve sus UDs asignadas y el aviso era un falso positivo por piso (orig. usuario:
  // T3 con 2 UD recibía el aviso tras borrar un segmento del brazo de la doble).
  const engineCovered = new Set<string>();
  const engineCoveredLabels = new Set<string>();
  for (const r of eng.ramales) {
    if (revisarRamal(r, planId)) {
      engineCovered.add(`${r.net}_${r.id}`);
      if (r.label) engineCoveredLabels.add(`${r.net}_${r.label}`);
    }
  }
  // El engine solo ve el NIVEL cargado — un nivel sin los planos confirmados restantes
  // dejaba la lista incompleta (ramales de otros planos sin UC/UD no salían). Se barren
  // los trazos guardados de cada plano confirmado con el mismo criterio, deduplicando
  // por red+id (el plano actual ya quedó cubierto por el engine).
  for (const plan of (planos || []).filter((p) => p.status === 'confirmed')) {
    const raw = loadFromStorage<PlanTrazos | string | null>(TRAZOS_PREFIX + String(plan.id), null);
    if (!raw) continue;
    let data: PlanTrazos | null = null;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw) as PlanTrazos;
      } catch {
        continue;
      }
    } else {
      data = raw;
    }
    if (!data) continue;
    for (const r of (data.ramales || []) as RevisarRamalInput[]) {
      if (engineCovered.has(`${r.net}_${r.id}`)) continue;
      if (r.label && engineCoveredLabels.has(`${r.net}_${r.label}`)) continue;
      const antes = sinUc.length;
      if (!revisarRamal(r, plan.id)) {
        sinUc[antes].label += ` (${plan.name || 'Plano ' + plan.id})`;
      }
    }
  }
  // Alineado con las tablas: un tramo sin carga PROPIA pero que RECIBE la descarga de otro
  // tramo CON UD no produce fila vacía (su UD llega por el grafo) — no se avisa. Sin esto,
  // receptores con UD visible agregada disparaban el aviso (orig. usuario).
  const vivos = sinUc.filter(({ r }) => {
    const rPts = r.pts;
    if (!rPts || rPts.length < 2) return true;
    return !conUd.some(({ r: o }) => {
      if (o.net !== r.net || o.id === r.id) return false;
      const oPts = o.pts;
      if (!oPts || oPts.length < 2) return false;
      const dest = o._tribReversed ? oPts[0] : oPts[oPts.length - 1];
      return distToPolyline(dest, rPts) < 2.0;
    });
  });
  if (vivos.length > 0) {
    // Lista COMPLETA — recortarla a 8 ocultaba elementos pendientes (reporte: "la
    // alerta no muestra todos los elementos con UC/UD pendientes").
    const lista = vivos.map((e) => e.label).join(', ');
    onAlert(
      'UC/UD pendientes',
      `${vivos.length} ramal(es) sin UC/UD asignado: ${lista}. Asigna unidades de descarga o aparatos antes de cerrar el dibujo.`,
    );
    return false;
  }
  // Todo elemento de tubería debe llevar diámetro antes de poder cerrar el dibujo — un
  // ramal/tributario con diametro vacío (o una bajante/montante sin dNominal)
  // produciría una tabla de diseño/memoria rota. Bloquear el cierre y listar los
  // elementos faltantes en lugar de guardar silenciosamente un dibujo incompleto.
  const { sinDiam, inferior } = revisarDiametros(eng.ramales, eng.bajantes);
  if (sinDiam.length > 0) {
    onAlert(
      'Diámetros pendientes',
      `${sinDiam.length} elemento(s) sin diámetro asignado: ${formatLista(sinDiam)}. Asigna los diámetros antes de cerrar el dibujo.`,
    );
    return false;
  }
  if (inferior.length > 0) {
    onAlert(
      'Diámetro no permitido',
      `Bajante(s)/montante(s) con diámetro inferior al del ramal conectado: ${formatLista(inferior)}. Ajusta los diámetros antes de cerrar el dibujo.`,
    );
    return false;
  }
  // Validación GLOBAL (orig. usuario): los pisos NO cargados también deben cumplir antes de
  // cerrar. Con el prefetch global de trazos cada plano confirmado tiene caché local en este
  // punto; sin ella, el piso se salta (comportamiento anterior: se podía cerrar igual).
  for (const plan of (planos || []).filter(
    (p) => p.status === 'confirmed' && String(p.id) !== String(planId ?? ''),
  )) {
    const data = leerTrazos(plan.id);
    if (!data) continue;
    const piso = plan.nivel != null ? `${pisoLbl(Number(plan.nivel))}: ` : '';
    const otro = revisarDiametros(
      (data.ramales || []) as DiamRamales,
      (data.bajantes || []) as DiamBajantes,
    );
    if (otro.sinDiam.length > 0) {
      onAlert(
        'Diámetros pendientes',
        `${piso}${otro.sinDiam.length} elemento(s) sin diámetro asignado: ${formatLista(otro.sinDiam)}. Asigna los diámetros antes de cerrar el dibujo.`,
      );
      return false;
    }
    if (otro.inferior.length > 0) {
      onAlert(
        'Diámetro no permitido',
        `${piso}Bajante(s)/montante(s) con diámetro inferior al del ramal conectado: ${formatLista(otro.inferior)}. Ajusta los diámetros antes de cerrar el dibujo.`,
      );
      return false;
    }
  }
  return true;
}

type DiamRamales = Array<{ id?: string; label?: string; diametro?: string }>;
type DiamBajantes = Array<{
  id?: string;
  code?: string;
  tipo?: string;
  dNominal?: string;
  recibeDeIds?: string[];
}>;

/** Lista recortada a 8 elementos con sufijo "y N más" — mismo formato en piso local y global. */
function formatLista(items: string[]): string {
  return `${items.slice(0, 8).join(', ')}${items.length > 8 ? ` y ${items.length - 8} más` : ''}`;
}

/** Lee la caché local de trazos de un piso (acepta JSON en crudo); null si no hay o está rota. */
function leerTrazos(id: string | number): PlanTrazos | null {
  const raw = loadFromStorage<PlanTrazos | string | null>(TRAZOS_PREFIX + String(id), null);
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as PlanTrazos;
  } catch {
    return null;
  }
}

/** Revisión de diámetros de un conjunto de trazos: elementos sin diámetro y bajantes/montantes
 *  con diámetro inferior al del ramal conectado. Los Ldesvio (LD_) se excluyen de "sin
 *  diámetro": espejan el dNominal de su bajante y lo duplicarían en la alerta. */
function revisarDiametros(ramales: DiamRamales, bajantes: DiamBajantes) {
  const sinDiam = [
    ...ramales
      .filter((r) => !r.diametro && !r.id?.startsWith('LD_'))
      .map((r) => r.label || r.id || ''),
    ...bajantes
      .filter((b) => (b.tipo === 'bajante' || b.tipo === 'montante') && !b.dNominal)
      .map((b) => b.code || b.id || ''),
  ].filter(Boolean);
  const inferior: string[] = [];
  for (const b of bajantes) {
    if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
    if (!b.dNominal) continue;
    const bIn = diamPulgFromLabel(String(b.dNominal).replace(/-/g, ' '));
    if (bIn <= 0) continue;
    for (const rid of b.recibeDeIds || []) {
      const ram = ramales.find((r) => r.id === rid);
      if (!ram || !ram.diametro) continue;
      const ramIn = diamPulgFromLabel(String(ram.diametro).replace(/-/g, ' '));
      if (ramIn > 0 && ramIn > bIn) {
        inferior.push(`${b.code || b.id} (${ram.label || ram.id} ${ram.diametro})`);
        break;
      }
    }
  }
  return { sinDiam, inferior };
}
