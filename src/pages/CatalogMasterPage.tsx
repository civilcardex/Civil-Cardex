import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAS } from '../constants/engineeringDataGas';
import { SANITARIAS, RCI, AGUA_FRIA, AGUA_CALIENTE, VENTILACION } from './catalog/catalogData';
import SectionCard from './catalog/SectionCard';
import { PipeTable, GasTable, ContadoresTable, MaterialesPorRedTable, CoefFriccionTable } from './catalog/CatalogTables';
import { usePageMeta } from '../hooks/usePageMeta';
const CatalogMasterPage_S1: React.CSSProperties = { position: 'absolute', left: 0, padding: '5px 11px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--txt2)', cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, };


const pageBtn = {
  padding: '5px 12px', border: '1px solid var(--line)', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
  background: 'var(--bg3)', color: 'var(--txt2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .15s', minWidth: 30,
};

export default function CatalogMasterPage() {
  const navigate = useNavigate();
  const [subpage, setSubpage] = useState(1);
  usePageMeta('Catálogo Maestro', 'Catálogo de materiales, tuberías y equipos para diseño hidrosanitario. PVC, CPVC, cobre, acero y más según NTC 1500.');

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--txt)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <script type="application/ld+json">{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Catálogo maestro — CivilFlow",
  "description": "Catálogo de materiales, tuberías, accesorios y equipos para diseño hidrosanitario.",
  "numberOfItems": [...SANITARIAS, ...VENTILACION, ...AGUA_FRIA, ...AGUA_CALIENTE, ...RCI, ...GAS].reduce((acc, g) => acc + g.rows.length, 0)
})}</script>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <button type="button" className="td-mono" onClick={() => { sessionStorage.setItem('openTab', 'datos'); navigate('/civilflowareatrabajo'); }}
            style={CatalogMasterPage_S1}>
            ← VOLVER
          </button>
          <h1 className="td-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Catálogo Maestro
          </h1>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflow: subpage === 1 ? 'hidden' : 'auto',
          padding: '6px 0',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {subpage === 1 && (
            <>
              <CoefFriccionTable />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.45fr', gap: 12, flexShrink: 0 }}>
                <SectionCard title="Materiales por red" subtitle="Por sistema" compact>
                  <MaterialesPorRedTable />
                </SectionCard>
                <SectionCard title="Contadores" subtitle="Qn(LPS)" compact>
                  <ContadoresTable />
                </SectionCard>
              </div>
            </>
          )}

          {subpage === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="Sanitarias" subtitle="PVC-S · NTC 1500" compact>
                  <PipeTable groups={SANITARIAS} compact />
                </SectionCard>
                <SectionCard title="Ventilación" subtitle="PVC-V" compact>
                  <PipeTable groups={VENTILACION} compact />
                </SectionCard>
              </div>
              <SectionCard title="Agua fría" subtitle="PVC-Pr · NTC 1500" compact>
                <PipeTable groups={AGUA_FRIA} compact />
              </SectionCard>
              <SectionCard title="Agua caliente" subtitle="CPVC · NTC 1500" compact>
                <PipeTable groups={AGUA_CALIENTE} compact />
              </SectionCard>
            </div>
          )}

          {subpage === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Gas — Acero" subtitle="Galvanizado · Carbón" compact>
                <GasTable groups={GAS.slice(0, 2)} compact />
              </SectionCard>
              <SectionCard title="Gas — Cobre" subtitle="Rígido · Flexible" compact>
                <GasTable groups={GAS.slice(2, 4)} compact />
              </SectionCard>
              <SectionCard title="Gas — PE" subtitle="PE al PE · Polietileno" compact>
                <GasTable groups={GAS.slice(4)} compact />
              </SectionCard>
            </div>
          )}

          {subpage === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Contra incendio — SCH 10" subtitle="Acero al carbono" compact>
                <PipeTable groups={[RCI[0]]} compact />
              </SectionCard>
              <SectionCard title="Contra incendio — SCH 40" subtitle="Acero al carbono" compact>
                <PipeTable groups={[RCI[1]]} compact />
              </SectionCard>
              <SectionCard title="Contra incendio — PVC / Galv." subtitle="C900 RDE · Galvanizado" compact>
                <PipeTable groups={RCI.slice(2)} compact />
              </SectionCard>
            </div>
          )}
        </div>

        <nav aria-label="Paginación de catálogo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexShrink: 0, padding: '8px 0 12px', borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={() => setSubpage(Math.max(1, subpage - 1))}
            style={{ ...pageBtn, opacity: subpage === 1 ? 0.3 : 1, cursor: subpage === 1 ? 'default' : 'pointer' }}>
            ←
          </button>
          {[1, 2, 3, 4].map(n => (
            <button type="button" key={n} onClick={() => setSubpage(n)}
              style={{
                ...pageBtn,
                background: subpage === n ? 'rgba(0,220,229,0.15)' : 'var(--bg3)',
                border: `1px solid ${subpage === n ? 'rgba(0,220,229,0.55)' : 'var(--line)'}`,
                color: subpage === n ? '#00dce5' : 'var(--txt2)',
                fontWeight: subpage === n ? 700 : 500,
              }}>
              {n}
            </button>
          ))}
          <button type="button" onClick={() => setSubpage(Math.min(4, subpage + 1))}
            style={{ ...pageBtn, opacity: subpage === 4 ? 0.3 : 1, cursor: subpage === 4 ? 'default' : 'pointer' }}>
            →
          </button>
        </nav>
      </div>
    </div>
  );
}
