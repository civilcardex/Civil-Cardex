const manual = {
    name: 'Manual de usuario',
    icon: 'menu_book',
    color: '#4D8FF7',
    sections: [
      {
        title: 'Introducción',
        body: (
          <div className="space-y-3">
            <p>CIVILFLOW KML 2026 es un aplicativo web de diseño hidrosanitario desarrollado por el Ing. Camilo Cárdenas Chacón. Permite elaborar memorias de cálculo completas para redes de Agua fría, Agua caliente, Sanitaria, Aguas lluvias, Gas combustible y Red contra incendio.</p>
            <p className="text-[13px] font-semibold">Normas aplicadas:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 1500:2020</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">RAS 2000</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 3728</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NSR-10 Título J</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NFPA 13</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Interfaz del aplicativo',
        body: (
          <div className="space-y-4">
            <p>La interfaz de CIVILFLOW KML 2026 se divide en cinco zonas principales, cada una con funciones específicas para facilitar el diseño hidrosanitario:</p>

            <div className="border border-outline-variant rounded overflow-hidden">
              <div className="grid grid-cols-[140px,1fr] gap-0 text-[13px]">
                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Topbar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra superior con el logo de la firma KML, el nombre del sistema Civil Flow, los datos del ingeniero responsable (nombre, título, número de matrícula profesional) y las normas técnicas aplicables (NTC 1500, RAS 2000, NTC 3728, NSR-10). Se muestra también el nombre del proyecto activo.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Nav / Pestañas</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra de navegación con pestañas para acceder a cada módulo del aplicativo: Planos (carga de PDF o imagen), Materiales (gestión de catálogos por red), Aparatos (tabla de unidades de consumo y descarga), Cubierta (cálculo de Aguas lluvias por método racional), Gas (diseño de redes por Renouard), Calentadores (selección de equipos a gas), Validación (resumen y verificación final).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Sidebar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Panel lateral izquierdo con tres secciones: Datos del proyecto (nombre, dirección, municipio, uso, empresa prestadora, presión de red, dotación), Materiales por red (selector de tipo de tubería para cada sistema: AF, AC, sanitaria, lluvias, gas, RCI), Redes a calcular (toggles para activar o desactivar cada red del proyecto) y Generador de niveles (configuración de sótanos, pisos, alturas y NPT).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Content</div>
                <div className="px-3 py-2 border-b border-outline-variant">Área central donde se muestran las tablas, formularios y resultados del módulo seleccionado. Aquí se ingresan los datos de cada red, se visualizan los cálculos y se revisan las verificaciones de norma.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2">Act Bar</div>
                <div className="px-3 py-2">Barra de acción inferior que muestra en tiempo real los totales del proyecto: unidades de consumo (UC) de agua fría y caliente, unidades de descarga (UD) sanitarias, pérdida de presión acumulada de gas (ΔP) con indicador color verde/rojo según cumpla el límite NTC 3728.</div>
              </div>
            </div>

            <p className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              El orden de trabajo recomendado es: datos del proyecto, generación de niveles, selección de materiales, activación de redes, ajuste de aparatos, cálculo de cubierta, diseño de red de gas, selección de calentador y finalmente validación y exportación.
            </p>
          </div>
        ),
      },
      {
        title: 'Datos del proyecto',
        body: (
          <div className="space-y-3">
            <p>Complete los datos generales en el Sidebar. Estos datos aparecen en todas las memorias de cálculo.</p>
            <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
              <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Campo</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ejemplo</th></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Nombre del proyecto</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Casa No. 26 CR Monte Real</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dirección</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">CR 10 No. 25-40</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Municipio</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Floridablanca</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Uso</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Vivienda unifamiliar</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Empresa prestadora</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">EMAB - Floridablanca</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. red (m.c.a.)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">20</td></tr>
              <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dotación (L/hab/dia)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">280</td></tr>
            </tbody></table></div>
            <div className="text-[12px] text-on-surface-variant">Dotación según RAS 2000 Tabla B.2.1 — Vivienda unifamiliar: 200–280 L/hab/dia.</div>
          </div>
        ),
      },
      {
        title: 'Generador de niveles',
        body: (
          <div className="space-y-3">
            <p>El generador automático de niveles se encuentra en la parte inferior del Sidebar.</p>
            <ol className="list-decimal list-inside text-[13px] space-y-1">
              <li>Definir N° de sótanos (0 si no aplica)</li>
              <li>Definir N° de pisos sobre rasante (min. 1)</li>
              <li>Altura de entrepiso (2.80–3.30 m) y sótano (2.80–3.00 m)</li>
              <li>NPT Piso 1 (nivel de referencia)</li>
              <li>Activar "Incluir cubierta" si aplica</li>
              <li>Hacer clic en "Generar niveles"</li>
            </ol>
          </div>
        ),
      },
      {
        title: 'Redes a calcular',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">#</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Red</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Cuando activar</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Sanitaria</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Siempre — obligatoria</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Aguas lluvias</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay cubierta</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Agua fría</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Siempre — suministro</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Agua caliente</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay calentador</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Red de Gas</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cuando hay aparatos a gas</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">7</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Equipo presión</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión de red insuficiente</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Bomba AR</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Aguas residuales en sótano</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">9</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Recirculación AC</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">L de AC &gt; 15 m</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">10</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Contra incendio</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Según NSR-10 Título J</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Flujo de trabajo completo',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">#</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Tarea</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Datos del proyecto (Sidebar)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Generar niveles</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">3</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Seleccionar materiales</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">4</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Activar redes</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ajustar aparatos (UC, UD, Q gas)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Ingresar cubierta (áreas, I)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">7</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Calcular red de gas (Renouard)</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Seleccionar calentador</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">9</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Verificar validación</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">10</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Verificar validación final</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Normatividad aplicada',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Norma</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Aplicación</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500:2020</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">UC, UD, presiones, velocidades, diámetros mínimos</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Dotaciones, Manning, método racional</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Renouard, caudales gas, factor fs</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NSR-10 Título J</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Protección contra incendio</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NFPA 13:2022</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Rociadores, densidad, área operación</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 382</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC a presión, RDE</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1087</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC sanitario y lluvias</td></tr>
          </tbody></table></div>
        ),
      },
    ],
};

export default manual;
