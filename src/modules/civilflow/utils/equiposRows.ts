import type { MemoriaTable } from './exportMemoriaFinal';
import { loadFromStorage } from '../services/storageService';
import { dec } from './parseDecimal';
import type { EPData } from '../context/EPContext';
import { PVC_SCH40, NEMA_HP, selectDN } from '../components/ep/calculations';
import { AGUA_DENSIDAD, GRAVEDAD } from './calcSanitaryCore';

// Mirrors the object BombaARDesign.tsx persists via saveToStorage('civilflow_memoria_bomba_data').
interface BombaMemoriaData {
  inputs: {
    salSim: string; udTot: string; hz: string; lImp: string; dImp: string; cHW: string; pDesc: string;
    etaB: string; fSrv: string; tCic: string; hMin: string; hMax: string; bCam: string; lCam: string;
    npsh: string; sal: number; ud: number;
  };
  outputs: {
    K: number; Qd: number; Qb: number; Vi: number; Hf: number; Hac: number; Hfri: number; Hest: number;
    Hm: number; Vch: string; Ph: number; Peje: number; Pcom: number; php: number; Sel: string;
    Vcam: number; Vchk: string;
  };
}

const or = (v: string | number | undefined | null): string => (v === '' || v == null ? '—' : String(v));
const f2 = (n: number): string => Number.isFinite(n) ? n.toFixed(2) : '—';

