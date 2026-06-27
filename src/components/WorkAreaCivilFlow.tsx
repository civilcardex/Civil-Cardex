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

export default function CivilFlow() {
  return <ErrorBoundary><CivilFlowInner /></ErrorBoundary>;
}
