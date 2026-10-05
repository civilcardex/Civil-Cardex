// Motor NTC 3631 (3ª actualización) — port del HTML/XLSX fuente del módulo Rejillas de gas.
// Entrada por sector (recinto), salida: clasificación del volumen, solución aplicada,
// aberturas con rejilla sugerida del catálogo, alertas y memoria de cálculo del sector.
// Diferencias documentadas respecto al prototipo: alerta crítica propia cuando no cabe una
// abertura de 8 cm de lado (ya estaba), check de sótanos (3.2) añadido, y el Método 2 NO
// aplica factor de combinación (la norma define el factor solo en 4.3 con Método 1 — el
// ejemplo "Anexo A" del DOCX es un caso de Combinación mal etiquetado).
import { NTC3631, COMERCIALES, SOL, type RejRef } from '../constants/rejillasNTC3631';

export interface RejArtefacto {
  tipo: 'Estufa' | 'Calentador' | 'Otros';
  clase: 'A' | 'B' | 'C';
  kw: number;
  cant: number;
}

export interface RejSectorInput {
  nombre: string;
  areaM2: number;
  altoM: number;
  mono: boolean;
  /** Nombre del piso (para la restricción de sótanos 3.2). */
  piso?: string;
  artefactos: RejArtefacto[];
  /** Clave de SOL (Tipo de Ventilación). */
  sol: string;
  vadj: number;
  padj: number;
  /** Suma de áreas de conectores de evacuación cm² (π·D²/4, solo Método 2). */
  aconec: number;
  gas: 'natural' | 'glp';
  catalogo?: RejRef[];
  importadas: boolean;
  marca?: string;
}

interface RejAbertura {
  nombre: string;
  pos: 'sup' | 'inf' | 'int';
  libre: number;
  bruta: number;
  w: number;
  h: number;
  n: number;
  ref?: RejRef;
  rot?: boolean;
  libreReal: number;
  alt: boolean;
  hMax: number;
  ubic: string;
}

interface RejAlerta {
  /** true = crítica; sin e = observación. */
  e?: boolean;
  t: string;
}

export interface RejResultado {
  entrada: RejSectorInput;
  estado: 'vacio' | 'ok' | 'warn';
  modo?: 'estanco' | 'mono' | 'interior' | 'comb' | 'exterior';
  clasif?: string;
  P: number;
  PC: number;
  Padj: number;
  Ptot: number;
  A: number;
  H: number;
  V: number;
  Vreq: number;
  Vdisp?: number;
  VreqTot?: number;
  ratio?: number;
  factor?: number;
  Pmax?: number;
  coef?: number | string;
  metodoAplicado?: string;
  aberturas: RejAbertura[];
  alertas: RejAlerta[];
  titulo?: string;
}

/** Normaliza grados — no usado hoy; placeholder para futuras comprobaciones geométricas. */

interface Sugerencia {
  c: RejRef;
  n: number;
  w: number;
  h: number;
  rot: boolean;
  tot: number;
}

/** Sugiere referencia aproximando por arriba: menos unidades y luego menos sobrante. */
export function sugerirRef(
  libre: number,
  hMax: number,
  cat: RejRef[],
  marca: string | undefined,
  uso = 'ext',
  imp = false,
): Sugerencia | null {
  const ops: Sugerencia[] = [];
  cat
    .filter(
      (c) =>
        c.aef > 0 &&
        (!marca || c.marca === marca) &&
        (!c.uso || c.uso === 'ambos' || c.uso === uso) &&
        (imp || c.origen !== 'importado'),
    )
    .forEach((c) => {
      if (Math.min(c.w, c.h) < NTC3631.MIN_LADO) return;
      const orient = c.h <= hMax ? [c.w, c.h] : c.w <= hMax ? [c.h, c.w] : null;
      if (!orient) return;
      const n = Math.ceil(libre / c.aef);
      if (n > 4) return;
      ops.push({ c, n, w: orient[0], h: orient[1], rot: orient[0] !== c.w, tot: n * c.aef });
    });
  ops.sort((a, b) => a.n - b.n || a.tot - b.tot);
  return ops[0] || null;
}

