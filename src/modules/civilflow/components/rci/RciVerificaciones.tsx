/** Pestaña "Verificaciones" del diseño RCI (Red Contra Incendio): la franja de proporciones
 *  encima (ancla rci-generales del fallback de «Ir al dato») y los checks normativos del
 *  compute en 3 sub-pestañas, cada una su bloque titulado (SecRci) — Con observaciones (las que
 *  no cumplen, o el verde de "las N cumplen"), Todas y Grupos (un bloque por categoría) — con
 *  el botón «Ir al dato» que salta por la nav (RUTA_DE → pestaña + sub + campo exacto).
 *  Ej: el ejemplo cierra con las 44 en CUMPLE y la sub de observaciones toda verde. */
import {
  SecRci,
  ChipEstado,
  COLOR_ESTADO,
  SubTabsRci,
  useNavRci,
  type RciCtx,
  type SubItemRci,
  type TabRci,
} from './uiRci.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { filasVerificaciones, GRUPOS_CHECK, grupoDeCheck } from '../../utils/rci/rowsModel.ts';
import { RUTA_DE } from '../../utils/rci/rowsModelExtras.ts';
import type { Verificacion } from '../../lib/rci/types.ts';

const TH10 = { ...TH, fontSize: 11 } as const;
const TDC = { ...TD, fontSize: 13, padding: '2px 4px', textAlign: 'left' } as const;

/** Etiqueta de cada grupo (índice fijo: el render no busca). */
const LBL_GRUPO = new Map(GRUPOS_CHECK.map((g) => [g.id, g.l]));

/** «Ir al dato» reescrito: RUTA_DE convierte el "go" del motor en (pestaña, sub, campo) y el
 *  saltador de la nav (montado por RciDesign) conmuta pestaña+sub y enfoca el campo.
 *  Fallback: si el "go" no trajo campo exacto, scroll a la sección del grupo y foco al
 *  data-campo si está en pantalla (camino viejo, patrón de las secciones con ancla). */
function irAlDato(v: Verificacion, irA: (tab: TabRci, sub?: string, campo?: string) => void): void {
  const r = RUTA_DE(v.go || []);
  irA(r.tab as TabRci, r.sub, r.campo);
  if (r.campo) return;
  const go1 = v.go?.[1] || '';
  const campo =
    go1 && !go1.startsWith('piso:')
      ? document.querySelector<HTMLElement>(`[data-campo="${go1}"]`)
      : null;
  const seccion = document.getElementById(`rci-${grupoDeCheck(v)}`);
  (campo || seccion)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  campo?.focus({ preventScroll: true });
}

/** La tabla de verificaciones (la misma de siempre): #, verificación, estado, valor, norma,
 *  cómo resolverlo e «Ir al dato». `filas` trae la verificación y su número original (el # de
 *  la lista completa, estable entre sub-pestañas). */
