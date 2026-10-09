import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import { MODULES_DATA } from './moduleData';
import { supabase } from '../lib/supabase';
import CheckoutModal from '../components/subscriptions/CheckoutModal';
import {
  CATALOGO,
  DESCUENTO_BASE,
  DESCUENTO_POR_MODULO,
  PUESTOS_TOPE_AUTOMATICO,
  SUSCRIPCIONES_ACTIVAS,
  calcularTotalCentavos,
  descuentoAplicado,
  descuentoPorPuestos,
  formatUSD,
  precioDePeriodo,
  type ModuloId,
  type ModuloVenta,
  type Periodo,
} from '../lib/subscriptions/catalog';
import {
  dispararRefetchSuscripciones,
  edgePagoNoDesplegada,
  estaActiva,
} from '../lib/subscriptions/subscriptionsService';
import { useSuscripciones } from '../hooks/useSubscriptions';
import {
  plans,
  FAQ_JSONLD,
  PRODUCT_JSONLD,
  BADGE_STYLE,
  BENEFICIOS,
  LOGO,
  PUESTOS_CAP_STEPPER,
} from './pricingData';

function ModuleCard({
  modulo,
  periodo,
  seleccionado,
  vigencia,
  loading,
  onToggle,
  empresarial,
  puesto,
  onPuestos,
}: {
  modulo: ModuloVenta;
  periodo: Periodo;
  seleccionado: boolean;
  vigencia?: { fecha_fin: string };
  loading: boolean;
  onToggle: () => void;
  empresarial: boolean;
  puesto: number;
  onPuestos: (n: number) => void;
}) {
  const precio = precioDePeriodo(modulo, periodo);
  return (
    // Tarjeta = control de selección completo (role=checkbox): clic en cualquier parte.
    <div
      role="checkbox"
      aria-checked={seleccionado}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="pr-card border p-7 flex flex-col cursor-pointer select-none"
      style={{
        background: seleccionado ? '#181c21' : '#111317',
        borderColor: seleccionado ? '#e8c84a' : '#3a494a',
        borderWidth: seleccionado ? 2 : 1,
        borderRadius: 14,
        margin: seleccionado ? -1 : 0,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <img
          src={LOGO[modulo.id]}
          alt={`Logo ${modulo.nombre}`}
          width={230}
          height={76}
          style={{
            objectFit: 'contain',
            objectPosition: 'left center',
            maxHeight: 76,
            marginLeft: -8,
          }}
        />
        {/* Check circular (visual — la tarjeta entera es el control) */}
        <span
          aria-hidden="true"
          className="material-symbols-outlined"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            border: seleccionado ? 'none' : '1px solid #3a494a',
            background: seleccionado ? '#e8c84a' : 'transparent',
            color: seleccionado ? '#161a1e' : 'transparent',
          }}
        >
          check
        </span>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Hanken Grotesk, sans-serif' }}>
        {modulo.nombre}
      </h2>
      <p className="text-sm text-on-surface-variant mt-1">{modulo.descripcion}</p>

      <div style={{ borderTop: '1px solid #2a3234', margin: '16px 0 14px' }} aria-hidden="true" />
      <div className="flex items-baseline gap-2">
        <span
          style={{
            fontSize: 34,
            fontWeight: 700,
            fontFamily: 'Hanken Grotesk, sans-serif',
            color: '#e2e2e8',
          }}
        >
          {formatUSD(precio)}
        </span>
        <span className="text-on-surface-variant" style={{ fontSize: 13 }}>
          {periodo === 'mensual' ? '/mes' : periodo === 'semestral' ? '/6 meses' : '/año'}
        </span>
      </div>
      <p className="text-[11px] text-outline">
        pago único del período · renovación manual{empresarial ? ' · precio por puesto' : ''}
      </p>
      {empresarial && (
        <div className="mt-3 inline-flex items-center gap-2">
          <button
            type="button"
            aria-label={`Menos puestos de ${modulo.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              onPuestos(Math.max(1, puesto - 1));
            }}
            className="pr-cta"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              border: '1px solid #3a494a',
              background: '#1e2126',
              color: '#e2e2e8',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            −
          </button>
          <span
            className="text-[13px] text-on-surface-variant"
            style={{ minWidth: 78, textAlign: 'center' }}
          >
            {puesto} {puesto === 1 ? 'puesto' : 'puestos'}
          </span>
          <button
            type="button"
            aria-label={`Más puestos de ${modulo.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              // Cap por pedido TOTAL (no por módulo): 25+ puestos totales = negociado, lo decide el CTA; puestosDe sanea al leer.
              onPuestos(Math.min(PUESTOS_CAP_STEPPER, puesto + 1));
            }}
            className="pr-cta"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              border: '1px solid #3a494a',
              background: '#1e2126',
              color: '#e2e2e8',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      )}

      <ul
        className="mt-4 space-y-2"
        style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 16 }}
      >
        {BENEFICIOS[modulo.id].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="material-symbols-outlined"
              style={{ color: '#2ff801', fontSize: 15, marginTop: 2 }}
            >
              check_circle
            </span>
            <span className="text-[13px] text-on-surface-variant">{f}</span>
          </li>
        ))}
      </ul>

      {!loading && vigencia && (
        <p className="text-[12px] mt-4 flex items-center gap-1" style={{ color: '#2ff801' }}>
          <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 14 }}>
            event_available
          </span>
          Activo hasta {new Date(vigencia.fecha_fin).toLocaleDateString('es-CO')}
        </p>
      )}
    </div>
  );
}