/** Medida comercial de respaldo (área bruta con 60 % estimado). */
function elegirRejilla(
  areaBruta: number,
  hMax: number,
): { w: number; h: number; comercial: boolean } {
  const m = NTC3631.MIN_LADO;
  const c = COMERCIALES.filter(
    ([w, h]) => h <= hMax && Math.min(w, h) >= m && w * h >= areaBruta,
  ).sort((a, b) => a[0] * a[1] - b[0] * b[1] || a[1] - b[1]);
  if (c.length) return { w: c[0][0], h: c[0][1], comercial: true };
  const h = Math.max(m, Math.floor(Math.min(Math.max(hMax, m), 30) / 5) * 5);
  return { w: Math.max(h, Math.ceil(areaBruta / h / 5) * 5), h, comercial: false };
}

/** Restricción de sótanos (3.2): ningún artefacto por debajo del primer sótano; con GLP,
 *  tampoco en el primer sótano. Heurística por nombre del piso (SS2/Sótano 2/…). */
function alertaSotano(piso: string | undefined, glp: boolean, alertas: RejAlerta[]): void {
  const p = (piso || '').toLowerCase().replace(/ó|ò|ô/g, 'o');
  if (/ss\s*[2-9]\d*|sotano\s*[2-9]\d*|subsuelo\s*[2-9]\d*/.test(p)) {
    alertas.push({
      e: true,
      t: 'Num. 3.2: ningún artefacto a gas puede instalarse por debajo del primer sótano.',
    });
  } else if (/ss\s*1|sotano\s*1|subsuelo\s*1|sotano|ss\b/.test(p) && glp) {
    alertas.push({
      e: true,
      t: 'Num. 3.2: con gas más denso que el aire (GLP) no se permiten artefactos en el primer sótano.',
    });
  }
}