function TablaChecks({ filas }: { filas: { v: Verificacion; i: number }[] }) {
  const { irA } = useNavRci();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...TH10, width: 30 }}>
              #
            </th>
            <th scope="col" style={{ ...TH10, width: 84 }}>
              Estado
            </th>
            <th scope="col" style={TH10}>
              Verificación
            </th>
            <th scope="col" style={{ ...TH10, width: 170 }}>
              Valor
            </th>
            <th scope="col" style={{ ...TH10, width: 150 }}>
              Norma
            </th>
            <th scope="col" style={TH10}>
              Cómo resolverlo
            </th>
            <th scope="col" style={{ ...TH10, width: 74 }} aria-label="Ir al dato" />
          </tr>
        </thead>
        <tbody>
          {filas.map(({ v, i }) => (
            <tr key={`${i}-${v.lab}`}>
              <td className="c" style={{ ...TDC, textAlign: 'center', color: 'var(--txt3)' }}>
                {i + 1}
              </td>
              <td className="c" style={TDC}>
                <ChipEstado st={v.st} />
              </td>
              <td style={{ ...TDC, color: 'var(--txt)' }}>{v.lab}</td>
              <td style={{ ...TDC, fontFamily: 'var(--mono)' }}>{v.val || '—'}</td>
              <td style={{ ...TDC, color: 'var(--txt3)' }}>{v.nor}</td>
              <td style={{ ...TDC, color: v.st === 'CUMPLE' ? 'var(--txt3)' : 'var(--txt2)' }}>
                {v.guide || '—'}
              </td>
              <td style={TDC}>
                {v.go && v.go.length ? (
                  <button
                    type="button"
                    onClick={() => irAlDato(v, irA)}
                    style={{
                      fontSize: 11,
                      padding: '1px 5px',
                      cursor: 'pointer',
                      border: '1px solid var(--line)',
                      borderRadius: 3,
                      background: 'transparent',
                      color: 'var(--txt2)',
                    }}
                  >
                    Ir al dato
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pestaña Verificaciones del diseño RCI. Ej: <RciVerificaciones ctx={ctx} /> dentro de RciDesign. */
export function RciVerificaciones({ ctx }: { ctx: RciCtx }) {
  const { R } = ctx;
  const { tab: navTab, sub: navSub, irA } = useNavRci();

  /** Conteo por estado (una pasada) para la franja de proporciones. */
  const conteo: Record<string, number> = {};
  for (const v of R.checks) conteo[v.st] = (conteo[v.st] || 0) + 1;
  const total = R.checks.length || 1;
  const ordenEstados = ['CUMPLE', 'REVISAR', 'NO CUMPLE', 'PENDIENTE'];

  /** # original de cada verificación (Map por identidad: las filas vienen agrupadas). */
  const posDe = new Map<Verificacion, number>();
  R.checks.forEach((v, i) => posDe.set(v, i));

  const obs = R.checks.map((v, i) => ({ v, i })).filter((x) => x.v.st !== 'CUMPLE');
  const grupos = filasVerificaciones(R.checks);

  const subs: SubItemRci[] = [
    { id: 'observaciones', titulo: 'Con observaciones' },
    { id: 'todas', titulo: 'Todas' },
    { id: 'grupos', titulo: 'Grupos' },
  ];

  /* La sub abierta vive en la nav (fuente única): los saltos «Ir al dato» de otras pestañas
     y los clics propios pasan por irA('verificaciones', sub) — sin estado local que
     sincronizar. El default de RUTA_DE aterriza en 'todas'. */
  const activa =
    navTab === 'verificaciones' && navSub && subs.some((s) => s.id === navSub)
      ? navSub
      : 'observaciones';
  const setSub = (s: string) => irA('verificaciones', s);

  return (
    <>
      {/* Franja de estado: proporción de cada estado sobre el total, con los conteos al lado.
          Lleva el ancla rci-generales: el destino del fallback «Ir al dato» (siempre visible). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          id="rci-generales"
          style={{
            flex: 1,
            display: 'flex',
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            scrollMarginTop: 64,
          }}
          role="img"
          aria-label="Proporción de verificaciones por estado"
        >
          {ordenEstados.map((st) =>
            conteo[st] ? (
              <div
                key={st}
                style={{ width: `${(conteo[st] / total) * 100}%`, background: COLOR_ESTADO[st] }}
              />
            ) : null,
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {ordenEstados.map((st) =>
            conteo[st] ? (
              <span
                key={st}
                style={{
                  fontSize: 10.5,
                  fontFamily: 'var(--mono)',
                  color: COLOR_ESTADO[st],
                  fontWeight: 700,
                }}
              >
                {conteo[st]} {st.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <SubTabsRci subs={subs} sub={activa} setSub={setSub}>
        {activa === 'observaciones' ? (
          obs.length ? (
            <SecRci
              id="obs"
              titulo="Con observaciones"
              nota={`${obs.length} de ${R.checks.length} checks`}
            >
              <TablaChecks filas={obs} />
            </SecRci>
          ) : (
            <p
              style={{
                margin: 0,
                padding: '10px 12px',
                fontSize: 12.5,
                color: 'var(--txt2)',
                background: 'rgba(93,187,131,.1)',
                border: '1px solid rgba(93,187,131,.35)',
                borderRadius: 6,
              }}
            >
              <ChipEstado st="CUMPLE" /> Las {R.checks.length} verificaciones cumplen. Para
              revisarlas una por una, abra «Todas» o el grupo que le interese.
            </p>
          )
        ) : activa === 'todas' ? (
          <SecRci id="todas" titulo="Todas" nota={`${R.checks.length} checks normativos`}>
            <TablaChecks filas={R.checks.map((v, i) => ({ v, i }))} />
          </SecRci>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map((g) => (
              <SecRci
                key={g.id}
                id={`grupo-${g.id}`}
                titulo={LBL_GRUPO.get(g.id) || g.id}
                nota={`${g.items.length} checks`}
              >
                <TablaChecks filas={g.items.map((v) => ({ v, i: posDe.get(v) ?? 0 }))} />
              </SecRci>
            ))}
          </div>
        )}
      </SubTabsRci>
    </>
  );
}

export default RciVerificaciones;
