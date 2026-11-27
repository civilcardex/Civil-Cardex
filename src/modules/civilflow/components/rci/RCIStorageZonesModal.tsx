/** Modal de ZONAS DE ALMACENAMIENTO de un piso (RCI): sustituye a la tarjeta de Entradas
 *  (ped. usuario). Abre desde la celda «Zonas» de Pisos del edificio; también en modo
 *  REASIGNAR (piso=null) para las fichas cuyo piso ya no existe. Todo se edita en un BORRADOR
 *  y «Guardar zonas» confirma altas/ediciones/bajas en conjunto. Ej:
 *  <RCIStorageZonesModal ctx={ctx} piso={{ clave: '12', nombre: 'Piso 3' }} onClose={...} />. */
import { useId, useMemo, useState } from 'react';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';
import {
  ESPECIAL_ZONA,
  MISCELANEO_ZONA,
  MIXTO_ZONA,
  OTRO_ZONA,
  PENDIENTE_ZONA,
  esPlasticoA,
  evaluarZona,
  llevaRepisas,
  necesitaDetalleZona,
  pisoDeZona,
} from '../../lib/rci/storageZones.ts';
import type { PisoRow, ZonaAlmacenamientoRci } from '../../lib/rci/types.ts';
import type { RciCtx } from './RCIUI.tsx';
import './rciStorageZones.css';
import type { CSSProperties } from 'react';

/* Estilos del proyecto (mismo lenguaje que RCIGuideModal): botón gris y primario RCI. */
const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt)',
  borderRadius: 'var(--r, 6px)',
  padding: '5px 14px',
  fontSize: 12.5,
  cursor: 'pointer',
  fontFamily: 'var(--body)',
  whiteSpace: 'nowrap',
};
/* Primario DISCRETO (ped. 2026-11-27): contorno RCI en vez del relleno sólido. */
const BTN_PRIMARIO: CSSProperties = {
  ...BTN,
  background: 'rgba(248, 113, 113, 0.14)',
  borderColor: 'var(--rci)',
  color: 'var(--rci)',
  fontWeight: 700,
};
const BTN_X: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 4,
  color: 'var(--txt2)',
  cursor: 'pointer',
  padding: '2px 8px',
  fontSize: 13,
};

const SI_NO = ['Sí', 'No'];
const TIPOS = [MISCELANEO_ZONA, 'Arrume bajo', ESPECIAL_ZONA];
const MERCANCIAS = [
  'Clase I',
  'Clase II',
  'Clase III',
  'Clase IV',
  'Plástico grupo A',
  'Plástico grupo B',
  'Plástico grupo C',
  ...[
    'Neumáticos',
    'Papel en rollos',
    'Palés vacíos',
    'Aerosoles',
    'Líquidos inflamables o combustibles',
    'Baterías',
  ].map((m) => `Especial · ${m}`),
  MIXTO_ZONA,
  OTRO_ZONA,
];
const DISPOSICIONES = [
  'Apilado en bloque sobre piso',
  'Paletizado',
  'Cajas contenedoras',
  'Estantería',
  'Estantería espalda con espalda',
  'Rack de una fila',
  'Rack de dos filas',
  'Rack de múltiples filas',
  OTRO_ZONA,
];

type Campo = Exclude<keyof ZonaAlmacenamientoRci, 'id'>;
type Opcion = string | { valor: string; texto: string };

/** Guía COMPLETA por campo (title del control, ped. 2026-11-27): qué significa cada opción y
 *  cuál escoger según el diseño. La nota corta sigue visible bajo el control. */
