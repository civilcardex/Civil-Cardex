/** Pestaña Rociadores del diseño RCI (Red Contra Incendio) en 3 sub-pestañas verticales
 *  (patrón .entr del HTML de referencia): "Datos del rociador" (QR (respuesta rápida) y
 *  K/Pmin/S/L/Dmuro en GrupoTabla, EDITAR propio — siembran los pisos nuevos), "Criterios de
 *  diseño" (NFPA 13 (norma de rociadores), tarjeta de solo lectura del motor) y "Rectángulo de
 *  fuego" (canvas + tabla + leyenda). Los badges por sub vienen de las verificaciones vía
 *  RUTA_DE. Ej: con QR y techo de 5,30 m el área baja de 1500 a 1066 ft². */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { KvTabla, SubTabsRci, type RciCtx, type SubItemRci, useNavRci } from './RCIUI.tsx';
import { GrupoTabla, type DefCampo } from './RCIGroupTable.tsx';
import {
  SINO,
  kvRociadorDiseno,
  kvRociadorCobertura,
  type KvRci,
} from '../../utils/rci/RCIRowsModel.ts';
import { datosRectangulo } from '../../utils/rci/RCIRowsModelExtras.ts';
import { dibujaRectangulo, fmtNum, temaResuelto } from './RCISvgSchemas.tsx';
import type { Criterios } from '../../lib/rci/types.ts';

/** Sub-pestañas de la pestaña Rociadores: los ids 'datos' y 'criterios' son los de
 *  SUBS_POR_TAB['rociadores'] que resuelve RUTA_DE; 'rectangulo' es la tercera sección del
 *  HTML (sin checks que apunten a ella todavía). Ej: setSub('rectangulo') muestra el canvas. */
const SUBS: SubItemRci[] = [
  { id: 'datos', titulo: 'Datos del rociador' },
  { id: 'criterios', titulo: 'Criterios de diseño' },
  { id: 'rectangulo', titulo: 'Rectángulo de fuego' },
];

/** Alto CSS del canvas del rectángulo de fuego: 430 para verlo grande junto a la leyenda/tabla. */
const ALTO_RECT = 430;

/** Conteo de verificaciones por sub-pestaña: las que RUTA_DE manda a esta pestaña se reparten
 *  NO CUMPLE → badge rojo, REVISAR/PENDIENTE → ámbar. Una pasada con Map (sin find en bucles).
 *  Ej: checks con go[0]==='rociadores' y sub 'datos' suman al badge de "Datos del rociador". */

/** Tarjeta de solo lectura (sin botón editar): mismo patrón section.card + card-h gris que
 *  GrupoTabla. `icono` queda a la IZQUIERDA del título, dentro del h3.
 *  Ej: <CardLectura titulo="Rectángulo de fuego"><RectanguloFuego ro={ro} /></CardLectura>. */
function CardLectura({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3
          className="card-t"
          style={{
            fontSize: 15,
            color: 'var(--txt2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {icono ? (
            <img src={icono} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          ) : null}
          {titulo}
        </h3>
      </div>
      <div style={{ padding: 6 }}>{children}</div>
    </section>
  );
}

/** Rectángulo de fuego sobre canvas (dibujaRectangulo ya portado): ramales en gris, envolvente
 *  S×L, rectángulo teórico 1,2·√A en rojo discontinuo y rociadores en operación rellenos.
 *  Re-pinta con DPR (devicePixelRatio, nitidez en pantallas HiDPI) al cambiar la tipología o el
 *  ancho del contenedor. Ej: <RectFuegoCanvas ro={tip.roc} /> con 3+3+1 rociadores activos. */
function RectFuegoCanvas({ ro }: { ro: Criterios }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const pintar = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || 640;
      const h = cv.clientHeight || ALTO_RECT;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujaRectangulo(g, w, h, ro, temaResuelto());
    };
    pintar();
    const obs = new ResizeObserver(pintar);
    obs.observe(cv);
    return () => obs.disconnect();
  }, [ro]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Esquema del área de diseño: ramales, envolvente de rociadores y rectángulo teórico de fuego"
      style={{ width: '100%', height: ALTO_RECT, display: 'block' }}
    />
  );
}

/** Sub "Datos del rociador" (el grupo formRoc del HTML) como GrupoTabla: QR (Criterio) y
 *  K/Pmin (Fabricante) y S/L/Dmuro (Rango). Los límites de las ayudas salen de los criterios de
 *  la tipología activa (ro). Ej: con riesgo leve S máx = 4,60 m y cobertura 168 ft² ≈ 15,6 m². */
