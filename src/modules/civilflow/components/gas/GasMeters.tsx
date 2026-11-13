import EditButton from '../shared/EditButton.tsx';
import { GAS_DN_LABELS } from '../../constants';
import { CAT_GAS } from '../../constants/engineeringDataGas.ts';
import { CONTADORES as CONTADORES_CAT } from '../../pages/catalog/catalogData.ts';
import type React from 'react';
import {
  writeContadorDiamToDrawing,
  writeBajantePropToDrawing,
} from '../../utils/writeDiameterToDrawing.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

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
    <section className="card shrink-0">
      <div className="card-h gas-between">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/hidraulica/red_agua_fria.webp"
            alt="Contador / Calentador"
            width={20}
            height={20}
            className="gas-icon-20"
            loading="lazy"
          />
          Contador / Calentador
        </h3>
        <span className="card-s">{equipos.length} equipos</span>
        <EditButton edit={edit} setEdit={setEdit} />
      </div>
      <div className="gas-pad-6">
        <table className="tbl gas-tbl-105">
          <thead>
            <tr>
              <th
                title="Identificador del equipo en el dibujo."
                scope="col"
                className="ds-th gas-th-105"
              >
                ID
              </th>
              <th
                title="Tipo de equipo: contador o calentador."
                scope="col"
                className="ds-th gas-th-105"
              >
                Tipo
              </th>
              <th
                title="Diámetro de la conexión del equipo."
                scope="col"
                className="ds-th gas-th-105"
              >
                Diámetro
              </th>
              <th title="Tipo de conexión del equipo." scope="col" className="ds-th gas-th-105">
                Conexión
              </th>
              <th title="Capacidad del equipo." scope="col" className="ds-th gas-th-105">
                Capacidad
              </th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((b) => (
              <tr key={b.id}>
                <td className="c ds-td gas-td-105">{b.code || b.id}</td>
                <td className="c ds-td gas-td-105">
                  {b.tipo === 'contador' ? 'Contador' : 'Calentador'}
                </td>
                <td className="c gas-pad-xs">
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
                      className="ds-sd gas-sd-fs"
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
                <td className="c gas-pad-xs">
                  <select
                    value={b.acoDiam || ''}
                    aria-label="Conexión"
                    disabled={!edit}
                    onChange={(e) => {
                      const val = e.target.value;
                      const bajKey = `${b.id}-${b.planId}`;
                      writeBajantePropToDrawing(bajKey, 'gas', 'acoDiam', val, plans);
                    }}
                    className="ds-sd gas-sd-fs"
                  >
                    <option value="">—</option>
                    {GAS_DN_LABELS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="c gas-pad-xs">
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
                      className="ds-sd gas-sd-fs"
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
