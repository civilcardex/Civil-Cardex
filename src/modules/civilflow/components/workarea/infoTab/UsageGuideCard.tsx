import React from "react";

const UsageGuideCard = React.memo(function UsageGuideCard() {
  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_civilflow/info_general/guia_de_uso.webp" alt="Guía de uso"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Guía de uso
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>Recomendaciones</span>
        </div>
      </div>
      <div style={{ padding: '4px 8px', fontSize: 11, lineHeight: 1.6, color: 'var(--txt2)' }}>
        <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', fontWeight: 600 }}>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Complete los datos del proyecto con la información de la memoria de cálculo.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Active las redes que requiere el diseño según el uso del edificio.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Configure la cantidad de pisos y sótanos, luego pulse <strong>"Generar niveles automáticamente"</strong>.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Verifique los NPT generados y ajústelos si es necesario.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Vaya a la pestaña <strong>Diseño de Redes y Equipos</strong> para iniciar el cálculo hidráulico de cada red activa.</li>
        </ol>
      </div>
    </section>
  );
});

export default UsageGuideCard;
