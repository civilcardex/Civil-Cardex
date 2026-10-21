import { sumaCnt, type Cnt, type Ctx } from './counting.ts';

/**
 * Fase 5: DFS topológico con corte de ciclo - un ramal en pila (ciclo) aporta solo su base.
 * Calcula el total que transporta cada tramo (base + heredado) y el heredado de cada uno.
 */
export function calcularTotales(ctx: Ctx): void {
  const {
    ramales,
    manualCrudoDe,
    foldDe,
    manualDe,
    bajadasDown,
    upMonte,
    aristasPorDestino,
    transferencias,
    downTrib,
    porKey,
  } = ctx;
  // 5) DFS topológico con corte de ciclo: un ramal en pila (ciclo) aporta solo su base.
  //    Las aristas 'carga' aportan el total; las 'base', solo la base (sin inflación).
  //    Doctrina mostrador (orig. usuario: lo propagado por tributarios cuenta en propia):
  //    la parte que llega por arista DESDE un tributario se registra en el libro TRIB
  //    (plegado, visible como propia), no en el HER (heredada) — el tributario es parte del
  //    subsistema del tramo, no un aguas-arriba ajeno. Lo heredado-ajeno que el trib a su
  //    vez transporta sí va al HER (honesto: no nació ahí).
  const totalDe = new Map<string, Cnt>(); // carga que transporta (base + heredado)
  const heredadoDe = new Map<string, Cnt>();
  const tribFoldDe = new Map<string, Cnt>(); // own trib por arista directa (libro TRIB)
  const estado = new Map<string, 0 | 1 | 2>(); // 0 nuevo · 1 en pila · 2 resuelto
  const baseDe = (key: string): Cnt =>
    sumaCnt(sumaCnt(manualDe.get(key) || {}, foldDe.get(key) || {}), tribFoldDe.get(key) || {});
  // Lo propio-real de una fuente trib (sin lo heredado-ajeno que transporta): crudo más
  // lo trib-recibido. NO manualDe: el down-trib absorbe el fold invertido en su manual y
  // hay que pelarlo (si no, duplica corrida a corrida lo del padre); lo trib-recibido
  // (tina de T5 en T1) sí viaja porque el receptor lo muestra como propio.
  const ownTribDe = (key: string): Cnt =>
    sumaCnt(
      sumaCnt(manualCrudoDe.get(key) || {}, foldDe.get(key) || {}),
      tribFoldDe.get(key) || {},
    );
  const calcDe = (key: string): Cnt => {
    const r = porKey.get(key);
    if (!r) return {};
    const st = estado.get(r.key) ?? 0;
    if (st === 2) return totalDe.get(r.key) || {};
    if (st === 1) return bajadasDown.has(r.key) ? manualDe.get(r.key) || {} : baseDe(r.key); // ciclo
    estado.set(r.key, 1);
    let h: Cnt = { ...(upMonte.get(r.key) || {}) };
    let hTrib: Cnt = {};
    for (const a of aristasPorDestino.get(r.key) || []) {
      const fromTrib = (porKey.get(a.from)?.tipo || '') === 'tributario';
      if (!fromTrib) {
        h = a.tipo === 'carga' ? sumaCnt(h, calcDe(a.from)) : sumaCnt(h, baseDe(a.from));
        continue;
      }
      // calcDe primero: puebla heredadoDe/tribFoldDe del trib (orden-independiente;
      // en ciclo el corte aporta solo su base, misma semántica que ramales).
      calcDe(a.from);
      h = sumaCnt(h, heredadoDe.get(a.from) || {});
      hTrib = sumaCnt(hTrib, ownTribDe(a.from));
    }
    // Consumidas transferidas a esta bajada (orig. usuario RAC4/RAC3): su base cuenta como
    // heredado del receptor — ellas CONSERVAN lo propio en su clave (asignar en RAC4 se ve
    // en su panel) y el panel/Σ las descuentan vía el libro `her`. El down-trib ya la trae
    // por su fold invertido (foldN): sumarla aquí también la duplicaría (tina ×2).
    if (!downTrib.has(r.key)) {
      for (const [consumida, receptor] of transferencias) {
        if (receptor === r.key) h = sumaCnt(h, baseDe(consumida));
      }
    }
    // Down-trib: el fold invertido ya vive DENTRO de su manual — la base es solo manual
    // (contar el foldDe también duplicaba la transferencia en cada corrida).
    const base = bajadasDown.has(r.key) ? manualDe.get(r.key) || {} : baseDe(r.key);
    estado.set(r.key, 2);
    heredadoDe.set(r.key, h);
    tribFoldDe.set(r.key, hTrib);
    const tot = sumaCnt(sumaCnt(base, h), hTrib);
    totalDe.set(r.key, tot);
    return tot;
  };
  for (const r of ramales) calcDe(r.key);

  ctx.totalDe = totalDe;
  ctx.heredadoDe = heredadoDe;
  ctx.tribFoldDe = tribFoldDe;
}
