import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PdfViewer from '../components/PdfViewer';
import { usePlans } from '../context/PlansContext';
import { useProject } from '../context/ProjectContext';
import { usePageMeta } from '../hooks/usePageMeta';

export default function ViewerPage() {
  const { plans, addPlans, removePlan } = usePlans();
  const { pisos } = useProject();
  const [activeIndex, setActiveIndex] = useState(() => {
    try {
      const savedId = localStorage.getItem('civilflow_visor_activePlanId');
      const saved = localStorage.getItem('civilflow_visor_activeIndex');
      if (savedId && plans.length > 0) {
        const idx = plans.findIndex(p => String(p.id) === savedId);
        if (idx >= 0) return idx;
      }
      return saved ? Number(saved) : 0;
    } catch (_) { return 0; }
  });
  const [activeNetworks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('civilflow_active_nets');
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {}
    return new Set();
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const files = plans.map(p => ({ id: p.id, file: p.file }));
  const planIdResolvedRef = useRef(false);
  usePageMeta('Visor de planos', 'Visor de planos PDF con superposición de redes hidrosanitarias. Herramientas de dibujo, calibración y medición.');

  useEffect(() => {
    if (planIdResolvedRef.current || files.length === 0) return;
    planIdResolvedRef.current = true;
    try {
      const savedId = localStorage.getItem('civilflow_visor_activePlanId');
      if (savedId && !plans.some(p => String(p.id) === savedId && plans.indexOf(p) === activeIndex)) {
        const idx = files.findIndex(f => String(f.id) === savedId);
        if (idx >= 0) setActiveIndex(idx);
      }
    } catch (_) {}
  }, [files.length]);

  useEffect(() => {
    try {
      localStorage.setItem('civilflow_visor_activeIndex', String(activeIndex));
      const plan = plans[activeIndex];
      if (plan) localStorage.setItem('civilflow_visor_activePlanId', String(plan.id));
    } catch (_) {}
  }, [activeIndex, plans]);

  useEffect(() => {
    if (files.length > 0 && activeIndex >= files.length) {
      setActiveIndex(Math.max(0, files.length - 1));
    }
  }, [files.length, activeIndex]);

  const handleAddPlan = useCallback(() => fileRef.current?.click(), []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const prevLen = plans.length;
      const added = addPlans(e.target.files);
      if (added.length > 0) setActiveIndex(prevLen + added.length - 1);
    }
    e.target.value = '';
  };

  const handleRemovePlan = useCallback((idx: number) => {
    removePlan(plans[idx].id);
    setActiveIndex(prev => Math.max(0, prev >= plans.length - 1 ? plans.length - 2 : prev));
  }, [plans, removePlan]);

  const handleSelectPlan = useCallback((idx: number) => {
    setActiveIndex(idx);
    setDropdownOpen(false);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0e14' }}>
      <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} aria-label="Cargar planos PDF"
        onChange={handleFileInput} />

      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
        <div style={{
          height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
          background: '#111317', borderBottom: '1px solid #3a494a', position: 'relative',
        }}>
          <span style={{ fontFamily: 'Geist, monospace', fontSize: 10, color: '#8AB4D6', textTransform: 'uppercase', letterSpacing: 1 }}>
            Plano:
          </span>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(p => !p)} aria-expanded={dropdownOpen} aria-haspopup="listbox"
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
              <span style={{ fontSize: 8, color: '#8AB4D6' }}>▼</span>
            </button>
            {dropdownOpen && (
              <div role="listbox" aria-label="Seleccionar plano" style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                minWidth: 240, background: '#15171b', border: '1px solid #3a494a',
                borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden', zIndex: 100,
              }}>
                {plans.length===0&&(
                  <div style={{padding:'12px 16px',color:'#8AB4D6',fontFamily:'Geist, monospace',fontSize:11,textAlign:'center'}}>
                    No hay planos cargados
                  </div>
                )}
                {plans.map((p, i) => (
                  <div key={p.id}
                    role="option" aria-selected={i === activeIndex} tabIndex={0}
                    onClick={() => handleSelectPlan(i)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectPlan(i); } }}
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
                      color: '#9BA8AA', cursor: 'pointer', fontSize: 10,
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
            <span style={{ fontFamily: 'Geist, monospace', fontSize: 9, color: '#8AB4D6' }}>
              {activeIndex + 1} / {plans.length}
            </span>
          )}
        </div>
      </header>

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
          activeNetworks={activeNetworks}
        />
      </div>
    </div>
  );
}
