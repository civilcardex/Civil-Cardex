/** Átomos de UI del diseño RCI (Red Contra Incendio): la sección-card con ancla para "Ir al
 *  dato", el campo con su candado de gris y la tabla de resultados etiqueta/valor. Ej: los
 *  campos del dibujo se pintan con 🔒 y fondo gris (no editables), los amarillos con input.
 *  Además el shell de navegación: TabBarRci (pestañas horizontales), SubTabsRci (nav vertical
 *  de sub-pestañas, patrón .entr del HTML) y el contexto de navegación que usan «Ir al dato»
 *  y los botones «Ir a» de la guía para saltar a (pestaña, sub-pestaña, campo). */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.ts';
import type { RciResult, RciState, Tips } from '../../lib/rci/types.ts';
import type { KvRci } from '../../utils/rci/RCIRowsModel.ts';
import TableScroll from '../shared/TableScroll.tsx';

/** Contexto que cada sección de RciDesign recibe: estado vivo, resultado del compute y el
 *  editor de amarillos (merge → recompute → debounced save los hace RciDesign). */
export interface RciCtx {
  estado: RciState;
  /** Resultado de compute(estado, clasificar(estado)) — la verdad de los resultados. */
  R: RciResult;
  tips: Tips;
  /** Modo edición global (botón EDITAR de la barra superior). */
  edit: boolean;
  /** Aplica un cambio amarillo al estado (inmutable). */
  editar: (fn: (e: RciState) => RciState) => void;
  /** Cambia la tipología activa Y el piso del visor al representativo de esa tipología, para
   *  que los dos desplegables («Piso activo» y «T2 · Piso 2») siempre coincidan. */
  seleccionarTipologia?: (id: string) => void;
  /** Rectángulo de fuego DEFINIDO en el dibujo del piso activo (área marcada esRectFuego):
   *  polígono y rociadores en metros. Presente solo si el usuario lo marcó y hay piso activo —
   *  la pestaña Rociadores prefiere esta info a la teórica. */
  rectFuego?: {
    ptsM: number[][];
    areaM2: number;
    /** Posiciones (m) de todos los rociadores sembrados/dibujados de los ramales rci. */
    rocPts: number[][];
    /** Ids de ramales rci con al menos un rociador dentro del rectángulo. */
    ramalesDentro: string[];
    /** Polilíneas (m) de los ramales rci del piso — para pintarlos en el esquema del dibujo. */
    ramPtsM: number[][][];
  };
}

/* ---------- Edición por tabla (cada tabla editable con su propio EDITAR/LISTO) ---------- */

/** Hook del modo edición de UNA tabla: cada tabla gatea sus inputs con su propio flag, sin
 *  depender del EDITAR global de la barra superior. Ej: la tabla de C por material de RCI
 *  (Red Contra Incendio) se edita sola: const [edit, toggle] = useEditarTabla(). */
export function useEditarTabla(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  return [on, () => setOn((v) => !v)];
}

/** Botón EDITAR/LISTO de UNA tabla, arriba de ella: mismo lenguaje que EditButton (borde 1px,
 *  fontSize 10, peso 700) pero con el acento de RCI (var(--rci)) y neutral de alineación —
 *  cada call site lo coloca en su esquina (p. ej. wrapper con marginLeft:'auto' a la derecha).
 *  Ej: <div style={{ marginLeft: 'auto' }}><EditTablaBtn on={edit} onToggle={toggle} /></div>. */
