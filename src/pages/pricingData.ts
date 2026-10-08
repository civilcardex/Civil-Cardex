// Datos de la página de precios: planes marketing, JSON-LD (FAQ/Product) y constantes de
// tarjeta. Extraído verbatim de PricingPage (des-monolitización 2026-10-06).
import type { ModuloId } from '../lib/subscriptions/catalog';

/** Cap del stepper "+" por tarjeta: anti-spam de clics; distinto al tope automático (por pedido total → CTA negociado). */
export const PUESTOS_CAP_STEPPER = 99;

export const plans = Object.freeze([
  {
    id: 'basico',
    nombre: 'Básico',
    precio: 'Gratis',
    periodo: '',
    desc: 'Para proyectos pequeños y estudiantes de ingeniería civil.',
    color: '#3B82F6',
    cta: 'Comenzar gratis',
    to: '/civilflowareatrabajo',
    features: [
      'Hasta 3 proyectos activos',
      'Módulos: Agua fría + Sanitaria',
      'Exportación CSV de resultados',
      'Generador de niveles NPT',
      'Tabla de aparatos NTC 1500',
      'Soporte por comunidad',
    ],
    missing: ['Módulo Red de Gas', 'Módulo contra incendio', 'Soporte técnico dedicado'],
  },
  {
    id: 'profesional',
    nombre: 'Profesional',
    precio: '$19',
    periodo: '/mes',
    desc: 'Para ingenieros civiles independientes y firmas pequeñas.',
    color: '#00f5ff',
    cta: 'Prueba gratis 7 días',
    to: '/civilflowareatrabajo',
    destacado: true,
    features: [
      'Proyectos ilimitados',
      '9 módulos completos',
      'Red de Gas (Renouard NTC 3728)',
      'Contra incendio (NSR-10 + NFPA 13)',
      'Exportación PDF memorias de cálculo',
      'Selección de calentadores (HACEB, BOSCH, RHEEM)',
      'Cálculo de bombas y equipos de presión',
      'Soporte por email < 24h',
      'Actualizaciones automáticas de normas NTC',
    ],
    missing: ['API de integración', 'Multi-usuario', 'Branding personalizado'],
  },
  {
    id: 'empresarial',
    nombre: 'Empresarial',
    precio: '$49',
    periodo: '/mes',
    desc: 'Para firmas de ingeniería y constructoras con múltiples proyectos.',
    color: '#A855F7',
    cta: 'Contactar ventas',
    to: '/civilflowareatrabajo',
    features: [
      'Todo lo de Profesional',
      'API REST para integración con BIM/ERP',
      'Hasta 5 usuarios colaboradores',
      'Branding personalizado en reportes',
      'Soporte prioritario < 4h',
      'Capacitación inicial incluida',
      'Dashboard de proyectos compartido',
      'Exportación masiva de proyectos',
      'Respaldo en la nube',
      'Historial de versiones de memorias',
    ],
    missing: [],
  },
]);

export const FAQ_JSONLD = Object.freeze({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '\u00bfQu\u00e9 incluye el plan gratuito?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'El plan gratuito incluye acceso a herramientas b\u00e1sicas de dise\u00f1o hidrosanitario con l\u00edmite de proyectos.',
      },
    },
    {
      '@type': 'Question',
      name: '\u00bfPuedo cambiar de plan en cualquier momento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'S\u00ed, puede actualizar o cancelar su plan en cualquier momento desde su perfil. El cambio es inmediato.',
      },
    },
    {
      '@type': 'Question',
      name: '\u00bfOfrecen descuentos para firmas de ingenier\u00eda?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'S\u00ed, contamos con planes empresariales con descuento por volumen. Cont\u00e1ctenos para una cotizaci\u00f3n personalizada.',
      },
    },
  ],
});

export const PRODUCT_JSONLD = Object.freeze({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Civil Cardex Profesional',
  image: 'https://civilcardex.com/logos/civilCardexlogo-v2.webp',
  description:
    'Plan Profesional para ingenieros civiles independientes y firmas pequeñas. Incluye 9 módulos completos, Red de Gas, Contra Incendio y exportación PDF.',
  brand: {
    '@type': 'Brand',
    name: 'Civil Cardex',
  },
  offers: {
    '@type': 'Offer',
    url: 'https://civilcardex.com/pricing',
    priceCurrency: 'USD',
    price: '19.00',
    priceValidUntil: '2027-12-31',
    availability: 'https://schema.org/InStock',
  },
});

export const BADGE_STYLE = {
  borderColor: '#1D4ED8',
  color: '#3B82F6',
  padding: '3px 10px',
  borderRadius: 20,
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  border: '1px solid #1D4ED8',
} as const;

// ---------------------------------------------------------------------------
// Página de compra por módulo (SUSCRIPCIONES_ACTIVAS = true).
// ---------------------------------------------------------------------------

/** Beneficios por módulo (estáticos — CATALOGO solo trae descripción corta). */
export const BENEFICIOS: Record<ModuloId, string[]> = {
  flow: [
    'Dibujo de redes sobre el plano PDF calibrado',
    'Cálculo AF/AC (Hunter), sanitaria, lluvias y gas (Renouard)',
    'Cuarto de bombas, equipos de presión y isometrías 3D',
    'Memorias de cálculo en Excel, Word y PDF',
    'Verificación NTC 1500 · RAS 2000 · NSR-10 · NTC 3728',
  ],
  manage: [
    'Análisis de precios unitarios (APU) con 4 secciones de recursos',
    'Catálogos: insumos, cuadrillas, equipos y proveedores',
    'Factor prestacional y estructura AIU configurables',
    'Presupuestos por capítulos con copia de catálogos',
    'Importa el formulario Excel del cliente y exporta Excel/PDF',
  ],
};

/** Logo por módulo (mismos assets del landing). */
export const LOGO: Record<ModuloId, string> = {
  flow: '/logos/civilFlowlogo.webp',
  manage: '/logos/civilManagelogo.webp',
};
