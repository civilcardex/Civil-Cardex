import { getPaisData } from './seedData.ts';
import { devError } from '../../utils/devError.ts';
import type {
  Apu,
  ApuCalculado,
  ApuRecursoEquipo,
  ApuRecursoInsumo,
  ApuRecursoMO,
  ApuRecursoTransporte,
  AiuOverride,
  Cargo,
  CargoCalculado,
  CivilManagerConfig,
  CivilManagerState,
  ConfigListas,
  Cuadrilla,
  Equipo,
  FactorPrestacional,
  Insumo,
  Presupuesto,
  PresupuestoItem,
} from './types.ts';

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Lee el número completo. Ej: «1.234,56» y «1,234.56» producen 1234.56. */
export function parseNumInput(v: unknown, rejectAmbiguous = true): number | null {
  let s = String(v ?? '').trim();
  if (rejectAmbiguous && /^[+-]?[1-9]\d{0,2}[.,]\d{3}$/.test(s)) return null;
  if (/^[+-]?\d{1,3}([ \u00a0\u202f]\d{3})+([.,]\d+)?$/.test(s)) {
    s = s.replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && (s.includes(',') || /\..*\./.test(s))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) && (s.includes('.') || /,.*,/.test(s))) {
    s = s.replace(/,/g, '');
  } else if (/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Lee números de cálculo y usa cero cuando no hay un valor numérico válido. Ej: «3,5» → 3.5. */
export function parseNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : (parseNumInput(v, false) ?? 0);
}

/** Fecha civil LOCAL (H-12, plan 2026-11-27): año-mes-día en la zona del usuario, no el
 *  corte UTC de toISOString() — cerca de medianoche UTC el corte daba el día de ayer o de
 *  mañana según el país. Ej: 1 ene 23:30 en Colombia (UTC-5) -> '2026-01-01' (toISOString
 *  daba '2026-01-02'). */
