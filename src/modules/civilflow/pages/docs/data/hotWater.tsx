import { Tabla, donde, fx } from './ui';

const agua_caliente = {
  name: 'Agua caliente',
  desc: 'Consideraciones de diseño, pérdidas de calor y recirculación de AC.',
  icon: 'local_fire_department',
  color: '#F04545',
  sections: [
    {
      title: 'Consideraciones de diseño',
      body: (
        <div className="space-y-3">
          <ul className="list-disc list-inside text-[13px] space-y-1">
            <li>Expansión térmica: los tubos se dilatan con la temperatura</li>
            <li>Aislamiento térmico para reducir pérdidas de calor</li>
            <li>Temperatura de servicio: 55–60 °C</li>
            <li>Recirculación opcional si L &gt; 15 m</li>
          </ul>
          <p className="text-[13px]">
            La red de AC usa el MISMO método que agua fría: UC propias (columna UC AC del catálogo),
            curva de Hunter y Hazen-Williams. Dos diferencias clave: la presión de entrada la fija
            la
            <strong> selección del calentador</strong> (pérdida de carga del equipo + presión de la
            línea de AF en su entrada), y el diámetro interior depende de materiales con series
            propias (CPVC, PP-R).
          </p>
          <p className="text-[13px] font-semibold mt-2">Materiales comunes:</p>
          <Tabla
            head={['Material', 'T max', 'Norma']}
            rows={[
              ['CPVC', '82 °C', 'RDE 11'],
              ['Cobre', '100 °C', 'Soldable'],
              ['PP-R', '70–90 °C', 'Tipo 3'],
              ['PEX', '60–80 °C', 'Tipo A/B/C'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Pérdidas de calor y recirculación',
      body: (
        <div className="space-y-3">
          {fx(
            <>
              Q<sub>perd</sub> = U · A · (T<sub>m</sub> − T<sub>a</sub>)
            </>,
          )}
          <div className="text-[13px]">
            <span className="font-semibold">Caudal de recirculación:</span>
            {fx(
              <>
                Q<sub>rec</sub> = Q<sub>perd</sub> / (c<sub>p</sub> · &Delta;T)
              </>,
            )}
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          {donde([
            [
              <>
                Q<sub>perd</sub>
              </>,
              'pérdida de calor (kcal/h)',
            ],
            ['U', 'coeficiente global de transferencia (kcal/(h·m²·°C))'],
            ['A', 'área superficial del tubo (m²)'],
            [
              <>
                T<sub>m</sub>
              </>,
              'temperatura media del agua (°C)',
            ],
            [
              <>
                T<sub>a</sub>
              </>,
              'temperatura ambiente (°C)',
            ],
            [
              <>
                Q<sub>rec</sub>
              </>,
              'caudal de recirculación (kg/h)',
            ],
            [
              <>
                c<sub>p</sub>
              </>,
              'calor específico = 1 kcal/(kg·°C)',
            ],
            [<>&Delta;T</>, 'diferencia de temperatura (5–10 °C)'],
          ])}
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            c<sub>p</sub> = 1 kcal/(kg·°C) · &Delta;T típico: 5–10 °C
          </div>
          <p className="text-[13px]">
            Ejemplo: 30 m de tubería de ¾" con U = 0.9 y (T<sub>m</sub> − T<sub>a</sub>) = 35 °C → Q
            <sub>perd</sub> ≈ 300 kcal/h; con ΔT = 10 °C la recirculación requiere Q<sub>rec</sub> ≈
            30 kg/h (≈ 0.5 L/min) — dimensiona la línea y la bomba de recirculación.
          </p>
        </div>
      ),
    },
  ],
};

export default agua_caliente;
