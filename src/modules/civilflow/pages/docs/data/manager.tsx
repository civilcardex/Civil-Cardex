import { donde, fx } from './ui';

const manager = {
  name: 'Información general',
  desc: 'Metodología de APU, cuadrillas, estructura AIU y presupuestos de Civil Manager.',
  icon: 'payments',
  color: '#A78BFA',
  sections: [
    {
      title: '¿Qué es un análisis de precios unitarios (APU)?',
      body: (
        <div className="space-y-3">
          <p>
            El APU descompone el precio de una unidad de obra (un metro de tubería, un punto
            eléctrico, un m³ de concreto) en los recursos que la construyen. En Civil Manager cada
            APU agrupa tres componentes de costo directo más la estructura de porcentajes:
          </p>
          {fx('Costo directo (CD) = Materiales + Mano de obra + Equipo')}
          {donde([
            ['Materiales', 'insumos del catálogo × cantidad × (1 + desperdicio)'],
            ['Mano de obra', 'jornales de la cuadrilla ÷ rendimiento de la cuadrilla'],
            ['Equipo', 'tarifas de equipo ÷ rendimiento (cuando aplica)'],
          ])}
          <p className="text-[13px]">
            Sobre el costo directo (o sobre la mano de obra, según la política del proyecto) se
            aplican los porcentajes de Administración, Imprevistos y Utilidad (AIU) para llegar al
            precio de venta.
          </p>
        </div>
      ),
    },
    {
      title: 'Materiales: cantidad y desperdicio',
      body: (
        <div className="space-y-3">
          <p>
            Cada insumo del APU lleva una cantidad por unidad de obra y un porcentaje de desperdicio
            (cortes, mermas, quebraduras) que lo engorda:
          </p>
          {fx(
            <>
              Cant. insumo = cant. teórica × (1 + desperdicio / 100)
              <br />
              Costo material = Cant. insumo × Precio unitario
            </>,
          )}
          <p className="text-[13px]">
            Desperdicios típicos: tubería PVC 5–10% (cortes), accesorios 2–5%, concreto 3–5%. Los
            precios unitarios provienen del catálogo de insumos (con proveedor y fecha de
            cotización), así el APU se actualiza al cambiar el precio de un insumo.
          </p>
        </div>
      ),
    },
    {
      title: 'Mano de obra y cuadrillas',
      body: (
        <div className="space-y-3">
          <p>
            La cuadrilla define quién construye la unidad de obra y su rendimiento (unidades
            terminadas por día). El costo de mano de obra por unidad reparte los jornales diarios
            del equipo entre lo que produce:
          </p>
          {fx(
            <>
              Rendimiento R = unidades de obra / día
              <br />
              Costo MO = ( Σ n<sub>i</sub> · J<sub>i</sub> ) / R
            </>,
          )}
          {donde([
            [
              <>
                n<sub>i</sub>
              </>,
              'cantidad de operarios del rol i en la cuadrilla',
            ],
            [
              <>
                J<sub>i</sub>
              </>,
              'jornal diario del rol i (desde el catálogo)',
            ],
            ['R', 'rendimiento de la cuadrilla (und/día)'],
          ])}
          <p className="text-[13px]">
            Ejemplo: cuadrilla de 1 oficial ($60.000/día) + 1 ayudante ($40.000/día) con rendimiento
            20 und/día → costo MO = $100.000 / 20 = $5.000 por unidad.
          </p>
        </div>
      ),
    },
    {
      title: 'Equipo',
      body: (
        <div className="space-y-3">
          <p>
            Cuando la actividad usa equipo ( vibradora, grúa, bomba ), su tarifa diaria se reparte
            igual que la mano de obra:
          </p>
          {fx(
            <>
              Costo equipo = ( Σ T<sub>i</sub> ) / R
            </>,
          )}
          {donde([
            [
              <>
                T<sub>i</sub>
              </>,
              'tarifa diaria del equipo i (desde el catálogo)',
            ],
            ['R', 'rendimiento de la cuadrilla (und/día)'],
          ])}
        </div>
      ),
    },
    {
      title: 'Costo directo y estructura AIU',
      body: (
        <div className="space-y-3">
          <p>
            Los porcentajes A (administración), I (imprevistos) y U (utilidad) cubren la estructura
            del proyecto y la ganancia. Civil Manager aplica el estilo colombiano — IVA SOLO sobre
            la utilidad — exactamente así:
          </p>
          {fx(
            <>
              A = CD · A% &nbsp;&nbsp;&nbsp; I = CD · I% &nbsp;&nbsp;&nbsp; U = CD · U%
              <br />
              Vr. unitario = CD<sub>unit</sub> · (1 + (A% + I% + U%) / 100)
              <br />
              IVA = U · IVA% &nbsp;&nbsp;(19% por defecto, solo sobre la utilidad)
            </>,
          )}
          <p className="text-[13px]">
            Ejemplo: APU de $10.000 con A=12%, I=3%, U=8% → A=$1.200, I=$300, U=$800, Vr. unitario =
            $12.300 y el IVA del ítem = $152. Los porcentajes globales vienen de Configuración →
            Parámetros APU; cada presupuesto puede sobreescribirlos en Resumen AIU. Rangos usuales
            en obra privada: A 8–15%, I 2–5%, U 5–15%.
          </p>
        </div>
      ),
    },
    {
      title: 'Presupuestos',
      body: (
        <div className="space-y-3">
          <p>
            El presupuesto organiza los APU por capítulos (obras preliminares, sanitarias,
            eléctricas…) con cantidades de obra:
          </p>
          {fx(
            <>
              Subtotal ítem = Cantidad de obra × Vr. unitario del APU
              <br />
              CD total = Σ (CD de cada ítem)
              <br />
              Valor total = CD + A + I + U + IVA sobre U
            </>,
          )}
          <p className="text-[13px]">
            Las filas marcadas "capítulo" no computan (solo agrupan). El resumen general suma el
            costo directo, la administración, los imprevistos, la utilidad y el IVA sobre utilidad
            ítem a ítem. Al crear el presupuesto se toma una <strong>copia (snapshot)</strong> de
            catálogos, factores y APU: lo que calcule después no cambia si editas los catálogos
            globales — y al contrario, cambiar un insumo global no re-precia presupuestos cerrados.
          </p>
        </div>
      ),
    },
  ],
};

export default manager;