const GUIA: Partial<Record<Campo, string>> = {
  tipo: 'Misceláneo: mercancía suelta o apilada a mano (sin rack) dentro del alcance del cálculo simplificado. Arrume bajo: carga apilada sobre piso a ≤ 3,66 m, también dentro del alcance. Almacenamiento alto o de diseño específico: racks altos, sistemas de movimiento, alturas o configuraciones que el módulo no cubre — la ficha queda FUERA del cálculo simplificado y exige diseño específico. Elija el tipo que define su diseño; la altura por sí sola no basta.',
  mercancia:
    'Clase I: producto no combustible en cajas de cartón. Clase II: producto no combustible en cajas de madera. Clase III: madera, papel, textiles naturales. Clase IV: mezcla de producto no combustible con plástico limitado. Plástico grupo A/B/C: según el plástico dominante de la carga. Especial · …: neumáticos, papel en rollos, palés vacíos, aerosoles, líquidos inflamables o baterías — quedan fuera del cálculo simplificado. Mercancía mixta y Otro caso también quedan fuera y exigen diseño específico. Clasifique la carga COMPLETA: producto + embalaje + palé.',
  disposicion:
    'Apilado en bloque sobre piso: mercancía directamente sobre el piso, sin rack. Paletizado: sobre palé sin estantería. Cajas contenedoras: bins o contenedores cerrados. Estantería y sus variantes de rack: estante fijo o rack (una, dos o múltiples filas, o espalda con espalda) — la forma define la exigencia del diseño: un palé en rack se registra como rack.',
  repisa:
    'Abiertas: repisas que no obstruyen el agua de los rociadores. Sólidas: estantes planos que bloquean la descarga (más exigente). Mixtas: combinación de ambas. Solo aplica con estantería o rack.',
  embalaje:
    'En cartón: cajas de cartón en el exterior de la carga. Expuesto o sin cartón: producto desnudo o atado. Otro caso: describa el embalaje real en el campo de detalle — queda fuera del alcance simplificado.',
  pale: 'Sin palé: carga directamente sobre piso o estante. Madera: el palé de madera, el más común. Plástico reforzado / no reforzado: mayor exigencia de diseño por el combustible del palé. Otro caso: descríbalo en el detalle.',
  expansion:
    'Expandido: plástico celular o espumado (la más exigente). No expandido: plástico sólido. Mixto: ambos presentes en la carga.',
  encapsulado:
    'Sí: la envoltura plástica encierra toda la carga (aumenta la exigencia del diseño). No: carga abierta o con envoltura parcial.',
  detalle:
    'Texto libre: describa el caso con lo necesario para que el profesional responsable pueda revisarlo (material, forma, alturas, protecciones).',
  arrume:
    'Altura de arrume en METROS: desde el piso terminado hasta la parte superior de la mercancía (producto + embalaje + palé). Debe ser positiva y menor que la altura del techo; el máximo del módulo sin revisión especial es 3,66 m.',
  techo:
    'Altura de techo de LA ZONA en metros. Déjelo VACÍO para heredar la altura libre del piso; escriba un valor solo si esta zona tiene un techo distinto (mezanina, caja). Debe ser positiva y mayor que el arrume.',
  recinto:
    'Área del recinto en m²: superficie TOTAL del cuarto/recinto en planta. Solo para almacenamiento Misceláneo.',
  area: 'Área total almacenada en m²: suma de las superficies ocupadas por las pilas. Debe ser ≤ el área del recinto. Solo para Misceláneo.',
  pila: 'Área de la PILA MAYOR en m²: la mayor pila individual en planta. No puede superar el área total almacenada. Solo para Misceláneo.',
  unaPila:
    'Sí: todo el almacenamiento del recinto es UNA sola pila (la separación no aplica). No: hay varias pilas — indique la separación mínima entre ellas.',
  separacion:
    'Separación mínima en METROS: paso libre entre los bordes más cercanos de pilas vecinas. Solo si hay más de una pila.',
};

/** Id nuevo para una ficha (mismo formato que la tarjeta antigua). */
const nuevoId = (): string =>
  [...crypto.getRandomValues(new Uint32Array(2))].map((x) => x.toString(36)).join('-');

