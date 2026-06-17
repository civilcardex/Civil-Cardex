import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePlans } from '../context/PlansContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePlanoFileUpload } from '../hooks/usePlanoFileUpload';
import { REQ_ITEMS } from '../constants';

function PlansPage() {
  const { plans, addPlans, removePlan } = usePlans();
  const navigate = useNavigate();
  usePageMeta('Planos', 'Carga y gestión de planos PDF para diseño hidrosanitario. Calibración, niveles y visualización de redes sobre plano.');

  const onFiles = useCallback((files: FileList) => addPlans(files), [addPlans]);
  const { drag, setDrag, fileRef, onDrop, handleFileInput } = usePlanoFileUpload(onFiles);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e14', color: '#e2e2e8' }}>
      <style>{`
        .plano-drop {
          border: 2px dashed #3a494a;
          transition: all 0.2s;
          cursor: pointer;
        }
        .plano-drop:hover, .plano-drop.drag {
          border-color: #00dce5;
          background: rgba(0,220,229,0.04);
        }
        .plano-row {
          transition: background 0.15s;
        }
        .plano-row:hover {
          background: rgba(0,220,229,0.04);
        }
      `}</style>

      <Navbar />

      <div className="flex-1 pt-16 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto py-10">

          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-grow" style={{ background: '#3a494a' }} />
            <h1 className="text-xl font-semibold uppercase tracking-widest px-4"
              style={{ color: '#e8f4fd', fontFamily: 'Hanken Grotesk, sans-serif' }}>
              📐 Carga de Planos
            </h1>
            <div className="h-px flex-grow" style={{ background: '#3a494a' }} />
          </div>

          <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={handleFileInput} />

          <div className={`plano-drop rounded-lg p-8 text-center mb-6 ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}>
            <div className="text-4xl mb-3">📐</div>
            <div className="text-sm font-bold uppercase tracking-widest mb-1"
              style={{ color: '#e8f4fd', fontFamily: 'Geist, monospace' }}>
              SUBIR PLANOS PDF
            </div>
            <div className="text-xs" style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
              Arrastra archivos aquí o haz clic para seleccionar · Solo PDF
            </div>
          </div>

          {plans.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-6"
              style={{ borderColor: '#3a494a', background: '#111317' }}>
              <div className="px-5 py-3 border-b flex items-center justify-between"
                style={{ borderColor: '#3a494a', background: '#1A1D23' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
                  Planos cargados ({plans.length})
                </span>
                <button onClick={() => fileRef.current?.click()}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 border rounded transition-colors"
                  style={{ color: '#00dce5', borderColor: '#00dce544', fontFamily: 'Geist, monospace' }}>
                  + Agregar más
                </button>
              </div>
              {plans.map(p => (
                <div key={p.id} className="plano-row flex items-center justify-between px-5 py-3 border-b last:border-b-0"
                  style={{ borderColor: '#3a494a22' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm flex-shrink-0" style={{ color: '#00dce5' }}>📄</span>
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: '#e8f4fd', fontFamily: 'Geist, monospace' }}>
                        {p.name}
                      </div>
                      <div className="text-[10px]" style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
                        {(p.file.size<1024?p.file.size+' B':p.file.size<1048576?(p.file.size/1024).toFixed(1)+' KB':(p.file.size/1048576).toFixed(1)+' MB')}
                      </div>
                    </div>
                  </div>
                   <button onClick={() => removePlan(p.id)}
                    className="material-symbols-outlined text-lg flex-shrink-0 transition-colors hover:text-red-400"
                    style={{ color: '#6b8cae' }}>
                    close
                  </button>
                </div>
              ))}
            </div>
          )}

          {plans.length > 0 && (
            <button onClick={() => navigate('/visor')}
              className="w-full h-14 font-bold text-[11px] tracking-widest uppercase transition-all border rounded-lg flex items-center justify-center gap-3"
              style={{
                background: 'rgba(0,220,229,0.08)',
                borderColor: '#00dce555',
                color: '#00dce5',
                fontFamily: 'Geist, monospace',
                boxShadow: '0 0 20px rgba(0,220,229,0.1)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 30px rgba(0,220,229,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,220,229,0.1)'}>
              ÁREA DE TRABAJO
            </button>
          )}

          {plans.length === 0 && (
            <div className="border rounded-lg overflow-hidden"
              style={{ borderColor: '#3a494a', background: '#111317' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: '#3a494a', background: '#1A1D23' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>
                  📋 Requisitos del plano
                </span>
              </div>
              <div className="p-5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {REQ_ITEMS.map(({ ico, t, s }) => (
                  <div key={t}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px',
                      background: '#0a0e14', borderRadius: 6, border: '1px solid #3a494a' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ico}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e8f4fd', fontFamily: 'Geist, monospace' }}>{t}</div>
                      <div style={{ fontSize: 10, color: '#6b8cae', fontFamily: 'Geist, monospace' }}>{s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlansPage;