/** Motor por sector. Port fiel del calcular() del prototipo (HTML v15 / XLSX). */
export function calcular(inp: RejSectorInput): RejResultado {
  const r: RejResultado = {
    entrada: inp,
    estado: 'vacio',
    aberturas: [],
    alertas: [],
    P: 0,
    PC: 0,
    Padj: 0,
    Ptot: 0,
    A: inp.areaM2,
    H: inp.altoM,
    V: inp.areaM2 * inp.altoM,
    Vreq: 0,
  };
  const glp = inp.gas === 'glp';
  const P = inp.artefactos
    .filter((a) => a.clase !== 'C')
    .reduce((s, a) => s + (+a.kw || 0) * (+a.cant || 0), 0);
  const PC = inp.artefactos
    .filter((a) => a.clase === 'C')
    .reduce((s, a) => s + (+a.kw || 0) * (+a.cant || 0), 0);
  r.PC = PC;
  // Artefactos declarados (cant > 0) cuyo grupo no-C suma P = 0: sin kW definido no hay
  // requerimiento de ventilación — observación (no crítica) pidiendo la potencia.
  if (P <= 0 && inp.artefactos.some((a) => a.clase !== 'C' && (+a.cant || 0) > 0))
    r.alertas.push({
      t: 'Defina la potencia (kW) de los gasodomésticos: sin ella no hay requerimiento de ventilación.',
    });
  const s = SOL[inp.sol] || SOL['ext-dir'];
  const Padj = s.adj ? +inp.padj || 0 : 0;
  const Ptot = P + Padj;
  const A = inp.areaM2;
  const H = inp.altoM;
  const V = A * H;
  const Vreq = NTC3631.VOL_KW * P;
  Object.assign(r, { P, Padj, Ptot, A, H, V, Vreq });
  const altoCm = H * 100;
  const hSupMax = Math.max(0, altoCm - NTC3631.H_SUP);
  const hInfMax = NTC3631.H_INF - NTC3631.ZOCALO;
  const hAlt = Math.max(0, Math.min(NTC3631.ALT_HMAX, altoCm - NTC3631.ALT_TOPE - 100));
  const coefExt = s.com === 'horizontal' ? NTC3631.EXT_HOR : NTC3631.EXT_DIR;
  alertaSotano(inp.piso, glp, r.alertas);

  const pushExt = (
    nombre: string,
    libre: number,
    pos: 'sup' | 'inf' | 'int',
    hMaxForzado: number,
    uso = 'ext',
  ) => {
    libre = Math.ceil(libre);
    let hMax = hMaxForzado || (pos === 'sup' ? hSupMax : hInfMax);
    let alt = false;
    let sug = sugerirRef(libre, hMax, inp.catalogo || [], inp.marca, uso, inp.importadas);
    if (!sug && pos === 'sup' && hAlt > hMax) {
      sug = sugerirRef(libre, hAlt, inp.catalogo || [], inp.marca, uso, inp.importadas);
      if (sug) {
        alt = true;
        hMax = hAlt;
      }
    }
    let sel: { w: number; h: number; n: number; ref?: RejRef; rot?: boolean };
    let libreReal: number;
    let bruta: number;
    if (sug) {
      sel = { w: sug.w, h: sug.h, n: sug.n, ref: sug.c, rot: sug.rot };
      libreReal = sug.tot;
      bruta = sug.n * sug.w * sug.h;
    } else {
      if (pos === 'sup' && hMax < NTC3631.MIN_LADO) {
        if (hAlt >= NTC3631.MIN_LADO) {
          alt = true;
          hMax = hAlt;
        } else {
          r.alertas.push({
            e: true,
            t: `${nombre}: no cabe una abertura de ${NTC3631.MIN_LADO} cm de lado mínimo ni sobre 1,80 m ni a ≤ 30 cm del techo (altura libre ${H.toFixed(2)} m).`,
          });
          // Sin abertura posible: no se muestra la abertura estimada (la contradecía).
          return;
        }
      }
      bruta = libre / 0.6;
      sel = { ...elegirRejilla(bruta, hMax), n: 1 };
      libreReal = sel.w * sel.h * 0.6;
      r.alertas.push({
        e: true,
        t: `${nombre}: ninguna referencia del catálogo cubre ${libre} cm². La norma exige el área libre real de la rejilla (num. 5): se muestra ${sel.w} × ${sel.h} cm solo como estimación con 60 %; defina la rejilla con el área libre del fabricante (las metálicas de lamas tienen entre 23 % y 46 %).`,
      });
    }
    const ubic =
      pos === 'sup'
        ? alt
          ? `Comienza a ≤ ${NTC3631.ALT_TOPE} cm del techo`
          : `Borde inferior ≥ ${NTC3631.H_SUP} cm del piso`
        : pos === 'inf'
          ? `Borde superior ≤ ${NTC3631.H_INF} cm del piso`
          : 'Entre pisos comunicados';
    r.aberturas.push({ nombre, pos, libre, bruta, ...sel, libreReal, alt, hMax, ubic });
    if (alt)
      r.alertas.push({
        t: `${nombre}: no cabe sobre 1,80 m; se ubica comenzando a ≤ 30 cm del techo, alternativa permitida (4.1.2, 4.2.1, 4.2.2).`,
      });
  };

  if (P <= 0 && PC > 0) {
    r.estado = 'ok';
    r.modo = 'estanco';
    r.clasif = 'Solo Tipo C';
    r.alertas.push({
      t: `Solo hay artefactos de circuito estanco (Tipo C, ${PC.toFixed(1)} kW): no consumen aire del recinto y no requieren ventilación por NTC 3631. Verifique la terminal de evacuación según el fabricante.`,
    });
    return r;
  }
  if (P <= 0) {
    r.estado = 'vacio';
    r.titulo = 'Agregue al menos un gasodoméstico con potencia';
    return r;
  }
  if (PC > 0)
    r.alertas.push({
      t: `${PC.toFixed(1)} kW de artefactos Tipo C (circuito estanco) no se suman a la potencia (1.2 y 4.1.1, nota).`,
    });
  if (inp.artefactos.some((a) => a.tipo === 'Calentador' && a.clase === 'A'))
    r.alertas.push({
      t: 'Calentador Tipo A (sin conducto de evacuación): verifique que esté permitido según NTC 3643 para el uso previsto.',
    });
  if (/alcoba|dormitorio|habitaci|baño|bano|ducha/i.test(inp.nombre || ''))
    r.alertas.push({
      e: true,
      t: 'Num. 3.2: en dormitorios y baños o duchas solo se permiten artefactos de circuito estanco (Tipo C), que no se suman a la potencia.',
    });

  if (inp.mono) {
    r.Pmax = (A * H) / NTC3631.VOL_KW;
    r.modo = 'mono';
    r.estado = P <= r.Pmax ? 'ok' : 'warn';
    if (P > r.Pmax)
      r.alertas.push({
        e: true,
        t: `La potencia instalada supera la máxima del mono-espacio (A × H / 3,4 = ${r.Pmax.toFixed(1)} kW). Reduzca artefactos o independice el recinto.`,
      });
    r.alertas.push({
      t: `Mono-espacio (Anexo B): artefactos fuera del área del dormitorio (límite: bordes exteriores de la cama);${
        inp.artefactos.some((a) => a.clase === 'A')
          ? ' los artefactos Tipo A de este sector deben quedar a ≥ 2 m de ese límite;'
          : ''
      } aberturas fuera del área del dormitorio.`,
    });
    r.coef = coefExt;
    pushExt('Rejilla superior', coefExt * P, 'sup', 0);
    pushExt('Rejilla inferior', coefExt * P, 'inf', 0);
    return r;
  }

  r.clasif = V >= Vreq ? 'Volumen suficiente / No confinado' : 'Volumen insuficiente / Confinado';
  if (V >= Vreq) {
    r.estado = 'ok';
    r.alertas.push({
      t: 'Todo el aire proviene del interior (4.1). Verifique las demandas adicionales de aire de extractores, secadoras y chimeneas (3.1 y 4.4).',
    });
    return r;
  }

  const Vdisp = V + (s.adj ? +inp.vadj || 0 : 0);
  const VreqTot = NTC3631.VOL_KW * Ptot;
  Object.assign(r, { Vdisp, VreqTot });

  if (s.adj) {
    if (Vdisp >= VreqTot) {
      const mismo = s.piso === 'mismo';
      const libre = mismo
        ? Math.max(NTC3631.INT_MISMO_MIN, NTC3631.INT_MISMO * P)
        : NTC3631.INT_OTRO * P;
      r.estado = 'ok';
      r.modo = 'interior';
      r.coef = mismo ? NTC3631.INT_MISMO : NTC3631.INT_OTRO;
      if (mismo) {
        pushExt('Abertura interior superior', libre, 'sup', 0, 'int');
        pushExt('Abertura interior inferior', libre, 'inf', 0, 'int');
      } else {
        pushExt('Abertura en puerta o piso', libre, 'int', 999, 'int');
      }
      r.alertas.push({
        t: 'Si la comunicación con el espacio vecino es un vano sin puerta (acceso peatonal, ventana sin vidrio), el volumen se suma directamente y no se requieren estas aberturas (4.1).',
      });
      return r;
    }
    r.alertas.push({
      t: `Aun sumando el espacio adyacente (${Vdisp.toFixed(1)} m³ frente a ${VreqTot.toFixed(1)} m³ para ${Ptot.toFixed(1)} kW) no se alcanza el volumen; se ventila al exterior. Puede usar «Combinación interior + exterior» (4.3) para reducir las aberturas.`,
    });
  }

  if (s.comb) {
    r.ratio = VreqTot > 0 ? Vdisp / VreqTot : 0;
    r.factor = Math.max(0, 1 - r.ratio);
    if (r.factor <= 0) {
      r.estado = 'ok';
      r.modo = 'interior';
      r.alertas.push({
        t: 'El volumen disponible cubre el requerido: no se requieren aberturas al exterior.',
      });
      return r;
    }
    r.estado = 'warn';
    r.modo = 'comb';
    r.coef = coefExt;
    pushExt('Rejilla superior', coefExt * Ptot * r.factor, 'sup', 0);
    pushExt('Rejilla inferior', coefExt * Ptot * r.factor, 'inf', 0);
    if (+inp.vadj > 0)
      r.alertas.push({
        t: 'Las aberturas hacia el espacio adyacente deben cumplir 4.1.2 (máx(645 cm²; 22 cm²/kW), superior e inferior), salvo que la comunicación sea por vano sin puerta.',
      });
    return r;
  }

  r.estado = 'warn';
  r.modo = 'exterior';
  let met = s.met;
  if (met === '2' && glp) {
    met = '1';
    r.alertas.push({
      e: true,
      t: 'Gas más denso que el aire (GLP): solo se permite el Método 1. Se calcularon dos aberturas.',
    });
  }
  r.metodoAplicado = met;
  if (met === '2') {
    const libre = Math.max(NTC3631.UNICA * P, +inp.aconec || 0);
    r.coef = NTC3631.UNICA;
    pushExt('Abertura única', libre, 'sup', 0);
    r.alertas.push({
      t: 'Método 2: los artefactos deben tener al menos 2,5 cm de separación a los lados y atrás, y 16 cm al frente (4.2.2).',
    });
  } else {
    r.coef = coefExt;
    pushExt('Rejilla superior', coefExt * P, 'sup', 0);
    pushExt('Rejilla inferior', coefExt * P, 'inf', 0);
  }
  return r;
}

