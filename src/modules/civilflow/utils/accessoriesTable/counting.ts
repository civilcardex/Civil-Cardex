import { diamPulgFromLabel } from '../diamPulgFromLabel.ts';
import { fmtPulg } from '../formatUtils.ts';
import {
  ACC_MED_CODOS,
  CODO_90_IDS,
  HYDRO_TEE_IDS,
  compactYeeDiam,
  type HidroEntry,
} from '../sanFittingsCatalog.ts';
import type { RamalDibujo, TribDibujo } from './collection';
import type { Tramo } from '../../context/tramosReducer';

/** Añade un accesorio al total de un diámetro. */
export type AddAcc = (diam: string, accId: string, count: number) => void;

/**
 * Conteo de accesorios por diámetro: codons de mitad de ramal, uniones sanÑvent, yees y
 * accesorios de extremo. Devuelve el total y las dos funciones que usa el bloque de bushing.
 */
export function contarAccesorios(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  catalog: { id: string; nombre: string }[],
  summaryCatalog: { id: string; nombre: string }[],
  drawingRamales: RamalDibujo[],
  tribDrawing: TribDibujo[],
  yeeDiams: Record<string, { simple: string[]; doble: string[] }>,
  ventCodoCombos: Record<string, string[]>,
  hidroData: Record<string, HidroEntry>,
  tramos: Tramo[],
): {
  totals: Record<string, Record<string, number>>;
  pulgById: Record<string, number>;
  accMedCodoCounts: Record<string, Record<string, number>>;
  accMed45Counts: Record<string, Record<string, number>>;
  addAcc: AddAcc;
  countAccMedCodos: (r: { id: string; planId: string; accMed?: Record<string, string> }) => void;
} {
  const totals: Record<string, Record<string, number>> = {};
  // El codo sube/baja es el MISMO codo 90° — la distinción solo dice cómo se instala (apunta
  // hacia arriba o hacia abajo), no cambia la pieza. En AF/AC/LL todo codo de 90° (rc/rm/rl y
  // sube/baja, a mitad de ramal o en un extremo) se resume en la columna "Codo medio 90°"; en
  // san se generaliza a "Codo 90°".
  const codoTarget = (id: string): string => {
    if (net !== 'san' && CODO_90_IDS.has(id)) return 'codoMedio90';
    if (id === 'codo90rmSube' || id === 'codo90rmBaja') return 'codo90rm';
    // Gas: sube/baja suman en su tipo base (estándar o radio largo) — misma pieza, otra
    // orientación de instalación.
    if (id === 'codos_90_std_sube' || id === 'codos_90_std_baja') return 'codos_90_std';
    if (id === 'codos_90_rl_sube' || id === 'codos_90_rl_baja') return 'codos_90_rl';
    return id;
  };
  const addAcc = (diam: string, accId: string, count: number) => {
    const targetId = codoTarget(accId);
    // ponytail: skip ids not in the summary catalog (e.g. sifón) — avoid NaN on undefined column
    if (!summaryCatalog.some((a) => a.id === targetId)) return;
    if (!totals[diam]) {
      totals[diam] = {};
      for (const a of summaryCatalog) totals[diam][a.id] = 0;
    }
    totals[diam][targetId] += count;
  };

  // Codons de mitad de ramal (accMed) por tramo — se cuentan desde los marcadores del dibujo en
  // la columna "Codo medio 90°" (abajo) y esa misma porción se resta de lo que calcHydroAccessories
  // arrastró a hidroData con el id de catálogo del codo elegido, para no contarla dos veces. El
  // codo de 45° (codo45rc) va en su propia fila de catálogo, con el mismo patrón de dedupe.
  const accMedCodoCounts: Record<string, Record<string, number>> = {};
  const accMed45Counts: Record<string, Record<string, number>> = {};
  const countAccMedCodos = (r: { id: string; planId: string; accMed?: Record<string, string> }) => {
    if (!r.accMed) return;
    const key = String(r.id) + '-' + String(r.planId);
    const m = (accMedCodoCounts[key] = accMedCodoCounts[key] || {});
    const m45 = (accMed45Counts[key] = accMed45Counts[key] || {});
    for (const accId of Object.values(r.accMed)) {
      if (ACC_MED_CODOS.has(accId)) m[accId] = (m[accId] || 0) + 1;
      else if (accId === 'codo45rc') m45['codo45rc'] = (m45['codo45rc'] || 0) + 1;
    }
  };
  for (const r of drawingRamales) countAccMedCodos(r);
  for (const r of tribDrawing) countAccMedCodos(r);

  // En AF/AC el diámetro puede vivir como número (diamDisPulg/diamPulg) aunque el string
  // `diametro` venga vacío o con especificación extra — se prefiere el string parseado y se cae
  // al valor numérico para que la columna de diámetro no quede en "—".
  const pulgOf = (d: string | undefined, num?: number): number =>
    diamPulgFromLabel(d || '') || num || 0;

  // Mapa id→pulgadas de los tramos, para respaldar el diámetro de ramales del dibujo cuyo
  // string `diametro` venga vacío (AF/AC guardan el número en diamDisPulg/diamPulg).
  const pulgById: Record<string, number> = {};
  for (const t of tramos) {
    if (t.esBajante) continue;
    const p = pulgOf(t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg);
    pulgById[t.id] = p;
    pulgById[`${t.id}-${t.planId}`] = p;
  }

  // Extremos con aparato por tramo (del dibujo): el símbolo de aparato (inodoro, lavamanos...)
  // representa la conexión física — cada uno lleva un codo 90 del diámetro del extremo. Los
  // accesorios del extremo viajan junto al aparato para el dedupe (sifón ya produce un 90).
  const extremoSan = new Map<
    string,
    { apIni?: string; apFin?: string; accIni?: string; accFin?: string }
  >();
  for (const r of [...drawingRamales, ...tribDrawing]) {
    extremoSan.set(`${r.id}-${r.planId}`, {
      apIni: r.aparatoInicio || undefined,
      apFin: r.aparatoFin || undefined,
      accIni: r.accesorioInicio || undefined,
      accFin: r.accesorioFin || undefined,
    });
  }

  tramos.forEach((t) => {
    if (t.esBajante) return;
    const mainDiamStr = fmtPulg(
      pulgOf(t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
    );
    if (t.tipo === 'tributario') {
      const accIni = t.accesorioInicio;
      if (accIni) {
        const dStr = fmtPulg(
          pulgOf(t.diametroInicio || t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
        );
        const accId =
          accIni === 'codoSube'
            ? 'codo90rmSube'
            : accIni === 'codoBaja'
              ? 'codo90rmBaja'
              : net === 'san' && accIni === 'codo45'
                ? 'codo45rc'
                : accIni;
        if (accId !== 'sifon') addAcc(dStr, accId, 1);
      }
      const accFin = t.accesorioFin;
      if (accFin) {
        const dStr = fmtPulg(
          pulgOf(t.diametroFin || t.diametro || t.diametroOriginal, t.diamDisPulg || t.diamPulg),
        );
        const accId =
          accFin === 'codoSube'
            ? 'codo90rmSube'
            : accFin === 'codoBaja'
              ? 'codo90rmBaja'
              : net === 'san' && accFin === 'codo45'
                ? 'codo45rc'
                : accFin;
        // ponytail: sifón no entra al resumen de accesorios (es un aparato)
        if (accId !== 'sifon') addAcc(dStr, accId, 1);
      }
      // Accesorios implícitos que ya cuenta hidroData para el tributario — codo 90° sube junto a
      // un aparato en AF/AC, codo de bajante en LL, accMed, codoReventilado san autodetectado —
      // se suman con dedupe contra lo ya contado de accesorioInicio/Fin (replicando el alias
      // teeLado de calcHydroAccessories para que la resta no quede corta).
      const key = `${net}_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const direct: Record<string, number> = {};
      const teeLadoAlias = new Set(['teeTapon', 'teeLlaveTerminal', 'teeSube', 'teeBaja']);
      const directAccId = (acc: string) =>
        acc === 'codoSube'
          ? 'codo90rmSube'
          : acc === 'codoBaja'
            ? 'codo90rmBaja'
            : // Codo de plano 45° en extremo (p. ej. esquina L tras desarmar una yee doble):
              // misma pieza que codo45rc, nomenclatura del catálogo.
              net === 'san' && acc === 'codo45'
              ? 'codo45rc'
              : acc;
      for (const acc of [t.accesorioInicio, t.accesorioFin]) {
        if (!acc) continue;
        const id = directAccId(acc);
        direct[id] = (direct[id] || 0) + 1;
        if (teeLadoAlias.has(id)) direct['teeLado'] = (direct['teeLado'] || 0) + 1;
      }
      const codoMed = accMedCodoCounts[String(t._key || `${t.id}-${t.planId}`)] || {};
      const codo45Med = accMed45Counts[String(t._key || `${t.id}-${t.planId}`)] || {};
      // El motor es dueño del conteo de yees cuando YA recalculó este tramo (claves yee
      // presentes): uniones ENTRE tributarios se registran bajo el id del tributario host y
      // DEBEN mostrarse en su fila — antes el skip incondicional las hacía desaparecer del
      // resumen (orig. usuario: contaba 2 de 3).
      const engineYeeKnown = 'yeeSimple' in srcAcc || 'yeeDoble' in srcAcc;
      for (const a of catalog) {
        if ((net === 'af' || net === 'ac' || net === 'gas') && HYDRO_TEE_IDS.has(a.id)) continue;
        if (a.id === 'yeeSimple' || a.id === 'yeeDoble') {
          if (engineYeeKnown) {
            const n = srcAcc[a.id] || 0;
            if (n > 0) addAcc(mainDiamStr, a.id, n);
          }
          continue;
        }
        const extra = Math.max(
          0,
          (srcAcc[a.id] || 0) - (direct[a.id] || 0) - (codoMed[a.id] || 0) - (codo45Med[a.id] || 0),
        );
        if (extra > 0) addAcc(mainDiamStr, a.id, extra);
      }
    } else {
      const key = `${net}_${t.id}_${t.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      // El motor es dueño del conteo de yees cuando YA recalculó este host (alguna clave yee
      // presente — las claves a 0 las elimina el recuento dueño). Sin recalculo previo se usa
      // el camino geométrico legado.
      const engineYeeKnown = 'yeeSimple' in srcAcc || 'yeeDoble' in srcAcc;
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey] || { simple: [], doble: [] };
      const ventC = ventCodoCombos[tKey] || [];
      const codoMed = accMedCodoCounts[tKey] || {};
      const codo45Med = accMed45Counts[tKey] || {};
      // ponytail: direct accesorioInicio/Fin fallback — sifón/codos count even if hidroData is stale
      const directCount: Record<string, number> = {};
      const directAccId = (acc: string) =>
        acc === 'codoSube'
          ? 'codo90rmSube'
          : acc === 'codoBaja'
            ? 'codo90rmBaja'
            : net === 'san' && acc === 'codo45'
              ? 'codo45rc'
              : acc;
      for (const acc of [t.accesorioInicio, t.accesorioFin]) {
        if (!acc) continue;
        const id = directAccId(acc);
        directCount[id] = (directCount[id] || 0) + 1;
      }
      for (const a of catalog) {
        const fromSrc = Math.max(
          0,
          (srcAcc[a.id] || 0) - (codoMed[a.id] || 0) - (codo45Med[a.id] || 0),
        );
        const v = Math.max(fromSrc, directCount[a.id] || 0);
        if (a.id === 'yeeSimple') {
          // Conteo = VERDAD del motor (srcAcc es dueño y se recalcula del dibujo con el mismo
          // host canónico): la cercanía entre uniones ya no inventa dobles ni pierde simples
          // respecto a los glifos dibujados (orig. usuario: 3 simples contadas 2). Cuando el
          // motor NO ha recalculado (sin entrada de hidro para el host) se conserva el
          // comportamiento geométrico legado. Nomenclatura: brazos compactados.
          const nSimple = engineYeeKnown ? srcAcc['yeeSimple'] || 0 : -1;
          if (!engineYeeKnown) {
            const hasDoble = yd.doble.length > 0 || (srcAcc['yeeDoble'] || 0) > 0;
            if (!hasDoble) {
              if (yd.simple.length > 0)
                yd.simple.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
              else if (v > 0) {
                const combo = compactYeeDiam([mainDiamStr, mainDiamStr, mainDiamStr]);
                if (combo) addAcc(combo, a.id, v);
              }
            }
          } else if (yd.simple.length > 0 && yd.simple.length === nSimple) {
            yd.simple.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          } else if (nSimple > 0) {
            const combo = compactYeeDiam([mainDiamStr, mainDiamStr, mainDiamStr]);
            if (combo) addAcc(combo, a.id, nSimple);
          }
        } else if (a.id === 'yeeDoble') {
          // Ídem: el conteo doble lo manda el motor (emparejamiento con alineación de tronco);
          // yd.doble solo rotula cuando coincide, y sin motor se conserva el legado.
          const nDoble = engineYeeKnown ? srcAcc['yeeDoble'] || 0 : -1;
          if (!engineYeeKnown) {
            if (yd.doble.length > 0) yd.doble.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
            else if (v > 0) {
              const combo = compactYeeDiam([mainDiamStr, mainDiamStr, mainDiamStr, mainDiamStr]);
              if (combo) addAcc(combo, a.id, v);
            }
          } else if (yd.doble.length > 0 && yd.doble.length === nDoble) {
            yd.doble.forEach((diamCombo) => addAcc(diamCombo, a.id, 1));
          } else if (nDoble > 0) {
            const combo = compactYeeDiam([mainDiamStr, mainDiamStr, mainDiamStr, mainDiamStr]);
            if (combo) addAcc(combo, a.id, nDoble);
          }
        } else if (a.id === 'codoReventilado') {
          // Item 7: un codo reventilado que une san con vent muestra el diámetro de ambos
          // ramales (san×vent), no solo el del ramal sanitario.
          if (ventC.length > 0) ventC.forEach((combo) => addAcc(combo, a.id, v));
          else if (v > 0) addAcc(mainDiamStr, a.id, v);
        } else if (v > 0) {
          // Las tees hidro (AF/AC/gas) se cuentan SOLO desde los marcadores del dibujo
          // (bloque más abajo) para darles la nomenclatura de tres brazos sin duplicarlas.
          if ((net === 'af' || net === 'ac' || net === 'gas') && HYDRO_TEE_IDS.has(a.id)) continue;
          addAcc(mainDiamStr, a.id, v);
        }
      }
    }

    // Codo 90 del EXTREMO con aparato o codo reventilado manual (san, orig. usuario): el
    // símbolo de aparato conecta con 1 codo 90 del diámetro de ESE extremo, y el codo
    // reventilado que reemplaza al 90 NO lo suprime — el 90 se sigue contando. Solo un
    // extremo que ya produce un 90 propio (sifón → +1 sube, codoSube/codoBaja) no suma otro.
    // El reventilado AUTOdetectado (unión vent⊥san, sin accesorio en el extremo) no suma 90:
    // es pieza de unión, no un 90 reemplazado.
    if (net === 'san') {
      const ex = extremoSan.get(`${t.id}-${t.planId}`);
      if (ex) {
        const pares: Array<{ ap?: string; acc?: string; d: number }> = [
          {
            ap: ex.apIni,
            acc: ex.accIni,
            d: pulgOf(
              t.diametroInicio || t.diametro || t.diametroOriginal,
              t.diamDisPulg || t.diamPulg,
            ),
          },
          {
            ap: ex.apFin,
            acc: ex.accFin,
            d: pulgOf(
              t.diametroFin || t.diametro || t.diametroOriginal,
              t.diamDisPulg || t.diamPulg,
            ),
          },
        ];
        for (const p of pares) {
          if (!p.ap && p.acc !== 'codoReventilado') continue;
          if (
            ['sifon', 'codoSube', 'codo90rmSube', 'codoBaja', 'codo90rmBaja'].includes(p.acc || '')
          )
            continue;
          const dStr = fmtPulg(p.d);
          if (dStr && dStr !== '—') addAcc(dStr, 'codo90rm', 1);
        }
      }
    }
  });

  // 14. Bajante — ramal accessories (any net, not only sanitary)
  // simple (codo 90° del bajante + Y simple) / double (2×codo45 + Y doble) + bushing per spec
  return { totals, pulgById, accMedCodoCounts, accMed45Counts, addAcc, countAccMedCodos };
}