export function EditTablaBtn({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  // Mismo color que EditButton de las demás redes (ped. usuario): acento var(--acc), no el
  // rojo rci.
  const base: React.CSSProperties = {
    border: '1px solid var(--acc)',
    borderRadius: 3,
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  };
  return (
    <button
      type="button"
      title="Activa la edición de solo esta tabla"
      onClick={onToggle}
      style={
        on
          ? { ...base, background: 'var(--acc)', color: '#fff' }
          : { ...base, background: 'transparent', color: 'var(--acc)' }
      }
    >
      {on ? 'LISTO' : 'EDITAR'}
    </button>
  );
}

/* ---------- Navegación (pestaña + sub-pestaña activas) ---------- */

/** Ids de las pestañas principales — orden alineado a v1.7.82: la Guía de diseño abre y
 *  «Rociadores» desaparece (QR/K/Pmin/S/L/DMR viven POR PISO en Tipologías; el grupo global
 *  roc queda como fallback interno del cálculo). «Resumen de accesorios por diámetro» cierra
 *  (el conteo de rociadores se verifica allí). */
export const TABS_RCI = [
  { id: 'guia', lbl: 'Guía de diseño' },
  { id: 'entradas', lbl: 'Entradas' },
  { id: 'tipologias', lbl: 'Tipologías' },
  { id: 'hidraulica', lbl: 'Hidráulica' },
  { id: 'gabinetes', lbl: 'Gabinetes' },
  { id: 'perfil', lbl: 'Perfil de presiones' },
  { id: 'bomba', lbl: 'Bomba y tanque' },
  { id: 'sismo', lbl: 'Soportes sísmicos' },
  { id: 'verificaciones', lbl: 'Verificaciones' },
  { id: 'accesorios', lbl: 'Resumen de accesorios por diámetro' },
] as const;
/** Id válido de pestaña del diseño (la unión de los ids de TABS_RCI). Ej: 'hidraulica'. */
export type TabRci = (typeof TABS_RCI)[number]['id'];

/** Contexto de navegación: pestaña/sub activas + el saltador que montan RciDesign y la guía.
 *  `irA` conmuta pestaña+sub y luego hace scroll+foco al campo (data-campo). */
export interface NavRci {
  tab: TabRci;
  sub: string | null;
  irA: (tab: TabRci, sub?: string, campo?: string) => void;
}
const NavCtx = createContext<NavRci>({ tab: 'entradas', sub: null, irA: () => {} });

/** Proveedor interno de RciDesign (los consumidores usan useNavRci). */
export function NavRciProvider({ nav, children }: { nav: NavRci; children: React.ReactNode }) {
  return <NavCtx.Provider value={nav}>{children}</NavCtx.Provider>;
}

/** Nav activa de la vista RCI. Ej: const { irA } = useNavRci(); irA('entradas','normativa','local.reqSismo'). */
export function useNavRci(): NavRci {
  return useContext(NavCtx);
}

/** Pestañas principales del diseño RCI, mismo estilo de botones-pill de las páginas de las
 *  otras redes (PageNav de gas/af: borde, activo con acento). Una sola FILA (ped. usuario
 *  2026-11-23, guía tabs): en pantallas angostas scrollean horizontal en vez de envolver a
 *  dos filas — el envuelve era lo que amontonaba los chips de verificaciones encima. Ej: clic en «Hidráulica». */
export function TabBarRci({
  tab,
  setTab,
  noCumplen,
}: {
  tab: TabRci;
  setTab: (t: TabRci) => void;
  noCumplen: number;
}) {
  /** Scroll del pill activo a la vista al cambiar (la fila scrollea en pantallas angostas). */
  const activoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // container:'nearest' frena el scroll de ancestros (la guía de tabs); el cast es porque
    // la lib de TS aún no tipa la propiedad (los navegadores la ignoran si no la soportan).
    activoRef.current?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
      container: 'nearest',
    } as ScrollIntoViewOptions);
  }, [tab]);
  return (
    /* El scroller exterior + el inner `width:max-content; margin:0 auto`: centrado cuando
     *  las pills caben y scrolleable cuando no (justify-content:center con overflow CLIPea
     *  el inicio — no se puede llegar a las primeras pestañas). Sin scrollbar visible:
     *  la franja de Windows se comería el alto ganado en portátil; las flechas/rueda y el
     *  auto-scroll del activo cubren el acceso a las pestañas ocultas. */
    <div
      style={{
        flexShrink: 0,
        overflowX: 'auto',
        padding: '6px 0',
        minWidth: 0,
        scrollbarWidth: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 'max-content',
          margin: '0 auto',
        }}
      >
        {TABS_RCI.map((t) => {
          // La guía abre el modal sin cambiar la pestaña activa.
          const esGuia = t.id === 'guia';
          const activa = !esGuia && tab === t.id;
          return (
            <button
              type="button"
              key={t.id}
              ref={activa ? activoRef : undefined}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              style={{
                flexShrink: 0,
                padding: '6px 16px',
                border: `1.5px solid ${esGuia ? 'color-mix(in srgb, var(--rci) 65%, var(--line))' : activa ? 'var(--rci)' : 'var(--line)'}`,
                borderRadius: 'var(--r)',
                background: esGuia
                  ? 'color-mix(in srgb, var(--rci) 12%, var(--bg3))'
                  : activa
                    ? 'rgba(179,19,27,0.10)'
                    : 'var(--bg3)',
                color: esGuia ? 'var(--txt)' : activa ? 'var(--rci)' : 'var(--txt2)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--body)',
                fontWeight: activa ? 700 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {t.lbl}
              {t.id === 'verificaciones' ? (
                <span
                  style={{
                    ...CHIP_CNT,
                    background: noCumplen > 0 ? 'var(--err)' : 'var(--succ)',
                  }}
                >
                  {noCumplen}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
const CHIP_CNT: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 16,
  padding: '0 5px',
  marginLeft: 6,
  borderRadius: 9,
  fontSize: 10,
  color: '#fff',
  textAlign: 'center',
};

/** Item de sub-pestaña vertical: id, título y si debe ocultarse (secciones vacías). */
export interface SubItemRci {
  id: string;
  titulo: string;
  oculto?: boolean;
}

/** Nav vertical de sub-pestañas + contenido al lado (patrón .entr del HTML): a la izquierda la
 *  lista (250px), a la derecha lo que se ve. Recuerda la sub abierta por pestaña quien la
 *  invoca (estado del shell). Ej: <SubTabsRci subs={SUBS_ENTRADAS} sub={sub} setSub={setSub}>…</SubTabsRci>. */
export function SubTabsRci({
  subs,
  sub,
  setSub,
  children,
}: {
  subs: readonly SubItemRci[];
  sub: string | null;
  setSub: (s: string) => void;
  children: React.ReactNode;
  ancho?: number;
}) {
  const visibles = subs.filter((s) => !s.oculto);
  /* Densidad por PANTALLA (H-06, ped. 2026-11-23 + 2026-11-17): compacta SOLO en ventanas
   *  bajas (portátil 14-15", ≤860 px de alto — ahí las 15 filas de Normativa caben sin
   *  scroll); en monitor se conserva la letra mayor del ped. 2026-11-17. */
  const portatil = useMediaQuery('(max-height: 860px)');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0, flex: 1 }}>
      {/* Sub-pestañas HORIZONTALES (ped. usuario): una fila de chips en la banda superior de
       *  la página — pegada ARRIBA (ped. 2026-11-17: «sube un poco»). */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg2)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: portatil ? '2px 2px 3px' : '2px 2px 4px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {visibles.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            aria-current={sub === s.id ? 'true' : undefined}
            style={{
              display: 'flex',
              gap: portatil ? 5 : 6,
              alignItems: 'center',
              border: 0,
              background: 'none',
              padding: portatil ? '3px 8px' : '4px 10px',
              borderRadius: 5,
              cursor: 'pointer',
              color: sub === s.id ? 'var(--txt)' : 'var(--txt2)',
              fontWeight: sub === s.id ? 600 : 400,
              borderBottom: `2px solid ${sub === s.id ? 'var(--rci)' : 'transparent'}`,
              fontSize: portatil ? 12.5 : 14,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: 'var(--txt3)',
                fontSize: portatil ? 10 : 11,
              }}
            >
              {i + 1}
            </span>
            <span>{s.titulo}</span>
          </button>
        ))}
      </nav>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Definición de un tag: qué fija cada naturaleza de dato (title del chip). */
const TAGDEF_RCI: Record<string, string> = {
  Norma: 'Lo fija la norma: se cumple',
  Rango: 'La norma fija límites; usted elige dentro de ellos',
  Fabricante: 'Dato del equipo listado (catálogo o placa)',
  Proyecto: 'Dato del edificio, del sitio o del plano',
  Criterio: 'Decisión del diseñador: justifíquela en la memoria',
};

/** Chip de naturaleza del dato (Norma/Rango/Fabricante/Proyecto/Criterio, TAGDEF del HTML). */
export function TagRci({ tag, fontSize = 9 }: { tag?: string; fontSize?: number }) {
  if (!tag) return null;
  return (
    <span
      title={TAGDEF_RCI[tag]}
      style={{
        fontSize,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        justifySelf: 'start',
        background:
          tag === 'Norma'
            ? 'rgba(240,69,69,0.12)'
            : tag === 'Rango'
              ? 'rgba(224,164,0,0.14)'
              : tag === 'Fabricante'
                ? 'var(--bg3)'
                : tag === 'Criterio'
                  ? 'rgba(93,187,131,0.14)'
                  : 'var(--bg3)',
        color:
          tag === 'Norma'
            ? 'var(--err)'
            : tag === 'Rango'
              ? '#E0A400'
              : tag === 'Criterio'
                ? 'var(--succ)'
                : 'var(--txt3)',
        border: tag === 'Proyecto' ? '1px solid var(--line)' : undefined,
      }}
    >
      {tag}
    </span>
  );
}

/** Strip "A garantizar en la derivación del piso": Q/P que exige la red al montante. */
export function StripRci({ q, p }: { q: number | null; p: number | null }) {
  if (q === null || p === null) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '2px 16px',
        alignItems: 'baseline',
        marginTop: 8,
        padding: '7px 16px',
        border: '1px solid var(--rci)',
        borderLeft: '5px solid var(--rci)',
        borderRadius: '0 8px 8px 0',
        background: 'var(--bg3)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>
        A garantizar en la derivación del piso
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--txt)',
          justifySelf: 'end',
          whiteSpace: 'nowrap',
        }}
      >
        {q.toFixed(1)}{' '}
        <span style={{ fontWeight: 400, color: 'var(--txt2)', fontSize: 14 }}>gpm</span> @{' '}
        {p.toFixed(1)}{' '}
        <span style={{ fontWeight: 400, color: 'var(--txt2)', fontSize: 14 }}>psi</span>
      </span>
    </div>
  );
}

