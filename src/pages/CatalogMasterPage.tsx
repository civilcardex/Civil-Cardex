import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAS } from '../constants';
import { SANITARIAS, RCI, AGUA_FRIA, AGUA_CALIENTE } from './catalog/catalogData';
import SectionCard from './catalog/SectionCard';
import { PipeTable, GasTable, ContadoresTable, MaterialesPorRedTable, CoefFriccionTable } from './catalog/CatalogTables';

function filterGroups(groups: any[], search: string) {
  if (!search) return groups;
  const q = search.toLowerCase();
  return groups
    .map((g: any) => ({
      ...g,
      rows: g.rows.filter((r: any) => r.dn.toLowerCase().includes(q)),
    }))
    .filter((g: any) => g.mat.toLowerCase().includes(q) || g.rows.length > 0);
}

const pageBtn = {
  padding: '5px 12px', border: '1px solid var(--line)', borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer',
  background: 'var(--bg3)', color: 'var(--txt2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .15s', minWidth: 30,
};

export default function CatalogMasterPage() {
  const navigate = useNavigate();
  const [subpage, setSubpage] = useState(1);
  const [search, setSearch] = useState('');

  const sanFiltered = useMemo(() => filterGroups(SANITARIAS, search), [search]);
  const afFiltered = useMemo(() => filterGroups(AGUA_FRIA, search), [search]);
  const acFiltered = useMemo(() => filterGroups(AGUA_CALIENTE, search), [search]);
  const gasAcero = useMemo(() => filterGroups(GAS.slice(0, 2), search), [search]);
  const gasCobre = useMemo(() => filterGroups(GAS.slice(2, 4), search), [search]);
  const gasPe = useMemo(() => filterGroups(GAS.slice(4), search), [search]);
  const rciSch10 = useMemo(() => filterGroups([RCI[0]], search), [search]);
  const rciSch40 = useMemo(() => filterGroups([RCI[1]], search), [search]);
  const rciPvcGalv = useMemo(() => filterGroups(RCI.slice(2), search), [search]);

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--txt)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <button className="td-mono" onClick={() => { sessionStorage.setItem('openTab', 'datos'); navigate('/civilflowareatrabajo'); }}
            style={{
              position: 'absolute', left: 0,
              padding: '5px 11px', background: 'var(--bg3)', border: '1px solid var(--line)',
              borderRadius: 3, color: 'var(--txt2)', cursor: 'pointer',
              fontWeight: 600, fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
            ← VOLVER
          </button>
          <h1 className="td-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Catálogo Maestro
          </h1>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar material o diámetro..."
          style={{
            width: '100%', padding: '8px 12px', marginBottom: 8, flexShrink: 0,
            border: '1px solid var(--line)', borderRadius: 4,
            background: 'var(--bg3)', color: 'var(--txt)',
            fontFamily: 'var(--mono)', fontSize: 12, boxSizing: 'border-box',
          }} />

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
              <SectionCard title="Sanitarias" subtitle="PVC-S · NTC 1500" compact>
                <PipeTable groups={sanFiltered} compact />
              </SectionCard>
              <SectionCard title="Agua fría" subtitle="PVC-Pr · NTC 1500" compact>
                <PipeTable groups={afFiltered} compact />
              </SectionCard>
              <SectionCard title="Agua caliente" subtitle="CPVC · NTC 1500" compact>
                <PipeTable groups={acFiltered} compact />
              </SectionCard>
            </div>
          )}

          {subpage === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Gas — Acero" subtitle="Galvanizado · Carbón" compact>
                <GasTable groups={gasAcero} compact />
              </SectionCard>
              <SectionCard title="Gas — Cobre" subtitle="Rígido · Flexible" compact>
                <GasTable groups={gasCobre} compact />
              </SectionCard>
              <SectionCard title="Gas — PE" subtitle="PE al PE · Polietileno" compact>
                <GasTable groups={gasPe} compact />
              </SectionCard>
            </div>
          )}

          {subpage === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start' }}>
              <SectionCard title="Contra incendio — SCH 10" subtitle="Acero al carbono" compact>
                <PipeTable groups={rciSch10} compact />
              </SectionCard>
              <SectionCard title="Contra incendio — SCH 40" subtitle="Acero al carbono" compact>
                <PipeTable groups={rciSch40} compact />
              </SectionCard>
              <SectionCard title="Contra incendio — PVC / Galv." subtitle="C900 RDE · Galvanizado" compact>
                <PipeTable groups={rciPvcGalv} compact />
              </SectionCard>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexShrink: 0, padding: '8px 0 12px', borderTop: '1px solid var(--line)' }}>
          <button onClick={() => setSubpage(Math.max(1, subpage - 1))}
            style={{ ...pageBtn, opacity: subpage === 1 ? 0.3 : 1, cursor: subpage === 1 ? 'default' : 'pointer' }}>
            ←
          </button>
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setSubpage(n)}
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
          <button onClick={() => setSubpage(Math.min(4, subpage + 1))}
            style={{ ...pageBtn, opacity: subpage === 4 ? 0.3 : 1, cursor: subpage === 4 ? 'default' : 'pointer' }}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}
