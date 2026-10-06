// AlertasResumen: alertas del sector seleccionado + notas generales (visible también vacío).
import type { RejResultado } from '../../utils/rejillasCalc';
import type { RejFila } from './rejillasShared';

export function AlertasResumen({
  filas,
  resultados,
  gas,
  hayM2,
  sel,
}: {
  filas: RejFila[];
  resultados: RejResultado[];
  gas: 'natural' | 'glp';
  hayM2: boolean;
  sel: number;
}) {
  const f = filas[sel];
  const res = resultados[sel];
  if (!f || !res) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {/* Alertas SIEMPRE visibles: en estado 'vacio' solo las hay si el cálculo las
          pusheó (potencia sin definir, sótanos) y tragárselas ocultaba el motivo del kW = 0. */}
      {res.alertas.map((a, i) => (
        <div
          key={i}
          style={{
            fontSize: 12,
            padding: '5px 8px',
            borderTop: '1px solid var(--line)',
            color: a.e ? '#E7786B' : '#E3A24F',
          }}
        >
          {a.e ? 'Crítica' : 'Observación'}: {a.t}
        </div>
      ))}
      {gas === 'glp' && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
          GLP (gas más denso que el aire): solo Método 1; sin artefactos en sótanos (3.2, 4.2.1).
        </div>
      )}
      {hayM2 && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
          Método 2: separación de los artefactos ≥ 2,5 cm a lados y atrás y 16 cm al frente (4.2.2).
        </div>
      )}
    </div>
  );
}

/** Alzado del muro a escala real — port del alzado() del prototipo a SVG React. */