/** Sección-card del diseño RCI con ancla `rci-<id>`: el destino de los botones «Ir al dato» de
 *  las verificaciones. `icono` (ruta pública, ej. '/iconos/siamesa.webp') queda a la IZQUIERDA
 *  del título, dentro del h3. Ej: <SecRci id="bomba" titulo="Bomba y tanque">. */
export function SecRci({
  id,
  titulo,
  nota,
  extra,
  icono,
  children,
}: {
  id: string;
  titulo: string;
  nota?: React.ReactNode;
  extra?: React.ReactNode;
  /** Ruta pública del icono decorativo (22×22, a la izquierda del título). */
  icono?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card" id={`rci-${id}`} style={{ scrollMarginTop: 64 }}>
      <div className="card-h" style={{ justifyContent: 'space-between' }}>
        <h3
          className="card-t"
          style={{ color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {icono ? (
            <img
              src={icono}
              alt=""
              loading="lazy"
              style={{ width: 22, height: 22, objectFit: 'contain' }}
            />
          ) : null}
          {titulo}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {nota ? <span className="card-s">{nota}</span> : null}
          {extra}
        </div>
      </div>
      <div style={{ padding: 8 }}>{children}</div>
    </section>
  );
}

/** Color de cada estado de verificación (los del repo: verde cumple, rojo no cumple). */
export const COLOR_ESTADO: Record<string, string> = {
  CUMPLE: 'var(--succ, #5DBB83)',
  'NO CUMPLE': 'var(--err, #F04545)',
  REVISAR: '#E0A400',
  PENDIENTE: 'var(--txt3)',
};

/** Chip del estado de una verificación. Ej: <ChipEstado st="CUMPLE" /> pinta CUMPLE en verde. */
export function ChipEstado({
  st,
  label,
  title,
}: {
  st: string;
  /** Texto mostrado (por defecto st) — para cuando el color y la palabra difieren. */
  label?: string;
  /** Tooltip opcional (p. ej. «Sin red: la planta no tiene trazos»). */
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--mono)',
        padding: '1px 5px',
        borderRadius: 8,
        border: `1px solid ${COLOR_ESTADO[st] || 'var(--line)'}`,
        color: COLOR_ESTADO[st] || 'var(--txt2)',
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? st}
    </span>
  );
}

