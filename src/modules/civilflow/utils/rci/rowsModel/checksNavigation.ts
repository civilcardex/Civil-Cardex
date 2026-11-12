/** Mapa de navegación de las verificaciones del diseño RCI (Red Contra Incendio): a qué sección
 *  de la pantalla salta cada "Ir al dato" y cómo se agrupan las 44 verificaciones del compute
 *  para la tabla. Puro: sin React ni storage.
 *  Ej: grupoDeCheck({ go: ['tipologias', 'clas.riesgo'], … }) = 'tipologias'. */
import type { Verificacion } from '../../../lib/rci/types.ts';

/* ============================ Sección 7: verificaciones ============================ */

/** Los grupos de verificaciones y el ancla a la que salta "Ir al dato": el id es el ancla
 *  `rci-<id>` de cada sección de la pantalla de diseño. */
export const GRUPOS_CHECK: { id: string; l: string }[] = [
  { id: 'normativa', l: 'Normativa local' },
  { id: 'tipologias', l: 'Tipologías' },
  { id: 'rociadores', l: 'Rociadores' },
  { id: 'hidraulica', l: 'Hidráulica' },
  { id: 'montantes', l: 'Montante y siamesa' },
  { id: 'bomba', l: 'Bomba y tanque' },
  { id: 'generales', l: 'Generales' },
];

/** Grupo (ancla) al que pertenece una verificación: manda el campo "go" del motor (a dónde ir a
 *  corregir el dato). Ej: clas.riesgo → 'tipologias', sia.L → 'montantes'. */
export function grupoDeCheck(v: Verificacion): string {
  const go0 = v.go?.[0] || '';
  const go1 = v.go?.[1] || '';
  /* v1.7.80: las 2 verificaciones de sistema seco viven en el grupo Rociadores (como el HTML),
     aunque sus «Ir al dato» apunten a Hidráulica/Tipologías. */
  if (v.lab === 'Rociadores compatibles con el sistema' || v.lab.startsWith('Sistema seco:'))
    return 'rociadores';
  /* Distancia de ramales a muros (ped. usuario): grupo Rociadores (depende de Dmuro). */
  if (v.lab === 'Distancia de ramales a muros ≤ Dmuro') return 'rociadores';
  if (go0 === 'tipologias' || go0 === 'pisos' || go1.startsWith('piso:')) return 'tipologias';
  if (go1.startsWith('local.') || go0 === 'sismo') return 'normativa';
  if (go1.startsWith('clas.') || go1.startsWith('roc.')) return 'tipologias';
  if (go1.startsWith('mont.') || go1.startsWith('sia.') || go1.startsWith('sp.'))
    return 'montantes';
  if (go1.startsWith('bomba.') || go1.startsWith('tanque.') || go1.startsWith('mang.'))
    return 'bomba';
  if (go1.startsWith('tub.') || go0 === 'hidraulica') return 'hidraulica';
  return 'generales';
}

/** Un grupo de verificaciones ya armado para la tabla. */
interface GrupoChecks {
  id: string;
  l: string;
  items: Verificacion[];
}

/** Agrupa las 44 verificaciones del compute por sección de la pantalla (una sola pasada con
 *  mapa; los grupos sin items no se devuelven). Ej: filasVerificaciones(R.checks) del ejemplo
 *  reparte sus 44 CUMPLE entre los 6 grupos. */
export function filasVerificaciones(checks: Verificacion[]): GrupoChecks[] {
  const porGrupo = new Map<string, Verificacion[]>();
  for (const v of checks) {
    const g = grupoDeCheck(v);
    const lista = porGrupo.get(g);
    if (lista) lista.push(v);
    else porGrupo.set(g, [v]);
  }
  const grupos: GrupoChecks[] = [];
  for (const { id, l } of GRUPOS_CHECK) {
    const items = porGrupo.get(id);
    if (items && items.length) grupos.push({ id, l, items });
  }
  return grupos;
}
