const tablas = {
    name: 'Tablas y verificaciones',
    icon: 'table_chart',
    color: '#C9A227',
    sections: [
      {
        title: 'Manning — coeficientes n',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Material</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">n</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC sanitario</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PVC presión</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Hierro fundido</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Concreto</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Acero galvanizado</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.015</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Cobre</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.013</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Gres cerámico</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.010</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">PE</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">0.009</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones sanitarias',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Pendiente min (2–6")</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 2% (20 mm/m)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500 8.4.1</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Pendiente min (8"+ )</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.5% (5 mm/m)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500 8.4.1</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad mínima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.60 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 5.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Fuerza tractiva min</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.10 kg/m²</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Relleno sobre tubería</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 0.30 m</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones redes de agua',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima (rec.)</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 3.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima abs.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 5.00 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">RAS 2000</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión estática máx</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 50 m.c.a.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Presión dinámica mín</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 3.00 m.c.a.</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 1500</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Verificaciones red de gas',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Parámetro</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Condición</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Ref.</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&Delta;P máximo</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 9.81 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">Velocidad máxima</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 10 m/s</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. min en acometida</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&ge; 17 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">P. max interior</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">&le; 25 mbar</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">NTC 3728</td></tr>
          </tbody></table></div>
        ),
      },
      {
        title: 'Diámetros comerciales PVC RDE 11',
        body: (
          <div className="overflow-x-auto my-2"><table className="w-full text-[12px] font-mono border-collapse"><tbody>
            <tr><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">Nominal</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">DI (mm)</th><th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">DE (mm)</th></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">16.6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">21.3</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">¾"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">21.8</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">26.7</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">28.5</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">33.4</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1¼"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">37.1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">42.2</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">1½"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">43.6</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">48.3</td></tr>
            <tr><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">2"</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">56.1</td><td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">60.3</td></tr>
          </tbody></table></div>
        ),
      },
    ],
};

export default tablas;
