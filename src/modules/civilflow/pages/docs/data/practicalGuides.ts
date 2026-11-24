import type { docData } from './index.ts';

export type DocCategory = keyof typeof docData;

/** Ejemplos ficticios de uso, sin duplicar los criterios técnicos de cada categoría. */
export const practicalGuides: Record<
  DocCategory,
  {
    caso: string;
    prepara: string;
    revisa: string;
    evita: string;
    pasos: string[];
    resultado: string;
    relacionada: DocCategory;
  }
> = {
  manual: {
    caso: 'Vas a dibujar las redes de una vivienda de dos pisos.',
    prepara:
      'Crea el proyecto, carga un plano por nivel y fija la escala usando una distancia conocida en cada plano.',
    revisa:
      'Antes de dibujar, contrasta otra medida conocida y confirma que el nivel y la red activos son los correctos.',
    evita: 'Suponer que dos planos con el mismo formato tienen la misma escala.',
    pasos: [
      'Crea los niveles y carga el plano que corresponde a cada uno.',
      'Define la escala con una distancia que puedas comprobar en el plano.',
      'Contrasta la escala con una segunda dimensión conocida y revisa la orientación.',
      'Activa la red y el nivel antes de comenzar el trazado.',
      'Guarda y vuelve a abrir el proyecto para confirmar que planos y niveles quedaron asociados.',
    ],
    resultado:
      'Una base verificable: cada trazo queda en el nivel correcto y sus longitudes representan el plano.',
    relacionada: 'tablas',
  },
  hidraulica: {
    caso: 'Un tramo por gravedad recibió una advertencia tras cambiar su diámetro.',
    prepara: 'Ten a mano el caudal, el diámetro interior, la pendiente y el material del tramo.',
    revisa:
      'Lee juntos el llenado, la velocidad y el régimen de flujo; compara la fila con la versión anterior al cambio.',
    evita: 'Dar por resuelto el tramo solo porque aumentó su capacidad.',
    pasos: [
      'Confirma las unidades y los datos de entrada del tramo.',
      'Compara el resultado con los criterios que muestra la categoría.',
      'Ubica el primer tramo donde cambia el resultado y comprueba su material y longitud.',
      'Ajusta una variable a la vez y vuelve a leer la fila completa.',
      'Anota las condiciones finales para poder comparar revisiones del diseño.',
    ],
    resultado:
      'Un tramo revisado con sus condiciones de flujo y supuestos visibles, no solo con un diámetro elegido.',
    relacionada: 'sanitarias',
  },
  sanitarias: {
    caso: 'Dos baños descargan en un colector común.',
    prepara:
      'Identifica los aparatos que aporta cada ramal, dibuja la conexión al bajante y confirma el sentido de descarga y las cotas.',
    revisa:
      'Compara las unidades de descarga propias con las acumuladas y verifica la pendiente del tramo señalado por la tabla.',
    evita:
      'Contar otra vez, en el colector, los aparatos que ya entran por los ramales conectados.',
    pasos: [
      'Asocia cada aparato una sola vez.',
      'Traza las conexiones siguiendo el sentido de descarga.',
      'Comprueba que los ramales desembocan en el colector previsto.',
      'Revisa las cotas y la pendiente en el tramo común.',
      'Vuelve a leer las unidades aportadas y acumuladas para descartar duplicados.',
    ],
    resultado:
      'Una ruta de descarga continua, con aportes identificables desde cada baño hasta el colector.',
    relacionada: 'hidraulica',
  },
  lluvias: {
    caso: 'Una cubierta vierte hacia dos bajantes.',
    prepara:
      'Delimita el área que drena a cada salida e identifica la intensidad de lluvia y el tipo de superficie del caso.',
    revisa:
      'Comprueba qué área y caudal llegan a cada salida antes de comparar la capacidad del bajante.',
    evita:
      'Asignar a cada bajante el área completa de la cubierta cuando sus aportes son distintos.',
    pasos: [
      'Divide la cubierta por las salidas que realmente reciben el agua.',
      'Asocia cada área a su bajante.',
      'Documenta la fuente de intensidad de lluvia y el área asignada a cada salida.',
      'Compara el caudal asignado con la capacidad que presenta el cálculo.',
      'Revisa que no queden zonas sin salida ni áreas contadas dos veces.',
    ],
    resultado: 'Aportes trazables por bajante, sin duplicar el área tributaria de la cubierta.',
    relacionada: 'hidraulica',
  },
  agua_fria: {
    caso: 'La ducha del último piso tiene menos presión que los aparatos cercanos a la acometida.',
    prepara:
      'Confirma la presión de alimentación, los desniveles, el material, los diámetros y los aparatos conectados.',
    revisa:
      'Sigue la presión de entrada y salida tramo a tramo hasta la ducha para distinguir pérdida por fricción de cambio de elevación.',
    evita:
      'Comparar directamente la presión inicial de la acometida con la presión disponible en el aparato.',
    pasos: [
      'Sigue la ruta desde la alimentación hasta el aparato crítico.',
      'Separa los cambios de elevación de las pérdidas de cada tramo.',
      'Confirma que los diámetros y materiales corresponden a cada tramo recorrido.',
      'Revisa el resultado final en el punto de consumo más desfavorable.',
      'Compara el caso crítico con los demás aparatos antes de cerrar el diseño.',
    ],
    resultado:
      'La presión disponible al final de la ruta y los tramos que más contribuyen a su variación.',
    relacionada: 'equipos',
  },
  agua_caliente: {
    caso: 'Una red alimenta baños cercanos y alejados del calentador.',
    prepara:
      'Identifica el punto de alimentación, qué aparatos usan agua caliente y, si hay retorno, por dónde circula.',
    revisa:
      'Comprueba la alimentación desde el calentador y el resultado en el punto más alejado; verifica el retorno por separado.',
    evita:
      'Mezclar la ida y el retorno al leer una misma ruta o asumir que el calentador aporta la presión de la red pública.',
    pasos: [
      'Marca los aparatos atendidos por agua caliente.',
      'Revisa por separado la alimentación y el retorno si existe.',
      'Comprueba qué recorridos comparten tramos y dónde se separan.',
      'Contrasta el punto más alejado con las condiciones de entrada.',
      'Deja identificadas las condiciones de operación del retorno para su revisión.',
    ],
    resultado:
      'Una lectura separada de distribución y recirculación, sin confundir sus recorridos.',
    relacionada: 'agua_fria',
  },
  gas: {
    caso: 'Se agrega un aparato y cambia el resultado del tramo que comparte con la cocina.',
    prepara:
      'Confirma el tipo de gas, el consumo de los aparatos, la longitud y el diámetro de cada tramo de la ruta.',
    revisa:
      'Identifica en qué tramo aumenta la caída y revisa la presión en el extremo de la ruta completa.',
    evita:
      'Mezclar unidades de consumo o comparar una pérdida de un tramo con la caída acumulada total.',
    pasos: [
      'Verifica el tipo de gas y la unidad de consumo usada.',
      'Revisa los tramos compartidos antes de la derivación al aparato.',
      'Confirma longitudes y diámetros a lo largo de cada recorrido.',
      'Sigue la presión hasta el extremo de la ruta.',
      'Compara el escenario actual con el anterior para ubicar el efecto del nuevo aparato.',
    ],
    resultado: 'La ruta crítica y el tramo donde el nuevo consumo modifica más el resultado.',
    relacionada: 'formulas',
  },
  rci: {
    caso: 'Quieres revisar una red dibujada antes de preparar la memoria.',
    prepara:
      'Completa Clasificación y riesgo, Tubería y mangueras y las subpestañas de Montantes, Siamesa y Bomba que apliquen.',
    revisa:
      'Abre Verificaciones y usa «Ir al dato» para corregir el dato señalado; vuelve a revisar la ruta y el resultado después del ajuste.',
    evita:
      'Tomar un resultado preliminar como definitivo si todavía faltan datos del dibujo o del equipo.',
    pasos: [
      'Completa las entradas que aplican al sistema del proyecto.',
      'Abre cada advertencia con «Ir al dato» y corrige el campo de origen.',
      'Vuelve a Verificaciones después de cada corrección y guarda el proyecto.',
      'Comprueba que cada estado se actualizó con el valor corregido.',
      'Confirma que el resultado final corresponde al plano y a los equipos seleccionados.',
    ],
    resultado:
      'Un conjunto de verificaciones revisado junto con los datos de entrada y el trazado asociado.',
    relacionada: 'equipos',
  },
  equipos: {
    caso: 'Comparas dos bombas candidatas para la misma demanda.',
    prepara:
      'Reúne el caudal y la altura requeridos, las curvas del fabricante y los datos de la línea de succión.',
    revisa:
      'Ubica el punto de operación en la curva y compara, para ese caudal, la altura neta positiva de succión disponible con la requerida por la bomba.',
    evita:
      'Elegir solo por la potencia del motor o leer la succión requerida a un caudal distinto.',
    pasos: [
      'Define el caudal y la altura que debe cubrir el sistema.',
      'Compara las curvas disponibles en ese punto de operación.',
      'Revisa la velocidad y las condiciones de la tubería de succión.',
      'Revisa NPSH disponible y requerido al mismo caudal.',
      'Contrasta la selección final con la curva y ficha técnica del fabricante.',
    ],
    resultado:
      'Una comparación de alternativas en condiciones equivalentes, pendiente de validar con datos del fabricante.',
    relacionada: 'formulas',
  },
  normas_pais: {
    caso: 'Preparas un proyecto para un país distinto al del anterior.',
    prepara:
      'Confirma el país seleccionado en el proyecto y la fuente del criterio de la red que estás revisando.',
    revisa:
      'Distingue qué valores del perfil son de referencia y qué criterios requieren confirmación para el proyecto.',
    evita: 'Transferir límites de otro perfil como si fueran aplicables automáticamente.',
    pasos: [
      'Confirma el país configurado para el proyecto.',
      'Identifica la fuente y el alcance de cada referencia.',
      'Comprueba la edición y vigencia de la fuente aplicable.',
      'Contrasta los criterios aplicables con la documentación oficial del proyecto.',
      'Registra los criterios locales que requieren validación del responsable del diseño.',
    ],
    resultado:
      'Los valores de referencia separados de las decisiones que requieren validación normativa profesional.',
    relacionada: 'tablas',
  },
  tablas: {
    caso: 'La tabla destaca un tramo que no cumple una verificación.',
    prepara: 'Identifica la fila, el dato observado, su unidad y el límite mostrado.',
    revisa:
      'Compara valor y límite en la misma unidad. Corrige primero el dato de entrada que origina la diferencia y vuelve a revisar la fila.',
    evita:
      'Intentar corregir el resultado cambiando una columna calculada o guiándote solo por el color.',
    pasos: [
      'Abre el detalle de la fila y localiza el dato de entrada relacionado.',
      'Comprueba unidad, valor y criterio comparado.',
      'Sigue «Ir al dato» para revisar el campo que alimenta el resultado.',
      'Corrige el origen y repite la verificación.',
      'Confirma que cambió el estado y no solo la presentación de la fila.',
    ],
    resultado:
      'Una causa identificada y una verificación repetida, no un cambio cosmético en la tabla.',
    relacionada: 'normas_pais',
  },
  formulas: {
    caso: 'Quieres comprobar una pérdida de carga con un cálculo independiente.',
    prepara:
      'Elige la ecuación que corresponde a la red y anota las unidades con las que se ingresan el caudal, el diámetro y la longitud.',
    revisa:
      'Convierte antes de sustituir y compara la misma magnitud: una pérdida por kilómetro no equivale a la pérdida total del tramo.',
    evita: 'Usar diámetro nominal en una ecuación que pide diámetro interior.',
    pasos: [
      'Identifica la ecuación y su alcance.',
      'Convierte todas las entradas a las unidades esperadas.',
      'Sustituye los valores sin redondear antes de terminar la operación.',
      'Comprueba dimensiones y redondeo del resultado.',
      'Compara con la aplicación solo cuando ambas expresiones representan la misma magnitud.',
    ],
    resultado:
      'Una comparación reproducible entre la ecuación y la magnitud que muestra la aplicación.',
    relacionada: 'hidraulica',
  },
  manager: {
    caso: 'Vas a presupuestar la instalación de tubería por metro.',
    prepara:
      'Registra insumos, mano de obra y equipos en Catálogos; en el análisis de precios unitarios asigna consumos y rendimientos.',
    revisa:
      'Lleva el análisis a Presupuestos, ingresa la cantidad de obra y verifica que el subtotal corresponda a la unidad del análisis.',
    evita: 'Cargar el metrado total como consumo de un insumo que corresponde a un solo metro.',
    pasos: [
      'Completa los recursos del catálogo con sus unidades.',
      'Construye el análisis por unidad de obra y revisa rendimientos.',
      'Comprueba que cada recurso tenga precio y unidad compatibles con el análisis.',
      'En Presupuestos, introduce el metrado y revisa el subtotal.',
      'Revisa el total y la trazabilidad desde el presupuesto hasta los recursos del catálogo.',
    ],
    resultado:
      'Un presupuesto cuyo costo unitario y cantidad de obra se pueden rastrear hasta sus recursos.',
    relacionada: 'manual',
  },
};
