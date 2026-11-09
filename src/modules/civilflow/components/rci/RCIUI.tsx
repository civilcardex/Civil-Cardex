/** Átomos de UI del diseño RCI (Red Contra Incendio): la sección-card con ancla para "Ir al
 *  dato", el campo con su candado de gris y la tabla de resultados etiqueta/valor. Ej: los
 *  campos del dibujo se pintan con 🔒 y fondo gris (no editables), los amarillos con input.
 *  Además el shell de navegación: TabBarRci (pestañas horizontales), SubTabsRci (nav vertical
 *  de sub-pestañas, patrón .entr del HTML) y el contexto de navegación que usan «Ir al dato»
 *  y los botones «Ir a» de la guía para saltar a (pestaña, sub-pestaña, campo). */
import React, { createContext, useContext, useState } from 'react';
import type { RciResult, RciState, Tips } from '../../lib/rci/types.ts';
import type { KvRci } from '../../utils/rci/RCIRowsModel.ts';

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

/** Ids de las pestañas principales, el orden del HTML de referencia. */
export const TABS_RCI = [
  { id: 'entradas', lbl: 'Entradas' },
  { id: 'rociadores', lbl: 'Rociadores' },
  { id: 'tipologias', lbl: 'Tipologías' },
  { id: 'hidraulica', lbl: 'Hidráulica' },
  { id: 'gabinetes', lbl: 'Gabinetes' },
  { id: 'perfil', lbl: 'Perfil de presiones' },
  { id: 'bomba', lbl: 'Bomba y tanque' },
  { id: 'sismo', lbl: 'Soportes sísmicos' },
  { id: 'accesorios', lbl: 'Resumen de accesorios por diámetro' },
  { id: 'verificaciones', lbl: 'Verificaciones' },
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
 *  otras redes (PageNav de gas/af: borde, activo con acento). Ej: clic en «Hidráulica». */
export function TabBarRci({
  tab,
  setTab,
  noCumplen,
}: {
  tab: TabRci;
  setTab: (t: TabRci) => void;
  noCumplen: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        flexShrink: 0,
        justifyContent: 'center',
        padding: '6px 0',
      }}
    >
      {TABS_RCI.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
          style={{
            padding: '6px 16px',
            border: `1.5px solid ${tab === t.id ? 'var(--rci)' : 'var(--line)'}`,
            borderRadius: 'var(--r)',
            background: tab === t.id ? 'rgba(179,19,27,0.10)' : 'var(--bg3)',
            color: tab === t.id ? 'var(--rci)' : 'var(--txt2)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--body)',
            fontWeight: tab === t.id ? 700 : 500,
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
      ))}
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
  ancho = 210,
}: {
  subs: readonly SubItemRci[];
  sub: string | null;
  setSub: (s: string) => void;
  children: React.ReactNode;
  ancho?: number;
}) {
  const visibles = subs.filter((s) => !s.oculto);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${ancho}px minmax(0, 1fr)`,
        gap: 14,
        alignItems: 'start',
      }}
    >
      <nav style={{ position: 'sticky', top: 8 }}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visibles.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => setSub(s.id)}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  background: 'none',
                  padding: '5px 10px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  color: sub === s.id ? 'var(--txt)' : 'var(--txt2)',
                  fontWeight: sub === s.id ? 600 : 400,
                  borderLeft: `3px solid ${sub === s.id ? 'var(--rci)' : 'transparent'}`,
                }}
              >
                <span style={{ fontWeight: 700, minWidth: 14, color: 'var(--txt3)', fontSize: 11 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>{s.titulo}</span>
              </button>
            </li>
          ))}
        </ol>
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
export function TagRci({ tag }: { tag?: string }) {
  if (!tag) return null;
  return (
    <span
      title={TAGDEF_RCI[tag]}
      style={{
        fontSize: 9,
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
  nota?: string;
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
            <img src={icono} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          ) : null}
          {titulo}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {extra}
          {nota ? <span className="card-s">{nota}</span> : null}
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
 *  fontSize uniforme con el estándar de GrupoTabla (14; la nota queda en 13.5). */
export function KvTabla({
  filas,
  fontSize = 14,
  titulos = false,
}: {
  filas: KvRci[];
  fontSize?: number;
  titulos?: boolean;
}) {
  return (
    <table className="tbl" style={{ fontSize, width: '100%', borderCollapse: 'collapse' }}>
      {titulos ? (
        <thead>
          <tr>
            <th
              style={{
                fontSize: 12,
                padding: '3px 6px',
                textAlign: 'center',
                color: 'var(--txt3)',
                fontWeight: 600,
              }}
              title="Criterio de la tipología activa calculado por NFPA 13 (2025): área, rociadores exigidos, rectángulo de fuego, caudales y duración"
            >
              Concepto
            </th>
            <th
              style={{
                fontSize: 12,
                padding: '3px 6px',
                textAlign: 'center',
                color: 'var(--txt3)',
                fontWeight: 600,
              }}
              title="Resultado del cálculo para tu proyecto (unidades en la celda: ft², m, gpm, psi, min)"
            >
              Valor
            </th>
            <th
              style={{
                fontSize: 12,
                padding: '3px 6px',
                textAlign: 'center',
                color: 'var(--txt3)',
                fontWeight: 600,
              }}
              title="De dónde sale el valor: tabla de NFPA 13, datos de tu red dibujada o margen adoptado — gris = calculado, no editable"
            >
              Detalle
            </th>
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
              {k.u ? <span style={{ color: 'var(--txt3)', fontWeight: 400 }}> {k.u}</span> : null}
            </td>
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
