import {  useState  } from 'react';
import { EPProvider } from "../context/EPContext";
import PageNav from "./PageNav";
import EPInputPage from "./ep/EPInputPage";
import EPVerificationPage from "./ep/EPVerificationPage";

const PressureEquipmentDesign_pages = [
  { t: "Datos de entrada", icon: "/iconos_diseno_redes/general/datos_de_entrada.webp", c: <EPInputPage /> },
  { t: "Cálculo hidráulico y potencia", icon: "/iconos_diseno_redes/general/datos_de_entrada.webp", c: <EPVerificationPage section="params" /> },
  { t: "Diámetros y especificación", icon: "/iconos_diseno_redes/general/datos_de_entrada.webp", c: <EPVerificationPage section="results" /> },
];

const EPContent = function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);

  const pages = PressureEquipmentDesign_pages;

  return (
    <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
      <PageNav page={page} setPage={setPage} total={3} color="var(--ep)" labels={["Datos de entrada", "Cálculo hidráulico y potencia", "Diámetros y especificación"]} />
      <div style={{ flex: 1, padding: 6, overflow: "auto" }}>
        {pages[page - 1].c}
      </div>
    </div>
  );
};

export default function PressureEquipmentDesign() {
  return (
    <EPProvider>
      <EPContent />
    </EPProvider>
  );
}
