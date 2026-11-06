/** Definiciones de la pestaña ENTRADAS del diseño RCI (Red Contra Incendio): los campos por
 *  sub-pestaña (GRUPOS, espejo del FORM del HTML de referencia — la ayuda `ayu` es la
 *  observación que pinta la 5ª columna de GrupoTabla), la nota bajo el título, los iconos del
 *  header y las filas del modal «¿Qué clase elegir?». Datos puros (sin React). Ej:
 *  GRUPOS.siamesa[0].path === 'sia.n'. ponytail: no inscrito en MODULOS_NUEVOS (G5 exigiría un
 *  test artificial de datos puros); techo de facto = TOPE_NUEVO (700) del guard G1. */
import type { DefCampo } from './RCIGroupTable.tsx';
import {
  CLASES_SP,
  CONSTR_OPCIONES,
  DIAMETROS,
  MATERIALES,
  SINO,
  ZONAS_SIS,
} from '../../utils/rci/RCIRowsModel.ts';
import { HZ, NOM } from '../../lib/rci/tables.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import { zonaSis } from '../../lib/rci/index.ts';

/** Clasificaciones de riesgo (las llaves de HZ, la tabla de densidades del motor). */
const RIESGOS: string[] = Object.keys(HZ);

/** Opciones de «Construcción del techo»: el select guarda el valor CORTO (la llave del motor,
 *  CONSTR_OPCIONES) y muestra la etiqueta LARGA del FORM del HTML. Ej: guarda 'Combustible
 *  obstruida' y muestra 'Combustible obstruida, elementos a ≥ 0,91 m'. */
const CONSTR_PARES: readonly (readonly [string, string])[] = [
  [CONSTR_OPCIONES[0], 'No combustible, o combustible sin obstrucción'],
  [CONSTR_OPCIONES[1], 'Combustible obstruida, elementos a ≥ 0,91 m'],
  [CONSTR_OPCIONES[2], 'Combustible, elementos a < 0,91 m entre ejes'],
];

