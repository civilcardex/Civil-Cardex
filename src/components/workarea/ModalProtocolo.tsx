import { useEffect, useRef } from "react";

interface ModalProtocoloProps {
  onClose: () => void;
}

export default function ModalProtocolo({ onClose }: ModalProtocoloProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      const first = modalRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div ref={modalRef} role="alertdialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 'var(--r2)', maxWidth: 720, maxHeight: '85vh',
        width: '90%', overflow: 'hidden', display: 'flex',
        flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>&#x1F4CB;</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Protocolo y recomendaciones</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Cerrar"
            style={{ padding: '4px 10px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', fontSize: 11 }}>
            &#x2715;
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="&#x1F4CD; Configuración en AutoCAD antes de exportar">
            <Item icon="📍" rule="Ejes de referencia obligatorios" detail="Dos líneas reales (no bloques ni xrefs): una horizontal X y una vertical Y, con cota etiquetada." />
            <Item icon="⊕" rule="Intersección común" detail="El cruce de los ejes debe estar en la misma posición relativa en TODOS los planos del proyecto (es el futuro origen)." />
            <Item icon="⬆" rule="Orientación fija" detail="Norte siempre arriba, sin rotar el plano entre pisos." />
            <Item icon="📄" rule="Mismo encuadre" detail="Igual viewport y hoja para todos los pisos del proyecto." />
          </Section>
          <Section title="&#x1F4A0; Exportación del PDF desde AutoCAD">
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Parámetro</th>
                  <th style={{ width: 180 }}>Valor recomendado</th>
                  <th>Por qué importa</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Resolución</td><td><strong>300 DPI</strong></td><td>Ni más (archivo pesado) ni menos (error de calibración)</td></tr>
                <tr><td>Escala de ploteo</td><td><strong>Fija: 1:50, 1:75, 1:100</strong></td><td>NUNCA "Ajustar a hoja"</td></tr>
                <tr><td>Tamaño archivo</td><td><strong>≤ 15 MB</strong></td><td>CIVILFLOW alerta si se supera</td></tr>
                <tr><td>Páginas</td><td><strong>1 piso = 1 archivo</strong></td><td>Mismo encuadre si varias páginas</td></tr>
                <tr><td>Formato</td><td><strong>PDF/A o DWG to PDF</strong></td><td>Vectores limpios, sin compresión destructiva</td></tr>
              </tbody>
            </table>
          </Section>
          <Section title="&#x2696;&#xFE0F; Calibración dual X/Y: por qué es importante">
            <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>
              Los PDF pueden presentar <strong>distorsión diferencial entre ejes</strong> cuando se exportan con configuraciones incorrectas. CIVILFLOW calibra independientemente cada eje y calcula el promedio:
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', fontFamily: 'monospace', fontSize: 12, color: 'var(--acc)' }}>
              Factor final = (FX + FY) / 2
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              <DiffRow diff="< 3%" label="Calibración excelente, proceder" color="var(--ok)" />
              <DiffRow diff="3 – 5%" label="Aceptable, verificar visualmente" color="#f59e0b" />
              <DiffRow diff={'> 5%'} label="Posible distorsión, revisar exportación" color="var(--err)" />
            </div>
          </Section>
          <Section title="&#x26A0;&#xFE0F; Errores frecuentes">
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Error</th>
                  <th style={{ width: 200 }}>Causa</th>
                  <th>Solución</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Longitudes incorrectas</td><td>Escala de ploteo "Ajustar a hoja"</td><td>Re-exportar con escala fija</td></tr>
                <tr><td>Diferencia FX/FY {'>'} 5%</td><td>Compresión asimétrica del PDF</td><td>Usar DWG to PDF a 300×300 DPI</td></tr>
                <tr><td>Origen no coincide entre pisos</td><td>Encuadres distintos por plano</td><td>Usar viewport fijo en AutoCAD</td></tr>
                <tr><td>Archivo {'>'} 15 MB</td><td>Resolución excesiva o imágenes</td><td>Reducir a 300 DPI</td></tr>
              </tbody>
            </table>
          </Section>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '7px 24px', background: 'var(--acc)', border: 'none', borderRadius: 'var(--r)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            &#x2713; Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--txt)' }}>{title}</div>
      {children}
    </div>
  );
}

function Item({ icon, rule, detail }: { icon: string; rule: string; detail: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)', marginBottom: 4, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{rule}</div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', lineHeight: 1.5, marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  );
}

function DiffRow({ diff, label, color }: { diff: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, width: 50 }}>{diff}</span>
      <span style={{ fontSize: 11, color: 'var(--txt2)' }}>→ {label}</span>
    </div>
  );
}
