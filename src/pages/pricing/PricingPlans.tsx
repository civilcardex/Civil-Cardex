/**
 * Tarjetas de módulos y resumen de compra de /pricing (modo suscripciones). Las tarjetas son
 * el control de selección completo (role=checkbox); el resumen arma el total con descuentos
 * y el CTA de pago (o el contacto negociado de 25+ puestos). El estado vive en PricingPage.
 * Ej: clic en la tarjeta "CivilFlow" la marca (borde dorado) y el resumen lista su precio.
 */
import {
  CATALOGO,
  formatUSD,
  precioDePeriodo,
  type ModuloId,
  type ModuloVenta,
  type Periodo,
} from '../../lib/subscriptions/catalog.ts';
import { BENEFICIOS, LOGO, PUESTOS_CAP_STEPPER } from '../pricingData.ts';

/** Botón +/− del stepper de puestos (mismo estilo para ambos). */
const StepperBtn = ({
  aria,
  onClick,
  children,
}: {
  aria: string;
  onClick: (e: React.MouseEvent) => void;
  children: string;
}) => (
  <button
    type="button"
    aria-label={aria}
    onClick={onClick}
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
    {children}
  </button>
);

/** Tarjeta de un módulo: logo, precio del período, stepper de puestos y beneficios. */
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
          <StepperBtn
            aria={`Menos puestos de ${modulo.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              onPuestos(Math.max(1, puesto - 1));
            }}
          >
            −
          </StepperBtn>
          <span
            className="text-[13px] text-on-surface-variant"
            style={{ minWidth: 78, textAlign: 'center' }}
          >
            {puesto} {puesto === 1 ? 'puesto' : 'puestos'}
          </span>
          <StepperBtn
            aria={`Más puestos de ${modulo.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              // Cap por pedido TOTAL (no por módulo): 25+ puestos totales = negociado, lo decide el CTA; puestosDe sanea al leer.
              onPuestos(Math.min(PUESTOS_CAP_STEPPER, puesto + 1));
            }}
          >
            +
          </StepperBtn>
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

/** Suscripción vigente de un módulo (para "Activo hasta …"): la resuelve el padre. */
export type VigenteFn = (id: ModuloId) => { fecha_fin: string } | undefined;

/** Props de la grilla de tarjetas. */
export interface PricingPlansProps {
  periodo: Periodo;
  /** Módulos marcados (la selección efectiva URL+usuario que gobierna el resumen). */
  seleccion: Set<ModuloId>;
  loading: boolean;
  toggle: (id: ModuloId) => void;
  /** 'empresarial' muestra el stepper de puestos por tarjeta. */
  empresarial: boolean;
  puestos: Record<ModuloId, number>;
  onPuestos: (id: ModuloId, n: number) => void;
  vigente: VigenteFn;
}

/** Grilla de tarjetas de módulo (una por entrada del catálogo). */
export function PricingPlans({
  periodo,
  seleccion,
  loading,
  toggle,
  empresarial,
  puestos,
  onPuestos,
  vigente,
}: PricingPlansProps) {
  return (
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
          empresarial={empresarial}
          puesto={puestos[m.id] ?? 1}
          onPuestos={(n) => onPuestos(m.id, n)}
        />
      ))}
    </section>
  );
}

/** Props del resumen de compra (total, descuentos y CTA). */
export interface PricingResumenProps {
  seleccion: Set<ModuloId>;
  empresarial: boolean;
  puestos: Record<ModuloId, number>;
  periodo: Periodo;
  /** % de descuento base+acumulativo ya redondeado (0 = sin descuento). */
  descPct: number;
  /** Descuento por volumen (null si no aplica o es negociado). */
  dtoVolumen: number | null;
  totalPuestos: number;
  total: number;
  /** 25+ puestos totales (tope PUESTOS_TOPE_AUTOMATICO=24): el CTA pasa a contacto directo. */
  negociado: boolean;
  hayPago: boolean;
  user: { email?: string } | null;
  pagar: () => void;
  vigente: VigenteFn;
}

/** Resumen de compra: módulos elegidos, descuentos, total y botón de pago. */
export function PricingResumen({
  seleccion,
  empresarial,
  puestos,
  periodo,
  descPct,
  dtoVolumen,
  totalPuestos,
  total,
  negociado,
  hayPago,
  user,
  pagar,
  vigente,
}: PricingResumenProps) {
  const conDescuento = descPct > 0;
  return (
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
            {seleccion.size === 0 ? (
              <p className="text-[14px] text-on-surface-variant">Seleccione uno o ambos módulos.</p>
            ) : (
              [...seleccion].map((id) => (
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
                    {empresarial && (
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
              <p style={{ color: '#52f2a5', fontSize: 14 }}>Descuento (−{descPct}%) aplicado.</p>
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
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 14 }}>
              verified_user
            </span>
            Pago seguro con tarjeta · Lemon Squeezy
          </p>
        </div>
      </div>
    </section>
  );
}
