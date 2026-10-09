import { Tabla } from './ui';
import { NORMAS_PAIS } from '../../../constants/normasPais';

/** Documentación de los perfiles normativos por país (constants/normasPais.ts).
 *  Las tablas se generan DESDE los perfiles — una sola verdad: si se ajusta un rango
 *  en normasPais.ts, este documento lo refleja sin edición manual. */
const normasPais = {
  name: 'Normativa por país',
  desc: 'Rangos de chequeo por país (selector de IDENTIFICACIÓN DEL PROYECTO). Países sin dato propio verificado heredan Colombia marcados "ref.".',
  icon: 'public',
  color: '#4D8FF7',
  sections: [
    {
      title: 'Cómo funciona',
      body: (
        <Tabla
          head={['Elemento', 'Comportamiento']}
          rows={[
            ['Selector', 'IDENTIFICACIÓN DEL PROYECTO → País (desplegable). Vacío = Colombia.'],
            [
              'Chequeo AF/AC',
              'Velocidades de la tabla de diseño e informes usan vMin/vMax del país.',
            ],
            ['Chequeo sanitaria/lluvias', 'V mín/máx, llenado y/D y fuerza tractiva del país.'],
            ['Gas', 'ΔP acumulada máxima y V máxima del país.'],
            [
              'Normas citadas',
              'Los tooltips de las tablas citan la norma local (p. ej. "RNE IS.010" en Perú).',
            ],
            [
              '"ref."',
              'País sin norma nacional verificada: hereda los criterios de Colombia y cita la fuente local como referencia.',
            ],
          ]}
        />
      ),
    },
    {
      title: 'Agua fría / caliente — velocidades y presiones',
      body: (
        <Tabla
          head={['País', 'V mín (m/s)', 'V máx (m/s)', 'P mín (m.c.a.)', 'P máx (m.c.a.)', 'Norma']}
          rows={NORMAS_PAIS.map((p) => [
            p.nombre + (p.ref ? ' (ref.)' : ''),
            p.af.vMin.toFixed(2).replace('.', ','),
            p.af.vMax.toFixed(2).replace('.', ','),
            String(p.af.pMin),
            String(p.af.pMax),
            p.norma.af,
          ])}
        />
      ),
    },
    {
      title: 'Sanitaria / aguas lluvias — gravedad',
      body: (
        <Tabla
          head={[
            'País',
            'V mín (m/s)',
            'V máx (m/s)',
            'Llenado y/D',
            'F. tractiva (kg/m²)',
            'Norma',
          ]}
          rows={NORMAS_PAIS.map((p) => [
            p.nombre + (p.ref ? ' (ref.)' : ''),
            p.san.vMin.toFixed(2).replace('.', ','),
            p.san.vMax.toFixed(2).replace('.', ','),
            String(p.san.ydMax).replace('.', ','),
            p.san.ftMin.toFixed(2).replace('.', ','),
            p.norma.san,
          ])}
        />
      ),
    },
    {
      title: 'Gas — Renouard',
      body: (
        <Tabla
          head={['País', 'ΔP acum. máx (mbar)', 'V máx (m/s)', 'Norma']}
          rows={NORMAS_PAIS.map((p) => [
            p.nombre + (p.ref ? ' (ref.)' : ''),
            String(p.gas.dpMax).replace('.', ','),
            String(p.gas.vMax),
            p.norma.gas,
          ])}
        />
      ),
    },
    {
      title: 'Fuentes de los perfiles con dato propio',
      body: (
        <Tabla
          head={['País', 'Fuente']}
          rows={[
            ['Colombia', 'NTC 1500 · RAS 2000 (Res. 1096) · NTC 3728 — valores base de la app.'],
            [
              'Perú',
              'RNE OS.050 (red: V 0,60–3,0 m/s; P 10–50 m.c.a.) · RNE IS.010 (edificaciones).',
            ],
            ['Chile', 'SISS / OGUC 4.1.5 (P mín 15 m.c.a.) · NCh 2485 (punto desfavorable).'],
            ['Ecuador', 'NEC Cap. 16 · NTE INEN 1108 (P ≈ 5 m.c.a. punto desfavorable).'],
            ['Bolivia', 'RENISDA (V mín 0,60 m/s; interiores ≤ 2,5 m/s).'],
            [
              'Argentina',
              'Reglamentos de prestadoras — ENRE Res. 1055/13 (V ≤ 2,0 m/s; P máx 40 m.c.a.).',
            ],
          ]}
        />
      ),
    },
  ],
};

export default normasPais;
