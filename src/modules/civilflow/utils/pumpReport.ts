// Memoria de Bomba AR (replicación de las 4 páginas para la exportación) — extraída de
// equipmentRows (split bomba/ep). El equipo de presión (EP) sigue en equipmentRows.ts.
import type { MemoriaTable } from './exportReportFinal.ts';
import { loadFromStorage } from '../services/storageService.ts';
import { dec } from './parseDecimal.ts';

// Espeja el objeto que PumpARDesign.tsx persiste vía saveToStorage('civilflow_memoria_bomba_data').
interface BombaMemoriaData {
  inputs: {
    salSim: string;
    udTot: string;
    hz: string;
    lImp: string;
    dImp: string;
    cHW: string;
    pDesc: string;
    etaB: string;
    fSrv: string;
    tCic: string;
    hMin: string;
    hMax: string;
    bCam: string;
    lCam: string;
    npsh: string;
    sal: number;
    ud: number;
  };
  outputs: {
    K: number;
    Qd: number;
    Qb: number;
    Vi: number;
    Hf: number;
    Hac: number;
    Hfri: number;
    Hest: number;
    Hm: number;
    Vch: string;
    Ph: number;
    Peje: number;
    Pcom: number;
    php: number;
    Sel: string;
    Vcam: number;
    Vchk: string;
  };
}

const or = (v: string | number | undefined | null): string =>
  v === '' || v == null ? '—' : String(v);
const f2 = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '—');

