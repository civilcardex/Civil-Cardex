/** Pestaña Tipologías del diseño RCI (Red Contra Incendio) en 3 sub-pestañas verticales, cada
 *  una su bloque titulado (SecRci): "Pisos del edificio" (ancla rci-tipologias del «Ir al
 *  dato»; tabla gris = nombre y NPT (Nivel de Piso Terminado, del PLANO) / amarillo = editable,
 *  EDITAR en el header), "Tipologías" (+ bloque "Avisos" cuando hay tipologías sin red) y
 *  "Corte esquemático" (pisos apilados por NPT con montante y bomba). Los defaults ya NO se
 *  editan aquí: clas.qr y roc.* viven en Rociadores → "Datos del rociador". Ej: marcar P3 con
 *  «★ aquí» calcula la red de T1 sobre el NPT de P3. */
import { type CSSProperties } from 'react';
import {
  AvisosRci,
  SecRci,
  SubTabsRci,
  useNavRci,
  type RciCtx,
  type SubItemRci,
} from './RCIUI.tsx';
import { filasTipologias, resumenTipologias } from '../../utils/rci/RCIRowsModel.ts';
import { ElevSvg } from './RCISvgBuilding.tsx';
import { TablaPisos } from './RciFloorsTable.tsx';
import { TablaTipologias } from './RciTypologiesTable.tsx';
import type { NumIn, PisoRow, Tips } from '../../lib/rci/types.ts';

/** Sub-pestañas de la pestaña Tipologías (ids alineados con SUBS_POR_TAB['pisos']/RUTA_DE, que
 *  manda los «Ir al dato» de pisos a la sub 'pisos'). Ej: setSub('corte') muestra el ElevSvg. */
const SUBS: SubItemRci[] = [
  { id: 'pisos', titulo: 'Pisos del edificio' },
  { id: 'tipos', titulo: 'Tipologías y avisos' },
  { id: 'corte', titulo: 'Corte esquemático' },
];
/** Item de leyenda del corte (patrón .legend del HTML). */
const LEG_ITEM: CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  fontSize: 11,
  color: 'var(--txt2)',
};
/** Bloque "Corte esquemático": el corte del edificio por tipologías (ElevSvg ya portado) con la
 *  leyenda corta del HTML. Ej: <ElevSvg pisos rows zBomba /> apila P1..P3 por NPT y marca B. */
function CorteEdificio({ pisos, tips, zBomba }: { pisos: PisoRow[]; tips: Tips; zBomba: NumIn }) {
  return (
    <SecRci id="corte" titulo="Corte esquemático" icono="/iconos/corte_esquematico.webp">
      {/* Bloque angosto y centrado: el SVG escala solo (viewBox) — sin scroll vertical. */}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <ElevSvg pisos={pisos} groups={tips} zBomba={zBomba} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={LEG_ITEM}>
            <i
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 5,
                background: '#fff',
                border: '2.5px solid var(--rci, #f87171)',
                boxSizing: 'border-box',
              }}
            />
            Salida del montante: conexión 2½" (bomberos) o gabinete con manguera 1½"
          </span>
          <span style={LEG_ITEM}>
            <i
              style={{
                display: 'inline-block',
                width: 16,
                height: 0,
                borderTop: '3px solid var(--rci, #f87171)',
              }}
            />
            Montante
          </span>
          <span style={LEG_ITEM}>★ Piso representativo (color intenso)</span>
          <span style={LEG_ITEM}>B Eje de la bomba</span>
        </div>
      </div>
    </SecRci>
  );
}

/** Pestaña Tipologías del diseño RCI. Ej: <RciTipologias ctx={ctx} /> dentro de RciDesign. */
export function RciTipologias({ ctx }: { ctx: RciCtx }) {
  const { estado, tips, R, editar } = ctx;
  /* La sub abierta vive en la nav del shell (RciDesign): irA conmuta pestaña+sub y recuerda. */
  const nav = useNavRci();
  const { irA } = nav;
  const activa = nav.sub ?? SUBS[0].id;
  const filas = filasTipologias(estado, tips);
  const resumen = resumenTipologias(tips, R.edif);
  /** Avisos del bloque homónimo: tipologías cuyo planta no tiene red calculada. */
  const avisosSinRed = resumen
    .filter((t) => !t.conRed)
    .map(
      (t) =>
        `${t.id} (${t.pisos}) sin red calculada: revise que su planta (${t.planta}) tenga trazos rci con montante conectado.`,
    );

  const setPiso = (i: number, k: keyof PisoRow) => (v: string) =>
    editar((e) => ({
      ...e,
      pisos: {
        ...e.pisos,
        rows: e.pisos.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)),
      },
    }));
  const setRep = (tipId: string, nombre: string) =>
    editar((e) => ({ ...e, pisos: { ...e.pisos, rep: { ...e.pisos.rep, [tipId]: nombre } } }));

  return (
    <SubTabsRci subs={SUBS} sub={activa} setSub={(id) => irA('tipologias', id)}>
      {activa === 'pisos' ? (
        <TablaPisos
          filas={filas}
          nota={`${filas.length} piso(s) · ${resumen.length} tipología(s)`}
          grupos={tips.groups.map((g) => g.id)}
          setPiso={setPiso}
        />
      ) : null}
      {activa === 'tipos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TablaTipologias
            grupos={tips.groups}
            rows={estado.pisos.rows}
            typ={R.edif.typ}
            onRep={setRep}
          />
          {/* Avisos: solo cuando hay tipologías sin red (sin aviso no hay bloque vacío). */}
          {avisosSinRed.length ? (
            <SecRci id="avisos" titulo="Avisos" nota="tipologías sin red">
              <AvisosRci avisos={avisosSinRed} />
            </SecRci>
          ) : null}
        </div>
      ) : null}
      {activa === 'corte' ? (
        <CorteEdificio pisos={estado.pisos.rows} tips={tips} zBomba={estado.pisos.zBomba} />
      ) : null}
    </SubTabsRci>
  );
}

export default RciTipologias;
