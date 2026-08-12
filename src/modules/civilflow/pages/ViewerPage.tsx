import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../components/Navbar';
import PdfViewer from '../components/PdfViewer';
import { usePlans } from '../context/PlansContext';
import { useProject } from '../context/ProjectContext';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { loadFromStorage } from '../services/storageService';
import {
  ACTIVE_NETS_KEY,
  NETS_CHANGED_EVENT,
  VISOR_ACTIVE_PLAN_ID_KEY,
  VISOR_ACTIVE_INDEX_KEY,
} from '../constants/storage-keys';
const ViewerPage_S1: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const ViewerPage_S2: React.CSSProperties = {
  height: 36,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 16px',
  background: '#111317',
  borderBottom: '1px solid #3a494a',
  position: 'relative',
};
const ViewerPage_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  cursor: 'pointer',
  fontFamily: 'Geist, monospace',
  fontSize: 12,
};
const ViewerPage_S4: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 240,
  background: '#15171b',
  border: '1px solid #3a494a',
  borderRadius: 6,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  zIndex: 100,
};
const ViewerPage_S5: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px dashed #3a494a',
  borderRadius: 3,
  color: '#b9caca',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  fontWeight: 600,
  textAlign: 'center',
};
const ViewerPage_S6: React.CSSProperties = {
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#9BA8AA',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Geist, monospace',
  textAlign: 'center',
};

const VIEWER_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Visor de planos — CivilCardex',
  description:
    'Visor de planos PDF con superposición de redes hidrosanitarias. Herramientas de dibujo, calibración y medición.',
  url: 'https://civilcardex.com/visor',
  applicationCategory: 'ViewerApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requiere JavaScript y WebGL',
};

