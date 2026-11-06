/**
 * Guía contextual — dominio REDES: 'cf:redes' general + una clave por red (san, ll, af, ac, gas,
 * rejillas, bom, ep, rci). Contenido puro, lo consume helpGuideFlow.
 * Ej: 'cf:redes:rci' documenta las pestañas del módulo de red contra incendio.
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';
import { CRITERIOS_3631 } from './helpGuideCriteria.tsx';

export const GUIA_NETWORKS: GUIA_TYPE = {
  'cf:redes': [
    {
      titulo: 'Cómo funciona esta pestaña',
      items: [
        {
          nombre: 'Botonera de redes + flechas ‹ ›',
          desc: 'Cambia entre redes activas y entre las páginas de cada red (cálculo → diseño → chequeos → accesorios).',
        },
        {
          nombre: 'EDITAR / LISTO por tarjeta',
          desc: 'Los diámetros y campos de cálculo solo son editables con el lápiz activo. Todo lo demás es resultado en vivo de lo dibujado.',
        },
      ],
    },
    {
      titulo: 'Sanitaria',
      items: [
        {
          nombre: 'Cálculo de unidades de descarga',
          desc: 'Conteo de aparatos por piso y UD acumuladas por bajante (tabla NTC 1500).',
        },
        {
          nombre: 'Diseño sanitario',
          desc: 'Tramos con UD propia/de otros/acumulada, caudal, diámetro calculado vs propuesto (editable), tirante, Froude, velocidad y fuerza tractiva ≥ 0.15.',
        },
        {
          nombre: 'Bajantes y ventilación',
          desc: 'Por bajante: pisos, UD, fracción de llenado, capacidad % y velocidad terminal; bloque de ventilación con longitudes editables.',
        },
        {
          nombre: 'Resumen accesorios',
          desc: 'Totales de codos, tees y demás accesorios agrupados por diámetro para presupuestar.',
        },
      ],
    },
    {
      titulo: 'Aguas lluvias',
      items: [
        {
          nombre: 'Diseño lluvias',
          desc: 'Tramos con caudal acumulado por método racional, Manning y verificación de capacidad y Froude.',
        },
        {
          nombre: 'Chequeo bajantes',
          desc: 'Q de diseño vs capacidad Wyly-Eaton (razón de llenado y Manning del material), en % — ver Normatividad.',
        },
        {
          nombre: 'Chequeo canales',
          desc: 'Capacidad del canal de cubierta (vertedero + canal rectangular) con área, pendiente y base/altura editables.',
        },
      ],
    },
    {
      titulo: 'Agua fría y agua caliente',
      items: [
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'UC por aparato y piso; base del caudal de diseño por tramo (curva K).',
        },
        {
          nombre: 'Diseño de red (tabla grande)',
          desc: '23 columnas: UC propia/others/caudal, K, diámetro estimado vs propuesto (editable), velocidad, pérdidas por fricción y presión inicial/final. Los chips "Otros Ramales" saltan a los tramos conectados.',
        },
        {
          nombre: 'Acometida (AF)',
          desc: 'Presión y diámetro de acometida + contador, con la presión garantizada o el tanque definidos en Información general.',
        },
        {
          nombre: 'Selección calentador (AC)',
          desc: 'Propone el calentador según el consumo de la red y hereda su presión.',
        },
      ],
    },
    {
      titulo: 'Gas',
      items: [
        {
          nombre: 'Datos generales',
          desc: 'Altitud, presión atmosférica, temperatura, presión mínima del operador y densidad relativa de la ciudad de diseño (Editar para modificar).',
        },
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'Unidades de consumo por aparato para el caudal de diseño de la red de gas.',
        },
        {
          nombre: 'Diseño de red + Chequeo',
          desc: 'Tabla de tramos con material y diámetro por Renouard (NTC 3728), diámetro interno, K y longitud; incluye el chequeo de la red y alimenta la memoria.',
        },
        {
          nombre: 'Resumen accesorios por diámetro',
          desc: 'Codos, tees y válvulas de la red de gas resumidos por diámetro nominal.',
        },
      ],
    },
    {
      titulo: 'Red contra incendio',
      items: [
        {
          nombre: 'Diseño de la red RCI',
          desc: 'Criterios NFPA 13 por piso, hidráulica de ramales y tramos extraída del dibujo (gris con candado 🔒), montante/siamesa, bomba y tanque, y las 44 verificaciones con «Ir al dato». El detalle paso a paso está en la guía de la red RCI.',
        },
      ],
    },
    // ── Guía POR RED (la navbar recibe cf:redes:<red> según la red activa) ──────────
    {
      titulo: 'Equipos',
      items: [
        {
          nombre: 'Bomba aguas residuales',
          desc: 'Caudal de bombeo (reserva 25%), alturas y TDH, selección de bomba y dimensionamiento de cámara con ampliación.',
        },
        {
          nombre: 'Equipo de presión',
          desc: 'Datos de entrada, cálculo hidráulico y potencia, diámetros y cisterna del equipo de presión constante.',
        },
      ],
    },
  ],

  // Criterios de diseño NTC 3631 (3ª actualización) — compartidos por las guías de gas y rejillas.
  'cf:redes:san': [
    {
      titulo: 'Sanitaria',
      items: [
        {
          nombre: 'Cálculo de unidades de descarga',
          desc: 'Conteo de aparatos por piso y UD acumuladas por bajante (tabla NTC 1500).',
        },
        {
          nombre: 'Diseño sanitario',
          desc: 'Tramos con UD propia/de otros/acumulada, caudal, diámetro calculado vs propuesto (editable), tirante, Froude, velocidad y fuerza tractiva ≥ 0,15.',
        },
        {
          nombre: 'Bajantes y ventilación',
          desc: 'Por bajante: pisos, UD, fracción de llenado, capacidad % y velocidad terminal; bloque de ventilación con longitudes editables.',
        },
        {
          nombre: 'Resumen accesorios',
          desc: 'Totales de codos, tees y demás accesorios agrupados por diámetro para presupuestar.',
        },
      ],
    },
  ],

  'cf:redes:ll': [
    {
      titulo: 'Aguas lluvias',
      items: [
        {
          nombre: 'Diseño lluvias',
          desc: 'Tramos con caudal acumulado por método racional, Manning y verificación de capacidad y Froude.',
        },
        {
          nombre: 'Chequeo bajantes',
          desc: 'Q de diseño vs capacidad Wyly-Eaton (razón de llenado y Manning del material), en % — ver Normatividad.',
        },
        {
          nombre: 'Chequeo canales',
          desc: 'Capacidad del canal de cubierta (vertedero + canal rectangular) con área, pendiente y base/altura editables.',
        },
      ],
    },
  ],

  'cf:redes:af': [
    {
      titulo: 'Agua fría',
      items: [
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'UC por aparato y piso; base del caudal de diseño por tramo (curva K).',
        },
        {
          nombre: 'Diseño de red (tabla grande)',
          desc: 'UC propia/others/caudal, K, diámetro estimado vs propuesto (editable), velocidad y pérdidas por fricción y presión. Los chips "Otros Ramales" saltan a los tramos conectados.',
        },
        {
          nombre: 'Acometida',
          desc: 'Presión y diámetro de acometida + contador, con la presión garantizada o el tanque definidos en Información general.',
        },
        {
          nombre: 'Resumen accesorios',
          desc: 'Codos, tees y válvulas de la red de agua fría por diámetro.',
        },
      ],
    },
  ],

  'cf:redes:ac': [
    {
      titulo: 'Agua caliente',
      items: [
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'UC por aparato y piso para el caudal de diseño de la red de agua caliente.',
        },
        {
          nombre: 'Diseño de red',
          desc: 'Tabla de tramos con diámetro editable, velocidades y pérdidas; hereda la presión del calentador seleccionado.',
        },
        {
          nombre: 'Selección calentador',
          desc: 'Propone el calentador según el consumo de la red y hereda su presión.',
        },
        {
          nombre: 'Resumen accesorios',
          desc: 'Codos, tees y válvulas de la red de agua caliente por diámetro.',
        },
      ],
    },
  ],

  'cf:redes:gas': [
    {
      titulo: 'Gas',
      items: [
        {
          nombre: 'Datos generales',
          desc: 'Altitud, presión atmosférica, temperatura, presión mínima del operador y densidad relativa de la ciudad de diseño (Editar para modificar).',
        },
        {
          nombre: 'Cálculo de unidades de consumo',
          desc: 'Unidades de consumo por aparato para el caudal de diseño de la red de gas.',
        },
        {
          nombre: 'Diseño de red + Chequeo',
          desc: 'Tabla de tramos con material y diámetro por Renouard (NTC 3728), diámetro interno, K y longitud; incluye el chequeo de la red y alimenta la memoria.',
        },
        {
          nombre: 'Rejillas de ventilación',
          desc: 'Página de la subred Rejillas: tipologías por sector y alzado de muro (ver los criterios NTC 3631 más abajo).',
        },
        {
          nombre: 'Resumen accesorios por diámetro',
          desc: 'Codos, tees y válvulas de la red de gas resumidos por diámetro nominal.',
        },
      ],
    },
    ...CRITERIOS_3631,
  ],

  'cf:redes:rejillas': [
    {
      titulo: 'Rejillas de ventilación (NTC 3631)',
      items: [
        {
          nombre: 'Tabla Tipologías',
          desc: 'Una fila por sector (área dibujada con Gas activa): recinto, gasodomésticos con unidades/kW/tipo, verificación, solución y rejillas sugeridas del catálogo.',
        },
        {
          nombre: 'Alzado de muro',
          desc: 'Esquema a escala del muro del sector: aberturas superior e inferior en su posición normativa con la rejilla sugerida y área libre rotulada.',
        },
        {
          nombre: 'Captura desde el visor',
          desc: 'Dibuja un Área con la pestaña Gas activa; en el panel derecho nómbrala, define la altura y asigna gasodomésticos — la tabla se llena sola.',
        },
        {
          nombre: 'Catálogo Maestro',
          desc: 'Página de rejillas comerciales (Silplas, Grival, Laminaire, Koolair, TROX): las referencias alimentan las sugerencias de la tabla.',
        },
      ],
    },
    ...CRITERIOS_3631,
  ],

  'cf:redes:bom': [
    {
      titulo: 'Bomba aguas residuales',
      items: [
        {
          nombre: 'Cálculo y selección',
          desc: 'Caudal de bombeo (reserva 25%), alturas y TDH, selección de bomba y dimensionamiento de cámara con ampliación.',
        },
      ],
    },
  ],

  'cf:redes:ep': [
    {
      titulo: 'Equipo de presión',
      items: [
        {
          nombre: 'Datos de entrada y diseño',
          desc: 'Caudales, pérdidas, presiones y cotas; cálculo hidráulico, potencia y verificación de diámetros del equipo de presión constante.',
        },
      ],
    },
  ],

  'cf:redes:rci': [
    {
      titulo: 'Red contra incendio (NFPA 13/14/20/22)',
      items: [
        {
          nombre: 'De dónde sale cada dato',
          desc: 'Lo que dibujaste en el visor (ramales con rociadores, tramos y el montante) llega como GRIS con candado 🔒: la geometría no se edita aquí, se corrige dibujando. Lo AMARILLO es del diseñador: criterios de rociadores, tipologías, bomba, tanque y siamesa.',
        },
        {
          nombre: 'Pestañas y Guía de diseño',
          desc: 'La pantalla se recorre con pestañas (Entradas, Rociadores, Tipologías, Hidráulica, Gabinetes, Perfil, Bomba y tanque, Soportes sísmicos, Verificaciones), cada una con sub-secciones al costado. El botón Guía de diseño (arriba a la izquierda, disponible siempre) abre los 9 pasos del cálculo con esquemas de tu proyecto y botones para saltar a cada pestaña.',
        },
        {
          nombre: 'Pisos y tipologías',
          desc: 'Una fila por piso: riesgo NFPA 13, sistema, techo, QR, K y S×L, salidas de manguera, válvula reguladora y VRP. Los pisos con los mismos criterios y planta comparten tipología: una red por tipología, calculada en su piso representativo ★.',
        },
        {
          nombre: 'Hidráulica del piso activo',
          desc: 'Tablas de Ramales y Tramos extraídas del plano (el primero es el más remoto). Editas "Fluyen", diámetro (Auto o el elegido) y material si el dibujo no lo trae; el motor calcula Q, pérdidas y presión en la derivación, y la selección de bomba se ajusta sola.',
        },
        {
          nombre: 'Montante y siamesa · Bomba y tanque',
          desc: 'Material y altura del montante, clase del sistema, conexión de bomberos, y la selección de la bomba (demanda, churn, motor, jockey) con el volumen del tanque. Todo recalcula al momento.',
        },
        {
          nombre: 'Verificaciones',
          desc: 'Las 44 comprobaciones normativas agrupadas por sección (Cumple / Revisar / No cumple / Pendiente) con «Ir al dato»: te lleva a la sección y enfoca el campo a corregir.',
        },
      ],
    },
  ],
};
