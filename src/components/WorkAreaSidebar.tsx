import { useNavigate } from 'react-router-dom';
import { NAV_TABS } from "../constants";

interface WorkAreaSidebarProps {
  tab: string;
  setTab: (tab: string) => void;
}

function WorkAreaSidebar({ tab, setTab }: WorkAreaSidebarProps) {
  const navigate = useNavigate();
  return (
    <div className="nav">
      {NAV_TABS.map(t => (
        <div
          key={t.id}
          className={`ntab ${t.id === 'visor' ? '' : tab === t.id ? 'on' : ''}`}
          onClick={() => { if (t.id === 'visor') navigate('/visor'); else setTab(t.id) }}
          style={t.id === 'redes' ? { flex: '0 0 auto', padding: '12px 28px' } : {}}
        >
          <span className="ntab-ico">
            {t.icoImg
              ? <img src={t.icoImg} alt=""  width={24} height={24} style={{width:24,height:24, objectFit: 'contain' }}  loading="lazy" />
              : <span style={{ fontSize: 18, lineHeight: 1 }}>{t.ico}</span>}
          </span>
          {t.l}
        </div>
      ))}
    </div>
  );
}

export { WorkAreaSidebar };
