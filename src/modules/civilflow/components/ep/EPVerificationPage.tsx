/**
 * Página de verificación del ep (Equipo de Presión): orquesta los dos paneles de la verificación — params ("Cálculo hidráulico y potencia", tablas 8-12) y results ("Diámetros y especificación", tablas 13-15).
 * Ej: calcularCisterna arma la HMT (altura manométrica total) = alturas geométricas + pérdidas + presión mínima, y chequea NPSH (cavitación) disponible ≥ requerido.
 * El cálculo vive en epCalcs.calcularEp (memoizado aquí porque alimenta ambos paneles) y el JSX en EPParamsPanel/EPResultsPanel — esta página solo reparte props.
 */
import React, { useMemo } from 'react';
import { type EPData } from './EPShared';
import EPParamsPanel from './EPParamsPanel.tsx';
import EPResultsPanel from './EPResultsPanel.tsx';
import { calcularEp } from './epCalcs.ts';

interface EPVerificationPageProps {
  section?: 'params' | 'results';
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

export default function EPVerificationPage({
  section = 'results',
  ep,
  updEP,
}: EPVerificationPageProps) {
  // Cadena de cálculo completa (caudales, HMT, potencias, setpoints, diámetros) — alimenta
  // ambos paneles, por eso se memoiza aquí y viaja por props (antes vivía inline con memos sueltos).
  const calc = useMemo(() => calcularEp(ep), [ep]);

  const [editParams, setEditParams] = React.useState(false);
  const [editPComercial, setEditPComercial] = React.useState(false);
  const [editDiametros, setEditDiametros] = React.useState(false);

  if (section === 'params') {
    return (
      <EPParamsPanel
        ep={ep}
        updEP={updEP}
        calc={calc}
        editParams={editParams}
        setEditParams={setEditParams}
        editPComercial={editPComercial}
        setEditPComercial={setEditPComercial}
      />
    );
  }
  return (
    <EPResultsPanel
      ep={ep}
      updEP={updEP}
      calc={calc}
      editDiametros={editDiametros}
      setEditDiametros={setEditDiametros}
    />
  );
}
