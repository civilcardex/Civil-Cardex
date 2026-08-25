import { useState, useRef, useCallback } from 'react';

const TABLA_A: { n: number; txt: string }[] = [
  { n: 1, txt: 'VÁLVULA DE COMPUERTA OS&Y (VÁLVULA DE CONTROL EN LA SUCCIÓN)' },
  { n: 2, txt: 'REDUCTOR EXCÉNTRICO' },
  { n: 3, txt: 'MANO-VACUÓMETRO DE SUCCIÓN' },
  { n: 4, txt: 'MANÓMETRO DE DESCARGA' },
  { n: 5, txt: 'VÁLVULA AUTOMÁTICA DE LIBERACIÓN DE AIRE' },
  { n: 6, txt: 'VÁLVULA DE ALIVIO' },
  { n: 7, txt: 'CONO DE DESCARGA' },
  { n: 8, txt: 'VÁLVULA CHECK A LA DESCARGA DE LA BOMBA' },
  { n: 9, txt: 'VÁLVULA DE COMPUERTA INDICADA O VÁLVULA DE MARIPOSA, EN EL CABEZAL DE PRUEBAS' },
  { n: 10, txt: 'CABEZAL DE PRUEBAS' },
  {
    n: 11,
    txt: 'VÁLVULA DE COMPUERTA INDICADA O VÁLVULA DE MARIPOSA, (VÁLVULA DE CONTROL DE DESCARGA)',
  },
  { n: 12, txt: 'CAUDALÍMETRO' },
  { n: 13, txt: 'VÁLVULA DE COMPUERTA INDICADA O VÁLVULA DE MARIPOSA, EN EL CAUDALÍMETRO' },
];
const TABLA_B: { n: number; txt: string }[] = [
  { n: 14, txt: 'CONTROLADOR DE LA BOMBA CONTRA INCENDIO' },
  { n: 15, txt: 'CONTROLADOR DE LA BOMBA JOCKEY' },
  { n: 16, txt: 'LÍNEA SENSORA DE PRESIÓN DE LA BOMBA CONTRA INCENDIO' },
  { n: 17, txt: 'LÍNEA SENSORA DE PRESIÓN DE LA BOMBA JOCKEY' },
  { n: 18, txt: 'BOMBA JOCKEY' },
  { n: 19, txt: 'VÁLVULA DE AISLAMIENTO EN LA SUCCIÓN DE LA BOMBA JOCKEY' },
  { n: 20, txt: 'VÁLVULA CHECK EN LA DESCARGA DE LA BOMBA JOCKEY' },
  { n: 21, txt: 'VÁLVULA DE AISLAMIENTO EN LA DESCARGA DE LA BOMBA JOCKEY' },
  { n: 22, txt: 'VÁLVULA CHECK EN LA CONEXIÓN PARA BOMBEROS' },
  { n: 23, txt: 'CONEXIÓN PARA BOMBEROS' },
  { n: 24, txt: 'TANQUE DE COMBUSTIBLE' },
  { n: 25, txt: 'TUBERÍA DE ESCAPE DE GASES DEL MOTOR DE LA BOMBA CONTRA INCENDIOS' },
  { n: 26, txt: 'BATERÍAS' },
];

