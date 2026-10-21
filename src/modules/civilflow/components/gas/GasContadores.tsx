import EditButton from '../shared/EditaBoton.tsx';
import { SD, TH as _TH, TD as _TD } from '../../styles/compartidoTablaEstilos.ts';
import { GAS_DN_LABELS } from '../../constants';
import { CAT_GAS } from '../../constants/ingenieriaDatosGas.ts';
import { CONTADORES as CONTADORES_CAT } from '../../pages/catalog/catalogoDatos.ts';
import type React from 'react';
import {
  writeContadorDiamToDrawing,
  writeBajantePropToDrawing,
} from '../../utils/escribeDiametroToDibujo.ts';
import type { PlanItem } from '../../context/PlanosContexto.tsx';

const TH = { ..._TH, fontSize: 10.5, padding: '2px 3px' };
const TD = { ..._TD, fontSize: 10.5, padding: '1px 2px' };

/** Equipo de gas del dibujo (contador o calentador). */
export interface EquipoGasFila {
  id: string;
  planId: string | number;
  code?: string;
  tipo?: string;
  dNominal?: string;
  acoDiam?: string;
  capacidad?: string;
}

export interface GasContadoresProps {
  equipos: EquipoGasFila[];
  edit: boolean;
  setEdit: React.Dispatch<React.SetStateAction<boolean>>;
  plans: PlanItem[];
}

/**
 * Tabla de contadores y calentadores de gas: diámetro de conexión y capacidad de cada equipo, editables y escritos al dibujo.
 * Ej: 2 contadores -> 2 filas con diámetro (pulg) y conexión; 1 calentador -> capacidad del catálogo.
 */
export function GasContadores(props: GasContadoresProps) {
  const { equipos, edit, setEdit, plans } = props;
  if (equipos.length === 0) return null;
  return (
    <section className="card" style={{ flexShrink: 0 }}>
      <div className="card-h" style={{ justifyContent: 'space-between' }}>
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/hidraulica/red_agua_fria.webp"
            alt="Contador / Calentador"
            width={20}
            height={20}
            style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />
          Contador / Calentador
        </h3>
        <span className="card-s">{equipos.length} equipos</span>
        <EditButton edit={edit} setEdit={setEdit} />
      </div>
      <div style={{ padding: 6 }}>
        <table className="tbl" style={{ fontSize: 10.5 }}>
          <thead>
            <tr>
              <th title="Identificador del equipo en el dibujo." scope="col" style={TH}>
                ID
              </th>
              <th title="Tipo de equipo: contador o calentador." scope="col" style={TH}>
                Tipo
              </th>
              <th title="Diámetro de la conexión del equipo." scope="col" style={TH}>
                Diámetro
              </th>
              <th title="Tipo de conexión del equipo." scope="col" style={TH}>
                Conexión
              </th>
              <th title="Capacidad del equipo." scope="col" style={TH}>
                Capacidad
              </th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((b) => (
              <tr key={b.id}>
                <td className="c" style={TD}>
                  {b.code || b.id}
                </td>
                <td className="c" style={TD}>
                  {b.tipo === 'contador' ? 'Contador' : 'Calentador'}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {b.tipo === 'contador' ? (
                    <select
                      value={b.dNominal ? b.dNominal.replace(/"/g, '').trim() : ''}
                      aria-label="Diámetro"
                      disabled={!edit}
                      onChange={(e) => {
                        const dNom = e.target.value ? `${e.target.value}"` : '';
                        writeContadorDiamToDrawing(dNom, plans, 'gas', {
                          planId: b.planId,
                          id: b.id,
                        });
                      }}
                      style={{ ...SD, fontSize: 10.5 }}
                    >
                      <option value="">—</option>
                      {CONTADORES_CAT.map((c) => (
                        <option key={c.dn} value={c.dn}>
                          {c.dn}"
                        </option>
                      ))}
                    </select>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  <select
                    value={b.acoDiam || ''}
                    aria-label="Conexión"
                    disabled={!edit}
                    onChange={(e) => {
                      const val = e.target.value;
                      const bajKey = `${b.id}-${b.planId}`;
                      writeBajantePropToDrawing(bajKey, 'gas', 'acoDiam', val, plans);
                    }}
                    style={{ ...SD, fontSize: 10.5 }}
                  >
                    <option value="">—</option>
                    {GAS_DN_LABELS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="c" style={{ padding: '1px 2px' }}>
                  {b.tipo === 'calentador' ? (
                    <select
                      value={b.capacidad || ''}
                      aria-label="Capacidad"
                      disabled={!edit}
                      onChange={(e) => {
                        const val = e.target.value;
                        const bajKey = `${b.id}-${b.planId}`;
                        writeBajantePropToDrawing(bajKey, 'gas', 'capacidad', val, plans);
                      }}
                      style={{ ...SD, fontSize: 10.5 }}
                    >
                      <option value="">—</option>
                      {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
