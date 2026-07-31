// Supabase Edge Function (Deno) — verificación hidráulica de tramos.
//
// Puerto verbatim de las fórmulas puras y ya probadas en
// src/modules/civilflow/utils/calcSanitaryCore.ts (mismo archivo tiene
// tests en __tests__/calcSanitaryCore.test.ts). Se centraliza aquí para
// que la UI (TramosContext) y la generación de memoria/PDF
// (exportMemoriaFinal) llamen la MISMA lógica en vez de duplicarla, y
// para no recalcular en cada render del canvas.
//
// Deploy: supabase functions deploy hydraulic-check
// Invocar desde el cliente: supabase.functions.invoke('hydraulic-check', { body: { tramos: [...] } })

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// ─────────────────────────────────────────────────────────────────────
// Fórmulas puras (idénticas a calcSanitaryCore.ts) — no reinterpretar,
// mantener sincronizadas manualmente si el archivo fuente cambia.
// ─────────────────────────────────────────────────────────────────────
const GRAVEDAD = 9.80665;

function factorSimultaneidad(numSalidas: number): number {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

function caudalHunterLPS(UD: number, K: number): number {
  if (UD < 240) return K * 0.1163 * Math.pow(UD, 0.6875);
  return K * 0.074 * Math.pow(UD, 0.7504);
}

function caudalTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const A = (Math.PI * D_m * D_m) / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

function velocidadTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

function relacionesHidraulicas(q_Qo: number) {
  let v_V0: number, h_D: number;
  const r = Math.min(Math.max(q_Qo, 0.01), 0.999);

  if (r <= 0.06) {
    v_V0 = Math.pow(10, 0.029806 + 0.29095 * Math.log10(r));
  } else if (r <= 0.26) {
    v_V0 = Math.pow(10, 0.013778 + 0.28597 * Math.log10(r));
  } else {
    v_V0 = Math.pow(10, 0.021763 + 0.289951 * Math.log10(r));
  }

  if (r < 0.11) {
    h_D = 0.3827 + 0.0645 * Math.log(r);
  } else if (r < 0.21) {
    h_D = 0.60025 + 0.15471 * Math.log(r);
  } else {
    h_D = 0.225 + 0.667 * r;
  }
  h_D = Math.min(Math.max(h_D, 0.01), 0.98);

  const alpha = 2 * Math.acos(1 - 2 * h_D);
  const Rh_D = (1 / 4) * (1 - Math.sin(alpha) / alpha);

  return { q_Qo: r, v_V0, h_D, alpha, Rh_D };
}

function numeroFroude(V: number, DH: number): number {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

function fuerzaTractiva(Rh: number, S: number): number {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

function tipoRegimen(Fr: number): string {
  if (Fr < 0.9) return 'Subcrítico';
  if (Fr <= 1.1) return 'Crítico';
  return 'Supercrítico';
}

function diametroManning(Q_m3s: number, n: number, S: number): number {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}

// ─────────────────────────────────────────────────────────────────────
// Verificación por tramo
// ─────────────────────────────────────────────────────────────────────
interface TramoInput {
  id: string;
  ud: number; // unidades de descarga acumuladas
  nSalidas: number; // número de salidas (para factor de simultaneidad)
  diametroInternoM: number; // diámetro interno del tubo instalado (m)
  pendiente: number; // pendiente (m/m)
  manningN?: number; // default 0.009 (PVC sanitario)
}

interface TramoResult {
  id: string;
  qDiseñoLps: number;
  qTuboLlenoLps: number;
  qQ0: number;
  vReal: number;
  yD: number;
  froude: number;
  regimen: string;
  fuerzaTractivaKgM2: number;
  diametroCalculadoPulg: number;
  velCumple: boolean;
  presionOk: boolean;
}

function verificarTramo(t: TramoInput): TramoResult {
  const n = t.manningN ?? 0.009;
  const K = factorSimultaneidad(t.nSalidas);
  const qDisenoLps = caudalHunterLPS(t.ud, K);
  const qDisenoM3s = qDisenoLps / 1000;

  const qLlenoM3s = caudalTuboLleno(t.diametroInternoM, n, t.pendiente);
  const vLleno = velocidadTuboLleno(t.diametroInternoM, n, t.pendiente);
  const qQ0 = qLlenoM3s > 0 ? qDisenoM3s / qLlenoM3s : 0;

  const rel = relacionesHidraulicas(qQ0);
  const vReal = vLleno * rel.v_V0;
  const dh = rel.Rh_D * t.diametroInternoM;
  const fr = numeroFroude(vReal, dh);
  const ft = fuerzaTractiva(rel.Rh_D * t.diametroInternoM, t.pendiente);

  const diametroCalcM = diametroManning(qDisenoM3s, n, t.pendiente);
  const diametroCalcPulg = Math.round(((diametroCalcM * 1000) / 25.4) * 100) / 100;

  return {
    id: t.id,
    qDiseñoLps: qDisenoLps,
    qTuboLlenoLps: qLlenoM3s * 1000,
    qQ0: rel.q_Qo,
    vReal,
    yD: rel.h_D,
    froude: fr,
    regimen: tipoRegimen(fr),
    fuerzaTractivaKgM2: ft,
    diametroCalculadoPulg: diametroCalcPulg,
    velCumple: vReal >= 0.6 && vReal <= 5,
    presionOk: diametroCalcM <= t.diametroInternoM,
  };
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const tramos: TramoInput[] = Array.isArray(body?.tramos) ? body.tramos : [];
    const resultados = tramos.map(verificarTramo);
    return new Response(JSON.stringify({ resultados }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request', detail: String(e) }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