export default function ViewerPage() {
  const { plans, addPlans, removePlan } = usePlans();
  const { pisos } = useProject();
  const [rawActiveIndex, setActiveIndex] = useState(() => {
    try {
      const savedId = localStorage.getItem(VISOR_ACTIVE_PLAN_ID_KEY);
      const saved = localStorage.getItem(VISOR_ACTIVE_INDEX_KEY);
      if (savedId && plans.length > 0) {
        const idx = plans.findIndex((p) => String(p.id) === savedId);
        if (idx >= 0) return idx;
      }
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [activeNetworks, setActiveNetworks] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(ACTIVE_NETS_KEY, null);
      if (saved && saved.length > 0) return new Set(saved);
    } catch {
      // ignorar
    }
    // Mismo default que useWorkAreaState — sin esto, una caché limpia dejaba el visor sin
    // redes activas (el Set vacío no disparaba el cambio de red en PdfViewer) y el AC asignado
    // en la información general no persistía al abrir el visor.
    return new Set(['san', 'vent', 'll']);
  });

  // Las redes activas se asignan en el área de trabajo (InfoTab) y se persisten en
  // localStorage + Supabase; el visor debe re-leerlas cuando cambian, no quedarse con el
  // snapshot del mount — si el usuario activa AC justo antes de entrar al visor (o desde otra
  // pestaña) el visor ya no la pierde.
  useEffect(() => {
    const resync = () => {
      try {
        const saved = loadFromStorage<string[] | null>(ACTIVE_NETS_KEY, null);
        if (saved && saved.length > 0) setActiveNetworks(new Set(saved));
      } catch {
        // ignorar
      }
    };
    window.addEventListener('storage', resync);
    window.addEventListener(NETS_CHANGED_EVENT, resync);
    return () => {
      window.removeEventListener('storage', resync);
      window.removeEventListener(NETS_CHANGED_EVENT, resync);
    };
  }, []);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownNavRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (dropdownNavRef.current && !dropdownNavRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [dropdownOpen]);

  const files = plans.map((p) => ({ id: p.id, file: p.file }));
  const planIdResolvedRef = useRef(false);
  usePageMeta(
    'Visor de planos',
    'Visor de planos PDF con superposición de redes hidrosanitarias. Herramientas de dibujo, calibración y medición.',
  );

  // activeIndex recortado para un render seguro
  const activeIndex = plans.length > 0 ? Math.min(rawActiveIndex, plans.length - 1) : 0;

  // Resuelve el plan guardado por ID una sola vez cuando los planos están disponibles, y verifica límites
  useEffect(() => {
    if (plans.length === 0) return;
    if (rawActiveIndex >= plans.length) {
      // El render ya usa el `activeIndex` recortado de arriba — aquí solo se corrige el
      // rawActiveIndex persistido para que no siga re-derivándose en cada render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIndex(plans.length - 1);
    } else if (!planIdResolvedRef.current) {
      planIdResolvedRef.current = true;
      try {
        const savedId = localStorage.getItem(VISOR_ACTIVE_PLAN_ID_KEY);
        if (savedId) {
          const idx = plans.findIndex((p) => String(p.id) === savedId);
          if (idx >= 0 && idx !== rawActiveIndex) {
            setActiveIndex(idx);
          }
        }
      } catch {
        // ignorar
      }
    }
  }, [plans, rawActiveIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(VISOR_ACTIVE_INDEX_KEY, String(activeIndex));
      const plan = plans[activeIndex];
      if (plan) localStorage.setItem(VISOR_ACTIVE_PLAN_ID_KEY, String(plan.id));
    } catch {
      // ignorar
    }
  }, [activeIndex, plans]);

  const handleAddPlan = useCallback(() => fileRef.current?.click(), []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const prevLen = plans.length;
      const added = addPlans(e.target.files);
      if (added.length > 0) setActiveIndex(prevLen + added.length - 1);
    }
    e.target.value = '';
  };

  const handleRemovePlan = useCallback(
    (idx: number) => {
      removePlan(plans[idx].id);
      setActiveIndex((prev) => Math.max(0, prev >= plans.length - 1 ? plans.length - 2 : prev));
    },
    [plans, removePlan],
  );

  const handleSelectPlan = useCallback((idx: number) => {
    setActiveIndex(idx);
    setDropdownOpen(false);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0e14' }}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
        aria-label="Cargar planos PDF"
        onChange={handleFileInput}
      />

      <script type="application/ld+json">{JSON.stringify(VIEWER_JSONLD)}</script>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
        <h1 style={ViewerPage_S1}>Visor de planos</h1>
        <div style={ViewerPage_S2}>
          <span
            style={{
              fontFamily: 'Geist, monospace',
              fontSize: 12,
              color: '#8AB4D6',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Plano:
          </span>
          <nav
            ref={dropdownNavRef}
            aria-label="Selector de planos"
            style={{ position: 'relative' }}
          >
            <button
              type="button"
              onClick={() => setDropdownOpen((p) => !p)}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
              style={ViewerPage_S3}
            >
              <span style={{ color: '#00dce5' }}>📄</span>
              <span
                style={{
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {plans[activeIndex]?.name || 'Ninguno'}
              </span>
              <span style={{ fontSize: 12, color: '#8AB4D6' }}>▼</span>
            </button>
            {dropdownOpen && (
              <div role="listbox" aria-label="Seleccionar plano" style={ViewerPage_S4}>
                {plans.length === 0 && (
                  <div
                    style={{
                      padding: '12px 16px',
                      color: '#8AB4D6',
                      fontFamily: 'Geist, monospace',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    No hay planos cargados
                  </div>
                )}
                {plans.map((p, i) => (
                  <div
                    key={p.id}
                    role="option"
                    aria-selected={i === activeIndex}
                    tabIndex={0}
                    onClick={() => handleSelectPlan(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPlan(i);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: i === activeIndex ? 'rgba(0,220,229,0.06)' : 'transparent',
                      borderLeft: i === activeIndex ? '3px solid #00dce5' : '3px solid transparent',
                      transition: 'background-color 0.12s, border-color 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (i !== activeIndex)
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (i !== activeIndex) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#00dce5' }}>📄</span>
                      <span
                        style={{
                          fontFamily: 'Geist, monospace',
                          fontSize: 12,
                          color: '#e2e2e8',
                          maxWidth: 180,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                    {i === activeIndex && (
                      <span
                        style={{ fontFamily: 'Geist, monospace', fontSize: 12, color: '#00dce5' }}
                      >
                        ●
                      </span>
                    )}
                  </div>
                ))}
                <div
                  style={{
                    borderTop: '1px solid #3a494a',
                    padding: '6px 12px',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <button type="button" onClick={handleAddPlan} style={ViewerPage_S5}>
                    + Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/civilflowareatrabajo')}
                    style={ViewerPage_S6}
                  >
                    📐 Planos
                  </button>
                </div>
              </div>
            )}
          </nav>
          <div style={{ flex: 1 }} />
          {plans.length > 0 && (
            <span style={{ fontFamily: 'Geist, monospace', fontSize: 12, color: '#8AB4D6' }}>
              {activeIndex + 1} / {plans.length}
            </span>
          )}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 84,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
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
      </main>
    </div>
  );
}
