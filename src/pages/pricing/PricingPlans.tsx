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
  <button type="button" aria-label={aria} onClick={onClick} className="pr-card-stepper-btn pr-cta">
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
      data-selected={seleccionado ? 'true' : 'false'}
      className="pr-card border p-7 flex flex-col cursor-pointer select-none"
    >
      <div className="flex items-start justify-between mb-4">
        <img
          src={LOGO[modulo.id]}
          alt={`Logo ${modulo.nombre}`}
          width={230}
          height={76}
          className="pr-card-logo"
        />
        {/* Check circular (visual — la tarjeta entera es el control) */}
        <span
          aria-hidden="true"
          data-selected={seleccionado ? 'true' : 'false'}
          className="pr-card-check material-symbols-outlined"
        >
          check
        </span>
      </div>
      <h2 className="pr-card-title">{modulo.nombre}</h2>
      <p className="text-sm text-on-surface-variant mt-1">{modulo.descripcion}</p>

      <div className="pr-card-divider" aria-hidden="true" />
      <div className="flex items-baseline gap-2">
        <span className="pr-card-price">{formatUSD(precio)}</span>
        <span className="pr-card-period text-on-surface-variant">
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
          <span className="pr-card-stepper-value text-[13px] text-on-surface-variant">
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

      <ul className="list-reset mt-4 space-y-2">
        {BENEFICIOS[modulo.id].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span aria-hidden="true" className="pr-card-benefit-icon material-symbols-outlined">
              check_circle
            </span>
            <span className="text-[13px] text-on-surface-variant">{f}</span>
          </li>
        ))}
      </ul>

      {!loading && vigencia && (
        <p className="pr-card-active text-[12px] mt-4 flex items-center gap-1">
          <span aria-hidden="true" className="pr-card-active-icon material-symbols-outlined">
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
    <section className="pr-summary max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between flex-wrap gap-5">
        <div className="min-w-[220px]">
          <p className="pr-summary-label uppercase">Tu compra</p>
          <div className="mt-2 space-y-1">
            {seleccion.size === 0 ? (
              <p className="text-[14px] text-on-surface-variant">Seleccione uno o ambos módulos.</p>
            ) : (
              [...seleccion].map((id) => (
                <div key={id} className="flex items-center gap-2">
                  <img src={LOGO[id]} alt="" width={18} height={18} className="pr-summary-logo" />
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
            {conDescuento && <p className="pr-discount">Descuento (−{descPct}%) aplicado.</p>}
            {dtoVolumen ? (
              <p className="pr-discount">
                Volumen: −{Math.round(dtoVolumen * 100)}% por {totalPuestos} puestos.
              </p>
            ) : null}
            {(['flow', 'manage'] as const)
              .filter((id) => vigente(id))
              .map((id) => (
                <p key={id} className="pr-card-active text-[14px]">
                  {CATALOGO.find((c) => c.id === id)?.nombre} activo hasta{' '}
                  {new Date(vigente(id)!.fecha_fin).toLocaleDateString('es-CO')}
                </p>
              ))}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className="pr-total">{formatUSD(total)}</span>
            <span className="text-[13px] text-on-surface-variant">
              {periodo === 'mensual' ? '/mes' : periodo === 'semestral' ? '/6 meses' : '/año'}
            </span>
          </div>
          <p className="text-[13px] text-outline mb-3">renovación manual</p>
          {negociado ? (
            <a
              href="mailto:contacto@civilcardex.com?subject=Plan%20empresarial%2025%2B%20puestos"
              className="pr-cta pr-cta-btn pr-cta-buy inline-flex items-center gap-2 uppercase tracking-widest font-bold"
            >
              25+ puestos: contáctenos
              <span aria-hidden="true" className="pr-cta-icon material-symbols-outlined">
                mail
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={pagar}
              disabled={!hayPago}
              aria-label={user || !hayPago ? 'Pagar ahora' : 'Inicia sesión para pagar'}
              className="pr-cta pr-cta-btn pr-cta-buy inline-flex items-center gap-2 uppercase tracking-widest font-bold"
            >
              {user || !hayPago ? 'Pagar ahora' : 'Inicia sesión y paga'}
              <span aria-hidden="true" className="pr-cta-icon material-symbols-outlined">
                arrow_forward
              </span>
            </button>
          )}
          <p className="pr-secure flex items-center justify-end gap-1 mt-2 text-[13px]">
            <span aria-hidden="true" className="pr-secure-icon material-symbols-outlined">
              verified_user
            </span>
            Pago seguro con tarjeta · Lemon Squeezy
          </p>
        </div>
      </div>
    </section>
  );
}
