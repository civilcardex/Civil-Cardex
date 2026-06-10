import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PdfViewer from '../components/PdfViewer';
import { usePlans } from '../context/PlansContext';
import { useProject } from '../context/ProjectContext';

function ViewerInner() {
  const { plans, addPlans, removePlan } = usePlans();
  const { pisos } = useProject();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const files = plans.map(p => ({ id: p.id, file: p.file }));

  const handleAddPlan = () => {
    fileRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addPlans(e.target.files);
    e.target.value = '';
  };

  const handleRemovePlan = (idx: number) => {
    removePlan(plans[idx].id);
    if (activeIndex >= plans.length - 1) {
      setActiveIndex(Math.max(0, plans.length - 2));
    }
  };

  const handleSelectPlan = (idx: number) => {
    setActiveIndex(idx);
    setDropdownOpen(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0e14' }}>
      <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={handleFileInput} />

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
        <div style={{
          height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
          background: '#111317', borderBottom: '1px solid #3a494a', position: 'relative',
        }}>
          <span style={{ fontFamily: 'Geist, monospace', fontSize: 10, color: '#6b8cae', textTransform: 'uppercase', letterSpacing: 1 }}>
            Plano:
          </span>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', background: '#1e2024',
                border: '1px solid #3a494a', borderRadius: 3,
                color: '#e2e2e8', cursor: 'pointer',
                fontFamily: 'Geist, monospace', fontSize: 11,
              }}>
              <span style={{ color: '#00dce5' }}>📄</span>
              <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {plans[activeIndex]?.name || 'Ninguno'}
              </span>
              <span style={{ fontSize: 8, color: '#6b8cae' }}>▼</span>
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                minWidth: 240, background: '#15171b', border: '1px solid #3a494a',
                borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden', zIndex: 100,
              }}>
                {plans.length===0&&(
                  <div style={{padding:'12px 16px',color:'#6b8cae',fontFamily:'Geist, monospace',fontSize:11,textAlign:'center'}}>
                    No hay planos cargados
                  </div>
                )}
                {plans.map((p, i) => (
                  <div key={p.id}
                    onClick={() => handleSelectPlan(i)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', cursor: 'pointer',
                      background: i === activeIndex ? 'rgba(0,220,229,0.06)' : 'transparent',
                      borderLeft: i === activeIndex ? '3px solid #00dce5' : '3px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { if (i !== activeIndex) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { if (i !== activeIndex) e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#00dce5' }}>📄</span>
                      <span style={{
                        fontFamily: 'Geist, monospace', fontSize: 11, color: '#e2e2e8',
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </span>
                    </div>
                    {i === activeIndex && (
                      <span style={{ fontFamily: 'Geist, monospace', fontSize: 9, color: '#00dce5' }}>●</span>
                    )}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #3a494a', padding: '6px 12px', display: 'flex', gap: 8 }}>
                  <button onClick={handleAddPlan}
                    style={{
                      flex: 1, padding: '5px 8px', background: '#1e2024',
                      border: '1px dashed #3a494a', borderRadius: 3,
                      color: '#b9caca', cursor: 'pointer', fontSize: 10,
                      fontFamily: 'Geist, monospace', fontWeight: 600, textAlign: 'center',
                    }}>
                    + Agregar
                  </button>
                  <button onClick={() => navigate('/civilflowareatrabajo')}
                    style={{
                      padding: '5px 8px', background: '#1e2024',
                      border: '1px solid #3a494a', borderRadius: 3,
                      color: '#849495', cursor: 'pointer', fontSize: 10,
                      fontFamily: 'Geist, monospace', textAlign: 'center',
                    }}>
                    📐 Planos
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {plans.length>0&&(
            <span style={{ fontFamily: 'Geist, monospace', fontSize: 9, color: '#6b8cae' }}>
              {activeIndex + 1} / {plans.length}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 84, overflow: 'hidden', position: 'relative' }}
        onClick={() => setDropdownOpen(false)}>
        <PdfViewer
          files={files}
          activeIndex={activeIndex}
          onSelectPlan={handleSelectPlan}
          onAddPlan={handleAddPlan}
          onRemovePlan={handleRemovePlan}
          planos={plans}
          pisos={pisos}
          activeNetworks={new Set()}
        />
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return <ViewerInner />;
}
