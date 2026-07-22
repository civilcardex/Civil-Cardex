import React from "react";
import { USOS } from "../../../constants";
import EditButton from "../../shared/EditButton";
import { devError } from "../../../../../utils/devError";
import { ACTIVE_PROYECTO_ID_KEY } from "../../../constants/storage-keys";
import { updateProyectoNombre } from "../../../services/proyectosService";

interface ProjectIdInfo { nombre: string; dir: string; mun: string; dep: string; uso: string }

const ProjectIdCard = React.memo(function ProjectIdCard({ proy, setP }: { proy: ProjectIdInfo; setP: (k: string, v: string) => void }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const wasEditingRef = React.useRef(isEditing);

  React.useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
      const trimmed = proy.nombre?.trim();
      if (proyectoId && trimmed) {
        updateProyectoNombre(Number(proyectoId), trimmed).catch(devError);
      }
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, proy.nombre]);

  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 200 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img src="/iconos_civilflow/info_general/identificacion_del_proyecto.webp" alt="Identificación del proyecto"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Identificación del proyecto
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>Datos para memorias de cálculo</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-nombre" style={{ fontSize: 12 }}>Nombre del proyecto</label><input id="proj-nombre" disabled={!isEditing} value={proy.nombre} onChange={e => setP('nombre', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-dir" style={{ fontSize: 12 }}>Dirección / Sector</label><input id="proj-dir" disabled={!isEditing} value={proy.dir} onChange={e => setP('dir', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-mun" style={{ fontSize: 12 }}>Municipio</label><input id="proj-mun" disabled={!isEditing} value={proy.mun} onChange={e => setP('mun', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-dep" style={{ fontSize: 12 }}>Departamento</label><input id="proj-dep" disabled={!isEditing} value={proy.dep} onChange={e => setP('dep', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 0 }}><label htmlFor="proj-uso" style={{ fontSize: 12 }}>Uso</label>
          <select id="proj-uso" disabled={!isEditing} value={proy.uso} onChange={e => setP('uso', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', width: '100%', opacity: isEditing ? 1 : 0.7 }}><option value="">—</option>{USOS.map(u => <option key={u}>{u}</option>)}</select></div>
      </div>
    </section>
  );
});

export default ProjectIdCard;
