/** Contenido de la sección "Información general" de la página /docs: metodología de APU (Análisis de Precios Unitarios), cuadrillas y AIU para Civil Manager. */
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
            APU agrupa cinco componentes de costo directo:
          </p>
          {fx('Costo directo (CD) = Materiales + Mano de obra + Equipo + Transporte + Herr. menor')}
          {donde([
            ['Materiales', 'insumos del catálogo × consumo × (1 + desperdicio %)'],
            [
              'Mano de obra',
              'Σ (jornal del cargo × personas × rendimiento, con rendimiento en jornadas por unidad de obra)',
            ],
            ['Equipo', 'Σ (costo hora de la máquina × horas de uso por unidad de obra)'],
            ['Transporte', 'tarifa fija (Global) o tarifa × distancia km'],
            ['Herr. menor', '% de la mano de obra (por defecto 5 %, editable en Parámetros APU)'],
          ])}
          <p className="text-[13px]">
            Sobre el costo directo se aplican los porcentajes de Administración, Imprevistos y
            Utilidad (AIU) para llegar al precio de venta. Los salarios traen además los factores
            prestacionales (FP) del país activo, que engordan el jornal del cargo (siempre que "Usar
            F.P. en cada APU" esté en "No — incrustado en costo personal").
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
            La cuadrilla define quién construye la unidad de obra. Cada fila de mano de obra lleva
            cuántas personas del cargo participan y su rendimiento en{' '}
            <strong>jornadas por unidad de obra</strong>: cuánto tiempo del trabajador consume cada
            unidad producida. El jornal diario del cargo sale del catálogo (salario base ÷ días del
            mes, con o sin factores prestacionales según la config):
          </p>
          {fx(
            <>
              Rendimiento R<sub>i</sub> = jornadas por unidad de obra (0.5 = media jornada)
              <br />
              Costo MO = Σ n<sub>i</sub> · J<sub>i</sub> · R<sub>i</sub>
            </>,
          )}
          {donde([
            [
              <>
                n<sub>i</sub>
              </>,
              'cantidad de operarios del rol i',
            ],
            [
              <>
                J<sub>i</sub>
              </>,
              'jornal diario del rol i (desde el catálogo)',
            ],
            [
              <>
                R<sub>i</sub>
              </>,
              'rendimiento: jornadas de trabajo por unidad de obra (fracción de día)',
            ],
          ])}
          <p className="text-[13px]">
            Ejemplo: 1 oficial ($60.000/día) + 1 ayudante ($40.000/día) dedicados cada uno media
            jornada por unidad (R=0.5) → costo MO = 1·60.000·0.5 + 1·40.000·0.5 = $50.000 por
            unidad. Si el grupo completo tarda 20 días en producir 1 unidad, cada fila lleva R=20
            (la unidad consumió 20 jornadas de cada cargo). Piensa siempre "cuánto tiempo me cuesta
            cada unidad".
          </p>
        </div>
      ),
    },
    {
      title: 'Equipo',
      body: (
        <div className="space-y-3">
          <p>
            Cuando la actividad usa equipo (vibradora, grúa, bomba), su tarifa{' '}
            <strong>por hora</strong> del catálogo multiplica las horas de uso por unidad de obra:
          </p>
          {fx(
            <>
              Costo equipo = Σ costo/hora<sub>i</sub> · H<sub>i</sub>
            </>,
          )}
          {donde([
            [
              <>
                costo/hora<sub>i</sub>
              </>,
              'tarifa por hora del equipo i (desde el catálogo)',
            ],
            [
              <>
                H<sub>i</sub>
              </>,
              'horas de uso del equipo por unidad de obra (su "rendimiento")',
            ],
          ])}
          <p className="text-[13px]">
            Ejemplo: vibradora a $15.000/h que trabaja 0.25 h por m³ → $3.750 por m³. Misma doctrina
            que la mano de obra: rendimiento = esfuerzo (tiempo) por unidad, no producción por día.
          </p>
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
              IVA = U · IVA% &nbsp;&nbsp;(solo sobre la utilidad)
            </>,
          )}
          <p className="text-[13px]">
            Ejemplo: APU de $10.000 con A=12%, I=3%, U=8% → A=$1.200, I=$300, U=$800, Vr. unitario =
            $12.300 y el IVA del ítem = $152 (IVA 19% CO). La tasa de IVA es la del país activo
            (Colombia 19%, Perú IGV 18%, Ecuador 15%, Chile 19%, Argentina 21%, Bolivia 13%) y se
            edita en Configuración → Parámetros APU; cada presupuesto puede sobreescribirla en
            Resumen AIU junto con A/I/U. Rangos usuales en obra privada: A 8–15%, I 2–5%, U 5–15%
            (heurística de obra privada, no norma).
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
            ítem a ítem. Doctrina de los presupuestos: en <strong>borrador/en revisión</strong> el
            cálculo usa los catálogos vivos (editar un insumo re-precia el presupuesto); al pasar a{' '}
            <strong>cerrado</strong> se toma una <strong>copia (snapshot)</strong> de catálogos,
            factores, APU y perfil de país y desde ahí el presupuesto calcula con esa foto — editar
            el catálogo global ya no mueve un presupuesto cerrado ya entregado.
          </p>
        </div>
      ),
    },
  ],
};

export default manager;
