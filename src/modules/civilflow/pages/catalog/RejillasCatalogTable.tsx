import { useEffect, useState } from 'react';
import { catalogoRejillasDe } from '../../constants/rejillas/catalogo-por-pais.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import SectionCard from './SectionCard.tsx';

// Tabla del catálogo de rejillas de ventilación (NTC 3631) — página del Catálogo Maestro.
// El ORIGEN es relativo al país del proyecto (ped. usuario 2026-11-17): en Colombia
// Silplas/Grival/Laminaire son nacionales; en los demás países todo llega como importado y
// la sección Nacionales desaparece. ES la misma vista que alimenta las sugerencias del
// módulo Rejillas (useRejillasData usa el mismo resolver).

/** País del proyecto activo leído DIRECTO del storage: esta página vive FUERA del
 *  ProjectProvider (ruta pública del catálogo), useProject() lanzaría. IMPORTANTE: se usa
 *  loadFromStorage (mismo camino que usePersistedState) — la key real lleva el prefijo
 *  'civilflow_' duplicado ('civilflow_civilflow_proy'); leer 'civilflow_proy' crudo daba
 *  null y la tabla quedaba clavada en Colombia (bug del ped. 2026-11-17). */
function paisDelProyecto(): string {
  const proy = loadFromStorage<{ pais?: string; dep?: string }>('civilflow_proy', {});
  return proy?.pais ?? proy?.dep ?? '';
}

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

type RejRow = ReturnType<typeof catalogoRejillasDe>[number];

function Tabla({ rows }: { rows: RejRow[] }) {
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
            <th scope="col" key={h} style={TH}>
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

/** Página "Rejillas de ventilación" del Catálogo Maestro: nacionales + importadas SEGÚN EL
 *  PAÍS del proyecto (en no-CO la sección Nacionales queda vacía y se oculta). */
export default function RejillasCatalogTable() {
  // REACTIVO (ped. usuario 2026-11-17: «todavía muestra la tabla de nacionales para países
  // diferentes a Colombia»): la primera lectura puede servir un prerender sin localStorage
  // o un mount previo al cambio de país. Relee al enfocar la ventana y ante 'storage'
  // (otra pestaña) — cubre los caminos de vuelta al catálogo sin remontar.
  const [pais, setPais] = useState(paisDelProyecto);
  useEffect(() => {
    const relee = (): void => setPais(paisDelProyecto());
    window.addEventListener('focus', relee);
    window.addEventListener('storage', relee);
    return () => {
      window.removeEventListener('focus', relee);
      window.removeEventListener('storage', relee);
    };
  }, []);
  const catalogo = catalogoRejillasDe(pais);
  const nacionales = catalogo.filter((c) => c.origen === 'nacional');
  const importadas = catalogo.filter((c) => c.origen === 'importado');
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      {nacionales.length > 0 ? (
        <SectionCard
          title="Rejillas de ventilación — Nacionales"
          subtitle="Silplas · Grival · Laminaire · NTC 3631"
          compact
        >
          <Tabla rows={nacionales} />
        </SectionCard>
      ) : null}
      <SectionCard
        title={`Rejillas de ventilación — Importadas${nacionales.length === 0 ? ' (todo el catálogo)' : ''}`}
        subtitle="Koolair · TROX · referencia técnica, solo se sugieren si se activa la casilla"
        compact
      >
        <Tabla rows={importadas} />
      </SectionCard>
    </div>
  );
}
