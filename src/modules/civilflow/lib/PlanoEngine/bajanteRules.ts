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
// (recibeDeIds = llegan, alimentaIds = nacen ahí). Las cajas CAN/CALL aceptan máximo 1.
const MAX_BAJANTE = 2;
const MAX_CAJA = 1;

const esCaja = (b: PlanoBajante): boolean => b.tipo === 'caja_san' || b.tipo === 'caja_ll';

/** Ids asociados al bajante por ambos sentidos, sin duplicados. */
export function asociadosDeBajante(baj: PlanoBajante): Set<string> {
  return new Set([...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]);
}

/** ¿Puede `ramal` asociarse a `baj`? Valida misma red, que el trazo sea RAMAL (un tributario
 *  ni puede llegar ni salir de un bajante — orig. usuario) y tope de asociaciones (2 bajante,
 *  1 caja). */
export function puedeConectarRamalABajante(
  baj: PlanoBajante,
  ramal: { id: string; net?: string; tipo?: string },
): ConexionBajanteCheck {
  if (baj.net !== (ramal.net ?? '')) {
    return {
      ok: false,
      title: 'Red distinta',
      msg: 'El trazo y el elemento de conexión deben pertenecer a la misma red.',
    };
  }
  if (ramal.tipo === 'tributario') {
    if (esCaja(baj)) {
      const nombre = baj.tipo === 'caja_ll' ? 'aguas lluvias' : 'aguas negras';
      return {
        ok: false,
        title: 'Conexión no permitida',
        msg: `Un tributario no puede llegar ni salir de una caja. Las cajas de ${nombre} solo aceptan ramales.`,
      };
    }
    return {
      ok: false,
      title: 'Conexión no permitida',
      msg: 'Solo los ramales pueden conectarse a un bajante (ni llegar ni salir).',
    };
  }
  const total = asociadosDeBajante(baj);
  if (!total.has(ramal.id) && total.size >= (esCaja(baj) ? MAX_CAJA : MAX_BAJANTE)) {
    return esCaja(baj)
      ? {
          ok: false,
          title: 'Caja completa',
          msg: 'Esta caja ya tiene un ramal conectado (máximo permitido).',
        }
      : {
          ok: false,
          title: 'Bajante completo',
          msg: 'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
        };
  }
  return { ok: true };
}
