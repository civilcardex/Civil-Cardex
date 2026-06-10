export const SECCIONES = [
  { id: "ntc1500", titulo: "1. NTC 1500:2020", subt: "Código Colombiano de Fontanería", redes: ["af", "ac", "san"] },
  { id: "ras2000", titulo: "2. RAS 2000", subt: "Reglamento Técnico del Sector de Agua Potable y Saneamiento Básico — Título D", redes: ["san", "ll"] },
  { id: "ntc3728", titulo: "3. NTC 3728:2014", subt: "Instalaciones para suministro de gas domiciliario — Baja presión", redes: ["gas"] },
  { id: "nsr10", titulo: "4. NSR-10 Título J", subt: "Requisitos de protección contra incendio en edificaciones", redes: ["rci"] },
  { id: "nfpa13", titulo: "5. NFPA 13:2022", subt: "Standard for the Installation of Sprinkler Systems", redes: ["rci"] },
  { id: "ntc3096", titulo: "6. NTC 3096", subt: "Sistemas de tuberías plásticas — CPVC para conducción de fluidos a presión", redes: ["af", "ac"] },
  { id: "tablas", titulo: "7. Tablas de referencia rápida", subt: "Conversiones · Criterios críticos · Altitudes", redes: ["todos"] },
] as const;

export const NTC1500_DOTACIONES = [
  ["Vivienda estrato 1–2", "200 L/hab/día", "250 L/hab/día"],
  ["Vivienda estrato 3–4", "220 L/hab/día", "280 L/hab/día"],
  ["Vivienda estrato 5–6", "250 L/hab/día", "350 L/hab/día"],
  ["Comercial oficinas", "20 L/m²/día", "30 L/m²/día"],
  ["Comercial restaurante", "80 L/puesto/día", "120 L/puesto/día"],
  ["Industria ligera", "30 L/m²/día", "50 L/m²/día"],
  ["Educativo", "40 L/alumno/día", "60 L/alumno/día"],
  ["Hospitalario", "600 L/cama/día", "1200 L/cama/día"],
  ["Hoteles", "300 L/habitación/día", "500 L/habitación/día"],
] as const;

export const NTC1500_UC = [
  ["Lavamanos", "Lvm", 0.5, 0.5, 0.51, 5.63],
  ["Inodoro", "San", 2.2, "—", 0.71, 14.1],
  ["Sanitario fluxómetro", "San-F", 5.0, "—", 1.05, 14.1],
  ["Ducha", "Duc", 1.0, 1.0, 1.02, 5.63],
  ["Tina / bañera", "Tin", 1.0, 1.0, 0.51, 14.1],
  ["Lavaplatos doméstico", "Lvp", 1.0, 1.0, 0.51, 5.63],
  ["Lavadero", "Lvro", 0.75, 0.75, 0.51, 5.63],
  ["Lavadora doméstica", "Lvra", 1.0, "—", 0.51, 5.63],
  ["Orinal (sifón)", "Or", 0.5, "—", 0.51, 5.63],
  ["Orinal (fluxómetro)", "Or-F", 3.0, "—", 1.05, 14.1],
  ["Vertedero", "Vert", 0.5, "—", 0.51, 5.63],
  ["Bebedero", "Beb", 0.5, "—", 0.51, 5.63],
] as const;

export const NTC1500_HAZEN_C = [
  ["PVC presión (nuevo)", 150],
  ["CPVC RDE 11 (nuevo)", 150],
  ["Cobre rígido (nuevo)", 140],
  ["PP-R (nuevo)", 140],
  ["Hierro galvanizado", 120],
  ["Acero comercial", 120],
  ["Fierro fundido", 100],
] as const;

export const NTC1500_VELOCIDADES = [
  ["Mínima (evitar sedimentación)", "0,50 m/s"],
  ["Máxima recomendada", "2,50 m/s"],
  ["Máxima absoluta", "3,00 m/s"],
] as const;

