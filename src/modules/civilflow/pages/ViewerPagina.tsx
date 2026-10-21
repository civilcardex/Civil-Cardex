import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../../../components/Navegacion.tsx';
import PdfViewer from '../components/PdfViewer';
import { RainwaterProvider } from '../context/LluviasContexto.tsx';
import { PlansContext, usePlans } from '../context/PlanosContexto.tsx';
import {
  ProjectContext,
  PROY_DEFAULTS,
  useProject,
  type Proyecto,
} from '../context/ProyectoContexto.tsx';
import { usePageMeta } from '../../../hooks/usePaginaMeta.ts';
import { devError } from '../../../utils/desarrolloError.ts';
import { fetchProyectos } from '../services/proyectosServicio.ts';
import { loadProyectoData } from '../services/proyectoDatosServicio.ts';
import { clearLocalWorkspace } from '../services/workspaceReinicia.ts';
import { clearAllPDFs } from '../services/idbAlmacenamiento.ts';
import {
  getActiveProyectoId,
  saveToStorage,
  loadFromStorage,
} from '../services/almacenamientoServicio.ts';
import { prefetchAllTrazos } from '../utils/precargaTrazos.ts';
import {
  ACTIVE_NETS_KEY,
  ACTIVE_PROYECTO_ID_KEY,
  NETS_CHANGED_EVENT,
  PLANS_META_KEY,
  VISOR_ACTIVE_PLAN_ID_KEY,
  VISOR_ACTIVE_INDEX_KEY,
} from '../constants/almacenamientoClaves.ts';
import { setAyudaContext } from '../../../components/help/ayudaContexto.ts';
import type { Piso, PlanMeta } from '../lib/shared/proyectoTipos.ts';
import { EV_STORAGE } from '../utils/aparatoEventos.ts';
import { CargandoProyecto } from '../components/shared/CargandoProyecto';
import { useProyectoCargado } from '../hooks/useProyectoCargado';
import {
  ViewerPage_S1,
  ViewerPage_S2,
  ViewerPage_S3,
  ViewerPage_S4,
  ViewerPage_S5,
  ViewerPage_S6,
  VIEWER_JSONLD,
} from './visorEstilos.ts';

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Module-level store for PDF ready state (useSyncExternalStore pattern).
// Arranca en `false` para que el overlay de carga pinte en el primer render cuando ya
// hay planos cacheados; si arrancara en `true`, el primer render muestra el visor vacío
// (getSnapshot cae al check 3) y solo tras el useEffect que resetea `ready=false` aparece
// el overlay — flash "visor vacío → carga → planos".
const pdfReadyStore = {
  ready: false,
  // El overlay de carga solo corresponde a la PRIMERA carga de la sesión — los cambios de
  // piso re-renderizan en vivo (trazos prefetchados), sin tapar el visor de nuevo. El cambio
  // de proyecto también lo tapa (isDrawingLoading), con el texto que nombra el visor: "Cargando
  // planos y redes…" — el mismo que pone el fallback de la ruta y el preload de index.html.
  everReady: false,
  listeners: new Set<() => void>(),
};

