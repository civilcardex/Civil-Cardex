import { Tabla } from './ui';

const agua_fria = {
  name: 'Agua fría',
  desc: 'Unidades de consumo, Hazen-Williams y verificación de presión y velocidad.',
  icon: 'ac_unit',
  color: '#1B6EF3',
  sections: [
    {
      title: 'Unidades de consumo (UC)',
      body: (
        <div className="space-y-3">
          <p>
            Unidades de Consumo para suministro de agua según NTC 1500 — editables por proyecto en
            Parámetros de diseño:
          </p>
          <Tabla
            head={['Aparato', 'UC AF', 'UC AC', 'UD']}
            rows={[
              ['Inodoro tanque', '2.2', '—', '4'],
              ['Lavamanos', '0.5', '0.5', '2'],
              ['Ducha', '1.0', '1.0', '2'],
              ['Lavaplatos', '1.0', '1.0', '2'],
              ['Tina', '1.0', '1.0', '2'],
              ['Lavadora', '1.0', '—', '4'],
              ['Lavadero', '0.75', '0.75', '2'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Hazen-Williams (pérdidas)',
      body: (
        <div className="space-y-3">
          <p>Pérdida de carga por fricción de cada tramo (flujo turbulento en tubería lisa):</p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            h<sub>f</sub> = (10.67 · L · Q<sup>1.852</sup>) / (C<sup>1.852</sup> · D<sup>4.87</sup>)
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              h<sub>f</sub>
            </span>
            <span>pérdida por fricción (m)</span>
            <span className="font-semibold text-primary">L</span>
            <span>
              longitud total: horizontal + vertical + longitud equivalente de accesorios (m)
            </span>
            <span className="font-semibold text-primary">Q</span>
            <span>caudal de diseño (m³/s) — de la curva de Hunter</span>
            <span className="font-semibold text-primary">C</span>
            <span>coeficiente Hazen-Williams del material</span>
            <span className="font-semibold text-primary">D</span>
            <span>
              diámetro INTERIOR (m): depende de la serie RDE del material, no solo del nominal
            </span>
          </div>
          <div className="text-[13px] mt-2">
            <span className="font-semibold">Valores de C:</span>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 ml-4 mt-1">
              <span className="font-mono text-primary">PVC</span>
              <span>C = 150</span>
              <span className="font-mono text-primary">PE</span>
              <span>C = 140</span>
              <span className="font-mono text-primary">Cobre</span>
              <span>C = 130–140</span>
              <span className="font-mono text-primary">Acero galv.</span>
              <span>C = 120</span>
            </div>
          </div>
          <p className="text-[13px]">
            Ejemplo: Q = 3 L/s, D<sub>i</sub> = 27.2 mm (PVC 1" RDE 11), L = 20 m, C = 150 → h
            <sub>f</sub> ≈ 1.35 m. La tabla lo muestra en metros y como % de la presión disponible
            del tramo.
          </p>
        </div>
      ),
    },
    {
      title: 'Cadena de cálculo del tramo',
      body: (
        <div className="space-y-3">
          <p>
            Cómo la tabla de diseño construye cada fila — las cuatro columnas clave se encadenan
            así:
          </p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            UC total = UC propia + UC de otros ramales
            <br />Q = K · 0.1163·UC<sup>0.6875</sup> &nbsp;&nbsp;(curva de Hunter)
            <br />V = Q / ((π/4) · D<sub>i</sub>²)
            <br />P<sub>fin</sub> = P<sub>ini</sub> − h<sub>f</sub> ± ΔZ
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">K</span>
            <span>factor de simultaneidad = 1/√(N−1), con N = descargas simultáneas del tramo</span>
            <span className="font-semibold text-primary">ΔZ</span>
            <span>
              incremento de cota del tramo: sube resta presión (+h<sub>f</sub> efecto), baja la suma
            </span>
            <span className="font-semibold text-primary">
              P<sub>ini</sub>
            </span>
            <span>
              presión que llega del tramo anterior: desde acometida/contador (red) o del
              tanque/equipo
            </span>
          </div>
          <p className="text-[13px]">
            Fijar un diámetro más grande reduce V y h<sub>f</sub> pero eleva el costo; uno más
            pequeño puede violar la velocidad máxima o dejar P<sub>fin</sub> por debajo del mínimo
            del aparato más crítico. La columna "Otros Ramales" enlaza los tramos que aportan UC.
          </p>
        </div>
      ),
    },
    {
      title: 'Verificación de presión y velocidad',
      body: (
        <div className="space-y-3">
          <p className="font-semibold text-[13px]">Presiones mínimas por aparato (NTC 1500):</p>
          <Tabla
            head={['Aparato', 'Min (m.c.a.)', 'Max (m.c.a.)']}
            rows={[
              ['Inodoro tanque', '0.71', '14.10'],
              ['Lavamanos', '0.51', '5.63'],
              ['Ducha', '1.02', '5.63'],
              ['Lavaplatos', '0.51', '5.63'],
              ['Tina', '0.51', '14.10'],
            ]}
          />
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Velocidad recomendada: 0.60 m/s – 3.00 m/s · Máxima absoluta: 5.00 m/s
          </div>
        </div>
      ),
    },
  ],
};

export default agua_fria;