export const NTC1500_UD = [
  ["Lavamanos", 2, "1½\"", "2\""],
  ["Sanitario con sifón", 4, "3\"", "3\""],
  ["Sanitario fluxómetro", 6, "3\"", "3\""],
  ["Ducha", 2, "1½\"", "2\""],
  ["Tina / bañera", 2, "1½\"", "2\""],
  ["Lavaplatos", 2, "1½\"", "2\""],
  ["Lavadero", 2, "1½\"", "2\""],
  ["Lavadora", 4, "2\"", "2\""],
  ["Orinal sifón", 2, "1½\"", "2\""],
  ["Vertedero", 3, "2\"", "2\""],
  ["Piso-sumidero 2\"", 1, "2\"", "2\""],
  ["Piso-sumidero 3\"", 2, "3\"", "3\""],
  ["Piso-sumidero 4\"", 3, "4\"", "4\""],
] as const;

export const NTC1500_PENDIENTES = [
  ["1½\" y 2\"", "2,0%", "2,5%"],
  ["3\"", "1,0%", "2,0%"],
  ["4\"", "1,0%", "1,5%"],
  ["6\"", "0,5%", "1,0%"],
  ["≥ 8\"", "0,3%", "0,5%"],
] as const;

export const NTC1500_CAPACIDAD = [
  ["1½", 3, 4, 8],
  ["2", 6, 10, 24],
  ["2½", 12, 20, 42],
  ["3", 20, 30, 60],
  ["4", 160, 240, 500],
  ["6", 620, 960, 1900],
  ["8", 1400, 2200, 3600],
] as const;

export const NTC1500_VENTILACION = [
  ["Diámetro mínimo tubería ventilación", "1½\"", "§9.2"],
  ["D mín no menor que", "Mitad del D ramal", "§9.2"],
  ["Prolongación sobre cubierta", "≥ 0,30 m", "§9.4"],
  ["Cuello de ganso obligatorio", "Sí", "§9.4"],
  ["Re-ventilación máx 1½\"", "1,20 m", "§9.5"],
  ["Re-ventilación máx 2\"", "1,80 m", "§9.5"],
  ["Re-ventilación máx 3\"", "3,00 m", "§9.5"],
  ["Re-ventilación máx 4\"", "3,60 m", "§9.5"],
] as const;

export const RAS2000_DOTACIONES = [
  ["Bajo", "100 L/hab/día", "150 L/hab/día"],
  ["Medio", "120 L/hab/día", "175 L/hab/día"],
  ["Medio alto", "150 L/hab/día", "200 L/hab/día"],
  ["Alto", "170 L/hab/día", "280 L/hab/día"],
] as const;

export const RAS2000_VELOCIDADES = [
  ["Mínima (auto-limpieza)", "0,45 m/s"],
  ["Máxima (evitar erosión)", "4,00 m/s"],
] as const;

export const RAS2000_LLENADO = [
  ["Máximo a Q diseño", "0,75"],
  ["Condición óptima", "0,60–0,70"],
] as const;

export const RAS2000_ESCORRENTIA = [
  ["Teja metálica / zinc", 0.85, 0.95],
  ["Losa concreto impermeable", 0.85, 0.95],
  ["Teja de barro / cerámica", 0.75, 0.85],
  ["Membrana asfáltica", 0.8, 0.9],
  ["Pavimento asfalto", 0.7, 0.85],
  ["Pavimento concreto", 0.7, 0.9],
  ["Grava / balasto", 0.35, 0.7],
  ["Cubierta verde extensiva", 0.2, 0.4],
  ["Jardín / zona verde", 0.1, 0.35],
  ["Piscina / espejo de agua", 1.0, 1.0],
] as const;

export const RAS2000_TR = [
  ["Cubierta residencial", 5],
  ["Cubierta comercial", 10],
  ["Cubierta industrial", 10],
  ["Vías urbanas menores", 5],
  ["Vías urbanas principales", "10–25"],
  ["Obras de infraestructura", "25–100"],
] as const;

export const NTC3728_PRESIONES = [
  ["Red baja presión (domiciliaria)", "17 mbar", "100 mbar"],
  ["Presión de operación típica", "20–25 mbar", "—"],
  ["Pérdida máxima admisible", "—", "9,81 mbar"],
] as const;

