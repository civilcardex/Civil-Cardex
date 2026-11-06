/** Páginas de tabla de Diseño de Grupo de Presión (Bomba AR) — extraídas de PumpARDesign por el
 *  guard de líneas. Son FUNCIONES de render (NO componentes: react-hooks/static-components),
 *  hoy parametrizadas con un único objeto PumpPageCtx que trae la bomba seleccionada, su
 *  cálculo y los handlers del padre — el JSX es verbatim del original.
 *  Ej: pageEntrada(ctx) devuelve el JSX de "1. Datos de entrada". */
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import EditButton from './shared/EditButton.tsx';
import Tbl from './shared/Tbl';
import Card from './shared/Card.tsx';
import { equiposBombaDesdeTrazos } from '../utils/pumpAssociation';
import { cHazenDe, calcsDe, type BombaInputs } from './pumpARCalcs';

/** Fila de vista de una bomba: los datos de equiposBombaDesdeTrazos + inputs y cálculo. */
type PumpRow = ReturnType<typeof equiposBombaDesdeTrazos>[number] & {
  inp: BombaInputs;
  c: ReturnType<typeof calcsDe>;
};

/** Todo lo que las 4 páginas leen del componente padre: la bomba elegida (sel/c/selCode),
 *  el modo edición y sus celdas, y el filtro/nota del header. */
export interface PumpPageCtx {
  filtroBombas: ReactNode;
  sinBombas: boolean;
  sel: PumpRow | undefined;
  c: ReturnType<typeof calcsDe> | undefined;
  selCode: string;
  edit: boolean;
  setEdit: Dispatch<SetStateAction<boolean>>;
  cellInp: (code: string, k: keyof BombaInputs, aria: string, w?: number) => ReactNode;
  cellSel: (code: string, aria: string, w?: number) => ReactNode;
  sinBombasNote: ReactNode;
}
/** Celda de valor con 3 decimales (mono); '—' gris si vacío. */
const Fmt3 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(3) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

/** Celda de valor con 2 decimales (mono); '—' gris si vacío. */
const Fmt2 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(2) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