export default function ViewerPage() {
  const { plans, addPlans, removePlan, restoreDone, cloudRestoreDone } = usePlans();
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

  // Prefetch global de trazos (orig. usuario): asegura caché local de TODOS los pisos antes de
  // cerrar el visor, para que la validación de cierre revise el proyecto completo.
  useEffect(() => {
    if (!plans?.length) return;
    void prefetchAllTrazos(plans);
  }, [plans]);

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
    window.addEventListener(EV_STORAGE, resync);
    window.addEventListener(NETS_CHANGED_EVENT, resync);
    return () => {
      window.removeEventListener(EV_STORAGE, resync);
      window.removeEventListener(NETS_CHANGED_EVENT, resync);
    };
  }, []);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownNavRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  // Ruteo /visor/:proyectoId? (igual que el área de trabajo): sin parámetro se redirige al
  // uuid activo (cosmético, SPA); con id distinto se cambia de proyecto con reload completo.
  const { proyectoId } = useParams<{ proyectoId?: string }>();
  const wantsCrudo = proyectoId ?? null;
  const wantsId = wantsCrudo && ES_UUID.test(wantsCrudo) ? wantsCrudo : null;
  const enlaceLegacy = wantsCrudo != null && wantsId == null;
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);
  const switchPendiente = wantsId != null && wantsId !== getActiveProyectoId();
  const [switching, setSwitching] = useState(switchPendiente);
  const switchingRef = useRef(false);
  // Un segundo switch en la misma sesión quedaba bloqueado (ref sin reset): al asentarse
  // la URL se permite de nuevo (setState idéntico no re-renderiza, no cascada).
  useEffect(() => {
    if (wantsId == null || wantsId === getActiveProyectoId()) {
      switchingRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSwitching(false);
    }
  }, [wantsId]);

  useEffect(() => {
    if (proyectoId != null) return;
    const activeId = getActiveProyectoId();
    if (!activeId) return;
    let alive = true;
    void (async () => {
      try {
        const rows = await fetchProyectos();
        if (!alive) return;
        const found = rows.find((r) => r.id === activeId);
        if (found) navigate(`/visor/${found.id}`, { replace: true });
      } catch {
        /* cosmético: sin redirect */
      }
    })();
    return () => {
      alive = false;
    };
  }, [proyectoId, navigate]);

  useEffect(() => {
    if (wantsId == null || switchingRef.current) return;
    if (wantsId === getActiveProyectoId()) return;
    switchingRef.current = true;
    void (async () => {
      await Promise.resolve();
      const idAnterior = getActiveProyectoId();
      setSwitching(true);
      try {
        projectCtx?.pauseCloudSync();
        plansCtx?.pauseCloudSync();
        const data = await loadProyectoData(wantsId);
        if (!data) throw new Error('proyecto-no-encontrado-o-sin-acceso');
        clearLocalWorkspace();
        await clearAllPDFs();
        plansCtx?.resetPlans();
        projectCtx?.resetToDefaults();
        localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, wantsId);
        if (data?.pisos) saveToStorage('civilflow_pisos', data.pisos as Piso[]);
        const proyToSave =
          data?.proy && Object.keys(data.proy).length
            ? ({ ...PROY_DEFAULTS, ...(data.proy as Partial<Proyecto>) } as Proyecto)
            : PROY_DEFAULTS;
        saveToStorage('civilflow_proy', proyToSave);
        if (data?.mats && Object.keys(data.mats).length) saveToStorage('civilflow_mats', data.mats);
        if (data?.profs && data.profs.length) saveToStorage('civilflow_profs', data.profs);
        if (data?.crits && data.crits.length) saveToStorage('civilflow_crits', data.crits);
        if (data?.redesActivas && data.redesActivas.length)
          saveToStorage(ACTIVE_NETS_KEY, data.redesActivas);
        if (data?.plans_meta) saveToStorage(PLANS_META_KEY, data.plans_meta as PlanMeta[]);
        window.location.replace(`/visor/${wantsId}`);
      } catch (e) {
        devError('abrir proyecto desde URL (visor):', e);
        if (idAnterior) localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, idAnterior);
        window.location.replace(idAnterior ? '/visor' : '/perfil');
        return;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsId]);

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

  // Identidad estable: un array nuevo en cada render ANULABA el memo(PdfViewer) (1428 L:
  // canvas + 2 barras + panel de aparatos + menú contextual) -> se re-renderizaba entero
  // en cada dropdown, toggle o cambio de plan.
  const files = useMemo(() => plans.map((p) => ({ id: p.id, file: p.file })), [plans]);
  const planIdResolvedRef = useRef(false);
  usePageMeta(
    'Visor de planos',
    'Visor de planos PDF con superposición de redes hidrosanitarias. Herramientas de dibujo, calibración y medición.',
  );
  // Ayuda contextual (orig. usuario): el visor es la pestaña "Dibujo de redes" como ruta propia.
  useEffect(() => {
    setAyudaContext({
      key: 'cf:visor',
      modulo: 'Civil Flow',
      seccion: 'Dibujo de redes',
      intro:
        'Dibujo de redes sobre el plano: trazar ramales, ubicar bajantes, aparatos y accesorios.',
    });
    return () => setAyudaContext(null);
  }, []);

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

  // Datos globales: gate compartido con el workarea (planos+trazos+sync+tramos).
  const { listo } = useProyectoCargado();
  const hasFilesReady = files.length > 0 && files.every((f) => !!f.file);

  // --- Loading overlay via useSyncExternalStore (avoids refs-in-render + setState-in-effect) ---
  const pdfPendiente = useSyncExternalStore(
    (cb) => {
      pdfReadyStore.listeners.add(cb);
      return () => pdfReadyStore.listeners.delete(cb);
    },
    () => {
      const ready = pdfReadyStore.ready;
      // Sin planos todavía: overlay hasta que la restauración (local + nube) confirme vacío real.
      if (plans.length === 0) {
        return !(restoreDone && cloudRestoreDone);
      }
      // Con planos pero archivos aún no listos → carga.
      if (!hasFilesReady) return true;
      // Primera sesión sin render aún → carga. Cambios de piso posteriores: render en vivo
      // SIN overlay (everReady) — el spinner no vuelve a tapar el visor.
      if (!ready && !pdfReadyStore.everReady) return true;
      // Planos listos y PDF renderizado → visor.
      return false;
    },
  );
  // El overlay cubre también el cambio de proyecto (antes había una pantalla aparte al
  // principio y el overlay después: dos pantallas de carga seguidas al abrir el visor).
  // Con el overlay siempre encima no existe el hueco entre "dejó de cargar" y "hay contenido":
  // debajo ya está el visor del proyecto nuevo, listo para verse.
  // + visorLoading: el PRIMER paint del visor (lamina a escala del doc + trazos + camara).
  // Sin el, el overlay moria antes y se veian los elementos cargar (pdf, redes).
  const [visorLoading, setVisorLoading] = useState(true);
  // Piso minimo de la pantalla de carga: que nunca parpadee en proyectos que cargan rapido
  // (orig. usuario: mejor un instante mas de carga que ver el acomodarse).
  const [minHoldCarga, setMinHoldCarga] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setMinHoldCarga(false), 900);
    return () => window.clearTimeout(t);
  }, []);
  const isDrawingLoading =
    !listo || pdfPendiente || switchPendiente || switching || visorLoading || minHoldCarga;
  const handlePdfReady = useCallback(() => {
    if (!pdfReadyStore.ready || !pdfReadyStore.everReady) {
      pdfReadyStore.ready = true;
      pdfReadyStore.everReady = true;
      pdfReadyStore.listeners.forEach((l) => l());
    }
  }, []);
  // Al cambiar de plano/archivo se vuelve a mostrar hasta el siguiente onReady.
  useEffect(() => {
    if (plans.length > 0 && hasFilesReady) {
      pdfReadyStore.ready = false;
      pdfReadyStore.listeners.forEach((l) => l());
    }
  }, [activeIndex, plans.length, hasFilesReady]);
  // Cambio de proyecto (misma sesión, login distinto o deep-link): everReady es de SESIÓN
  // y taparía el overlay de la carga real del proyecto nuevo — se resetea con el id activo.
  const proyectoActivo = wantsId ?? getActiveProyectoId();
  const proyectoPrevio = useRef(proyectoActivo);
  useEffect(() => {
    if (proyectoPrevio.current !== proyectoActivo) {
      proyectoPrevio.current = proyectoActivo;
      pdfReadyStore.everReady = false;
      pdfReadyStore.ready = false;
      pdfReadyStore.listeners.forEach((l) => l());
    }
  }, [proyectoActivo]);
  // Fallback: si onReady nunca llega, no bloquear para siempre.
  useEffect(() => {
    if (plans.length > 0 && hasFilesReady) {
      const t = setTimeout(() => {
        pdfReadyStore.ready = true;
        pdfReadyStore.listeners.forEach((l) => l());
      }, 10000);
      return () => clearTimeout(t);
    }
  }, [plans.length, hasFilesReady]);

  // Enlace con id no-uuid (numérico legacy): banner + link al perfil, SIN montar visor.
  if (enlaceLegacy) {
    return (
      <main
        className="h-full"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          height: '100%',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          role="alert"
          style={{
            padding: '10px 16px',
            background: 'rgba(180, 83, 9, 0.15)',
            border: '1px solid rgba(217, 119, 6, 0.4)',
            borderRadius: 6,
            color: '#fbbf24',
            fontSize: 13,
          }}
        >
          Este enlace corresponde a una versión antigua del proyecto — ábrelo desde tu lista de
          proyectos.
        </div>
        <Link to="/perfil" style={{ color: 'var(--acc, #4d8ff7)', fontSize: 13, fontWeight: 600 }}>
          Ir a mis proyectos
        </Link>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0e14' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0a0e14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          zIndex: 9999,
          pointerEvents: isDrawingLoading ? 'auto' : 'none',
          opacity: isDrawingLoading ? 1 : 0,
          visibility: isDrawingLoading ? 'visible' : 'hidden',
          transition: 'opacity 0.15s ease',
        }}
      >
        <CargandoProyecto texto="Cargando planos y redes…" />
      </div>
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
                    onClick={() => {
                      const pid = getActiveProyectoId();
                      navigate(pid ? `/civilflowareatrabajo/${pid}` : '/civilflowareatrabajo');
                    }}
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
        <RainwaterProvider>
          <PdfViewer
            files={files}
            activeIndex={activeIndex}
            onSelectPlan={handleSelectPlan}
            onAddPlan={handleAddPlan}
            onRemovePlan={handleRemovePlan}
            planos={plans}
            pisos={pisos}
            activeNetworks={activeNetworks}
            onReady={handlePdfReady}
            onLoadingChange={setVisorLoading}
          />
        </RainwaterProvider>
      </main>
    </div>
  );
}