export const NTC3728_SIMULTANEIDAD = [
  ["1–2", 1.0],
  ["3–5", 0.8],
  ["6–10", 0.7],
  ["11–20", 0.6],
  ["> 20", 0.5],
] as const;

export const NTC3728_CAUDALES = [
  ["Quemador cocina (1 hornilla)", 0.34],
  ["Estufa 4 quemadores", 1.35],
  ["Estufa 6 quemadores", 1.8],
  ["Calentador 6 LPM", 1.11],
  ["Calentador 8 LPM", 1.4],
  ["Calentador 10 LPM", 1.98],
  ["Calentador 12 LPM", 2.32],
  ["Calentador 16 LPM", 3.0],
  ["Calentador 21 LPM", 4.35],
  ["Horno convencional", 1.15],
  ["Secadora de ropa", 1.4],
  ["Caldera residencial pequeña", 2.5],
] as const;

export const NSR10_CLASIFICACION = [
  ["A", "Vivienda unifamiliar / bifamiliar", "Casas, apartamentos"],
  ["B", "Vivienda multifamiliar", "Edificios residenciales ≥ 3 unidades"],
  ["C", "Comercio y servicios", "Tiendas, oficinas, bancos"],
  ["D", "Industrial", "Bodegas, fábricas"],
  ["E", "Educación", "Colegios, universidades"],
  ["F", "Institucional", "Hospitales, cárceles"],
  ["G", "Alta concentración", "Estadios, teatros, culto"],
] as const;

export const NSR10_ALTURA = [
  ["≤ 3 pisos", "Extintor portátil", "Extintor portátil", "Red húmeda"],
  ["4–9 pisos", "Extintor", "Red húmeda", "Red húmeda + RCI"],
  ["≥ 10 pisos", "Red húmeda + RCI", "RCI completo", "RCI completo"],
] as const;

export const NFPA13_RIESGOS = [
  ["Riesgo leve (RL)", "Baja combustibilidad", "Vivienda, oficinas, salas, iglesias"],
  ["Riesgo ordinario G1 (RO1)", "Combustibilidad media-baja", "Parking, salas mecánicas"],
  ["Riesgo ordinario G2 (RO2)", "Combustibilidad media", "Almacenes, manufactura ligera"],
  ["Riesgo extra G1 (RE1)", "Alta combustibilidad", "Pintura, carpintería"],
  ["Riesgo extra G2 (RE2)", "Muy alta combustibilidad", "Químicos, almacenaje palets"],
] as const;

export const NFPA13_DENSIDADES = [
  ["Riesgo leve", 0.1, 139.4],
  ["Riesgo ordinario G1", 0.15, 139.4],
  ["Riesgo ordinario G2", 0.2, 139.4],
  ["Riesgo extra G1", 0.3, 232.3],
  ["Riesgo extra G2", "0,40–0,60", 232.3],
] as const;

export const NFPA13_ROCIADORES = [
  ["Presión mínima de operación", "7,0 PSI (4,92 mca)"],
  ["Presión máxima de operación", "175 PSI (123 mca)"],
  ["K-factor rociador QR estándar", "5,6 gpm/√PSI"],
  ["K-factor rociador QR ampliada", "8,0 gpm/√PSI"],
  ["Temperatura nominal estándar", "68°C (color rojo)"],
  ["Separación mínima entre rociadores", "1,80 m"],
  ["Separación máxima entre rociadores", "4,60 m (RL) · 4,00 m (RO)"],
  ["Distancia máxima a pared", "2,30 m (RL)"],
] as const;

export const NTC3096_PARAMS = [
  ["Temperatura máxima de servicio", "93°C"],
  ["Presión máxima de servicio", "100 PSI (70 mca) a 23°C"],
  ["Coeficiente de expansión térmica", "6,3 × 10⁻⁵ m/m·°C"],
  ["C Hazen-Williams", "150"],
  ["Aislamiento térmico obligatorio", "Sí, en trayectos expuestos"],
  ["Tipo de unión", "Solvente (cemento CPVC)"],
] as const;