/** Tabla de resultados etiqueta/valor/nota (kv). Ej: <KvTabla filas={kvBombaTanque(...)} />.
 *  Con `unidad` la unidad sale en SU columna (Parámetro · Valor · Unidad · Referencia, ped.
 *  2026-11-27) y «—» cuando la fila no tiene unidad; sin ella queda inline tras el valor.
 *  fontSize uniforme con el estándar de GrupoTabla (14; la nota queda en 13.5). */
export function KvTabla({
  filas,
  label,
  fontSize = 14,
  titulos = false,
  unidad = false,
  labels,
}: {
  filas: KvRci[];
  label: string;
  fontSize?: number;
  titulos?: boolean;
  unidad?: boolean;
  /** Etiquetas del encabezado (titulos). Ej: { l: 'Parámetro', v: 'Valor', u: 'Unidad', n: 'Referencia' }. */
  labels?: { l?: string; v?: string; u?: string; n?: string };
}) {
  const hdr = {
    l: labels?.l ?? 'Concepto',
    v: labels?.v ?? 'Valor',
    u: labels?.u ?? 'Unidad',
    n: labels?.n ?? 'Detalle',
  };
  const th = (t: string, title: string): React.ReactElement => (
    <th
      scope="col"
      style={{
        fontSize: 12,
        padding: '3px 6px',
        textAlign: 'center',
        color: 'var(--txt3)',
        fontWeight: 600,
      }}
      title={title}
    >
      {t}
    </th>
  );
  return (
    <TableScroll label={label}>
      <table className="tbl" style={{ fontSize, width: '100%', borderCollapse: 'collapse' }}>
        {titulos ? (
          <thead>
            <tr>
              {th(
                hdr.l,
                'Criterio de la tipología activa calculado por NFPA 13 (2025): área, rociadores exigidos, rectángulo de fuego, caudales y duración',
              )}
              {th(
                hdr.v,
                'Resultado del cálculo para tu proyecto (unidades en su columna: ft², m, gpm, psi, min)',
              )}
              {unidad ? th(hdr.u, 'Unidad del valor; «—» si la fila no lleva unidad') : null}
              {th(
                hdr.n,
                'De dónde sale el valor: tabla de NFPA 13, datos de tu red dibujada o margen adoptado — gris = calculado, no editable',
              )}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {filas.map((k) => (
            <tr key={k.l}>
              <td
                style={{
                  padding: '3px 6px',
                  borderBottom: '1px solid var(--line)',
                  color: 'var(--txt2)',
                  fontSize,
                  whiteSpace: 'nowrap',
                }}
                title={k.nota || undefined}
              >
                {k.l}
              </td>
              <td
                style={{
                  padding: '3px 6px',
                  borderBottom: '1px solid var(--line)',
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  color: 'var(--txt)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {k.v}
                {!unidad && k.u ? (
                  <span style={{ color: 'var(--txt3)', fontWeight: 400 }}> {k.u}</span>
                ) : null}
              </td>
              {unidad ? (
                <td
                  style={{
                    padding: '3px 6px',
                    borderBottom: '1px solid var(--line)',
                    color: 'var(--txt2)',
                    fontSize,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {k.u ?? '—'}
                </td>
              ) : null}
              <td
                style={{
                  padding: '3px 6px',
                  borderBottom: '1px solid var(--line)',
                  color: 'var(--txt3)',
                  fontSize: fontSize - 0.5,
                }}
              >
                {k.nota || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** Aviso de la extracción (piso sin montante conectado, ramal flotante…) o de huérfanos del
 *  merge: texto ámbar, nunca bloquea. Vive en la FILA de chips (Guía/pisos) como chip ámbar.
 *  Ej: <AvisosRci avisos={['P2: Tiene trazos rci pero ningún montante conectado…']} />. */
export function AvisosRci({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {avisos.map((a, i) => (
        <li
          key={i}
          title={a}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            border: '1px solid rgba(224,164,0,0.55)',
            borderRadius: 'var(--r, 6px)',
            background: 'rgba(224,164,0,0.12)',
            fontSize: 12,
            color: 'var(--txt)',
          }}
        >
          <span style={{ color: '#E0A400', fontWeight: 700 }}>⚠</span>
          {a}
        </li>
      ))}
    </ul>
  );
}
