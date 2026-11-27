/**
 * Verificaciones de ALMACENAMIENTO POR PISO (NFPA 13 cap. 20-25): solo los pisos con
 * almacenamiento «Sí» (columna de Pisos del edificio) y sus fichas activas se evalúan. Ej:
 * un piso con Sí y riesgo leve → "Riesgo NFPA 13 compatible con almacenamiento" en NO CUMPLE;
 * con Sí y sin fichas → PENDIENTE ("registre al menos una zona").
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { isSi } from '../hydraulics';
import { RIESGOS_BAJO_MINIMO_ALMACENAMIENTO } from '../tables.ts';
import type { ChecksCtx } from './helpers';
import { evaluarZona, pisoDeZona } from '../storageZones.ts';
import type { PisoRow } from '../types.ts';

/** Clave estable del piso (la misma que vincula las fichas: planId o planta). */
const claveDe = (p: PisoRow): string => String(p.planId || p.planta || '');

export function verificarAlmacenamiento(ctx: ChecksCtx): void {
  const { st, add } = ctx;
  const c = st.clas;
  const pisos = st.pisos.rows;
  const zonas = c.zonasAlmacenamiento ?? [];
  const clavesVivas = new Set(pisos.map(claveDe).filter(Boolean));

  /* Fichas sin piso vivo: nunca se borran — la reasignación es explícita en Pisos del
   * edificio (botón «Reasignar zonas»). */
  const huerfanas = zonas.filter((z) => !z.piso || !clavesVivas.has(z.piso));
  if (huerfanas.length)
    add(
      'Zonas de almacenamiento por reasignar',
      'PENDIENTE',
      `${huerfanas.length} ficha(s)`,
      'Datos del proyecto',
      'Su piso ya no existe o quedó sin asignar. Reasígnalas desde Pisos del edificio; los datos se conservan.',
      ['tipologias', 'zonas-reasignar'],
    );

  /* Solo pisos con «Sí»: cambiar a Sí no reclasifica nada, solo activa la revisión. */
  for (let i = 0; i < pisos.length; i++) {
    const piso = pisos[i];
    if (!isSi(piso.almacen)) continue;
    /* Restricción del cálculo simplificado: G2 es el mínimo; el riesgo guardado incompatible
     * se avisa EN LA FILA de ese piso (no reclasifica nada automáticamente). Va antes de las
     * fichas: aplica también a un piso «Sí» que aún no tiene zonas registradas. */
    if (RIESGOS_BAJO_MINIMO_ALMACENAMIENTO.has(piso.riesgo || ''))
      add(
        'Riesgo NFPA 13 compatible con almacenamiento',
        'NO CUMPLE',
        `${piso.riesgo} / almacenamiento: Sí`,
        'NFPA 13-2025 cap. 4',
        'Riesgo ordinario G2 es el límite inferior del cálculo simplificado de CivilFlow, no una aprobación: cambie el riesgo de este piso o su decisión de almacenamiento.',
        ['tipologias', `piso:${i}:almacen`],
      );
    const fichas = zonas.filter((z) => z.piso === claveDe(piso));
    if (!fichas.length) {
      add(
        `Almacenamiento · ${piso.nombre || `Piso ${i + 1}`}`,
        'PENDIENTE',
        'Almacenamiento: Sí · sin zonas',
        'Alcance del cálculo simplificado de CivilFlow · NFPA 13',
        'Registre al menos una zona en la celda Zonas del piso.',
        ['tipologias', `piso:${i}:zonas`],
      );
      continue;
    }
    const mapa = new Map(pisos.map((p) => [pisoDeZona(p), p]));
    for (const zona of fichas) {
      const pisoZona = mapa.get(zona.piso);
      const rev = evaluarZona(zona, pisoZona);
      add(
        `Almacenamiento · ${zona.nombre.trim() || 'Zona sin nombre'}`,
        pisoZona && rev.fuera ? 'REVISAR' : 'PENDIENTE',
        !pisoZona ? 'Pendiente de datos · asigne un piso' : rev.estado,
        'Alcance del cálculo simplificado de CivilFlow · NFPA 13',
        !pisoZona
          ? 'Elija o reasigne el piso de la ficha.'
          : rev.estado === 'Pendiente de datos'
            ? 'Complete los datos faltantes o corrija las dimensiones de la ficha.'
            : 'Revise el diseño de almacenamiento con el profesional responsable.',
        ['tipologias', `piso:${i}:zonas`],
      );
    }
  }

  /* Arrume histórico del proyecto antiguo: SOLO referencia de lectura — no se copia a zonas
   * ni se usa como máximo de un piso. */
  const arr = Number(c.arrumeH);
  if (Number.isFinite(arr) && arr > 0)
    add(
      'Altura de arrume histórica · referencia de solo lectura',
      arr > 3.66 ? 'REVISAR' : 'PENDIENTE',
      `${f1(arr)} m`,
      'Datos históricos del proyecto',
      'Referencia conservada del proyecto anterior: registre y revise cada zona sin atribuirle este dato automáticamente.',
      ['tipologias', 'pisos'],
    );
}
