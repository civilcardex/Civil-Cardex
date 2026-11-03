/** Sección 6 del diseño RCI (Red Contra Incendio): bomba principal (NFPA 20) y tanque (NFPA 22)
 *  en SOLO LECTURA — las dos sub-pestañas del HTML, cada bloque titulado (SecRci, el primero
 *  ancla rci-bomba del «Ir al dato», con su nota «gobierna X» y botón "Ver esquema" en el
 *  header): "Demanda, selección y succión" (Demandas, Selección, Cuarto, Succión y NPSH) y
 *  "Curva, jockey y tanque" (curva envolvente en canvas, Jockey, Tanque). Los campos EDITABLES
 *  (margen, succión, jockey, tanque) viven en Entradas → Bomba.
 *  Ej: el ejemplo muestra D2 de 500 gpm @ 127.36 psi en la brida y curva nominal a 141 psi. */
import { useEffect, useRef, useState } from 'react';
import { SecRci, KvTabla, SubTabsRci, useNavRci, type RciCtx, type SubItemRci } from './uiRci.tsx';
import type { KvRci } from '../../utils/rci/rowsModel.ts';
import {
  kvDemandas,
  kvSeleccion,
  kvCuarto,
  kvSuccion,
  kvJockey,
  kvTanque,
} from '../../utils/rci/rowsModelExtras.ts';
import { PumpSvg, dibujaCurvaBomba, temaResuelto } from './rciSvgEsquemas.tsx';
import type { BombaResult } from '../../lib/rci/types.ts';

/** Sub-pestañas de la pestaña Bomba (los ids de SUBS_POR_TAB['bomba'] que toca RUTA_DE: los
 *  «Ir al dato» de bomba caen en 'demanda'). Ej: setSub('jockey') muestra curva + jockey + tanque. */
const SUBS: SubItemRci[] = [
  { id: 'demanda', titulo: 'Demanda, selección y succión' },
  { id: 'jockey', titulo: 'Curva, jockey y tanque' },
];

/** Botón chico "Ver esquema" / "Ir al dato" (patrón .btn.small del HTML). */
const BTN_MIN: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 9px',
  cursor: 'pointer',
  border: '1px solid var(--line)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--txt2)',
  fontFamily: 'var(--body)',
};

/** Bloque de solo lectura (SecRci): título en el header, nota opcional, tabla kv y (si trae
 *  `esquema`) el botón "Ver esquema" a la derecha del header — abre el modal con el esquema del
 *  cuarto de bombas resaltando esa sección. `icono` va a la IZQUIERDA del título (SecRci).
 *  Ej: <CardKv id="bomba" titulo="Demandas en la brida de descarga" filas={kvDemandas(R.bomba)} esquema="desc" … />. */
function CardKv({
  id,
  titulo,
  nota,
  filas,
  esquema,
  abrirEsquema,
  icono,
}: {
  /** Ancla del bloque (SecRci antepone «rci-»); el primero de la pestaña lleva rci-bomba. */
  id: string;
  titulo: string;
  nota?: string;
  filas: KvRci[];
  esquema?: 'suc' | 'desc';
  abrirEsquema?: (m: 'suc' | 'desc') => void;
  /** Ruta pública del icono decorativo (ej. '/iconos/seleccion_bomba.webp'). */
  icono?: string;
}) {
  return (
    <div style={{ width: 'fit-content', maxWidth: '100%' }}>
      <SecRci
        id={id}
        titulo={titulo}
        nota={nota}
        icono={icono}
        extra={
          esquema && abrirEsquema ? (
            <button
              type="button"
              onClick={() => abrirEsquema(esquema)}
              style={{ ...BTN_MIN, whiteSpace: 'nowrap' }}
            >
              Ver esquema
            </button>
          ) : undefined
        }
      >
        <KvTabla filas={filas} />
      </SecRci>
    </div>
  );
}

/** Curva envolvente NFPA 20 sobre canvas (líneas 100 % / 150 % y puntos D1/D2 ya los dibuja
 *  dibujaCurvaBomba). Re-pinta al cambiar la bomba y al cambiar el ancho del contenedor.
 *  Ej: <CurvaBomba bomba={R.bomba} /> con 500 gpm @ 141 psi y churn a 169 psi. */
function CurvaBomba({ bomba }: { bomba: BombaResult }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const pintar = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || 640;
      const h = cv.clientHeight || 300;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujaCurvaBomba(g, w, h, bomba, temaResuelto());
    };
    pintar();
    const ro = new ResizeObserver(pintar);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [bomba]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Curva envolvente de la bomba y puntos de demanda D1 y D2"
      style={{ width: '100%', height: 300, display: 'block' }}
    />
  );
}

