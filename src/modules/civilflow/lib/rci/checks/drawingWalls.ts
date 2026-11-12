/**
 * Verificaciones de dibujo (piso activo del visor): distancia de cada muro marcado al ramal rci
 * más cercano ≤ Dmuro y distancia mínima ramal–muro ≥ 0,10 m (NFPA 13). Sin dibujo no aplican.
 * Ej: 1 muro a 0,35 m con Dmuro 0,30 → "1 de 2 muro(s) descubiertos" en NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import { distSegSeg, MIN_MURO_M } from '../../shared/geometry.ts';
import type { ChecksCtx } from './helpers';

/** Las 2 verificaciones geométricas contra el dibujo del piso activo (muros vs ramales rci). */
export function verificarMurosDibujo(ctx: ChecksCtx): void {
  const { st, R, add, dibujo } = ctx;
  /* Distancia de ramales a muros (ped. usuario): cada guía marcada como MURO del piso activo
     debe quedar a ≤ DMR (distancia máx. de rociador a muro, columna DMR de Pisos del edificio)
     del ramal rci más cercano. La geometría llega del doc de trazos del piso activo ya convertida
     a METROS (compute la pasa opcionalmente); sin dibujo no aplica. */
  if (dibujo) {
    /* DMR del piso ACTIVO: la fila de su tipología (los pisos de una tipología comparten DMR
       porque entra en la llave de criterios); vacío = la global roc.Dmuro. */
    const tipAct = R.edif.active;
    const dmFila = tipAct ? num(st.pisos.rows[tipAct.g.rep]?.Dmuro) : null;
    const dm = dmFila ?? num(st.roc.Dmuro) ?? 0;
    if (!(dm > 0)) {
      add(
        'Distancia de ramales a muros ≤ Dmuro',
        'PENDIENTE',
        'Sin Dmuro definido',
        'NFPA 13-2025 cap. 10 — defina la distancia máxima de rociador a muro en la columna DMR de Pisos del edificio',
        'Defina la distancia al muro en RCI → Tipologías → Pisos del edificio (columna DMR).',
        ['tipologias', 'pisos'],
      );
    } else if (!dibujo.ramPts.length) {
      add(
        'Distancia de ramales a muros ≤ Dmuro',
        'PENDIENTE',
        `Sin ramales rci en el piso activo (${dibujo.muros.length} muro(s) marcados)`,
        `NFPA 13-2025 cap. 10 — cada muro a ≤ ${f1(dm, 2)} m del ramal rci más cercano`,
        'Dibuje los ramales de la red en el piso activo.',
        ['rociadores', 'rectangulo'],
      );
    } else if (!dibujo.muros.length) {
      add(
        'Distancia de ramales a muros ≤ Dmuro',
        'PENDIENTE',
        'Sin muros marcados',
        `NFPA 13-2025 cap. 10 — cada muro a ≤ ${f1(dm, 2)} m del ramal rci más cercano`,
        'Marque muros con la herramienta Guía (menú → Definir como muro).',
        ['rociadores', 'rectangulo'],
      );
    } else {
      /* POR MURO (regla del campo «Dmuro»): cada MURO debe quedar a ≤ Dmuro del ramal rci más
         cercano — los ramales interiores NO se juzgan (no tienen muro que cubrir junto a
         ellos; exigírselo a un recinto ancho haría la red imdibujable). Una pasada calcula la
         distancia ramal↔muro de la que salen las dos filas. */
      let peor = 0;
      let descubiertos = 0;
      for (const muro of dibujo.muros) {
        let mejor = Infinity;
        for (const pts of dibujo.ramPts) {
          for (let i = 0; i < muro.length - 1; i++) {
            for (let j = 0; j < pts.length - 1; j++) {
              mejor = Math.min(mejor, distSegSeg(muro[i], muro[i + 1], pts[j], pts[j + 1]));
            }
          }
        }
        if (mejor > peor) peor = mejor;
        if (mejor > dm + 1e-9) descubiertos++;
      }
      add(
        'Distancia de ramales a muros ≤ Dmuro',
        descubiertos ? 'NO CUMPLE' : 'CUMPLE',
        `${descubiertos} de ${dibujo.muros.length} muro(s) descubiertos · peor ${f1(peor, 2)} m`,
        `NFPA 13-2025 cap. 10 — cada muro a ≤ ${f1(dm, 2)} m del ramal rci más cercano (Dmuro = ${f1(dm, 2)} m)`,
        descubiertos
          ? 'Acerque un ramal al muro señalado: la distancia al ramal más cercano no puede superar el DMR de Pisos del edificio.'
          : '',
        ['rociadores', 'rectangulo'],
      );

      /* MÍNIMO por ramal: ningún ramal puede quedar pegado ni cruzar un muro — distancia
         ramal↔muro ≥ MIN_MURO_M (0,10 m, NFPA 13). Fila propia para no mezclar con el máximo. */
      let pegados = 0;
      let menor = Infinity;
      for (const pts of dibujo.ramPts) {
        let mejor = Infinity;
        for (const muro of dibujo.muros) {
          for (let i = 0; i < muro.length - 1; i++) {
            for (let j = 0; j < pts.length - 1; j++) {
              mejor = Math.min(mejor, distSegSeg(muro[i], muro[i + 1], pts[j], pts[j + 1]));
            }
          }
        }
        if (mejor < menor) menor = mejor;
        if (mejor < MIN_MURO_M - 1e-9) pegados++;
      }
      add(
        'Distancia mínima ramal–muro ≥ 0,10 m',
        pegados ? 'NO CUMPLE' : 'CUMPLE',
        `${pegados} de ${dibujo.ramPts.length} ramal(es) pegados · menor ${f1(menor, 2)} m`,
        'NFPA 13-2025 cap. 10 — distancia mínima ramal–muro 0,10 m (ni pegado ni cruzando el muro)',
        pegados
          ? 'Aleje el ramal señalado del muro: la distancia mínima ramal–muro es de 0,10 m (NFPA 13).'
          : '',
        ['rociadores', 'rectangulo'],
      );
    }
  }
}

// distSegSeg (distancia mínima entre dos segmentos, con test de cruce) vive en
// lib/shared/geometry — única copia compartida con el chequeo EN VIVO del visor (rciAutoDraw).
