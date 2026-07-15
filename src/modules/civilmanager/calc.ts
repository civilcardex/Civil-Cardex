import { getPaisData } from './seedData';
import type {
  Apu,
  ApuCalculado,
  AiuOverride,
  Cargo,
  CargoCalculado,
  CivilManagerConfig,
  ConfigListas,
  Cuadrilla,
  Equipo,
  FactorPrestacional,
  Insumo,
  PresupuestoItem,
} from './types';

export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Parses locale-aware numeric input; always returns a finite number (never a string). */
export function parseNum(v: unknown): number {
  const s = String(v ?? '').replace(/,/g, '.');
  if (s === '' || s === '.' || s === '-') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function fmt(v: number, d = 2): string {
  const n = Number(v);
  return isNaN(n) ? (0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function sumFactorPrestacional(factores: FactorPrestacional[]): number {
  return r2(factores.reduce((s, f) => s + parseNum(f.factor), 0));
}

export function esHoraPais(pais: string, perfilesPais: ConfigListas['perfiles_pais']): boolean {
  return getPaisData(pais, perfilesPais).unidad === 'hora';
}

export function calcCargos(cargos: Cargo[], config: CivilManagerConfig, factorPrest: number, perfilesPais: ConfigListas['perfiles_pais']): CargoCalculado[] {
  const sb = config.salario_base || 0;
  const dias = config.dias_mes || 30;
  const horas = config.horas_mes || 240;
  const esHora = esHoraPais(config.pais, perfilesPais);
  return cargos.map(c => {
    const nsb = parseNum(c.num_salarios_base);
    const valorBasico = r2(nsb * sb);
    const vrPrest = r2(valorBasico * (factorPrest / 100));
    const total = r2(valorBasico + vrPrest);
    const costo_base_dia = r2(valorBasico / dias);
    const costo_base_hora = esHora ? valorBasico : r2(valorBasico / horas);
    const costo_total_dia = esHora ? total : r2(total / dias);
    const costo_total_hora = esHora ? total : r2(total / horas);
    return { ...c, valorBasico, costo_base_dia, costo_base_hora, costo_total_dia, costo_total_hora };
  });
}

export function cargoJornal(cargo: CargoCalculado | undefined, usarFP: boolean, esHora: boolean): number {
  if (!cargo) return 0;
  if (esHora) return usarFP ? cargo.costo_base_hora || 0 : cargo.costo_total_hora || 0;
  return usarFP ? cargo.costo_base_dia || cargo.costo_total_dia || 0 : cargo.costo_total_dia || 0;
}

export function calcCuadrillaCost(
  cuadrilla: Cuadrilla,
  cargoMap: Map<string, CargoCalculado>,
  diasMes: number,
  horasMes: number,
  esHora: boolean
): { vBase: number; costoDia: number; costoHora: number } {
  const vBase = cuadrilla.integrantes.reduce((s, int) => {
    const cargo = cargoMap.get(int.cargo_id);
    const cant = parseNum(int.cantidad);
    return s + (cargo ? (cargo.valorBasico || 0) * cant : 0);
  }, 0);
  return {
    vBase: r2(vBase),
    costoDia: r2(vBase / diasMes),
    costoHora: esHora ? vBase : r2(vBase / horasMes),
  };
}

/**
 * Motor de precios unitarios (APU). A diferencia del prototipo original, `herr`
 * (herramienta menor) SÍ se incluye en totalDirecto/costo_unitario — en el prototipo
 * se calculaba y mostraba en pantalla pero no se sumaba al costo real usado en presupuestos.
 */
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
  insMapIn?: Map<string, Insumo>
): ApuCalculado {
  const cargoMap = cargoMapIn || new Map(cargosCalc.map(c => [c.id, c]));
  const eqMap = eqMapIn || new Map(equipos.map(e => [e.id, e]));
  const insMap = insMapIn || new Map(insumos.map(x => [x.id, x]));
  const abMap = apusBasicoCalc ? new Map(apusBasicoCalc.map(b => [b.id, b])) : null;

  const subMO = r2(
    (a.recursos_mo || []).reduce((s, r) => {
      const cargo = cargoMap.get(r.cargo_id);
      if (!cargo) return s;
      const costoUnitario = cargoJornal(cargo, usarFP, esHora);
      return s + costoUnitario * parseNum(r.cant_personas) * parseNum(r.rendimiento);
    }, 0)
  );

  const herr = r2(subMO * (herrPct / 100));

  const subEq = r2(
    (a.recursos_eq || []).reduce((s, r) => {
      const eq = eqMap.get(r.equipo_id);
      return s + (eq ? parseNum(eq.costo_hora) * parseNum(r.rendimiento) : 0);
    }, 0)
  );

  const subIns = r2(
    (a.recursos_ins || []).reduce((s, r) => {
      const ins = insMap.get(r.insumo_id);
      let costoU = 0;
      if (ins) {
        if (ins.origen === 'Preparado en obra') {
          const ref = abMap?.get(ins.apu_basico_id);
          costoU = ref ? ref.costo_unitario : 0;
        } else {
          costoU = ins.costo_unitario;
        }
      }
      const consumo = parseNum(r.consumo) || 1;
      const desp = (parseNum(r.desperdicios_pct) || 5) / 100;
      return s + costoU * consumo * (1 + desp);
    }, 0)
  );

  const subTrans = r2(
    (a.recursos_transporte || []).reduce((s, r) => {
      return s + (r.unidad === 'Global' ? parseNum(r.tarifa) : parseNum(r.tarifa) * parseNum(r.distancia_km));
    }, 0)
  );

  const vrPrest = usarFP ? r2(subMO * (parseNum(factorPrest) / 100)) : 0;
  const subPers = r2(subMO + vrPrest);
  const totalDirecto = r2(subEq + subIns + subTrans + subPers + herr);

  return { id: a.id, subMO, herr, subEq, subIns, subTrans, vrPrest, subPers, totalDirecto, costo_unitario: totalDirecto };
}

export interface AiuResult {
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
export function calcItemValue(item: PresupuestoItem, apuCalc: ApuCalculado | undefined, aiu: AiuOverride | null, config: CivilManagerConfig): AiuResult {
  const cdUnit = apuCalc?.costo_unitario || 0;
  const cantidad = parseNum(item.cantidad);
  const cdTotal = r2(cdUnit * cantidad);
  const pctA = aiu?.activo ? aiu.pct_a : config.pct_administracion;
  const pctI = aiu?.activo ? aiu.pct_i : config.pct_imprevistos;
  const pctU = aiu?.activo ? aiu.pct_u : config.pct_utilidad;
  const ivaPct = aiu?.activo ? aiu.iva_pct : 19;
  const aiuPct = pctA + pctI + pctU;
  const admTotal = r2(cdTotal * (pctA / 100));
  const impTotal = r2(cdTotal * (pctI / 100));
  const utiTotal = r2(cdTotal * (pctU / 100));
  const ivaUtilidad = r2(utiTotal * (ivaPct / 100));
  const vrUnitario = r2(cdUnit * (1 + aiuPct / 100));
  const valorTotal = r2(cdTotal + admTotal + impTotal + utiTotal + ivaUtilidad);
  return { cdUnit, cdTotal, aiuPct, admTotal, impTotal, utiTotal, ivaUtilidad, vrUnitario, valorTotal, aiuWarn: aiuPct < 5 || aiuPct > 50 };
}

export interface ResumenPresupuesto {
  costoDirecto: number;
  administracion: number;
  imprevistos: number;
  utilidad: number;
  ivaUtilidad: number;
  valorTotal: number;
}

export function calcResumenPresupuesto(items: PresupuestoItem[], apuCalcMap: Map<string, ApuCalculado>, aiu: AiuOverride | null, config: CivilManagerConfig): ResumenPresupuesto {
  const itemsReales = items.filter(it => !esCapituloFinal(it));
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

export function esCapituloFinal(item: PresupuestoItem): boolean {
  if (item.es_capitulo_manual !== null && item.es_capitulo_manual !== undefined) return item.es_capitulo_manual;
  return item.es_capitulo;
}

export function getTipoProyecto(p: { parent_id: string | null; con_sub_proyectos: boolean; id: string }, presupuestos: { parent_id: string | null }[]): 'sub_proyecto' | 'principal' | 'independiente' {
  if (p.parent_id) return 'sub_proyecto';
  const tieneHijos = presupuestos.some(x => x.parent_id === p.id);
  if (tieneHijos || p.con_sub_proyectos) return 'principal';
  return 'independiente';
}

export function flattenPresupuestos<T extends { id: string; parent_id: string | null }>(presupuestos: T[]): { pres: T; level: number }[] {
  const result: { pres: T; level: number }[] = [];
  const principales = presupuestos.filter(p => !p.parent_id);
  for (const p of principales) {
    result.push({ pres: p, level: 0 });
    const hijos = presupuestos.filter(x => x.parent_id === p.id);
    for (const h of hijos) result.push({ pres: h, level: 1 });
  }
  return result;
}