export const TABLAS_PRESION = [
  ["1 m.c.a.", 1.0, 0.0981, 1.4223, 9.807, 98.07],
  ["1 bar", 10.2, 1.0, 14.504, 100.0, 1000],
  ["1 PSI", 0.7031, 0.06895, 1.0, 6.895, 68.95],
  ["1 kPa", 0.102, 0.01, 0.145, 1.0, 10.0],
  ["1 mbar", 0.0102, 0.001, 0.0145, 0.1, 1.0],
] as const;

export const TABLAS_CAUDALES = [
  ["1 lps", 1.0, 60.0, 3.6, 15.85],
  ["1 lpm", 0.01667, 1.0, 0.06, 0.2642],
  ["1 m³/hr", 0.2778, 16.67, 1.0, 4.403],
  ["1 gpm", 0.06309, 3.785, 0.2271, 1.0],
] as const;

export const TABLAS_CRITERIOS = [
  ["AF / AC", "V mínima", "≥ 0,50 m/s", "NTC 1500 §5.4"],
  ["AF / AC", "V máxima", "≤ 2,50 m/s", "NTC 1500 §5.4"],
  ["AF / AC", "P mínima inodoro", "≥ 0,71 mca", "NTC 1500 Tabla 3"],
  ["AF / AC", "P mínima ducha", "≥ 1,02 mca", "NTC 1500 Tabla 3"],
  ["AF / AC", "P mínima lavamanos", "≥ 0,51 mca", "NTC 1500 Tabla 3"],
  ["AF / AC", "P máxima cualquier punto", "≤ 14,10 mca", "NTC 1500 Tabla 3"],
  ["SAN", "V mínima (auto-limpieza)", "≥ 0,45 m/s", "RAS 2000 §D.4.3"],
  ["SAN", "V máxima", "≤ 4,00 m/s", "RAS 2000 §D.4.3"],
  ["SAN", "Llenado máximo y/D", "≤ 0,75", "RAS 2000 §D.4.3"],
  ["SAN", "Pendiente mínima D ≥ 2\"", "≥ 2,0%", "NTC 1500 §8.3"],
  ["LL", "Método", "Q = C×I×A/360.000", "RAS 2000 §D.2"],
  ["LL", "Período retorno cubierta", "Tr = 5 años", "RAS 2000 Tab. D.2.2"],
  ["GAS", "ΔP máximo acumulado", "≤ 9,81 mbar", "NTC 3728 §6.2"],
  ["GAS", "Velocidad máxima", "≤ 10 m/s", "NTC 3728 §6.3"],
  ["VEN", "D mínimo", "≥ 1½\"", "NTC 1500 §9.2"],
  ["VEN", "Prolongación sobre cubierta", "≥ 0,30 m", "NTC 1500 §9.4"],
  ["RCI", "P mínima rociador", "≥ 7,0 PSI", "NFPA 13 §7.2.1.1"],
  ["RCI", "V máxima tubería", "≤ 8,0 m/s", "NFPA 13 §28.2"],
  ["RCI", "C HW acero SCH 40", "120", "NFPA 13 §28.2.1"],
  ["RCI", "Densidad Riesgo leve", "0,10 gpm/pie²", "NFPA 13 §11.2.3.1.1"],
  ["RCI", "Duración suministro RL", "30 min", "NFPA 13 §11.2.3.1.3"],
] as const;

export const TABLAS_ALTITUDES = [
  ["Bogotá D.C.", 2600, 74.7, 0.793],
  ["Medellín", 1495, 85.58, 0.905],
  ["Cali", 995, 90.49, 0.958],
  ["Bucaramanga", 959, 90.32, 0.956],
  ["Floridablanca", 924, 90.67, 0.96],
  ["Barranquilla", 18, 101.15, 1.071],
  ["Cúcuta", 320, 98.0, 1.038],
  ["Manizales", 2153, 79.32, 0.84],
  ["Pereira", 1411, 86.4, 0.915],
  ["Ibagué", 1285, 87.63, 0.928],
  ["Pasto", 2527, 75.43, 0.799],
  ["Cartagena", 3, 101.2, 1.072],
] as const;
