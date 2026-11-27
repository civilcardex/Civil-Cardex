/** Resume el recorrido de CivilFlow desde la identificación hasta la descarga de informes. */
import React from 'react';

const UsageGuideCard = React.memo(function UsageGuideCard() {
  return (
    <section className="card cf-info-guide">
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-t" style={{ fontSize: 13 }}>
            <img
              src="/iconos_civilflow/info_general/guia_de_uso.webp"
              alt=""
              width={22}
              height={22}
              style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }}
              loading="lazy"
            />
            Guía de uso
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            Del proyecto a los informes
          </span>
        </div>
      </div>
      <div className="cf-info-guide-body">
        <ol>
          <li>
            <strong>Identifica el proyecto.</strong> Completa el nombre, el país, el uso y la
            ubicación del edificio.
          </li>
          <li>
            <strong>Configura redes y equipos.</strong> Activa los que necesites y revisa los
            materiales y profundidades en Parámetros de diseño.
            <p className="cf-info-guide-note">
              <strong>2.1. Contra incendio: primero Diseño de redes, después Dibujo.</strong> Abre
              Contra incendio y define el riesgo y el sistema antes de trazar.
            </p>
          </li>
          <li>
            <strong>Genera los niveles.</strong> Define pisos, sótanos y cubierta. Compara alturas y
            cotas con los planos de arquitectura.
          </li>
          <li>
            <strong>Carga y calibra los planos.</strong> Sube uno o varios PDF, asígnalos a sus
            niveles y comprueba la escala con una distancia conocida.
          </li>
          <li>
            <strong>Dibuja las redes.</strong> Traza cada red sobre su plano y conecta tuberías y
            aparatos.
          </li>
          <li>
            <strong>Calcula y verifica.</strong> En Diseño de redes y equipos, revisa los cálculos y
            corrige los incumplimientos.
          </li>
          <li>
            <strong>Revisa la isometría.</strong> Comprueba recorridos y conexiones entre pisos.
          </li>
          <li>
            <strong>Genera los informes.</strong> En Informes, revisa el resumen y descarga las
            memorias de cálculo y los planos.
          </li>
        </ol>
      </div>
    </section>
  );
});

export default UsageGuideCard;
