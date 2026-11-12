/**
 * Verificaciones de la bomba (NFPA 20): demandas dentro de la curva, presión a caudal cero
 * (churn), presión máxima del sistema, succión positiva y en la brida, velocidad y diámetro de
 * succión, NPSH disponible y bomba jockey. Ej: churn 1,5 → "150 %" en NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { Demanda } from '../types';
import type { ChecksCtx } from './helpers';

/** Las 10 verificaciones de la bomba: curva, churn, presión máxima, succión, NPSH y jockey. */
export function verificarBombas(ctx: ChecksCtx): void {
  const { st, R, tps, add } = ctx;
  const bo = R.bomba;
  const okCurve = (d: Demanda | null): boolean =>
    !!d && d.Q <= 1.5 * bo.Qnom + 1e-9 && (d.disp as number) >= d.P - 1e-6;
  const guideCurve = (d: Demanda | null): string =>
    d && d.Q > 1.5 * bo.Qnom
      ? 'La demanda supera el 150 % del caudal nominal: indique un caudal nominal mayor.'
      : 'Aumente el margen de presión o seleccione una bomba con curva más alta en ese caudal.';
  add(
    'Demanda de rociadores dentro de la curva de la bomba',
    okCurve(bo.D1) ? 'CUMPLE' : 'NO CUMPLE',
    `${f1(bo.D1.disp, 1)} ≥ ${f1(bo.D1.P, 1)} psi`,
    'NFPA 20-2025',
    guideCurve(bo.D1),
    ['entradas', 'bomba.margen'],
  );
  add(
    'Demanda de montantes dentro de la curva de la bomba',
    !bo.D2 ? 'CUMPLE' : okCurve(bo.D2) ? 'CUMPLE' : 'NO CUMPLE',
    bo.D2 ? `${f1(bo.D2.disp, 1)} ≥ ${f1(bo.D2.P, 1)} psi` : 'No aplica',
    'NFPA 20-2025 / NFPA 14-2024',
    guideCurve(bo.D2),
    ['entradas', 'bomba.margen'],
  );
  const fch = num(st.bomba.fchurn) || 1.2;
  add(
    'Presión a caudal cero ≤ 140 % de la nominal',
    fch <= 1.4 ? 'CUMPLE' : 'NO CUMPLE',
    `${Math.round(fch * 100)} %`,
    'NFPA 20-2025',
    'Seleccione una bomba con curva más plana: el factor de churn del fabricante debe ser 1,40 o menor.',
    ['entradas', 'bomba.fchurn'],
  );
  const Pc = num(st.tub.Pcomp) || 175;
  add(
    'Presión máxima del sistema ≤ presión de componentes',
    bo.Pmaxsis <= Pc ? 'CUMPLE' : 'NO CUMPLE',
    `${f1(bo.Pmaxsis, 1)} ≤ ${Pc} psi`,
    'NFPA 13-2025 / NFPA 20-2025',
    `Exceso de ${f1(bo.Pmaxsis - Pc, 1)} psi. Opciones: bomba con curva más plana, válvula de alivio según NFPA 20, componentes clase 300 o reducir la presión de diseño (p. ej. revisar la clase de montantes).`,
    ['entradas', 'bomba.fchurn'],
  );
  {
    const zF = num(st.bomba.zFondo),
      hm = num(st.bomba.hmin) || 0,
      ok = zF !== null ? zF >= 0 : hm >= 0;
    add(
      'Succión positiva: fondo del tanque al nivel del eje de la bomba o por encima',
      ok ? 'CUMPLE' : 'NO CUMPLE',
      zF !== null
        ? `Fondo del tanque ${f1(zF)} m sobre el eje`
        : `Nivel mínimo ${f1(hm)} m (falta la cota del fondo del tanque)`,
      'NFPA 20-2025',
      `Con bomba horizontal, el fondo del tanque debe quedar al nivel del eje o por encima (faltan ${f1(-(zF !== null ? zF : hm))} m): baje el cuarto de bombas o eleve el tanque, sin válvula de pie. Si no es posible, use bomba de turbina vertical o tanque en superficie.`,
      ['entradas', zF !== null ? 'bomba.zFondo' : 'bomba.hmin'],
    );
    const ps = Math.min(bo.D1 ? bo.D1.Psuc : 0, bo.D2 ? bo.D2.Psuc : 0);
    add(
      'Presión en la brida de succión ≥ −3 psi con el nivel mínimo',
      ps >= -3 ? 'CUMPLE' : 'NO CUMPLE',
      `${f1(ps, 1)} psi con la mayor demanda`,
      'NFPA 20-2025',
      `Con tanque, NFPA 20 admite hasta −3 psi en la brida de succión con el nivel más bajo. Suba el nivel mínimo sobre el eje, aumente el diámetro o reduzca la longitud y los accesorios de la succión.`,
      ['entradas', 'bomba.hmin'],
    );
  }
  /* ponytail: succión con par matSuc/dnSuc fuera de PIPES → IDs=NaN en pump.ts (pfUnit/Vsuc
     dan NaN): estos checks dependen de la succión y pasan a PENDIENTE (dato faltante) en vez de
     NO CUMPLE con "—". Ej: CPVC SDR 13,5 con 5" (el catálogo CPVC llega hasta 3"). */
  const sinSuc = !isFinite(bo.IDs);
  add(
    'Velocidad en succión al 150 % ≤ 4,57 m/s',
    sinSuc ? 'PENDIENTE' : bo.Vsuc <= 4.57 ? 'CUMPLE' : 'NO CUMPLE',
    sinSuc ? 'Sin datos de succión' : `${f1(bo.Vsuc)} m/s`,
    'NFPA 20-2025',
    sinSuc
      ? 'El material/diámetro de la succión no existe en el catálogo de tuberías: revise matSuc/dnSuc en Entradas → Bomba.'
      : `Aumente la succión a un diámetro interno de ${f1(bo.DintReq, 0)} mm o más.`,
    ['entradas', 'bomba.dnSuc'],
  );
  add(
    'Diámetro de succión ≥ mínimo de tabla',
    sinSuc ? 'PENDIENTE' : bo.DsucAd >= bo.DsucMin ? 'CUMPLE' : 'NO CUMPLE',
    sinSuc ? 'Sin datos de succión' : `${bo.DsucAd} ≥ ${bo.DsucMin} pulg`,
    'NFPA 20-2025, tabla resumen',
    sinSuc
      ? `Complete material y diámetro de la succión (se pide ${bo.DsucMin}" o mayor para ${bo.Qnom} gpm).`
      : `Use succión de ${bo.DsucMin}" o mayor para ${bo.Qnom} gpm.`,
    ['entradas', 'bomba.dnSuc'],
  );
  const npshr = num(st.bomba.npshr) || 0,
    mg = num(st.bomba.margenNpsh) || 0;
  add(
    'NPSH disponible ≥ NPSH requerido + margen',
    sinSuc ? 'PENDIENTE' : bo.NPSHd >= npshr + mg ? 'CUMPLE' : 'NO CUMPLE',
    sinSuc ? 'Sin datos de succión' : `${f1(bo.NPSHd)} ≥ ${f1(npshr + mg)} m`,
    'Fabricante / NFPA 20-2025',
    sinSuc
      ? 'Sin catálogo para la succión no hay NPSH disponible: revise matSuc/dnSuc.'
      : `Faltan ${f1(npshr + mg - bo.NPSHd)} m de NPSH. Pase a succión positiva, acorte la succión y reduzca accesorios, aumente el diámetro o elija una bomba con menor NPSHr.`,
    ['entradas', 'bomba.npshr'],
  );
  {
    const q1 = Math.min(...tps.map((t) => t.ro.Q1)),
      tq = tps.find((t) => t.ro.Q1 === q1);
    add(
      'Bomba jockey: 1 gpm ≤ Q < caudal de un rociador',
      bo.Qjockey >= 1 && bo.Qjockey < q1 ? 'CUMPLE' : 'NO CUMPLE',
      `${f1(bo.Qjockey, 1)} < ${f1(q1, 1)} gpm${new Set(tps.map((t) => t.ro.Q1.toFixed(2))).size > 1 ? ` (rociador de menor caudal: ${tq!.id})` : ''}`,
      'NFPA 20-2025 Anexo A',
      `Ajuste el caudal de la jockey entre 1 y ${f1(q1, 1)} gpm, para que un solo rociador arranque la bomba principal.`,
      ['entradas', 'bomba.qjockey'],
    );
  }
}