function DatosRociador({ ctx, ro }: { ctx: RciCtx; ro: Criterios }) {
  const { estado, editar, R } = ctx;
  const campos: DefCampo[] = [
    {
      path: 'clas.qr',
      lbl: 'Tipo: ¿respuesta rápida (QR) en toda el área?',
      opts: SINO,
      ayu: 'Sí: reduce el área de diseño en sistema húmedo, riesgo leve u ordinario y techo ≤ 6,1 m (20 ft); mínimo 768 ft²',
    },
    {
      path: 'roc.K',
      lbl: 'Factor K del rociador',
      num: true,
      uni: 'gpm/psi½',
      ayu: 'Se usa en todos los rociadores salvo que se indique otro K en la tabla de pisos',
    },
    {
      path: 'roc.Pmin',
      lbl: 'Presión mínima de operación',
      num: true,
      uni: 'psi',
      ayu: 'Mínimo 7 psi o la del listado',
    },
    {
      path: 'roc.S',
      lbl: 'Separación entre rociadores en el ramal, S',
      num: true,
      uni: 'm',
      ayu: () => `Entre 1,80 y ${fmtNum(ro.hz.s)} m; S × L ≤ ${fmtNum(ro.Acmax * 0.092903)} m²`,
    },
    {
      path: 'roc.L',
      lbl: 'Separación entre ramales, L',
      num: true,
      uni: 'm',
      ayu: () => `Entre 1,80 y ${fmtNum(ro.hz.l)} m`,
    },
    {
      path: 'roc.Dmuro',
      lbl: 'Distancia máxima de rociador a muro',
      num: true,
      uni: 'm',
      ayu: () => `Entre 0,10 y ${fmtNum(ro.hz.s / 2)} m (S máx/2), en las dos direcciones`,
    },
  ];
  return (
    <GrupoTabla
      titulo="Datos del rociador"
      nota="Corresponden a la tipología activa: siembran los pisos nuevos y gobiernan el cálculo cuando una tipología no trae datos propios"
      icono="/iconos/datos_rociador.webp"
      campos={campos}
      estado={estado}
      R={R}
      editar={editar}
    />
  );
}

/** Sub "Criterios de diseño" (solo lectura, del compute): las dos tablas kv del HTML
 *  (rocTable "Rociador y área de diseño" / rocTable2 "Cobertura y caudales"), una al lado de la
 *  otra en grid 2 columnas (.two) + el aviso de rociadores que faltan. Ej: 7 exigidos vs 6. */
function CriteriosDiseno({
  ro,
  nOp,
  qrTxt,
  sistemaTxt,
}: {
  ro: Criterios;
  nOp: number | null;
  qrTxt: string;
  sistemaTxt: string;
}) {
  /** Mini-card titulada con su kv (patrón .card/.card-head del HTML). */
  const tarjeta = (titulo: string, filas: KvRci[], titulos = false) => (
    <section className="card" style={{ margin: 0 }}>
      <div className="card-h" style={{ padding: '6px 10px' }}>
        <h3 className="card-t" style={{ fontSize: 13.5, color: 'var(--txt2)' }}>
          {titulo}
        </h3>
      </div>
      <div style={{ padding: 4 }}>
        <KvTabla filas={filas} titulos={titulos} />
      </div>
    </section>
  );
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          alignItems: 'stretch',
        }}
      >
        {tarjeta('Rociador y área de diseño', kvRociadorDiseno(ro, qrTxt, sistemaTxt), true)}
        {tarjeta('Cobertura y caudales', kvRociadorCobertura(ro, nOp), true)}
      </div>
      {nOp !== null && ro.Nreq > nOp ? (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--err, #F04545)' }}>
          Faltan {ro.Nreq - nOp} rociadores con flujo para cubrir el área de diseño: dibuje más
          ramales en el piso o revise las conexiones (Verificaciones → Hidráulica).
        </p>
      ) : null}
    </div>
  );
}

/** Un ítem de la leyenda del rectángulo (patrón .legend del HTML): cuadrito de línea o punto. */
function ItemLeyenda({
  children,
  borde,
  punto,
}: {
  children: string;
  borde?: string;
  punto?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12.5,
        color: 'var(--txt2)',
      }}
    >
      <i
        style={
          punto
            ? {
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 4,
                background: punto,
                verticalAlign: 'middle',
              }
            : {
                display: 'inline-block',
                width: 16,
                height: 0,
                borderTop: borde,
                verticalAlign: 'middle',
              }
        }
      />
      {children}
    </span>
  );
}

