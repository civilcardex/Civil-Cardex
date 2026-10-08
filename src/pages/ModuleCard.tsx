// ModuleCard: tarjeta de plan del marketing de precios (selección, puestos empresariales,
// badges de normas, beneficios). Extraído verbatim de PricingPage.
import type { Periodo } from '../lib/subscriptions/catalog';
import { formatUSD, precioDePeriodo, type ModuloVenta } from '../lib/subscriptions/catalog';
import { BENEFICIOS, LOGO, PUESTOS_CAP_STEPPER } from './pricingData';

export function ModuleCard({
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
