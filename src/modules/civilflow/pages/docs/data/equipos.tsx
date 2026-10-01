import { Tabla } from './ui';

const equipos = {
  name: 'Bombas, tanques y equipos',
  desc: 'Potencia de bombas, NPSH, tanque de reserva e hidroneumáticos.',
  icon: 'settings',
  color: '#0ECC7A',
  sections: [
    {
      title: 'Potencia de bomba',
      body: (
        <div className="space-y-3">
          <p>
            Cadena de potencia que calculan las tablas de bomba aguas residuales y equipo de
            presión:
          </p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q<sub>bombeo</sub> = 1.25 · Q<sub>diseño</sub> &nbsp;&nbsp;(reserva 25%)
            <br />P<sub>hid</sub> = &rho; · g · Q · H<sub>m</sub> &nbsp;&nbsp;[W]
            <br />P<sub>eje</sub> = P<sub>hid</sub> / &eta;<sub>bomba</sub>
            <br />
            HP = P<sub>eje</sub> / 746 &nbsp;&nbsp;&nbsp;(forma compacta: HP = Q·H<sub>m</sub> /
            (76·&eta;) con Q en L/min)
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              P<sub>hid</sub>
            </span>
            <span>potencia hidráulica: la que el fluido recibe</span>
            <span className="font-semibold text-primary">
              P<sub>eje</sub>
            </span>
            <span>potencia en el eje: lo que exige el motor con el rendimiento de la curva</span>
            <span className="font-semibold text-primary">
              P<sub>com</sub>
            </span>
            <span>
              potencia comercial: el motor comercial inmediatamente superior se selecciona ≥ este
              valor
            </span>
            <span className="font-semibold text-primary">1 HP</span>
            <span>= 0.746 kW = 746 W</span>
          </div>
          <p className="text-[13px] mt-2 font-semibold">Altura manométrica total:</p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            H<sub>m</sub> = H<sub>s</sub> + H<sub>i</sub> + h<sub>f,s</sub> + h<sub>f,i</sub>
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              H<sub>s</sub>
            </span>
            <span>altura de succión (m)</span>
            <span className="font-semibold text-primary">
              H<sub>i</sub>
            </span>
            <span>altura de impulsión (m)</span>
            <span className="font-semibold text-primary">
              h<sub>f,s</sub> / h<sub>f,i</sub>
            </span>
            <span>
              pérdidas por fricción en succión/impulsión (Hazen-Williams sobre la longitud
              equivalente)
            </span>
          </div>
          <p className="text-[13px]">
            Para el catálogo el caudal se convierte a GPM: Q<sub>bombeo</sub> × 15.8503. La
            selección final (bomba sumergible trituradora, impeler monocanal) se verifica contra la
            curva del fabricante.
          </p>
        </div>
      ),
    },
    {
      title: 'NPSH',
      body: (
        <div className="space-y-3">
          <p>
            Carga neta positiva de succión: si no se cumple, la bomba cavita (ruido, pérdida de
            capacidad, erosión del impeler):
          </p>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            NPSH<sub>disp</sub> = (P<sub>atm</sub> − P<sub>v</sub>) / (&rho; · g) ± h<sub>z</sub> −
            h<sub>f,s</sub>
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              NPSH<sub>disp</sub>
            </span>
            <span>carga neta de succión disponible (m)</span>
            <span className="font-semibold text-primary">
              P<sub>atm</sub>
            </span>
            <span>presión atmosférica — CAE con la altitud (Bogotá ≈ 75% del nivel del mar)</span>
            <span className="font-semibold text-primary">
              P<sub>v</sub>
            </span>
            <span>presión de vapor del agua a su temperatura (Pa)</span>
            <span className="font-semibold text-primary">
              h<sub>z</sub>
            </span>
            <span>
              carga de la lámina de agua sobre la boca de succión (+ si la bomba está debajo, − si
              está encima)
            </span>
            <span className="font-semibold text-primary">
              h<sub>f,s</sub>
            </span>
            <span>pérdida por fricción en succión (m)</span>
          </div>
          <div className="text-[12px] text-on-surface-variant border-l-2 border-outline-variant pl-3">
            Verificación: NPSH<sub>req</sub> &lt; NPSH<sub>disp</sub> (curva del fabricante). Si no
            cumple: sumerge más la succión, sube el nivel de la cisterna o reduce codos/longitud de
            succión.
          </div>
        </div>
      ),
    },
    {
      title: 'Tanque de reserva',
      body: (
        <div className="space-y-3">
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            V = Población · Dotación · F<sub>reserva</sub>
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">V</span>
            <span>volumen del tanque (L)</span>
            <span className="font-semibold text-primary">Población</span>
            <span>número de habitantes</span>
            <span className="font-semibold text-primary">Dotación</span>
            <span>consumo diario por persona (L/hab/dia)</span>
            <span className="font-semibold text-primary">
              F<sub>reserva</sub>
            </span>
            <span>factor de reserva (usualmente 1.5–2.0)</span>
          </div>
          <Tabla
            head={['Tipo de uso', 'Dotación (L/hab/dia)']}
            rows={[
              ['Residencial', '150–200'],
              ['Hotel', '250–400'],
              ['Comercial', '80–120'],
              ['Industrial', '100–200'],
            ]}
          />
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
            <div className="bg-surface-container-low p-2 rounded">Dotación: 250 L/persona</div>
            <div className="bg-surface-container-low p-2 rounded">
              Q<sub>b</sub> = 3 &times; Q<sub>m</sub>
            </div>
            <div className="bg-surface-container-low p-2 rounded">P max: 50 psi (350 kPa)</div>
            <div className="bg-surface-container-low p-2 rounded">P min: 30 psi (207 kPa)</div>
            <div className="bg-surface-container-low p-2 rounded">Arranques max: 6/hora</div>
            <div className="bg-surface-container-low p-2 rounded">Eficiencia: 60%</div>
          </div>
          <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
            Q<sub>m</sub> = (q · N) / 1440 &nbsp;&nbsp;[L/min]
          </div>
          <div>
            <span className="text-on-surface-variant">Donde:</span>
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13px] ml-4">
            <span className="font-semibold text-primary">
              Q<sub>m</sub>
            </span>
            <span>caudal medio (L/min)</span>
            <span className="font-semibold text-primary">q</span>
            <span>consumo unitario por persona (L/persona/dia)</span>
            <span className="font-semibold text-primary">N</span>
            <span>número de personas</span>
          </div>
        </div>
      ),
    },
  ],
};

export default equipos;
