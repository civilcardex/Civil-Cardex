/** Pestaña ENTRADAS del diseño RCI (Red Contra Incendio): el formulario del HTML de referencia
 *  en 9 sub-pestañas verticales (SubTabsRci), cada grupo de campos en SU tarjeta GrupoTabla
 *  (section.card con tabla tbl y botón EDITAR propio arriba a la derecha — cada tabla se edita
 *  sola, sin EDITAR global). Cada fila: etiqueta (con la ayuda al pasar el mouse), control con
 *  data-campo para «Ir al dato», unidad y chip de naturaleza (TAGS_RCI del HTML). Las deps
 *  (p. ej. local.exigeSP) siguen deshabilitando campos encima del flag de edición. Ej: la sub
 *  'tuberia' muestra los 5 campos de tubería/mangueras más las tablas de C por material y de
 *  accesorios especiales. */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  EditTablaBtn,
  SubTabsRci,
  useEditarTabla,
  useNavRci,
  type RciCtx,
  type SubItemRci,
} from './uiRci.tsx';
import { anchoValor, celdaEditable, IN_CELDA } from './celdaEditable.tsx';
import { GrupoTabla, type DefCampo } from './GrupoTabla.tsx';
import { SUBS_POR_TAB } from '../../utils/rci/rowsModelExtras.ts';
import { CLASES_SP, DIAMETROS, MATERIALES, SINO, ZONAS_SIS } from '../../utils/rci/rowsModel.ts';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
import { CDEF, HZ, NOM, type EspAcc } from '../../lib/rci/tables.ts';
import { num } from '../../lib/rci/hydraulics.ts';
import { zonaSis } from '../../lib/rci/index.ts';
import type { RciState } from '../../lib/rci/types.ts';

const RIESGOS = Object.keys(HZ);
const CONSTR = [
  'No combustible / no obstruida',
  'Combustible obstruida',
  'Combustible, elementos < 0,91 m',
] as const;
const SUB_POR_ID = new Map(SUBS_POR_TAB.entradas.map((s) => [s.id, s]));

/** Campos por sub-pestaña (FORM del HTML de referencia; sin meta.* ni notas). */
const GRUPOS: Record<string, DefCampo[]> = {
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
      ayu: 'Seco: área +30 %, C acero 100, sin reducción QR (respuesta rápida)',
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
      opts: CONSTR,
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
      ayu: 'Clase I/III: cada montante adicional suma 250 gpm',
      dep: 'local.exigeSP',
    },
    {
      path: 'sp.rociado',
      lbl: 'Edificio totalmente rociado',
      opts: SINO,
      ayu: 'Sí: tope de 1000 gpm y gobierna la mayor demanda (no se suman)',
      dep: 'local.exigeSP',
    },
    {
      path: 'sp.diam',
      lbl: 'Diámetro mínimo del montante',
      num: true,
      uni: 'pulg',
      ayu: 'Mín. 4"; combinado 6" salvo cálculo hidráulico. El diámetro de cálculo es el del montante (abajo)',
      dep: 'local.exigeSP',
    },
    {
      path: 'sp.zMinSalida',
      lbl: 'Cota de la salida más baja del edificio',
      num: true,
      uni: 'm',
      ayu: (r) =>
        r.sp.activo && r.sp.zAuto !== undefined
          ? `Vacío = ${r.sp.zAuto} m (la más baja de la tabla de pisos)`
          : 'Sobre el eje de la bomba',
      dep: 'local.exigeSP',
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

/** Nota bajo el título de cada sub-pestaña (las que la traen en el HTML). */
const NOTA_SUB: Record<string, string> = {
  normativa: 'No interviene en los cálculos',
  succion:
    'NPSH (Net Positive Suction Head): energía disponible en la succión para evitar cavitación',
  montantes: 'Clase y caudal se habilitan si el código exige gabinetes; el montante aplica siempre',
  siamesa: 'Se habilita si el código exige montantes; se supone conectada en la base del montante',
};

/** Icono del header de cada sub-pestaña (ruta pública; 'tuberia' no tiene imagen). */
const ICONO_SUB: Record<string, string> = {
  normativa: '/iconos/normativa_local.webp',
  clasificacion: '/iconos/clasificacion_riesgo.webp',
  montantes: '/iconos/montantes_nfpa14.webp',
  siamesa: '/iconos/siamesa.webp',
  seleccion: '/iconos/seleccion_bomba.webp',
  succion: '/iconos/succion_cavitacion.webp',
  jockey: '/iconos/bomba_jockey.webp',
  tanque: '/iconos/tanque.webp',
};

/* ---------------- Estilos locales ---------------- */
const NOTA: CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--txt3)' };
const TH10: CSSProperties = { ...TH, fontSize: 11 };
const TDC: CSSProperties = { ...TD, fontSize: 13, padding: '1px 4px' };
/** Control activo de las celdas: caja tipo sanitario con el tamaño de estas tablas (13). */
const IN: CSSProperties = { ...IN_CELDA, fontSize: 13 };
const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

