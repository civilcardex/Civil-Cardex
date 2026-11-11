/**
 * Verificaciones del perfil del edificio (R.edif): tipologías con red calculada, holgura de la
 * bomba en la derivación de cada piso, presión estática vs componentes (VRP), válvula reguladora
 * en salidas de manguera y presión máxima del sistema. Ej: un piso sin holgura → NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import type { ChecksCtx } from './helpers';

/** Las 5 verificaciones que solo aplican cuando hay edificio con tipologías y perfil de pisos. */
export function verificarEdificio(ctx: ChecksCtx): void {
  const { R, add } = ctx;
  if (R.edif) {
    const E = R.edif,
      f2 = (x: number): string => f1(x, 1);
    const pend = Object.values(E.typ).filter((t) => !t.ok);
    add(
      'Redes de todas las tipologías calculadas',
      pend.length ? 'PENDIENTE' : 'CUMPLE',
      pend.length
        ? pend.map((t) => `${t.g.id}${t.pend ? ' (sin red)' : ' (incompleta)'}`).join(', ')
        : `${Object.keys(E.typ).length} tipología(s)`,
      'Perfil de presiones',
      'Seleccione cada tipología en Hidráulica y complete su red hasta la derivación del montante. Sin su red, sus pisos no entran en el perfil ni en la bomba.',
      ['hidraulica'],
    );
    const fal = E.pf.filter((o) => o.res && o.res.valid && !o.okH);
    add(
      'Holgura en la derivación de cada piso ≥ mínima',
      fal.length ? 'NO CUMPLE' : E.pf.some((o) => o.okH) ? 'CUMPLE' : 'PENDIENTE',
      fal.length
        ? fal.map((o) => `${o.f.nombre}: ${f2(o.holg!)}`).join('; ')
        : `Mínima ${f2(E.hmin!)} psi`,
      'NFPA 13-2025 / NFPA 20-2025',
      'La bomba no entrega la presión requerida en esos pisos con su caudal. Aumente el margen de presión de la bomba, el diámetro del montante o de la ruta del cuarto de bombas.',
      ['entradas', 'bomba.margen'],
    );
    {
      const fa = E.pf.filter((o) => o.vrpFalta),
        on = E.pf.filter((o) => o.vrp),
        pIdx = (o: (typeof fa)[number]) => `piso:${o.f.i}:vrp`;
      add(
        'Presión estática en las derivaciones ≤ presión de componentes',
        fa.length ? 'NO CUMPLE' : 'CUMPLE',
        fa.length
          ? `Sin VRP en ${fa.map((o) => `${o.f.nombre} (${f2(o.Pst!)} psi)`).join(', ')}`
          : on.length
            ? `VRP en ${on.map((o) => `${o.f.nombre} (ajuste ≈ ${o.vrpSet ?? '—'} psi)`).join(', ')}`
            : `Máx. ${f2(Math.max(0, ...E.pf.filter((o) => o.Pst !== undefined).map((o) => o.Pst!)))} psi`,
        'NFPA 13-2025',
        `La estática en la derivación supera ${f2(E.Pc!)} psi en ${fa.map((o) => o.f.nombre).join(', ')}. Deje la VRP en «Auto» o «Sí» en la tabla de pisos (Tipologías), o use componentes de mayor presión.`,
        ['pisos', fa.length ? pIdx(fa[0]) : ''],
      );
    }
    {
      const fa = E.pf.filter((o) => o.regFalta),
        on = E.pf.filter((o) => o.reg),
        why = (o: (typeof fa)[number]): string =>
          o.regEst ? `estática ${f2(o.PstS!)} psi > 175` : `residual 1½" ${f2(o.res15!)} psi > 100`;
      add(
        'Salidas de manguera: presión dentro de límites (válvula reguladora)',
        fa.length ? 'NO CUMPLE' : 'CUMPLE',
        fa.length
          ? `Sin válvula reguladora en ${fa.map((o) => `${o.f.nombre} (${why(o)})`).join(', ')}`
          : on.length
            ? `Válvula reguladora en ${on.map((o) => o.f.nombre).join(', ')}`
            : 'No se requieren',
        'NFPA 14-2024',
        `NFPA 14 exige válvula reguladora en la salida cuando la residual de 1½" supera 100 psi o la estática de cualquier salida supera 175 psi. Deje «Válv. reguladora» en «Auto» o «Sí» para ${fa.map((o) => o.f.nombre).join(', ')} en la tabla de pisos (Tipologías).`,
        ['pisos', fa.length ? `piso:${fa[0].f.i}:vreg` : ''],
      );
    }
    add(
      'Presión máxima en el punto más bajo ≤ 350 psi',
      E.PstMax! <= 350 ? 'CUMPLE' : 'NO CUMPLE',
      `${f2(E.PstMax!)} psi`,
      'NFPA 14-2024',
      'Divida el sistema en zonas de presión (bombas en serie o por zonas) o reduzca la presión de cierre (curva más plana de la bomba).',
      ['entradas', 'bomba.fchurn'],
    );
  }
}