/** Celda de encabezado de las tablas de Bomba AR. */
const TH_AR = { fontSize: 12.5, padding: '3px 4px' };
/** Celda de valor de las tablas de Bomba AR. */
const TD_AR = { fontSize: 12.5, padding: '2px 4px' };
/** Columna Parámetro/Componente compacta: sin el ancho grande por defecto de Tbl. */
const TDL_R = { minWidth: 0, fontSize: 13.5, fontWeight: 600 };
/** Columna de notas (Equivalencia/Fuente): el texto sí puede partir en varias líneas. */
const NOTE_COL = { whiteSpace: 'normal' as const, minWidth: 130, fontSize: 12 };
/** Borde EXTERIOR izquierdo en la 1ª celda (orig. usuario: al ras del contenido — el borde de <table> quedaba separado de la grilla por el reparto de columnas). */
const EDGE_L = { borderLeft: '1px solid var(--line)' };
/** Borde EXTERIOR derecho en la última celda (misma razón; además hereda el estilo de notas). */
const EDGE_R = { ...NOTE_COL, borderRight: '1px solid var(--line)' };
/** Encabezados de la tabla de ENTRADA (6 columnas). */
const COLS_IN = ['Parámetro', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Fuente / norma'];
/** Encabezados de la tabla de SALIDA (6 columnas). */
const COLS_OUT = ['Componente', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Observación'];
/** Tooltips columna a columna de la tabla de entrada. */
const TIPS_IN = [
  'Nombre del parámetro de entrada.',
  'Símbolo con el que se representa el parámetro.',
  'Valor ingresado o calculado.',
  'Unidad del valor.',
  'Equivalencia del valor en otra unidad.',
  'Fuente o norma de la que proviene el dato.',
];
/** Tooltips columna a columna de la tabla de salida. */
const TIPS_OUT = [
  'Componente o variable del cálculo.',
  'Símbolo con el que se representa.',
  'Valor calculado.',
  'Unidad del valor.',
  'Equivalencia del valor en otra unidad.',
  'Observación sobre el resultado.',
];
/** Estilo por columna (índice): borde exterior + notas en 1ª y última. */
const COL_STYLES = [EDGE_L, undefined, undefined, undefined, NOTE_COL, EDGE_R];

/** Valor equivalente REAL (orig. usuario): muestra `valor × factor + unidad` de la propia
 *  celda — p.ej. Qd 12 lps → "190.20 GPM". Sin valor → "—". */
const Eq = (raw: string | number | undefined, f: number, u: string) => {
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
  if (!v || !isFinite(v)) return '—';
  return `${(v * f).toFixed(2)} ${u}`;
};
/** Página 1 «Datos de entrada»: la tabla vertical de la bomba elegida (salidas simultáneas,
 *  Q (Caudal), altura, impulsión...) con sus celdas editables bajo EDITAR.
 *  Ej: cambiar Hz a 4.5 re-calcula Hm y la potencia comercial al instante. */
export const pageEntrada = (p: PumpPageCtx) => {
  const {
    filtroBombas,
    sinBombas,
    sel,
    c,
    selCode,
    edit,
    setEdit,
    cellInp,
    cellSel,
    sinBombasNote,
  } = p;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {filtroBombas}
      {!sinBombas && sel && c && (
        <Card
          style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
          iconImg="/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title={`1. Datos de entrada — ${selCode}`}
          headerRight={<EditButton edit={edit} setEdit={setEdit} />}
        >
          <Tbl
            tableStyle={{ width: '100%' }}
            tdlStyle={TDL_R}
            thStyle={TH_AR}
            tdStyle={TD_AR}
            cols={COLS_IN}
            tips={TIPS_IN}
            colStyles={COL_STYLES}
            rows={[
              [
                'Número de salidas simultáneas',
                'Sal sim',
                cellInp(selCode, 'sal', 'Salidas simultáneas'),
                '—',
                '—',
                'Método Hunter (NTC 1500)',
              ],
              [
                'Unidades de descarga acumuladas en sótano',
                'UD tot',
                Fmt2(sel.uds),
                'UD',
                '—',
                'Aparatos conectados a la bomba (trazos del diseño)',
              ],
              ['Coeficiente de simultaneidad', 'K', Fmt2(c.K), '—', '—', 'K = 1/√(n − 1)'],
              [
                'Caudal de diseño',
                'Q dis',
                Fmt2(c.Qd),
                'lps',
                Eq(c.Qd, 15.8503, 'GPM'),
                'Q = UD × K (Hunter)',
              ],
              [
                'Caudal de bombeo (reserva 25%)',
                'Q b',
                Fmt2(c.Qb),
                'lps',
                Eq(c.Qb, 15.8503, 'GPM'),
                'Qb = 1.25 × Qd',
              ],
              [
                'Altura geométrica',
                'Hz',
                cellInp(selCode, 'hz', 'Altura geométrica'),
                'm',
                Eq(sel.inp.hz, 3.28084, 'ft'),
                'Sótano → punto de descarga',
              ],
              [
                'Longitud total tubería de impulsión',
                'L imp',
                cellInp(selCode, 'lImp', 'Longitud impulsión'),
                'm',
                Eq(sel.inp.lImp, 3.28084, 'ft'),
                '—',
              ],
              [
                'Diámetro tubería de impulsión',
                'D imp',
                cellInp(selCode, 'dImp', 'Diámetro impulsión'),
                'pulg',
                Eq(sel.inp.dImp, 25.4, 'mm'),
                'Mínimo 2" (NTC 1500)',
              ],
              ['Tipo de tubería', '—', cellSel(selCode, 'Tipo de tubería'), '—', '—', 'Catálogo'],
              [
                'Coeficiente Hazen-Williams',
                'C HW',
                Fmt2(cHazenDe(sel.inp.tipoTuberia)),
                '—',
                '—',
                'Catálogo Maestro — no editable',
              ],
              [
                'Presión mínima en descarga',
                'P desc',
                cellInp(selCode, 'pDesc', 'Presión mínima descarga'),
                'm.c.a.',
                Eq(sel.inp.pDesc, 1.42233, 'psi'),
                '—',
              ],
              [
                'Eficiencia de bomba',
                'eta b',
                cellInp(selCode, 'etaB', 'Eficiencia bomba', 90),
                '%',
                '—',
                'Sumergible trituradora típica: 60–70%',
              ],
              [
                'Factor de servicio del motor',
                'f srv',
                cellInp(selCode, 'fSrv', 'Factor de servicio', 90),
                '—',
                '—',
                'NEMA MG-1: reserva 25% sobre P calculada',
              ],
            ]}
          />
        </Card>
      )}
      {sinBombasNote}
    </div>
  );
};

/** Página 2 «Cálculo de pérdidas de carga»: velocidad en impulsión, Hf (Hazen-Williams),
 *  accesorios (25 % de Hf) y el chequeo 0.6 ≤ V ≤ 3.5 m/s. Solo lectura — sale de calcular. */
export const pagePerdidas = (p: PumpPageCtx) => {
  const { sinBombas, c, selCode, sinBombasNote } = p;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {!sinBombas && c && (
        <Card
          style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
          iconImg="/iconos_civilflow/diseno_redes/equipos/perdidas_de_carga.webp"
          iconImgStyle={{ width: 22, height: 22 }}
          title={`2.Cálculo de pérdidas de carga — ${selCode}`}
        >
          <Tbl
            tableStyle={{ width: '100%' }}
            tdlStyle={TDL_R}
            thStyle={TH_AR}
            tdStyle={TD_AR}
            cols={COLS_OUT}
            tips={TIPS_OUT}
            colStyles={COL_STYLES}
            rows={[
              [
                'Velocidad en tubería de impulsión',
                'V imp',
                Fmt3(c.Vi),
                'm/s',
                '—',
                '0.6 < V < 3.5 m/s (residuales)',
              ],
              [
                'Pérdida por fricción',
                'Hf',
                Fmt3(c.Hf),
                'm.c.a.',
                '—',
                'Hazen-Williams: 10.67·L·Q^1.852 / (C^1.852·D^4.87)',
              ],
              ['Pérdida en accesorios', 'H ac', Fmt3(c.Hac), 'm.c.a.', '—', '25% de Hf'],
              ['Pérdida total por fricción', 'H fri', Fmt3(c.Hfri), 'm.c.a.', '—', 'Hf + H ac'],
              [
                'Altura estática total',
                'H est',
                Fmt3(c.Hest),
                'm.c.a.',
                Eq(c.Hest, 1.42233, 'psi'),
                'Hz + P desc',
              ],
              [
                'Altura manométrica total',
                'H m',
                Fmt3(c.Hm),
                'm.c.a.',
                Eq(c.Hm, 1.42233, 'psi'),
                'H fri + H est',
              ],
              [
                'Chequeo velocidad',
                'V chk',
                <span
                  style={{
                    color: c.Vch === 'O.K.' ? '#22c55e' : '#ef5350',
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                  }}
                >
                  {c.Vch}
                </span>,
                '—',
                '—',
                'O.K. si 0.6 ≤ V ≤ 3.5 m/s',
              ],
            ]}
          />
        </Card>
      )}
      {sinBombasNote}
    </div>
  );
};

