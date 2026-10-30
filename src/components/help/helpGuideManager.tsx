import type { GUIA_TYPE } from './helpGuideTypes.tsx';
/** Guía contextual del módulo CM (Civil Manager): claves 'cm:<seccion>' y 'cm:catalogos:<tab>'. */
export const GUIA_MANAGER: GUIA_TYPE = {
  'cm:catalogos:configuracion': [
    {
      titulo: 'Parámetros APU',
      items: [
        {
          nombre: 'Salario base, auxilio, días/mes, horas/mes',
          desc: 'Base para calcular jornales y costo/hora de todos los cargos (respeta el perfil de país).',
        },
        {
          nombre: 'Herramienta menor %, Administración %, Imprevistos %, Utilidad %',
          desc: 'Porcentajes globales por defecto que usan los APU y presupuestos (pueden sobreescribirse por presupuesto).',
        },
        {
          nombre: 'Usar F.P. en cada APU / Aplicar AIU / Valor resumido',
          desc: 'Política de cálculo: factor prestacional incrustado o final, AIU por APU o al total, y si el presupuesto discrimina AIU.',
        },
      ],
    },
    {
      titulo: 'Factor prestacional y perfil de país',
      items: [
        {
          nombre: 'Tabla de factores por grupo',
          desc: 'Prestaciones, seguridad social y parafiscales (%): se suman al costo de cada cargo. Agrega los tuyos por grupo.',
        },
        {
          nombre: 'Perfil de país — Activo/Usar',
          desc: 'Copia SMMLV, auxilio y jornada de un país (31 perfiles precargados) a la configuración global. La moneda global no se toca: se elige una vez y persiste.',
        },
      ],
    },
    {
      titulo: 'Listas auxiliares',
      items: [
        {
          nombre: 'Unidades, Categorías, Tipos de equipo, Orígenes, Unidades de transporte',
          desc: 'Listas que alimentan los desplegables de insumos, APU y equipos. Borrado bloqueado si están en uso.',
        },
      ],
    },
  ],
  'cm:catalogos:colaboradores': [
    {
      titulo: 'Colaboradores (cargos)',
      items: [
        {
          nombre: 'N° Salarios Base',
          desc: 'Cuántos salarios mínimos gana el cargo (1.0 ayudante, 5.0 ingeniero jr…).',
        },
        {
          nombre: 'Costo Total Día / Hora',
          desc: 'Calculado: valor básico + factor prestacional, convertido a día y hora con la jornada del país. Se usa en cuadrillas y APU.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva de cargos con vista previa antes de aplicar.',
        },
        {
          nombre: 'Borrado con referencias',
          desc: 'No deja borrar un cargo usado en cuadrillas o APU — indica en qué.',
        },
      ],
    },
  ],
  'cm:catalogos:cuadrillas': [
    {
      titulo: 'Cuadrillas',
      items: [
        {
          nombre: 'Tabla maestro + panel derecho',
          desc: 'Selecciona una cuadrilla para editar su nombre y sus integrantes (cargo + cantidad).',
        },
        {
          nombre: 'Costo/día y Costo/hora',
          desc: 'Suma de los jornales de sus integrantes — es lo que divide el rendimiento en el APU.',
        },
        {
          nombre: 'Agregar Integrante',
          desc: 'Añade filas cargo/cantidad; el costo se recalcula en vivo.',
        },
      ],
    },
  ],
  'cm:catalogos:equipos': [
    {
      titulo: 'Equipos',
      items: [
        {
          nombre: 'Costo/Hora',
          desc: 'Tarifa horaria del equipo que se reparte por rendimiento en la sección Equipo del APU.',
        },
        {
          nombre: 'Tipo',
          desc: 'Clasificación (maquinaria pesada, equipo menor, transporte…) — la lista se edita en Configuración.',
        },
        {
          nombre: 'Proveedor',
          desc: 'Ficha comercial asociada; se elige del catálogo de proveedores.',
        },
        {
          nombre: 'Cotizado',
          desc: 'Fecha de la última cotización — se resalta cuando está vieja para que la actualices.',
        },
        {
          nombre: 'Buscar',
          desc: 'Filtra por código, nombre o tipo mientras escribes.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva con vista previa; borrado bloqueado si el equipo está en algún APU.',
        },
      ],
    },
  ],
  'cm:catalogos:insumos': [
    {
      titulo: 'Insumos',
      items: [
        {
          nombre: 'Unidad / Costo Unitario',
          desc: 'Unidad de medida y precio de compra del material (categoría, marca y proveedor opcionales).',
        },
        {
          nombre: 'Origen = Preparado en obra',
          desc: 'El costo NO se digita: se toma del APU básico seleccionado (ej. concreto mezclado en sitio) y se actualiza en cadena.',
        },
        {
          nombre: 'Exportar / Importar Excel',
          desc: 'Carga masiva con vista previa; borrado bloqueado si el insumo está en APU.',
        },
      ],
    },
  ],
  'cm:catalogos:proveedores': [
    {
      titulo: 'Proveedores',
      items: [
        {
          nombre: 'Nombre, NIT, contacto, ciudad',
          desc: 'Ficha comercial del proveedor (teléfonos, correo, dirección, notas).',
        },
        {
          nombre: 'Asociación con catálogos',
          desc: 'Los equipos e insumos pueden referenciar al proveedor; el borrado se bloquea mientras exista esa referencia.',
        },
      ],
    },
  ],
  'cm:apus': [
    {
      titulo: 'Catálogo de APU',
      items: [
        {
          nombre: 'Nuevo APU',
          desc: 'Crea un análisis con código automático APU-xxx; elige categoría y unidad de obra.',
        },
        {
          nombre: 'Costo Unitario en vivo',
          desc: 'Se recalcula al editar cualquier recurso (motor de cálculo central).',
        },
        {
          nombre: 'Exportar Excel / PDF',
          desc: 'Ficha completa del APU (secciones A–D + total) para entregar o revisar.',
        },
        {
          nombre: 'APU básico (preparado en obra)',
          desc: 'Marca el APU como costo origen para insumos "preparado en obra".',
        },
      ],
    },
    {
      titulo: 'Editor por secciones',
      items: [
        {
          nombre: 'A. Mano de obra',
          desc: 'Cargos × cantidad de personas y rendimiento (und/día): el jornal sale con su factor prestacional.',
        },
        { nombre: 'B. Equipo', desc: 'Equipos con su rendimiento y costo/hora.' },
        {
          nombre: 'C. Insumos',
          desc: 'Consumo por unidad + desperdicio % (5% por defecto). Los "preparado en obra" toman el precio del APU básico.',
        },
        {
          nombre: 'D. Transporte',
          desc: 'Tarifa × distancia (km) según unidad de transporte; Global ignora distancia.',
        },
        {
          nombre: 'Resumen',
          desc: 'Mano de obra + herramienta menor % + prestaciones + equipo + insumos + transporte = Total directo.',
        },
      ],
    },
  ],
  'cm:presupuestos': [
    {
      titulo: 'Proyectos',
      items: [
        {
          nombre: 'Nuevo Presupuesto',
          desc: 'Crea un presupuesto que copia (snapshot) catálogos, factores y APU del momento: lo que calcule después no cambia si editas los catálogos globales.',
        },
        {
          nombre: 'Estado (Borrador/En Revisión/Cerrado)',
          desc: 'Control de ciclo de vida editable en línea en la tabla.',
        },
      ],
    },
    {
      titulo: 'Ítems',
      items: [
        {
          nombre: 'Agregar Ítem',
          desc: 'Filas con descripción, unidad, cantidad y APU asignado. El Vr. Unitario sale del APU (en rojo si falta).',
        },
        {
          nombre: 'Marcar como capítulo',
          desc: 'Convierte la fila en agrupador de capítulo para organizar el presupuesto.',
        },
      ],
    },
    {
      titulo: 'Resumen AIU',
      items: [
        {
          nombre: 'Administración / Imprevistos / Utilidad / IVA sobre utilidad',
          desc: 'Porcentajes propios de ESTE presupuesto (sobre la base configurada): calcula el valor total a partir del costo directo.',
        },
      ],
    },
    {
      titulo: 'Entregables e importación',
      items: [
        {
          nombre: 'Excel detallado / Listado de precios / PDF ficha',
          desc: 'Tres exportaciones del presupuesto listas para el cliente.',
        },
        {
          nombre: 'Importar Formulario',
          desc: 'Sube el Excel del cliente, mapea columnas (ítem, descripción, unidad, cantidad) y crea los ítems en lote; el mapeo se guarda como favorito.',
        },
      ],
    },
  ],
};
