import React from 'react'
import { FormatText as F, TableWrapper as T, TableHeader as Th, TableCell as Td, TableRow as Tr } from '../SectionAccordion'

export const gas = {
  name: 'Red de gas',
  icon: 'gas_meter' as const,
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
            <span className="font-semibold text-primary">P<sub>atm</sub></span><span>presión atmosférica (kPa)</span>
            <span className="font-semibold text-primary">D</span><span>diámetro interno (mm)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Límite: &Delta;P &le; 9.81 mbar (1 m.c.a.) · Velocidad máx: 10 m/s
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
          <Tr><Th>Material</Th><Th>Diámetro típico</Th><Th>K</Th></Tr>
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
}