type EditarRci = RciCtx['editar'];

/* ---------------- Tabla C por material ---------------- */

/** Tabla «Coeficiente C de Hazen-Williams por material» (st.cmat): vacío usa el valor de NFPA 13
 *  cap. 28; un valor distinto queda «Por revisar» y debe justificarse. Ej: vacío en 'Acero SCH
 *  40' calcula con C = 120 en húmedo y 100 en seco. */
function TablaCmat({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const cm = estado.cmat || {};
  const setC = (m: string, k: 'h' | 's') => (v: string) =>
    editar((e) => ({
      ...e,
      cmat: { ...(e.cmat || {}), [m]: { ...(e.cmat || {})[m], [k]: v === '' ? '' : Number(v) } },
    }));
  const inC = (m: string, k: 'h' | 's', modo: string) => (
    <td style={TDC}>
      {celdaEditable(
        edit,
        <input
          type="number"
          min={60}
          max={160}
          step={1}
          value={String(cm[m]?.[k] ?? '')}
          placeholder={String(CDEF(m, modo))}
          aria-label={`C adoptado ${modo} de ${m}`}
          onChange={(e) => setC(m, k)(e.target.value)}
          style={{ ...IN, width: 70 }}
        />,
        cm[m]?.[k],
        70,
      )}
    </td>
  );
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
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
          <img
            src="/iconos/coeficiente_c.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Coeficiente C de Hazen-Williams por material
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10}>Material</th>
                <th style={TH10}>NFPA 13 · húmedo</th>
                <th style={TH10}>NFPA 13 · seco</th>
                <th style={TH10}>C adoptado · húmedo</th>
                <th style={TH10}>C adoptado · seco</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALES.map((m) => (
                <tr key={m}>
                  <td style={TDC}>{m}</td>
                  <td style={{ ...TDC, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Húmedo')}</td>
                  <td style={{ ...TDC, fontFamily: 'var(--mono)' }}>{CDEF(m, 'Seco')}</td>
                  {inC(m, 'h', 'Húmedo')}
                  {inC(m, 's', 'Seco')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          El C se aplica a la fricción de la tubería y corrige las longitudes equivalentes de los
          accesorios (la tabla de NFPA 13 está hecha para C = 120). La succión de la bomba usa el
          valor de sistema húmedo.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Catálogo de accesorios especiales ---------------- */

/** Modos de pérdida de un accesorio especial (select del HTML). */
const MODOS_ESP: [string, string][] = [
  ['LD', 'L/D (× Ø interior)'],
  ['Leq', 'Leq fija (m)'],
  ['dp', 'Δp (psi) a Q ref.'],
];

/** Catálogo de accesorios especiales (st.esp): el código aparece en el panel de accesorios de
 *  cada ramal/tramo. Ej: 'VA' (válvula de alarma) con modo LD y valor 50. */
function TablaEsp({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const esp = estado.esp || [];
  const setE =
    (i: number, k: keyof EspAcc, esNum = false) =>
    (v: string) =>
      editar((e) => ({
        ...e,
        esp: e.esp.map((r, j) => (j === i ? { ...r, [k]: esNum && v !== '' ? Number(v) : v } : r)),
      }));
  const del = (i: number) => editar((e) => ({ ...e, esp: e.esp.filter((_, j) => j !== i) }));
  const add = () =>
    editar((e) => ({
      ...e,
      esp: [...e.esp, { cod: '', nombre: '', modo: 'Leq', valor: '', qref: '' }],
    }));
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
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
          <img
            src="/iconos/accesorios_especiales.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          Catálogo de accesorios especiales
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10}>Código</th>
                <th style={TH10}>Accesorio</th>
                <th style={TH10}>Cómo se da la pérdida</th>
                <th style={TH10}>Valor</th>
                <th style={TH10}>Q ref. (gpm)</th>
                <th style={TH10} />
              </tr>
            </thead>
            <tbody>
              {esp.map((a, i) => (
                <tr key={i}>
                  <td style={TDC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.cod ?? '')}
                        aria-label={`Código del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'cod')(e.target.value)}
                        style={{ ...IN, width: 70 }}
                      />,
                      a.cod,
                      70,
                    )}
                  </td>
                  <td style={TDC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="text"
                        value={String(a.nombre ?? '')}
                        aria-label={`Nombre del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'nombre')(e.target.value)}
                        style={{ ...IN, width: anchoValor(a.nombre) }}
                      />,
                      a.nombre,
                    )}
                  </td>
                  <td style={TDC}>
                    {celdaEditable(
                      edit,
                      <select
                        value={a.modo}
                        aria-label={`Modo del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'modo')(e.target.value)}
                        style={{ ...IN, width: 140 }}
                      >
                        {MODOS_ESP.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>,
                      a.modo,
                      140,
                    )}
                  </td>
                  <td style={TDC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="number"
                        step="any"
                        value={String(a.valor ?? '')}
                        aria-label={`Valor del accesorio ${i + 1}`}
                        onChange={(e) => setE(i, 'valor', true)(e.target.value)}
                        style={{ ...IN, width: anchoValor(a.valor), WebkitAppearance: 'textfield' }}
                      />,
                      a.valor,
                    )}
                  </td>
                  <td style={TDC}>
                    {a.modo === 'dp' ? (
                      celdaEditable(
                        edit,
                        <input
                          type="number"
                          step="any"
                          value={String(a.qref ?? '')}
                          aria-label={`Caudal de referencia del accesorio ${i + 1}`}
                          onChange={(e) => setE(i, 'qref', true)(e.target.value)}
                          style={{
                            ...IN,
                            width: anchoValor(a.qref),
                            WebkitAppearance: 'textfield',
                          }}
                        />,
                        a.qref,
                      )
                    ) : (
                      <span style={{ color: 'var(--txt3)' }}>—</span>
                    )}
                  </td>
                  <td style={TDC}>
                    <button
                      type="button"
                      title="Eliminar"
                      aria-label={`Eliminar accesorio ${i + 1}`}
                      disabled={!edit}
                      onClick={() => del(i)}
                      style={{ ...BTN, padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 4 }}>
          <button type="button" disabled={!edit} onClick={add} style={BTN}>
            + Añadir accesorio
          </button>
        </div>
        <p style={NOTA}>
          L/D: la longitud equivalente es L/D × diámetro interior del tramo. Δp: pérdida del
          fabricante a un caudal de referencia, escalada con (Q/Qref)^1,85.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Ayuda «¿Qué clase elegir?» ---------------- */

/** Filas de la ayuda «¿Qué clase elegir?» (CLASE_HELP del HTML): salidas, usuarios y demanda. */
const FILAS_CLASE: [string, string, string, string, string, string][] = [
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

/** Ayuda compacta bajo los campos de montantes: la clase la fija el código, no el diseñador. */
function TablaClases() {
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
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
          <img
            src="/iconos/montantes_nfpa14.webp"
            alt=""
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          ¿Qué clase elegir?
        </h3>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH10}>Clase</th>
                <th style={TH10}>Salida en cada punto</th>
                <th style={TH10}>Quién la usa</th>
                <th style={TH10}>Presión mín. remota</th>
                <th style={TH10}>Caudal</th>
                <th style={TH10}>Elíjala cuando el código pide…</th>
              </tr>
            </thead>
            <tbody>
              {FILAS_CLASE.map(([cl, salida, quien, p, q, cuando]) => (
                <tr key={cl}>
                  <td style={{ ...TDC, fontWeight: 700 }}>{cl}</td>
                  <td style={TDC}>{salida}</td>
                  <td style={TDC}>{quien}</td>
                  <td style={{ ...TDC, fontFamily: 'var(--mono)' }}>{p}</td>
                  <td style={TDC}>{q}</td>
                  <td style={TDC}>{cuando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          Válvula de 2½" sola = Clase I; manguera de 1½" sola = Clase II; las dos = Clase III. Las
          Clases I y III suelen gobernar la bomba (500 gpm a 100 psi en la salida más alta).
        </p>
      </div>
    </section>
  );
}

/* ---------------- Cuarto de bombas ---------------- */

/** Columnas de accesorios estándar del cuarto de bombas (orden FIT del motor). */
const FC_CUARTO: [string, string][] = [
  ['c45', '45°'],
  ['c90', '90°'],
  ['clr', '90° RL'],
  ['tee', 'Tee giro'],
  ['mar', 'Marip.'],
  ['comp', 'Comp.'],
  ['ret', 'Ret.'],
];

/** Tubería del cuarto de bombas (st.mont.cuarto): de la base del montante a la brida de
 *  descarga (CB). Una fila con la longitud total, sus accesorios y el desnivel; los resultados
 *  (pérdidas y presión en la brida) viven en la pestaña Bomba y tanque. */
function TablaCuarto({ estado, editar }: { estado: RciState; editar: EditarRci }) {
  const [edit, toggleEdit] = useEditarTabla();
  const filas = estado.mont.cuarto || [];
  const setC =
    (i: number, k: string, esNum = false) =>
    (v: string) =>
      editar((e) => ({
        ...e,
        mont: {
          ...e.mont,
          cuarto: e.mont.cuarto.map((r, j) =>
            j === i ? { ...r, [k]: esNum && v !== '' ? Number(v) : v } : r,
          ),
        },
      }));
  return (
    <section className="card" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <h3 className="card-t" style={{ fontSize: 15, color: 'var(--txt2)' }}>
          Tubería del cuarto de bombas: de la base del montante a la brida de descarga (CB)
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditTablaBtn on={edit} onToggle={toggleEdit} />
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th colSpan={2} style={TH10}>
                  Recorrido
                </th>
                <th colSpan={3} style={TH10}>
                  Tubería
                </th>
                <th colSpan={9} style={TH10}>
                  Accesorios (un)
                </th>
                <th colSpan={2} style={TH10}>
                  Cotas (m)
                </th>
              </tr>
              <tr>
                <th style={TH10}>Desde</th>
                <th style={TH10}>Hasta</th>
                <th style={TH10}>Material</th>
                <th style={TH10}>Ø</th>
                <th style={TH10}>L (m)</th>
                {FC_CUARTO.map(([k, t]) => (
                  <th key={k} style={TH10}>
                    {t}
                  </th>
                ))}
                <th
                  style={TH10}
                  title="Códigos del catálogo de accesorios especiales (Tubería y mangueras), p. ej. VA+DF"
                >
                  Especiales
                </th>
                <th style={TH10}>Leq otros (m)</th>
                <th style={TH10}>Inicio</th>
                <th style={TH10}>Fin</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => {
                const numTd = (k: string, v: unknown, w = 44) => (
                  <td style={TDC}>
                    {celdaEditable(
                      edit,
                      <input
                        type="number"
                        step="any"
                        value={String(v ?? '')}
                        aria-label={`${k} de la fila ${i + 1} del cuarto`}
                        onChange={(e) => setC(i, k, true)(e.target.value)}
                        style={{ ...IN, width: w }}
                      />,
                      v,
                      w,
                    )}
                  </td>
                );
                return (
                  <tr key={i}>
                    <td style={{ ...TDC, fontWeight: 700 }}>{String(r.ni || 'Base')}</td>
                    <td style={{ ...TDC, fontWeight: 700 }}>{String(r.nf || 'CB')}</td>
                    <td style={TDC}>
                      {celdaEditable(
                        edit,
                        <select
                          value={String(r.mat || '')}
                          aria-label={`Material de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'mat')(e.target.value)}
                          style={{ ...IN, width: 110 }}
                        >
                          {MATERIALES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>,
                        r.mat,
                        110,
                      )}
                    </td>
                    <td style={TDC}>
                      {celdaEditable(
                        edit,
                        <select
                          value={String(r.dn || '')}
                          aria-label={`Diámetro de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'dn')(e.target.value)}
                          style={{ ...IN, width: 64 }}
                        >
                          {NOM.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>,
                        r.dn,
                        64,
                      )}
                    </td>
                    {numTd('L', r.L, 50)}
                    {FC_CUARTO.map(([k]) => (
                      <td key={k} style={TDC}>
                        {celdaEditable(
                          edit,
                          <input
                            type="number"
                            step="any"
                            value={String(r[k] ?? '')}
                            aria-label={`${k} de la fila ${i + 1} del cuarto`}
                            onChange={(e) => setC(i, k, true)(e.target.value)}
                            style={{ ...IN, width: 44 }}
                          />,
                          r[k],
                          44,
                        )}
                      </td>
                    ))}
                    <td style={TDC}>
                      {celdaEditable(
                        edit,
                        <input
                          type="text"
                          value={String(r.esp ?? '')}
                          placeholder="p. ej. VA"
                          aria-label={`Accesorios especiales de la fila ${i + 1} del cuarto`}
                          onChange={(e) => setC(i, 'esp')(e.target.value)}
                          style={{ ...IN, width: 64 }}
                        />,
                        r.esp,
                        64,
                      )}
                    </td>
                    {numTd('leqOtros', r.leqOtros, 50)}
                    {numTd('zi', r.zi)}
                    {numTd('zf', r.zf)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={NOTA}>
          Una fila con la longitud total, sus accesorios y el desnivel. Los resultados (pérdidas y
          presión en la brida) están en la pestaña Bomba y tanque.
        </p>
      </div>
    </section>
  );
}

/* ---------------- La pestaña ---------------- */

/** Pestaña ENTRADAS: sub-pestañas verticales (SUBS_POR_TAB['entradas']) + el grupo de campos
 *  activo; los badges de cada sub cuentan las verificaciones que apuntan a ese grupo. */
export default function RciEntradas({ ctx }: { ctx: RciCtx }) {
  const { estado, R, editar } = ctx;
  const nav = useNavRci();
  /** Preferencia local; la sub efectiva es la del contexto de navegación si «Ir al dato» o la
   *  guía la fijaron (nav.sub manda), y si no, la última que el usuario abrió aquí. */
  const [preferida, setPreferida] = useState('normativa');
  const sub = nav.sub && SUB_POR_ID.has(nav.sub) ? nav.sub : preferida;
  const elegir = (id: string) => {
    setPreferida(id);
    nav.irA('entradas', id);
  };

  const items: SubItemRci[] = SUBS_POR_TAB.entradas.map((s) => ({ id: s.id, titulo: s.l }));

  return (
    <SubTabsRci subs={items} sub={sub} setSub={elegir}>
      <section style={{ padding: '2px 0 8px' }}>
        {sub === 'tuberia' ? (
          /* Tubería y mangueras AL LADO del catálogo de accesorios; el coeficiente C, debajo. */
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, max-content))',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <GrupoTabla
                titulo={SUB_POR_ID.get(sub)?.l || sub}
                nota={NOTA_SUB[sub]}
                icono={ICONO_SUB[sub]}
                campos={GRUPOS[sub] || []}
                estado={estado}
                R={R}
                editar={editar}
              />
              <TablaEsp estado={estado} editar={editar} />
            </div>
            <TablaCmat estado={estado} editar={editar} />
          </>
        ) : sub === 'montantes' ? (
          /* Montantes NFPA 14 AL LADO de ¿Qué clase elegir? (2 columnas, 1 fila). */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, max-content))',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <GrupoTabla
              titulo={SUB_POR_ID.get(sub)?.l || sub}
              nota={NOTA_SUB[sub]}
              icono={ICONO_SUB[sub]}
              campos={GRUPOS[sub] || []}
              estado={estado}
              R={R}
              editar={editar}
            />
            <TablaClases />
          </div>
        ) : sub === 'seleccion' ? null : (
          <GrupoTabla
            titulo={SUB_POR_ID.get(sub)?.l || sub}
            nota={NOTA_SUB[sub]}
            icono={ICONO_SUB[sub]}
            campos={GRUPOS[sub] || []}
            estado={estado}
            R={R}
            editar={editar}
          />
        )}
        {sub === 'seleccion' ? (
          /* Bomba: selección AL LADO de la tubería del cuarto de bombas (2 columnas, 1 fila). */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, max-content))',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <GrupoTabla
              titulo={SUB_POR_ID.get(sub)?.l || sub}
              nota={NOTA_SUB[sub]}
              icono={ICONO_SUB[sub]}
              campos={GRUPOS[sub] || []}
              estado={estado}
              R={R}
              editar={editar}
            />
            <TablaCuarto estado={estado} editar={editar} />
          </div>
        ) : null}
      </section>
    </SubTabsRci>
  );
}
