/** Consulta normativa por país: NTC (Norma Técnica Colombiana), RAS (Reglamento de Agua y
 *  Saneamiento), NSR (Norma Sismo Resistente), NFPA13 y tablas de referencia, filtradas por el
 *  país del proyecto. Ej: proyecto en Colombia -> acordeón RAS/NTC; en Perú -> solo genéricas. */
import { useState, type ReactNode, type Key } from 'react';
import { useProject } from '../../context/ProjectContext.tsx';
import { FILTROS_NORM, CRIT0 } from '../../constants';
import { TabBtn, FilterBtn } from './shared.tsx';
import { SECCIONES } from './regulationsData.ts';
import { NTC1500 } from './sections/NTC1500';
import { RAS2000 } from './sections/RAS2000';
import { NTC3728 } from './sections/NTC3728';
import { NSR10 } from './sections/NSR10';
import { NFPA13 } from './sections/NFPA13';
import { NTC3096 } from './sections/NTC3096';
import { TablasRef } from './sections/TablesRef.tsx';
export default function Normativa() {
  const [filtro, setFiltro] = useState('todos');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [vista, setVista] = useState('referencias');

  const { crits, setCrits } = useProject();
  const [critFil, setCritFil] = useState('todos');

  const secFiltradas = SECCIONES.filter((s) => {
    if (filtro === 'todos') return true;
    return (s.redes as readonly string[]).includes(filtro);
  });

  const toggleSeccion = (id: string) => {
    setAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const tabsRow = (
    <div role="tablist" className="norm-filters">
      <TabBtn
        id="tab-referencias"
        active={vista === 'referencias'}
        onClick={() => setVista('referencias')}
      >
        Referencias normativas
      </TabBtn>
      <TabBtn
        id="tab-criterios"
        active={vista === 'criterios'}
        onClick={() => setVista('criterios')}
      >
        Criterios de diseño
      </TabBtn>
    </div>
  );

  if (vista === 'criterios') {
    const critVisibles = critFil === 'todos' ? crits : crits.filter((x) => x.red === critFil);
    return (
      <div
        className="fu norm-tab norm-col"
        data-tour="cf-tab-crit"
        role="tabpanel"
        aria-labelledby="tab-criterios"
      >
        {tabsRow}

        <section className="card shrink-0">
          <div className="norm-pad-12-16 ch">
            <h2 className="norm-fs-14 ct-t">§ Criterios de diseño — tabla editable</h2>
            <span className="norm-fs-12 ct-s">
              NTC 1500:2020 · RAS 2000 · NTC 3728 · NFPA 13:2022
            </span>
          </div>
          <div className="norm-pad-10 cb">
            <div className="norm-filters">
              {FILTROS_NORM.map((f) => (
                <FilterBtn key={f.k} active={critFil === f.k} onClick={() => setCritFil(f.k)}>
                  {f.l}
                </FilterBtn>
              ))}
              <div className="norm-spacer" />
              <button
                type="button"
                className="norm-btn-sm btn-ok"
                onClick={() =>
                  setCrits((p) => [
                    ...p,
                    {
                      id: 'c' + Date.now(),
                      red: critFil === 'todos' ? 'af' : critFil,
                      param: 'Nuevo criterio',
                      val: '0',
                      uni: '—',
                      norma: 'Norma',
                      art: '§',
                      cumple: 'Descripción',
                      nota: 'Observación',
                    },
                  ])
                }
              >
                + Agregar
              </button>
              <button
                type="button"
                className="norm-btn-sm btn-g"
                onClick={() => {
                  if (window.confirm('¿Restaurar valores por defecto?')) setCrits(CRIT0);
                }}
              >
                ↺ Restaurar
              </button>
            </div>
          </div>
        </section>

        {critVisibles.length === 0 && (
          <div className="ib info">
            <span>ℹ</span>
            <span>No hay criterios para esta red.</span>
          </div>
        )}
        <div className="norm-scroll-col">
          {critVisibles.map((cr) => (
            <section key={cr.id} className="card shrink-0">
              <div className="card-b norm-grid-4col">
                <input
                  className="norm-input-left-600 ni"
                  aria-label="Nombre del parámetro"
                  value={cr.param}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, param: v } : x)));
                  }}
                />
                <input
                  className="norm-w75 ni"
                  aria-label="Valor del parámetro"
                  value={cr.val}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, val: v } : x)));
                  }}
                />
                <input
                  className="norm-w56 ni"
                  aria-label="Unidad del parámetro"
                  value={cr.uni}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, uni: v } : x)));
                  }}
                />
                <button
                  type="button"
                  className="btn-del norm-input-pad"
                  aria-label="Eliminar criterio"
                  onClick={() => setCrits((p) => p.filter((x) => x.id !== cr.id))}
                >
                  ✕
                </button>
              </div>
              <div className="norm-grid-2col">
                <div className="norm-mb0">
                  <span className="norm-fs-11-block">Norma · Artículo</span>
                  <div className="norm-gap5">
                    <input
                      className="ni norm-flex-1-left"
                      aria-label="Norma"
                      value={cr.norma}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, norma: v } : x)));
                      }}
                    />
                    <input
                      className="norm-w75-center ni"
                      aria-label="Artículo"
                      value={cr.art}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, art: v } : x)));
                      }}
                    />
                  </div>
                </div>
                <div className="norm-mb0">
                  <span className="norm-fs-11-block">Evidencia de cumplimiento</span>
                  <input
                    className="norm-input-left-sm ni"
                    aria-label="Evidencia de cumplimiento"
                    value={cr.cumple}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, cumple: v } : x)));
                    }}
                  />
                </div>
                <div className="norm-mb0-span">
                  <span className="norm-fs-11-block">Observación técnica</span>
                  <input
                    className="norm-input-italic ni"
                    aria-label="Observación técnica"
                    value={cr.nota}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCrits((p) => p.map((x) => (x.id === cr.id ? { ...x, nota: v } : x)));
                    }}
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="norm-col-0 fu norm-tab" role="tabpanel" aria-labelledby="tab-referencias">
      {tabsRow}

      <div className="norm-filter-bar">
        {FILTROS_NORM.map((f) => (
          <FilterBtn key={f.k} active={filtro === f.k} onClick={() => setFiltro(f.k)}>
            {f.l}
          </FilterBtn>
        ))}
      </div>

      {secFiltradas.length === 0 && (
        <div className="ib info">
          <span>ℹ</span>
          <span>Seleccione una red para ver su normativa aplicable.</span>
        </div>
      )}

      {secFiltradas.map((sec) => (
        <NormaCard
          key={sec.id}
          id={sec.id}
          titulo={sec.titulo}
          subt={sec.subt}
          isOpen={!!abiertas[sec.id]}
          onToggle={toggleSeccion}
        >
          <ContenidoSeccion id={sec.id} />
        </NormaCard>
      ))}
    </div>
  );
}

function ContenidoSeccion({ id }: { id: string }) {
  switch (id) {
    case 'ntc1500':
      return <NTC1500 />;
    case 'ras2000':
      return <RAS2000 />;
    case 'ntc3728':
      return <NTC3728 />;
    case 'nsr10':
      return <NSR10 />;
    case 'nfpa13':
      return <NFPA13 />;
    case 'ntc3096':
      return <NTC3096 />;
    case 'tables':
      return <TablasRef />;
    default:
      return null;
  }
}

interface NormaCardProps {
  key?: Key;
  id: string;
  titulo: string;
  subt: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

function NormaCard({ id, titulo, subt, isOpen, onToggle, children }: NormaCardProps) {
  return (
    <div className={`card${isOpen ? ' sec-open' : ''} norm-top-border`}>
      <button
        type="button"
        className="card-h norm-clickable"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-controls={`reg-card-content-${id}`}
      >
        <div>
          <h2 className="card-t norm-fs-15">{titulo}</h2>
          <span className="td-mono norm-block-12">{subt}</span>
        </div>
        <span className="norm-fs-14">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="card-body-wrap" id={`reg-card-content-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
}
