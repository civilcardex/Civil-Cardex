/** Tarjeta de identificación del proyecto (pestaña Info): nombre, uso, municipio y
 *  departamento — datos que van a la memoria de cálculo y al PDF. */
import React from 'react';
import { USOS } from '../../../constants';
import { NORMAS_PAIS } from '../../../constants/countryStandards';
import EditButton from '../../shared/EditButton.tsx';
import { devError } from '../../../../../utils/devError.ts';
import { getActiveProyectoId } from '../../../services/storageService.ts';
import { updateProyectoNombre } from '../../../services/projectsService.ts';

interface ProjectIdInfo {
  nombre: string;
  dir: string;
  ciudad: string;
  pais: string;
  tipoGas?: 'gn' | 'glp';
  uso: string;
}

const ProjectIdCard = React.memo(function ProjectIdCard({
  proy,
  setP,
}: {
  proy: ProjectIdInfo;
  setP: (k: string, v: string) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  /* Si el rename falla, el valor escrito se conserva (sigue en el borrador local) y se avisa:
     el usuario puede volver a intentarlo sin perder lo que tecleó. */
  const [errorNombre, setErrorNombre] = React.useState('');
  const wasEditingRef = React.useRef(isEditing);
  const countryRef = React.useRef<HTMLSelectElement>(null);
  const usageRef = React.useRef<HTMLSelectElement>(null);
  const pais = NORMAS_PAIS.some((p) => p.nombre === proy.pais) ? proy.pais : '';
  const uso = USOS.includes(proy.uso) ? proy.uso : '';

  const setEdit: React.Dispatch<React.SetStateAction<boolean>> = (next) => {
    const editing = typeof next === 'function' ? next(isEditing) : next;
    if (!editing && (!pais || !uso)) {
      (!pais ? countryRef : usageRef).current?.focus();
      return;
    }
    setIsEditing(editing);
  };

  React.useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      const proyectoId = getActiveProyectoId();
      const trimmed = proy.nombre?.trim();
      if (proyectoId && trimmed) {
        updateProyectoNombre(proyectoId, trimmed)
          .then(() => setErrorNombre(''))
          .catch((e: unknown) => {
            devError('No se pudo renombrar el proyecto:', e);
            setErrorNombre(
              'No se pudo guardar el nombre. Tu texto se conserva; inténtalo de nuevo.',
            );
          });
      }
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, proy.nombre]);

  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 200 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img
              src="/iconos_civilflow/info_general/identificacion_del_proyecto.webp"
              alt="Identificación del proyecto"
              width={22}
              height={22}
              style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }}
              loading="lazy"
            />
            Identificación del proyecto
            <EditButton edit={isEditing} setEdit={setEdit} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            Datos para memorias de cálculo
          </span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div className="f" style={{ marginBottom: 3 }}>
          <label htmlFor="proj-nombre" style={{ fontSize: 12 }}>
            Nombre del proyecto
          </label>
          <input
            id="proj-nombre"
            disabled={!isEditing}
            value={proy.nombre}
            onChange={(e) => {
              setErrorNombre('');
              setP('nombre', e.target.value);
            }}
            aria-invalid={Boolean(errorNombre)}
            aria-describedby={errorNombre ? 'proj-nombre-error' : undefined}
            style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }}
          />
          {errorNombre && (
            <p id="proj-nombre-error" role="alert" className="cf-project-field-error">
              {errorNombre}
            </p>
          )}
        </div>
        <div className="f" style={{ marginBottom: 3 }}>
          <label htmlFor="proj-dir" style={{ fontSize: 12 }}>
            Dirección
          </label>
          <input
            id="proj-dir"
            disabled={!isEditing}
            value={proy.dir}
            onChange={(e) => setP('dir', e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }}
          />
        </div>
        <div className="f" style={{ marginBottom: 3 }}>
          <label htmlFor="proj-ciudad" style={{ fontSize: 12 }}>
            Ciudad
          </label>
          <input
            id="proj-ciudad"
            disabled={!isEditing}
            value={proy.ciudad}
            onChange={(e) => setP('ciudad', e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }}
          />
        </div>
        <div className="f" style={{ marginBottom: 3 }}>
          <label htmlFor="proj-pais" style={{ fontSize: 12 }}>
            País
          </label>
          <select
            id="proj-pais"
            ref={countryRef}
            required
            disabled={!isEditing}
            value={pais}
            aria-invalid={!pais}
            aria-describedby={pais ? undefined : 'proj-pais-error'}
            onChange={(e) => setP('pais', e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }}
          >
            <option value="" disabled>
              —
            </option>
            {NORMAS_PAIS.map((p) => (
              <option key={p.id} value={p.nombre}>
                {p.nombre}
              </option>
            ))}
          </select>
          {!pais && (
            <p id="proj-pais-error" className="cf-project-field-error">
              Selecciona un país.
            </p>
          )}
        </div>
        <div className="f" style={{ marginBottom: 3 }}>
          <label htmlFor="proj-tipogas" style={{ fontSize: 12 }}>
            Tipo de gas
          </label>
          <select
            id="proj-tipogas"
            disabled={!isEditing}
            value={proy.tipoGas ?? 'gn'}
            onChange={(e) => setP('tipoGas', e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }}
          >
            <option value="gn">Gas natural (GN)</option>
            <option value="glp">GLP — licuado</option>
          </select>
        </div>
        <div className="f" style={{ marginBottom: 0 }}>
          <label htmlFor="proj-uso" style={{ fontSize: 12 }}>
            Uso
          </label>
          <select
            id="proj-uso"
            ref={usageRef}
            required
            disabled={!isEditing}
            value={uso}
            aria-invalid={!uso}
            aria-describedby={uso ? undefined : 'proj-uso-error'}
            onChange={(e) => setP('uso', e.target.value)}
            style={{
              fontSize: 12,
              padding: '3px 6px',
              width: '100%',
              opacity: isEditing ? 1 : 0.7,
            }}
          >
            <option value="" disabled>
              —
            </option>
            {USOS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          {!uso && (
            <p id="proj-uso-error" className="cf-project-field-error">
              Selecciona un tipo de uso.
            </p>
          )}
        </div>
      </div>
    </section>
  );
});

export default ProjectIdCard;
