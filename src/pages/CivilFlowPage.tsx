import React from 'react';
import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

const features = [
  { icon: 'speed', color: '#00dce5', title: 'Cálculo Hidráulico en Tiempo Real', desc: 'Análisis nodal instantáneo para redes presurizadas. Visualización de pérdida de carga y velocidades críticas durante la fase de diseño iterativo.', badge: 'STATUS: ACTIVE_SIM', badgeColor: '#79ff5b' },
  { icon: 'mode_fan', color: '#ffb4ab', title: 'Modelado de Gas de Alta Presión', desc: 'Módulos específicos para termodinámica de gases compresibles. Ruteo inteligente de tuberías considerando normativas de distanciamiento.', badge: 'PRESSURE: >100_BAR', badgeColor: '#ffb4ab' },
  { icon: 'public', color: '#ffdad2', title: 'Exportación Nativa a Google Earth Pro', desc: 'Generación automática de archivos KML/KMZ con metadatos incrustados, topología de red completa y simbología estandarizada.', badge: null, badgeColor: null },
];

const normas = ['ISO 14224 (Confiabilidad)', 'ASTM D2513 (Termoplásticos)', 'AWWA M45 (Fibra de Vidrio)'];

const specs = [
  { param: 'Método de Cálculo', hid: 'Hazen-Williams / Darcy', san: 'Manning', gas: 'Weymouth / Panhandle' },
  { param: 'Análisis Transitorio', hid: 'Golpe de Ariete (Soportado)', san: 'N/A', gas: 'Despresurización' },
  { param: 'Integración GIS', hid: 'Shapefile, KML, GeoJSON', san: 'Shapefile, KML', gas: 'KML (Alta Precisión)' },
];

export default function CivilFlowPage() {
  usePageMeta('CivilFlow');
  return (
    <ModulePageLayout title="CivilFlow" description="Diseño, análisis y optimización de redes hidráulicas, sanitarias y de gas. Integre flujos de trabajo de ingeniería de alta precisión directamente con modelos de terreno KML.">
      <section className="relative w-full overflow-hidden border-b border-outline-variant" style={{ minHeight: 500, background: '#1a1c20' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #111317 0%, rgba(17,19,23,0) 100%)' }} />
          <div className="relative z-10 px-6 lg:px-8 py-20 max-w-5xl mx-auto flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <img src="/logos/civilFlowlogo.webp" alt="CivilFlow" className="h-8 w-8 object-contain" />
              <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Módulo Principal</span>
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-[44px] leading-tight font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              CivilFlow: Redes de Fluidos con Precisión KML
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl leading-relaxed">
              Diseño, análisis y optimización de redes hidráulicas, sanitarias y de gas. Integre flujos de trabajo de ingeniería de alta precisión directamente con modelos de terreno KML.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="hidden md:inline-block px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold text-on-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: '#00dce5', boxShadow: '0 0 15px rgba(0,220,229,0.3)' }}>
                Explorar Funciones
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.5)' }}>
                Ver Documentación
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-8">
            <h2 className="text-xl font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>CAPACIDADES TÉCNICAS</h2>
            <span className="text-[13px] text-outline" style={{ fontFamily: 'Geist, monospace' }}>SYS.V_2.4.1</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <div key={i} className="border border-outline-variant p-6 flex flex-col gap-4 hover:border-primary transition-all group" style={{ background: '#1e2024' }}>
                <div className="flex items-center justify-center w-10 h-10 border" style={{ borderColor: f.color + '33', background: f.color + '11' }}>
                  <span className="material-symbols-outlined" style={{ color: f.color, fontSize: 20 }}>{f.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                <p className="text-sm text-on-surface-variant flex-grow">{f.desc}</p>
                {f.badge && (
                  <div className="text-[13px] mt-2 px-2 py-1 w-fit border" style={{ fontFamily: 'Geist, monospace', color: f.badgeColor, background: f.badgeColor + '10', borderColor: f.badgeColor + '30' }}>
                    {f.badge}
                  </div>
                )}
              </div>
            ))}
          </div>
          {features[2] && (
            <div className="mt-6 border-t border-outline-variant pt-6">
              <h4 className="text-[11px] tracking-[0.08em] font-bold text-on-surface mb-3 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Cumplimiento Normativo</h4>
              <ul className="flex flex-col gap-2">
                {normas.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>
                    <span className="material-symbols-outlined text-primary text-sm">check_circle</span> {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="py-12 px-6 lg:px-8 max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-on-surface border-b border-outline-variant pb-4 mb-6" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>ESPECIFICACIONES DEL MÓDULO</h2>
          <div className="border border-outline-variant overflow-auto" style={{ background: '#1e2024' }}>
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="border-b border-outline-variant" style={{ background: '#282a2e' }}>
                <tr>
                  <th className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Parámetro</th>
                  <th className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Red Hidráulica</th>
                  <th className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Saneamiento</th>
                  <th className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Red de Gas</th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                {specs.map((s, i) => (
                  <tr key={i} className="border-b border-outline-variant/50 hover:bg-surface-container-highest transition-colors">
                    <td className="p-4 text-[13px]" style={{ fontFamily: 'Geist, monospace' }}>{s.param}</td>
                    <td className="p-4">{s.hid}</td>
                    <td className="p-4">{s.san}</td>
                    <td className="p-4">{s.gas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="py-16 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 border border-outline-variant p-6 md:p-8" style={{ background: '#282a2e' }}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00f5ff' }} />
                <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00f5ff' }}>SISTEMA ONLINE</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Validación de Datos en su Propio Terreno</h2>
              <p className="text-sm text-on-surface-variant">Solicite acceso a nuestro entorno de pruebas sandbox. Suba un KML de muestra y experimente el ruteo automático y cálculo de presiones en tiempo real.</p>
              <div className="flex gap-4 mt-2">
                <input className="px-4 py-3 flex-grow outline-none text-on-surface border-b border-outline-variant focus:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace', fontSize: 13, background: '#0A0C0E' }} placeholder="INGRESAR_CORREO_CORPORATIVO" type="email" />
                <button className="px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold text-on-primary flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: '#00f5ff' }}>
                  Solicitar Demo <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
            <div className="hidden md:flex justify-end opacity-50">
              <div className="w-64 h-64 border border-outline-variant rounded-full flex items-center justify-center relative">
                <div className="w-48 h-48 border border-primary/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute w-32 h-32 border border-secondary/20 rounded-full" />
                <span className="material-symbols-outlined text-4xl text-outline-variant absolute">hub</span>
              </div>
            </div>
          </div>
        </section>
    </ModulePageLayout>
  );
}
