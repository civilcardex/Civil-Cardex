/**
 * Las 44 verificaciones normativas del motor RCI (Red Contra Incendio): cada una evalúa por
 * tipología y se informa la peor, con estado CUMPLE / NO CUMPLE / REVISAR / PENDIENTE, el valor
 * formateado, la norma (NFPA (National Fire Protection Association) u otra fuente), la guía de
 * corrección y el dato a donde ir ("go"). Ej: checks() del ejemplo devuelve 44 en "CUMPLE".
 */
import { CDEF, PIPES } from './tables';
import { fmtEs as f1 } from './fmtEs.ts';
import { isSi, num } from './hydraulics';
import { zonaSis } from './criteria';
import type {
  Criterios,
  Demanda,
  Edificio,
  FilaRoute,
  Inflow,
  RciResult,
  RciState,
  RouteResult,
  Verificacion,
} from './types';

/** Evalúa las 44 verificaciones sobre el resultado R. No lanza: todo problema de datos se
 *  refleja en el estado o en la guía de la verificación correspondiente. */
export function checks(st: RciState, R: RciResult): Verificacion[] {
  const ro = R.roc,
    bo = R.bomba,
    c = st.clas,
    L: Verificacion[] = [];

  const add = (
    lab: string,
    st_: string,
    val: string,
    nor: string,
    guide: string,
    go?: string[],
  ): void => {
    L.push({ lab, st: st_, val, nor, guide: st_ === 'CUMPLE' ? '' : guide, go });
  };
  /* Tipologías a verificar: en el edificio, todas las que tienen criterios (y red, para las de la red);
     sin edificio, la única red de Entradas. Cada verificación se evalúa por tipología y se informa la peor. */
  type TpsItem = {
    id: string;
    ro: Criterios;
    riesgo: string;
    rd: RciResult['red'];
    Nop: number;
    Qroc: number;
    routes: RouteResult[];
    rows: FilaRoute[];
    bld?: boolean;
    /** Tipo de sistema de la tipología ('Húmedo'/'Seco'; el de clas si la tipología no lo trae). */
    sis: string;
  };
  const E0: Edificio | null = R.edif;
  const tps: TpsItem[] = E0
    ? Object.values(E0.typ).map((t) => ({
        id: t.g.id,
        ro: t.roc || ro,
        riesgo: t.riesgo || c.riesgo,
        sis: (t as unknown as { g?: { sistema?: string } }).g?.sistema || c.sistema,
        rd: t.rd || null,
        Nop: t.rd ? t.rd.Nop : 0,
        Qroc: t.rd && t.rd.rt && t.rd.rt.solved ? t.rd.rt.Q! : 0,
        routes: t.rd
          ? [...t.rd.rams.map((x) => x.res), ...t.rd.tramos.map((y) => y.res)].filter(
              (x): x is RouteResult => !!x,
            )
          : [],
        rows: [] as FilaRoute[],
      }))
    : [
        {
          id: '',
          ro,
          riesgo: c.riesgo,
          sis: c.sistema,
          rd: R.red,
          Nop: R.Nop,
          Qroc: R.Qroc,
          routes: R.effRamales.map((b) => R.branches[b.id]).filter((x): x is RouteResult => !!x),
          rows: [] as FilaRoute[],
        },
      ];
  const tpsRed: TpsItem[] = E0 ? tps.filter((t) => t.rd) : tps;
  const multi = tps.length > 1;
  const bldRoutes = [R.alim, R.gab].filter((x): x is RouteResult => !!x),
    bldRows = bldRoutes.flatMap((r) => r.rows || []);
  tps.forEach((t) => {
    t.rows = t.routes.flatMap((r) => r.rows || []);
  });
  const RK: Record<string, number> = { CUMPLE: 0, PENDIENTE: 1, REVISAR: 2, 'NO CUMPLE': 3 };
  /* Una verificación por tipología: fn(t) → { st, val, guide }. Con varias tipologías el valor muestra cada una
     y "Ir al dato" abre la primera que falla. */
  const addT = (
    lab: string,
    nor: string,
    go: string[] | undefined,
    fn: (t: TpsItem) => { st: string; val: string; guide: string },
    list?: TpsItem[],
  ): void => {
    const L0 = list || tps;
    if (!L0.length)
      return add(
        lab,
        'PENDIENTE',
        'Sin redes calculadas',
        nor,
        'Calcule la red de al menos una tipología en Hidráulica.',
        ['hidraulica'],
      );
    const it = L0.map((t) => Object.assign({ t }, fn(t)));
    const w = it.reduce((x, y) => (RK[y.st] > RK[x.st] ? y : x), it[0]);
    if (!multi) return add(lab, w.st, w.val, nor, w.guide, go);
    const bad = it.filter((x) => x.st !== 'CUMPLE');
    add(
      lab,
      w.st,
      it.map((x) => `${x.t.id}: ${x.val}`).join(' · '),
      nor,
      bad.map((x) => `${x.t.id}: ${x.guide}`).join(' '),
      go && bad.length ? [go[0], go[1] || '', bad.find((x) => x.st === w.st)!.t.id] : go,
    );
  };
  const almacen = isSi(c.almacen);
  const arr = num(c.arrumeH);

  {
    const inc = (rs: FilaRoute[]) => rs.filter((r) => !r.ok).length,
      ib = inc(bldRows);
    addT(
      'Tramos con datos completos',
      '—',
      ['hidraulica'],
      (t) => {
        const n = inc(t.rows);
        return {
          st: n ? 'NO CUMPLE' : 'CUMPLE',
          val: `${n} tramos incompletos`,
          guide:
            'Complete material, diámetro y longitud de los tramos marcados en Hidráulica. Verifique que el diámetro exista para el material elegido.',
        };
      },
      tpsRed,
    );
    if (ib)
      add(
        'Tramos del montante y gabinetes con datos completos',
        'NO CUMPLE',
        `${ib} tramos incompletos`,
        '—',
        'Complete material, diámetro y longitud del montante, la ruta del cuarto de bombas o los gabinetes (Entradas → Montantes NFPA 14).',
        ['entradas', 'mont.dn'],
      );
  }
  /* Datos fuera de rango: no detienen el cálculo, pero sus resultados no son válidos */
  {
    const bad: string[] = [],
      paths: (string | undefined)[] = [],
      neg = (v: unknown, lab: string, pth?: string): void => {
        const x = num(v);
        if (x !== null && x < 0) {
          bad.push(`${lab} = ${f1(x)}`);
          paths.push(pth);
        }
      };
    const b = st.bomba || {};
    neg(b.margen, 'Margen de presión de la bomba', 'bomba.margen');
    neg(b.lSuc, 'Longitud de succión', 'bomba.lSuc');
    neg((st.tanque || {}).vextra, 'Volumen adicional del tanque', 'tanque.vextra');
    neg((st.mang || {}).duracion, 'Duración', 'mang.duracion');
    if (num(st.roc.K) !== null && num(st.roc.K)! <= 0)
      bad.push(`Factor K = ${f1(num(st.roc.K), 1)}`);
    if (num(st.roc.Pmin) !== null && num(st.roc.Pmin)! < 7)
      bad.push(`Presión mínima del rociador = ${f1(num(st.roc.Pmin), 1)} psi (NFPA 13: ≥ 7 psi)`);
    if (num(b.hmin) !== null && num(b.hmax) !== null && num(b.hmin)! > num(b.hmax)!)
      bad.push(
        `Nivel mínimo del tanque (${f1(num(b.hmin))} m) mayor que el máximo (${f1(num(b.hmax))} m)`,
      );
    if (num(b.fchurn) !== null && num(b.fchurn)! < 1)
      bad.push(`Factor de presión a caudal cero = ${f1(num(b.fchurn))} (debe ser ≥ 1)`);
    const M = st.mont || {};
    neg(M.hS, 'Altura de las salidas de manguera', 'mont.hS');
    neg(M.hD, 'Altura de la derivación del piso', 'mont.hD');
    (M.cuarto || []).forEach((r, i) =>
      neg(r.L, `Longitud del tramo ${i + 1} del cuarto de bombas`, 'mont.dn'),
    );
    Object.entries(st.redes || {}).forEach(([pl, red]) => {
      (red.ramales || []).forEach((r) =>
        neg(r.Lr, `Longitud del ramal ${r.nombre || '?'} (planta ${pl})`),
      );
      (red.tramos || []).forEach((t) =>
        neg(
          t.L,
          `Longitud del tramo ${(t as { nombre?: string }).nombre || `${t.de}→${t.a}`} (planta ${pl})`,
        ),
      );
    });
    if (!(bo.Pnom > 0))
      bad.push(
        'La bomba no tiene presión de diseño: revise la red de rociadores, el montante y la ruta del cuarto de bombas',
      );
    add(
      'Datos de entrada dentro de rango',
      bad.length ? 'NO CUMPLE' : 'CUMPLE',
      bad.length ? `${bad.length} dato(s) fuera de rango` : 'Sin datos fuera de rango',
      'Control de datos',
      `Corrija: ${bad.join('; ')}.`,
      paths.find(Boolean) ? ['entradas', paths.find(Boolean) as string] : ['entradas'],
    );
  }
  addT(
    'Riesgo NFPA 13 compatible con almacenamiento',
    'NFPA 13-2025 cap. 4',
    ['entradas', 'clas.riesgo'],
    (t) => ({
      st: almacen && t.riesgo === 'Riesgo leve' ? 'NO CUMPLE' : 'CUMPLE',
      val: `${t.riesgo} / almacenamiento: ${c.almacen}`,
      guide:
        'Con almacenamiento no se admite Riesgo leve. Cambie la clasificación a Riesgo ordinario G2 como mínimo (arrume ≤ 3,66 m); si el arrume es mayor, diseñe con NFPA 13 cap. 20–25.',
    }),
  );
  add(
    'Altura de arrume dentro del alcance (≤ 3,66 m)',
    !almacen ? 'CUMPLE' : arr === null ? 'PENDIENTE' : arr > 3.66 ? 'NO CUMPLE' : 'CUMPLE',
    !almacen ? 'Sin almacenamiento' : arr === null ? 'Sin dato' : `${f1(arr)} m`,
    'NFPA 13-2025 cap. 20–25',
    arr === null
      ? 'Ingrese la altura máxima de arrume. Es obligatoria cuando hay almacenamiento.'
      : 'Arrume > 3,66 m: el diseño debe hacerse con NFPA 13 cap. 20–25 (CMDA, CMSA o ESFR). Este aplicativo no cubre ese caso.',
    ['entradas', 'clas.arrumeH'],
  );
  addT(
    'Separación entre rociadores 1,8 m ≤ S ≤ S máx.',
    'NFPA 13-2025 cap. 10',
    ['entradas', 'roc.S'],
    (t) => {
      const o = t.ro;
      return {
        st: o.S >= 1.8 && o.S <= o.hz.s ? 'CUMPLE' : 'NO CUMPLE',
        val: `${f1(o.S)} ≤ ${f1(o.hz.s)} m`,
        guide:
          o.S > o.hz.s
            ? `Reduzca S a ${f1(o.hz.s)} m o menos (añada rociadores en el ramal).`
            : 'Aumente S a 1,80 m o más, o use pantallas entre rociadores.',
      };
    },
  );
  addT(
    'Separación entre ramales 1,8 m ≤ L ≤ L máx.',
    'NFPA 13-2025 cap. 10',
    ['entradas', 'roc.L'],
    (t) => {
      const o = t.ro;
      return {
        st: o.L >= 1.8 && o.L <= o.hz.l ? 'CUMPLE' : 'NO CUMPLE',
        val: `${f1(o.L)} ≤ ${f1(o.hz.l)} m`,
        guide:
          o.L > o.hz.l
            ? `Reduzca L a ${f1(o.hz.l)} m o menos (añada un ramal).`
            : 'Aumente L a 1,80 m o más.',
      };
    },
  );
  addT(
    'Área por rociador ≤ cobertura máxima',
    'NFPA 13-2025 cap. 10',
    ['entradas', 'roc.L'],
    (t) => {
      const o = t.ro;
      return {
        st: o.Areal <= o.Acmax ? 'CUMPLE' : 'NO CUMPLE',
        val: `${f1(o.Areal, 0)} ≤ ${o.Acmax} ft²`,
        guide: `Reduzca S × L a ${f1(o.Acmax * 0.092903)} m² o menos. Con S = ${f1(o.S)} m, L ≤ ${f1((o.Acmax * 0.092903) / o.S)} m.`,
      };
    },
  );
  const dm = num(st.roc.Dmuro);
  addT('Distancia a muro ≤ S máx./2', 'NFPA 13-2025 cap. 10', ['entradas', 'roc.Dmuro'], (t) =>
    dm === null
      ? {
          st: 'PENDIENTE',
          val: 'Sin dato',
          guide: `Ingrese la distancia del último rociador al muro: entre 0,10 m y ${f1(t.ro.hz.s / 2)} m.`,
        }
      : {
          st: dm <= t.ro.hz.s / 2 && dm >= 0.1 ? 'CUMPLE' : 'NO CUMPLE',
          val: `${f1(dm)} ≤ ${f1(t.ro.hz.s / 2)} m`,
          guide: `Ubique el último rociador a no más de ${f1(t.ro.hz.s / 2)} m del muro y a no menos de 0,10 m.`,
        },
  );
  const autoG = !!(st.auto && st.auto.on);
  addT(
    'Rociadores en operación ≥ requeridos por el área de diseño',
    'NFPA 13-2025 cap. 28',
    ['hidraulica'],
    (t) => ({
      st: t.Nop >= t.ro.Nreq ? 'CUMPLE' : 'NO CUMPLE',
      val: `${t.Nop} ≥ ${t.ro.Nreq}`,
      guide: autoG
        ? `Faltan ${t.ro.Nreq - t.Nop} rociadores con flujo conectados a la red. Agregue ramales en PLANO (del más remoto hacia el montante), aumente "Fluyen" o revise las conexiones de los nudos.`
        : `Faltan ${t.ro.Nreq - t.Nop} rociadores en el cálculo. Active la red automática o conecte más ramales (columna "Ramal conectado").`,
    }),
    tpsRed,
  );
  addT(
    'Caudal de rociadores ≥ densidad × área de diseño',
    'NFPA 13-2025 Tabla 19.2.3.1.1',
    ['hidraulica'],
    (t) => ({
      st: t.Qroc >= t.ro.Qteo - 0.01 ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(t.Qroc, 1)} ≥ ${f1(t.ro.Qteo, 1)} gpm`,
      guide:
        'El caudal calculado no alcanza la densidad × área. Revise el K, la presión mínima y que todos los rociadores del área estén incluidos.',
    }),
    tpsRed,
  );
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
  /* Verificaciones sobre todas las tuberías: cada tipología y, aparte, montante + cuarto de bombas + gabinetes */
  const tB: TpsItem[] = tpsRed.concat(
    bldRows.length
      ? [
          {
            id: 'Montante',
            rows: bldRows,
            bld: true,
            ro: null as unknown as Criterios,
            riesgo: '',
            sis: c.sistema,
            rd: null,
            Nop: 0,
            Qroc: 0,
            routes: [],
          },
        ]
      : [],
  );
  const addR = (
    lab: string,
    nor: string,
    go: string[],
    fn: (rows: FilaRoute[]) => { st: string; val: string; guide: string },
  ): void => {
    const it = tB.map((t) => Object.assign({ t }, fn(t.rows)));
    const w = it.reduce(
      (x, y) => (RK[y.st] > RK[x.st] ? y : x),
      it[0] || { t: null as unknown as TpsItem, st: 'CUMPLE', val: '—', guide: '' },
    );
    const bad = it.filter((x) => x.st !== 'CUMPLE'),
      sh = multi || bad.some((x) => x.t.bld);
    const go2 = bad.length
      ? bad[0].t.bld
        ? ['entradas', 'mont.dn']
        : [go[0], go[1] || '', bad[0].t.id]
      : go;
    add(
      lab,
      w.st,
      sh
        ? (bad.length ? bad : it.slice(0, 1))
            .map((x) => (bad.length ? `${x.t.id}: ${x.val}` : x.val))
            .join(' · ')
        : w.val,
      nor,
      sh ? bad.map((x) => `${x.t.id}: ${x.guide}`).join(' ') : w.guide,
      multi || bad.length ? go2 : go,
    );
  };
  addR(
    'Accesorios especiales reconocidos en el catálogo',
    'Dato del fabricante',
    ['hidraulica'],
    (rs) => {
      const unk = [...new Set(rs.flatMap((r) => (r as { espUnk?: string[] }).espUnk || []))];
      return {
        st: unk.length ? 'REVISAR' : 'CUMPLE',
        val: unk.length ? `Sin catálogo: ${unk.join(', ')}` : 'Todos reconocidos',
        guide: `Agregue los códigos ${unk.join(', ')} al catálogo de accesorios especiales (Entradas → Tubería) o corrija la columna "Especiales". Mientras tanto no suman pérdida.`,
      };
    },
  );
  {
    const dif = Object.keys(st.cmat || {}).flatMap((m) =>
      [
        ['h', 'Húmedo'],
        ['s', 'Seco'],
      ]
        .map(([k, s]) => {
          const v = num((st.cmat as Record<string, Record<string, unknown>>)[m][k]);
          return v !== null && v > 0 && v !== CDEF(m, s)
            ? `${m} ${s.toLowerCase()}: ${v} (NFPA ${CDEF(m, s)})`
            : null;
        })
        .filter((x): x is string => x !== null),
    );
    add(
      'Coeficiente C de Hazen-Williams según NFPA 13',
      dif.length ? 'REVISAR' : 'CUMPLE',
      dif.length ? dif.join('; ') : 'Valores de NFPA 13 cap. 28',
      'NFPA 13-2025 cap. 28',
      'Se adoptó un C distinto del de la norma. Justifíquelo en la memoria (tubería existente, material listado, exigencia de la autoridad) o deje el campo vacío para usar el de NFPA 13.',
      ['entradas', 'tub.Vmax'],
    );
  }
  addR('Velocidad en todos los tramos ≤ criterio', 'Criterio de diseño', ['hidraulica'], (rs) => {
    const n = rs.filter((r) => (r as { chkV?: string }).chkV === 'V ALTA').length;
    return {
      st: n ? 'REVISAR' : 'CUMPLE',
      val: `${n} tramos con V > ${f1(num(st.tub.Vmax) || 6, 1)} m/s`,
      guide: 'Aumente el diámetro de los tramos marcados V ALTA.',
    };
  });
  addT(
    'Duración adoptada ≥ mínima',
    'NFPA 13-2025 Tabla 19.2.3.1.1',
    ['entradas', 'mang.duracion'],
    (t) => {
      const o = t.ro,
        d = num(st.mang.duracion) || o.dmin;
      return {
        st: d >= o.dmin ? 'CUMPLE' : 'NO CUMPLE',
        val: `${d} ≥ ${o.dmin} min`,
        guide:
          o.dmin === o.dmax
            ? `Adopte una duración de ${o.dmin} min o más.`
            : `Adopte una duración de ${o.dmin} min o más (rango ${o.dmin} a ${o.dmax} min).`,
      };
    },
  );
  const spA = R.sp.activo;
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
  add(
    'Diámetro del montante ≥ 4"',
    !spA ? 'CUMPLE' : (num(st.sp.diam) || 0) >= 4 ? 'CUMPLE' : 'NO CUMPLE',
    spA ? `${st.sp.diam} pulg` : 'No aplica',
    'NFPA 14-2024',
    'Use montante de 4" como mínimo (6" en sistema combinado, salvo que se justifique con cálculo hidráulico).',
    ['entradas', 'sp.diam'],
  );
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
  const ls = st.local;
  {
    const zs = zonaSis(st),
      falta: [string, string][] = [];
    if (isSi(ls.reqSismo)) {
      if (!ls.normSis) falta.push(['la norma sísmica local', 'local.normSis']);
      if (!ls.parSismo) falta.push(['el parámetro sísmico de referencia', 'local.parSismo']);
      if (!zs.z) falta.push(['la zona de amenaza sísmica', 'local.zonaSis']);
    }
    const sis = !isSi(ls.reqSismo) ? 'CUMPLE' : falta.length ? 'PENDIENTE' : 'CUMPLE';
    add(
      'Arriostramiento antisísmico',
      sis,
      !isSi(ls.reqSismo)
        ? 'No requerido'
        : falta.length
          ? `Falta ${falta.map((x) => x[0]).join(', ')}`
          : `Zona ${zs.z.toLowerCase()}${zs.auto ? ' (según NSR-10)' : ''} · ${ls.normSis} · ${ls.parSismo}: ubicación en Soportes sísmicos`,
      'NFPA 13-2025 cap. 18 + norma local',
      `Complete ${falta.map((x) => x[0]).join(', ')} en Entradas → Normativa local.`,
      falta.length ? ['entradas', falta[0][1]] : ['sismo'],
    );
  }
  addT(
    'Techo ≤ 9,14 m (30 ft) para criterios estándar',
    'NFPA 13-2025 cap. 19',
    ['entradas', 'clas.htecho'],
    (t) => {
      const h = t.ro.HtFt / 3.28084;
      return {
        st: h <= 9.14 ? 'CUMPLE' : 'REVISAR',
        val: `${f1(h)} m`,
        guide:
          'Con techos de más de 9,14 m aplique los requisitos de techos altos de NFPA 13-2025 (densidad mínima y aumento de área según riesgo y K).',
      };
    },
  );
  addR(
    'Presión en cada nudo dentro de límites',
    'NFPA 13-2025 cap. 28 / NFPA 14-2024',
    ['hidraulica'],
    (rs) => {
      const n = rs.filter(
        (r) =>
          (r as { chkP?: string }).chkP === 'P BAJA' || (r as { chkP?: string }).chkP === 'P ALTA',
      ).length;
      return {
        st: n ? 'NO CUMPLE' : 'CUMPLE',
        val: `${n} nudos fuera de límite`,
        guide:
          'Revise las filas marcadas en la columna de presión. P BAJA: aumente diámetros o la presión de arranque. P ALTA: reduzca la presión de bomba o use válvulas reductoras o reguladoras o componentes de mayor clase.',
      };
    },
  );
  const codOk =
    ls.codLocal && !(isSi(ls.exigeRoc) && !ls.refRoc) && !(isSi(ls.exigeSP) && !ls.refSP);
  add(
    'Exigencia del código local registrada',
    codOk ? 'CUMPLE' : 'PENDIENTE',
    ls.codLocal || 'Sin código',
    'Código local (dato del usuario)',
    'Registre el código local y, si exige rociadores o montantes, el artículo correspondiente.',
    ['entradas', 'local.codLocal'],
  );
  return L;
}