/** Campos por sub-pestaña (FORM del HTML de referencia; sin meta.* ni notas). */
export const GRUPOS: Record<string, DefCampo[]> = {
  normativa: [
    {
      path: 'local.codLocal',
      lbl: 'Código de edificación aplicable',
      ayu: 'Código local vigente; queda citado en la memoria (ej.: NSR-10 Títulos J y K, NFPA 101)',
    },
    {
      path: 'local.ocupLocal',
      lbl: 'Ocupación según el código local',
      ayu: 'Grupo de ocupación del código local. No define el riesgo NFPA 13',
    },
    {
      path: 'local.exigeRoc',
      lbl: '¿El código local exige rociadores?',
      opts: SINO,
      ayu: 'NFPA 13 define cómo diseñar, no cuándo es obligatorio',
    },
    {
      path: 'local.refRoc',
      lbl: 'Artículo que exige rociadores',
      ayu: 'Artículo exacto del código local; queda citado en la memoria',
      dep: 'local.exigeRoc',
    },
    {
      path: 'local.exigeSP',
      lbl: '¿Exige montantes / gabinetes?',
      opts: SINO,
      ayu: 'Si es Sí, se habilitan montantes, gabinetes y siamesa',
    },
    {
      path: 'local.refSP',
      lbl: 'Artículo que exige montantes',
      ayu: 'Artículo exacto del código local; queda citado en la memoria',
      dep: 'local.exigeSP',
    },
    {
      path: 'local.adopNac',
      lbl: 'Adopción nacional de NFPA 13 / 14',
      ayu: 'Dejar vacío si no aplica',
    },
    {
      path: 'local.normElec',
      lbl: 'Norma eléctrica local',
      ayu: 'Complementa NFPA 70 art. 695 (bomba contra incendio)',
    },
    {
      path: 'local.reqSismo',
      lbl: '¿Requiere diseño sísmico de la red?',
      opts: SINO,
      ayu: 'Si es Sí, se habilitan norma, parámetro y zona sísmica',
    },
    {
      path: 'local.normSis',
      lbl: 'Norma sísmica local',
      ayu: 'Ej.: ASCE 7 o la norma nacional (NSR-10 en Colombia)',
      dep: 'local.reqSismo',
    },
    {
      path: 'local.parSismo',
      lbl: 'Parámetro sísmico de referencia',
      ayu: "Ej.: 'Aa 0.15, Av 0.20' — con el perfil Colombia calcula la zona sola",
      dep: 'local.reqSismo',
    },
    {
      path: 'local.zonaSis',
      lbl: 'Zona de amenaza sísmica del proyecto',
      opts: ZONAS_SIS,
      dep: 'local.reqSismo',
      ayu: (_r, e) => {
        const z = zonaSis(e);
        if (z.auto)
          return `Auto con NSR-10: zona ${z.z} (mayor de Aa y Av = ${z.a?.toFixed(2)}). Elija otra solo si la autoridad lo indica`;
        if (e.meta.pais === 'Colombia' && !e.local.zonaSis)
          return 'Con NSR-10 se calcula sola al escribir Aa y Av en el parámetro sísmico';
        return 'Según la norma sísmica local. Define el alcance de la guía de la pestaña Soportes sísmicos';
      },
    },
    {
      path: 'local.cp',
      lbl: 'Coeficiente sísmico Cp (NFPA 13)',
      num: true,
      ayu: 'Vacío = 0,5 (valor por defecto de NFPA 13); define la separación de riostras en las tablas de la norma',
      dep: 'local.reqSismo',
    },
    {
      path: 'local.losaRestr',
      lbl: '¿Las losas restringen el montante? (paso ajustado)',
      opts: SINO,
      dep: 'local.reqSismo',
      ayu: 'Sí: la losa apoya el montante al atravesarla y no se exige riostra de cuatro vías intermedia. No (shaft abierto): cuatro vías cada ≤ 7,6 m (NFPA 13 cap. 18)',
    },
  ],
  clasificacion: [
    {
      path: 'clas.almacen',
      lbl: '¿La ocupación incluye almacenamiento?',
      opts: SINO,
      ayu: 'Con almacenamiento no se admite Riesgo leve',
    },
    {
      path: 'clas.arrumeH',
      lbl: 'Altura máxima de arrume',
      num: true,
      uni: 'm',
      ayu: '> 3,66 m requiere NFPA 13 cap. 20–25',
      dep: 'clas.almacen',
    },
    { path: 'clas.riesgo', lbl: 'Clasificación de riesgo', opts: RIESGOS, ayu: 'NFPA 13 cap. 4' },
    {
      path: 'clas.sistema',
      lbl: 'Tipo de sistema',
      opts: ['Húmedo', 'Seco'],
      ayu: 'Seco: área +30 %, C acero 100, sin reducción QR. El tiempo de llegada del agua, el volumen, los equipos y el drenaje del sistema seco se diseñan aparte',
    },
    {
      path: 'clas.htecho',
      lbl: 'Altura libre al techo más alto del área',
      num: true,
      uni: 'm',
      ayu: '> 9,14 m: requisitos de techos altos',
    },
    {
      path: 'clas.constr',
      lbl: 'Construcción del techo',
      optsPar: CONSTR_PARES,
      ayu: 'Riesgo leve: cobertura máx. 225 / 168 / 130 ft² según la opción. Ver ayuda en Tipologías',
    },
    {
      path: 'clas.techoIncl',
      lbl: '¿Techo con pendiente mayor que 2:12?',
      opts: SINO,
      ayu: 'Área de diseño +30 %',
    },
    {
      path: 'clas.ocultoComb',
      lbl: '¿Espacios ocultos combustibles sin rociadores?',
      opts: SINO,
      ayu: 'Área mínima de 3000 ft²',
    },
  ],
  tuberia: [
    {
      path: 'tub.Vmax',
      lbl: 'Velocidad máxima',
      num: true,
      uni: 'm/s',
      ayu: 'NFPA 13 no fija límite; 6 m/s es práctica común',
    },
    {
      path: 'tub.Pcomp',
      lbl: 'Presión de trabajo de componentes',
      num: true,
      uni: 'psi',
      ayu: 'Componentes estándar: 175 psi',
    },
    {
      path: 'mang.mangBomba',
      lbl: '¿La bomba suministra el caudal de mangueras?',
      opts: SINO,
      ayu: (r) => `Sí: suma ${r.roc.hz.hose} gpm de mangueras al caudal de la bomba (NFPA 13)`,
    },
    {
      path: 'mang.mangTanque',
      lbl: '¿El agua de mangueras sale del tanque?',
      opts: SINO,
      ayu: 'Si es Sí, se suma al volumen del tanque',
    },
    {
      path: 'mang.duracion',
      lbl: 'Duración adoptada',
      num: true,
      uni: 'min',
      ayu: (r, e) =>
        r.roc.dmin === r.roc.dmax
          ? `${e.clas.riesgo}: ${r.roc.dmin} min (Tabla 19.2.3.1.1); más si la autoridad lo exige`
          : `${e.clas.riesgo}: ${r.roc.dmin} a ${r.roc.dmax} min (Tabla 19.2.3.1.1)`,
    },
  ],
  montantes: [
    {
      path: 'sp.clase',
      lbl: 'Clase de sistema',
      opts: CLASES_SP,
      abreModal: 'clases',
      dep: 'local.exigeSP',
      ayu: (_r, e) =>
        (
          ({
            'Clase I': 'Conexión de 2½" para bomberos, sin manguera. 100 psi, 500 gpm',
            'Clase II': 'Gabinete con manguera de 1½" para ocupantes. 65 psi, 100 gpm',
            'Clase III':
              'Conexión de 2½" para bomberos y gabinete con manguera de 1½" en cada punto. 100 psi, 500 gpm',
          }) as Record<string, string>
        )[e.sp.clase] || 'La define el código local. Ver «¿Qué clase elegir?»',
    },
    {
      path: 'sp.num',
      lbl: 'Número de montantes',
      num: true,
      uni: 'un',
      dep: 'local.exigeSP',
      ayu: 'Clase I/III: cada montante adicional suma 250 gpm',
    },
    {
      path: 'sp.rociado',
      lbl: 'Edificio totalmente rociado',
      opts: SINO,
      ayu: 'Sí: tope de 1000 gpm y gobierna la mayor demanda (no se suman)',
    },
    {
      path: 'sp.diam',
      lbl: 'Diámetro mínimo del montante',
      num: true,
      uni: 'pulg',
      dep: 'local.exigeSP',
      ayu: 'Mín. 4"; combinado 6" salvo cálculo hidráulico. El diámetro de cálculo es el del montante (abajo)',
    },
    {
      path: 'sp.zMinSalida',
      lbl: 'Cota de la salida más baja del edificio',
      num: true,
      uni: 'm',
      dep: 'local.exigeSP',
      ayu: (r) =>
        r.sp.activo && r.sp.zAuto !== undefined
          ? `Vacío = ${r.sp.zAuto} m (la más baja de la tabla de pisos)`
          : 'Sobre el eje de la bomba',
    },
    {
      path: 'mont.mat',
      lbl: 'Material del montante',
      opts: MATERIALES,
      ayu: 'Su C sale de la tabla de Tubería',
    },
    {
      path: 'mont.dn',
      lbl: 'Diámetro del montante',
      opts: DIAMETROS,
      fmtValor: (v) => String(v).replace(/ /g, '-'),
      ayu: (r, e) =>
        r.edif.dnM
          ? `Ø usado: ${r.edif.dnM}${e.mont.dn === 'auto' ? ' (auto)' : ''}`
          : 'Auto: el menor que cumple velocidad y mínimo de norma',
    },
    {
      path: 'mont.hS',
      lbl: 'Altura de la válvula de manguera (gabinete) sobre NPT',
      num: true,
      uni: 'm',
      ayu: 'Centro de la válvula sobre el NPT (Nivel de Piso Terminado). NFPA 14: entre 0,90 y 1,50 m. Cota = NPT + altura',
    },
    {
      path: 'mont.hD',
      lbl: 'Altura de la derivación del piso sobre NPT (tee en el montante)',
      num: true,
      uni: 'm',
      ayu: 'La tee de salida hacia el piso, antes de la VCP (válvula de control del piso). Solo se usa en tipologías sin red; con red, manda la cota del nudo de derivación',
    },
    {
      path: 'mont.zBase',
      lbl: 'Cota de la base del montante',
      num: true,
      uni: 'm',
      ayu: 'Sobre el eje de la bomba',
    },
    {
      path: 'mont.holgura',
      lbl: 'Holgura mínima exigida en cada derivación',
      num: true,
      uni: 'psi',
      ayu: '0 = lo que exige la norma; un margen de diseño la aumenta',
    },
  ],
  siamesa: [
    {
      path: 'sia.n',
      lbl: 'Número de siamesas',
      num: true,
      uni: 'un',
      ayu: 'En edificios altos, al menos dos alejadas entre sí por zona',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.entradas',
      lbl: 'Entradas de 2½" por siamesa',
      num: true,
      uni: 'un',
      ayu: 'Lo usual son dos (siamesa en Y)',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.rosca',
      lbl: 'Rosca de las entradas',
      ayu: 'La define el cuerpo de bomberos local',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.npt',
      lbl: 'NPT del andén frente a la siamesa',
      num: true,
      uni: 'm',
      ayu: 'Mismo origen que los NPT de los pisos',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.h',
      lbl: 'Altura de las entradas sobre el andén',
      num: true,
      uni: 'm',
      ayu: 'NFPA 14: entre 0,46 y 1,22 m (18 y 48 in)',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.mat',
      lbl: 'Material de la tubería de la siamesa',
      opts: MATERIALES,
      ayu: 'Su C sale de la tabla de Tubería',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.dn',
      lbl: 'Diámetro de la tubería de la siamesa',
      opts: NOM,
      ayu: 'Mínimo 4"',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.L',
      lbl: 'Longitud de la siamesa a la base del montante',
      num: true,
      uni: 'm',
      ayu: 'Recorrido real de la tubería',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.c90',
      lbl: 'Codos 90°',
      num: true,
      uni: 'un',
      ayu: 'Accesorios de la tubería de la siamesa',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.tee',
      lbl: 'Tees con giro',
      num: true,
      uni: 'un',
      ayu: 'Solo donde el flujo gira',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.chq',
      lbl: 'Cheques (válvula de retención)',
      num: true,
      uni: 'un',
      ayu: 'NFPA 14: un cheque listado en la tubería de la siamesa',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.cierre',
      lbl: '¿Hay válvula de cierre entre la siamesa y el sistema?',
      opts: SINO,
      ayu: 'NFPA 14 no la permite',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.drenaje',
      lbl: '¿Drenaje automático entre la siamesa y el cheque?',
      opts: SINO,
      ayu: 'Evita que la tubería quede con agua',
      dep: 'local.exigeSP',
    },
    {
      path: 'sia.hidrante',
      lbl: 'Distancia al hidrante más cercano',
      num: true,
      uni: 'm',
      ayu: 'La fija la autoridad; lo usual es 30,5 m (100 ft) o menos',
      dep: 'local.exigeSP',
    },
  ],
  seleccion: [
    {
      path: 'pisos.zBomba',
      lbl: 'Cota del eje de la bomba',
      num: true,
      uni: 'm',
      ayu: 'Mismo origen que los NPT de los pisos',
    },
    {
      path: 'bomba.margen',
      lbl: 'Margen de presión sobre la demanda',
      num: true,
      uni: 'fracción',
      ayu: '0,10 = 10 %. NFPA 20 no lo exige; lo usual es 0,05–0,10',
    },
    {
      path: 'bomba.qrManual',
      lbl: 'Caudal nominal adoptado',
      num: true,
      uni: 'gpm',
      ayu: 'Vacío = tamaño estándar inmediato superior',
    },
    {
      path: 'bomba.fchurn',
      lbl: 'Presión a caudal cero / nominal',
      num: true,
      ayu: 'Dato del fabricante; NFPA 20: ≤ 1,40',
    },
    {
      path: 'bomba.etaN',
      lbl: 'Eficiencia en el punto nominal',
      num: true,
      uni: 'fracción',
      ayu: 'Del catálogo de la bomba elegida',
    },
    {
      path: 'bomba.eta150',
      lbl: 'Eficiencia al 150 % del caudal',
      num: true,
      uni: 'fracción',
      ayu: 'Del catálogo; suele gobernar la potencia del motor',
    },
    {
      path: 'bomba.fs',
      lbl: 'Factor de servicio del motor',
      num: true,
      ayu: '1,00 conservador; 1,15 solo si el motor lo certifica',
    },
  ],
  succion: [
    {
      path: 'bomba.zFondo',
      lbl: 'Cota del fondo del tanque sobre el eje de la bomba',
      num: true,
      uni: 'm',
      ayu: 'NFPA 20: al nivel del eje o por encima (succión positiva, sin válvula de pie)',
    },
    {
      path: 'bomba.hmin',
      lbl: 'Nivel mínimo de agua sobre el eje de la bomba',
      num: true,
      uni: 'm',
      ayu: 'Nivel más bajo tras la demanda y duración de diseño; con él se calculan la succión y el NPSH',
    },
    {
      path: 'bomba.hmax',
      lbl: 'Nivel máximo de agua sobre el eje de la bomba',
      num: true,
      uni: 'm',
      ayu: 'Nivel de rebose: se suma a la presión estática máxima del sistema',
    },
    {
      path: 'bomba.matSuc',
      lbl: 'Material de la succión',
      opts: MATERIALES,
      ayu: 'Define el diámetro interior y el coeficiente C',
    },
    {
      path: 'bomba.dnSuc',
      lbl: 'Diámetro nominal de succión',
      opts: NOM,
      ayu: (r) =>
        `Mínimo ${r.bomba.DsucMin}" (NFPA 20) para ${r.bomba.Qnom} gpm; velocidad ≤ 4,57 m/s al 150 %`,
    },
    {
      path: 'bomba.lSuc',
      lbl: 'Longitud real de succión',
      num: true,
      uni: 'm',
      ayu: 'Del tanque a la brida de succión de la bomba',
    },
    {
      path: 'bomba.c90',
      lbl: 'Succión: codos 90°',
      num: true,
      uni: 'un',
      ayu: 'Accesorios de la tubería de succión',
    },
    {
      path: 'bomba.tee',
      lbl: 'Succión: tees',
      num: true,
      uni: 'un',
      ayu: 'Solo las tees donde el flujo gira',
    },
    {
      path: 'bomba.comp',
      lbl: 'Succión: válvulas de compuerta OS&Y',
      num: true,
      uni: 'un',
      ayu: 'No se admiten mariposas a menos de 15 m de la succión',
    },
    {
      path: 'bomba.chq',
      lbl: 'Succión: retención / válvula de pie',
      num: true,
      uni: 'un',
      ayu: 'La válvula de pie solo existe con succión negativa, que NFPA 20 no admite en bomba horizontal',
    },
    {
      path: 'bomba.altitud',
      lbl: 'Altitud del sitio',
      num: true,
      uni: 'm s.n.m.',
      ayu: 'Reduce la presión atmosférica y el NPSH disponible',
    },
    {
      path: 'bomba.patmManual',
      lbl: 'Presión atmosférica',
      num: true,
      uni: 'm.c.a.',
      ayu: (_r, e) =>
        `Vacío = ${(10.33 - (num(e.bomba.altitud) || 0) / 900).toFixed(2)} m (10,33 − h/900)`,
    },
    {
      path: 'bomba.tagua',
      lbl: 'Temperatura del agua',
      num: true,
      uni: '°C',
      ayu: 'Define la presión de vapor en el NPSH disponible',
    },
    {
      path: 'bomba.npshr',
      lbl: 'NPSH requerido del fabricante (al 150 %)',
      num: true,
      uni: 'm',
      ayu: 'Dato del catálogo de la bomba',
    },
    {
      path: 'bomba.margenNpsh',
      lbl: 'Margen de NPSH',
      num: true,
      uni: 'm',
      ayu: 'Práctica recomendada para evitar cavitación; no es exigencia NFPA',
    },
  ],
  jockey: [
    {
      path: 'bomba.qjockey',
      lbl: 'Caudal de la bomba jockey',
      num: true,
      uni: 'gpm',
      ayu: (r) =>
        `Entre 1 gpm y ${r.roc.Q1.toFixed(1)} gpm (un rociador). Arranque ${r.bomba.JkStart.toFixed(0)} / parada ${r.bomba.JkStop.toFixed(0)} psi; la principal arranca a ${r.bomba.PpStart.toFixed(0)} psi`,
    },
  ],
  tanque: [
    {
      path: 'tanque.vextra',
      lbl: 'Volumen adicional (otros usos / reserva)',
      num: true,
      uni: 'm³',
      ayu: (r) =>
        `Se suma al volumen contra incendio (${Math.max(r.tanque.Vroc, r.tanque.Vsp).toFixed(1)} m³); total ${r.tanque.V.toFixed(1)} m³`,
    },
  ],
};

