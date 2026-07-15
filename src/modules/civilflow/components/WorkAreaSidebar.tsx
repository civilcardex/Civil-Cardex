import { useNavigate } from 'react-router-dom';
import { NAV_TABS } from "../constants";

interface WorkAreaSidebarProps {
  tab: string;
  setTab: (tab: string) => void;
}

function WorkAreaSidebar({ tab, setTab }: WorkAreaSidebarProps) {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <ul style={{ display: 'contents', listStyle: 'none', margin: 0, padding: 0 }}>
        {NAV_TABS.map(t => (
          <li key={t.id} style={{ display: 'contents' }}>
            <button
              type="button"
              className={`ntab ${t.id === 'visor' ? '' : tab === t.id ? 'on' : ''}`}
              onClick={() => { if (t.id === 'visor') navigate('/visor'); else setTab(t.id); }}
              onMouseEnter={() => {
                if (t.id === 'datos') import('./DesignParameters');
                else if (t.id === 'crit') import('./Regulations/Regulations');
                else if (t.id === 'iso') import('./workarea/IsometriaTab');
              }}
              style={t.id === 'redes' ? { flex: '0 0 auto', padding: '12px 28px' } : {}}
            >
              <span className="ntab-ico">
                {t.icoImg
                  ? <img src={t.icoImg} alt=""  width={24} height={24} style={{width:24,height:24, objectFit: 'contain' }}  loading="lazy" />
                  : <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{t.ico}</span>}
              </span>
              {t.l}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { WorkAreaSidebar };