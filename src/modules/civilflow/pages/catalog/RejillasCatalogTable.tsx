import { CATALOGO_BASE } from '../../constants/rejillasNTC3631';
import SectionCard from './SectionCard';

// Tabla del catálogo de rejillas de ventilación (NTC 3631) — página del Catálogo Maestro.
// Muestra las referencias base con área efectiva declarada por el fabricante; ES la misma
// constante que alimenta las sugerencias de la tabla Tipologías del módulo Rejillas.

const TD: React.CSSProperties = {
  border: '1px solid var(--line)',
  padding: '3px 8px',
  fontSize: 13,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  color: 'var(--txt)',
};
const TH: React.CSSProperties = {
  ...TD,
  background: 'var(--bg3)',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--txt2)',
};

function Tabla({ rows }: { rows: typeof CATALOGO_BASE }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          {[
            'Marca',
            'Referencia',
            'Tipo',
            'Medida comercial',
            'Abertura (cm)',
            'Á. efectiva cm²',
            '% efectivo',
            'Uso',
            'Origen',
          ].map((h) => (
            <th key={h} style={TH}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={`${c.marca}_${c.ref}_${i}`}>
            <td style={TD}>{c.marca}</td>
            <td style={TD}>{c.ref}</td>
            <td style={TD}>{c.tipo}</td>
            <td style={TD}>{c.ext}</td>
            <td style={TD}>
              {c.w} × {c.h}
            </td>
            <td style={TD}>{c.aef > 0 ? c.aef : '—'}</td>
            <td style={TD}>{c.aef > 0 ? `${Math.round((c.aef / (c.w * c.h)) * 100)} %` : '—'}</td>
            <td style={TD}>
              {c.uso === 'ambos' ? 'Ambos' : c.uso === 'ext' ? 'Exterior' : 'Interior'}
            </td>
            <td style={TD}>{c.origen === 'nacional' ? 'Nacional' : 'Importado'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Página "Rejillas de ventilación" del Catálogo Maestro: nacionales + importadas. */
export default function RejillasCatalogTable() {
  const nacionales = CATALOGO_BASE.filter((c) => c.origen === 'nacional');
  const importadas = CATALOGO_BASE.filter((c) => c.origen === 'importado');
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <SectionCard
        title="Rejillas de ventilación — Nacionales"
        subtitle="Silplas · Grival · Laminaire · NTC 3631"
        compact
      >
        <Tabla rows={nacionales} />
      </SectionCard>
      <SectionCard
        title="Rejillas de ventilación — Importadas"
        subtitle="Koolair · TROX · referencia técnica, solo se sugieren si se activa la casilla"
        compact
      >
        <Tabla rows={importadas} />
      </SectionCard>
    </div>
  );
}
