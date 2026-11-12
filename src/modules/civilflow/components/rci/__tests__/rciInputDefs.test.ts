import { describe, it, expect } from 'vitest';
import { GRUPOS, notaDeps, NOTA_SUB, ICONO_SUB, FILAS_CLASE } from '../RCIInputDefs.ts';

/* Test de CARACTERIZACIÓN de RCIInputDefs (escrito ANTES del split en inputDefs/): congela el
 * total de defs por sub-pestaña, una def resuelta POR PAÍS (la ayuda lee perfilRciDe) y defs
 * completas — si el split rompe un nombre o un dato, esto grita. Ej: borrar por accidente la
 * fila `sia.h` bajaría el total y el deep-equal falla. */

/** Ayudas de `local.codLocal` evaluadas por país (la def es la misma; cambia el perfil leído). */
const COD_LOCAL_POR_PAIS: Record<string, string> = {
  Colombia: 'Precargado: NSR-10 Título J · NTC 1500',
  Perú: 'Precargado: RNE A.130 · NTP 350.043-1',
  Ecuador: 'Precargado: NEC-11 Sección 17',
  Chile: 'Precargado: DS 44/2022 · OGUC 4.2',
  Argentina: 'Precargado: IRAM 3517 · legislación provincial',
  Bolivia: 'Precargado: NFPA 13 (referencia)',
};

/** Ayudas de `local.refRoc` por país (Bolivia cae al fallback «Artículo del código local»). */
const REF_ROC_POR_PAIS: Record<string, string> = {
  Colombia: 'NSR-10 J.1 (según uso y altura) · NTC 1500 cap. 9',
  Perú: 'RNE A.130-6 (riesgo según uso)',
  Ecuador: 'NEC-17.1 (riesgo según uso y altura)',
  Chile: 'OGUC 4.2 (según uso y altura)',
  Argentina: 'IRAM 3517-1 (según riesgo)',
  Bolivia: 'Artículo del código local',
};

const CATEGORIAS = [
  'normativa',
  'clasificacion',
  'tuberia',
  'montantes',
  'siamesa',
  'seleccion',
  'succion',
  'jockey',
  'tanque',
];

/** Ayu de una def resuelta con un estado mínimo (solo lo que la ayuda lee: meta.pais). */
function ayuDe(path: string, pais: string): string {
  const def = GRUPOS.normativa.find((c) => c.path === path);
  expect(def).toBeDefined();
  return (def!.ayu as (r: unknown, e: { meta: { pais?: string } }) => string)(null, {
    meta: { pais },
  });
}

