/** Definiciones de la pestaña ENTRADAS del diseño RCI (Red Contra Incendio): los campos por
 *  sub-pestaña (GRUPOS, espejo del FORM del HTML de referencia — la ayuda `ayu` es la
 *  observación que pinta la 5ª columna de GrupoTabla), la nota bajo el título, los iconos del
 *  header y las filas del modal «¿Qué clase elegir?». Datos puros (sin React). Ej:
 *  GRUPOS.siamesa[0].path === 'sia.n'. ponytail: no inscrito en MODULOS_NUEVOS (G5 exigiría un
 *  test artificial de datos puros); techo de facto = TOPE_NUEVO (700) del guard G1.
 *  Una const por sub-pestaña vive en su propio archivo (defNormativa, defBomba, …) y aquí se
 *  arma el registro GRUPOS + el índice de dependencias que usa notaDeps. */
import type { DefCampo } from '../RCIGroupTable.tsx';
import { GRUPO_NORMATIVA } from './defNormativa.ts';
import { GRUPO_CLASIFICACION } from './defClasificacion.ts';
import { GRUPO_TUBERIA } from './defTuberia.ts';
import { GRUPO_MONTANTES } from './defMontantes.ts';
import { GRUPO_SIAMESA } from './defSiamesa.ts';
import { GRUPO_SELECCION, GRUPO_SUCCION, GRUPO_JOCKEY, GRUPO_TANQUE } from './defBomba.ts';

/** Campos por sub-pestaña (FORM del HTML de referencia; sin meta.* ni notas). */
export const GRUPOS: Record<string, DefCampo[]> = {
  normativa: GRUPO_NORMATIVA,
  clasificacion: GRUPO_CLASIFICACION,
  tuberia: GRUPO_TUBERIA,
  montantes: GRUPO_MONTANTES,
  siamesa: GRUPO_SIAMESA,
  seleccion: GRUPO_SELECCION,
  succion: GRUPO_SUCCION,
  jockey: GRUPO_JOCKEY,
  tanque: GRUPO_TANQUE,
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

export { NOTA_SUB, ICONO_SUB } from './notasSub.ts';
export { FILAS_CLASE } from './classRows.ts';
