import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkAreaState } from "./useWorkAreaState";
import { WorkAreaSidebar } from "./WorkAreaSidebar";
import WorkAreaContent from "./WorkAreaContent";
import { ErrorBoundary } from "./ErrorBoundary";

interface NetworkBarProps {
  redesActivas: any[];
  tab: string;
  redActiva: string;
  setTab: (v: string) => void;
  setRedActiva: (v: string) => void;
}

function NetworkBar({ redesActivas, tab, redActiva, setTab, setRedActiva }: NetworkBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--bg2)', borderTop: '1px solid var(--line)', flexShrink: 0, overflowX: 'auto' }}>
      {redesActivas.map((r: any) => {
        const active = tab === 'redes' && redActiva === r.id;
        const netColor = r.col || '#666';
        return (
          <button
            key={r.id}
            onClick={() => { setTab('redes'); setRedActiva(r.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--r)',
              border: '1px solid', flexShrink: 0, cursor: 'pointer', fontSize: 11,
              fontFamily: 'var(--body)', fontWeight: 600,
              borderColor: active ? netColor : 'var(--line)',
              color: active ? netColor : 'var(--txt3)',
              background: active ? 'rgba(0,0,0,.15)' : 'transparent',
            }}
          >
            {r.icoImg
              ? <img src={r.icoImg} alt=""  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle' }}  loading="lazy" />
              : <span style={{ fontSize: 16 }}>{r.ico}</span>}
            <span>{r.lbl}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
    </div>
  );
}

function CivilFlowInner() {
  const state = useWorkAreaState();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="app" style={{ flex: 1, minHeight: 0 }}>
        <WorkAreaSidebar
          tab={state.tab}
          setTab={state.setTab}
        />
        <div className="layout">
          <div className="content" style={{ padding: state.tab === 'planos' ? 0 : undefined }}>
            <WorkAreaContent state={state} />
          </div>
        </div>
      </div>
      <NetworkBar
        redesActivas={state.redesActivas}
        tab={state.tab}
        redActiva={state.redActiva}
        setTab={state.setTab}
        setRedActiva={state.setRedActiva}
      />
    </div>
  );
}

function MobileGate({ children }: { children: React.ReactNode }) {
  const [bypassGate, setBypassGate] = useState(false);

  if (bypassGate) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <>
      <div className="fixed inset-0 z-[99999] flex md:hidden items-center justify-center p-4" style={{ 
        background: 'radial-gradient(circle at center, #161b22 0%, #080a0f 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          maxWidth: '360px',
          width: '100%',
          background: 'rgba(20, 24, 33, 0.85)',
          border: '1px solid rgba(58, 73, 74, 0.6)',
          borderRadius: '16px',
          padding: '32px 24px',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#3B82F6',
          }}>
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">devices</span>
          </div>
          
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            color: '#e2e2e8', 
            margin: '0 0 10px', 
            fontFamily: 'Hanken Grotesk, sans-serif',
            letterSpacing: '0.5px'
          }}>
            Optimizado para Pantallas Grandes
          </h3>
          
          <p style={{ 
            fontSize: '13px', 
            color: '#b0b8b9', 
            lineHeight: '1.6', 
            margin: '0 0 24px',
            fontFamily: 'Hanken Grotesk, sans-serif'
          }}>
            CivilFlow es una herramienta de ingeniería de alta precisión. Para diseñar redes, ver planos y cálculos, recomendamos usar una tablet o computador.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button 
              onClick={() => setBypassGate(true)}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Geist, monospace',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--acc2)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'var(--acc)')}
            >
              CONTINUAR DE TODOS MODOS
            </button>
            
            <Link 
              to="/"
              style={{
                background: 'transparent',
                color: '#849495',
                border: '1px solid #3a494a',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Geist, monospace',
                textDecoration: 'none',
                transition: 'all 0.2s',
                display: 'inline-block',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#e2e2e8';
                e.currentTarget.style.borderColor = '#e2e2e8';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#849495';
                e.currentTarget.style.borderColor = '#3a494a';
              }}
            >
              VOLVER AL INICIO
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden md:block h-full">
        {children}
      </div>
    </>
  );
}

export default function CivilFlow() {
  return (
    <ErrorBoundary>
      <MobileGate>
        <CivilFlowInner />
      </MobileGate>
    </ErrorBoundary>
  );
}
