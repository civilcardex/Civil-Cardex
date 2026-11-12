/**
 * Verificaciones de la red por ramales (solo tipologías con red calculada): conexiones hasta la
 * ruta de la bomba, tees con giro en cada nudo, rociadores que fluyen vs dibujados, ramales
 * cubriendo el lado largo y los requisitos extra del sistema seco. Ej: tees faltantes → REVISAR.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { Inflow } from '../types';
import type { ChecksCtx } from './helpers';

/** Conexiones, tees, rociadores dibujados y lado largo en cada tipología con red; las 2 de
 *  SISTEMA SECO (v1.7.80) solo existen si alguna tipología es seca. */
export function verificarRedRamales(ctx: ChecksCtx): void {
  const { tps, tpsRed, addT } = ctx;
  const tR = tpsRed.filter((t) => t.rd);
  if (tR.length) {
    addT(
      'Red por ramales: conexiones completas hasta la ruta de la bomba',
      'NFPA 13-2025 cap. 28',
      ['hidraulica'],
      (t) => ({
        st: t.rd!.errs.length ? 'NO CUMPLE' : 'CUMPLE',
        val: t.rd!.errs.length ? `${t.rd!.errs.length} problema(s)` : t.rd!.desc,
        guide: t.rd!.errs.join(' '),
      }),
      tR,
    );
    const teeOf = (f: Inflow): number => num(f.tipo === 'ramal' ? f.x.r.tee : f.y.t.tee) || 0,
      lbl = (f: Inflow): string =>
        f.tipo === 'ramal'
          ? f.x.nombre
          : `${f.y.t.nombre ? f.y.t.nombre + ' ' : ''}${f.y.de} → ${f.y.a}`;
    addT(
      'Tees con giro en cada nudo (cantidad coherente)',
      'NFPA 13-2025 cap. 28',
      ['hidraulica'],
      (t) => {
        const falta: string[] = [],
          sobra: string[] = [];
        Object.values(t.rd!.nodes)
          .filter((n) => n.solved)
          .forEach((n) => {
            const k = n.inflows.length,
              nt = n.inflows.reduce((a, f) => a + teeOf(f), 0);
            if (k >= 2 && nt < k - 1)
              falta.push(
                `${n.nombre}: llegan ${k} (${n.inflows.map((f) => lbl(f)).join(', ')}), hay ${nt} tee${nt === 1 ? '' : 's'}; se esperan ${k - 1}${k === 2 ? ' (2 si es tee a tope)' : ` a ${k}`}`,
              );
            else if (nt > Math.max(k, 1))
              sobra.push(
                `${n.nombre}: llega${k === 1 ? '' : 'n'} ${k} (${n.inflows.map((f) => lbl(f)).join(', ')}) y hay ${nt} tees; máximo ${Math.max(k, 1)}`,
              );
          });
        const bad = falta.concat(sobra);
        return {
          st: bad.length ? 'REVISAR' : 'CUMPLE',
          val: bad.length
            ? bad.map((x) => 'Nudo ' + x.split(':')[0]).join(', ')
            : 'Coherente en cada nudo',
          guide: `${falta.length ? `Faltan tees. ${falta.map((x) => 'Nudo ' + x).join('. ')}. Cárguela en la tubería cuyo flujo gira al entrar al nudo; la que sigue recta no la lleva; en una tee a tope la llevan las dos. ` : ''}${sobra.length ? `Posible tee duplicada. ${sobra.map((x) => 'Nudo ' + x).join('. ')}. Revise los accesorios de esas tuberías: cada tee con giro se carga una sola vez.` : ''}`,
        };
      },
      tR,
    );
    addT(
      'Rociadores que fluyen ≤ dibujados en cada ramal',
      'Control del dibujo',
      ['hidraulica'],
      (t) => {
        const sobre = t.rd!.rams.filter((x) => x.dib !== null && x.fl > x.dib);
        return {
          st: sobre.length ? 'NO CUMPLE' : 'CUMPLE',
          val: sobre.length
            ? sobre.map((x) => `${x.nombre}: ${x.fl} > ${x.dib}`).join('; ')
            : `${t.rd!.flTot} de ${t.rd!.dibTot || '—'} dibujados`,
          guide:
            "Un ramal no puede tener más rociadores con flujo que los dibujados. Corrija 'Dibujados' o 'Fluyen', o pase los rociadores faltantes al ramal siguiente.",
        };
      },
      tR,
    );
    addT(
      'Ramales con flujo cubren el lado largo del área',
      'NFPA 13-2025 cap. 28',
      ['hidraulica'],
      (t) => {
        const o = t.ro,
          flu = t.rd!.rams.filter((x) => x.fl > 0),
          cortos = flu.slice(0, -1).filter((x) => x.fl < o.Nramal);
        return {
          st: cortos.length ? 'REVISAR' : 'CUMPLE',
          val: cortos.length
            ? cortos.map((x) => `${x.nombre}: ${x.fl} < ${o.Nramal}`).join('; ')
            : `${o.Nramal} por ramal (1,2·√A = ${f1(o.Llargo)} m)`,
          guide: `El lado largo del área exige ${o.Nramal} rociadores por ramal. Si un ramal dibujado es más corto, el área se extiende al ramal siguiente: verifique que la forma del área siga siendo la más desfavorable.`,
        };
      },
      tR,
    );
    /* v1.7.80: las 2 verificaciones de SISTEMA SECO solo existen si alguna tipología es seca. */
    if (tps.some((t) => t.sis === 'Seco')) {
      addT(
        'Rociadores compatibles con el sistema',
        'NFPA 13-2025',
        ['hidraulica'],
        (t) => {
          if (t.sis !== 'Seco')
            return { st: 'CUMPLE', val: 'Sistema húmedo: cualquier tipo', guide: '' };
          const ms = t
            .rd!.rams.map((x) => ({ x, tp: x.r.troc || 'Colgante' }))
            .filter((o) => o.tp === 'Colgante' || o.tp === 'Oculto');
          return {
            st: ms.length ? 'NO CUMPLE' : 'CUMPLE',
            val: ms.length
              ? ms.map((o) => `${o.x.nombre}: ${o.tp.toLowerCase()}`).join('; ')
              : 'Montantes o colgantes secos',
            guide:
              'En sistema seco use montante o colgante seco: un colgante normal deja agua atrapada en la bajante. Cambie el tipo del ramal en Hidráulica → Ramales.',
          };
        },
        tR,
      );
      addT(
        'Sistema seco: requisitos fuera del cálculo',
        'NFPA 13-2025 cap. 8',
        ['entradas', 'clas.sistema'],
        (t) =>
          t.sis !== 'Seco'
            ? { st: 'CUMPLE', val: 'Sistema húmedo', guide: '' }
            : {
                st: 'REVISAR',
                val: 'Sistema seco',
                guide:
                  'El caudal y la presión ya incluyen el área +30 % y C = 100. Diseñe aparte, según NFPA 13: tiempo de llegada del agua o volumen máximo del sistema, válvula seca y fuente de aire, drenajes y pendiente de la tubería. Use rociadores montantes o colgantes secos y materiales permitidos para sistema seco.',
              },
        tR,
      );
    }
  }
}
