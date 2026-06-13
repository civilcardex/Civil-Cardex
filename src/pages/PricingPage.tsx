import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';

const plans = [
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
missing: [
'Módulo Red de Gas',
'Módulo contra incendio',
'Soporte técnico dedicado',
],
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
    missing: [
      'API de integración',
      'Multi-usuario',
      'Branding personalizado',
    ],
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
];

function PricingPage() {
  usePageMeta('Precios');
  return (
    <div style={{ background: '#111317', color: '#e2e2e8', minHeight: '100vh' }}>
      <Navbar />
      <div className="container mx-auto px-6 lg:px-8 py-24 pt-28">
        <div className="text-center space-y-4 mb-20">
          <h1 className="text-primary uppercase" style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Planes y Precios
          </h1>
          <p className="text-base text-on-surface-variant max-w-xl mx-auto">
            Elija el plan que se adapte a su firma de ingeniería. Todos los planes incluyen verificación automática contra normativa colombiana vigente.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <span style={{ borderColor: '#1D4ED8', color: '#3B82F6', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, monospace', border: '1px solid #1D4ED8' }}>NTC 1500</span>
            <span style={{ borderColor: '#1D4ED8', color: '#3B82F6', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, monospace', border: '1px solid #1D4ED8' }}>RAS 2000</span>
            <span style={{ borderColor: '#1D4ED8', color: '#3B82F6', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, monospace', border: '1px solid #1D4ED8' }}>NTC 3728</span>
            <span style={{ borderColor: '#1D4ED8', color: '#3B82F6', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, monospace', border: '1px solid #1D4ED8' }}>NSR-10</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(plan => (
            <div key={plan.id} className="border p-8 flex flex-col relative"
              style={{
                background: plan.destacado ? '#1a1c20' : '#111317',
                borderColor: plan.destacado ? plan.color : '#3a494a',
                borderWidth: plan.destacado ? 2 : 1,
              }}>
              {plan.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: plan.color, color: '#003739', fontFamily: 'Geist, monospace' }}>
                  Recomendado
                </div>
              )}
              <div className="text-center mb-8">
                <h2 className="uppercase tracking-widest mb-2" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Geist, monospace', color: plan.color }}>
                  {plan.nombre}
                </h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Hanken Grotesk, sans-serif', color: plan.color }}>
                    {plan.precio}
                  </span>
                  {plan.periodo && (
                    <span className="text-on-surface-variant" style={{ fontSize: 14, fontFamily: 'Hanken Grotesk, sans-serif' }}>
                      {plan.periodo}
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-3" style={{ minHeight: 40 }}>
                  {plan.desc}
                </p>
              </div>
              <div className="flex-1 space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: '#2ff801', fontSize: 16 }}>
                      check_circle
                    </span>
                    <span className="text-[13px] text-on-surface-variant">{f}</span>
                  </div>
                ))}
                {plan.missing.map((f, i) => (
                  <div key={'m' + i} className="flex items-start gap-2 opacity-40">
                    <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: '#849495', fontSize: 16 }}>
                      remove
                    </span>
                    <span className="text-[13px] text-on-surface-variant">{f}</span>
                  </div>
                ))}
              </div>
              <Link
                to={plan.to}
                className="block text-center py-3 uppercase tracking-widest font-bold transition-all"
                style={{
                  fontSize: 11,
                  fontFamily: 'Geist, monospace',
                  background: plan.destacado ? plan.color : 'transparent',
                  color: plan.destacado ? '#003739' : plan.color,
                  border: plan.destacado ? 'none' : `1px solid ${plan.color}`,
                }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-20 space-y-2" style={{ borderTop: '1px solid #3a494a', paddingTop: 40 }}>
          <p className="text-[13px] text-on-surface-variant">
            ¿Necesita algo más específico?{' '}
            <Link to="/civilflowareatrabajo" className="text-primary hover:underline">Contáctenos</Link> para un plan a medida para su firma.
          </p>
          <p className="text-[12px] text-outline">Precios en USD. Facturación mensual. Cancele cuando quiera.</p>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
