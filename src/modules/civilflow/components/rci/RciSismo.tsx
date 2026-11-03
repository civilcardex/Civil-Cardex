/** Pestaña "Soportes sísmicos" del diseño RCI (Red Contra Incendio): guía de ubicación de
 *  riostras, acoples flexibles, restricciones y holguras según NFPA 13 cap. 18 y la zona
 *  sísmica del proyecto — indicativa, no calcula fuerzas. Port del renderSismo del HTML:
 *  grilla de 6 métricas encima y dos bloques titulados (SecRci): "Dónde van los soportes
 *  sísmicos" (esquema + 7 reglas) y "Riostras estimadas por piso de cada tipología". Sin
 *  reqSismo o sin edificio la pestaña es un card simple con el aviso.
 *  Ej: con reqSismo "No" muestra el vacío con el botón que salta a Entradas → Normativa local. */
import { SecRci, KvTabla, SubTabsRci, useNavRci, type RciCtx, type SubItemRci } from './uiRci.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import { zonaSis } from '../../lib/rci/index.ts';
import {
  sismoConteo,
  SIS_LAT,
  SIS_LONG,
  SIS_4V,
  type SismoK,
  type SismoTip,
} from '../../utils/rci/rowsModelExtras.ts';
import { SismoSvg, fmtNum } from './rciSvgEsquemas.tsx';

/** Sub-pestañas de la pestaña Sismo (id 'criterios' = el destino de RUTA_DE para el tab sismo). */
const SUBS: SubItemRci[] = [
  { id: 'criterios', titulo: 'Criterios por zona' },
  { id: 'cantidades', titulo: 'Cantidades por tipología' },
];

const TH10 = { ...TH, fontSize: 11 } as const;
const TDC = { ...TD, fontSize: 13, padding: '2px 4px' } as const;

/** Botón "Ir al dato" del vacío. */
const BTN_IR: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 12px',
  cursor: 'pointer',
  border: '1px solid var(--line)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--txt)',
  fontFamily: 'var(--body)',
};

/** Celda del resumen: etiqueta chica gris y valor grueso (la .summary del HTML). */
function Metrica({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        background: 'var(--bg3)',
        padding: '6px 10px',
        fontSize: 10.5,
        color: 'var(--txt2)',
      }}
    >
      {k}
      <b style={{ display: 'block', fontSize: 13.5, color: 'var(--txt)', marginTop: 1 }}>{v}</b>
    </div>
  );
}

/** Las 7 reglas del HTML con los límites NFPA 13 (SIS_LAT/SIS_LONG/SIS_4V formateados es-CO).
 *  losaR cambia la nota del montante; cpTxt es el Cp mostrado ("0,50" por defecto).
 *  Ej: reglasSismo(true, '0,50')[2][0] = 'Ramales de 2½" o más'. */
function reglasSismo(losaR: boolean, cpTxt: string): [string, string][] {
  return [
    [
      'Cada montante',
      `Cuatro vías arriba y cada ≤ ${fmtNum(SIS_4V, 1)} m${losaR ? ' (las losas con paso ajustado hacen de apoyo)' : ' (losas sin restricción: van intermedias)'}. Acoples a ≤ 0,6 m en los extremos y en cada losa (≤ 0,3 m encima, ≤ 0,6 m debajo)`,
    ],
    [
      'Tramos troncales y secundarios',
      `Laterales cada ≤ ${fmtNum(SIS_LAT, 1)} m (la última a ≤ 1,8 m del extremo); longitudinales cada ≤ ${fmtNum(SIS_LONG, 1)} m (la última a ≤ 12,2 m). Menor separación según la tabla de NFPA 13 para Cp = ${cpTxt} y el diámetro`,
    ],
    ['Ramales de 2½" o más', 'Laterales, con el mismo criterio de los tramos'],
    [
      'Ramales menores de 2½"',
      'Restricción en el extremo y a intervalos según la tabla de NFPA 13 (abrazadera en U, riostra listada o alambre a ≥ 45°)',
    ],
    [
      'Pasos por muros y losas',
      'Hueco ≥ tubo + 50 mm (1" a 3½") o + 100 mm (4" o más); no aplica en muros de yeso no resistentes al fuego',
    ],
    ['Juntas del edificio', 'Lazo flexible de separación sísmica; acoples a ≤ 0,3 m a cada lado'],
    [
      'Cuarto de bombas',
      'Tubería arriostrada como troncal; acoples flexibles en equipos que vibran',
    ],
  ];
}

