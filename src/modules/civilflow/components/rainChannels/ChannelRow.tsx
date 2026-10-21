import { renderStatus } from '../../utils/componentHelpers.tsx';
import { fmt } from '../../utils/formatUtils.ts';
import ChipList from '../shared/ChipList.tsx';
import { CanalDimField } from './ChannelDimField.tsx';
import {
  MATERIALES_CUBIERTA_LL,
  MATERIALES_CANAL_LL,
} from '../../constants/engineeringDataMaterials.ts';
import { BORDE_LIBRE_CANAL_CM } from '../../utils/calcRainwater.ts';
import { pisoCorto } from '../../constants';
import { calcularFilaCanal } from '../../utils/rainChannelCalc.ts';
import type { CanalLL } from '../../context/RainwaterContext.tsx';

/** Una fila de la tabla de canales de lluvias (celdas, glifos y checks). */
export function FilaCanalRow(props: {
  c: CanalLL;
  diamPulgPorChip: Record<string, number>;
  canalBajantes: Record<string, string[]>;
  onCanalField: (id: string, field: string, val: number) => void;
  setMaterialCanal: (ref: string, field: 'materialCubierta' | 'materialCanal', mat: string) => void;
  /** La celda está en modo edición (EDITAR/LISTO). */
  edit: boolean;
}) {
  const { c, diamPulgPorChip, canalBajantes, onCanalField, setMaterialCanal, edit } = props;
  // REQ material absoluto: C SOLO del material de cubierta del catálogo —
  // sin material → 0 → Q=0 y chequeo 'No cumple' (SIN fallback al override
  // manual coeficienteC ni al 0.0278 de fila nueva). Con bajantes asociados,
  // c.materialCubierta ya llega DERIVADO del context (fuente única bajantes).
  const { Cder, nder, Qreal, Qmax, yn, velocidad, chequeo, totalStr, aEfectivaSiempre, ds, emb } =
    calcularFilaCanal(
      c as unknown as Parameters<typeof calcularFilaCanal>[0],
      diamPulgPorChip,
      canalBajantes,
    );
  return (
    <tr key={c.id}>
      <td className="c">
        {/* Sector + piso (orig. usuario): etiqueta tipo CNL1-C. */}
        <span className="sigla" style={{ fontSize: 10 }}>
          {c.sector || '—'}
          {c.piso != null ? `-${pisoCorto(c.piso)}` : ''}
        </span>
      </td>
      <td className="c" style={{ padding: '2px 3px', minWidth: 60 }}>
        {/* Bajantes que descargan a este canal (ítem 8 usuario): chips
                          CODE-PISO, misma lectura que el área parcial. */}
        {(() => {
          const items = c.drawId ? canalBajantes[c.drawId] || [] : [];
          return items.length > 0 ? (
            <ChipList items={items} />
          ) : (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>—</span>
          );
        })()}
      </td>
      <td className="c">
        {/* Parcial (REQ canal = Σ bajantes): con asociados llega DERIVADO del
                          context = Σ areaParcialBajanteLl de cada bajante (misma fórmula que
                          la tabla de bajantes); sin asociados → fallbacks propios del canal. */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {c.areaParcial ? Number(c.areaParcial).toFixed(2) : '—'}
        </span>
      </td>
      <td className="c">
        {/* Otras (orig. usuario): editable, default 0 — nunca vacía. REQ:
                          con asociados muestra el Σ derivado de los overrides de los bajantes
                          y al editar escribe updBajanteLL en cada uno (fuente única). */}
        <CanalDimField
          id={c.id}
          field="areaOtras"
          value={c.areaOtras ?? 0}
          onChange={onCanalField}
          disabled={!edit}
        />
      </td>
      <td className="c">
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {c.areaAcumulada ? Number(c.areaAcumulada).toFixed(2) : '—'}
        </span>
      </td>
      <td className="c">
        {/* Muro vertical (hoja 2 col. D, entrada): m² que descargan al canal. */}
        <CanalDimField
          id={c.id}
          field="muroVertical"
          value={c.muroVertical ?? 0}
          onChange={onCanalField}
          disabled={!edit}
        />
      </td>
      <td className="c">
        {/* A efectiva = A acumulada + 0.5·muro (hoja 2 col. E). */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {Number(aEfectivaSiempre).toFixed(2)}
        </span>
      </td>
      <td className="c">
        {/* Material de cubierta (hoja 2 col. G): abreviatura + hover completo.
                          REQ canal = Σ bajantes: con asociados muestra el material COMÚN
                          derivado de los bajantes ('' si mezclados) y al escoger escribe
                          materialCubierta a TODOS los asociados (fuente única). */}
        {edit ? (
          <select
            value={c.materialCubierta ?? ''}
            aria-label="Material de cubierta"
            title={c.materialCubierta || 'Material de cubierta'}
            onChange={(e) => setMaterialCanal(c.id, 'materialCubierta', e.target.value)}
            style={{
              textAlign: 'center',
              fontSize: 10,
              padding: '2px 2px',
              width: '100%',
              minWidth: 0,
              fontFamily: 'var(--mono)',
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 2,
              color: 'var(--txt)',
              cursor: 'pointer',
            }}
          >
            <option value="">—</option>
            {MATERIALES_CUBIERTA_LL.map((m) => (
              <option key={m.nombre} value={m.nombre} title={m.nombre}>
                {m.abrev}
              </option>
            ))}
          </select>
        ) : (
          <span
            title={c.materialCubierta || undefined}
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
          >
            {MATERIALES_CUBIERTA_LL.find((m) => m.nombre === (c.materialCubierta ?? ''))?.abrev ||
              '—'}
          </span>
        )}
      </td>
      <td className="c">
        {/* C derivado del material de cubierta (hoja 2, criterio por material). */}
        <span
          title={c.materialCubierta || undefined}
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
        >
          {Cder > 0 ? Cder.toFixed(2) : '—'}
        </span>
      </td>
      <td className="c">
        {/* Intensidad editable (ítem 7 usuario): override por sector en filas
                          fromCanal, estado en manuales. */}
        <CanalDimField
          id={c.id}
          field="intensidad"
          value={c.intensidad ?? 0}
          onChange={onCanalField}
          disabled={!edit}
        />
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10 }}>
        {Qreal > 0 ? fmt(Qreal, 2) : '—'}
      </td>
      <td className="c">
        {/* Material del canal (hoja 2 col. J): n derivado del catálogo. */}
        {edit ? (
          <select
            value={c.materialCanal ?? ''}
            aria-label="Material del canal"
            title={c.materialCanal || 'Material del canal'}
            onChange={(e) => setMaterialCanal(c.id, 'materialCanal', e.target.value)}
            style={{
              textAlign: 'center',
              fontSize: 10,
              padding: '2px 2px',
              width: '100%',
              minWidth: 0,
              fontFamily: 'var(--mono)',
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 2,
              color: 'var(--txt)',
              cursor: edit ? 'pointer' : 'default',
            }}
          >
            <option value="">—</option>
            {MATERIALES_CANAL_LL.map((m) => (
              <option key={m.nombre} value={m.nombre} title={m.nombre}>
                {m.abrev}
              </option>
            ))}
          </select>
        ) : (
          <span
            title={c.materialCanal || undefined}
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
          >
            {MATERIALES_CANAL_LL.find((m) => m.nombre === (c.materialCanal ?? ''))?.abrev || '—'}
          </span>
        )}
      </td>
      <td className="c">
        {/* n SOLO del material de canal (REQ: sin material → vacío, sin fallback). */}
        <span
          title={c.materialCanal || undefined}
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
        >
          {nder != null && nder > 0 ? nder.toFixed(3) : '—'}
        </span>
      </td>
      <td className="c">
        {/* Pendiente editable y bidireccional con el dibujo (ítem 7 usuario):
                          filas fromCanal escriben al glifo; manuales al estado. */}
        <CanalDimField
          id={c.id}
          field="pendiente"
          value={c.pendiente ?? 0}
          onChange={onCanalField}
          disabled={!edit}
        />
      </td>
      <td className="c">
        {/* Base editable también en filas fromCanal: escribe al glifo
                          (ítem 7 usuario) en vez de mostrar solo lectura. */}
        <CanalDimField id={c.id} field="b" value={c.b} onChange={onCanalField} disabled={!edit} />
      </td>
      <td className="c">
        <CanalDimField id={c.id} field="h" value={c.h} onChange={onCanalField} disabled={!edit} />
      </td>
      <td className="c">
        {/* Borde libre editable por fila (hoja 2 col. O; antes fijo 10 cm). */}
        <CanalDimField
          id={c.id}
          field="bordeLibreCm"
          value={c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM}
          onChange={onCanalField}
          disabled={!edit}
        />
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 10 }}>
        {totalStr}
      </td>
      <td className="c" style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10 }}>
        {Qmax > 0 ? fmt(Qmax, 2) : '—'}
      </td>
      <td className="c">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {Qmax > 0 && Qreal > 0 ? `${((Qreal / Qmax) * 100).toFixed(2)}%` : '—'}
        </span>
      </td>
      <td className="c">
        {/* Tirante normal (hoja 2 col. V): iteración de punto fijo en calc. */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {yn > 0 ? yn.toFixed(2) : '—'}
        </span>
      </td>
      <td className="c">
        {/* Velocidad (hoja 2 col. W) = Q/(b·yn). */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {velocidad > 0 ? velocidad.toFixed(2) : '—'}
        </span>
      </td>
      <td className="c">
        {/* D bajante (hoja 2 col. AA): el menor de los asociados. */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {ds.length ? `${Math.min(...ds)}"` : '—'}
        </span>
      </td>
      <td className="c">
        {/* Lámina requerida H = max(vertedero, orificio) (hoja 2 col. AE). */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
          {emb.Hreq > 0 ? emb.Hreq.toFixed(2) : '—'}
        </span>
      </td>
      <td className="c" style={{ fontSize: 10 }}>
        {renderStatus(chequeo)}
      </td>
      <td className="c" style={{ fontSize: 10 }}>
        {renderStatus(emb.chequeo)}
      </td>
    </tr>
  );
}