/** Título legible de cada grupo (para citar la tabla donde vive la condición en notaDeps). */
const TITULO_GRUPO: Record<string, string> = {
  normativa: 'Normativa',
  clasificacion: 'Clasificación',
  tuberia: 'Tubería y mangueras',
  montantes: 'Montantes',
  siamesa: 'Siamesa',
  seleccion: 'Selección de bomba',
  succion: 'Succión',
  jockey: 'Bomba jockey',
  tanque: 'Tanque',
};

/** Índice dep-path → ««label» (Tabla)», construido UNA vez de GRUPOS (sin búsquedas en bucles). */
const FUENTE_DEP: Map<string, string> = new Map(
  Object.entries(GRUPOS).flatMap(([id, camposGrupo]) =>
    camposGrupo.map((c) => [c.path, `«${c.lbl}» (${TITULO_GRUPO[id] || id})`] as const),
  ),
);

/** Nota del icono ⓘ de una tabla: qué condición Sí/No (de otra tabla) habilita sus filas
 *  bloqueadas. Resuelve cada dep contra el índice FUENTE_DEP y cita su tabla. En FORMATO
 *  LISTA (el title nativo respeta los saltos): primera línea con la condición y un punto
 *  por fila habilitada. Ej: en Montantes → «Requiere «Sí» en «¿Exige montantes /
 *  gabinetes?» (Normativa) para habilitar:\n• Clase de sistema\n• …». Vacío = sin deps. */
