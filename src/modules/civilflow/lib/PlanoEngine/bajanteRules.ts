import type { PlanoBajante } from './PlanoState.ts';

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

export function esCaja(b: Pick<PlanoBajante, 'tipo'>): boolean {
  return b.tipo === 'caja_san' || b.tipo === 'caja_ll';
}

export function asociadosDeBajante(baj: PlanoBajante): Set<string> {
  return new Set([...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]);
}

/** ¿La tubería vertical ya tiene sus 2 conexiones llenas (máximo 2 ramales)? Las cajas no tienen
 *  tope: les pueden llegar todos los ramales que quepan. */
export function bajanteLleno(baj: PlanoBajante): boolean {
  if (esCaja(baj)) return false;
  return asociadosDeBajante(baj).size >= MAX_BAJANTE;
}

/** La única puerta de entrada para asociar un ramal a un bajante o caja: revisa que sean de la
 *  misma red y que se respeten los topes (2 entradas en bajante, 1 sola salida y solo de ramales;
 *  las cajas aceptan muchas entradas). */
export function puedeConectarRamalABajante(
  baj: PlanoBajante,
  ramal: { id: string; net?: string; tipo?: string; esCanalId?: string | null },
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
  // Ramal de canal (orig. usuario): EXENTO del tope de 2 asociaciones — los ramales que
  // nacen de un canal conectan a los bajantes del área sin agotar la Y doble del bajante.
  if (!total.has(ramal.id) && total.size >= MAX_BAJANTE && !ramal.esCanalId) {
    return {
      ok: false,
      title: 'Bajante completo',
      msg: 'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
    };
  }
  return { ok: true };
}
