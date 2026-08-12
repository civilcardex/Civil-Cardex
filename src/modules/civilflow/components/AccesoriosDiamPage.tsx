import { memo, useEffect, useMemo, useState } from 'react';
import { useTramos } from '../context/TramosContext';
import { usePlans } from '../context/PlansContext';
import { computeAccesoriosTable } from '../utils/sanAccesoriosRows';
import { fmtPulg } from '../utils/formatUtils';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';
import { SAN_ACCESORIOS, ACCESORIOS_HIDRO, GAS_ACCESORIOS } from '../constants';

const TH: React.CSSProperties = {
  fontSize: 11,
  textAlign: 'center',
  background: 'var(--bg2)',
  padding: '6px 8px',
  whiteSpace: 'nowrap',
  letterSpacing: 0.4,
};
const TD: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 8px',
  borderBottom: '1px solid var(--line)',
  textAlign: 'center',
};

const AccesoriosDiamPage = memo(function AccesoriosDiamPage({
  net,
}: {
  net: 'san' | 'll' | 'af' | 'ac' | 'gas';
}) {
  const { tramosSan, tramosLl, tramosAf, tramosAc } = useTramos();
  const { plans } = usePlans();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('storage', handler);
    window.addEventListener('civilflow_san_sync_changed', handler);
    window.addEventListener('civilflow_hidro_sync_changed', handler);
    const iv = setInterval(handler, 3000);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('civilflow_san_sync_changed', handler);
      window.removeEventListener('civilflow_hidro_sync_changed', handler);
      clearInterval(iv);
    };
  }, []);

  const tramos =
    net === 'san'
      ? tramosSan
      : net === 'll'
        ? tramosLl
        : net === 'af'
          ? tramosAf
          : net === 'ac'
            ? tramosAc
            : [];

  const catalog =
    net === 'san' || net === 'll'
      ? SAN_ACCESORIOS
      : net === 'gas'
        ? GAS_ACCESORIOS
        : ACCESORIOS_HIDRO;

  const table = useMemo(
    () => computeAccesoriosTable(net, tramos, plans ?? []),
    // tick invalida a propósito el caché (localStorage no es reactivo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net, tramos, plans, tick],
  );

  // Tabla vertical compacta (Diámetro | Accesorio | Cantidad) — una sola tabla sin scroll
  // horizontal: la matriz por catálogo obligaba a ~20 columnas en AF/AC. El mapeo se hace por
  // NOMBRE de columna (no por índice) porque dropAllZeroColumns elimina columnas en cero, así
  // las columnas restantes ya no coinciden uno-a-uno con el catálogo.
  const rows = useMemo(() => {
    if (!table) return [];
    const byNombre = new Map(catalog.map((a) => [a.nombre, a]));
    const headers = table.headers;
    const out: Array<{ diam: string; acc: (typeof catalog)[number]; count: number }> = [];
    for (const row of table.rows) {
      const diam = String(row[0]);
      // headers[0] = 'Diámetro', el último = 'Total'; el resto son accesorios.
      for (let i = 1; i < headers.length - 1; i++) {
        const v = Number(row[i] || 0);
        if (v <= 0) continue;
        const acc = byNombre.get(String(headers[i]));
        if (acc) out.push({ diam, acc, count: v });
      }
    }
    // Bug 2: filas pseudo de bushing — UNA fila por par de diámetros que tenga conexiones reales
    // en el dibujo, con la CANTIDAD de bushings contada (no 1 fijo por par). El nombre del
    // accesorio es solo "Bushing" (sin diámetros) y los diámetros van en la columna "Diámetro"
    // como `mayor" × menor"`. Solo en la tabla resumen de la UI (af/ac/gas); no viven ni en los
    // catálogos ni en el storage ni en el dibujo.
    if ((net === 'af' || net === 'ac' || net === 'gas') && table.bushingCounts) {
      const entries = Object.entries(table.bushingCounts)
        .map(([k, count]) => {
          const [mayor, menor] = k.split('_').map(Number);
          return { mayor, menor, count };
        })
        .sort((a, b) => b.mayor - a.mayor || b.menor - a.menor);
      for (const { mayor, menor, count } of entries) {
        out.push({
          diam: `${fmtPulg(mayor)} × ${fmtPulg(menor)}`,
          acc: {
            id: `bushing-${mayor}-${menor}`,
            nombre: 'Bushing',
            icono: '',
            cat: 'Bushings',
            emoji: '🔩',
          },
          count,
        });
      }
    }
    // Reordenar por diámetro desc (estable) para que las filas bushing queden dentro del grupo
    // de su diámetro mayor.
    out.sort((a, b) => (diamPulgFromLabel(b.diam) || 0) - (diamPulgFromLabel(a.diam) || 0));
    return out;
  }, [table, catalog, net]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
        flex: 1,
        paddingBottom: '24px',
      }}
    >
      <section
        className="card"
        style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignSelf: 'center' }}
      >
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/general/Accesorios.webp"
              alt="Totales"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />
            {table?.title || 'Resumen de accesorios por diámetro'}
          </h3>
        </div>
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {rows.length > 0 ? (
            <table
              className="tbl"
              style={{
                fontSize: 13,
                borderCollapse: 'collapse',
                whiteSpace: 'nowrap',
              }}
            >
              <thead>
                <tr>
                  <th scope="col" className="col-h" style={{ ...TH, width: 90 }}>
                    Diámetro
                  </th>
                  <th scope="col" className="col-h" style={TH}>
                    Accesorio
                  </th>
                  <th scope="col" className="col-h" style={{ ...TH, width: 70 }}>
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="c" style={{ ...TD, fontWeight: 700, background: 'var(--bg2)' }}>
                      {r.diam}
                    </td>
                    <td className="c" style={TD}>
                      {r.acc.nombre}
                    </td>
                    <td className="c" style={{ ...TD, fontWeight: 700 }}>
                      {r.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--txt3)',
                padding: '24px 0',
                textAlign: 'center',
              }}
            >
              No hay accesorios.
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

export default AccesoriosDiamPage;
