import React, { useState } from 'react'
import Navbar from '../components/Navbar'

/* ─────────────────────────────────────────────────────────────
   Civil Flow KML 2026 — DOCUMENTACION
   Ing. Camilo Cardenas Chacon     NTC 1500 · RAS 2000 · NTC 3728 · NSR-10
   ───────────────────────────────────────────────────────────── */

const F = ({ children }) => (
  <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
    {children}
  </div>
)

const T = ({ children }) => (
  <div className="overflow-x-auto my-2">
    <table className="w-full text-[12px] font-mono border-collapse">
      <tbody>{children}</tbody>
    </table>
  </div>
)

const Th = ({ children }) => (
  <th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">
    {children}
  </th>
)

const Td = ({ children }) => (
  <td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">
    {children}
  </td>
)

const Tr = ({ children }) => <tr>{children}</tr>

const docData = {
  hidraulica: {
    name: 'Principios de hidráulica',
    icon: 'water_drop',
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
        title: 'Ecuación de maning',
        body: (
          <div className="space-y-3">
            <p>Flujo a superficie libre según maning:</p>
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
              <span className="font-semibold text-primary">n</span><span>coeficiente de rugosidad de maning</span>
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
              <span className="font-semibold text-primary">S<sub>c</sub></span><span>pendiente critica</span>
              <span className="font-semibold text-primary">d</span><span>diámetro de tubería (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Si S &lt; S<sub>c</sub>: pendiente subcritica para cualquier caudal.<br/>
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
              <span className="font-semibold text-primary">z</span><span>talud horizontal (relacion H:V)</span>
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
  },
  sanitarias: {
    name: 'Redes sanitarias',
    icon: 'plumbing',
    color: '#F5A623',
    sections: [
      {
        title: 'Unidades de descarga (UD)',
        body: (
          <div className="space-y-3">
            <p>Método empírico para estimar el flujo máximo probable en sistemas de drenaje sanitario según NTC 1500.</p>
            <T>
              <Tr><Th>Aparato</Th><Th>Control</Th><Th>UD</Th></Tr>
              <Tr><Td>Lavamanos</Td><Td>Llave</Td><Td>2</Td></Tr>
              <Tr><Td>Sanitario con tanque</Td><Td>Tanque</Td><Td>4</Td></Tr>
              <Tr><Td>Ducha</Td><Td>Válvula mezcla</Td><Td>2</Td></Tr>
              <Tr><Td>Lavaplatos</Td><Td>Griferia</Td><Td>2</Td></Tr>
              <Tr><Td>Tina</Td><Td>Válvula mezcla</Td><Td>2</Td></Tr>
              <Tr><Td>Lavadora</Td><Td>—</Td><Td>4</Td></Tr>
              <Tr><Td>Lavadero</Td><Td>—</Td><Td>2</Td></Tr>
              <Tr><Td>Orinal / Urinal</Td><Td>Tanque</Td><Td>5</Td></Tr>
              <Tr><Td>Sanitario fluxometro</Td><Td>Fluxómetro</Td><Td>6</Td></Tr>
            </T>
          </div>
        ),
      },
      {
        title: 'Caudal por simultaneidad',
        body: (
          <div className="space-y-3">
            <p>Factor de simultaneidad y caudal de diseño por el método de Hunter:</p>
            <F>
              K = 1 / &radic;(N − 1) &nbsp;&nbsp; (N &gt; 1)<br/>
              K = 1 &nbsp;&nbsp; (N = 1)
            </F>
            <F>
              Q = K · Q<sub>UD</sub><br/><br/>
              Q<sub>UD</sub> = 0.1163 · UD<sup>0.6875</sup> &nbsp;&nbsp; (UD &lt; 240)<br/>
              Q<sub>UD</sub> = 0.074 · UD<sup>0.7504</sup> &nbsp;&nbsp; (UD &ge; 240)
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">K</span><span>factor de simultaneidad</span>
              <span className="font-semibold text-primary">N</span><span>número de aparatos conectados</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (L/min)</span>
              <span className="font-semibold text-primary">Q<sub>UD</sub></span><span>caudal por unidad de descarga (L/min)</span>
              <span className="font-semibold text-primary">UD</span><span>unidades de descarga totales</span>
            </div>
            <div className="text-[12px] text-on-surface-variant">Fórmula basada en Hunter - ASHRAE</div>
          </div>
        ),
      },
      {
        title: 'Bajantes sanitarios',
        body: (
          <div className="space-y-3">
            <p>Diametro de bajante por maning:</p>
            <F>
              D = ((Q · n) / (0.312 · &radic;S))<sup>3/8</sup> &times; 1000 / 25.4 &nbsp;&nbsp;[pulg]
            </F>
            <F>
              Q = 0.312 · (D/1000)<sup>8/3</sup> · &radic;S / n
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">D</span><span>diámetro (pulgadas)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (m³/s)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de maning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Velocidad mínima: 0.60 m/s (autolimpieza) · Velocidad máxima: 5.00 m/s<br/>
              Fuerza tractiva: T<sub>0</sub> &ge; 0.10 kg/m² (NTC 1500)
            </div>
          </div>
        ),
      },
      {
        title: 'Tubería de ventilación',
        body: (
          <div className="space-y-3">
            <p>Funciones: entrada de aire, evacuación de gases, mantener sellos hidráulicos, autolimpieza.</p>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3 mb-2">
              Diametro mínimo NTC 1500: 1&frac12;" (38 mm)
            </div>
            <F>
              Q<sub>aire</sub> = 1000 · V<sub>t</sub> · (&pi;/4) · D² · (17/24)
            </F>
            <F>
              D<sub>vent</sub> = ((Q<sub>aire</sub> · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup>
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q<sub>aire</sub></span><span>caudal de aire requerido (m³/s)</span>
              <span className="font-semibold text-primary">V<sub>t</sub></span><span>velocidad del aire en la tubería (m/s)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro de la bajante (m)</span>
              <span className="font-semibold text-primary">D<sub>vent</sub></span><span>diámetro de ventilacion (m)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de maning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            </div>
          </div>
        ),
      },
    ],
  },
  lluvias: {
    name: 'Aguas lluvias',
    icon: 'water',
    color: '#22D3EE',
    sections: [
      {
        title: 'Método racional',
        body: (
          <div className="space-y-3">
            <p>El caudal de aguas lluvias se calcula según RAS 2000:</p>
            <F>
              Q = (C · I · A) / 360
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (m³/s)</span>
              <span className="font-semibold text-primary">C</span><span>coeficiente de escorrentía</span>
              <span className="font-semibold text-primary">I</span><span>intensidad de lluvia (mm/h)</span>
              <span className="font-semibold text-primary">A</span><span>área de drenaje (m²)</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Coeficiente de escorrentía C',
        body: (
          <T>
            <Tr><Th>Tipo de superficie</Th><Th>C</Th></Tr>
            <Tr><Td>Cubierta impermeable</Td><Td>0.95–1.00</Td></Tr>
            <Tr><Td>Cubierta metálica</Td><Td>0.95–1.00</Td></Tr>
            <Tr><Td>Teja / Placa concreto</Td><Td>0.85–0.95</Td></Tr>
            <Tr><Td>Jardines / Areas verdes</Td><Td>0.10–0.25</Td></Tr>
            <Tr><Td>Zonas pavimentadas</Td><Td>0.70–0.95</Td></Tr>
            <Tr><Td>Césped / Suelo arenoso</Td><Td>0.05–0.10</Td></Tr>
            <Tr><Td>Césped / Suelo arcilloso</Td><Td>0.15–0.25</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Bajante y canal de cubierta',
        body: (
          <div className="space-y-3">
            <p>Diametro de bajante de aguas lluvias:</p>
            <F>
              D = ((Q · n) / (1.754 · S<sup>5/3</sup>))<sup>3/8</sup> &times; 1000 &nbsp;&nbsp;[mm]
            </F>
            <p className="text-[13px]">Canal rectangular — caudal máximo:</p>
            <F>
              Q<sub>max</sub> = (1/n) · A · R<sub>h</sub><sup>2/3</sup> · √S
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">D</span><span>diámetro de bajante (mm)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de diseño (m³/s)</span>
              <span className="font-semibold text-primary">Q<sub>max</sub></span><span>caudal máximo del canal (m³/s)</span>
              <span className="font-semibold text-primary">n</span><span>coeficiente de maning</span>
              <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
              <span className="font-semibold text-primary">A</span><span>área hidráulica del canal (m²)</span>
              <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant">Verificación: Q<sub>real</sub> &le; Q<sub>max</sub> → OK</div>
          </div>
        ),
      },
    ],
  },
  agua_fria: {
    name: 'Agua fría',
    icon: 'ac_unit',
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
            <p className="font-semibold text-[13px]">Presiónes mínimas por aparato (NTC 1500):</p>
            <T>
              <Tr><Th>Aparato</Th><Th>Min (m.c.a.)</Th><Th>Max (m.c.a.)</Th></Tr>
              <Tr><Td>Inodoro tanque</Td><Td>0.71</Td><Td>14.10</Td></Tr>
              <Tr><Td>Lavamanos</Td><Td>0.51</Td><Td>5.63</Td></Tr>
              <Tr><Td>Ducha</Td><Td>1.02</Td><Td>5.63</Td></Tr>
              <Tr><Td>Lavaplatos</Td><Td>0.51</Td><Td>5.63</Td></Tr>
              <Tr><Td>Tina</Td><Td>0.51</Td><Td>14.10</Td></Tr>
            </T>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Velocidad recomendada: 0.60 m/s – 3.00 m/s · Maxima absoluta: 5.00 m/s
            </div>
          </div>
        ),
      },
    ],
  },
  agua_caliente: {
    name: 'Agua caliente',
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
              <span className="font-semibold">Caudal de recirculacion:</span>
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
              <span className="font-semibold text-primary">Q<sub>rec</sub></span><span>caudal de recirculacion (kg/h)</span>
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
  },
  gas: {
    name: 'Red de gas',
    icon: 'gas_meter',
    color: '#A855F7',
    sections: [
      {
        title: 'Método de Renouard',
        body: (
          <div className="space-y-3">
            <p>Fórmula de Renouard para redes de baja presión (NTC 3728):</p>
            <F>
              &Delta;P = 48620 · K · L · Q<sup>1.82</sup> / (P<sub>atm</sub> · D<sup>4.82</sup>)
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">&Delta;P</span><span>pérdida de presión (Pa)</span>
              <span className="font-semibold text-primary">K</span><span>coeficiente de fricción</span>
              <span className="font-semibold text-primary">L</span><span>longitud total (m)</span>
              <span className="font-semibold text-primary">Q</span><span>caudal de gas (m³/h)</span>
              <span className="font-semibold text-primary">P<sub>atm</sub></span><span>presión atmosferica (kPa)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro interno (mm)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Limite: &Delta;P &le; 9.81 mbar (1 m.c.a.) · Velocidad max: 10 m/s
            </div>
          </div>
        ),
      },
      {
        title: 'Factor de simultaneidad',
        body: (
          <T>
            <Tr><Th>N° aparatos</Th><Th>Factor fs</Th></Tr>
            <Tr><Td>1–2</Td><Td>1.00</Td></Tr>
            <Tr><Td>3–5</Td><Td>0.80</Td></Tr>
            <Tr><Td>6–10</Td><Td>0.70</Td></Tr>
            <Tr><Td>11–20</Td><Td>0.60</Td></Tr>
            <Tr><Td>&gt; 20</Td><Td>0.50</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Materiales para gas',
        body: (
          <T>
            <Tr><Th>Material</Th><Th>Diametro típico</Th><Th>K</Th></Tr>
            <Tr><Td>PE al PE ¾"</Td><Td>20 mm</Td><Td>49</Td></Tr>
            <Tr><Td>PE al PE 1"</Td><Td>25 mm</Td><Td>49</Td></Tr>
            <Tr><Td>Acero Galv ½"</Td><Td>12.7 mm</Td><Td>57.5</Td></Tr>
            <Tr><Td>Acero Galv ¾"</Td><Td>19 mm</Td><Td>57.5</Td></Tr>
            <Tr><Td>Cobre Rigido ½"</Td><Td>10.9 mm</Td><Td>54.2</Td></Tr>
            <Tr><Td>Cobre Rigido ¾"</Td><Td>17.4 mm</Td><Td>54.2</Td></Tr>
          </T>
        ),
      },
    ],
  },
  equipos: {
    name: 'Bombas, tanques y equipos',
    icon: 'settings',
    color: '#0ECC7A',
    sections: [
      {
        title: 'Potencia de bomba',
        body: (
          <div className="space-y-3">
            <F>
              HP = (Q · H<sub>m</sub>) / (76 · &eta;)
            </F>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">HP</span><span>potencia (HP) — 1 HP = 0.746 kW</span>
              <span className="font-semibold text-primary">Q</span><span>caudal (L/min)</span>
              <span className="font-semibold text-primary">H<sub>m</sub></span><span>altura manometrica total (m)</span>
              <span className="font-semibold text-primary">&eta;</span><span>eficiencia de la bomba (decimal)</span>
            </div>
            <p className="text-[13px] mt-2 font-semibold">Altura manometrica total:</p>
            <F>
              H<sub>m</sub> = H<sub>s</sub> + H<sub>i</sub> + h<sub>f,s</sub> + h<sub>f,i</sub>
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">H<sub>s</sub></span><span>altura de succión (m)</span>
              <span className="font-semibold text-primary">H<sub>i</sub></span><span>altura de impulsión (m)</span>
              <span className="font-semibold text-primary">h<sub>f,s</sub></span><span>pérdida por fricción en succión (m)</span>
              <span className="font-semibold text-primary">h<sub>f,i</sub></span><span>pérdida por fricción en impulsión (m)</span>
            </div>
          </div>
        ),
      },
      {
        title: 'NPSH',
        body: (
          <div className="space-y-3">
            <F>
              NPSH<sub>disp</sub> = (P<sub>atm</sub> − P<sub>v</sub>) / (&rho; · g) − h<sub>f,s</sub>
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">NPSH<sub>disp</sub></span><span>carga neta de succión disponible (m)</span>
              <span className="font-semibold text-primary">P<sub>atm</sub></span><span>presión atmosferica (Pa)</span>
              <span className="font-semibold text-primary">P<sub>v</sub></span><span>presión de vapor del agua (Pa)</span>
              <span className="font-semibold text-primary">&rho;</span><span>densidad del agua (kg/m³)</span>
              <span className="font-semibold text-primary">g</span><span>gravedad = 9.81 m/s²</span>
              <span className="font-semibold text-primary">h<sub>f,s</sub></span><span>pérdida por fricción en succión (m)</span>
            </div>
            <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              Verificación: NPSH<sub>req</sub> &lt; NPSH<sub>disp</sub> (curva de bomba)
            </div>
          </div>
        ),
      },
      {
        title: 'Tanque de reserva',
        body: (
          <div className="space-y-3">
            <F>
              V = Población · Dotacion · F<sub>reserva</sub>
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">V</span><span>volumen del tanque (L)</span>
              <span className="font-semibold text-primary">Población</span><span>número de habitantes</span>
              <span className="font-semibold text-primary">Dotacion</span><span>consumo diario por persona (L/hab/dia)</span>
              <span className="font-semibold text-primary">F<sub>reserva</sub></span><span>factor de reserva (usualmente 1.5–2.0)</span>
            </div>
            <T>
              <Tr><Th>Tipo de uso</Th><Th>Dotacion (L/hab/dia)</Th></Tr>
              <Tr><Td>Residencial</Td><Td>150–200</Td></Tr>
              <Tr><Td>Hotel</Td><Td>250–400</Td></Tr>
              <Tr><Td>Comercial</Td><Td>80–120</Td></Tr>
              <Tr><Td>Industrial</Td><Td>100–200</Td></Tr>
            </T>
            <div className="text-[12px] text-on-surface-variant">
              Relación L/A: 2:1 a 4:1 · Altura: 1.5–3.0 m
            </div>
          </div>
        ),
      },
      {
        title: 'Sistemas hidroneumáticos',
        body: (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold">Premisas de diseño:</p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-surface-container-low p-2 rounded">Dotacion: 250 L/persona</div>
              <div className="bg-surface-container-low p-2 rounded">Q<sub>b</sub> = 3 &times; Q<sub>m</sub></div>
              <div className="bg-surface-container-low p-2 rounded">P max: 50 psi (350 kPa)</div>
              <div className="bg-surface-container-low p-2 rounded">P min: 30 psi (207 kPa)</div>
              <div className="bg-surface-container-low p-2 rounded">Arranques max: 6/hora</div>
              <div className="bg-surface-container-low p-2 rounded">Eficiencia: 60%</div>
            </div>
            <F>
              Q<sub>m</sub> = (q · N) / 1440 &nbsp;&nbsp;[L/min]
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Q<sub>m</sub></span><span>caudal medio (L/min)</span>
              <span className="font-semibold text-primary">q</span><span>consumo unitario por persona (L/persona/dia)</span>
              <span className="font-semibold text-primary">N</span><span>número de personas</span>
            </div>
          </div>
        ),
      },
    ],
  },
  tablas: {
    name: 'Tablas y verificaciones',
    icon: 'table_chart',
    color: '#C9A227',
    sections: [
      {
        title: 'maning — coeficientes n',
        body: (
          <T>
            <Tr><Th>Material</Th><Th>n</Th></Tr>
            <Tr><Td>PVC sanitario</Td><Td>0.009</Td></Tr>
            <Tr><Td>PVC presión</Td><Td>0.009</Td></Tr>
            <Tr><Td>Hierro fundido</Td><Td>0.013</Td></Tr>
            <Tr><Td>Concreto</Td><Td>0.013</Td></Tr>
            <Tr><Td>Acero galvanizado</Td><Td>0.015</Td></Tr>
            <Tr><Td>Cobre</Td><Td>0.013</Td></Tr>
            <Tr><Td>Gres ceramico</Td><Td>0.010</Td></Tr>
            <Tr><Td>PE</Td><Td>0.009</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Verificaciones sanitarias',
        body: (
          <T>
            <Tr><Th>Parametro</Th><Th>Condicion</Th><Th>Ref.</Th></Tr>
            <Tr><Td>Pendiente min (2–6")</Td><Td>&ge; 2% (20 mm/m)</Td><Td>NTC 1500 8.4.1</Td></Tr>
            <Tr><Td>Pendiente min (8"+ )</Td><Td>&ge; 0.5% (5 mm/m)</Td><Td>NTC 1500 8.4.1</Td></Tr>
            <Tr><Td>Velocidad mínima</Td><Td>&ge; 0.60 m/s</Td><Td>NTC 1500</Td></Tr>
            <Tr><Td>Velocidad máxima</Td><Td>&le; 5.00 m/s</Td><Td>NTC 1500</Td></Tr>
            <Tr><Td>Fuerza tractiva min</Td><Td>&ge; 0.10 kg/m²</Td><Td>NTC 1500</Td></Tr>
            <Tr><Td>Relleno sobre tubería</Td><Td>&ge; 0.30 m</Td><Td>NTC 1500</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Verificaciones redes de agua',
        body: (
          <T>
            <Tr><Th>Parametro</Th><Th>Condicion</Th><Th>Ref.</Th></Tr>
            <Tr><Td>Velocidad máxima (rec.)</Td><Td>&le; 3.00 m/s</Td><Td>RAS 2000</Td></Tr>
            <Tr><Td>Velocidad máxima abs.</Td><Td>&le; 5.00 m/s</Td><Td>RAS 2000</Td></Tr>
            <Tr><Td>Presión estatica max</Td><Td>&le; 50 m.c.a.</Td><Td>NTC 1500</Td></Tr>
            <Tr><Td>Presión dinamica min</Td><Td>&ge; 3.00 m.c.a.</Td><Td>NTC 1500</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Verificaciones red de gas',
        body: (
          <T>
            <Tr><Th>Parametro</Th><Th>Condicion</Th><Th>Ref.</Th></Tr>
            <Tr><Td>&Delta;P máximo</Td><Td>&le; 9.81 mbar</Td><Td>NTC 3728</Td></Tr>
            <Tr><Td>Velocidad máxima</Td><Td>&le; 10 m/s</Td><Td>NTC 3728</Td></Tr>
            <Tr><Td>P. min en acometida</Td><Td>&ge; 17 mbar</Td><Td>NTC 3728</Td></Tr>
            <Tr><Td>P. max interior</Td><Td>&le; 25 mbar</Td><Td>NTC 3728</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Diámetros comerciales PVC RDE 11',
        body: (
          <T>
            <Tr><Th>Nominal</Th><Th>DI (mm)</Th><Th>DE (mm)</Th></Tr>
            <Tr><Td>½"</Td><Td>16.6</Td><Td>21.3</Td></Tr>
            <Tr><Td>¾"</Td><Td>21.8</Td><Td>26.7</Td></Tr>
            <Tr><Td>1"</Td><Td>28.5</Td><Td>33.4</Td></Tr>
            <Tr><Td>1¼"</Td><Td>37.1</Td><Td>42.2</Td></Tr>
            <Tr><Td>1½"</Td><Td>43.6</Td><Td>48.3</Td></Tr>
            <Tr><Td>2"</Td><Td>56.1</Td><Td>60.3</Td></Tr>
          </T>
        ),
      },
    ],
  },
  formulas: {
    name: 'Fórmulas del sistema',
    icon: 'calculate',
    color: '#F5A623',
    sections: [

      {
        title: 'Número de Reynolds',
        body: (
          <div className="space-y-3">
            <F>
              Re = (V · D) / &nu;
            </F>
            <div><span className="text-on-surface-variant">Donde:</span></div>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
              <span className="font-semibold text-primary">Re</span><span>número de Reynolds (adimensional)</span>
              <span className="font-semibold text-primary">V</span><span>velocidad del fluido (m/s)</span>
              <span className="font-semibold text-primary">D</span><span>diámetro interno de la tubería (m)</span>
              <span className="font-semibold text-primary">&nu;</span><span>viscosidad cinematica del agua (m²/s)</span>
            </div>
            <T>
              <Tr><Th>Tipo de flujo</Th><Th>Rango Re</Th><Th>Caracteristica</Th></Tr>
              <Tr><Td>Laminar</Td><Td>Re &lt; 2300</Td><Td>Líneas paralelas</Td></Tr>
              <Tr><Td>Transicion</Td><Td>2300 &lt; Re &lt; 4000</Td><Td>Inestable</Td></Tr>
              <Tr><Td>Turbulento</Td><Td>Re &gt; 4000</Td><Td>Mezcla intensa</Td></Tr>
            </T>
          </div>
        ),
      },
    ],
  },
  manual: {
    name: 'Manual de usuario',
    icon: 'menu_book',
    color: '#4D8FF7',
    sections: [
      {
        title: 'Introducción',
        body: (
          <div className="space-y-3">
            <p>CIVILFLOW KML 2026 es un aplicativo web de diseño hidrosanitario desarrollado por el Ing. Camilo Cardenas Chacon. Permite elaborar memorias de cálculo completas para redes de Agua Fria, Agua Caliente, Sanitaria, Aguas Lluvias, Ventilación, Gas Combustible y Red Contra Incendio.</p>
            <p className="text-[13px] font-semibold">Normas aplicadas:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 1500:2020</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">RAS 2000</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NTC 3728</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NSR-10 Título J</span>
              <span className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-[11px] font-mono">NFPA 13</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Interfaz del aplicativo',
        body: (
          <div className="space-y-4">
            <p>La interfaz de CIVILFLOW KML 2026 se divide en cinco zonas principales, cada una con funciones especificas para facilitar el diseño hidrosanitario:</p>

            <div className="border border-outline-variant rounded overflow-hidden">
              <div className="grid grid-cols-[140px,1fr] gap-0 text-[13px]">
                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Topbar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra superior con el logo de la firma KML, el nombre del sistema Civil Flow, los datos del ingeniero responsable (nombre, titulo, número de matricula profesional) y las normas tecnicas aplicables (NTC 1500, RAS 2000, NTC 3728, NSR-10). Se muestra tambien el nombre del proyecto activo.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Nav / Pestanas</div>
                <div className="px-3 py-2 border-b border-outline-variant">Barra de navegacion con pestanas para acceder a cada modulo del aplicativo: Planos (carga de PDF o imagen), Materiales (gestion de catalogos por red), Aparatos (tabla de unidades de consumo y descarga), Cubierta (cálculo de aguas lluvias por método racional), Gas (diseño de redes por Renouard), Calentadores (selección de equipos a gas), Validacion (resumen y verificacion final).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Sidebar</div>
                <div className="px-3 py-2 border-b border-outline-variant">Panel lateral izquierdo con tres secciones: Datos del proyecto (nombre, dirección, municipio, uso, empresa prestadora, presión de red, dotación), Materiales por red (selector de tipo de tubería para cada sistema: AF, AC, sanitaria, lluvias, ventilacion, gas, RCI), Redes a calcular (toggles para activar o desactivar cada red del proyecto) y Generador de niveles (configuración de sótanos, pisos, alturas y NPT).</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2 border-b border-outline-variant">Content</div>
                <div className="px-3 py-2 border-b border-outline-variant">Area central donde se muestran las tablas, formularios y resultados del modulo selecciónado. Aqui se ingresan los datos de cada red, se visualizan los cálculos y se revisan las verificaciones de norma.</div>

                <div className="bg-surface-container-high font-semibold px-3 py-2">Act Bar</div>
                <div className="px-3 py-2">Barra de accion inferior que muestra en tiempo real los totales del proyecto: unidades de consumo (UC) de agua fria y caliente, unidades de descarga (UD) sanitarias, pérdida de presión acumulada de gas (ΔP) con indicador color verde/rojo según cumpla el límite NTC 3728.</div>
              </div>
            </div>

            <p className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
              El orden de trabajo recomendado es: datos del proyecto, generación de niveles, selección de materiales, activación de redes, ajuste de aparatos, cálculo de cubierta, diseño de red de gas, selección de calentador y finalmente validación y exportación.
            </p>
          </div>
        ),
      },
      {
        title: 'Datos del proyecto',
        body: (
          <div className="space-y-3">
            <p>Complete los datos generales en el Sidebar. Estos datos aparecen en todas las memorias de cálculo.</p>
            <T>
              <Tr><Th>Campo</Th><Th>Ejemplo</Th></Tr>
              <Tr><Td>Nombre del proyecto</Td><Td>Casa No. 26 CR Monte Real</Td></Tr>
              <Tr><Td>Direccion</Td><Td>CR 10 No. 25-40</Td></Tr>
              <Tr><Td>Municipio</Td><Td>Floridablanca</Td></Tr>
              <Tr><Td>Uso</Td><Td>Vivienda unifamiliar</Td></Tr>
              <Tr><Td>Empresa prestadora</Td><Td>EMAB - Floridablanca</Td></Tr>
              <Tr><Td>P. red (m.c.a.)</Td><Td>20</Td></Tr>
              <Tr><Td>Dotacion (L/hab/dia)</Td><Td>280</Td></Tr>
            </T>
            <div className="text-[12px] text-on-surface-variant">Dotacion según RAS 2000 Tabla B.2.1 — Vivienda unifamiliar: 200–280 L/hab/dia.</div>
          </div>
        ),
      },
      {
        title: 'Generador de niveles',
        body: (
          <div className="space-y-3">
            <p>El generador automatico de niveles se encuentra en la parte inferior del Sidebar.</p>
            <ol className="list-decimal list-inside text-[13px] space-y-1">
              <li>Definir N° de sótanos (0 si no aplica)</li>
              <li>Definir N° de pisos sobre rasante (min. 1)</li>
              <li>Altura de entrepiso (2.80–3.30 m) y sotano (2.80–3.00 m)</li>
              <li>NPT Piso 1 (nivel de referencia)</li>
              <li>Activar "Incluir cubierta" si aplica</li>
              <li>Hacer clic en "Generar niveles"</li>
            </ol>
          </div>
        ),
      },
      {
        title: 'Redes a calcular',
        body: (
          <T>
            <Tr><Th>#</Th><Th>Red</Th><Th>Cuando activar</Th></Tr>
            <Tr><Td>1</Td><Td>Sanitaria</Td><Td>Siempre — obligatoria</Td></Tr>
            <Tr><Td>2</Td><Td>Ventilación</Td><Td>Siempre — acompaña sanitaria</Td></Tr>
            <Tr><Td>3</Td><Td>Aguas Lluvias</Td><Td>Cuando hay cubierta</Td></Tr>
            <Tr><Td>4</Td><Td>Agua Fria</Td><Td>Siempre — suministro</Td></Tr>
            <Tr><Td>5</Td><Td>Agua Caliente</Td><Td>Cuando hay calentador</Td></Tr>
            <Tr><Td>6</Td><Td>Red de Gas</Td><Td>Cuando hay aparatos a gas</Td></Tr>
            <Tr><Td>7</Td><Td>Equipo Presión</Td><Td>Presión de red insuficiente</Td></Tr>
            <Tr><Td>8</Td><Td>Bomba AR</Td><Td>Aguas residuales en sotano</Td></Tr>
            <Tr><Td>9</Td><Td>Recirculación AC</Td><Td>L de AC &gt; 15 m</Td></Tr>
            <Tr><Td>10</Td><Td>Contra Incendio</Td><Td>Segun NSR-10 Titulo J</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Flujo de trabajo completo',
        body: (
          <T>
            <Tr><Th>#</Th><Th>Tarea</Th></Tr>
            <Tr><Td>1</Td><Td>Datos del proyecto (Sidebar)</Td></Tr>
            <Tr><Td>2</Td><Td>Generar niveles</Td></Tr>
            <Tr><Td>3</Td><Td>Seleccionar materiales</Td></Tr>
            <Tr><Td>4</Td><Td>Activar redes</Td></Tr>
            <Tr><Td>5</Td><Td>Ajustar aparatos (UC, UD, Q gas)</Td></Tr>
            <Tr><Td>6</Td><Td>Ingresar cubierta (areas, I)</Td></Tr>
            <Tr><Td>7</Td><Td>Calcular red de gas (Renouard)</Td></Tr>
            <Tr><Td>8</Td><Td>Seleccionar calentador</Td></Tr>
            <Tr><Td>9</Td><Td>Verificar validación</Td></Tr>
            <Tr><Td>10</Td><Td>Verificar validación final</Td></Tr>
          </T>
        ),
      },
      {
        title: 'Normatividad aplicada',
        body: (
          <T>
            <Tr><Th>Norma</Th><Th>Aplicación</Th></Tr>
            <Tr><Td>NTC 1500:2020</Td><Td>UC, UD, presiónes, velocidades, diámetros mínimos</Td></Tr>
            <Tr><Td>RAS 2000</Td><Td>Dotaciones, maning, método racional</Td></Tr>
            <Tr><Td>NTC 3728</Td><Td>Renouard, caudales gas, factor fs</Td></Tr>
            <Tr><Td>NSR-10 Título J</Td><Td>Protección contra incendio</Td></Tr>
            <Tr><Td>NFPA 13:2022</Td><Td>Rociadores, densidad, área operación</Td></Tr>
            <Tr><Td>NTC 382</Td><Td>PVC a presión, RDE</Td></Tr>
            <Tr><Td>NTC 1087</Td><Td>PVC sanitario y lluvias</Td></Tr>
          </T>
        ),
      },
    ],
  },
}

function SectionAccordion({ section, sectionKey, isOpen, onToggle, showCategory }) {
  return (
    <div
      className="border border-outline-variant rounded overflow-hidden bg-surface-container"
      data-section-color
      style={{ '--section-color': section.categoryColor }}
    >
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high"
      >
        <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
          chevron_right
        </span>
        <span className="text-[13px] font-semibold text-on-surface">{section.title}</span>
        {showCategory && (
          <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ color: section.categoryColor, border: '1px solid var(--section-color)' }}>
            {section.categoryName}
          </span>
        )}
        <span className="ml-auto material-symbols-outlined text-on-surface-variant text-sm">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-outline-variant animate-fade-in">
          {section.body}
        </div>
      )}
    </div>
  )
}

function DocsPage() {
  const [activeCat, setActiveCat] = useState('hidraulica')
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState({})

  const categories = Object.entries(docData).map(([id, data]) => ({
    id,
    ...data,
    sections: data.sections.map(s => ({
      ...s,
      categoryColor: data.color,
      categoryName: data.name,
      categoryId: id,
    }))
  }))
  const activeCategory = categories.find((c) => c.id === activeCat)

  const allSections = categories.flatMap(c => c.sections)

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  const filteredSections =
    search.trim() === ''
      ? activeCategory?.sections || []
      : allSections.filter((s) => {
          const str = JSON.stringify(s.body.props.children)
          return (
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            (str && str.toLowerCase().includes(search.toLowerCase()))
          )
        })

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      <Navbar />
      <div className="flex gap-4 h-[calc(100vh-64px)] pt-16">
      <style>{`
        [data-section-color] .text-primary,
        [data-section-color] .\\!text-primary {
          color: var(--section-color) !important;
        }
        .docs-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .docs-scroll::-webkit-scrollbar-track {
          background: #1a1c20;
        }
        .docs-scroll::-webkit-scrollbar-thumb {
          background: #3a494a;
          border-radius: 3px;
        }
        .docs-scroll::-webkit-scrollbar-thumb:hover {
          background: #4d8ff7;
        }
      `}</style>
      {/* Sidebar de categorías */}
      <div className="w-64 shrink-0 border border-outline-variant bg-surface-container flex flex-col">
        <div className="p-4 border-b border-outline-variant">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
            Categorias
          </h2>
        </div>
        <div className="flex-1 overflow-auto docs-scroll">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCat(cat.id)
                setOpenSections({})
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                activeCat === cat.id
                  ? 'bg-surface-container-high border-l-2 text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              style={{
                borderLeftColor: activeCat === cat.id ? cat.color : 'transparent',
              }}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ color: cat.color }}>
                {cat.icon}
              </span>
              <span className="text-[13px] font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header + Busqueda */}
        <div className="mb-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-3xl" style={{ color: search.trim() ? '#e9feff' : activeCategory?.color }}>
            {search.trim() ? 'search' : activeCategory?.icon}
          </span>
          <div className="flex-1">
            <h1 className="text-headline-sm font-bold text-on-surface">
              {search.trim() ? 'Resultados de busqueda' : activeCategory?.name}
            </h1>
          </div>
          <div className="w-72">
            <div className="flex items-center border border-outline-variant bg-surface-container px-3">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 h-10 px-3 bg-transparent text-on-surface text-[13px] font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Acordeón de secciones */}
        <div className="flex-1 overflow-auto space-y-2 pr-1 docs-scroll">
          {filteredSections.map((section) => {
            const sectionKey = `${section.categoryId}:${section.title}`
            return (
              <SectionAccordion
                key={sectionKey}
                section={section}
                sectionKey={sectionKey}
                isOpen={openSections[sectionKey]}
                onToggle={toggleSection}
                showCategory={search.trim() !== ''}
              />
            )
          })}
          {filteredSections.length === 0 && (
            <div className="text-center text-on-surface-variant text-[13px] py-12">
              No se encontraron resultados
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

export default DocsPage
