# Protocolo de medición del visor y el guardado

La emulación táctil verifica interacción, no memoria ni velocidad de una tableta física.

1. Preparar una cuenta de pruebas y el mismo proyecto sintético para las dos revisiones: al menos 6 planos PDF, un plano con 500 elementos y un presupuesto con 1.000 ítems. Registrar revisión, navegador, dispositivo, tamaño de PDFs y tipo de conexión. No usar datos de obras reales.
2. En la misma tableta, medir desde elegir el plano hasta que se muestre el raster y el lienzo acepte interacción. Repetir 10 veces con sesión nueva (frío) y 10 después de volver al plano (caliente). Registrar mediana y peor muestra; conservar la traza.
3. Dibujar el mismo ramal de 10 puntos; grabar la traza y anotar intervalos entre cuadros y tareas largas. Sobre los mismos planos, alternar 20 veces y registrar memoria inicial, máxima y final cuando el navegador la exponga. Identificar por separado memoria del proceso y del montículo de JavaScript; si no se puede medir, marcar «no disponible».
4. En CivilManager modificar una celda, esperar confirmación y recargar. En el inspector registrar bytes enviados y duración de cada guardado, por separado de la espera local. Repetir 10 veces. No guardar cabeceras de autenticación ni el contenido de las peticiones.
5. Contrastar antes y después. Si el costo se concentra en el tamaño/tiempo del guardado completo, preparar un cambio separado. No cambiar la estrategia de guardado por una impresión subjetiva de lentitud.

Estado inicial: las mediciones físicas y la comparación de rendimiento están pendientes.