/** Fila de la tabla de cantidades por tipología (una fila por SismoTip). Ej: T1 con 3 pisos y
 *  21 m de tramos → 2 laterales + 1 longitudinal + 1 lateral por ramal ≥ 2½". */
function FilaTip({ t }: { t: SismoTip }) {
  if (t.sin) {
    return (
      <tr>
        <td style={{ ...TDC, color: 'var(--txt)', fontWeight: 700 }}>{t.id}</td>
        <td colSpan={7} style={{ ...TDC, textAlign: 'left', color: 'var(--txt3)' }}>
          Sin red: dibújela en PLANO para estimar sus riostras
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td style={{ ...TDC, color: 'var(--txt)', fontWeight: 700 }}>{t.id}</td>
      <td style={{ ...TDC, textAlign: 'left' }}>{t.pisos || '—'}</td>
      <td style={TDC}>{t.nF}</td>
      <td style={TDC}>{fmtNum(t.Lm, 1)}</td>
      <td style={TDC}>{t.lat ?? '—'}</td>
      <td style={TDC}>{t.lon ?? '—'}</td>
      <td style={TDC}>{t.ramG ? `${t.latR} (${t.ramG} ramal${t.ramG > 1 ? 'es' : ''})` : '—'}</td>
      <td style={TDC}>{t.restr ?? '—'}</td>
    </tr>
  );
}

/** Pestaña Sismo del diseño RCI. Ej: <RciSismo ctx={ctx} /> dentro de RciDesign. */
export function RciSismo({ ctx }: { ctx: RciCtx }) {
  const { estado, R } = ctx;
  const { irA, tab: navTab, sub: navSub } = useNavRci();

  /* La sub abierta vive en la nav (fuente única): los saltos «Ir al dato» y los clics propios
     pasan por irA('sismo', sub) — sin estado local que sincronizar. */
  const activa =
    navTab === 'sismo' && navSub && SUBS.some((s) => s.id === navSub) ? navSub : SUBS[0].id;
  const setSub = (s: string) => irA('sismo', s);

  // Sin diseño sísmico declarado: card simple con el salto a Entradas → Normativa local.
  if (estado.local.reqSismo !== 'Sí') {
    return (
      <section className="card">
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            fontSize: 12.5,
            color: 'var(--txt2)',
          }}
        >
          El proyecto no tiene diseño sísmico de la red. Si el código local lo exige, responda «Sí»
          en Entradas → Normativa local y elija la zona sísmica.
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => irA('entradas', 'normativa', 'local.reqSismo')}
              style={BTN_IR}
            >
              Ir al dato
            </button>
          </div>
        </div>
      </section>
    );
  }

  const K: SismoK | null = sismoConteo(
    R.edif,
    estado.pisos.rows,
    estado.sp,
    estado.local,
    estado.redes,
  );
  if (!K) {
    return (
      <section className="card">
        <div style={{ padding: '16px 12px', fontSize: 12.5, color: 'var(--txt2)' }}>
          Sin edificio calculado todavía: confirme planos y complete la ruta de gabinetes para
          estimar las riostras.
        </div>
      </section>
    );
  }

  const ZS = zonaSis(estado);
  const zona = ZS.z;
  const cp = num(estado.local.cp);
  const zTxt = !zona
    ? 'Sin zona: elíjala en Entradas → Normativa local'
    : zona === 'Baja'
      ? 'Zona baja: confirme con el código local si exige arriostramiento; esta guía queda como referencia'
      : `Zona ${zona.toLowerCase()}: aplique la guía completa`;

  /* Totales del edificio: por tipología, laterales = (tramos + ramales grandes) × pisos y
     longitudinales = tramos × pisos (los "sin red" no aportan). */
  let latTot = 0;
  let lonTot = 0;
  for (const t of K.tips) {
    if (t.sin) continue;
    latTot += ((t.lat || 0) + (t.latR || 0)) * t.nF;
    lonTot += (t.lon || 0) * t.nF;
  }

  const reglas = reglasSismo(K.losaR, cp !== null ? fmtNum(cp, 2) : '0,50');

  return (
    <>
      {/* Resumen de 6 métricas (el .summary del HTML), encima de los bloques. */}
      <div
        title="Esta pestaña es del edificio completo: combina todos los pisos y tipologías"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <Metrica k="Zona sísmica" v={`${zona || '—'}${ZS.auto ? ' · NSR-10' : ''}`} />
        <Metrica k="Coeficiente Cp" v={cp !== null ? fmtNum(cp, 2) : '0,50 (defecto)'} />
        <Metrica k="Norma local" v={estado.local.normSis || '—'} />
        <Metrica k="Riostras laterales (edificio)" v={String(latTot + K.latC)} />
        <Metrica k="Longitudinales" v={String(lonTot)} />
        <Metrica k="Cuatro vías · acoples en montantes" v={`${K.four} · ${K.acop}`} />
      </div>

      <SubTabsRci subs={SUBS} sub={activa} setSub={setSub}>
        {activa === 'criterios' ? (
          <SecRci
            id="sismo"
            titulo="Dónde van los soportes sísmicos"
            nota={`${zTxt} · NFPA 13 cap. 18 · indicativa`}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <SismoSvg losaRestr={K.losaR} />
              <table
                className="tbl"
                style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}
              >
                <tbody>
                  {reglas.map(([a, b]) => (
                    <tr key={a}>
                      <th
                        scope="row"
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--line)',
                          color: 'var(--txt2)',
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                          verticalAlign: 'top',
                        }}
                      >
                        {a}
                      </th>
                      <td
                        style={{
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--line)',
                          fontSize: 13,
                          color: 'var(--txt)',
                        }}
                      >
                        {b}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--txt3)' }}>
              Cada riostra se diseña con Cp, la carga de su zona de influencia y las tablas de NFPA
              13.
            </p>
          </SecRci>
        ) : (
          <SecRci
            id="cantidades"
            titulo="Riostras estimadas por piso de cada tipología"
            nota="Indicativo: con las longitudes de la red; se confirma en el plano"
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                className="tbl"
                style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}
              >
                <thead>
                  <tr>
                    <th scope="col" style={TH10}>
                      Tipología
                    </th>
                    <th scope="col" style={TH10}>
                      Pisos
                    </th>
                    <th scope="col" style={{ ...TH10, width: 54 }}>
                      N.º
                    </th>
                    <th scope="col" style={{ ...TH10, width: 80 }}>
                      L tramos (m)
                    </th>
                    <th scope="col" style={{ ...TH10, width: 90 }}>
                      Laterales tramos
                    </th>
                    <th scope="col" style={{ ...TH10, width: 90 }}>
                      Longitudinales
                    </th>
                    <th scope="col" style={{ ...TH10, width: 120 }}>
                      Laterales ramales ≥ 2½"
                    </th>
                    <th scope="col" style={{ ...TH10, width: 90 }}>
                      Restricciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {K.tips.map((t) => (
                    <FilaTip key={t.id} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 12,
                marginTop: 10,
                alignItems: 'start',
              }}
            >
              <div>
                <h5 style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--txt2)' }}>
                  Montantes y cuarto de bombas
                </h5>
                <KvTabla
                  filas={[
                    {
                      l: 'Riostras de cuatro vías',
                      v: String(K.four),
                      u: 'un',
                      nota: K.fourInt
                        ? `Por montante (${K.nM}): una arriba + ${K.fourInt} intermedia(s), separadas ≤ ${fmtNum(SIS_4V, 1)} m (montante de ${fmtNum(K.hM, 1)} m; las losas no lo restringen)`
                        : `Una arriba de cada montante (${K.nM}); las losas intermedias hacen de apoyo`,
                    },
                    {
                      l: 'Acoples flexibles en montantes',
                      v: String(K.acop),
                      u: 'un',
                      nota: `2 por montante + 2 por losa atravesada (${K.nPen})`,
                    },
                    {
                      l: 'Riostras laterales en el cuarto de bombas',
                      v: String(K.latC),
                      u: 'un',
                      nota: `${fmtNum(K.Lc, 1)} m de tubería`,
                    },
                  ]}
                />
              </div>
              <div>
                <h5 style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--txt2)' }}>
                  Holguras de paso por diámetro
                </h5>
                <KvTabla
                  filas={K.holg.map((h) => ({
                    l: h.dn,
                    v: `+ ${h.mm} mm`,
                    nota: `hueco mínimo aprox. ${fmtNum(h.i * 25.4 + h.mm, 0)} mm`,
                  }))}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--txt3)' }}>
              Por piso de cada tipología, multiplicado en los totales del resumen por su número de
              pisos. Ramales: los que fluyen y los que no, tal como están en la tabla.
            </p>
          </SecRci>
        )}
      </SubTabsRci>
    </>
  );
}

export default RciSismo;