export function fechaCivil(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Formatea un número con separador de miles y d decimales (0-4) estilo en-US; NaN cae en 0 para no pintar "NaN" en la tabla. Ej: fmt(1234.5) -> "1,234.50". */
export function fmt(v: number, d = 2): string {
  const n = Number(v);
  return isNaN(n)
    ? (0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
    : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Símbolo de la moneda activa (config.moneda, fijado por configurarMoneda al
// cargar/cambiar config). '$' por defecto cubre COP/USD antes de hidratar.
let simboloMoneda = '$';

// Monedas del selector de países (los 6 perfiles semilla). PEN 'S/' y BOB 'Bs' llevan
// espacio: son prefijos compuestos, no símbolos pegados al número.
const SIMBOLO_POR_MONEDA: Record<string, string> = {
  COP: '$',
  USD: '$',
  EUR: '€',
  PEN: 'S/',
  CLP: '$',
  ARS: '$',
  BOB: 'Bs',
};

/** Fija el símbolo que fmtMoneda antepone (llamada única desde el provider). */
export function configurarMoneda(moneda: string): void {
  simboloMoneda = SIMBOLO_POR_MONEDA[moneda] ?? '$';
}

/** Dinero: símbolo de la moneda del país activo + fmt. Solo columnas de valor. */
export function fmtMoneda(v: number, d = 2): string {
  return simboloMoneda + fmt(v, d);
}

/** Jornada por defecto SOLO para el guard de ÷0 (días/horas borrados en la config): 30 días × 240 h es el estándar de los perfiles país (Colombia usa 25/182 con descanso dominical — ese valor vive en config/perfil, no aquí). */
export const FALLBACK_JORNADA = { dias: 30, horas: 240 } as const;

/** Suma los FP (Factores Prestacionales: % del salario que costea el empleador además del básico). Ej: prestaciones 37.06 % + seguridad social 27.46 % -> 64.52 %. */
export function sumFactorPrestacional(factores: FactorPrestacional[]): number {
  return r2(factores.reduce((s, f) => s + parseNum(f.factor), 0));
}

/** ¿El país cotiza la mano de obra por HORA (ej: US) y no por mes (Colombia)? Decide si el jornal de los APU (Análisis de Precios Unitarios) sale de costo_*_hora o de costo_*_dia. */
export function esHoraPais(pais: string, perfilesPais: ConfigListas['perfiles_pais']): boolean {
  return getPaisData(pais, perfilesPais).unidad === 'hora';
}

/** Deriva de cada cargo su costo básico y total por día y hora, desde el salario base y el FP (Factor Prestacional) total. Ej: 2 sb × $1.400.000 con FP 60 % -> básico $2.800.000/mes, total $4.480.000/mes, $149.333/día (30 días). País por hora: no divide (los valores ya son por hora). */
export function calcCargos(
  cargos: Cargo[],
  config: CivilManagerConfig,
  factorPrest: number,
  perfilesPais: ConfigListas['perfiles_pais'],
): CargoCalculado[] {
  const sb = config.salario_base || 0;
  const dias = config.dias_mes || FALLBACK_JORNADA.dias;
  const horas = config.horas_mes || FALLBACK_JORNADA.horas;
  const esHora = esHoraPais(config.pais, perfilesPais);
  return cargos.map((c) => {
    const nsb = parseNum(c.num_salarios_base);
    const valorBasico = r2(nsb * sb);
    const vrPrest = r2(valorBasico * (factorPrest / 100));
    const total = r2(valorBasico + vrPrest);
    const costo_base_dia = r2(valorBasico / dias);
    const costo_base_hora = esHora ? valorBasico : r2(valorBasico / horas);
    const costo_total_dia = esHora ? total : r2(total / dias);
    const costo_total_hora = esHora ? total : r2(total / horas);
    return {
      ...c,
      valorBasico,
      costo_base_dia,
      costo_base_hora,
      costo_total_dia,
      costo_total_hora,
    };
  });
}

/** Jornal con el que un cargo entra a la mano de obra del APU. usarFP=true toma el costo BASE (el FP se suma aparte como vrPrest); usarFP=false toma el TOTAL (FP ya incluido). esHora cambia día<->hora. */
export function cargoJornal(
  cargo: CargoCalculado | undefined,
  usarFP: boolean,
  esHora: boolean,
): number {
  if (!cargo) return 0;
  if (esHora) return usarFP ? cargo.costo_base_hora || 0 : cargo.costo_total_hora || 0;
  return usarFP ? cargo.costo_base_dia || cargo.costo_total_dia || 0 : cargo.costo_total_dia || 0;
}

/** Costo de una cuadrilla (equipo de trabajo): suma valorBasico × cantidad de cada integrante y lo baja a día/hora. Ej: 1 oficial ($2.800.000) + 2 ayudantes ($1.400.000 c/u) -> vBase $5.600.000/mes, $186.667/día. Guarda ÷0 con defaults 30 días / 240 horas. */
export function calcCuadrillaCost(
  cuadrilla: Cuadrilla,
  cargoMap: Map<string, CargoCalculado>,
  diasMes: number,
  horasMes: number,
  esHora: boolean,
): { vBase: number; costoDia: number; costoHora: number } {
  const vBase = cuadrilla.integrantes.reduce((s, int) => {
    const cargo = cargoMap.get(int.cargo_id);
    const cant = parseNum(int.cantidad);
    return s + (cargo ? (cargo.valorBasico || 0) * cant : 0);
  }, 0);
  // Guard ÷0 (días/mes=0 daba Infinity/NaN en Costo/día); mismo default que calcCargos.
  const dm = diasMes > 0 ? diasMes : FALLBACK_JORNADA.dias;
  const hm = horasMes > 0 ? horasMes : FALLBACK_JORNADA.horas;
  return {
    vBase: r2(vBase),
    costoDia: r2(vBase / dm),
    costoHora: esHora ? vBase : r2(vBase / hm),
  };
}

// ─── Subtotales por RECURSO (una sola copia: los usan calcAPU y el export Excel/PDF) ───
// Parseo con fallback conservando 0 legítimo (consumo 0 = insumo sin costo; desperdicio
// 0 % = sin merma): el `|| 1`/`|| 5` anterior los inflaba.
function numOk(v: unknown, fallback: number): number {
  const n = parseNum(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Subtotal de una fila de mano de obra: jornal del cargo × personas × rendimiento (jornadas por unidad de obra). Ej: $80.000/día × 2 personas × 0.5 = $80.000. */
export function moSubtotal(jornal: number, r: ApuRecursoMO): number {
  return jornal * parseNum(r.cant_personas) * parseNum(r.rendimiento);
}

/** Subtotal de una fila de equipo: costo por hora × rendimiento (horas de uso por unidad de obra). Ej: $15.000/h × 0.25 = $3.750. */
export function eqSubtotal(costoHora: number, r: ApuRecursoEquipo): number {
  return costoHora * parseNum(r.rendimiento);
}

/** Consumo efectivo de un insumo en el APU: NaN/negativo cae a 1 (unidad por unidad de obra); 0 es legítimo. */
export function consumoEfectivo(r: ApuRecursoInsumo): number {
  return numOk(r.consumo, 1);
}

/** Desperdicio efectivo (%): NaN/negativo cae a 5; 0 % es legítimo. */
export function despEfectivoPct(r: ApuRecursoInsumo): number {
  return numOk(r.desperdicios_pct, 5);
}

/** Costo unitario del insumo del catálogo. 'Preparado en obra' toma el costo del APU básico de referencia; sin básico válido cae al costo propio + aviso en consola dev (antes se subestimaba a 0 en silencio). */
export function insCostoU(
  ins: Insumo | undefined,
  abMap: Map<string, ApuCalculado> | null,
): number {
  if (!ins) return 0;
  if (ins.origen === 'Preparado en obra') {
    const ref = abMap?.get(ins.apu_basico_id);
    if (ref) return ref.costo_unitario;
    devError('APU preparado en obra sin básico válido:', ins.apu_basico_id);
    return ins.costo_unitario || 0;
  }
  return ins.costo_unitario;
}

/** Subtotal de una fila de insumo: costo unitario × consumo × (1 + desperdicio). Ej: $30.000/bulto × 0.35 × 1.05 = $11.025. */
export function insSubtotal(
  ins: Insumo | undefined,
  abMap: Map<string, ApuCalculado> | null,
  r: ApuRecursoInsumo,
): number {
  return insCostoU(ins, abMap) * consumoEfectivo(r) * (1 + despEfectivoPct(r) / 100);
}

/** Subtotal de una fila de transporte: 'Global' cobra tarifa fija; el resto multiplica tarifa × distancia_km. */
export function transSubtotal(r: ApuRecursoTransporte): number {
  return r.unidad === 'Global' ? parseNum(r.tarifa) : parseNum(r.tarifa) * parseNum(r.distancia_km);
}

/** Motor de precios unitarios (APU).
 * A diferencia del prototipo original, `herr` (herramienta menor) SÍ se incluye en totalDirecto/costo_unitario — en el prototipo se calculaba y mostraba en pantalla pero no se sumaba al costo real usado en presupuestos. */
export function calcAPU(
  a: Apu,
  cargosCalc: CargoCalculado[],
  equipos: Equipo[],
  insumos: Insumo[],
  apusBasicoCalc: ApuCalculado[] | null,
  herrPct: number,
  factorPrest: number,
  usarFP: boolean,
  esHora: boolean,
  cargoMapIn?: Map<string, CargoCalculado>,
  eqMapIn?: Map<string, Equipo>,
  insMapIn?: Map<string, Insumo>,
): ApuCalculado {
  const cargoMap = cargoMapIn || new Map(cargosCalc.map((c) => [c.id, c]));
  const eqMap = eqMapIn || new Map(equipos.map((e) => [e.id, e]));
  const insMap = insMapIn || new Map(insumos.map((x) => [x.id, x]));
  const abMap = apusBasicoCalc ? new Map(apusBasicoCalc.map((b) => [b.id, b])) : null;

  const subMO = r2(
    (a.recursos_mo || []).reduce((s, r) => {
      const cargo = cargoMap.get(r.cargo_id);
      if (!cargo) return s;
      return s + moSubtotal(cargoJornal(cargo, usarFP, esHora), r);
    }, 0),
  );

  const herr = r2(subMO * (herrPct / 100));

  const subEq = r2(
    (a.recursos_eq || []).reduce((s, r) => {
      const eq = eqMap.get(r.equipo_id);
      return s + (eq ? eqSubtotal(parseNum(eq.costo_hora), r) : 0);
    }, 0),
  );

  const subIns = r2(
    (a.recursos_ins || []).reduce((s, r) => {
      const ins = insMap.get(r.insumo_id);
      return s + insSubtotal(ins, abMap, r);
    }, 0),
  );

  const subTrans = r2((a.recursos_transporte || []).reduce((s, r) => s + transSubtotal(r), 0));

  const vrPrest = usarFP ? r2(subMO * (parseNum(factorPrest) / 100)) : 0;
  const subPers = r2(subMO + vrPrest);
  const totalDirecto = r2(subEq + subIns + subTrans + subPers + herr);

  return {
    id: a.id,
    subMO,
    herr,
    subEq,
    subIns,
    subTrans,
    vrPrest,
    subPers,
    totalDirecto,
    costo_unitario: totalDirecto,
  };
}

interface AiuResult {
  cdUnit: number;
  cdTotal: number;
  aiuPct: number;
  admTotal: number;
  impTotal: number;
  utiTotal: number;
  ivaUtilidad: number;
  vrUnitario: number;
  valorTotal: number;
  aiuWarn: boolean;
}

/** Calcula el valor de un ítem de presupuesto aplicando AIU (Administración/Imprevistos/Utilidad), estilo colombiano: IVA solo sobre utilidad. */
export function calcItemValue(
  item: PresupuestoItem,
  apuCalc: ApuCalculado | undefined,
  aiu: AiuOverride | null,
  config: CivilManagerConfig,
): AiuResult {
  const cdUnit = apuCalc?.costo_unitario || 0;
  const cantidad = parseNum(item.cantidad);
  const cdTotal = r2(cdUnit * cantidad);
  const pctA = aiu?.activo ? aiu.pct_a : config.pct_administracion;
  const pctI = aiu?.activo ? aiu.pct_i : config.pct_imprevistos;
  const pctU = aiu?.activo ? aiu.pct_u : config.pct_utilidad;
  // IVA por país (config.iva_pct se fija al activar el perfil de país: CO 19, PE 18,
  // EC 15, CL 19, AR 21, BO 13); estados viejos sin el campo caen al 19 % colombiano.
  const ivaPct = aiu?.activo ? aiu.iva_pct : (config.iva_pct ?? 19);
  const aiuPct = pctA + pctI + pctU;
  const admTotal = r2(cdTotal * (pctA / 100));
  const impTotal = r2(cdTotal * (pctI / 100));
  const utiTotal = r2(cdTotal * (pctU / 100));
  const ivaUtilidad = r2(utiTotal * (ivaPct / 100));
  const vrUnitario = r2(cdUnit * (1 + aiuPct / 100));
  const valorTotal = r2(cdTotal + admTotal + impTotal + utiTotal + ivaUtilidad);
  return {
    cdUnit,
    cdTotal,
    aiuPct,
    admTotal,
    impTotal,
    utiTotal,
    ivaUtilidad,
    vrUnitario,
    valorTotal,
    aiuWarn: aiuPct < 5 || aiuPct > 50,
  };
}

interface ResumenPresupuesto {
  costoDirecto: number;
  administracion: number;
  imprevistos: number;
  utilidad: number;
  ivaUtilidad: number;
  valorTotal: number;
}

/** Totales de todo el presupuesto —costo directo, AIU (Administración, Imprevistos, Utilidad), IVA sobre la utilidad y valor total— sumando ítem por ítem; las filas de capítulo final solo agrupan y no suman. */
export function calcResumenPresupuesto(
  items: PresupuestoItem[],
  apuCalcMap: Map<string, ApuCalculado>,
  aiu: AiuOverride | null,
  config: CivilManagerConfig,
): ResumenPresupuesto {
  const itemsReales = items.filter((it) => !esCapituloFinal(it));
  let costoDirecto = 0;
  let administracion = 0;
  let imprevistos = 0;
  let utilidad = 0;
  let ivaUtilidad = 0;
  let valorTotal = 0;
  for (const it of itemsReales) {
    const r = calcItemValue(it, apuCalcMap.get(it.apu_id), aiu, config);
    costoDirecto += r.cdTotal;
    administracion += r.admTotal;
    imprevistos += r.impTotal;
    utilidad += r.utiTotal;
    ivaUtilidad += r.ivaUtilidad;
    valorTotal += r.valorTotal;
  }
  return {
    costoDirecto: r2(costoDirecto),
    administracion: r2(administracion),
    imprevistos: r2(imprevistos),
    utilidad: r2(utilidad),
    ivaUtilidad: r2(ivaUtilidad),
    valorTotal: r2(valorTotal),
  };
}

/** ¿La fila es un capítulo (título que agrupa ítems, sin cantidad ni precio)? es_capitulo_manual (decisión del usuario en la grilla) gana sobre es_capitulo (autodetección al importar el formulario). */
export function esCapituloFinal(item: PresupuestoItem): boolean {
  if (item.es_capitulo_manual !== null && item.es_capitulo_manual !== undefined)
    return item.es_capitulo_manual;
  return item.es_capitulo;
}

/** Mapa de APU (Análisis de Precios Unitarios) calculados para UN presupuesto: si está
 * 'cerrado' y tiene snaps, recalcula con las fotos congeladas (cargos/equipos/insumos/APUs
 * del momento del cierre) — editar el catálogo global NO mueve un presupuesto cerrado ya
 * entregado; en otro estado devuelve el mapa vivo. Los presupuestos anteriores a los snaps
 * (apus_snap vacío) caen al mapa vivo para no quedar en cero. */
export function calcMapParaPres(
  pres: Presupuesto,
  state: CivilManagerState,
  vivo: Map<string, ApuCalculado>,
): Map<string, ApuCalculado> {
  if (pres.estado !== 'cerrado' || !pres.apus_snap?.length) return vivo;
  // Config congelada: salario/jornada del perfil snap (si existe) sobre la config viva;
  // herr_pct/usar_fp_en_apu no se snapan — son parámetros globales de doctrina.
  const pf = pres.perfil_pais_snap;
  const configSnap: CivilManagerConfig = {
    ...state.config,
    salario_base: pf?.smmlv ?? state.config.salario_base,
    dias_mes: pf?.dias_mes ?? state.config.dias_mes,
    horas_mes: pf?.horas_mes ?? state.config.horas_mes,
    unidad: pf?.unidad ?? state.config.unidad,
  };
  const fpSnap = pres.factores_snap?.length ? pres.factores_snap : state.factoresPrestaciones;
  const factorPrestSnap = sumFactorPrestacional(fpSnap);
  const esHoraSnap = pf
    ? pf.unidad === 'hora'
    : esHoraPais(state.config.pais, state.config_listas.perfiles_pais);
  const cargosSnap = calcCargos(pres.cargos_snap ?? [], configSnap, factorPrestSnap, []);
  const apusSnap = pres.apus_snap ?? [];
  const basicosSnap = apusSnap
    .filter((a) => a.es_basico)
    .map((a) =>
      calcAPU(
        a,
        cargosSnap,
        pres.equipos_snap ?? [],
        pres.insumos_snap ?? [],
        null,
        pres.herr_pct_snap ?? state.config.herr_pct,
        factorPrestSnap,
        pres.usar_fp_en_apu_snap ?? state.config.usar_fp_en_apu,
        esHoraSnap,
      ),
    );
  const calc = apusSnap.map((a) =>
    calcAPU(
      a,
      cargosSnap,
      pres.equipos_snap ?? [],
      pres.insumos_snap ?? [],
      basicosSnap,
      pres.herr_pct_snap ?? state.config.herr_pct,
      factorPrestSnap,
      pres.usar_fp_en_apu_snap ?? state.config.usar_fp_en_apu,
      esHoraSnap,
    ),
  );
  return new Map(calc.map((c) => [c.id, c]));
}

/** Clasifica un presupuesto para el árbol de proyectos: 'sub_proyecto' (tiene padre), 'principal' (marcado con_sub_proyectos o con hijos) o 'independiente'. */
export function getTipoProyecto(
  p: { parent_id: string | null; con_sub_proyectos: boolean; id: string },
  presupuestos: { parent_id: string | null }[],
): 'sub_proyecto' | 'principal' | 'independiente' {
  if (p.parent_id) return 'sub_proyecto';
  const tieneHijos = presupuestos.some((x) => x.parent_id === p.id);
  if (tieneHijos || p.con_sub_proyectos) return 'principal';
  return 'independiente';
}

/** Aplana el árbol de presupuestos (hasta 2 niveles) en lista ordenada con level para indentar el render; los huérfanos (padre borrado) se tratan como raíz para que no desaparezcan de la lista. */
export function flattenPresupuestos<T extends { id: string; parent_id: string | null }>(
  presupuestos: T[],
): { pres: T; level: number }[] {
  const result: { pres: T; level: number }[] = [];
  // Huérfanos (parent_id apuntando a un padre eliminado): tratados como raíz — sin esto
  // quedaban invisibles e irrecuperables en la UI.
  const ids = new Set(presupuestos.map((p) => p.id));
  const principales = presupuestos.filter((p) => !p.parent_id || !ids.has(p.parent_id));
  for (const p of principales) {
    result.push({ pres: p, level: 0 });
    const hijos = presupuestos.filter((x) => x.parent_id === p.id);
    for (const h of hijos) result.push({ pres: h, level: 1 });
  }
  return result;
}
