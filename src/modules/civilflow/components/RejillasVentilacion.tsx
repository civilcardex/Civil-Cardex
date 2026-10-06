import React, { useEffect, useState } from 'react';
import { AlertasResumen } from './rejillasVentilacion/AlertasResumen';
import { AlzadoMuro } from './rejillasVentilacion/AlzadoMuro';
import { TablaTipologias } from './rejillasVentilacion/TablaTipologias';
import { useRejillasData } from './rejillasVentilacion/useRejillasData';
import EditButton from './shared/EditButton';

// Módulo Rejillas de ventilación (NTC 3631, 3ª actualización) — tabla Tipologías por sector.
// Los sectores SOLO nacen de áreas dibujadas en el visor con la pestaña Gas activa (sin
// "+ Sector" ni "Duplicar"): Sector = etiqueta del área, Área = área del polígono (m²),
// Alto = altura libre capturada en el panel derecho, Gasodomésticos = conteos de aparatos
// del área (FixturesPanel, clave gas_<areaId>_<planId>). El resto de columnas son fórmulas
// o desplegables del motor NTC 3631. Incluye el alzado del muro con las aberturas a escala.
const REJILLAS = React.memo(function RejillasVentilacion() {
  const { filas, resultados, gas, setOv, overrides, cambiarGas } = useRejillasData();
  const [selIdx, setSelIdx] = useState(0);
  const [edit, setEdit] = useState(false);
  // Modal del alzado de muro del sector seleccionado (reemplaza la página propia).
  const [alzadoAbierto, setAlzadoAbierto] = useState(false);
  const hayM2 = resultados.some((r) => r.metodoAplicado === '2');
  const sel = Math.min(selIdx, filas.length - 1);
  const selFila = filas.length ? filas[Math.max(sel, 0)] : undefined;
  const selRes = filas.length ? resultados[Math.max(sel, 0)] : undefined;

  // Escape cierra el modal (listener a nivel documento, patrón HelpPanel).
  useEffect(() => {
    if (!alzadoAbierto) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAlzadoAbierto(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alzadoAbierto]);

  return (
    <>
      {/* Selector de tipo de gas FUERA y encima de la tarjeta (orig. usuario). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '2px 2px 8px',
          fontSize: 12,
          color: 'var(--txt2)',
        }}
      >
        <span>Tipo de gas</span>
        <select
          value={gas}
          aria-label="Tipo de gas del proyecto"
          onChange={(e) => {
            cambiarGas(e.target.value as 'natural' | 'glp');
          }}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            background: 'var(--bg3)',
            color: 'var(--txt)',
            border: '1px solid var(--line)',
            borderRadius: 4,
          }}
        >
          <option value="natural">Natural</option>
          <option value="glp">GLP (más denso que el aire)</option>
        </select>
        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
          Sectores: áreas dibujadas con la red Gas activa en el visor (etiqueta = sector).
        </span>
      </div>
      {/* Altura TOPE inline en la tarjeta: el layout externo la recorta con overflow:hidden
          sin dar scroll (la memoria quedaba inalcanzable, orig. usuario ×3). Con el tope aquí,
          el contenido interno (flex:1 + overflowY) scrollea SIEMPRE dentro de la tarjeta. */}
      <section
        className="card"
        aria-label="Rejillas de ventilación"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 190px)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <img
            src="/iconos_civilflow/diseno_redes/gas/rejilla_ventilacion.webp"
            alt=""
            width={24}
            height={24}
            style={{ width: 24, height: 24, objectFit: 'contain' }}
            loading="lazy"
          />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>
            Rejillas de ventilación
          </h3>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--txt2)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '1px 8px',
            }}
          >
            {filas.length} {filas.length === 1 ? 'sector' : 'sectores'}
          </span>
          {filas.length > 0 && (
            <button
              type="button"
              onClick={() => setAlzadoAbierto(true)}
              title={`Esquema a escala del muro del sector «${selFila?.sector ?? ''}»`}
              style={{
                fontSize: 11,
                fontFamily: 'var(--mono)',
                padding: '3px 10px',
                background: 'var(--bg3)',
                color: 'var(--acc2)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                maxWidth: 380,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Ver alzado de muro de «{selFila?.sector ?? ''}»
            </button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
        </div>
        {/* Scroll VERTICAL propio y autocontenido (maxHeight propio: no depende del layout
            externo, que recorta la tarjeta con overflow:hidden sin dar scroll — orig. usuario
            "sigue sin estar el scroll vertical para ver las memorias del sector"). */}
        <div
          style={{
            padding: '8px 10px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 205px)',
          }}
        >
          <TablaTipologias
            filas={filas}
            resultados={resultados}
            gas={gas}
            edit={edit}
            sel={sel < 0 ? 0 : sel}
            onSelect={setSelIdx}
            onOv={setOv}
            overrides={overrides}
          />

          {filas.length > 0 && (
            <>
              <AlertasResumen
                filas={filas}
                resultados={resultados}
                gas={gas}
                hayM2={hayM2}
                sel={sel < 0 ? 0 : sel}
              />
              {/* DetalleSector (memoria del sector) retirado a pedido del usuario — la memoria
                  completa sigue disponible en Informes/memoria global. */}
            </>
          )}
        </div>
      </section>
      {alzadoAbierto && selRes && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAlzadoAbierto(false);
          }}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.6)',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Alzado de muro de «${selFila?.sector ?? ''}»`}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              width: 'min(640px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 12px 30px rgba(0,0,0,.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                Alzado de muro de «{selFila?.sector ?? ''}»
              </h3>
              <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
                Apto {selFila?.apto} · {selFila?.piso}
              </span>
              <button
                type="button"
                onClick={() => setAlzadoAbierto(false)}
                aria-label="Cerrar alzado de muro"
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  color: 'var(--txt2)',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>
            {/* Grid center: centra el SVG horizontal Y verticalmente en el modal. */}
            <div style={{ padding: 12, display: 'grid', placeItems: 'center', minHeight: 280 }}>
              {selRes.estado === 'vacio' ? (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--txt2)',
                    padding: '14px 0',
                    textAlign: 'center',
                  }}
                >
                  Este sector no tiene gasodomésticos con potencia: sin aberturas que esquematizar.
                </div>
              ) : (
                <AlzadoMuro res={selRes} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ── Tabla Tipologías ─────────────────────────────────────────────────────────

export default REJILLAS;