function PricingSuscripciones() {
  usePageMeta(
    'Precios',
    'Compre CivilCardex por módulo: CivilFlow y CivilManager, mensual, semestral o anual, con descuentos acumulativos. Pago seguro con tarjeta (Lemon Squeezy).',
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
  const [ignoraUrl, setIgnoraUrl] = useState(false);
  // ?modulo= reactivo: RequireModule redirige a /pricing?modulo=X con la página YA montada
  // (desde "Ver planes" con otro módulo) — el useState inicial no corre de nuevo. Derivado
  // en render (patrón repo: setState en effect dispara cascada).
  const seleccionMemo = useMemo(() => {
    const q = new URLSearchParams(location.search).get('modulo');
    if (q && CATALOGO.some((m) => m.id === q)) return new Set([q as ModuloId]);
    return null;
  }, [location.search]);
  /** ?modulo= siembra la selección SOLO hasta que el usuario interactúa: tras el
   *  primer toggle la elección es del usuario y el override del URL debe morir,
   *  si no total/checkbox/modal leen conjuntos distintos. */
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
  useEffect(() => {
    if (!refPago) return;
    let ignore = false;
    void (async () => {
      const { data, error: errVerif } = await supabase.functions.invoke('verificar-pago', {
        body: { referencia: refPago },
      });
      if (!ignore) {
        if (data?.aprobado) dispararRefetchSuscripciones();
        else if (errVerif && edgePagoNoDesplegada(errVerif)) {
          // Edge Lemon pendiente de deploy (AGENTS.md ACTIVACIÓN paso 3): mientras falte,
          // el guard evita el error crudo — se informa como verificación pendiente, neutro.
          setAvisoPago(
            'Estamos verificando tu pago; tu suscripción quedará activa en breve y esta página se actualizará sola.',
          );
        }
      }
      navigate('/pricing', { replace: true });
    })();
    return () => {
      ignore = true;
    };
  }, [refPago, navigate]);

  const modulosProx = useMemo(
    () =>
      (['structure', 'terrain', 'bim', 'mep', 'roads'] as const).map(
        (id) => MODULES_DATA[id]?.title ?? id,
      ),
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
  const conDescuento = descPct > 0;
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
        <section className="text-center space-y-4 mb-12">
          <p
            className="uppercase"
            style={{
              fontSize: 11,
              letterSpacing: 3,
              fontWeight: 700,
              fontFamily: 'Geist, monospace',
              color: '#849495',
            }}
          >
            Precios
          </p>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily: 'Hanken Grotesk, sans-serif',
              color: '#e2e2e8',
              lineHeight: 1.15,
            }}
          >
            Compra solo los módulos que necesitas
          </h1>
          <p className="text-base text-on-surface-variant max-w-2xl mx-auto">
            Pago único por el período elegido — la renovación es manual y la app le avisa antes de
            vencer. Pago seguro con tarjeta — checkout hosteado por Lemon Squeezy.
          </p>
          {/* Tipo de plan: individual (1 puesto) vs empresarial (puestos + volumen) */}
          <div
            className="inline-flex pt-2"
            role="group"
            aria-label="Tipo de plan"
            style={{
              border: '1px solid #3a494a',
              borderRadius: 10,
              padding: 4,
              background: '#16191d',
              gap: 4,
            }}
          >
            {(['individual', 'empresarial'] as const).map((m) => {
              const on = modo === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  aria-pressed={on}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 18px',
                    background: on ? '#4D8FF7' : 'transparent',
                    color: on ? '#fff' : '#b9caca',
                    fontFamily: 'Geist, monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {/* Selector de período segmentado (estático) */}
          <div
            className="inline-flex pt-2"
            style={{
              border: '1px solid #3a494a',
              borderRadius: 10,
              padding: 4,
              background: '#16191d',
              gap: 4,
            }}
          >
            {(['mensual', 'semestral', 'anual'] as const).map((p) => {
              const on = periodo === p;
              const pct = Math.round(DESCUENTO_BASE[p] * 100);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  aria-pressed={on}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 18px',
                    background: on ? '#e8c84a' : 'transparent',
                    color: on ? '#161a1e' : '#b9caca',
                    fontFamily: 'Geist, monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {p}
                  {pct > 0 && !on && (
                    <span
                      style={{ color: '#52f2a5', marginLeft: 6, fontSize: 13, fontWeight: 700 }}
                    >
                      −{pct}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-outline">
            {modo === 'empresarial'
              ? 'Precios POR PUESTO. Volumen: 2-4 puestos −10% · 5-9 −15% · 10-24 −20% · 25 o más, negociado con nosotros.'
              : DESCUENTO_BASE[periodo] > 0
                ? `${Math.round(DESCUENTO_BASE[periodo] * 100)}% de descuento desde el primer módulo; +${Math.round(DESCUENTO_POR_MODULO * 100)}% por cada módulo adicional.`
                : `Sin descuento base: cada módulo adicional suma ${Math.round(DESCUENTO_POR_MODULO * 100)}% de descuento.`}
          </p>
        </section>

        {/* Tarjetas de módulo */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {CATALOGO.map((m) => (
            <ModuleCard
              key={m.id}
              modulo={m}
              periodo={periodo}
              seleccionado={seleccionEfectiva.has(m.id)}
              vigencia={vigente(m.id)}
              loading={loading}
              onToggle={() => toggle(m.id)}
              empresarial={modo === 'empresarial'}
              puesto={puestos[m.id] ?? 1}
              onPuestos={(n) => setPuestos((pr) => ({ ...pr, [m.id]: n }))}
            />
          ))}
        </section>

        {/* Resumen + compra */}
        <section
          className="max-w-4xl mx-auto mt-8"
          style={{
            border: '1px solid #3a494a',
            borderRadius: 14,
            background: '#16191d',
            padding: '20px 24px',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-5">
            <div className="min-w-[220px]">
              <p
                className="uppercase"
                style={{
                  fontSize: 14,
                  letterSpacing: 2,
                  fontWeight: 700,
                  fontFamily: 'Geist, monospace',
                  color: '#849495',
                }}
              >
                Tu compra
              </p>
              <div className="mt-2 space-y-1">
                {seleccionEfectiva.size === 0 ? (
                  <p className="text-[14px] text-on-surface-variant">
                    Seleccione uno o ambos módulos.
                  </p>
                ) : (
                  [...seleccionEfectiva].map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <img
                        src={LOGO[id]}
                        alt=""
                        width={18}
                        height={18}
                        style={{ objectFit: 'contain' }}
                      />
                      <span className="text-[14px]">
                        {CATALOGO.find((c) => c.id === id)?.nombre}
                        {modo === 'empresarial' && (
                          <span className="text-on-surface-variant">
                            {' '}
                            × {puestos[id] ?? 1} {(puestos[id] ?? 1) === 1 ? 'puesto' : 'puestos'}
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
                {conDescuento && (
                  <p style={{ color: '#52f2a5', fontSize: 14 }}>
                    Descuento (−{descPct}%) aplicado.
                  </p>
                )}
                {dtoVolumen ? (
                  <p style={{ color: '#52f2a5', fontSize: 14 }}>
                    Volumen: −{Math.round(dtoVolumen * 100)}% por {totalPuestos} puestos.
                  </p>
                ) : null}
                {(['flow', 'manage'] as const)
                  .filter((id) => vigente(id))
                  .map((id) => (
                    <p key={id} className="text-[14px]" style={{ color: '#2ff801' }}>
                      {CATALOGO.find((c) => c.id === id)?.nombre} activo hasta{' '}
                      {new Date(vigente(id)!.fecha_fin).toLocaleDateString('es-CO')}
                    </p>
                  ))}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-2 justify-end">
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    fontFamily: 'Hanken Grotesk, sans-serif',
                    color: '#e2e2e8',
                  }}
                >
                  {formatUSD(total)}
                </span>
                <span className="text-[13px] text-on-surface-variant">
                  {periodo === 'mensual' ? '/mes' : periodo === 'semestral' ? '/6 meses' : '/año'}
                </span>
              </div>
              <p className="text-[13px] text-outline mb-3">renovación manual</p>
              {negociado ? (
                <a
                  href="mailto:contacto@civilcardex.com?subject=Plan%20empresarial%2025%2B%20puestos"
                  className="pr-cta inline-flex items-center gap-2 uppercase tracking-widest font-bold"
                  style={{
                    fontSize: 14,
                    fontFamily: 'Geist, monospace',
                    padding: '15px 34px',
                    borderRadius: 10,
                    background: '#e8c84a',
                    color: '#161a1e',
                    textDecoration: 'none',
                  }}
                >
                  25+ puestos: contáctenos
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                  >
                    mail
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={pagar}
                  disabled={!hayPago}
                  aria-label={user || !hayPago ? 'Pagar ahora' : 'Inicia sesión para pagar'}
                  className="pr-cta inline-flex items-center gap-2 uppercase tracking-widest font-bold"
                  style={{
                    fontSize: 14,
                    fontFamily: 'Geist, monospace',
                    padding: '15px 34px',
                    borderRadius: 10,
                    background: hayPago ? '#e8c84a' : '#1e2126',
                    color: hayPago ? '#161a1e' : '#5a6a6b',
                    border: 'none',
                    boxShadow: hayPago ? '0 0 22px rgba(232,200,74,.22)' : 'none',
                    cursor: hayPago ? 'pointer' : 'default',
                  }}
                >
                  {user || !hayPago ? 'Pagar ahora' : 'Inicia sesión y paga'}
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                  >
                    arrow_forward
                  </span>
                </button>
              )}
              <p
                className="flex items-center justify-end gap-1 mt-2 text-[13px]"
                style={{ color: '#849495' }}
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined"
                  style={{ fontSize: 14 }}
                >
                  verified_user
                </span>
                Pago seguro con tarjeta · Lemon Squeezy
              </p>
            </div>
          </div>
        </section>

        {/* Próximamente */}
        <section className="max-w-4xl mx-auto mt-12">
          <h2
            className="uppercase tracking-widest mb-4"
            style={{
              fontSize: 14,
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
                className="text-[12px] px-3 py-1.5 border"
                style={{ borderColor: '#3a494a', color: '#849495', borderRadius: 8 }}
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
            Precios en USD. Pago único por período elegido; la renovación es manual — la app le
            avisará al vencer.
          </p>
        </section>
      </main>

      <CheckoutModal
        open={checkoutAbierto}
        onClose={() => setCheckoutAbierto(false)}
        modulos={[...seleccionEfectiva]}
        periodo={periodo}
        puestos={Object.fromEntries([...seleccionEfectiva].map((id) => [id, puestos[id] ?? 1]))}
      />
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