function TablaCompact({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { n: number; txt: string }[];
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  return (
    <div
      style={{
        background: 'var(--panel, #161b27)',
        border: '1px solid var(--border, #2a3347)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          background: 'linear-gradient(135deg, rgba(239,68,68,.14), rgba(239,68,68,.04))',
          borderBottom: '1px solid var(--border, #2a3347)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--rci, #ef4444)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--txt, #e2e8f0)',
          }}
        >
          {title}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 800,
            background: 'var(--rci, #ef4444)',
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 20,
          }}
        >
          {items.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {items.map((it) => {
          const sel = selected === it.n;
          return (
            <button
              key={it.n}
              type="button"
              onClick={() => onSelect(it.n)}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                flex: 1,
                minHeight: 0,
                border: 'none',
                borderBottom: '1px solid var(--line, #1e2535)',
                background: sel
                  ? 'rgba(239,68,68,.18)'
                  : it.n % 2 === 0
                    ? 'rgba(255,255,255,.015)'
                    : 'transparent',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                width: '100%',
                outline: sel ? '1.5px solid var(--rci, #ef4444)' : 'none',
                outlineOffset: sel ? -1 : 0,
              }}
            >
              <span
                style={{
                  width: 30,
                  minWidth: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: `1px solid ${sel ? 'var(--rci, #ef4444)' : 'var(--line, #1e2535)'}`,
                  background: sel ? 'rgba(239,68,68,.22)' : 'rgba(239,68,68,.06)',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: '50%',
                    background: sel
                      ? 'var(--rci, #ef4444)'
                      : it.n <= 13
                        ? 'var(--rci, #ef4444)'
                        : '#1e3a5f',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: sel ? '0 0 8px rgba(239,68,68,.6)' : 'none',
                    transform: sel ? 'scale(1.12)' : 'none',
                    transition: 'transform 120ms',
                  }}
                >
                  {it.n}
                </span>
              </span>
              <span
                style={{
                  padding: '4px 7px',
                  fontSize: 11.5,
                  lineHeight: 1.35,
                  color: sel ? 'var(--txt, #e2e8f0)' : 'var(--txt2, #94a3b8)',
                  fontWeight: sel ? 700 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                  textTransform: 'uppercase',
                }}
              >
                {it.txt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RciCuartoBombasReferencia() {
  const [imgOk, setImgOk] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const imgWrapRef = useRef<HTMLDivElement>(null);

  const handleSelect = (n: number) => setSelected((prev) => (prev === n ? null : n));

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const applyTransform = () => {
    const el = imgWrapRef.current;
    if (!el) return;
    const s = scaleRef.current;
    const p = posRef.current;
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
    el.style.transformOrigin = 'center center';
  };

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const oldS = scaleRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    // 885x807 nativo → limitar a 2.6x para no pixelar (2.6× ≈ 2300px, más que suficiente sin pérdida visible)
    const ns = clamp(oldS * factor, 1, 2.6);
    if (ns === oldS) return;
    const ratio = ns / oldS;
    // zoom anclado al cursor con origen center (corrección W/2,H/2)
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    const nx = cx - hw - (cx - hw - posRef.current.x) * ratio;
    const ny = cy - hh - (cy - hh - posRef.current.y) * ratio;
    scaleRef.current = ns;
    const maxX = (rect.width * (ns - 1)) / 2 + 80;
    const maxY = (rect.height * (ns - 1)) / 2 + 80;
    posRef.current = { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
    if (ns === 1) posRef.current = { x: 0, y: 0 };
    applyTransform();
  }, []);

  const resetZoom = () => {
    scaleRef.current = 1;
    posRef.current = { x: 0, y: 0 };
    applyTransform();
  };

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(22, 30, 45);
      doc.text('CUARTO DE BOMBAS — REFERENCIA NFPA 20 / NSR-10 TÍTULO J', pageW / 2, 32, {
        align: 'center',
      });

      // imagen — fetch base64 y dibujar preservando proporción (sin estirar)
      let imgDrawH = 0;
      try {
        const res = await fetch('/cuarto-bombas-isometrico.webp');
        const blob = await res.blob();
        const imgData: string = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        // dimensiones reales para no deformar
        const dims: { w: number; h: number } = await new Promise((resolve) => {
          const im = new Image();
          im.onload = () => resolve({ w: im.naturalWidth || 885, h: im.naturalHeight || 807 });
          im.onerror = () => resolve({ w: 885, h: 807 });
          im.src = imgData;
        });
        const ratio = dims.w / dims.h;
        const maxW = pageW - 40;
        const maxH = 310;
        let drawW = maxW;
        let drawH = drawW / ratio;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * ratio;
        }
        const x = (pageW - drawW) / 2;
        const y = 42;
        doc.addImage(imgData, 'WEBP', x, y, drawW, drawH);
        imgDrawH = y + drawH;
      } catch {
        doc.setFontSize(10);
        doc.setTextColor(180, 0, 0);
        doc.text(
          'Imagen no disponible — coloque /public/cuarto-bombas-isometrico.webp',
          pageW / 2,
          200,
          { align: 'center' },
        );
      }

      // lista organizada en UNA sola tabla de 4 columnas (evita solape de dos tablas lado a lado)
      const head = [['#', 'COMPONENTE (1 — 13)', '#', 'COMPONENTE (14 — 26)']];
      const body = Array.from({ length: Math.max(TABLA_A.length, TABLA_B.length) }, (_, i) => {
        const a = TABLA_A[i];
        const b = TABLA_B[i];
        return [a ? String(a.n) : '', a ? a.txt : '', b ? String(b.n) : '', b ? b.txt : ''];
      });

      const startY = imgDrawH ? imgDrawH + 12 : 48;

      autoTable(doc, {
        startY,
        head,
        body,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2.5,
          font: 'helvetica',
          valign: 'middle',
          lineWidth: 0.4,
          lineColor: [203, 214, 226],
        },
        headStyles: {
          fillColor: [22, 27, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 26, halign: 'center', fontStyle: 'bold', fillColor: [254, 242, 242] },
          1: { cellWidth: (pageW - 40) / 2 - 26, halign: 'left' },
          2: { cellWidth: 26, halign: 'center', fontStyle: 'bold', fillColor: [239, 246, 255] },
          3: { cellWidth: (pageW - 40) / 2 - 26, halign: 'left' },
        },
        margin: { left: 20, right: 20 },
        tableWidth: pageW - 40,
      });

      const endY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ??
        startY + 200;
      if (endY < pageH - 20) {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'Fuente: esquema tipo NFPA 20 — disposición orientativa, validar con diseño hidráulico y normativa local.',
          pageW / 2,
          pageH - 14,
          { align: 'center' },
        );
      }

      doc.save('cuarto-bombas-referencia.pdf');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <style>{`@media (max-width: 1100px){.rci-ref-grid{grid-template-columns:1fr !important; height:auto !important}.rci-ref-root{height:auto !important; min-height:0 !important; overflow:visible !important}}`}</style>
      <div
        className="rci-ref-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'min(68vh, 720px)',
          minHeight: 520,
          overflow: 'hidden',
        }}
      >
        <div
          className="rci-ref-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '0.78fr 1.84fr 0.78fr',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <TablaCompact
            title="1 — 13  ·  Succión y descarga"
            items={TABLA_A}
            selected={selected}
            onSelect={handleSelect}
          />

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border, #2a3347)',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--panel, #161b27)',
                borderBottom: '1px solid var(--border, #2a3347)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'var(--txt2, #94a3b8)',
                }}
              >
                Vista isométrica — cuarto de bombas RCI
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--txt3, #64748b)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Rueda para zoom en el cursor
                </span>
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={downloading}
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--rci, #ef4444)',
                    background: downloading ? 'var(--line, #1e2535)' : 'var(--rci, #ef4444)',
                    color: '#fff',
                    cursor: downloading ? 'wait' : 'pointer',
                    opacity: downloading ? 0.7 : 1,
                  }}
                >
                  {downloading ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Restablecer zoom"
                  style={{
                    fontSize: 11,
                    padding: '3px 7px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #2a3347)',
                    background: 'var(--panel, #161b27)',
                    color: 'var(--txt2, #94a3b8)',
                    cursor: 'pointer',
                  }}
                >
                  ↺
                </button>
              </span>
            </div>

            <div
              ref={containerRef}
              onWheel={onWheel}
              style={{
                flex: 1,
                minHeight: 0,
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                overflow: 'hidden',
                position: 'relative',
                cursor: 'default',
              }}
            >
              {imgOk ? (
                <div
                  ref={imgWrapRef}
                  style={{
                    display: 'inline-block',
                    lineHeight: 0,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    transition: 'transform 80ms linear',
                  }}
                >
                  <img
                    src="/cuarto-bombas-isometrico.webp"
                    alt="Isométrico cuarto de bombas RCI — 26 componentes — NFPA 20"
                    onError={() => setImgOk(false)}
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '58vh',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      imageRendering: 'auto' as const,
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                    decoding="sync"
                    fetchPriority="high"
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: 8,
                    padding: 14,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>🖼️</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>
                    Coloca la imagen isométrica aquí
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    Guardá como{' '}
                    <code
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      public/cuarto-bombas-isometrico.webp
                    </code>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '5px 8px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                fontSize: 9,
                color: '#64748b',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: '#b03030',
                    display: 'inline-block',
                    border: '1px solid #7f1d1d',
                  }}
                />{' '}
                RCI
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: '#2f5fd0',
                    display: 'inline-block',
                    border: '1px solid #1e40af',
                  }}
                />{' '}
                Válvulas
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: '#f5d327',
                    display: 'inline-block',
                    border: '1px solid #a16207',
                  }}
                />{' '}
                Flujo
              </span>
            </div>
          </div>

          <TablaCompact
            title="14 — 26  ·  Control y auxiliares"
            items={TABLA_B}
            selected={selected}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </>
  );
}
