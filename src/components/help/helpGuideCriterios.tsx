import type { GuiaGrupo } from './helpGuideTypes';
/** Criterios de diseño NTC (Norma Tecnica Colombiana) 3631 (3ª actualización) — ventilación de recintos con gas (Gas). */
export const CRITERIOS_3631: GuiaGrupo[] = [
  {
    titulo: 'Tipos de artefacto (A/B/C)',
    items: [
      {
        nombre: 'Tipo A',
        desc: 'Tiraje natural: toma el aire de combustión del propio recinto y evacúa por conducto. Sí computa al requerimiento de ventilación.',
      },
      {
        nombre: 'Tipo B',
        desc: 'Tiraje natural con toma de aire del exterior por conducto de dilución; computa al requerimiento salvo que la norma del fabricante indique lo contrario.',
      },
      {
        nombre: 'Tipo C',
        desc: 'Sellados (balanceados): toman y descargan al exterior por concentrico. NO computan al volumen requerido (num. 4.1.1).',
      },
    ],
  },
  {
    titulo: 'Clasificación del recinto',
    items: [
      {
        nombre: 'Volumen requerido (Vreq)',
        desc: 'Vreq = 3,4 m³ por kW instalado, sin contar artefactos Tipo C (num. 4.1.1). V del recinto = área en planta × altura libre.',
      },
      {
        nombre: 'Con volumen suficiente',
        desc: 'V ≥ Vreq: el recinto aporta el aire de combustión por sí mismo; la ventilación puede resolverse al interior o al exterior.',
      },
      {
        nombre: 'Volumen insuficiente / confinado',
        desc: 'V < Vreq: el déficit debe resolverse con aberturas al exterior (directa, vertical u horizontal) o comunicación con un espacio suficiente.',
      },
    ],
  },
  {
    titulo: 'Mono espacio (Anexo B)',
    items: [
      {
        nombre: 'Definición',
        desc: 'Un solo ambiente sin divisiones rígidas: los separadores son muebles o divisiones livianas y el aire circula libremente.',
      },
      {
        nombre: 'Potencia máxima',
        desc: 'Pmax = área × altura / 3,4 (kW). Si la potencia instalada (sin Tipo C) ≤ Pmax, el mono espacio cumple sin ventilación adicional.',
      },
    ],
  },
  {
    titulo: 'Soluciones de ventilación',
    items: [
      {
        nombre: 'Método 1 — aberturas al exterior',
        desc: 'Área libre por coeficiente cm²/kW según el artefacto (6/11/22/44) aplicado a la potencia; mínimo 645 cm² para interiores del mismo piso.',
      },
      {
        nombre: 'Método 2 — conductos a neutro',
        desc: 'Área = mayor entre 11 cm²/kW y la suma de los conectores de evacuación (π·D²/4). PROHIBIDO para GLP.',
      },
      {
        nombre: 'Combinación (num. 4.3)',
        desc: 'Parte al interior y parte al exterior: el área exterior se reduce por el factor 1 − Vdisp/Vreq del espacio comunicado.',
      },
      {
        nombre: 'Estanco',
        desc: 'Recinto con solo artefactos Tipo C: no requiere aberturas de ventilación para combustión.',
      },
    ],
  },
  {
    titulo: 'Ubicación de las aberturas',
    items: [
      {
        nombre: 'Abertura superior',
        desc: 'A ≥ 1,80 m del piso terminado o a ≤ 0,30 m del techo (la que aplique al método).',
      },
      {
        nombre: 'Abertura inferior',
        desc: 'A ≤ 0,30 m del piso terminado; junto al artefacto más alto cuando sea posible.',
      },
      {
        nombre: 'Dimensiones mínimas',
        desc: 'Lado menor ≥ 8 cm en toda abertura; rejillas con malla de abertura ≥ 6,3 mm que no se obstruyan.',
      },
      {
        nombre: 'Comunicación interior',
        desc: 'Entre recinto y espacio comunicado la abertura debe ser permanente y de área libre suficiente (sin puertas que la cierren).',
      },
    ],
  },
  {
    titulo: 'Tipo de gas del proyecto',
    items: [
      {
        nombre: 'Natural',
        desc: 'Más liviano que el aire: admite los Métodos 1 y 2 y ventilación por conductos a neutro.',
      },
      {
        nombre: 'GLP',
        desc: 'Más denso que el aire: SOLO Método 1 (aberturas bajas al exterior); nunca conductos a neutro. Sin artefactos en sótanos (num. 3.2, 4.2.1).',
      },
    ],
  },
  {
    titulo: 'Rejillas del catálogo',
    items: [
      {
        nombre: 'Área efectiva',
        desc: 'Cada referencia comercial declara su área libre efectiva (lamas ~23–46% del hueco; colmenas hasta ~75%). La sugerencia elige la ref. cuyo área cubra la requerida.',
      },
      {
        nombre: 'Selección',
        desc: 'La tabla sugiere superior/única e inferior por separado; puedes cambiar de fabricante en Catálogo Maestro y la sugerencia se filtra a esa marca.',
      },
    ],
  },
  {
    titulo: 'Restricciones',
    items: [
      {
        nombre: 'Sótanos y servobodegas',
        desc: 'Sin ventilación al exterior no admiten artefactos a GLP (num. 3.2, 4.2.1 d); la tabla lo marca como alerta crítica.',
      },
      {
        nombre: 'Recintos adjuntos',
        desc: 'El volumen/potencia del espacio adjunto solo computa si la comunicación es por abertura interior permanente (num. 4.2.2: separaciones 2,5 cm lados/atrás y 16 cm al frente para Método 2).',
      },
    ],
  },
  {
    titulo: 'Cómo llenar "Solución"',
    items: [
      {
        nombre: 'Desplegable de solución',
        desc: 'Elige la estrategia REAL del proyecto: exterior directa / vertical / horizontal, interior, combinación o estanco. La tabla verifica con esa solución.',
      },
      {
        nombre: 'Resultado',
        desc: 'La columna "Solución aplicada" muestra lo que el cálculo resolvió con tu elección; las alertas avisan si no cumple la NTC.',
      },
    ],
  },
];