describe('RCIInputDefs — caracterización', () => {
  it('total de defs y conteo por sub-pestaña congelados', () => {
    expect(Object.keys(GRUPOS).sort()).toEqual([...CATEGORIAS].sort());
    const counts = Object.fromEntries(CATEGORIAS.map((k) => [k, GRUPOS[k].length]));
    expect(counts).toEqual({
      normativa: 15,
      clasificacion: 8,
      tuberia: 5,
      montantes: 11,
      siamesa: 14,
      seleccion: 7,
      succion: 15,
      jockey: 1,
      tanque: 1,
    });
    const total = Object.values(counts).reduce((a: number, b: number) => a + b, 0);
    expect(total).toBe(77);
  });

  it('cada path aparece UNA vez en todo GRUPOS', () => {
    const paths = CATEGORIAS.flatMap((k) => GRUPOS[k].map((c) => c.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('def de código local congelada por país (perfilRciDe mapea los 6)', () => {
    for (const [pais, esperado] of Object.entries(COD_LOCAL_POR_PAIS)) {
      expect(ayuDe('local.codLocal', pais)).toBe(esperado);
    }
  });

  it('def de artículo ROC congelada por país (con fallback Bolivia)', () => {
    for (const [pais, esperado] of Object.entries(REF_ROC_POR_PAIS)) {
      expect(ayuDe('local.refRoc', pais)).toBe(esperado);
    }
  });

  it('def completa congelada: clas.constr (optsPar valor corto → etiqueta larga)', () => {
    const def = GRUPOS.clasificacion.find((c) => c.path === 'clas.constr');
    expect(def).toEqual({
      path: 'clas.constr',
      lbl: 'Construcción del techo',
      optsPar: [
        ['No combustible / no obstruida', 'No combustible, o combustible sin obstrucción'],
        ['Combustible obstruida', 'Combustible obstruida, elementos a ≥ 0,91 m'],
        ['Combustible, elementos < 0,91 m', 'Combustible, elementos a < 0,91 m entre ejes'],
      ],
      ayu: 'Riesgo leve: cobertura máx. 225 / 168 / 130 ft² según la opción. Ver ayuda en Tipologías',
    });
  });

  it('def completa congelada: sia.h (num + rango) y meta.pais (soloLectura)', () => {
    const siaH = GRUPOS.siamesa.find((c) => c.path === 'sia.h');
    expect({ ...siaH, rango: undefined }).toEqual({
      path: 'sia.h',
      lbl: 'Altura de las entradas sobre el andén',
      num: true,
      uni: 'm',
      ayu: 'NFPA 14: entre 0,46 y 1,22 m (18 y 48 in)',
      dep: 'local.exigeSP',
      rango: undefined,
    });
    // El rango (función) se congela por su salida: NFPA 14 → 0,46 a 1,22 m.
    expect(siaH!.rango!(null as never, null as never)).toEqual({ min: 0.46, max: 1.22 });
    // meta.pais lleva ayu como función: se congela por estructura y por su salida.
    const metaPais = GRUPOS.normativa.find((c) => c.path === 'meta.pais');
    expect({ ...metaPais, ayu: undefined }).toEqual({
      path: 'meta.pais',
      lbl: 'País del proyecto',
      soloLectura: true,
      ayu: undefined,
    });
    const ayuPais = metaPais!.ayu as (r: unknown, e: { meta: { pais?: string } }) => string;
    expect(ayuPais(null, { meta: { pais: 'Chile' } })).toBe('Del país escogido: Chile');
    expect(ayuPais(null, { meta: {} })).toBe('Del país escogido: Colombia');
  });

  it('notaDeps cita la tabla fuente con el formato lista', () => {
    expect(notaDeps(GRUPOS.montantes)).toBe(
      'Requiere «Sí» en «¿Exige montantes / gabinetes?» (Normativa) para habilitar:\n' +
        '• Clase de sistema\n• Número de montantes\n• Diámetro mínimo del montante\n' +
        '• Cota de la salida más baja del edificio',
    );
    expect(notaDeps(GRUPOS.siamesa)).toBe(
      'Requiere «Sí» en «¿Exige montantes / gabinetes?» (Normativa) para habilitar:\n' +
        '• Número de siamesas\n• Entradas de 2½" por siamesa\n• Rosca de las entradas\n' +
        '• NPT del andén frente a la siamesa\n• Altura de las entradas sobre el andén\n' +
        '• Material de la tubería de la siamesa\n• Diámetro de la tubería de la siamesa\n' +
        '• Longitud de la siamesa a la base del montante\n• Codos 90°\n• Tees con giro\n' +
        '• Cheques (válvula de retención)\n• ¿Hay válvula de cierre entre la siamesa y el sistema?\n' +
        '• ¿Drenaje automático entre la siamesa y el cheque?\n• Distancia al hidrante más cercano',
    );
    expect(notaDeps(GRUPOS.jockey)).toBe('');
  });

  it('NOTA_SUB e ICONO_SUB congelados', () => {
    expect(NOTA_SUB).toEqual({
      normativa: 'No interviene en los cálculos',
      succion:
        'NPSH (Net Positive Suction Head): energía disponible en la succión para evitar cavitación',
      montantes:
        'Clase y caudal se habilitan si el código exige gabinetes; el montante aplica siempre',
      siamesa:
        'Se habilita si el código exige montantes; se supone conectada en la base del montante',
    });
    expect(ICONO_SUB).toEqual({
      normativa: '/iconos/normativa_local.webp',
      clasificacion: '/iconos/clasificacion_riesgo.webp',
      montantes: '/iconos/montantes_nfpa14.webp',
      siamesa: '/iconos/siamesa.webp',
      seleccion: '/iconos/seleccion_bomba.webp',
      succion: '/iconos/succion_cavitacion.webp',
      jockey: '/iconos/bomba_jockey.webp',
      tanque: '/iconos/tanque.webp',
      tuberia: '/iconos/tuberia_mangueras.webp',
    });
  });

  it('FILAS_CLASE congeladas (las 3 clases del modal)', () => {
    expect(FILAS_CLASE).toEqual([
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
    ]);
  });
});