/** Punto de la leyenda bajo la curva: cuadrito de línea o punto de color + texto. */
const LEGEND: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  marginTop: 6,
  fontSize: 11,
  color: 'var(--txt2)',
};

/** Pestaña Bomba y tanque del diseño RCI. Ej: <RciBombaTanque ctx={ctx} /> dentro de RciDesign. */
export function RciBombaTanque({ ctx }: { ctx: RciCtx }) {
  const { estado, R } = ctx;
  const { tab: navTab, sub: navSub, irA } = useNavRci();
  const [esquema, setEsquema] = useState<'suc' | 'desc' | null>(null);

  /* La sub abierta vive en la nav (fuente única): los saltos «Ir al dato» y los clics propios
     pasan por irA('bomba', sub) — sin estado local que sincronizar. */
  const activa =
    navTab === 'bomba' && navSub && SUBS.some((s) => s.id === navSub) ? navSub : SUBS[0].id;
  const setSub = (s: string) => irA('bomba', s);

  // Escape cierra el modal del esquema (listener a nivel documento, patrón HelpPanel).
  useEffect(() => {
    if (!esquema) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setEsquema(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [esquema]);

  return (
    <>
      <SubTabsRci subs={SUBS} sub={activa} setSub={setSub}>
        {activa === 'demanda' ? (
          /* Dos columnas explícitas: Cuarto queda JUSTO debajo de Demandas y Succión debajo de
             Selección (con grid por filas, la fila 2 arrancaba tras la card más alta). */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, max-content)',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Ancla rci-bomba: destino del «Ir al dato» de las verificaciones de bomba. */}
              <CardKv
                id="bomba"
                titulo="Demandas en la brida de descarga"
                filas={kvDemandas(R.bomba)}
                esquema="desc"
                abrirEsquema={setEsquema}
              />
              <CardKv
                id="cuarto"
                titulo="Cuarto de bombas: descarga"
                filas={kvCuarto(R.edif, R.gab)}
                esquema="desc"
                abrirEsquema={setEsquema}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CardKv
                id="seleccion"
                titulo="Selección de la bomba"
                filas={kvSeleccion(R.bomba, R.edif, estado.bomba.qrManual, estado.bomba.margen)}
                esquema="desc"
                abrirEsquema={setEsquema}
                icono="/iconos/seleccion_bomba.webp"
              />
              <CardKv
                id="succion"
                titulo="Succión y NPSH"
                filas={kvSuccion(R.bomba, estado.bomba.npshr, estado.bomba.margenNpsh)}
                esquema="suc"
                abrirEsquema={setEsquema}
                icono="/iconos/succion_cavitacion.webp"
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SecRci id="curva" titulo="Curva envolvente y demandas">
              <CurvaBomba bomba={R.bomba} />
              <div style={LEGEND}>
                <span>
                  <i
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 0,
                      borderTop: '2px solid var(--txt)',
                      verticalAlign: 'middle',
                      marginRight: 5,
                    }}
                  />
                  Curva envolvente NFPA 20
                </span>
                <span>
                  <i
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--rci)',
                      verticalAlign: 'middle',
                      marginRight: 5,
                    }}
                  />
                  D1 rociadores + mangueras
                </span>
                <span>
                  <i
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--af)',
                      verticalAlign: 'middle',
                      marginRight: 5,
                    }}
                  />
                  D2 montantes
                </span>
              </div>
            </SecRci>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, max-content)',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <CardKv
                id="jockey"
                titulo="Bomba jockey"
                filas={kvJockey(R.bomba)}
                icono="/iconos/bomba_jockey.webp"
              />
              <CardKv
                id="tanque"
                titulo="Tanque"
                filas={kvTanque(R.bomba, R.tanque)}
                icono="/iconos/tanque.webp"
              />
            </div>
          </div>
        )}
      </SubTabsRci>

      {/* Modal liviano con el esquema del cuarto de bombas (resalta succión o descarga). */}
      {esquema ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEsquema(null);
          }}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.6)',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Esquema del cuarto de bombas"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              width: 'min(920px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 12px 30px rgba(0,0,0,.5)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: 'var(--txt)' }}>
                Esquema del cuarto de bombas
              </h3>
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
                {esquema === 'suc'
                  ? 'Resaltado: succión (datos de Succión y NPSH)'
                  : 'Resaltado: descarga (datos de las tablas de demanda)'}
              </span>
              <button
                type="button"
                onClick={() => setEsquema(null)}
                aria-label="Cerrar esquema"
                style={{ ...BTN_MIN, marginLeft: 'auto', fontSize: 13, padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>
            <PumpSvg modo={esquema} />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default RciBombaTanque;
