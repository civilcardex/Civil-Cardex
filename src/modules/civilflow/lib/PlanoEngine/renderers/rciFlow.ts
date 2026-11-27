import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { extraerRedDePiso } from '../../../utils/rci/extractNetwork/pipeline.ts';

/* H-12 (remediación 2026-11-27): la caché usa la REVISIÓN del motor (contador que _markDirty
 * avanza en cada edición) en vez de reconstruir la firma JSON completa de la red por fotograma
 * — con 6.000 ramales el stringify dominaba el pan/zoom con caché caliente. PlanId en la clave
 * cubre el cambio de plano; la revisión cubre geometría, accesorios y conexiones. */
const memo = new WeakMap<
  IPlanoEngineCore,
  { rev: number; planId: string; sentidos: ReadonlyMap<string, boolean> }
>();

/** Reusa la conexión de la red calculada para que la flecha apunte hacia el extremo remoto. */
export function flujoRciDelPlano(engine: IPlanoEngineCore): ReadonlyMap<string, boolean> {
  const planId = String(engine._loadedPlanId ?? '');
  const rev = (engine as { _revRciFlujo?: number })._revRciFlujo ?? 0;
  const previo = memo.get(engine);
  if (previo && previo.rev === rev && previo.planId === planId) return previo.sentidos;
  const ramales = engine.ramales.filter((r) => r.net === 'rci');
  const ghosts = engine.crossFloorGhosts.filter((g) => g.net === 'rci');

  const res = extraerRedDePiso(
    {
      planId: String(engine._loadedPlanId ?? ''),
      label: '',
      doc: {
        ramales: ramales.map((r) => ({ ...r })),
        bajantes: engine.bajantes.filter((b) => b.net === 'rci').map((b) => ({ ...b })),
        crossFloorGhosts: ghosts,
      },
    },
    0,
    [],
  );
  const sentidos = res.flujoDesdeFin ?? new Map<string, boolean>();
  memo.set(engine, { rev, planId, sentidos });
  return sentidos;
}

const esRociador = (s: string | undefined): boolean => !!s && /rociador/i.test(s);

/** Sin derivación resuelta, el primer rociador dibujado orienta el ramal provisional. */
export function sentidoRciDesdeFin(r: PlanoRamal, sentidos: ReadonlyMap<string, boolean>): boolean {
  return sentidos.get(r.id) ?? (esRociador(r.accesorioInicio) && !esRociador(r.accesorioFin));
}