/** Tablas de memoria Bomba AR (réplica 1:1 de las 4 páginas para la exportación). */
export function computeBombaTables(): MemoriaTable[] {
  const data = loadFromStorage<BombaMemoriaData | null>('civilflow_memoria_bomba_data', null);
  if (!data) return [];
  const { inputs: i, outputs: o } = data;
  const di = dec(i.dImp),
    pd = dec(i.pDesc);
  const bc = dec(i.bCam),
    lc = dec(i.lCam),
    hmn = dec(i.hMin),
    hmx = dec(i.hMax);
  const Vgeo = bc > 0 && lc > 0 && hmx - hmn > 0 ? bc * lc * (hmx - hmn) : 0;

  const COLS1 = ['Parámetro', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Fuente / norma'];
  const COLS2 = ['Componente', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Observación'];

  const datosEntrada: MemoriaTable = {
    title: 'Bomba AR — datos de entrada',
    headers: COLS1,
    rows: [
      [
        'Número de salidas simultáneas',
        'Sal sim',
        or(i.salSim),
        'und',
        '—',
        'Probabilidad de trabajar al máximo',
      ],
      ['Unidades descarga acumuladas en sótano', 'UD tot', or(i.udTot), 'UD', '—', 'NTC 1500'],
      ['Coeficiente K simultaneidad Hunter', 'K', f2(o.K), '—', '—', 'K = 1/√(n−1)'],
      [
        'Caudal de diseño Q = UD × K',
        'Q dis',
        f2(o.Qd),
        'lps',
        `${f2(o.Qd * 15.8503)} GPM`,
        'Método Hunter NTC 1500',
      ],
      [
        'Caudal bombeo Qb (reserva 25%)',
        'Q b',
        f2(o.Qb),
        'lps',
        `${f2(o.Qb * 15.8503)} GPM`,
        'Factor seguridad sobre Q diseño',
      ],
      ['Altura geométrica sótano → piso 1', 'Hz', or(i.hz), 'm', '—', 'Diferencia de nivel'],
      [
        'Longitud total tubería impulsión',
        'L imp',
        or(i.lImp),
        'm',
        '—',
        'Tramos verticales + horizontales',
      ],
      [
        'Diámetro tubería impulsión',
        'D imp',
        or(i.dImp),
        'pulg',
        di ? `${f2(di * 25)} mm` : '—',
        'Mínimo 2" NTC 1500 §8',
      ],
      [
        'Coeficiente C Hazen-Williams (PVC)',
        'C HW',
        or(i.cHW),
        '—',
        '—',
        'RAS 2000 §B.6.4.2 — PVC liso nuevo',
      ],
      [
        'Presión mínima en descarga',
        'P desc',
        or(i.pDesc),
        'm.c.a.',
        pd ? `${f2(pd * 1.42)} psi` : '—',
        'Presión en punto entrega',
      ],
      [
        'Eficiencia bomba η',
        'eta b',
        or(i.etaB),
        '—',
        '—',
        'Bomba sumergible trituradora típica: 60–70%',
      ],
      [
        'Factor de servicio motor',
        'f srv',
        or(i.fSrv),
        '—',
        '—',
        'NEMA MG1: reserva 25% sobre P calculada',
      ],
    ],
  };

  const perdidasCarga: MemoriaTable = {
    title: 'Bomba AR — cálculo de pérdidas de carga',
    headers: COLS2,
    rows: [
      [
        'Velocidad en tubería impulsión',
        'V imp',
        f2(o.Vi),
        'm/s',
        '—',
        '0.6 < V < 3.5 m/s para residuales',
      ],
      [
        'Pérdida fricción (Hazen-Williams)',
        'Hf',
        f2(o.Hf),
        'm.c.a.',
        '—',
        'hf = 10.67·L·Q^1.852 / (C^1.852·D^4.87)',
      ],
      [
        'Pérdida en accesorios (25% de Hf)',
        'H ac',
        f2(o.Hac),
        'm.c.a.',
        '—',
        'Estimación conservadora',
      ],
      ['Pérdida total por fricción', 'H fri', f2(o.Hfri), 'm.c.a.', '—', 'Hf tubería + accesorios'],
      [
        'Altura estática total',
        'H est',
        f2(o.Hest),
        'm.c.a.',
        '—',
        'Hz geométrica + presión mínima descarga',
      ],
      [
        'Altura manométrica total Hm',
        'H m',
        f2(o.Hm),
        'm.c.a.',
        o.Hm ? `${f2(o.Hm * 1.42)} psi` : '—',
        'Hm = H fri + H est',
      ],
      ['Chequeo velocidad', 'V chk', or(o.Vch), '—', '—', 'Verificación automática'],
    ],
  };

  const bombaParams: MemoriaTable = {
    title: 'Bomba AR — parámetros de diseño bomba sumergible',
    headers: COLS1,
    rows: [
      [
        'Caudal nominal bomba',
        'Q b',
        f2(o.Qb),
        'lps',
        `${f2(o.Qb * 15.8503)} GPM`,
        'Incluye reserva 25%',
      ],
      [
        'Altura manométrica Hm',
        'H m',
        f2(o.Hm),
        'm.c.a.',
        o.Hm ? `${f2(o.Hm * 1.42)} psi` : '—',
        'Tomado de bloque 2',
      ],
      [
        'Potencia hidráulica',
        'P hid',
        f2(o.Ph),
        'W',
        o.Ph ? `${f2(o.Ph / 746)} HP` : '—',
        'Ph = ρ·g·Q·Hm / 1000',
      ],
      [
        'Potencia en el eje',
        'P eje',
        f2(o.Peje),
        'W',
        o.Peje ? `${f2(o.Peje / 746)} HP` : '—',
        'P eje = Ph / η bomba',
      ],
      [
        'Potencia comercial (×f srv)',
        'P com',
        f2(o.Pcom),
        'W',
        o.Pcom ? `${f2(o.php)} HP` : '—',
        'Motor seleccionar ≥ este valor',
      ],
      [
        'Selección comercial automática',
        'Sel',
        or(o.Sel),
        'HP',
        '—',
        'Estándar: 0.5 / 1 / 2 / 3 / 5 HP',
      ],
      [
        'Tipo de bomba',
        'Tipo',
        'Sumergible trituradora',
        '—',
        '—',
        'NTC 1500 §8.5 — residuales con sólidos',
      ],
      [
        'NPSH disponible mínimo',
        'NPSH',
        or(i.npsh),
        'm',
        '—',
        'Verificar con curva del fabricante',
      ],
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
      [
        'Tiempo mínimo ciclo arranque',
        't cic',
        or(i.tCic),
        'min',
        '—',
        'Mínimo 5 min entre arranques',
      ],
      [
        'Volumen útil cámara mínimo',
        'V cam',
        f2(o.Vcam),
        'lts',
        o.Vcam ? `${f2(o.Vcam / 1000)} m³` : '—',
        'V = Qb(lps) × t(s)',
      ],
      ['Tirante mínimo sobre bomba', 'h min', or(i.hMin), 'm', '—', 'Evita cavitación'],
      [
        'Tirante máximo antes de arrancar',
        'h max',
        or(i.hMax),
        'm',
        '—',
        'Nivel activación flotador',
      ],
      ['Ancho mínimo cámara', 'b cam', or(i.bCam), 'm', '—', 'NTC 1500 §8.5 — mínimo 60 cm'],
      ['Largo mínimo cámara', 'l cam', or(i.lCam), 'm', '—', 'Verificar con dimensiones bomba'],
      [
        'Volumen geométrico disponible',
        'V geo',
        Vgeo > 0 ? f2(Vgeo) : '—',
        'm³',
        Vgeo > 0 ? `${f2(Vgeo * 1000)} lts` : '—',
        'b×l×(h max−h min)',
      ],
      ['Chequeo volumen', 'V chk', or(o.Vchk) || '—', '—', '—', 'V geo ≥ V cam requerido'],
    ],
  };

  const camaraSpec: MemoriaTable = {
    title: 'Bomba AR — especificación cámara de bombeo',
    headers: ['Ítem', 'Valor'],
    rows: [
      ['Volumen útil requerido', `${f2(o.Vcam)} lts`],
      [
        'Dimensiones mínimas (m)',
        bc > 0 && lc > 0 && hmx - hmn > 0 ? `${i.bCam} x ${i.lCam} x ${f2(hmx - hmn)}` : '—',
      ],
      ['Material', 'Concreto impermeabilizado o polietileno PEAD'],
      ['Accesorios obligatorios', 'Rejilla aguas arriba + ventilación Ø2" + alarma nivel alto'],
    ],
  };

  return [datosEntrada, perdidasCarga, bombaParams, bombaSpec, camaraParams, camaraSpec];
}

/** Chequeo Bomba AR (volcado sin filas cumple/no cumple: null sin datos, [] con datos). */
export function bombaAlertas(): string[] | null {
  const data = loadFromStorage<unknown>('civilflow_memoria_bomba_data', null);
  if (!data) return null;
  return [];
}