/** Clasificación NTC 3631 del recinto por sí solo (columna Chequeo Volumen). */
export function clasifRecinto(res: RejResultado): [string, 'i' | 'ok' | 'e' | 'w'] {
  if (res.estado === 'vacio') return ['—', 'i'];
  if (res.modo === 'estanco') return ['Solo Tipo C', 'ok'];
  if (res.entrada.mono) return ['Mono-espacio', res.P <= (res.Pmax ?? 0) ? 'ok' : 'e'];
  return res.V >= res.Vreq
    ? ['Volumen suficiente / No confinado', 'ok']
    : ['Volumen insuficiente / Confinado', 'w'];
}

/** Solución de ventilación que resulta del cálculo (columna Solución aplicada). */
export function solucionAplicada(res: RejResultado): string {
  const s = SOL[res.entrada.sol] || SOL['ext-dir'];
  if (res.estado === 'vacio') return '—';
  if (!res.aberturas.length) return 'No requiere aberturas';
  if (res.modo === 'interior')
    return s.comb
      ? 'Interior (volumen suficiente)'
      : s.piso === 'mismo'
        ? 'Interior · 2 aberturas (mismo piso)'
        : 'Interior · abertura entre pisos';
  if (res.entrada.mono) return 'Exterior · 2 aberturas (Anexo B)';
  if (res.modo === 'comb') return `Combinación · factor ${(res.factor ?? 0).toFixed(2)}`;
  if (res.metodoAplicado === '2') return 'Exterior · 1 abertura (método 2)';
  return s.com === 'horizontal'
    ? 'Exterior · 2 aberturas (conducto horiz.)'
    : 'Exterior · 2 aberturas (método 1)';
}

