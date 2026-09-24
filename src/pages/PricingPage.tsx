import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import { MODULES_DATA } from './moduleData';
import WompiCheckoutModal from '../components/suscripciones/WompiCheckoutModal';
import {
  CATALOGO,
  DESCUENTO_PAQUETE,
  SUSCRIPCIONES_ACTIVAS,
  calcularTotalCentavos,
  formatCOP,
  type ModuloId,
  type ModuloVenta,
  type Periodo,
} from '../lib/suscripciones/catalogo';
import { estaActiva } from '../lib/suscripciones/suscripcionesService';
import { useSuscripciones } from '../hooks/useSuscripciones';

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
];

const FAQ_JSONLD = {
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
};

const PRODUCT_JSONLD = {
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
};

const BADGE_STYLE = {
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
function PricingSuscripciones() {
  usePageMeta(
    'Precios',
    'Compre CivilCardex por módulo: CivilFlow y CivilManager, mensual o anual, con descuento por paquete. Pago seguro con Wompi.',
  );
  const { user } = useAuth();
  const { rows, loading } = useSuscripciones();
  const location = useLocation();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [seleccion, setSeleccion] = useState<Set<ModuloId>>(() => {
    const q = new URLSearchParams(location.search).get('modulo');
    const inicial = new Set<ModuloId>();
    if (q && CATALOGO.some((m) => m.id === q)) inicial.add(q as ModuloId);
    return inicial;
  });
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);

  const modulosProx = useMemo(
    () =>
      (['structure', 'terrain', 'bim', 'mep', 'roads'] as const).map(
        (id) => MODULES_DATA[id]?.title ?? id,
      ),
    [],
  );

  const total = calcularTotalCentavos([...seleccion], periodo);
  const conDescuento = seleccion.size >= 2;

  function toggle(id: ModuloId) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pagar() {
    if (seleccion.size === 0) return;
    if (!user) {
      navigate('/login');
      return;
    }
    setCheckoutAbierto(true);
  }

  function vigente(id: ModuloId) {
    return rows.find((r) => r.modulo === id && estaActiva(r));
  }

  return (
    <div
      className="landing-root"
      style={{ background: '#111317', color: '#e2e2e8', minHeight: '100vh' }}
    >
      <Navbar />
      <main className="container mx-auto px-6 lg:px-8 py-24 pt-28">
        <section className="text-center space-y-4 mb-12">
          <h1
            className="text-primary uppercase"
            style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            Módulos y Precios
          </h1>
          <p className="text-base text-on-surface-variant max-w-xl mx-auto">
            Compre solo los módulos que necesita. Llévese los dos y obtenga{' '}
            {Math.round(DESCUENTO_PAQUETE * 100)}% de descuento. Pago seguro con Wompi (tarjeta, PSE
            o Nequi).
          </p>
          <div className="flex justify-center gap-1 pt-2">
            {(['mensual', 'anual'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                aria-pressed={periodo === p}
                style={{
                  ...BADGE_STYLE,
                  cursor: 'pointer',
                  background: periodo === p ? '#1D4ED8' : 'transparent',
                  color: periodo === p ? '#fff' : '#3B82F6',
                  textTransform: 'uppercase',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {periodo === 'anual' && (
            <p className="text-[12px] text-outline">Pagando anual ahorras 2 meses por módulo.</p>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {CATALOGO.map((m) => (
            <ModuleCard
              key={m.id}
              modulo={m}
              periodo={periodo}
              seleccionado={seleccion.has(m.id)}
              vigencia={vigente(m.id)}
              loading={loading}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </section>

        <section
          className="max-w-4xl mx-auto mt-8 border p-6"
          style={{ background: '#111317', borderColor: '#3a494a' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-[13px] text-on-surface-variant space-y-1">
              <p>
                {seleccion.size === 0
                  ? 'Seleccione uno o ambos módulos.'
                  : [...seleccion]
                      .map((id) => CATALOGO.find((c) => c.id === id)?.nombre)
                      .join(' + ')}
              </p>
              {conDescuento && (
                <p style={{ color: '#2ff801' }}>
                  Descuento por paquete (−{Math.round(DESCUENTO_PAQUETE * 100)}%) aplicado.
                </p>
              )}
              {(['flow', 'manage'] as const)
                .filter((id) => vigente(id))
                .map((id) => (
                  <p key={id}>
                    {CATALOGO.find((c) => c.id === id)?.nombre} activo hasta{' '}
                    {new Date(vigente(id)!.fecha_fin).toLocaleDateString('es-CO')} — comprar de
                    nuevo extiende la vigencia desde la fecha actual.
                  </p>
                ))}
            </div>
            <div className="text-right">
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: 'Hanken Grotesk, sans-serif',
                  color: '#00f5ff',
                }}
              >
                {formatCOP(total)}
              </p>
              <p className="text-[11px] text-outline mb-2">
                {periodo === 'anual' ? 'por año' : 'por mes'} · renovación manual
              </p>
              <button
                type="button"
                onClick={pagar}
                disabled={seleccion.size === 0}
                className="uppercase tracking-widest font-bold transition-all"
                style={{
                  fontSize: 12,
                  fontFamily: 'Geist, monospace',
                  padding: '10px 22px',
                  background: seleccion.size === 0 ? '#1a1c20' : '#00f5ff',
                  color: seleccion.size === 0 ? '#5a6a6b' : '#003739',
                  border: 'none',
                  cursor: seleccion.size === 0 ? 'default' : 'pointer',
                }}
              >
                {user || seleccion.size === 0 ? 'Pagar con Wompi' : 'Inicia sesión y paga'}
              </button>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto mt-12">
          <h2
            className="uppercase tracking-widest mb-4"
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'Geist, monospace',
              color: '#849495',
            }}
          >
            Próximamente
          </h2>
          <div className="flex flex-wrap gap-2">
            {modulosProx.map((m) => (
              <span
                key={m}
                className="text-[12px] px-3 py-1 border"
                style={{ borderColor: '#3a494a', color: '#849495' }}
              >
                {m}
              </span>
            ))}
          </div>
        </section>

        <section
          className="text-center mt-16 space-y-2"
          style={{ borderTop: '1px solid #3a494a', paddingTop: 40 }}
        >
          <p className="text-[12px] text-outline">
            Precios en COP. Pago único por período elegido; la renovación es manual — la app le
            avisará al vencer.
          </p>
        </section>
      </main>

      <WompiCheckoutModal
        open={checkoutAbierto}
        onClose={() => setCheckoutAbierto(false)}
        modulos={[...seleccion]}
        periodo={periodo}
      />
    </div>
  );
}

function ModuleCard({
  modulo,
  periodo,
  seleccionado,
  vigencia,
  loading,
  onToggle,
}: {
  modulo: ModuloVenta;
  periodo: Periodo;
  seleccionado: boolean;
  vigencia?: { fecha_fin: string };
  loading: boolean;
  onToggle: () => void;
}) {
  const precio = periodo === 'anual' ? modulo.precioAnualCentavos : modulo.precioMensualCentavos;
  return (
    <div
      className="border p-8 flex flex-col relative"
      style={{
        background: seleccionado ? '#1a1c20' : '#111317',
        borderColor: seleccionado ? '#00f5ff' : '#3a494a',
        borderWidth: seleccionado ? 2 : 1,
      }}
    >
      <label
        className="absolute top-4 right-4 flex items-center gap-2 cursor-pointer"
        style={{ fontSize: 11, color: '#849495' }}
      >
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={onToggle}
          aria-label={`Comprar ${modulo.nombre}`}
        />
        Comprar
      </label>
      <div className="text-center mb-6">
        <h2
          className="uppercase tracking-widest mb-2"
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Geist, monospace',
            color: '#00f5ff',
          }}
        >
          {modulo.nombre}
        </h2>
        <div className="flex items-baseline justify-center gap-1">
          <span
            style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily: 'Hanken Grotesk, sans-serif',
              color: '#00f5ff',
            }}
          >
            {formatCOP(precio)}
          </span>
          <span
            className="text-on-surface-variant"
            style={{ fontSize: 14, fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            {periodo === 'anual' ? '/año' : '/mes'}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-3" style={{ minHeight: 40 }}>
          {modulo.descripcion}
        </p>
        {!loading && vigencia && (
          <p className="text-[12px] mt-2" style={{ color: '#2ff801' }}>
            Activo hasta {new Date(vigencia.fecha_fin).toLocaleDateString('es-CO')}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página de planes (marketing) — rama por defecto con SUSCRIPCIONES_ACTIVAS off.
// ---------------------------------------------------------------------------
function PricingPage() {
  usePageMeta(
    'Precios',
    'Planes y precios de CivilCardex. Elija el plan ideal para ingeniería civil: básico, profesional o empresarial.',
  );
  if (SUSCRIPCIONES_ACTIVAS) return <PricingSuscripciones />;
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(FAQ_JSONLD)}</script>
      <script type="application/ld+json">{JSON.stringify(PRODUCT_JSONLD)}</script>
      <style>{`::-webkit-scrollbar-thumb{background:#dce3ea}::-webkit-scrollbar-thumb:hover{background:#f0f4f8}::-webkit-scrollbar-track{background:#1a1c20}`}</style>
      <div
        className="landing-root"
        style={{ background: '#111317', color: '#e2e2e8', minHeight: '100vh' }}
      >
        <Navbar />
        <main className="container mx-auto px-6 lg:px-8 py-24 pt-28">
          <section className="text-center space-y-4 mb-20">
            <h1
              className="text-primary uppercase"
              style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Planes y Precios
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl mx-auto">
              Elija el plan que se adapte a su firma de ingeniería. Todos los planes incluyen
              verificación automática contra normativa colombiana vigente.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <span style={BADGE_STYLE}>NTC 1500</span>
              <span style={BADGE_STYLE}>RAS 2000</span>
              <span style={BADGE_STYLE}>NTC 3728</span>
              <span style={BADGE_STYLE}>NSR-10</span>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="border p-8 flex flex-col relative"
                style={{
                  background: plan.destacado ? '#1a1c20' : '#111317',
                  borderColor: plan.destacado ? plan.color : '#3a494a',
                  borderWidth: plan.destacado ? 2 : 1,
                }}
              >
                {plan.destacado && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background: plan.color,
                      color: '#003739',
                      fontFamily: 'Geist, monospace',
                    }}
                  >
                    Recomendado
                  </div>
                )}
                <div className="text-center mb-8">
                  <h2
                    className="uppercase tracking-widest mb-2"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'Geist, monospace',
                      color: plan.color,
                    }}
                  >
                    {plan.nombre}
                  </h2>
                  <div className="flex items-baseline justify-center gap-1">
                    <span
                      style={{
                        fontSize: 40,
                        fontWeight: 700,
                        fontFamily: 'Hanken Grotesk, sans-serif',
                        color: plan.color,
                      }}
                    >
                      {plan.precio}
                    </span>
                    {plan.periodo && (
                      <span
                        className="text-on-surface-variant"
                        style={{ fontSize: 14, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
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
                      <span
                        className="material-symbols-outlined text-sm mt-0.5"
                        style={{ color: '#2ff801', fontSize: 16 }}
                      >
                        check_circle
                      </span>
                      <span className="text-[13px] text-on-surface-variant">{f}</span>
                    </div>
                  ))}
                  {plan.missing.map((f, i) => (
                    <div key={'m' + i} className="flex items-start gap-2 opacity-40">
                      <span
                        className="material-symbols-outlined text-sm mt-0.5"
                        style={{ color: '#849495', fontSize: 16 }}
                      >
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
                    fontSize: 12,
                    fontFamily: 'Geist, monospace',
                    background: plan.destacado ? plan.color : 'transparent',
                    color: plan.destacado ? '#003739' : plan.color,
                    border: plan.destacado ? 'none' : `1px solid ${plan.color}`,
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </section>

          <section
            className="text-center mt-20 space-y-2"
            style={{ borderTop: '1px solid #3a494a', paddingTop: 40 }}
          >
            <p className="text-[13px] text-on-surface-variant">
              ¿Necesita algo más específico?{' '}
              <Link to="/civilflowareatrabajo" className="text-primary hover:underline">
                Contáctenos
              </Link>{' '}
              para un plan a medida para su firma.
            </p>
            <p className="text-[12px] text-outline">
              Precios en USD. Facturación mensual. Cancele cuando quiera.
            </p>
          </section>
        </main>
      </div>
    </>
  );
}

export default PricingPage;
