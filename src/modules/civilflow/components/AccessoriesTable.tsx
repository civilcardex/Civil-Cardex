import { memo } from 'react';
import { ACCESORIOS_HIDRO, pisoCorto } from '../constants';
import type { Tramo } from '../context/tramosReducer';
const AccessoriesTable_S1: React.CSSProperties = {
  width: 76,
  textAlign: 'center',
  fontSize: 9,
  padding: '2px 2px',
};
const AccessoriesTable_S3: React.CSSProperties = {
  fontSize: 9,
  textAlign: 'center',
  fontWeight: 600,
  padding: '2px 2px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const AccessoriesTable_S5: React.CSSProperties = {
  fontSize: 8,
  textAlign: 'center',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  padding: '2px 1px',
  overflow: 'hidden',
};

const ACCESORIOS_COLS = ACCESORIOS_HIDRO.filter((a) => a.id !== 'llaveTerminal');

const AccesoriosTable = memo(function AccesoriosTable({ tramos }: { tramos: Tramo[] }) {
  const cMono = "'Courier New',Courier,monospace";
  const filtered = tramos.filter((t) => t.tipo !== 'tributario');
  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/general/Accesorios.webp"
            alt="Accesorios"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Accesorios por ramal
        </h3>
        <span className="card-s">{filtered.length} tramos</span>
      </div>
      <div style={{ padding: '12px' }}>
        <table
          className="tbl"
          style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9 }}
        >
          <thead>
            <tr>
              <th scope="col" className="col-h" style={AccessoriesTable_S1}>
                Tramo
              </th>
              {ACCESORIOS_COLS.map((a) => (
                <th scope="col" key={a.id} className="col-h" style={AccessoriesTable_S5}>
                  <img
                    src={a.icono}
                    alt={a.nombre}
                    width={16}
                    height={16}
                    style={{
                      width: 16,
                      height: 16,
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto 2px',
                    }}
                    loading="lazy"
                  />
                  <span style={{ fontSize: 8, fontWeight: 500 }}>{a.nombre}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const base = t.label || t.id;
              const lbl = t.piso != null ? `${base}-${pisoCorto(t.piso)}` : base;
              return (
                <tr key={i}>
                  <td className="c" style={AccessoriesTable_S3}>
                    {lbl}
                  </td>
                  {ACCESORIOS_COLS.map((a) => {
                    const v = t.accesorios?.[a.id] || 0;
                    return (
                      <td
                        key={a.id}
                        className="c"
                        style={{ padding: '4px 1px', overflow: 'hidden' }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: cMono,
                            color: v > 0 ? 'var(--txt)' : 'var(--txt3)',
                          }}
                        >
                          {v || '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  className="c"
                  colSpan={1 + ACCESORIOS_COLS.length}
                  style={{
                    fontSize: 9,
                    color: 'var(--txt3)',
                    padding: '24px 0',
                    textAlign: 'center',
                  }}
                >
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});

export default AccesoriosTable;