/** Páginas 3-4 «Bomba sumergible»: parámetros (NPSH (Net Positive Suction Head, carga neta
 *  positiva de succión), tipo) + la especificación comercial (potencia hidráulica/eje/comercial
 *  y la HP comercial siguiente). */
export const pageBomba = (p: PumpPageCtx) => {
  const { sinBombas, sel, c, selCode, edit, setEdit, cellInp, sinBombasNote } = p;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {!sinBombas && sel && c && (
        <>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/bomba_sumergible_trituradora.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`3.Parámetros de diseño bomba sumergible — ${selCode}`}
            headerRight={<EditButton edit={edit} setEdit={setEdit} />}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_AR}
              tdStyle={TD_AR}
              cols={COLS_IN}
              tips={TIPS_IN}
              colStyles={COL_STYLES}
              rows={[
                [
                  'NPSH disponible',
                  'NPSH',
                  cellInp(selCode, 'npsh', 'NPSH disponible'),
                  'm',
                  Eq(sel.inp.npsh, 3.28084, 'ft'),
                  'Bomba sumergible: no requiere cebado',
                ],
                ['Tipo de bomba', '—', 'Sumergible trituradora', '—', '—', 'NTC 1500'],
              ]}
            />
          </Card>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_trituradora.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`4.Especificación — Bomba sumergible trituradora — ${selCode}`}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_AR}
              tdStyle={TD_AR}
              cols={COLS_OUT}
              tips={TIPS_OUT}
              colStyles={COL_STYLES}
              rows={[
                ['Caudal nominal', 'Q b', Fmt2(c.Qb), 'lps', Eq(c.Qb, 15.8503, 'GPM'), '—'],
                ['Altura manométrica', 'H m', Fmt2(c.Hm), 'm.c.a.', Eq(c.Hm, 1.42233, 'psi'), '—'],
                [
                  'Potencia hidráulica',
                  'P hid',
                  Fmt2(c.Ph),
                  'W',
                  Eq(c.Ph, 0.00134102, 'HP'),
                  'P = ρ·g·Q·H',
                ],
                [
                  'Potencia de eje',
                  'P eje',
                  Fmt2(c.Peje),
                  'W',
                  Eq(c.Peje, 0.00134102, 'HP'),
                  'P eje = P hid / η bomba',
                ],
                ['Potencia comercial', 'P com', Fmt2(c.Pcom), 'W', '—', 'P eje × f servicio'],
                ['Potencia motor', 'P', Fmt2(c.php, 'HP'), 'HP', '—', 'P com / 745.7'],
                [
                  'Selección comercial',
                  '—',
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{c.Sel}</span>,
                  '—',
                  '—',
                  'HP comercial siguiente',
                ],
              ]}
            />
          </Card>
        </>
      )}
      {sinBombasNote}
    </div>
  );
};