function CampoZona({
  zona,
  campo,
  label,
  nota,
  opciones,
  onChange,
  numerico = false,
  invalido = false,
}: {
  zona: ZonaAlmacenamientoRci;
  campo: Campo;
  label: string;
  nota: string;
  opciones?: readonly Opcion[];
  onChange: (campo: Campo, valor: string) => void;
  numerico?: boolean;
  invalido?: boolean;
}) {
  const id = useId();
  const title = GUIA[campo] ? `${nota} — ${GUIA[campo]}` : nota;
  const props = {
    id,
    name: campo,
    'aria-describedby': `${id}-nota`,
    'aria-invalid': invalido || undefined,
    value: zona[campo] ?? '',
  };
  return (
    <div className="rci-zone-field">
      {/* La guía completa vive en el title del control Y del título del campo (ped.
       *  2026-11-27): hover sobre el nombre muestra qué opción escoger según el diseño. */}
      <label htmlFor={id} title={title}>
        {label}
      </label>
      {opciones ? (
        <select
          {...props}
          title={title}
          data-campo={campo === 'piso' ? `clas.zona-${zona.id}` : undefined}
          onChange={(e) => onChange(campo, e.target.value)}
        >
          <option value="">{campo === 'piso' ? 'Sin asignar' : 'Seleccione'}</option>
          {opciones.map((op) =>
            typeof op === 'string' ? (
              <option key={op} value={op}>
                {op}
              </option>
            ) : (
              <option key={op.valor} value={op.valor}>
                {op.texto}
              </option>
            ),
          )}
          {campo !== 'piso' ? <option>{PENDIENTE_ZONA}</option> : null}
        </select>
      ) : (
        <input
          {...props}
          type={numerico ? 'number' : 'text'}
          title={title}
          min={numerico ? 0 : undefined}
          inputMode={numerico ? 'decimal' : undefined}
          step={numerico ? 'any' : undefined}
          onChange={(e) => onChange(campo, e.target.value)}
        />
      )}
      <small id={`${id}-nota`}>{nota}</small>
    </div>
  );
}

/** Una ficha en edición: los mismos campos de la tarjeta antigua. onRemove omitido en modo
 *  reasignar (solo se reasigna, no se borra desde allí). */
function FichaZona({
  zona,
  pisos,
  muestraPiso = false,
  onChange,
  onRemove,
}: {
  zona: ZonaAlmacenamientoRci;
  pisos: readonly PisoRow[];
  /** El selector de piso solo aparece en modo REASIGNAR: al crear una zona el piso es la
   *  fila que abrió el modal (ped. usuario 2026-11-27). */
  muestraPiso?: boolean;
  onChange: (campo: Campo, val: string) => void;
  onRemove?: () => void;
}) {
  const piso = pisos.find((p) => pisoDeZona(p) === zona.piso);
  const resultado = evaluarZona(zona, piso);
  const opciones = pisos.map((p) => ({ valor: pisoDeZona(p), texto: p.nombre }));
  const techo = resultado.techo;
  const nombre = zona.nombre.trim() || 'Zona sin nombre';
  const campo = (
    clave: Campo,
    label: string,
    nota: string,
    opts?: readonly Opcion[],
    num = false,
  ) => (
    <CampoZona
      zona={zona}
      campo={clave}
      label={label}
      nota={nota}
      opciones={opts}
      numerico={num}
      invalido={resultado.alturasInvalidas && (clave === 'arrume' || clave === 'techo')}
      onChange={onChange}
    />
  );
  return (
    <fieldset className="rci-zone">
      <legend>{nombre}</legend>
      <div className="rci-zone-status">
        <span role="status">{resultado.estado}</span>
        {onRemove ? (
          <button
            type="button"
            style={BTN}
            aria-label={`Quitar zona: ${nombre}`}
            onClick={onRemove}
          >
            Quitar zona
          </button>
        ) : null}
      </div>
      <div className="rci-zone-grid">
        {muestraPiso && campo('piso', 'Piso', 'Elija el piso donde está este sector.', opciones)}
        {campo(
          'nombre',
          'Nombre de la zona',
          'Ejemplo: Depósito de repuestos. Separe zonas si cambia la mercancía.',
        )}
        {campo(
          'tipo',
          'Tipo de almacenamiento',
          'Elija el tipo definido para el diseño; la altura no basta.',
          TIPOS,
        )}
        {campo(
          'mercancia',
          'Clase de mercancía',
          'Considere la carga completa: producto, embalaje y palé.',
          MERCANCIAS,
        )}
        {campo(
          'disposicion',
          'Forma de almacenamiento',
          'Un palé en un rack se registra como rack.',
          DISPOSICIONES,
        )}
        {llevaRepisas(zona) &&
          campo('repisa', 'Repisas', 'Indique si hay superficies continuas bajo la carga.', [
            'Abiertas',
            'Sólidas',
            'Mixtas',
          ])}
        {campo('embalaje', 'Embalaje', 'Describa el embalaje exterior real.', [
          'En cartón',
          'Expuesto o sin cartón',
          OTRO_ZONA,
        ])}
        {campo('pale', 'Palé', 'Indique el material de la base de transporte.', [
          'Sin palé',
          'Madera',
          'Plástico reforzado',
          'Plástico no reforzado',
          OTRO_ZONA,
        ])}
        {esPlasticoA(zona) &&
          campo('expansion', 'Plástico grupo A', 'Confirme si el plástico es celular o espumado.', [
            'Expandido',
            'No expandido',
            'Mixto',
          ])}
        {esPlasticoA(zona) &&
          campo(
            'encapsulado',
            '¿Carga encapsulada?',
            'Indique si la envoltura encierra la carga.',
            SI_NO,
          )}
        {necesitaDetalleZona(zona) &&
          campo(
            'detalle',
            'Describa el otro caso',
            'Incluya lo necesario para que el profesional pueda revisarlo.',
          )}
        {campo(
          'arrume',
          'Altura de arrume (m)',
          'Mida desde el piso terminado hasta la parte superior de la mercancía.',
          undefined,
          true,
        )}
        {campo(
          'techo',
          'Altura de techo de la zona (m)',
          zona.techo
            ? 'Valor propio de esta zona. Bórrelo para volver a heredar.'
            : techo === null
              ? 'Sin altura de piso disponible: indique la altura de la zona.'
              : `Se hereda la altura libre del piso: ${techo.toLocaleString('es-CO')} m.`,
          undefined,
          true,
        )}
        {zona.tipo === MISCELANEO_ZONA && (
          <>
            {campo(
              'recinto',
              'Área del recinto (m²)',
              'Superficie total del recinto en planta.',
              undefined,
              true,
            )}
            {campo(
              'area',
              'Área total almacenada (m²)',
              'Sume la superficie ocupada por las pilas.',
              undefined,
              true,
            )}
            {campo(
              'pila',
              'Área de la pila mayor (m²)',
              'Mida la mayor pila en planta.',
              undefined,
              true,
            )}
            {campo(
              'unaPila',
              '¿Hay una sola pila?',
              'Si hay una sola, la separación no aplica.',
              SI_NO,
            )}
            {zona.unaPila === 'No' &&
              campo(
                'separacion',
                'Separación mínima (m)',
                'Mida el paso libre entre los bordes más cercanos.',
                undefined,
                true,
              )}
          </>
        )}
      </div>
      {resultado.alturasInvalidas && (
        <p>Las alturas deben ser positivas y el arrume debe quedar por debajo del techo.</p>
      )}
      {zona.piso && !piso && (
        <p>El piso asignado ya no existe. Reasigne la ficha; los datos se conservaron.</p>
      )}
    </fieldset>
  );
}

