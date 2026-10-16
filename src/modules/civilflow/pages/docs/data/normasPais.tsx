import { Tabla } from './ui';
import { NORMAS_PAIS } from '../../../constants/normasPais';

/** Documentación de los perfiles normativos por país (constants/normasPais.ts).
 *  Las tablas se generan DESDE los perfiles — una sola verdad: si se ajusta un rango
 *  en normasPais.ts, este documento lo refleja sin edición manual.
 *  Esta página es la referencia pública: sin marcas de estado interno (la verificación
 *  vive en la tabla de fuentes de más abajo). */
const normasPais = {
  name: 'Normativa por país',
  desc: 'Rangos de chequeo por país (selector de IDENTIFICACIÓN DEL PROYECTO). Cada país usa sus propios valores y su norma citada; el detalle de cada valor está en la tabla de fuentes.',
  icon: 'public',
  color: '#4D8FF7',
  sections: [
    {
      title: 'Cómo funciona',
      body: (
        <Tabla
          head={['Elemento', 'Comportamiento']}
          rows={[
            ['Selector', 'IDENTIFICACIÓN DEL PROYECTO → País (lista única). Vacío = Colombia.'],
            [
              'Chequeo AF/AC',
              'Velocidades de la tabla de diseño e informes usan vMin/vMax del país.',
            ],
            ['Chequeo sanitaria/lluvias', 'V mín/máx, llenado y/D y fuerza tractiva del país.'],
            ['Gas', 'ΔP acumulada máxima y V máxima del país.'],
            [
              'P mín red / aparato',
              'P mínima de red pública en entrega vs en el aparato más desfavorable (conceptos distintos: Perú 10 vs 2 m.c.a.).',
            ],
            [
              'Normas citadas',
              'Los tooltips de las tablas citan la norma local (p. ej. "RNE IS.010" en Perú).',
            ],
            [
              'Fuentes',
              'Cada valor tiene su origen declarado (artículo nacional o criterio de verificación de la app) en la última tabla.',
            ],
          ]}
        />
      ),
    },
    {
      title: 'Agua fría / caliente — velocidades y presiones',
      body: (
        <Tabla
          head={[
            'País',
            'V mín (m/s)',
            'V máx (m/s)',
            'P mín red (m.c.a.)',
            'P mín aparato (m.c.a.)',
            'P máx (m.c.a.)',
            'Norma',
          ]}
          rows={NORMAS_PAIS.map((p) => [
            p.nombre,
            p.af.vMin.toFixed(2).replace('.', ','),
            p.af.vMax.toFixed(2).replace('.', ','),
            String(p.af.pMinRed),
            String(p.af.pMinAparato),
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
            p.nombre,
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
            p.nombre,
            String(p.gas.dpMax).replace('.', ','),
            String(p.gas.vMax),
            p.norma.gas,
          ])}
        />
      ),
    },
    {
      title: 'Fuentes de los perfiles (artículo + URL + fecha)',
      body: (
        <Tabla
          head={['País', 'AF/AC', 'Sanitaria', 'Lluvias', 'Gas', 'RCI']}
          rows={NORMAS_PAIS.map((p) => [
            p.nombre,
            p.fuente.af,
            p.fuente.san,
            p.fuente.ll,
            p.fuente.gas,
            p.fuente.rci,
          ])}
        />
      ),
    },
  ],
};

export default normasPais;