/** Páginas 5-6 «Cámara de bombeo (pozo húmedo)»: ciclo/tirantes/ancho/largo editables + el
 *  volumen útil y geométrico con su chequeo V geo ≥ V útil. */
export const pageCamara = (p: PumpPageCtx) => {
  const { sinBombas, sel, c, selCode, edit, setEdit, cellInp, sinBombasNote } = p;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* sel entra al guard (antes lo estrechaba el aliased `c = sel?.c` del padre): sin
          bomba seleccionada no hay c, así que el render es idéntico. */}
      {!sinBombas && sel && c && (
        <>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/camara_bombeo.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`5.Parámetros de diseño cámara de bombeo — ${selCode}`}
            headerRight={<EditButton edit={edit} setEdit={setEdit} />}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_AR}
              tdStyle={TD_AR}
              cols={COLS_IN}
              tips={TIPS_IN}
              colStyles={COL_STYLES}
              rows={[
                [
                  'Tiempo de ciclo',
                  't cic',
                  cellInp(selCode, 'tCic', 'Tiempo ciclo'),
                  'min',
                  '—',
                  'Mínimo 5 min entre arranques',
                ],
                [
                  'Tirante mínimo',
                  'h min',
                  cellInp(selCode, 'hMin', 'Tirante mínimo'),
                  'm',
                  Eq(sel.inp.hMin, 3.28084, 'ft'),
                  'Evita cavitación',
                ],
                [
                  'Tirante máximo',
                  'h max',
                  cellInp(selCode, 'hMax', 'Tirante máximo'),
                  'm',
                  Eq(sel.inp.hMax, 3.28084, 'ft'),
                  'Nivel de activación del flotador',
                ],
                [
                  'Ancho de cámara',
                  'b cam',
                  cellInp(selCode, 'bCam', 'Ancho cámara'),
                  'm',
                  Eq(sel.inp.bCam, 3.28084, 'ft'),
                  '—',
                ],
                [
                  'Largo de cámara',
                  'l cam',
                  cellInp(selCode, 'lCam', 'Largo cámara'),
                  'm',
                  Eq(sel.inp.lCam, 3.28084, 'ft'),
                  '—',
                ],
              ]}
            />
          </Card>
          <Card
            style={{ width: '50%', margin: '0 auto', alignSelf: 'center' }}
            iconImg="/iconos_civilflow/diseno_redes/equipos/especificacion_camara_bombeo.webp"
            iconImgStyle={{ width: 22, height: 22 }}
            title={`6.Especificación — Cámara de bombeo — ${selCode}`}
          >
            <Tbl
              tableStyle={{ width: '100%' }}
              tdlStyle={TDL_R}
              thStyle={TH_AR}
              tdStyle={TD_AR}
              cols={COLS_OUT}
              tips={TIPS_OUT}
              colStyles={COL_STYLES}
              rows={[
                [
                  'Volumen útil',
                  'V cam',
                  Fmt2(c.Vcam),
                  'lts',
                  Eq(c.Vcam, 0.001, 'm³'),
                  'V = Qb(lps) × t(min) × 60',
                ],
                [
                  'Volumen geométrico',
                  'V geo',
                  Fmt2(c.Vgeo),
                  'lts',
                  Eq(c.Vgeo, 0.001, 'm³'),
                  'b × l × (h max − h min)',
                ],
                [
                  'Chequeo',
                  '—',
                  <span
                    style={{
                      color: c.Vchk === 'O.K.' ? '#22c55e' : '#ef5350',
                      fontWeight: 700,
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                    }}
                  >
                    {c.Vchk}
                  </span>,
                  '—',
                  '—',
                  'V geom ≥ V útil',
                ],
              ]}
            />
            <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '6px 8px' }}>
              Material: concreto impermeabilizado o polietileno PEAD. Accesorios obligatorios:
              rejilla aguas arriba + ventilación Ø2" + alarma de nivel alto.
            </div>
          </Card>
        </>
      )}
      {sinBombasNote}
    </div>
  );
};
