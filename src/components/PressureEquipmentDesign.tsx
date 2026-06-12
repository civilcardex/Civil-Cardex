import React, { useState } from "react";
import { useEP } from "../context/EPContext";
import PageNav from "./PageNav";
import EPInputPage from "./ep/EPInputPage";
import EPVerificationPage from "./ep/EPVerificationPage";

const PressureEquipmentDesign = React.memo(function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);

  const pages = [
    { t: "Datos de entrada", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: <EPInputPage /> },
    { t: "Parámetros del equipo", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: <EPVerificationPage section="params" /> },
    { t: "Resultados y Resumen", icon: "/iconos_diseno_redes/datos_de_entrada.webp", c: <EPVerificationPage section="results" /> },
  ];

  return (
    <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      <PageNav page={page} setPage={setPage} total={3} color="var(--ep)" labels={["Datos de entrada", "Parámetros", "Resultados"]} />
      <div style={{ flex: 1, padding: 6, overflow: "auto" }}>
        {pages[page - 1].c}
      </div>
    </div>
  );
});
export default PressureEquipmentDesign;
