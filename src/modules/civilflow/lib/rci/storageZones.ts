import { num } from './hydraulics.ts';
import { RIESGOS_BAJO_MINIMO_ALMACENAMIENTO } from './tables.ts';
import type { PisoRow, ZonaAlmacenamientoRci } from './types.ts';

export const PENDIENTE_ZONA = 'Por determinar';
export const ESPECIAL_ZONA = 'Almacenamiento alto o de diseño específico';
export const MISCELANEO_ZONA = 'Misceláneo';
export const OTRO_ZONA = 'Otro caso';
export const MIXTO_ZONA = 'Mercancía mixta';

export const pisoDeZona = (piso: PisoRow): string => String(piso.planId || piso.planta || '');
export const llevaRepisas = (z: ZonaAlmacenamientoRci): boolean =>
  /^(Estantería|Rack)/.test(z.disposicion ?? '');
export const esPlasticoA = (z: ZonaAlmacenamientoRci): boolean =>
  z.mercancia === 'Plástico grupo A';
export const necesitaDetalleZona = (z: ZonaAlmacenamientoRci): boolean =>
  [z.mercancia, z.disposicion, z.embalaje, z.pale].some((v) => v === OTRO_ZONA);

/** Distingue falta de datos y alcance del módulo; nunca certifica el almacenamiento. */
export function evaluarZona(z: ZonaAlmacenamientoRci, piso: PisoRow | undefined) {
  const arrume = num(z.arrume),
    techo = num(z.techo === '' || z.techo == null ? piso?.htecho : z.techo);
  const alturasInvalidas =
    (arrume !== null && arrume <= 0) ||
    (techo !== null && techo <= 0) ||
    (arrume !== null && techo !== null && arrume >= techo);
  const miscelaneo = z.tipo === MISCELANEO_ZONA;
  const valores = [z.tipo, z.mercancia, z.disposicion, z.embalaje, z.pale];
  if (llevaRepisas(z)) valores.push(z.repisa);
  if (esPlasticoA(z)) valores.push(z.expansion, z.encapsulado);
  if (miscelaneo) valores.push(z.unaPila);
  const medidas = miscelaneo ? [num(z.recinto), num(z.area), num(z.pila)] : [];
  if (miscelaneo && z.unaPila === 'No') medidas.push(num(z.separacion));
  const faltan =
    !z.nombre.trim() ||
    !piso?.riesgo ||
    valores.some((v) => !v || v === PENDIENTE_ZONA) ||
    arrume === null ||
    techo === null ||
    alturasInvalidas ||
    medidas.some((v) => v === null || v <= 0) ||
    (miscelaneo &&
      ((medidas[2] ?? 0) > (medidas[1] ?? 0) || (medidas[1] ?? 0) > (medidas[0] ?? 0))) ||
    (necesitaDetalleZona(z) && !z.detalle?.trim());
  const fuera =
    piso?.riesgo === 'Sin rociadores' ||
    RIESGOS_BAJO_MINIMO_ALMACENAMIENTO.has(piso?.riesgo ?? '') ||
    z.tipo === ESPECIAL_ZONA ||
    z.mercancia === MIXTO_ZONA ||
    z.mercancia?.startsWith('Especial ·') ||
    necesitaDetalleZona(z) ||
    (arrume !== null && arrume > 3.66);
  const estado = fuera
    ? 'Fuera del alcance del cálculo simplificado'
    : faltan
      ? 'Pendiente de datos'
      : 'Datos completos · requiere revisión técnica';
  return { estado, fuera, arrume, techo, alturasInvalidas };
}
