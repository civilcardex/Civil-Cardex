import { NormaLink } from '../../../components/shared/normasLinks';
import { Tabla } from './ui';

const manual = {
  name: 'Manual de usuario',
  desc: 'Guía paso a paso del flujo de trabajo en Civil Flow y normatividad aplicada.',
  icon: 'menu_book',
  color: '#4D8FF7',
  sections: [
    {
      title: 'Introducción',
      body: (
        <div className="space-y-3">
          <p>
            CIVILFLOW 2026 es un aplicativo web de diseño hidrosanitario desarrollado por el Ing.
            Camilo Cárdenas Chacón. Permite elaborar memorias de cálculo completas para redes de
            agua fría, agua caliente, sanitaria, aguas lluvias, gas y red contra incendio.
          </p>
          <p className="text-[13px] font-semibold">Normas aplicadas:</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">
              NTC 1500:2020
            </span>
            <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">
              RAS 2000
            </span>
            <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">
              NTC 3728
            </span>
            <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">
              NSR-10 Título J
            </span>
            <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">
              NFPA 13
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Interfaz del aplicativo',
      body: (
        <div className="space-y-4">
          <p>
            La interfaz de CIVILFLOW 2026 se divide en cinco zonas principales, cada una con
            funciones específicas para facilitar el diseño hidrosanitario:
          </p>

          <div className="border border-outline-variant rounded overflow-hidden">
            <div className="grid grid-cols-[140px,1fr] gap-0 text-[13px]">
              <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">
                Topbar
              </div>
              <div className="px-3 py-2 border-b border-outline-variant">
                Barra superior con el logo de CivilCardex, el nombre del sistema Civil Flow, los
                datos del ingeniero responsable (nombre, título, número de matrícula profesional) y
                las normas técnicas aplicables (NTC 1500, RAS 2000, NTC 3728, NSR-10). Se muestra
                también el nombre del proyecto activo.
              </div>

              <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">
                Nav / Pestañas
              </div>
              <div className="px-3 py-2 border-b border-outline-variant">
                Barra de navegación con pestañas para acceder a cada módulo del aplicativo: Planos
                (carga de PDF o imagen), Materiales (gestión de catálogos por red), Aparatos (tabla
                de unidades de consumo y descarga), Cubierta (cálculo de Aguas lluvias por método
                racional), Gas (diseño de redes por Renouard), Calentadores (selección de equipos a
                gas), Validación (resumen y verificación final).
              </div>

              <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">
                Sidebar
              </div>
              <div className="px-3 py-2 border-b border-outline-variant">
                Panel lateral izquierdo con tres secciones: Datos del proyecto (nombre, dirección,
                municipio, uso, empresa prestadora, presión de red, dotación), Materiales por red
                (selector de tipo de tubería para cada sistema: AF, AC, sanitaria, lluvias, gas,
                RCI), Redes a calcular (toggles para activar o desactivar cada red del proyecto) y
                Generador de niveles (configuración de sótanos, pisos, alturas y NPT).
              </div>

              <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">
                Content
              </div>
              <div className="px-3 py-2 border-b border-outline-variant">
                Área central donde se muestran las tablas, formularios y resultados del módulo
                seleccionado. Aquí se ingresan los datos de cada red, se visualizan los cálculos y
                se revisan las verificaciones de norma.
              </div>

              <div className="bg-surface-container-high font-semibold px-3 py-2">Act Bar</div>
              <div className="px-3 py-2">
                Barra de acción inferior que muestra en tiempo real los totales del proyecto:
                unidades de consumo (UC) de agua fría y caliente, unidades de descarga (UD)
                sanitarias, pérdida de presión acumulada de gas (ΔP) con indicador color verde/rojo
                según cumpla el límite NTC 3728.
              </div>
            </div>
          </div>

          <p className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            El orden de trabajo recomendado es: datos del proyecto, generación de niveles, selección
            de materiales, activación de redes, ajuste de aparatos, cálculo de cubierta, diseño de
            red de gas, selección de calentador y finalmente validación y exportación.
          </p>
        </div>
      ),
    },
    {
      title: 'Datos del proyecto',
      body: (
        <div className="space-y-3">
          <p>
            Complete los datos generales en el Sidebar. Estos datos aparecen en todas las memorias
            de cálculo.
          </p>
          <Tabla
            head={['Campo', 'Ejemplo']}
            rows={[
              ['Nombre del proyecto', 'Casa No. 26 CR Monte Real'],
              ['Dirección', 'CR 10 No. 25-40'],
              ['Ciudad', 'Floridablanca'],
              ['Uso', 'Vivienda unifamiliar'],
              ['Empresa prestadora', 'EMAB - Floridablanca'],
              ['P. red (m.c.a.)', '20'],
              ['Dotación (L/hab/dia)', '280'],
            ]}
          />
          <div className="text-[12px] text-on-surface-variant">
            Dotación según RAS 2000 Tabla B.2.1 — Vivienda unifamiliar: 200–280 L/hab/dia.
          </div>
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
        <Tabla
          head={['#', 'Red', 'Cuando activar']}
          rows={[
            ['1', 'Sanitaria', 'Siempre — obligatoria'],
            ['2', 'Aguas lluvias', 'Cuando hay cubierta'],
            ['4', 'Agua fría', 'Siempre — suministro'],
            ['5', 'Agua caliente', 'Cuando hay calentador'],
            ['6', 'Red de Gas', 'Cuando hay aparatos a gas'],
            ['7', 'Equipo presión', 'Presión de red insuficiente'],
            ['8', 'Bomba AR', 'Aguas residuales en sótano'],
            ['9', 'Recirculación AC', 'L de AC > 15 m'],
            ['10', 'Contra incendio', 'Según NSR-10 Título J'],
          ]}
        />
      ),
    },
    {
      title: 'Flujo de trabajo completo',
      body: (
        <Tabla
          head={['#', 'Tarea']}
          rows={[
            ['1', 'Datos del proyecto (Sidebar)'],
            ['2', 'Generar niveles'],
            ['3', 'Seleccionar materiales'],
            ['4', 'Activar redes'],
            ['5', 'Ajustar aparatos (UC, UD, Q gas)'],
            ['6', 'Ingresar cubierta (áreas, I)'],
            ['7', 'Calcular red de gas (Renouard)'],
            ['8', 'Seleccionar calentador'],
            ['9', 'Verificar validación'],
            ['10', 'Verificar validación final'],
          ]}
        />
      ),
    },
    {
      title: 'Normatividad aplicada',
      body: (
        <Tabla
          head={['Norma', 'Aplicación']}
          rows={[
            [
              <NormaLink nombre="NTC 1500">NTC 1500:2020</NormaLink>,
              'UC, UD, presiones, velocidades, diámetros mínimos',
            ],
            [
              <NormaLink nombre="RAS 2000">RAS 2000</NormaLink>,
              'Dotaciones, Manning, método racional',
            ],
            [
              <NormaLink nombre="NTC 3728">NTC 3728</NormaLink>,
              'Renouard, caudales gas, factor fs',
            ],
            [<NormaLink nombre="NSR-10">NSR-10 Título J</NormaLink>, 'Protección contra incendio'],
            [
              <NormaLink nombre="NFPA 13">NFPA 13:2022</NormaLink>,
              'Rociadores, densidad, área operación',
            ],
            [
              <NormaLink nombre="NFPA 20">NFPA 20</NormaLink>,
              'Instalación de bombas contra incendio (cuarto de bombas)',
            ],
            [
              <NormaLink nombre="NTC 3631">NTC 3631</NormaLink>,
              'Aparatos sanitarios — requisitos y ensayos',
            ],
            [
              <NormaLink nombre="RETIE">RETIE</NormaLink>,
              'Instalaciones eléctricas (tableros, bombas, polo a tierra)',
            ],
            [<NormaLink nombre="NTC 382">NTC 382</NormaLink>, 'PVC a presión, RDE'],
            [<NormaLink nombre="NTC 1087">NTC 1087</NormaLink>, 'PVC sanitario y lluvias'],
          ]}
          foot={
            <div className="text-[11px] text-on-surface-variant mt-2">
              Cada norma enlaza a su fuente oficial (MinVivienda, ICONTEC, NFPA, MinEnergía). Links
              verificados el 2026-09-30.
            </div>
          }
        />
      ),
    },
  ],
};

export default manual;
