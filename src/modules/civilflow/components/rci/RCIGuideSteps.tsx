/** Contenido de los 9 pasos de la Guía de diseño RCI (los bodies del GUIDE del HTML de
 *  referencia, portados literales): textos, tablas de criterios y de tipologías, franjas de
 *  estado con los chips de las verificaciones y los esquemas SVG del proyecto. El shell
 *  (nav + botones) vive en RciGuiaModal; este archivo solo dibuja el paso activo.
 *  Ej: <PasoGuia paso={0} ctx={ctx} irGo={(go) => irGo(go)} /> pinta "Clasifique el riesgo". */
import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChipEstado, COLOR_ESTADO, type RciCtx } from './RCIUI.tsx';
import { CorteSvg, PlanSvg } from './RCISvgFloorplan.tsx';
import { ElevSvg } from './RCISvgBuilding.tsx';
import { rangoTipologia } from '../../utils/rci/RCIRowsModelExtras.ts';
import { fmt } from '../../utils/rci/RCIRowsModel2.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import { HZ } from '../../lib/rci/tables.ts';
import { colorTip, n2 } from './RCISvgSchemas.tsx';
import type { Tipologia, Verificacion } from '../../lib/rci/types.ts';

/** Prefijos de verificación que la guía consulta (el chk(lab) del HTML, por startsWith). */
const PREFIJOS_CHK = [
  'Riesgo NFPA 13 compatible',
  'Altura de arrume',
  'Separación entre rociadores',
  'Separación entre ramales',
  'Área por rociador',
  'Distancia a muro',
] as const;
/** Unión de esos prefijos: los enlaces «Ir al dato» de la guía saltan a la verificación cuyo id empieza con él. */
export type PrefijoChk = (typeof PREFIJOS_CHK)[number];

/** Filas de la tabla de criterios por riesgo (catálogo fijo NFPA 13, resuelto una vez). */
const FILAS_HZ = Object.entries(HZ);

/** Quita "Riesgo " y capitaliza: "Riesgo ordinario G1" → "Ordinario G1". */
const etiquetaRiesgo = (k: string): string => {
  const s = k.replace('Riesgo ', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ---------------- Estilos (franjas y texto del HTML, con variables del repo) ---------------- */

const TXT: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: 'var(--txt2)',
  margin: '6px 0',
};
const UL: CSSProperties = {
  margin: '6px 0',
  paddingLeft: 20,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: 'var(--txt2)',
};
/** Franja .gstate del HTML: fondo del color de cálculo (COL_TEMA.calc = var(--bg3)). */
const GST: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--bg3)',
  borderRadius: 5,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 10px',
  alignItems: 'center',
  fontSize: 12,
  margin: '10px 0 0',
};
const GCAP: CSSProperties = {
  fontSize: 10.5,
  color: 'var(--txt3)',
  margin: '4px 0',
  fontFamily: 'var(--mono)',
};
/* maxWidth 620: el SVG del paso baja a ~240px de alto y los pasos 2/5 caben sin scroll. */
const BLOQUE: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: 8,
  background: 'var(--bg2)',
  minWidth: 0,
};
/* Compacto SOLO para los pasos 2 y 5 (los que pedía sin scroll): SVG a ~240px de alto. */
const BLOQUE_COMPACTO: CSSProperties = { ...BLOQUE, maxWidth: 620, margin: '0 auto' };
/* Fila de DOS esquemas lado a lado (el .gpair del HTML de referencia): auto-fit — 2 columnas
 * cuando caben (~840px+), 1 columna debajo. Responsive sin media queries. */
const GPAIR: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 14,
  alignItems: 'stretch',
};
const BTN_CHICO: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt)',
  borderRadius: 'var(--r)',
  padding: '3px 10px',
  fontSize: 11.5,
  cursor: 'pointer',
  fontFamily: 'var(--body)',
  whiteSpace: 'nowrap',
};

