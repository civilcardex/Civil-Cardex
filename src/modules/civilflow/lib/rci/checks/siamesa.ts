/**
 * Verificaciones de la siamesa (conexión de bomberos, NFPA 14): presión requerida, altura sobre
 * el andén, tubería mínima 4", cheque sin válvula de cierre, drenaje automático, cantidad en
 * edificio alto e hidrante cercano. Ej: sin datos → "Faltan datos de la siamesa" en PENDIENTE.
 */
import { PIPES } from '../tables';
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Las 7 verificaciones de la siamesa; solo aplican si hay siamesa calculada (R.sia). */
export function verificarSiamesa(ctx: ChecksCtx): void {
  const { R, add } = ctx;
  if (R.sia) {
    const SI = R.sia,
      S = SI.S,
      f1p = (x: number | null): string => f1(x, 1),
      hh = num(S.h),
      pipe = PIPES[S.mat] && PIPES[S.mat][S.dn];
    add(
      'Siamesa: presión requerida en las entradas',
      SI.P === null ? 'PENDIENTE' : 'CUMPLE',
      SI.P === null
        ? 'Faltan datos de la siamesa'
        : `${f1p(SI.P)} psi con ${f1p(SI.Q)} gpm${SI.P > 150 ? ' · se indica en el letrero' : ''}`,
      'NFPA 14-2024',
      'Complete material, diámetro y longitud de la tubería de la siamesa (Entradas → Siamesa).',
      ['entradas', 'sia.L'],
    );
    add(
      'Siamesa: altura de la conexión 0,46–1,22 m sobre el andén',
      hh === null ? 'PENDIENTE' : hh >= 0.46 - 1e-9 && hh <= 1.22 + 1e-9 ? 'CUMPLE' : 'NO CUMPLE',
      hh === null ? 'Sin dato' : `${f1(hh)} m`,
      'NFPA 14-2024',
      'Ubique las entradas entre 0,46 y 1,22 m (18 y 48 in) sobre el nivel del andén.',
      ['entradas', 'sia.h'],
    );
    add(
      'Siamesa: tubería de 4" como mínimo',
      !pipe ? 'PENDIENTE' : pipe.inch >= 4 - 1e-9 ? 'CUMPLE' : 'NO CUMPLE',
      pipe ? `${S.dn}` : 'Sin diámetro',
      'NFPA 13-2025 / NFPA 14-2024',
      'Use tubería de 4" o mayor entre la siamesa y el sistema.',
      ['entradas', 'sia.dn'],
    );
    const okV = (num(S.chq) || 0) >= 1 && S.cierre !== 'Sí';
    add(
      'Siamesa: cheque listado y sin válvula de cierre',
      okV ? 'CUMPLE' : 'NO CUMPLE',
      `${num(S.chq) || 0} cheque(s)${S.cierre === 'Sí' ? ' · con válvula de cierre' : ''}`,
      'NFPA 14-2024',
      `${(num(S.chq) || 0) < 1 ? 'Instale un cheque listado en la tubería de la siamesa. ' : ''}${S.cierre === 'Sí' ? 'No se permite válvula de cierre entre la siamesa y el sistema.' : ''}`,
      ['entradas', (num(S.chq) || 0) < 1 ? 'sia.chq' : 'sia.cierre'],
    );
    add(
      'Siamesa: drenaje automático entre la siamesa y el cheque',
      S.drenaje === 'Sí' ? 'CUMPLE' : 'REVISAR',
      S.drenaje === 'Sí' ? 'Previsto' : 'No previsto',
      'NFPA 13-2025',
      'Prevea una válvula de drenaje automático entre la siamesa y el cheque, para que la tubería no quede con agua.',
      ['entradas', 'sia.drenaje'],
    );
    if (SI.alto)
      add(
        'Siamesa: dos o más en edificio alto',
        (num(S.n) || 1) >= 2 ? 'CUMPLE' : 'NO CUMPLE',
        `${num(S.n) || 1} siamesa(s); salida más alta a más de 22,9 m de la siamesa`,
        'NFPA 14-2024',
        'En edificios altos, NFPA 14 exige al menos dos siamesas alejadas entre sí por zona.',
        ['entradas', 'sia.n'],
      );
    const dh = num(S.hidrante);
    add(
      'Siamesa: hidrante cercano',
      dh === null ? 'PENDIENTE' : dh <= 30.5 ? 'CUMPLE' : 'REVISAR',
      dh === null ? 'Sin dato' : `${f1(dh, 1)} m`,
      'NFPA 14-2024 / autoridad',
      'La siamesa debe quedar cerca de un hidrante; la distancia la fija la autoridad (lo usual: 30,5 m / 100 ft o menos).',
      ['entradas', 'sia.hidrante'],
    );
  }
}