/** Sub "Rectángulo de fuego": canvas + leyenda (rociador en operación vs fuera) + la tabla
 *  rectTable del HTML (lado largo 1,2·√A, lado corto, reparto por ramales). Ej: el ejemplo da
 *  11,94 × 8,29 m con 3 × 3 ramales (último parcial de 1) y 7 rociadores en 1066,24 ft². */
function RectanguloFuego({ ro }: { ro: Criterios }) {
  const d = datosRectangulo(ro);
  const filas: KvRci[] = [
    { l: 'Lado largo (1,2·√A)', v: fmtNum(d.Llargo), u: 'm', nota: 'paralelo a los ramales' },
    { l: 'Lado corto (A / lado largo)', v: fmtNum(d.Acorto), u: 'm' },
    {
      l: 'Ramales × rociadores por ramal',
      v: `${d.Nramales} × ${d.Nramal}`,
      nota: `${d.Nreq} rociadores en operación · área ${fmtNum(d.Adis, 1)} ft²`,
    },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 10,
      }}
    >
      <div
        className="card"
        style={{
          border: '1px solid var(--line)',
          borderRadius: 6,
          background: 'var(--bg2)',
          padding: 10,
        }}
      >
        <RectFuegoCanvas ro={ro} />
      </div>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ItemLeyenda borde="2px dashed var(--rci, #f87171)">
            Rectángulo teórico (A × 1,2√A)
          </ItemLeyenda>
          <ItemLeyenda borde="2px solid var(--txt3, #8a9496)">
            Envolvente de rociadores en operación
          </ItemLeyenda>
          <ItemLeyenda punto="var(--rci, #f87171)">Rociador en operación</ItemLeyenda>
          <ItemLeyenda punto="var(--txt3, #8a9496)">Rociador fuera del área</ItemLeyenda>
        </div>
        <div style={{ marginTop: 10 }}>
          <KvTabla filas={filas} />
        </div>
      </div>
    </div>
  );
}

/** Pestaña Rociadores del diseño RCI. Ej: <RciRociadores ctx={ctx} /> dentro de RciDesign —
 *  la tipología activa del piso activo pinta sus criterios. Sin SecRci envolvente: los bloques
 *  se titulan solos y no necesita ancla (el fallback de «Ir al dato» usa rci-${grupoDeCheck}
 *  con grupos normativa/tipologias/hidraulica/montantes/bomba/generales — 'rociadores' no está
 *  entre ellos). */
export function RciRociadores({ ctx }: { ctx: RciCtx }) {
  const { R } = ctx;
  /* La sub abierta vive en la nav del shell (RciDesign): irA conmuta pestaña+sub y recuerda. */
  const nav = useNavRci();
  const { irA } = nav;
  const activa = nav.sub ?? SUBS[0].id;
  /* La tipología activa del piso: la que pinta criterios y rectángulo (la red se calcula igual
     para toda la tipología). Sin tipología (piso "Sin rociadores") cae a los criterios globales. */
  const tip = R.edif.active;
  const ro = tip ? tip.roc : R.roc;
  const nOp = tip && tip.rd ? tip.rd.Nop : null;
  const subs = SUBS;

  return (
    <SubTabsRci subs={subs} sub={activa} setSub={(id) => irA('rociadores', id)}>
      {activa === 'datos' ? (
        /* Centrada en la sección (ped. usuario). */
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DatosRociador ctx={ctx} ro={ro} />
        </div>
      ) : null}
      {activa === 'criterios' ? (
        <CardLectura titulo="Criterios de diseño" icono="/iconos/criterios_diseno.webp">
          <CriteriosDiseno
            ro={ro}
            nOp={nOp}
            qrTxt={ctx.estado.clas.qr}
            sistemaTxt={ctx.estado.clas.sistema}
          />
        </CardLectura>
      ) : null}
      {activa === 'rectangulo' ? (
        <CardLectura titulo="Rectángulo de fuego" icono="/iconos/rectangulo_fuego.webp">
          <RectanguloFuego ro={ro} />
        </CardLectura>
      ) : null}
    </SubTabsRci>
  );
}

export default RciRociadores;
