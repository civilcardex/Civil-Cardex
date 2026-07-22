import React, { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { REDES } from "../../../constants";
import EditButton from "../../shared/EditButton";

const ActiveEquiposCard_equipoBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px',
  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left',
};

const ActiveEquiposCard = React.memo(function ActiveEquiposCard({ redes, setRedes }: { redes: Set<string>; setRedes: Dispatch<SetStateAction<Set<string>>> }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="card" style={{ flex: 1, minWidth: 190, display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <h3 className="card-t" style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap' }}>
              <img src="/iconos_civilflow/info_general/equipos_activos.webp" alt="Equipos activos"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
              Equipos activos
            </h3>
            <EditButton edit={editing} setEdit={setEditing} />
          </div>
          <span className="card-s" style={{ fontSize: 11 }}>{[...redes].filter(id => id === 'ep' || id === 'bom').length} de 2</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: '4px 6px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          {['ep', 'bom'].map(id => {
            const r = REDES.find(x => x.id === id);
            if (!r) return null;
            const on = redes.has(r.id);
            return (
              <button type="button" key={r.id} disabled={!editing} onClick={() => { if (!editing) return; const n = new Set(redes); if (on) n.delete(r.id); else n.add(r.id); setRedes(n); }}
                style={{ ...ActiveEquiposCard_equipoBtn, cursor: editing ? 'pointer' : 'default', opacity: editing ? 1 : 0.5 }}>
                {r.icoImg ? <img src={r.icoImg} alt=""  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle' }}  loading="lazy" /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                <span style={{ fontWeight: 600, fontSize: 12, color: on ? '#ffffff' : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? '#ffffff' : 'transparent', border: '1.5px solid ' + (on ? '#ffffff' : 'var(--txt3)') }} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});

export default ActiveEquiposCard;
