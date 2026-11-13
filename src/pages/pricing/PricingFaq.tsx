/**
 * Cierre de la página de precios (modo suscripciones): módulos "Próximamente" y la nota final
 * de renovación manual. Solo presentación; la lista baja por props.
 * Ej: ['Estructuras', 'Terreno', 'Vías'] pinta tres pastillas grises bajo "Próximamente".
 */

/** Props del cierre: nombres de los módulos en camino. */
export interface PricingFaqProps {
  /** Títulos de los módulos aún no comprables (MODULES_DATA). */
  modulosProx: string[];
}

/** Secciones de cierre de /pricing: "Próximamente" + nota de precios en USD. */
export default function PricingFaq({ modulosProx }: PricingFaqProps) {
  return (
    <>
      {/* Próximamente */}
      <section className="max-w-4xl mx-auto mt-12">
        <h2 className="pr-faq-title uppercase tracking-widest mb-4">Próximamente</h2>
        <ul className="list-reset flex flex-wrap gap-2">
          {modulosProx.map((m) => (
            <li key={m} className="pr-faq-chip text-[12px] px-3 py-1.5 border">
              {m}
            </li>
          ))}
        </ul>
      </section>

      <section className="pricing-footer text-center mt-16 space-y-2">
        <p className="text-[12px] text-outline">
          Precios en USD. Pago único por período elegido; la renovación es manual — la app le
          avisará al vencer.
        </p>
      </section>
    </>
  );
}
