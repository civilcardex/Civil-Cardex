import React from 'react'
import { FormatText as F, TableWrapper as T, TableHeader as Th, TableCell as Td, TableRow as Tr } from '../SectionAccordion'

export const sanitarias = {
  name: 'Redes sanitarias',
  icon: 'plumbing' as const,
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
            <Tr><Td>Inodoro</Td><Td>Tanque</Td><Td>4</Td></Tr>
            <Tr><Td>Ducha</Td><Td>Válvula mezcla</Td><Td>2</Td></Tr>
            <Tr><Td>Lavaplatos</Td><Td>Grifería</Td><Td>2</Td></Tr>
            <Tr><Td>Tina</Td><Td>Válvula mezcla</Td><Td>2</Td></Tr>
            <Tr><Td>Lavadora</Td><Td>—</Td><Td>4</Td></Tr>
            <Tr><Td>Lavadero</Td><Td>—</Td><Td>2</Td></Tr>
            <Tr><Td>Orinal / Urinal</Td><Td>Tanque</Td><Td>5</Td></Tr>
            <Tr><Td>Sanitario fluxómetro</Td><Td>Fluxómetro</Td><Td>6</Td></Tr>
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
          <p>Diámetro de bajante por Manning:</p>
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
            <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
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
            Diámetro mínimo NTC 1500: 1&frac12;" (38 mm)
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
            <span className="font-semibold text-primary">D<sub>vent</sub></span><span>diámetro de ventilación (m)</span>
            <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
            <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
          </div>
        </div>
      ),
    },
  ],
}

export const lluvias = {
  name: 'Aguas lluvias',
  icon: 'water' as const,
  color: '#22D3EE',
  sections: [
    {
      title: 'Método racional',
      body: (
        <div className="space-y-3">
          <p>El caudal de Aguas lluvias se calcula según RAS 2000:</p>
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
          <p>Diámetro de bajante de Aguas lluvias:</p>
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
            <span className="font-semibold text-primary">n</span><span>coeficiente de Manning</span>
            <span className="font-semibold text-primary">S</span><span>pendiente (m/m)</span>
            <span className="font-semibold text-primary">A</span><span>área hidráulica del canal (m²)</span>
            <span className="font-semibold text-primary">R<sub>h</sub></span><span>radio hidráulico (m)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant">Verificación: Q<sub>real</sub> &le; Q<sub>max</sub> → OK</div>
        </div>
      ),
    },
  ],
}
