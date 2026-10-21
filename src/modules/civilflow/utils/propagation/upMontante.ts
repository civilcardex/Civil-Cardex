import { cntVacio, colaDe, cabezaDe, type Cnt, type BajanteP, type RamalP } from './counting.ts';
import { bajanteEntregaSuCargaAlRamal } from './counting.ts';

/**
 * Fase 3b: entrega la carga de un montante a los ramales del MISMO plano que salen de él (cola del ramal, `ini` = código o `alimentaIds`).
 * Ej: ramal que nace en MAC1 recibe su carga; ramal que entra por la cabeza no la recibe (evita ciclos y conteos triplicados).
 */
export function calcularUpMonte(
  ramales: RamalP[],
  bajes: BajanteP[],
  cargaBaj: Map<string, Cnt>,
): Map<string, Cnt> {
  // 3b) Montantes/bajantes que alimentan cada ramal (MISMO plano) — DIRECCIONAL (orig.
  //     usuario): SOLO si el ramal SALE del montante (contacto en la COLA del ramal,
  //     r.ini = código, o alimentaIds lo lista). Si el ramal ENTRA (contacto en la CABEZA,
  //     r.fin = código), NO recibe la carga del montante — sus aparatos quedan locales, con
  //     el cap de 1 manual.
  //     La REGLA vive en `bajanteEntregaSuCargaAlRamal` (una sola fuente: la comparten la
  //     herencia entre pisos y el panel). La asociación MANUAL del checkbox gana (F-1);
  //     sin manual, el veto por DIRECCIÓN manda — y `recibeDeIds` cuenta como ENTRA (un
  //     ramal listado como receptor jamás recibe la carga del montante: sin esto volvía
  //     el "se triplican", auditoría C-3).
  const upMonte = new Map<string, Cnt>();
  for (const r of ramales) {
    const cola = colaDe(r);
    const cabeza = cabezaDe(r);
    const monte: Cnt = {};
    for (const b of bajes) {
      if (b.pid !== r.pid) continue;
      const code = b.code || b.id;
      const entrega = bajanteEntregaSuCargaAlRamal({
        ramalId: r.id,
        ramalIni: r.ini,
        ramalFin: r.fin,
        cola,
        cabeza,
        bajCode: code,
        bajX: b.x ?? 0,
        bajY: b.y ?? 0,
        alimentaIds: b.alimentaIds,
        recibeDeIds: b.recibeDeIds,
        asocManual: b.asocManual,
      });
      if (entrega) {
        const c = cargaBaj.get(`${b.id}|${b.pid}`);
        if (c && !cntVacio(c)) {
          for (const [k, v] of Object.entries(c)) monte[k] = (monte[k] || 0) + v;
        }
      }
    }
    upMonte.set(r.key, monte);
  }
  return upMonte;
}
