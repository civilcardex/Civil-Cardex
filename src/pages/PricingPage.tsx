import { devError } from '../utils/devError.ts';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { metaDeRuta } from '../seo/routeMeta.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { MODULES_DATA } from './moduleData.ts';
import { supabase } from '../lib/supabase';
import CheckoutModal from '../components/subscriptions/CheckoutModal.tsx';
import {
  CATALOGO,
  PUESTOS_TOPE_AUTOMATICO,
  SUSCRIPCIONES_ACTIVAS,
  calcularTotalCentavos,
  descuentoAplicado,
  descuentoPorPuestos,
  type ModuloId,
  type Periodo,
} from '../lib/subscriptions/catalog.ts';
import {
  dispararRefetchSuscripciones,
  edgePagoNoDesplegada,
  estaActiva,
} from '../lib/subscriptions/subscriptionsService.ts';
import { useSuscripciones } from '../hooks/useSubscriptions.ts';
import { plans, FAQ_JSONLD, PRODUCT_JSONLD, BADGE_STYLE } from './pricingData.ts';
import PricingHero from './pricing/PricingHero.tsx';
import { PricingPlans, PricingResumen } from './pricing/PricingPlans.tsx';
import PricingFaq from './pricing/PricingFaq.tsx';

function PricingSuscripciones() {
  usePageMeta(metaDeRuta('/pricing')?.title, metaDeRuta('/pricing')?.description);
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
  const [ignoraUrl, setIgnoraUrl] = useState(false);
  // ?modulo= reactivo: RequireModule redirige a /pricing?modulo=X con la página YA montada
  // (desde "Ver planes" con otro módulo) — el useState inicial no corre de nuevo. Derivado
  // en render (patrón repo: setState en effect dispara cascada).
  const seleccionMemo = useMemo(() => {
    const q = new URLSearchParams(location.search).get('modulo');
    if (q && CATALOGO.some((m) => m.id === q)) return new Set([q as ModuloId]);
    return null;
  }, [location.search]);
  /** ?modulo= siembra la selección SOLO hasta que el usuario interactúa: tras el primer toggle la elección es del usuario y el override del URL
   * debe morir, si no total/checkbox/modal leen conjuntos distintos. */
  const seleccionEfectiva = !ignoraUrl && seleccionMemo ? seleccionMemo : seleccion;
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  // Puestos por modulo (empresarial): 1 = individual. Tope automatico 24; 25+ negociado.
  const [puestos, setPuestos] = useState<Record<ModuloId, number>>({ flow: 1, manage: 1 });
  // Individual = 1 puesto por módulo (sin volumen). Empresarial = steppers + descuento por volumen.
  const [modo, setModo] = useState<'individual' | 'empresarial'>('individual');
  // Aviso informativo (no error) del resultado de la verificación al volver del checkout.
  const [avisoPago, setAvisoPago] = useState('');

  // Vuelta desde el checkout hosteado de Lemon Squeezy: verifica la referencia
  // con la edge function y refresca suscripciones. Limpia ?ref para no re-verificar.
  const refPago = new URLSearchParams(location.search).get('ref');
  // Referencia que aún no confirma (webhook en vuelo / edge sin deployar): el polling de
  // abajo la re-verifica cada 15 s. Las 2 cadenas viven aquí para que el primer check y
  // el polling no diverjan.
  const [refPendiente, setRefPendiente] = useState<string | null>(null);
  const AVISO_APROBADO = '¡Pago aprobado! Tu suscripción ya está activa.';
  const AVISO_REVISION =
    'Tu pago quedó en revisión (el monto no coincidió). Escríbenos y lo activamos a mano.';
  useEffect(() => {
    if (!refPago) return;
    let ignore = false;
    void (async () => {
      const { data, error: errVerif } = await supabase.functions.invoke('verificar-pago', {
        body: { referencia: refPago },
      });
      if (ignore) return;
      if (data?.aprobado) {
        setAvisoPago(AVISO_APROBADO);
        dispararRefetchSuscripciones();
      } else if (data?.estado === 'revision') {
        // Pago recibido pero bajo el monto esperado (p. ej. cupón): quedó en revisión.
        setAvisoPago(AVISO_REVISION);
      } else if (errVerif && edgePagoNoDesplegada(errVerif)) {
        // Edge Lemon pendiente de deploy (AGENTS.md ACTIVACIÓN paso 3): mientras falte,
        // el guard evita el error crudo — se informa como verificación pendiente, neutro.
        setAvisoPago(
          'Estamos verificando tu pago; tu suscripción quedará activa en breve y esta página se actualizará sola.',
        );
        setRefPendiente(refPago);
      } else {
        // Webhook aún en vuelo (normal: tarda segundos). Sin error, sin aprobado aún.
        setAvisoPago('Estamos verificando tu pago; esta página se actualizará sola.');
        setRefPendiente(refPago);
      }
      navigate('/pricing', { replace: true });
    })();
    return () => {
      ignore = true;
    };
  }, [refPago, navigate]);

  // Polling de la referencia sin confirmar: el aviso "se actualizará sola" era falso sin
  // esto (el webhook puede tardar >1 min). Tope de 20 intentos (~5 min) — después el
  // usuario recarga a mano; la BD sigue siendo el candado real.
  useEffect(() => {
    if (!refPendiente) return;
    let intentos = 0;
    const id = window.setInterval(() => {
      intentos += 1;
      if (intentos > 20) {
        setAvisoPago('Si tu pago no se refleja en unos minutos, recarga la página.');
        setRefPendiente(null);
        return;
      }
      void (async () => {
        let data: { aprobado?: boolean; estado?: string } | null = null;
        try {
          data = (
            await supabase.functions.invoke('verificar-pago', {
              body: { referencia: refPendiente },
            })
          ).data;
        } catch (e) {
          // Fallo de red/transitorio: el intervalo sigue — el tope de 20 corta.
          devError('verificar-pago (polling):', e);
          return;
        }
        if (data?.aprobado) {
          setAvisoPago(AVISO_APROBADO);
          dispararRefetchSuscripciones();
          setRefPendiente(null);
        } else if (data?.estado === 'revision') {
          setAvisoPago(AVISO_REVISION);
          setRefPendiente(null);
        }
        // ni aprobado ni revisión → el intervalo sigue
      })();
    }, 15000);
    return () => window.clearInterval(id);
  }, [refPendiente]);

  const modulosProx = useMemo(
    () => (['structure', 'terrain', 'roads'] as const).map((id) => MODULES_DATA[id]?.title ?? id),
    [],
  );

  const total = calcularTotalCentavos(
    [...seleccionEfectiva],
    periodo,
    modo === 'empresarial' ? puestos : undefined,
  );
  const totalPuestos =
    modo === 'empresarial'
      ? [...seleccionEfectiva].reduce((s2, id) => s2 + (puestos[id] ?? 1), 0)
      : 0;
  const negociado = modo === 'empresarial' && totalPuestos > PUESTOS_TOPE_AUTOMATICO;
  const dtoVolumen = modo === 'empresarial' ? descuentoPorPuestos(totalPuestos) : null;
  const descPct = seleccionEfectiva.size
    ? Math.round(descuentoAplicado([...seleccionEfectiva], periodo) * 100)
    : 0;
  const hayPago = seleccionEfectiva.size > 0;

  function toggle(id: ModuloId) {
    setIgnoraUrl(true);
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pagar() {
    if (!hayPago || negociado) return;
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
      <style>{`
        .pr-card { transition: border-color .15s, background .15s; }
        .pr-cta { transition: filter .15s, transform .15s; }
        .pr-cta:hover:not(:disabled) { filter: brightness(1.08); }
        .pr-cta:active:not(:disabled) { transform: translateY(1px); }
        ::-webkit-scrollbar-thumb{background:#dce3ea}
        ::-webkit-scrollbar-track{background:#1a1c20}
      `}</style>
      <Navbar />
      <main className="container mx-auto px-6 lg:px-8 py-24 pt-28">
        {/* Aviso neutro de verificación pendiente (edges Lemon sin deploy) — nunca error. */}
        {avisoPago && (
          <p
            role="status"
            className="max-w-4xl mx-auto mb-8 text-center"
            style={{
              fontSize: 14,
              color: '#b9caca',
              border: '1px solid #3a494a',
              borderRadius: 10,
              background: '#16191d',
              padding: '12px 18px',
            }}
          >
            {avisoPago}
          </p>
        )}
        {/* Encabezado */}
        <PricingHero modo={modo} setModo={setModo} periodo={periodo} setPeriodo={setPeriodo} />

        {/* Tarjetas de módulo */}
        <PricingPlans
          periodo={periodo}
          seleccion={seleccionEfectiva}
          loading={loading}
          toggle={toggle}
          empresarial={modo === 'empresarial'}
          puestos={puestos}
          onPuestos={(id, n) => setPuestos((pr) => ({ ...pr, [id]: n }))}
          vigente={vigente}
        />

        {/* Resumen + compra */}
        <PricingResumen
          seleccion={seleccionEfectiva}
          empresarial={modo === 'empresarial'}
          puestos={puestos}
          periodo={periodo}
          descPct={descPct}
          dtoVolumen={dtoVolumen}
          totalPuestos={totalPuestos}
          total={total}
          negociado={negociado}
          hayPago={hayPago}
          user={user}
          pagar={pagar}
          vigente={vigente}
        />

        <PricingFaq modulosProx={modulosProx} />
      </main>

      <CheckoutModal
        open={checkoutAbierto}
        onClose={() => setCheckoutAbierto(false)}
        modulos={[...seleccionEfectiva]}
        periodo={periodo}
        puestos={
          modo === 'empresarial'
            ? Object.fromEntries([...seleccionEfectiva].map((id) => [id, puestos[id] ?? 1]))
            : undefined
        }
      />
    </div>
  );
}

/** Página de planes (marketing): selección de módulos/puestos y periodo con totales calculados del catálogo; abre CheckoutModal. Sirve también como aterrizaje del retorno del checkout (?ref=). */
function PricingPage() {
  usePageMeta(metaDeRuta('/pricing')?.title, metaDeRuta('/pricing')?.description);
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
                        className="material-symbols-outlined text-sm! mt-0.5"
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
                        className="material-symbols-outlined text-sm! mt-0.5"
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