// Bomba AR (BombaARDesign.tsx) has 4 screen pages, each with its own table(s) — replicated 1:1
// here from the inputs/outputs it already persists, rather than a single flattened summary, so the
// memoria carries the same detail the live screens show.
export function computeBombaTables(): MemoriaTable[] {
  const data = loadFromStorage<BombaMemoriaData | null>('civilflow_memoria_bomba_data', null);
  if (!data) return [];
  const { inputs: i, outputs: o } = data;
  const di = dec(i.dImp), pd = dec(i.pDesc);
  const bc = dec(i.bCam), lc = dec(i.lCam), hmn = dec(i.hMin), hmx = dec(i.hMax);
  const Vgeo = bc > 0 && lc > 0 && (hmx - hmn) > 0 ? bc * lc * (hmx - hmn) : 0;

  const COLS1 = ['Parámetro', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Fuente / norma'];
  const COLS2 = ['Componente', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Observación'];

  const datosEntrada: MemoriaTable = {
    title: 'Bomba AR — datos de entrada',
    headers: COLS1,
    rows: [
      ['Número de salidas simultáneas', 'Sal sim', or(i.salSim), 'und', '—', 'Probabilidad de trabajar al máximo'],
      ['UD acumuladas en sótano', 'UD tot', or(i.udTot), 'UD', '—', 'NTC 1500'],
      ['Coeficiente K simultaneidad Hunter', 'K', f2(o.K), '—', '—', 'K = 1/√(n−1)'],
      ['Caudal de diseño Q = UD × K', 'Q dis', f2(o.Qd), 'lps', `${f2(o.Qd * 15.8503)} GPM`, 'Método Hunter NTC 1500'],
      ['Caudal bombeo Qb (reserva 25%)', 'Q b', f2(o.Qb), 'lps', `${f2(o.Qb * 15.8503)} GPM`, 'Factor seguridad sobre Q diseño'],
      ['Altura geométrica sótano → piso 1', 'Hz', or(i.hz), 'm', '—', 'Diferencia de nivel'],
      ['Longitud total tubería impulsión', 'L imp', or(i.lImp), 'm', '—', 'Tramos verticales + horizontales'],
      ['Diámetro tubería impulsión', 'D imp', or(i.dImp), 'pulg', di ? `${f2(di * 25)} mm` : '—', 'Mínimo 2" NTC 1500 §8'],
      ['Coeficiente C Hazen-Williams (PVC)', 'C HW', or(i.cHW), '—', '—', 'RAS 2000 §B.6.4.2 — PVC liso nuevo'],
      ['Presión mínima en descarga', 'P desc', or(i.pDesc), 'm.c.a.', pd ? `${f2(pd * 1.42)} psi` : '—', 'Presión en punto entrega piso 1'],
      ['Eficiencia bomba η', 'eta b', or(i.etaB), '—', '—', 'Bomba sumergible trituradora típica: 60–70%'],
      ['Factor de servicio motor', 'f srv', or(i.fSrv), '—', '—', 'NEMA MG1: reserva 25% sobre P calculada'],
    ],
  };

  const perdidasCarga: MemoriaTable = {
    title: 'Bomba AR — cálculo de pérdidas de carga',
    headers: COLS2,
    rows: [
      ['Velocidad en tubería impulsión', 'V imp', f2(o.Vi), 'm/s', '—', '0.6 < V < 3.5 m/s para residuales'],
      ['Pérdida fricción (Hazen-Williams)', 'Hf', f2(o.Hf), 'm.c.a.', '—', 'hf = 10.67·L·Q^1.852 / (C^1.852·D^4.87)'],
      ['Pérdida en accesorios (25% de Hf)', 'H ac', f2(o.Hac), 'm.c.a.', '—', 'Estimación conservadora'],
      ['Pérdida total por fricción', 'H fri', f2(o.Hfri), 'm.c.a.', '—', 'Hf tubería + accesorios'],
      ['Altura estática total', 'H est', f2(o.Hest), 'm.c.a.', '—', 'Hz geométrica + presión mínima descarga'],
      ['Altura manométrica total Hm', 'H m', f2(o.Hm), 'm.c.a.', o.Hm ? `${f2(o.Hm * 1.42)} psi` : '—', 'Hm = H fri + H est'],
      ['Chequeo velocidad', 'V chk', or(o.Vch), '—', '—', 'Verificación automática'],
    ],
  };

  const bombaParams: MemoriaTable = {
    title: 'Bomba AR — parámetros de diseño bomba sumergible',
    headers: COLS1,
    rows: [
      ['Caudal nominal bomba', 'Q b', f2(o.Qb), 'lps', `${f2(o.Qb * 15.8503)} GPM`, 'Incluye reserva 25%'],
      ['Altura manométrica Hm', 'H m', f2(o.Hm), 'm.c.a.', o.Hm ? `${f2(o.Hm * 1.42)} psi` : '—', 'Tomado de bloque 2'],
      ['Potencia hidráulica', 'P hid', f2(o.Ph), 'W', o.Ph ? `${f2(o.Ph / 746)} HP` : '—', 'Ph = ρ·g·Q·Hm / 1000'],
      ['Potencia en el eje', 'P eje', f2(o.Peje), 'W', o.Peje ? `${f2(o.Peje / 746)} HP` : '—', 'P eje = Ph / η bomba'],
      ['Potencia comercial (×f srv)', 'P com', f2(o.Pcom), 'W', o.Pcom ? `${f2(o.php)} HP` : '—', 'Motor seleccionar ≥ este valor'],
      ['Selección comercial automática', 'Sel', or(o.Sel), 'HP', '—', 'Estándar: 0.5 / 1 / 2 / 3 / 5 HP'],
      ['Tipo de bomba', 'Tipo', 'Sumergible trituradora', '—', '—', 'NTC 1500 §8.5 — residuales con sólidos'],
      ['NPSH disponible mínimo', 'NPSH', or(i.npsh), 'm', '—', 'Verificar con curva del fabricante'],
    ],
  };

  const bombaSpec: MemoriaTable = {
    title: 'Bomba AR — especificación bomba sumergible trituradora',
    headers: ['Ítem', 'Valor'],
    rows: [
      ['Caudal nominal', `${f2(o.Qb * 15.8503)} GPM`],
      ['Altura manométrica total (Hm)', `${f2(o.Hm)} m.c.a.`],
      ['Potencia motor', or(o.Sel)],
      ['Tipo', 'Bomba sumergible trituradora, impeler monocanal'],
      ['Tensión', '110V o 220V monofásica — confirmar con proveedor'],
    ],
  };

  const camaraParams: MemoriaTable = {
    title: 'Bomba AR — parámetros de diseño cámara de bombeo',
    headers: COLS1,
    rows: [
      ['Tiempo mínimo ciclo arranque', 't cic', or(i.tCic), 'min', '—', 'Mínimo 5 min entre arranques'],
      ['Volumen útil cámara mínimo', 'V cam', f2(o.Vcam), 'lts', o.Vcam ? `${f2(o.Vcam / 1000)} m³` : '—', 'V = Qb(lps) × t(s)'],
      ['Tirante mínimo sobre bomba', 'h min', or(i.hMin), 'm', '—', 'Evita cavitación'],
      ['Tirante máximo antes de arrancar', 'h max', or(i.hMax), 'm', '—', 'Nivel activación flotador'],
      ['Ancho mínimo cámara', 'b cam', or(i.bCam), 'm', '—', 'NTC 1500 §8.5 — mínimo 60 cm'],
      ['Largo mínimo cámara', 'l cam', or(i.lCam), 'm', '—', 'Verificar con dimensiones bomba'],
      ['Volumen geométrico disponible', 'V geo', Vgeo > 0 ? f2(Vgeo) : '—', 'm³', Vgeo > 0 ? `${f2(Vgeo * 1000)} lts` : '—', 'b×l×(h max−h min)'],
      ['Chequeo volumen', 'V chk', or(o.Vchk) || '—', '—', '—', 'V geo ≥ V cam requerido'],
    ],
  };

  const camaraSpec: MemoriaTable = {
    title: 'Bomba AR — especificación cámara de bombeo',
    headers: ['Ítem', 'Valor'],
    rows: [
      ['Volumen útil requerido', `${f2(o.Vcam)} lts`],
      ['Dimensiones mínimas (m)', bc > 0 && lc > 0 && (hmx - hmn) > 0 ? `${i.bCam} x ${i.lCam} x ${f2(hmx - hmn)}` : '—'],
      ['Material', 'Concreto impermeabilizado o polietileno PEAD'],
      ['Accesorios obligatorios', 'Rejilla aguas arriba + ventilación Ø2" + alarma nivel alto'],
    ],
  };

  return [datosEntrada, perdidasCarga, bombaParams, bombaSpec, camaraParams, camaraSpec];
}

// Equipo de presión (PressureEquipmentDesign.tsx → EPInputPage.tsx + EPVerificationPage.tsx, 3
// screen pages) — same idea as Bomba AR above: every card/table on every page, replicated from the
// same raw `ep` fields and formulas the live screens compute, instead of one flattened summary.
export function computeEpTables(): MemoriaTable[] {
  const ep = loadFromStorage<EPData | null>('ep', null);
  if (!ep) return [];

  const qac = dec(ep.qac), qasc = dec(ep.qasc);
  const hfac = dec(ep.hfac), hfacs = dec(ep.hfacs), hfotros = dec(ep.hfotros);
  const pred = dec(ep.pred), pmin = dec(ep.pmin), pmax = dec(ep.pmax);
  const zbomba = dec(ep.zbomba), ztop = dec(ep.ztop), zcis = dec(ep.zcis), hfcis = dec(ep.hfcis);
  const nt = dec(ep.nt) || 1, nr = dec(ep.nr);
  const etab = dec(ep.etab) || 0.65, etam = dec(ep.etam) || 0.85;
  const fs = dec(ep.fs) || 1.15, ciclos = dec(ep.ciclos) || 6;
  const alfa = dec(ep.alfa) || 0.30;
  const vsuc = dec(ep.vsuc) || 1.5, vimp = dec(ep.vimp) || 2.0;
  const isRed = ep.modo === 'red';
  const ntot = nt + nr;

  const Qd = Math.max(qac, qasc);
  const Qm3h = Qd * 3.6;
  const Qgpm = Qd * 15.85;
  const Qb = nt > 0 ? Qd / nt : Qd;

  const Hg = isRed ? (ztop - zbomba) : (ztop - zcis);
  const HfCrit = Math.max(hfac, hfacs);
  const Hf = isRed ? (HfCrit + hfotros) : (HfCrit + hfotros + hfcis);
  const HMT = isRed ? (Hg + Hf + pmin - pred) : (Hg + Hf + pmin);

  const Phid = AGUA_DENSIDAD * GRAVEDAD * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const Pfreno_w = (etab * etam) > 0 ? Phid / (etab * etam) : 0;
  const Pfreno_hp = Pfreno_w / 745.7;
  const Pins_hp = Pfreno_hp * fs;
  const Pins_kw = (Pfreno_hp * 745.7 * fs) / 1000;

  const ramalCol = (qLps: number, vDiseno: number) => {
    const Qm3s = qLps / 1000;
    const diamCalcM = Math.sqrt((4 * Qm3s) / (Math.PI * vDiseno));
    const diamCalcMm = diamCalcM * 1000;
    const entry = selectDN(qLps, vDiseno);
    return { diamCalcMm, dn: entry.dn, vReal: entry.Vreal };
  };
  const rSucColector = ramalCol(Qd, vsuc);
  const rImpColector = ramalCol(Qd, vimp);
  const rSucBomba = ramalCol(Qb, vsuc);
  const rImpBomba = ramalCol(Qb, vimp);

  const fmtMm = (v: number) => v > 0 ? v.toFixed(1) : '—';
  const fmtMs = (v: number) => v > 0 ? v.toFixed(2) : '—';
  const fmtHp = (v: number) => v > 0 ? v.toFixed(3) : '—';
  const fmtBar = (v: number) => v !== 0 ? v.toFixed(2) : '—';
  const fmtLps = (v: number) => v > 0 ? v.toFixed(3) : '—';
  const fmtM3h = (v: number) => v > 0 ? v.toFixed(2) : '—';
  const fmtGpm = (v: number) => v > 0 ? v.toFixed(1) : '—';
  const fmtMca = (v: number) => v !== 0 ? v.toFixed(2) : '—';
  const fmtL = (v: number) => v > 0 ? v.toFixed(1) : '—';
  const fmtW = (v: number) => v > 0 ? v.toFixed(0) : '—';

  let autoNema = NEMA_HP[NEMA_HP.length - 1];
  for (const h of NEMA_HP) { if (h >= Pins_hp) { autoNema = h; break; } }
  const customHp = dec(ep.pcomercial);
  const nemaSel = customHp > 0 ? customHp : autoNema;
  const margenPct = Pins_hp > 0 ? ((nemaSel - Pins_hp) / Pins_hp) * 100 : 0;
  const pComercialOk = nemaSel >= Pins_hp;

  const Pon = HMT;
  const Poff = Pon * 1.10;
  const PN2 = Pon * 0.90;
  const Pon_bar = Pon / 10.2;
  const Poff_bar = Poff / 10.2;
  const PN2_bar = PN2 / 10.2;
  const Vu = ciclos > 0 ? (Qd * 60) / (4 * ciclos) : 0;
  const Vt = alfa > 0 ? Vu / alfa : 0;

  const hmtOk = HMT > 0 && HMT < pmax;
  const alertaPmax = HMT > pmax && pmax > 0;
  const hgOk = Hg > 0;
  const hfOk = Hf >= 0;
  const pminOk = pmin > 0;
  const predOk = pred > 0;

  const resolveDiam = (userDN: number, v: number) => {
    if (userDN > 0) {
      const entry = PVC_SCH40.find(t => t.dn === userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? (Qd / 1000) / A : 0 };
      }
    }
    return selectDN(Qd, v);
  };
  const sucDiam = resolveDiam(dec(ep.dnsuc), vsuc);
  const impDiam = resolveDiam(dec(ep.dnimp), vimp);

  const caudalesDiseno: MemoriaTable = {
    title: 'Equipo presión — caudales de diseño',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      ['Caudal diseño AF (red agua fría)', or(ep.qac), 'L/s', 'Hunter / RAS 2000 — Caudal probable de la red de agua fría'],
      ['Caudal diseño ACS (red agua caliente)', or(ep.qasc), 'L/s', 'Hunter / RAS 2000 — Típico 60–70% del Qac'],
    ],
  };

  const presionesCotas: MemoriaTable = {
    title: 'Equipo presión — presiones y cotas',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      ...(isRed ? [['Presión acometida (red pública en entrega)', or(ep.pred), 'm.c.a.', 'Medida en campo']] : []),
      ['Presión mínima punto crítico', or(ep.pmin), 'm.c.a.', 'NTC 1500 Tab.3'],
      ['Presión máxima sistema', or(ep.pmax), 'm.c.a.', 'NSR-10 H.4.2 — límite 500 kPa'],
      ['Cota bomba', or(ep.zbomba), 'm', 'Nivel de instalación del equipo'],
      ['Cota punto más desfavorable', or(ep.ztop), 'm', 'Levantamiento topográfico o planos'],
    ],
  };

  const perdidasCarga: MemoriaTable = {
    title: 'Equipo presión — pérdidas de carga',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      ['Pérdidas red AF', or(ep.hfac), 'm.c.a.', 'Darcy-Weisbach'],
      ['Pérdidas red ACS', or(ep.hfacs), 'm.c.a.', 'Darcy-Weisbach — MAX(Hf_ac, Hf_acs) como pérdida crítica'],
      ['Pérdidas adicionales', or(ep.hfotros), 'm.c.a.', 'Opcional — calentador, filtros, válvulas de zona'],
    ],
  };

  const configBombas: MemoriaTable = {
    title: 'Equipo presión — configuración de bombas',
    headers: ['Parámetro', 'Valor'],
    rows: [
      ['Bombas en trabajo', or(ep.nt)],
      ['Bombas en reserva', or(ep.nr)],
      ['Total bombas', String(ntot)],
      ['Caudal por bomba Qb', fmtLps(Qb)],
    ],
  };

  const paramsEquipo: MemoriaTable = {
    title: 'Equipo presión — parámetros del equipo (datos del fabricante)',
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Eficiencia bomba (η_b)', or(ep.etab), 'dec'],
      ['Eficiencia motor (η_m)', or(ep.etam), 'dec'],
      ['Factor de seguridad potencia', or(ep.fs), 'dec'],
      ['Ciclos/hora (n)', `${or(ep.ciclos)} (${ciclos > 10 ? 'No O.K.' : 'OK'})`, 'arr/h'],
      ['Fracción útil tanque (α)', or(ep.alfa), 'dec'],
      ['Velocidad succión (V_suc)', or(ep.vsuc), 'm/s'],
      ['Velocidad impulsión (V_imp)', or(ep.vimp), 'm/s'],
    ],
  };

  const alturaManometrica: MemoriaTable = {
    title: `Equipo presión — altura manométrica total (${isRed ? 'succión directa' : 'succión desde cisterna'})`,
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Desnivel geométrico', `${hgOk ? '✓' : '✗'} ${f2(ztop - zbomba)}`, 'm.c.a.'],
      ...(!isRed ? [['Desnivel total', fmtMca(Hg), 'm.c.a.']] : []),
      ['Pérdidas de carga críticas', `${hfOk ? '✓' : '✗'} ${f2(HfCrit)}`, 'm.c.a.'],
      ...(!isRed ? [['Pérdidas de carga totales', `${hfOk ? '✓' : '✗'} ${f2(Hf)}`, 'm.c.a.']] : []),
      ['Presión mínima punto crítico', `${pminOk ? '✓' : '✗'} ${f2(pmin)}`, 'm.c.a.'],
      ...(isRed ? [['Presión disponible acometida', `${predOk ? '✓' : '✗'} ${f2(pred)}`, 'm.c.a.']] : []),
      ['Altura manométrica total HMT', `${hmtOk ? '✓' : '✗'} ${f2(HMT)}`, 'm.c.a.'],
      ['Verificación presión máxima del sistema', alertaPmax ? `⚠ ${f2(HMT)} > ${f2(pmax)}` : '✓ HMT dentro del límite', 'm.c.a.'],
    ],
  };

  const potenciaBomba: MemoriaTable = {
    title: 'Equipo presión — potencia de la bomba',
    headers: ['Parámetro', 'Valor', 'Ud.'],
    rows: [
      ['Potencia hidráulica', fmtW(Phid), 'W'],
      ['Potencia al freno', fmtW(Pfreno_w), 'W'],
      ['Potencia al freno', fmtHp(Pfreno_hp), 'HP'],
      ['Potencia calculada con factor de seguridad', Pins_hp > 0 ? `${f2(Pins_hp)} HP / ${Pins_kw > 0 ? f2(Pins_kw) : '—'} kW` : '—', ''],
      ['Potencia comercial seleccionada', String(nemaSel), 'HP'],
      ['Margen potencia comercial vs calculada', `${pComercialOk ? '+' : ''}${margenPct.toFixed(1)}%`, '%'],
      ['Verificación potencia comercial', pComercialOk ? '✓ Adecuada' : '⚠ Insuficiente', ''],
    ],
  };

  const caudales: MemoriaTable = {
    title: 'Equipo presión — caudales',
    headers: ['Parámetro', 'Valor', 'Ud.'],
    rows: [
      ['Qd = MAX(Qac, Qasc)', fmtLps(Qd), 'L/s'],
      ['Qd en m³/h', fmtM3h(Qm3h), 'm³/h'],
      ['Qd en GPM', fmtGpm(Qgpm), 'GPM'],
      ['Qb = Qd / Nt', fmtLps(Qb), 'L/s'],
    ],
  };

  const setpointTanque: MemoriaTable = {
    title: 'Equipo presión — setpoint y tanque hidroneumático',
    headers: ['Parámetro', 'Valor', 'Unidad', 'Fórmula'],
    rows: [
      ['Presión de arranque', fmtMca(Pon), 'm.c.a.', 'P_arranque = HMT'],
      ['Presión de paro', fmtMca(Poff), 'm.c.a.', 'P_paro = P_arranque × 1.10'],
      ['Presión de arranque en bar', fmtBar(Pon_bar), 'bar', 'P_arranque = HMT / 10.2'],
      ['Presión de paro en bar', fmtBar(Poff_bar), 'bar', 'P_paro = P_arranque × 1.10'],
      ['Precarga de nitrógeno N₂', fmtBar(PN2_bar), 'bar', 'P_precarga = 0.90 × P_arranque'],
      ['Volumen útil Vu', fmtL(Vu), 'L', 'Vu = Qd × 60 / (4 × n)'],
      ['Volumen total tanque Vt', fmtL(Vt), 'L', 'Vt = Vu / α'],
      ['Volumen total tanque Vt', Vt > 0 ? (Vt / 1000).toFixed(3) : '—', 'm³', 'Vt / 1000'],
    ],
  };

  const diametrosUsuario: MemoriaTable = {
    title: 'Equipo presión — diámetros seleccionados por el usuario',
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Tubería de succión', or(ep.dnsuc), 'mm DN'],
      ['Velocidad real en succión', fmtMs(sucDiam.Vreal), 'm/s'],
      ['Tubería de impulsión', or(ep.dnimp), 'mm DN'],
      ['Velocidad real en impulsión', fmtMs(impDiam.Vreal), 'm/s'],
    ],
  };

  const diametrosNominales: MemoriaTable = {
    title: 'Equipo presión — diámetros nominales de tuberías del equipo',
    headers: ['Ramal', 'Q (L/s)', 'V diseño (m/s)', 'D calc (mm)', 'DN (mm)', 'V real (m/s)'],
    rows: [
      ['Succión colector (Qd)', fmtLps(Qd), String(vsuc), fmtMm(rSucColector.diamCalcMm), String(rSucColector.dn), fmtMs(rSucColector.vReal)],
      ['Impulsión colector (Qd)', fmtLps(Qd), String(vimp), fmtMm(rImpColector.diamCalcMm), String(rImpColector.dn), fmtMs(rImpColector.vReal)],
      ['Succión por bomba (Qb)', fmtLps(Qb), String(vsuc), fmtMm(rSucBomba.diamCalcMm), String(rSucBomba.dn), fmtMs(rSucBomba.vReal)],
      ['Impulsión por bomba (Qb)', fmtLps(Qb), String(vimp), fmtMm(rImpBomba.diamCalcMm), String(rImpBomba.dn), fmtMs(rImpBomba.vReal)],
    ],
  };

  const especTecnica: MemoriaTable = {
    title: 'Equipo presión — especificación técnica del equipo',
    headers: ['Parámetro', 'Valor'],
    rows: [
      ['Caudal nominal', `${fmtLps(Qd)} L/s = ${fmtM3h(Qm3h)} m³/h = ${fmtGpm(Qgpm)} GPM`],
      ['Altura manométrica total', `${fmtMca(HMT)} m.c.a. = ${fmtBar(HMT / 10.2)} bar`],
      ['Configuración de bombas', `${ntot} uds: ${nt} trabajo + ${nr} reserva · Qb = ${fmtLps(Qb)} L/s c/u`],
      ['Potencia comercial', `${nemaSel} HP = ${(nemaSel * 0.7457).toFixed(0)} kW (calc: ${Pins_hp > 0 ? f2(Pins_hp) : '—'} HP)`],
      ['Setpoint P_arranque / P_paro', `${fmtBar(Pon_bar)} / ${fmtBar(Poff_bar)} bar`],
      ['Tanque acumulador', `${fmtL(Vt)} L · Precarga N₂ = ${fmtBar(PN2_bar)} bar`],
      ['DN succión / impulsión', `DN ${rSucColector.dn} / DN ${rImpColector.dn} mm (PVC Sch 40)`],
      ['Control', `VFD × ${ntot} · Transductor 4–20 mA · PLC/SCADA`],
      ['Normas', 'NTC 1500:2018 · RAS 2000 Tít. B · NSR-10 Tít. H · NFPA 20'],
    ],
  };

  return [
    caudalesDiseno, presionesCotas, perdidasCarga, configBombas,
    paramsEquipo, alturaManometrica, potenciaBomba, caudales,
    setpointTanque, diametrosUsuario, diametrosNominales, especTecnica,
  ];
}
