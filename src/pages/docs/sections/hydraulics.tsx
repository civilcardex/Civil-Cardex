import React from 'react'
import { FormatText as F, TableWrapper as T, TableHeader as Th, TableCell as Td, TableRow as Tr } from '../SectionAccordion'

export const hidraulica = {
  name: 'Principios de hidráulica',
  icon: 'water_drop' as const,
  color: '#4D8FF7',
  sections: [
    {
      title: 'Número de Froude',
      body: (
        <div className="space-y-3">
          <p>El número de Froude (Fr) es adimensional y relaciona las fuerzas de inercia con las de gravedad en un fluido.</p>
          <F>
            Fr = v / √(g · DH)
          </F>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">v</span><span>velocidad del agua (m/s)</span>
            <span className="font-semibold text-primary">g</span><span>gravedad = 9.81 m/s²</span>
            <span className="font-semibold text-primary">DH</span><span>profundidad hidráulica = A/T</span>
          </div>
          <div className="mt-3">
            <span className="text-on-surface-variant text-[13px] font-semibold block mb-1">Interpretación del régimen:</span>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-mono text-cyan-400 font-bold">Fr &gt; 1</span><span>Supercrítico — flujo rápido, energía cinética predominante</span>
              <span className="font-mono text-yellow-400 font-bold">Fr = 1</span><span>Crítico — flujo limítrofe</span>
              <span className="font-mono text-green-400 font-bold">Fr &lt; 1</span><span>Subcrítico — flujo lento, energía potencial predominante</span>
            </div>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mt-2">
            Recomendación: Para flujo estable se busca Fr &lt; 0.9 (subcrítico) o Fr &gt; 1.1 (supercrítico).
          </div>
        </div>
      ),
    },
    {
      title: 'Ecuación de Manning',
      body: (
        <div className="space-y-3">
          <p>Flujo a superficie libre según Manning:</p>
          <F>
            V = (1/n) · R<sub>h</sub><sup>2/3</sup> · √S
          </F>
          <p className="text-[13px]">Caudal:</p>
          <F>
            Q = (1/n) · A · R<sub>h</sub><sup>2/3</sup> · √S
          </F>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">V</span><span>velocidad (m/s)</span>
            <span className="font-semibold text-primary">n</span><span>coeficiente de rugosidad de Manning</span>
            <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
            <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            <span className="font-semibold text-primary">A</span><span>área de la sección (m²)</span>
            <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Fuerza tractiva',
      body: (
        <div className="space-y-3">
          <p>Fuerza que el fluido ejerce sobre el fondo del canal, responsable del arrastre de partículas sedimentadas.</p>
          <F>
            T<sub>0</sub> = &gamma; · R · S
          </F>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">T<sub>0</sub></span><span>tensión tractiva (kg/m²)</span>
            <span className="font-semibold text-primary">&gamma;</span><span>peso específico del agua = 1000 kg/m³</span>
            <span className="font-semibold text-primary">R</span><span>radio hidráulico (m)</span>
            <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Requisito NTC 1500: T<sub>0</sub> &ge; 0.10 kg/m² (mínimo). Recomendado: 0.15 kg/m².
          </div>
        </div>
      ),
    },
    {
      title: 'Relaciones geométricas (sección circular)',
      body: (
        <div className="space-y-3">
          <p>Para tuberías parcialmente llenas, las relaciones de velocidad y caudal dependen de Y/D:</p>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Relación v/V (velocidad real / tubo lleno):</span>
            <F>
              0.00 &lt; q/Q &le; 0.06  →  v/V = 10<sup>(0.0298 + 0.2910 · log(q/Q))</sup><br/>
              0.06 &lt; q/Q &le; 0.26  →  v/V = 10<sup>(0.0138 + 0.2860 · log(q/Q))</sup><br/>
              0.26 &lt; q/Q &le; 0.91  →  v/V = 10<sup>(0.0218 + 0.2900 · log(q/Q))</sup>
            </F>
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Relación h/D (calado / diámetro):</span>
            <F>
              0.00 &le; q/Q &lt; 0.11  →  h/D = 0.3827 + 0.0645 · ln(q/Q)<br/>
              0.11 &le; q/Q &lt; 0.21  →  h/D = 0.6003 + 0.1547 · ln(q/Q)<br/>
              0.21 &le; q/Q &lt; 0.91  →  h/D = 0.225 + 0.667 · (q/Q)
            </F>
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Ángulo &alpha; (radianes):</span>
            <F>&alpha; = 2 · arccos(1 − 2 · h/D)</F>
          </div>
          <div className="text-[13px]">
            <span className="font-semibold text-primary">Relación R<sub>h</sub>/D:</span>
            <F>R<sub>h</sub>/D = ¼ · (1 − sen(&alpha;) / &alpha;)</F>
          </div>
        </div>
      ),
    },
    {
      title: 'Pendiente crítica',
      body: (
        <div className="space-y-3">
          <p>Para canales de sección circular:</p>
          <F>
            S<sub>c</sub> = (4.579 &times; 10<sup>−4</sup>) / d<sup>3</sup>
          </F>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">S<sub>c</sub></span><span>pendiente crítica</span>
            <span className="font-semibold text-primary">d</span><span>diámetro de tubería (m)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Si S &lt; S<sub>c</sub>: pendiente subcrítica para cualquier caudal.<br/>
            Si S &gt; S<sub>c</sub>: puede presentar comportamiento supercrítico.
          </div>
        </div>
      ),
    },
    {
      title: 'Elementos hidráulicos por sección',
      body: (
        <div className="space-y-4">
          <div>
            <span className="text-[13px] font-semibold text-cyan-400">Rectangular</span>
            <F>
              A = b · y<br/>
              P = b + 2 · y<br/>
              R<sub>h</sub> = (b · y) / (b + 2 · y)<br/>
              T = b
            </F>
          </div>
          <div>
            <span className="text-[13px] font-semibold text-yellow-400">Trapezoidal</span>
            <F>
              A = (b + z · y) · y<br/>
              P = b + 2 · y · &radic;(1 + z²)<br/>
              R<sub>h</sub> = ((b + z · y) · y) / (b + 2 · y · &radic;(1 + z²))<br/>
              T = b + 2 · z · y
            </F>
          </div>
          <div>
            <span className="text-[13px] font-semibold text-green-400">Circular (parcialmente lleno)</span>
            <F>
              A = (D²/4) · (&theta; − sen(&theta;)) / 2<br/>
              P = D · &theta; / 2<br/>
              R<sub>h</sub> = D/4 · (1 − sen(&theta;) / &theta;)<br/>
              T = D · sen(&theta;/2)
            </F>
            <div className="text-[11px] text-on-surface-variant ml-4">con &theta; en radianes</div>
          </div>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">b</span><span>ancho de base (m)</span>
            <span className="font-semibold text-primary">y</span><span>calado o profundidad del flujo (m)</span>
            <span className="font-semibold text-primary">z</span><span>talud horizontal (relación H:V)</span>
            <span className="font-semibold text-primary">D</span><span>diámetro de tubería (m)</span>
            <span className="font-semibold text-primary">&theta;</span><span>ángulo del espejo de agua (rad)</span>
            <span className="font-semibold text-primary">A</span><span>área hidráulica (m²)</span>
            <span className="font-semibold text-primary">P</span><span>perímetro mojado (m)</span>
            <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
            <span className="font-semibold text-primary">T</span><span>espejo de agua (m)</span>
          </div>
        </div>
      ),
    },
  ],
}

export const aguaFria = {
  name: 'Agua fría',
  icon: 'ac_unit' as const,
  color: '#1B6EF3',
  sections: [
    {
      title: 'Unidades de consumo (UC)',
      body: (
        <div className="space-y-3">
          <p>Unidades de Consumo para suministro de agua según NTC 1500:</p>
          <T>
            <Tr><Th>Aparato</Th><Th>UC AF</Th><Th>UC AC</Th><Th>UD</Th></Tr>
            <Tr><Td>Inodoro tanque</Td><Td>2.2</Td><Td>—</Td><Td>4</Td></Tr>
            <Tr><Td>Lavamanos</Td><Td>0.5</Td><Td>0.5</Td><Td>2</Td></Tr>
            <Tr><Td>Ducha</Td><Td>1.0</Td><Td>1.0</Td><Td>2</Td></Tr>
            <Tr><Td>Lavaplatos</Td><Td>1.0</Td><Td>1.0</Td><Td>2</Td></Tr>
            <Tr><Td>Tina</Td><Td>1.0</Td><Td>1.0</Td><Td>2</Td></Tr>
            <Tr><Td>Lavadora</Td><Td>1.0</Td><Td>—</Td><Td>4</Td></Tr>
            <Tr><Td>Lavadero</Td><Td>0.75</Td><Td>0.75</Td><Td>2</Td></Tr>
          </T>
        </div>
      ),
    },
    {
      title: 'Hazen-Williams (pérdidas)',
      body: (
        <div className="space-y-3">
          <F>
            h<sub>f</sub> = (10.67 · L · Q<sup>1.852</sup>) / (C<sup>1.852</sup> · D<sup>4.87</sup>)
          </F>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">h<sub>f</sub></span><span>pérdida por fricción (m)</span>
            <span className="font-semibold text-primary">L</span><span>longitud (m)</span>
            <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
            <span className="font-semibold text-primary">C</span><span>coeficiente Hazen-Williams</span>
            <span className="font-semibold text-primary">D</span><span>diámetro interno (m)</span>
          </div>
          <div className="text-[13px] mt-2">
            <span className="font-semibold">Valores de C:</span>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 ml-4 mt-1">
              <span className="font-mono text-primary">PVC</span><span>C = 150</span>
              <span className="font-mono text-primary">PE</span><span>C = 140</span>
              <span className="font-mono text-primary">Cobre</span><span>C = 130–140</span>
              <span className="font-mono text-primary">Acero galv.</span><span>C = 120</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Verificación de presión y velocidad',
      body: (
        <div className="space-y-3">
          <p className="font-semibold text-[13px]">Presiones mínimas por aparato (NTC 1500):</p>
          <T>
            <Tr><Th>Aparato</Th><Th>Min (m.c.a.)</Th><Th>Max (m.c.a.)</Th></Tr>
            <Tr><Td>Inodoro tanque</Td><Td>0.71</Td><Td>14.10</Td></Tr>
            <Tr><Td>Lavamanos</Td><Td>0.51</Td><Td>5.63</Td></Tr>
            <Tr><Td>Ducha</Td><Td>1.02</Td><Td>5.63</Td></Tr>
            <Tr><Td>Lavaplatos</Td><Td>0.51</Td><Td>5.63</Td></Tr>
            <Tr><Td>Tina</Td><Td>0.51</Td><Td>14.10</Td></Tr>
          </T>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Velocidad recomendada: 0.60 m/s – 3.00 m/s · Máxima absoluta: 5.00 m/s
          </div>
        </div>
      ),
    },
  ],
}

export const aguaCaliente = {
  name: 'Agua caliente',
  icon: 'local_fire_department' as const,
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
          <p className="text-[13px] font-semibold mt-2">Materiales comunes:</p>
          <T>
            <Tr><Th>Material</Th><Th>T max</Th><Th>Norma</Th></Tr>
            <Tr><Td>CPVC</Td><Td>82 °C</Td><Td>RDE 11</Td></Tr>
            <Tr><Td>Cobre</Td><Td>100 °C</Td><Td>Soldable</Td></Tr>
            <Tr><Td>PP-R</Td><Td>70–90 °C</Td><Td>Tipo 3</Td></Tr>
            <Tr><Td>PEX</Td><Td>60–80 °C</Td><Td>Tipo A/B/C</Td></Tr>
          </T>
        </div>
      ),
    },
    {
      title: 'Pérdidas de calor y recirculación',
      body: (
        <div className="space-y-3">
          <F>
            Q<sub>perd</sub> = U · A · (T<sub>m</sub> − T<sub>a</sub>)
          </F>
          <div className="text-[13px]">
            <span className="font-semibold">Caudal de recirculación:</span>
            <F>
              Q<sub>rec</sub> = Q<sub>perd</sub> / (c<sub>p</sub> · &Delta;T)
            </F>
          </div>
          <div><span className="text-on-surface-variant">Donde:</span></div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">Q<sub>perd</sub></span><span>pérdida de calor (kcal/h)</span>
            <span className="font-semibold text-primary">U</span><span>coeficiente global de transferencia (kcal/(h·m²·°C))</span>
            <span className="font-semibold text-primary">A</span><span>área superficial del tubo (m²)</span>
            <span className="font-semibold text-primary">T<sub>m</sub></span><span>temperatura media del agua (°C)</span>
            <span className="font-semibold text-primary">T<sub>a</sub></span><span>temperatura ambiente (°C)</span>
            <span className="font-semibold text-primary">Q<sub>rec</sub></span><span>caudal de recirculación (kg/h)</span>
            <span className="font-semibold text-primary">c<sub>p</sub></span><span>calor específico = 1 kcal/(kg·°C)</span>
            <span className="font-semibold text-primary">&Delta;T</span><span>diferencia de temperatura (5–10 °C)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            c<sub>p</sub> = 1 kcal/(kg·°C) · &Delta;T típico: 5–10 °C
          </div>
        </div>
      ),
    },
  ],
}
