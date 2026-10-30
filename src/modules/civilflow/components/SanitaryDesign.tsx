/**
 * Pantalla de diseño de red sanitaria (orquestador): arma el modelo con useSanitaryRows y
 * pinta la tarjeta con su cabecera (SanitaryHeader) y su tabla de chequeo (SanitaryTables).
 * El cálculo hidráulico vive en el hook; aquí queda el estado de edición de la pantalla.
 * Ej: activo "editar" y escribo pendiente 2% en RS1 -> la tabla escribe el valor al dibujo.
 */
import { useState } from 'react';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { useTramos } from '../context/TramosContext.tsx';
import { useApparatus } from '../context/ApparatusContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { useProyecto } from '../context/ProjectContext.tsx';
import SanitaryHeader from './sanitary/SanitaryHeader.tsx';
import SanitaryTables from './sanitary/SanitaryTables.tsx';
import { useSanitaryRows } from './sanitary/useSanitaryRows.ts';

export default function DisenosSanitarios() {
  const { proy } = useProyecto();
  const [edit, setEdit] = useState(false);
  const tablaRef = useStickyThead2Offset();
  const [editingPend, setEditingPend] = useState<Record<string, string>>({});
  const [editingNSalidas, setEditingNSalidas] = useState<Record<string, string>>({});
  const { tramosSan, updTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const {
    displayTramos,
    conexionesDisplay,
    componentTotalMap,
    totalUD,
    sanRows,
    keyToLabel,
    handleDiamChange,
  } = useSanitaryRows({
    pais: proy.pais,
    tramosSan,
    aps,
    plans,
    updTramoSan,
  });

  return (
    <>
      <section className="card">
        <SanitaryHeader
          cantTramos={displayTramos.length}
          totalUD={totalUD}
          edit={edit}
          setEdit={setEdit}
        />
        <SanitaryTables
          tablaRef={tablaRef}
          pais={proy.pais}
          displayTramos={displayTramos}
          sanRows={sanRows}
          conexionesDisplay={conexionesDisplay}
          componentTotalMap={componentTotalMap}
          keyToLabel={keyToLabel}
          edit={edit}
          editingPend={editingPend}
          setEditingPend={setEditingPend}
          editingNSalidas={editingNSalidas}
          setEditingNSalidas={setEditingNSalidas}
          updTramoSan={updTramoSan}
          handleDiamChange={handleDiamChange}
          plans={plans}
        />
      </section>
    </>
  );
}
