import type { PlanoBajante } from './PlanoState';

// Regla central de integridad de conexiones a bajantes/cajas (ítems 1/9): TODO camino que
// asocie un ramal a un bajante — dibujo, arrastre, panel derecho, menú contextual, editores —
// pasa por aquí ANTES de escribir recibeDeIds/alimentaIds/ini/fin, de modo que ninguna
// herramienta pueda dejar la red en un estado inválido.

export interface ConexionBajanteCheck {
  ok: boolean;
  title?: string;
  msg?: string;
}

// Un bajante recibe máximo 2 ramales (Y doble) contando AMBOS sentidos de la asociación
// (recibeDeIds = llegan, alimentaIds = nacen ahí).
const MAX_BAJANTE = 2;

/** ¿El elemento es una caja (aguas negras/lluvias)? */
export function esCaja(b: Pick<PlanoBajante, 'tipo'>): boolean {
  return b.tipo === 'caja_san' || b.tipo === 'caja_ll';
}

/** Ids asociados al bajante por ambos sentidos, sin duplicados. */
export function asociadosDeBajante(baj: PlanoBajante): Set<string> {
  return new Set([...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]);
}

/** ¿Puede `ramal` asociarse a `baj` en la dirección dada? Valida misma red, reglas por tipo
 *  y topes:
 *  - Bajante: solo ramales (ni llegan ni salen tributarios), máximo 2 asociaciones en total.
 *  - Caja (orig. usuario): ENTRADAS ilimitadas de ramales y tributarios (sin restricción);
 *    SALIDA máximo UNA y SOLO de tipo ramal — un tributario que intenta salir se rechaza. */
export function puedeConectarRamalABajante(
  baj: PlanoBajante,
  ramal: { id: string; net?: string; tipo?: string },
  direccion: 'recibe' | 'alimenta' = 'recibe',
): ConexionBajanteCheck {
  if (baj.net !== (ramal.net ?? '')) {
    return {
      ok: false,
      title: 'Red distinta',
      msg: 'El trazo y el elemento de conexión deben pertenecer a la misma red.',
    };
  }
  if (esCaja(baj)) {
    if (direccion === 'alimenta') {
      if (ramal.tipo === 'tributario') {
        return {
          ok: false,
          title: 'Conexión no permitida',
          msg: 'La salida de una caja debe ser un ramal: un tributario no puede salir de ella.',
        };
      }
      if (!(baj.alimentaIds || []).includes(ramal.id) && (baj.alimentaIds || []).length >= 1) {
        return {
          ok: false,
          title: 'Caja con salida',
          msg: 'Esta caja ya tiene un ramal de salida (solo se permite una salida).',
        };
      }
    }
    // Entrada a caja: ramal o tributario, cantidad ilimitada.
    return { ok: true };
  }
  if (ramal.tipo === 'tributario') {
    return {
      ok: false,
      title: 'Conexión no permitida',
      msg: 'Solo los ramales pueden conectarse a un bajante (ni llegar ni salir).',
    };
  }
  const total = asociadosDeBajante(baj);
  if (!total.has(ramal.id) && total.size >= MAX_BAJANTE) {
    return {
      ok: false,
      title: 'Bajante completo',
      msg: 'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
    };
  }
  return { ok: true };
}