/** El paso activo de la guía: textos del HTML con los datos vivos del proyecto. */
export function PasoGuia({
  paso,
  ctx,
  irGo,
}: {
  paso: number;
  ctx: RciCtx;
  irGo: (go: string[]) => void;
}) {
  const { estado, R, tips } = ctx;
  const ro = R.roc;
  const rows = estado.pisos.rows;
  const n = rows.length;
  /** Pisos sin tipología (no se calcula red): una pasada, fuera de bucles (G8). */
  const sinR = rows.filter((_p, i) => !tips.tipOf[i]).length;
  const pais =
    estado.meta.pais && estado.meta.pais !== 'Internacional' && estado.meta.pais !== 'Otro'
      ? `de ${estado.meta.pais}`
      : 'local';

  /** chk(lab) del HTML replicado con Map construido UNA vez (primera verificación cuyo label
   *  empieza con el prefijo): sin búsquedas en bucles (G8). */
  const chkMap = useMemo(() => {
    const m = new Map<PrefijoChk, Verificacion>();
    for (const c of R.checks) {
      for (const p of PREFIJOS_CHK) {
        if (!m.has(p) && c.lab.startsWith(p)) m.set(p, c);
      }
    }
    return m;
  }, [R.checks]);
  const chk = (p: PrefijoChk): string => chkMap.get(p)?.st ?? 'PENDIENTE';

  /** Chip de red por tipología (el red() del HTML paso 6): Calculada / Sin red / Incompleta. */
  const chipRed = (g: Tipologia): ReactNode => {
    const t = R.edif.typ[g.id];
    if (!t) return <span style={{ color: 'var(--txt3)' }}>—</span>;
    const st = t.ok ? 'CUMPLE' : t.pend ? 'PENDIENTE' : 'NO CUMPLE';
    const lbl = t.ok ? 'Calculada' : t.pend ? 'Sin red' : 'Incompleta';
    return (
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          fontFamily: 'var(--mono)',
          padding: '1px 5px',
          borderRadius: 8,
          border: `1px solid ${COLOR_ESTADO[st]}`,
          color: COLOR_ESTADO[st],
          whiteSpace: 'nowrap',
        }}
      >
        {lbl}
      </span>
    );
  };

  switch (paso) {
    /* 1 · Clasifique el riesgo */
    case 0: {
      const tabla = (
        <div style={BLOQUE}>
          <div style={GCAP}>Criterios por riesgo · NFPA 13 (2025), Tabla 19.2.3.1.1 y cap. 10</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th scope="col">Riesgo</th>
                  <th scope="col">
                    Densidad
                    <br />
                    gpm/ft²
                  </th>
                  <th scope="col">
                    Área
                    <br />
                    ft²
                  </th>
                  <th scope="col">
                    Cobertura
                    <br />
                    máx. ft²
                  </th>
                  <th scope="col">
                    S, L máx.
                    <br />m
                  </th>
                  <th scope="col">
                    Mangueras
                    <br />
                    gpm
                  </th>
                  <th scope="col">
                    Duración
                    <br />
                    min
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS_HZ.map(([k, v]) => (
                  <tr
                    key={k}
                    style={
                      k === estado.clas.riesgo ? { background: 'rgba(240,69,69,0.10)' } : undefined
                    }
                  >
                    <td style={{ fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                      {etiquetaRiesgo(k)}
                    </td>
                    <td style={{ textAlign: 'center' }}>{fmt(v.d)}</td>
                    <td style={{ textAlign: 'center' }}>{v.a}</td>
                    <td style={{ textAlign: 'center' }}>
                      {v.cco !== v.cnc ? `${v.cnc} / ${v.cco} / 130` : String(v.cnc)}
                    </td>
                    <td style={{ textAlign: 'center' }}>{fmt(v.s, 1)}</td>
                    <td style={{ textAlign: 'center' }}>{v.hose}</td>
                    <td style={{ textAlign: 'center' }}>
                      {v.dmax !== v.dmin ? `${v.dmin}–${v.dmax}` : String(v.dmin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={GCAP}>
            Cobertura en riesgo leve según el techo: no combustible o sin obstrucción / combustible
            obstruido (elementos ≥ 0,91 m) / elementos a &lt; 0,91 m. NFPA 13-2025 eliminó las
            curvas densidad/área: se usa el punto único de la tabla.
          </p>
        </div>
      );
      return (
        /* Tabla a ancho completo (sin scroll horizontal); la explicación, debajo. */
        <div style={{ display: 'grid', gap: 12 }}>
          {tabla}
          <div>
            <p style={TXT}>
              La clasificación del riesgo (NFPA 13 cap. 4) define todo lo que sigue: cuánta agua por
              metro cuadrado, sobre qué área, cuánto puede cubrir cada rociador y cuánto pueden
              separarse. Hazla antes de dibujar un solo rociador.
            </p>
            <ul style={UL}>
              <li>
                El código {pais} define <b>si</b> el sistema es obligatorio (regístralo en Normativa
                local); NFPA 13 define <b>cómo</b> diseñarlo.
              </li>
              <li>
                Con almacenamiento hasta 3,66 m usa como mínimo riesgo ordinario G2; por encima,
                NFPA 13 cap. 20–25 (fuera del alcance).
              </li>
              <li>
                Respuesta rápida (QR): reduce el área solo en sistema húmedo, riesgo leve u
                ordinario y techo ≤ 6,1 m (20 ft); área mínima 768 ft².
              </li>
              <li>
                Sistema seco o techo con pendiente mayor que 2:12: área de diseño +30 % (cada uno).
              </li>
              <li>Presión mínima por rociador: 7 psi o la del listado.</li>
            </ul>
            <p style={TXT}>
              Tu proyecto: <b>{estado.clas.riesgo}</b> (fila resaltada), área de diseño{' '}
              {fmt(ro.Adis, 0)} ft² ({n2(ro.Adis * 0.092903)} m²).
            </p>
            <div style={GST}>
              <span>Riesgo frente a almacenamiento:</span>{' '}
              <ChipEstado st={chk('Riesgo NFPA 13 compatible')} />
              <span>Altura de arrume:</span> <ChipEstado st={chk('Altura de arrume')} />
            </div>
          </div>
        </div>
      );
    }
    /* 2 · Distribuye los rociadores */
    case 1:
      return (
        <>
          <div style={BLOQUE_COMPACTO}>
            <PlanSvg
              roc={ro}
              opts={{
                dims: true,
                feed: false,
                label: 'Separaciones entre rociadores, entre ramales y a muro',
              }}
            />
          </div>
          <p style={TXT}>
            Sobre el plano arquitectónico ubica los rociadores en una cuadrícula regular. La
            separación S va a lo largo del ramal; la separación L, entre ramales.
          </p>
          <ul style={UL}>
            <li>
              <b>S y L</b> entre 1,80 m y {n2(ro.hz.s)} m.
            </li>
            <li>
              <b>S × L</b> no mayor que {n2(ro.Acmax * 0.092903)} m² ({ro.Acmax} ft²). Con L ={' '}
              {n2(ro.L)} m, S puede llegar a{' '}
              {n2(Math.min(ro.hz.s, (ro.Acmax * 0.092903) / (ro.L || 1)))} m.
            </li>
            <li>
              <b>Distancia a muro</b> no mayor que {n2(ro.hz.s / 2)} m (la mitad de la separación
              máxima) ni menor que 0,10 m, <b>en las dos direcciones</b>: a lo largo del ramal y
              perpendicular a él.
            </li>
            <li>
              Usa la misma S y la misma L en toda el área: así el cálculo representa el plano.
            </li>
          </ul>
          <div style={GST}>
            <span>Tu proyecto: S = {n2(ro.S)} m</span>{' '}
            <ChipEstado st={chk('Separación entre rociadores')} />
            <span>L = {n2(ro.L)} m</span> <ChipEstado st={chk('Separación entre ramales')} />
            <span>S × L</span> <ChipEstado st={chk('Área por rociador')} />
            <span>Muro</span> <ChipEstado st={chk('Distancia a muro')} />
          </div>
        </>
      );
    /* 3 · Organice ramales y tramos */
    case 2:
      return (
        <>
          {/* Los DOS esquemas en UNA fila (.gpair del HTML): planta y corte lado a lado; si no
           * caben (modal angosto) el grid auto-fit baja uno debajo del otro. */}
          <div style={GPAIR}>
            <div style={BLOQUE}>
              <PlanSvg
                roc={ro}
                opts={{
                  labels: true,
                  nodes: true,
                  verCorte: true,
                  label:
                    'Ramales paralelos que entregan en tramos hasta la derivación del montante',
                }}
              />
            </div>
            {/* zNudoRaiz/Nramales sin dato aquí: CorteSvg usa sus defaults internos. */}
            <div style={{ ...BLOQUE, display: 'flex', alignItems: 'center' }}>
              <CorteSvg roc={ro} mont={estado.mont} />
            </div>
          </div>
          <p style={TXT}>
            Los rociadores de una misma línea forman un <b>ramal</b>. Cada ramal entrega su agua en
            un <b>nudo</b>; los <b>tramos</b> son las tuberías que unen un nudo con el siguiente
            hasta la <b>derivación del montante</b> del piso. Ahí termina el cálculo del piso. El
            tramo que llega a la derivación sube desde ella hasta la cota de los ramales: su L es la
            longitud de planta más la <b>bajada</b>, con dos codos (abajo y arriba de la bajada), y
            en él van la válvula de control del piso, el detector de flujo y la conexión de prueba y
            drenaje, a altura accesible y del mismo diámetro del tramo (ver corte).
          </p>
          <ul style={UL}>
            <li>
              Traza los ramales paralelos al lado más largo del recinto: el área de diseño se alinea
              con ellos.
            </li>
            <li>
              Los nudos llevan letras desde la <b>A</b>, en lo más remoto, hasta la derivación del
              montante, que es la última letra.
            </li>
            <li>
              Un tramo <b>alimenta</b> a los ramales que se conectan en sus nudos, y un ramal puede
              alimentar a otro ramal. Si un ramal alimenta a otro a mitad de su longitud, el pedazo
              que lleva los dos caudales es un tramo.
            </li>
            <li>
              Prefiere ramales cortos y tramos que lleguen cerca del centro de gravedad de los
              rociadores: reduce presión y diámetros.
            </li>
          </ul>
        </>
      );
    /* 4 · Ubique el área de diseño */
    case 3:
      return (
        <>
          <div style={BLOQUE}>
            <PlanSvg
              roc={ro}
              opts={{ area: true, nodes: true, label: 'Área de diseño en el extremo más remoto' }}
            />
          </div>
          <p style={TXT}>
            El área de diseño es el grupo de rociadores que se supone abiertos al mismo tiempo. Es
            un rectángulo de <b>{n2(ro.Adis * 0.092903)} m²</b> con su lado largo de{' '}
            <b>{n2(ro.Llargo)} m</b> (1,2·√A) paralelo a los ramales, ubicado en la zona{' '}
            <b>hidráulicamente más desfavorable</b>: lejos del alimentador y de la VCP.
          </p>
          <ul style={UL}>
            <li>
              Rociadores por ramal dentro del área: {n2(ro.Llargo)} / {n2(ro.S)} →{' '}
              <b>{ro.Nramal}</b> (siempre hacia arriba).
            </li>
            <li>
              Rociadores en total: {fmt(ro.Adis, 0)} / {fmt(ro.Areal, 1)} ft² → <b>{ro.Nreq}</b>,
              repartidos en <b>{ro.Nramales}</b> ramales
              {ro.Nultimo < ro.Nramal
                ? `; el último lleva ${ro.Nultimo}, en el extremo remoto del ramal (igual que los demás)`
                : ''}
              .
            </li>
            <li>Los rociadores fuera del área (grises) no fluyen en el cálculo.</li>
          </ul>
        </>
      );
    /* 5 · Numera la ruta crítica */
    case 4:
      return (
        <>
          <div style={BLOQUE_COMPACTO}>
            <PlanSvg
              roc={ro}
              opts={{
                area: true,
                number: true,
                nodes: true,
                brazo: true,
                label: 'Numeración de rociadores y nudos',
              }}
            />
          </div>
          <p style={TXT}>
            Numera los rociadores que fluyen desde el <b>más remoto</b> (1) hacia la derivación,
            ramal por ramal: 1, 2, 3 en el primer ramal; 4, 5, 6 en el siguiente, y así hasta{' '}
            {ro.Nreq}. El último número debe ser igual a los rociadores que exige el área.
          </p>
          <ul style={UL}>
            <li>
              El rociador más remoto es el que exige más presión, no siempre el más lejano en
              planta. Para identificarlo compara, ramal por ramal, la longitud hasta la derivación,
              el diámetro, los accesorios y el desnivel: gana el recorrido con más pérdidas. Ponlo
              de primero en la tabla de Ramales (flechas ↑↓): los rociadores que fluyen se reparten
              desde el primer ramal. Si duda entre dos ubicaciones, prueba ambos órdenes y quédate
              con el que exija más presión en la derivación.
            </li>
            <li>
              Los nudos de conexión se nombran con letras desde la A (lo más remoto) hasta la
              derivación del montante, que lleva la última letra. La punta de cada ramal conserva la
              identificación del dibujo (la columna Inicio da su Roc N de cálculo); el revisor
              compara ramal por ramal los rociadores dibujados.
            </li>
            <li>
              El tramo entre el último rociador que fluye y su conexión es uno solo (el <b>brazo</b>
              ): sus tees son de paso y no se cuentan; sí cuentan los codos y la tee donde entrega.
            </li>
          </ul>
        </>
      );
    /* 6 · Clasifique los pisos */
    case 5:
      return (
        /* Alzado arriba (ancho completo) y la tabla de tipologías debajo, sin scroll. */
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={BLOQUE_COMPACTO}>
            <ElevSvg pisos={rows} groups={tips} zBomba={estado.pisos.zBomba} compact={n > 8} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={GST}>
              {n ? (
                <span>
                  <b>
                    {n} pisos · {tips.groups.length} tipología(s)
                  </b>{' '}
                  = {tips.groups.length} red(es) por dibujar y calcular.
                </span>
              ) : (
                <span>
                  <b>Aún no hay pisos registrados.</b> Para una sola planta basta con un piso.
                </span>
              )}
            </div>
            {n ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th scope="col">Tipología</th>
                      <th scope="col">Pisos</th>
                      <th scope="col">N.º</th>
                      <th scope="col">Representativo ★</th>
                      <th scope="col">Planta</th>
                      <th scope="col">Red</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tips.groups.map((g) => {
                      const rep = rows[g.rep];
                      return (
                        <tr key={g.id}>
                          <td>
                            <span
                              style={{
                                background: colorTip(g.id),
                                color: '#fff',
                                borderRadius: 4,
                                padding: '1px 7px',
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: 'var(--mono)',
                              }}
                            >
                              {g.id}
                            </span>
                          </td>
                          <td style={{ color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                            {rangoTipologia(g, rows)}
                          </td>
                          <td style={{ textAlign: 'center' }}>{g.pisos.length}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {rep ? `${rep.nombre} · ${fmt(num(rep.npt))} m` : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{g.planta || '—'}</td>
                          <td>{chipRed(g)}</td>
                        </tr>
                      );
                    })}
                    {sinR ? (
                      <tr>
                        <td>
                          <span
                            style={{
                              background: 'var(--bg3)',
                              color: 'var(--txt)',
                              borderRadius: 4,
                              padding: '1px 7px',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            —
                          </span>
                        </td>
                        <td>Sin rociadores</td>
                        <td style={{ textAlign: 'center' }}>{sinR}</td>
                        <td style={{ color: 'var(--txt3)' }}>No se calcula red</td>
                        <td />
                        <td />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p style={TXT}>
              En un edificio no se calcula cada piso: se agrupan los pisos cuya red de rociadores se
              calcula igual. Cada grupo es una <b>tipología</b>; se dibuja y se calcula una red por
              tipología, en su piso representativo ★ (por defecto el más alto, que recibe menos
              presión).
            </p>
            <ul style={UL}>
              <li>
                Cambian la tipología: riesgo, sistema húmedo o seco, altura del techo, QR,
                construcción y pendiente del techo, espacios ocultos, K, S × L y la planta
                arquitectónica (distribución de rociadores y tuberías).
              </li>
              <li>
                La cota <b>no</b> cambia la tipología: la diferencia de altura entre pisos la
                resuelve el perfil de presiones.
              </li>
              <li>
                Pisos sin rociadores (cubiertas, cuartos técnicos) se registran igual: cuentan para
                el montante y el perfil.
              </li>
              {n > 8 ? (
                <li>
                  En el corte, los pisos consecutivos de la misma tipología se agrupan en una franja
                  (sin escala); el representativo se muestra aparte. Los puntos rojos son salidas
                  del montante.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      );
    /* 7 · ¿Listo para dibujar? */
    case 6: {
      const items: [string, PrefijoChk, string[]][] = [
        [
          'Riesgo clasificado y compatible con el uso',
          'Riesgo NFPA 13 compatible',
          ['entradas', 'clas.riesgo'],
        ],
        [
          'Altura de arrume definida (si hay almacenamiento)',
          'Altura de arrume',
          ['entradas', 'clas.arrumeH'],
        ],
        ['Separación S dentro de límites', 'Separación entre rociadores', ['tipologias', 'pisos']],
        ['Separación L dentro de límites', 'Separación entre ramales', ['tipologias', 'pisos']],
        ['Área por rociador ≤ cobertura máxima', 'Área por rociador', ['tipologias', 'pisos']],
        ['Distancia a muro dentro de límites', 'Distancia a muro', ['tipologias', 'pisos']],
      ];
      const listo = items.every((it) => chk(it[1]) === 'CUMPLE');
      return (
        <>
          <p style={TXT}>
            Antes de pasar al módulo de dibujo, los criterios de rociadores deben cumplir. Así el
            trazo se hace una sola vez.
          </p>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              {items.map(([t, pre, go]) => (
                <tr key={pre}>
                  <th
                    scope="row"
                    style={{
                      textAlign: 'left',
                      textTransform: 'none',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--txt)',
                      whiteSpace: 'normal',
                    }}
                  >
                    {t}
                  </th>
                  <td style={{ textAlign: 'center' }}>
                    <ChipEstado st={chk(pre)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {chk(pre) === 'CUMPLE' ? null : (
                      <button
                        type="button"
                        style={BTN_CHICO}
                        onClick={() => irGo(chkMap.get(pre)?.go ?? go)}
                      >
                        Corregir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={GST}>
            {listo ? (
              <span>
                <b>Todo listo.</b> Ten a mano el PDF del plano con la distribución de rociadores.
              </span>
            ) : (
              <span>
                <b>Resuelve los puntos pendientes antes de dibujar.</b> Puedes abrir el módulo
                igualmente, pero tendrás que volver a ajustar el trazo.
              </span>
            )}
          </div>
          {/* El botón "Pasar al módulo de dibujo" del HTML (data-gplano) no existe en este módulo. */}
        </>
      );
    }
    /* 8 · Captura la red en el plano */
    case 7:
      return (
        <>
          <div style={BLOQUE_COMPACTO}>
            <PlanSvg
              roc={ro}
              opts={{ order: true, nodes: true, label: 'Orden de trazado en el módulo de dibujo' }}
            />
          </div>
          <p style={TXT}>
            En el módulo de dibujo (PLANO), sobre el PDF de cada piso, traza la red{' '}
            <b>desde lo más remoto hacia el montante</b>. Ramales, tramos, pisos y accesorios pasan
            solos a las tablas de RCI.
          </p>
          <ol style={{ ...UL, margin: '4px 0 8px' }}>
            <li style={{ marginBottom: 2 }}>
              <b>Calibra el plano.</b> Origen y ejes X/Y; comprueba con una cota conocida (por
              ejemplo, S = {n2(ro.S)} m).
            </li>
            <li>
              <b>Traza los ramales</b> desde la punta hacia su nudo (el orden de cálculo se ajusta
              en RCI).
            </li>
            <li>
              <b>Traza los tramos</b> de nudo a nudo hacia el montante (T1 es el más remoto); PLANO
              pone las letras desde la A y revisa el sentido del flujo en cada nudo.
            </li>
            <li>
              <b>Cierra en el montante.</b> Márcalo como extremo del último tramo; PLANO suma la
              bajada y dos codos.
            </li>
            <li>
              <b>Coloca los rociadores</b> sobre los ramales.
            </li>
            <li>
              <b>Asigna diámetro y material</b>, o deja «Auto» para que se elija por velocidad.
            </li>
          </ol>
          <p style={TXT}>
            <b>En RCI.</b> Lo que viene del dibujo (nombres, nudos, rociadores dibujados,
            longitudes, cotas, codos y tees) aparece en gris con candado y se corrige en PLANO.
          </p>
          {/* El botón "Abrir el módulo de dibujo" del HTML (data-gplano) no existe en este módulo. */}
        </>
      );
    /* 9 · Revisa el cálculo y las verificaciones */
    default:
      return (
        <>
          <p style={TXT}>
            Con la red capturada, el resto del cálculo es automático. Revisa en este orden:
          </p>
          <ol style={UL}>
            <li>
              <b>Hidráulica.</b> Que fluyan los {ro.Nreq} rociadores, que ningún tramo tenga
              velocidad alta y que ningún nudo quede con presión baja.
            </li>
            <li>
              <b>Gabinetes.</b> Solo si el código local exige montantes. Su demanda suele gobernar
              la bomba.
            </li>
            <li>
              <b>Bomba y tanque.</b> Demandas sobre la curva, succión positiva, NPSH y presión
              máxima del sistema.
            </li>
            <li>
              <b>Verificaciones.</b> Resuelve cada "No cumple" con "Ir al dato" hasta que el diseño
              quede verificado.
            </li>
          </ol>
          <p style={TXT}>
            <b>Criterios a tener presentes</b>
          </p>
          <ul style={UL}>
            <li>
              <b>Componentes.</b> Presión de trabajo estándar 175 psi; donde la estática la supera,
              VRP en la derivación del piso (columna «VRP» de Tipologías) o componentes de mayor
              presión.
            </li>
            <li>
              <b>Salidas de manguera.</b> Válvula reguladora si la residual de 1½" supera 100 psi o
              la estática supera 175 psi (columna «V. reg.» de Tipologías).
            </li>
            <li>
              <b>Montantes.</b> Clase I y III, 100 psi en la salida más remota con 250 gpm en cada
              una de las dos salidas más altas; Clase II, 65 psi y 100 gpm.
            </li>
            <li>
              <b>Bomba.</b> Succión positiva en bomba horizontal; cierre ≤ 140 % de la presión
              nominal; ≥ 65 % de la presión al 150 % del caudal; velocidad en succión ≤ 4,57 m/s.
            </li>
            <li>
              <b>Jockey.</b> Caudal menor que el de un rociador; la bomba principal arranca por
              debajo del arranque de la jockey.
            </li>
          </ul>
          <div style={GST}>
            <span>
              Estado actual: <b>{R.count['CUMPLE'] || 0}</b> cumplen,{' '}
              <b>{R.count['NO CUMPLE'] || 0}</b> no cumplen, <b>{R.count['REVISAR'] || 0}</b> por
              revisar, <b>{R.count['PENDIENTE'] || 0}</b> pendientes.
            </span>
          </div>
        </>
      );
  }
}
