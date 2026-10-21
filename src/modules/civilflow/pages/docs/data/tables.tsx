import { Tabla } from './ui';

const tablas = {
  name: 'Tablas y verificaciones',
  desc: 'Coeficientes n de Manning, verificaciones por red y diámetros comerciales PVC.',
  icon: 'table_chart',
  color: '#C9A227',
  sections: [
    {
      title: 'Manning — coeficientes n',
      body: (
        <Tabla
          head={['Material', 'n']}
          rows={[
            ['PVC sanitario', '0.009'],
            ['PVC presión', '0.009'],
            ['Hierro fundido', '0.013'],
            ['Concreto', '0.013'],
            ['Acero galvanizado', '0.015'],
            ['Cobre', '0.013'],
            ['Gres cerámico', '0.010'],
            ['PE', '0.009'],
          ]}
        />
      ),
    },
    {
      title: 'Verificaciones sanitarias',
      body: (
        <Tabla
          head={['Parámetro', 'Condición', 'Ref.']}
          rows={[
            ['Pendiente min (2–6")', '≥ 2% (20 mm/m)', 'NTC 1500 8.4.1'],
            ['Pendiente min (8"+ )', '≥ 0.5% (5 mm/m)', 'NTC 1500 8.4.1'],
            ['Velocidad mínima', '≥ 0.45 m/s', 'RAS/NTC 1500 (ajustable por país)'],
            ['Velocidad máxima', '≤ 4.00 m/s', 'RAS/NTC 1500 (ajustable por país)'],
            ['Llenado máx (y/D)', '≤ 0.75', 'RAS/NTC 1500'],
            ['Fuerza tractiva min', '≥ 0.15 kg/m²', 'RAS 2000'],
            ['Relleno sobre tubería', '≥ 0.30 m', 'NTC 1500'],
          ]}
        />
      ),
    },
    {
      title: 'Verificaciones redes de agua',
      body: (
        <Tabla
          head={['Parámetro', 'Condición', 'Ref.']}
          rows={[
            ['Velocidad recomendada', '0.50–2.50 m/s', 'NTC 1500 (ajustable por país)'],
            ['Velocidad máxima (rec.)', '≤ 3.00 m/s', 'RAS 2000'],
            ['Presión estática máx', '≤ 50 m.c.a.', 'NTC 1500'],
            ['Presión dinámica mín', '≥ 3.00 m.c.a.', 'NTC 1500'],
          ]}
        />
      ),
    },
    {
      title: 'Verificaciones red de gas',
      body: (
        <Tabla
          head={['Parámetro', 'Condición', 'Ref.']}
          rows={[
            ['ΔP máximo', '≤ 9.81 mbar', 'NTC 3728'],
            ['Velocidad máxima', '≤ 10 m/s', 'NTC 3728'],
            ['P. min en acometida', '≥ 17 mbar', 'NTC 3728'],
            ['P. max interior', '≤ 25 mbar', 'NTC 3728'],
          ]}
        />
      ),
    },
    {
      title: 'Diámetros comerciales PVC RDE 11',
      body: (
        <div className="space-y-3">
          <p>
            El diámetro INTERIOR (DI) es el que entra en Hazen-Williams, velocidades y Renouard —
            por eso dos materiales con el mismo nominal calculan distinto. La app resuelve el DI
            desde el nominal + material al fijar el diámetro propuesto de un tramo.
          </p>
          <Tabla
            head={['Nominal', 'DI (mm)', 'DE (mm)']}
            rows={[
              ['½"', '16.6', '21.3'],
              ['¾"', '21.8', '26.7'],
              ['1"', '28.5', '33.4'],
              ['1¼"', '37.1', '42.2'],
              ['1½"', '43.6', '48.3'],
              ['2"', '56.1', '60.3'],
            ]}
          />
        </div>
      ),
    },
  ],
};

export default tablas;
