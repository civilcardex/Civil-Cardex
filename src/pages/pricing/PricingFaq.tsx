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
    </>
  );
}
