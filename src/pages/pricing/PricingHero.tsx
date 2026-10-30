/**
 * Encabezado de la página de precios (modo suscripciones): título, toggle individual/
 * empresarial y selector de período (mensual/semestral/anual con su % de descuento).
 * Solo presentación: el estado vive en PricingPage y baja por props.
 * Ej: elegir "anual" pinta el 15% junto al botón y el texto de descuentos abajo cambia.
 */
import {
  DESCUENTO_BASE,
  DESCUENTO_POR_MODULO,
  type Periodo,
} from '../../lib/subscriptions/catalog.ts';

/** Props del encabezado: el modo de compra y el período elegidos (controlados por el padre). */
export interface PricingHeroProps {
  /** 'individual' (1 puesto) o 'empresarial' (puestos + descuento por volumen). */
  modo: 'individual' | 'empresarial';
  setModo: (m: 'individual' | 'empresarial') => void;
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
}

/** Sección de encabezado de /pricing: título + tipo de plan + selector de período. */
export default function PricingHero({ modo, setModo, periodo, setPeriodo }: PricingHeroProps) {
  return (
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
                <span style={{ color: '#52f2a5', marginLeft: 6, fontSize: 13, fontWeight: 700 }}>
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
  );
}