/** Props del modal: `piso` fija el piso objetivo (sus fichas + altas); `piso=null` abre el
 *  modo REASIGNAR con solo las fichas huérfanas. AGREGAR zona solo con EDITAR activo
 *  (ped. usuario 2026-11-27): `puedeAgregar` llega del EDITAR de la tabla de pisos. */
export function RCIStorageZonesModal({
  ctx,
  piso,
  puedeAgregar = false,
  onClose,
}: {
  ctx: RciCtx;
  /** Piso objetivo (clave estable planId||planta y nombre) o null para reasignar huérfanas. */
  piso: { clave: string; nombre: string } | null;
  /** EDITAR de la tabla de pisos: gobierna el botón Agregar zona del modal. */
  puedeAgregar?: boolean;
  onClose: () => void;
}) {
  const { estado } = ctx;
  const pisos = estado.pisos.rows;
  /** Borrador: en modo piso son las fichas de ESE piso (con altas nuevas); en reasignar, las
   *  huérfanas. Guardar las fusiona por id sobre clas.zonasAlmacenamiento. */
  const [borrador, setBorrador] = useState<ZonaAlmacenamientoRci[]>(() => {
    const zonas = estado.clas.zonasAlmacenamiento ?? [];
    const claves = new Set(pisos.map((p) => pisoDeZona(p)).filter(Boolean));
    const enModo = (z: ZonaAlmacenamientoRci): boolean =>
      piso ? z.piso === piso.clave : !z.piso || !claves.has(z.piso);
    return zonas.filter(enModo).map((z) => ({ ...z }));
  });
  /* Ficha abierta (una a la vez); null = lista. La primera zona nueva se abre directa. */
  const [abierta, setAbierta] = useState<string | null>(null);
  /* H-04 (remediación 2026-11-27): las BAJAS se llevan por ID aparte — si solo se filtrara el
   * borrador, una zona eliminada sobreviviría en clas.zonasAlmacenamiento al fusionar. */
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set());
  const [sucio, setSucio] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cerrar = (): void => {
    if (sucio) setConfirma(true);
    else onClose();
  };
  const cambiar = (fn: (prev: ZonaAlmacenamientoRci[]) => ZonaAlmacenamientoRci[]): void => {
    setBorrador(fn);
    setSucio(true);
    setErr(null);
  };
  const agregar = (): void => {
    const id = nuevoId();
    cambiar((prev) => [...prev, { id, piso: piso?.clave ?? '', nombre: '' }]);
    setAbierta(id);
  };
  const quitar = (id: string): void => {
    cambiar((prev) => prev.filter((z) => z.id !== id));
    setEliminadas((prev) => new Set(prev).add(id));
    if (abierta === id) setAbierta(null);
  };
  /** El piso de la ficha para evaluarla (herencia de techo, riesgo…). */
  const pisoDeFicha = (z: ZonaAlmacenamientoRci): PisoRow | undefined =>
    pisos.find((p) => pisoDeZona(p) === z.piso);
  const invalidas = borrador.filter((z) => evaluarZona(z, pisoDeFicha(z)).alturasInvalidas);
  const arrumes = borrador
    .map((z) => (z.arrume ? Number(z.arrume) : NaN))
    .filter((v) => Number.isFinite(v) && v > 0);
  const guardar = (): void => {
    if (invalidas.length) {
      setErr(
        `No se puede guardar: ${invalidas
          .map((z) => z.nombre.trim() || 'Zona sin nombre')
          .join(', ')} tiene alturas inválidas (el arrume debe quedar por debajo del techo).`,
      );
      return;
    }
    ctx.editar((e) => ({
      ...e,
      clas: {
        ...e.clas,
        /* H-04: fuera las del borrador (por si cambiaron de piso) Y las eliminadas
         * explícitamente; dentro el borrador completo. */
        zonasAlmacenamiento: [
          ...(e.clas.zonasAlmacenamiento ?? []).filter(
            (z) => !borrador.some((b) => b.id === z.id) && !eliminadas.has(z.id),
          ),
          ...borrador,
        ],
      },
    }));
    /* Desde la FICHA: «Guardar zona» escribe y vuelve a la LISTA sin cerrar el modal
     * (ped. usuario 2026-11-27). En la lista, «Guardar zonas» confirma y cierra. */
    if (fichaAbierta) {
      setAbierta(null);
      setSucio(false);
      return;
    }
    onClose();
  };
  const fichaAbierta = borrador.find((z) => z.id === abierta);
  /* La ficha muestra el estado del PISO con riesgo real (para el aviso de G2), no del borrador. */
  const evaluaciones = useMemo(
    () =>
      new Map(
        borrador.map((z) => [
          z.id,
          evaluarZona(
            z,
            estado.pisos.rows.find((p) => pisoDeZona(p) === z.piso),
          ),
        ]),
      ),
    [borrador, estado.pisos.rows],
  );

  return (
    <ModalOverlay ariaLabel="Zonas de almacenamiento" onClose={cerrar}>
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          width: 'min(760px, calc(100vw - 40px))',
          maxWidth: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(0,0,0,.5)',
        }}
      >
        {/* Encabezado con icono + título RCI + X (patrón de la Guía de diseño). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <img
            src="/iconos/pisos_edificio.webp"
            alt=""
            loading="lazy"
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--rci)' }}>
            Zonas de almacenamiento
          </h3>
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
            {piso ? piso.nombre : 'Por reasignar'}
          </span>
          {/* H-08: la X usa `cerrar` (no onClose directo) — con borrador sucio pide
           * confirmación, igual que Escape y Cancelar. */}
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar zonas de almacenamiento"
            style={{ ...BTN_X, marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>
        <p
          style={{
            margin: 0,
            padding: '8px 12px 0',
            fontSize: 12.5,
            color: 'var(--txt2)',
          }}
        >
          {piso
            ? 'Una ficha por sector. Las fichas pueden guardarse incompletas; los cambios se aplican al guardar.'
            : 'Estas fichas quedaron sin piso válido. Elíjale piso a cada una y guarde; los datos se conservan.'}
        </p>
        <div
          style={{
            padding: '10px 12px',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            overscrollBehavior: 'contain',
          }}
        >
          {borrador.length > 0 && !fichaAbierta && (
            <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--txt2)' }}>
              Mayor altura registrada:{' '}
              {arrumes.length ? `${Math.max(...arrumes).toLocaleString('es-CO')} m` : '—'}.
              {arrumes.length < borrador.length
                ? ' Faltan alturas de arrume: el máximo no es definitivo.'
                : ''}
            </p>
          )}
          {!fichaAbierta && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {borrador.map((z) => {
                const ev = evaluaciones.get(z.id);
                return (
                  <li
                    key={z.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      border: '1px solid var(--line)',
                      borderInlineStart: '3px solid var(--rci)',
                      borderRadius: 6,
                      background: 'var(--bg3)',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <b>{z.nombre.trim() || 'Zona sin nombre'}</b>
                      {ev ? <span style={{ color: 'var(--txt3)' }}> · {ev.estado}</span> : null}
                    </span>
                    <button
                      type="button"
                      style={BTN}
                      onClick={() => {
                        setAbierta(z.id);
                        setErr(null);
                      }}
                    >
                      Editar
                    </button>
                    {/* Eliminar disponible también en REASIGNAR: una ficha huérfana que ya
                        no corresponde a nada se puede quitar aquí (ped. 2026-11-27). */}
                    <button type="button" style={BTN} onClick={() => quitar(z.id)}>
                      Eliminar
                    </button>
                  </li>
                );
              })}
              {borrador.length === 0 && (
                <li style={{ padding: '8px 0', color: 'var(--txt2)', fontSize: 13 }}>
                  {piso
                    ? 'Sin zonas en este piso. Agregue una ficha por sector de almacenamiento.'
                    : 'Ninguna ficha quedó sin piso.'}
                </li>
              )}
            </ul>
          )}
          {fichaAbierta && (
            <FichaZona
              zona={fichaAbierta}
              pisos={pisos}
              muestraPiso={!piso}
              onRemove={piso ? () => quitar(fichaAbierta.id) : undefined}
              onChange={(campo, val) =>
                cambiar((prev) =>
                  prev.map((z) => (z.id === fichaAbierta.id ? { ...z, [campo]: val } : z)),
                )
              }
            />
          )}
          {err ? (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--err)' }}>
              {err}
            </p>
          ) : null}
          {confirma ? (
            <div
              role="alert"
              style={{
                margin: '10px 0 0',
                padding: '8px 10px',
                border: '1px solid rgba(224,164,0,.55)',
                borderRadius: 6,
                background: 'rgba(224,164,0,.12)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12.5 }}>¿Descartar los cambios sin guardar?</span>
              <button
                type="button"
                style={{ ...BTN, marginLeft: 'auto' }}
                onClick={() => {
                  setConfirma(false);
                  onClose();
                }}
              >
                Descartar
              </button>
              <button type="button" style={BTN_PRIMARIO} onClick={() => setConfirma(false)}>
                Seguir editando
              </button>
            </div>
          ) : null}
        </div>
        {/* Acciones siempre visibles (fuera de la zona que se desplaza). */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            padding: '8px 12px',
            borderTop: '1px solid var(--line)',
          }}
        >
          {!fichaAbierta && piso ? (
            <button
              type="button"
              style={{ ...BTN, marginRight: 'auto', opacity: puedeAgregar ? 1 : 0.45 }}
              disabled={!puedeAgregar}
              title={
                puedeAgregar
                  ? 'Nueva ficha de zona en este piso'
                  : 'Active EDITAR en la tabla de pisos para agregar zonas'
              }
              onClick={agregar}
            >
              Agregar zona
            </button>
          ) : null}
          {fichaAbierta ? (
            <button
              type="button"
              style={{ ...BTN, marginRight: 'auto' }}
              onClick={() => setAbierta(null)}
            >
              Volver a la lista
            </button>
          ) : null}
          <button type="button" style={BTN} onClick={cerrar}>
            Cancelar
          </button>
          {/* Guardar visible TAMBIÉN mientras se edita una ficha: valida las alturas y escribe
              el conjunto sin volver a la lista. En singular si se está creando UNA zona. */}
          <button type="button" style={BTN_PRIMARIO} onClick={guardar}>
            {fichaAbierta ? 'Guardar zona' : 'Guardar zonas'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
export default RCIStorageZonesModal;