export function notaDeps(campos: DefCampo[]): string {
  const porDep = new Map<string, string[]>();
  for (const d of campos) {
    if (!d.dep) continue;
    const filas = porDep.get(d.dep) || [];
    filas.push(d.lbl);
    porDep.set(d.dep, filas);
  }
  if (porDep.size === 0) return '';
  const partes: string[] = [];
  for (const [dep, filas] of porDep) {
    partes.push(
      `Requiere «Sí» en ${FUENTE_DEP.get(dep) || dep} para habilitar:\n${filas.map((f) => `• ${f}`).join('\n')}`,
    );
  }
  return partes.join('\n\n');
}

/** Nota bajo el título de cada sub-pestaña (las que la traen en el HTML). */
export const NOTA_SUB: Record<string, string> = {
  normativa: 'No interviene en los cálculos',
  succion:
    'NPSH (Net Positive Suction Head): energía disponible en la succión para evitar cavitación',
  montantes: 'Clase y caudal se habilitan si el código exige gabinetes; el montante aplica siempre',
  siamesa: 'Se habilita si el código exige montantes; se supone conectada en la base del montante',
};

/** Icono del header de cada sub-pestaña (ruta pública). */
export const ICONO_SUB: Record<string, string> = {
  normativa: '/iconos/normativa_local.webp',
  clasificacion: '/iconos/clasificacion_riesgo.webp',
  montantes: '/iconos/montantes_nfpa14.webp',
  siamesa: '/iconos/siamesa.webp',
  seleccion: '/iconos/seleccion_bomba.webp',
  succion: '/iconos/succion_cavitacion.webp',
  jockey: '/iconos/bomba_jockey.webp',
  tanque: '/iconos/tanque.webp',
  tuberia: '/iconos/tuberia_mangueras.webp',
};

/** Filas de la ayuda «¿Qué clase elegir?» (CLASE_HELP del HTML): salidas, usuarios y demanda. */
export const FILAS_CLASE: [string, string, string, string, string, string][] = [
  [
    'I',
    'Válvula de 2½" sin manguera',
    'Bomberos',
    '100 psi',
    '500 gpm el primer montante + 250 por cada adicional',
    'Solo conexiones para el cuerpo de bomberos (edificios altos, escaleras protegidas)',
  ],
  [
    'II',
    'Gabinete con manguera de 1½" y boquilla',
    'Ocupantes o brigada',
    '65 psi',
    '100 gpm',
    'Solo gabinetes con manguera para primera respuesta de los ocupantes',
  ],
  [
    'III',
    'Válvula de 2½" y gabinete con manguera de 1½"',
    'Bomberos y ocupantes',
    '100 psi',
    'Como la Clase I',
    'Las dos cosas: conexión para bomberos y gabinete con manguera',
  ],
];