const fmt = (x: number, d = 1) =>
  (+x || 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Memoria de cálculo del sector (texto plano — panel izquierdo del detalle y memoria global). */
export function memoriaRecinto(res: RejResultado, idx?: number): string {
  const e = res.entrada;
  const L: string[] = [];
  void idx; // el encabezado (nombre/apto/zona) lo pone la UI — la memoria solo calcula
  L.push(
    `Área en planta ${fmt(e.areaM2, 2)} m², altura libre ${fmt(e.altoM, 2)} m → V = ${fmt(res.V, 2)} m³`,
  );
  L.push(
    `Artefactos: ${e.artefactos.map((a) => `${a.cant > 1 ? a.cant + ' × ' : ''}${a.tipo} tipo ${a.clase} ${fmt(a.kw)} kW${a.clase === 'C' ? ' (no suma)' : ''}`).join(' + ') || 'ninguno'} → P = ${fmt(res.P)} kW`,
  );
  if (res.estado === 'vacio') return L.join('\n');
  if (e.mono)
    L.push(
      `Mono-espacio (Anexo B): Pmax = ${fmt(e.areaM2, 2)} × ${fmt(e.altoM, 2)} / 3,4 = ${fmt(res.Pmax ?? 0)} kW → ${res.P <= (res.Pmax ?? 0) ? 'CUMPLE' : 'NO CUMPLE'}`,
    );
  else {
    L.push(
      `Vreq = 3,4 × ${fmt(res.P)} = ${fmt(res.Vreq, 2)} m³ → ${(res.clasif || '').toUpperCase()}`,
    );
    if (res.Vdisp !== undefined)
      L.push(
        `Espacios comunicados: V disp = ${fmt(res.Vdisp, 2)} m³; Vreq tot = 3,4 × (${fmt(res.P)} + ${fmt(res.Padj)} kW) = ${fmt(res.VreqTot ?? 0, 2)} m³`,
      );
    if (res.modo === 'interior' && s(e).adj)
      L.push('Comunicación interior: V disp ≥ Vreq tot → CUMPLE');
    if (res.modo === 'comb')
      L.push(
        `Combinación interior + exterior (4.3): relación = ${fmt(res.ratio ?? 0, 2)}; factor de reducción = ${fmt(res.factor ?? 0, 2)}`,
      );
    if (res.metodoAplicado) L.push(`Ventilación al exterior, Método ${res.metodoAplicado}`);
  }
  if (res.aberturas.length) {
    L.push(
      `Coeficiente: ${res.coef} cm²/kW${res.modo === 'interior' && s(e).piso === 'mismo' ? ' (mínimo 645 cm²)' : ''}${res.modo === 'comb' ? ` × ${fmt(res.Ptot)} kW × factor ${fmt(res.factor ?? 0, 2)}` : ''}. Lado menor de toda abertura ≥ 8 cm.`,
    );
    res.aberturas.forEach((a) => {
      L.push(
        `  ${a.nombre}: área libre requerida ${fmt(a.libre, 0)} cm² (redondeo por arriba). ${a.ubic}.`,
      );
      if (a.ref)
        L.push(
          `    REF. SUGERIDA${a.ref.origen === 'importado' ? ' (importada, confirmar disponibilidad)' : ''}: ${a.n} × ${a.ref.marca} ${a.ref.ref}, rejilla ${a.ref.tipo.toLowerCase()} ${a.ref.ext} cm. Área efectiva ${a.n} × ${a.ref.aef} = ${fmt(a.libreReal, 0)} cm² ≥ ${fmt(a.libre, 0)} cm² → CUMPLE.`,
        );
      else
        L.push(
          `    MEDIDA ESPECIAL ${a.w} × ${a.h} cm (área bruta ${fmt(a.bruta, 0)} cm² con 60 %; solo estimación, la norma exige el área libre real).`,
        );
    });
  } else L.push('No requiere aberturas permanentes por volumen.');
  res.alertas.forEach((a) => L.push(`  ${a.e ? 'CRÍTICA' : 'Obs.'}: ${a.t}`));
  return L.join('\n');
}

const s = (e: RejSectorInput) => SOL[e.sol] || SOL['ext-dir'];
