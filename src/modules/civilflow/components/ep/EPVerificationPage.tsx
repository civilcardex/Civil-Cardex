/**
 * Página de verificación del ep (Equipo de Presión): orquesta los dos paneles de la verificación — params ("Cálculo hidráulico y potencia", tablas 8-12) y results ("Diámetros y especificación", tablas 13-15).
 * Ej: calcEpc arma la HMT (altura manométrica total) = alturas geométricas + pérdidas + presión mínima, y chequea NPSH (cavitación) disponible ≥ requerido.
 * El cálculo vive en epEngine.ts (memoizado aquí vía epAdapter porque alimenta ambos paneles) y el JSX en EPParamsPanel/EPResultsPanel — esta página solo reparte props.
 */
import React, { useMemo } from 'react';
import { type EPData } from './EPShared';
import EPParamsPanel from './EPParamsPanel.tsx';
import EPResultsPanel from './EPResultsPanel.tsx';
import { calcEpc } from './epAdapter.ts';
import { type EpUn } from './epUnidades.ts';

interface EPVerificationPageProps {
  section?: 'params' | 'results';
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
  /** Unidad de presentación (m.c.a./bar/psi/kPa) que viaja a los paneles. */
  unidad: EpUn;
}

export default function EPVerificationPage({
  section = 'results',
  ep,
  updEP,
  unidad,
}: EPVerificationPageProps) {
  // Cadena de cálculo completa (caudales, HMT, potencias, setpoints, diámetros) — alimenta
  // ambos paneles, por eso se memoiza aquí y viaja por props (antes vivía inline con memos sueltos).
  /* Motor (ped. 2026-11-19): control con variador real (setpoint/banda/β Boyle),
   *  Hf del cuarto método K, NPSH de red, aparato crítico con tabla de 3 niveles y
   *  materia con presión admisible + PSV. La unidad de trabajo convierte en la UI. */
  const calc = useMemo(() => calcEpc(ep), [ep]);

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
        unidad={unidad}
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
      unidad={unidad}
    />
  );
}
