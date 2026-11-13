/** Pestaña ENTRADAS del diseño RCI (Red Contra Incendio): el formulario del HTML de referencia
 *  en 9 sub-pestañas verticales (SubTabsRci), cada grupo de campos en SU tarjeta GrupoTabla
 *  (section.card con tabla tbl y botón EDITAR propio arriba a la derecha — cada tabla se edita
 *  sola, sin EDITAR global). Cada fila: etiqueta (con la ayuda al pasar el mouse), control con
 *  data-campo para «Ir al dato», unidad, chip de naturaleza (TAGS_RCI del HTML) y la OBSERVACIÓN
 *  siempre visible (la ayuda del campo; los defs viven en RCIInputDefs.ts). Las deps (p. ej.
 *  local.exigeSP) siguen deshabilitando campos encima del flag de edición. Ej: la sub 'tuberia'
 *  muestra los 5 campos de tubería/mangueras junto a la tabla de C por material, con el catálogo
 *  de accesorios especiales debajo. */
import { useEffect, useState } from 'react';
import { SubTabsRci, useNavRci, type RciCtx, type SubItemRci } from './RCIUI.tsx';
import { GrupoTabla } from './RCIGroupTable.tsx';
import { GRUPOS, ICONO_SUB, NOTA_SUB, notaDeps } from './RCIInputDefs.ts';
import { SUBS_POR_TAB } from '../../utils/rci/RCIRowsModelExtras.ts';
import { TablaCmat } from './RCICmatTable.tsx';
import { TablaEsp } from './RCISpecialAccTable.tsx';
import { ModalClases } from './RCIClassesModal.tsx';
import { TablaCuarto } from './RCIRoomTable.tsx';

const SUB_POR_ID = new Map(SUBS_POR_TAB.entradas.map((s) => [s.id, s]));
/* ---------------- La pestaña ---------------- */

/** Pestaña ENTRADAS: sub-pestañas verticales (SUBS_POR_TAB['entradas']) + el grupo de campos
 *  activo; los badges de cada sub cuentan las verificaciones que apuntan a ese grupo. El modal
 *  «¿Qué clase elegir?» vive aquí y lo abre el botón de la celda Observación de la fila clase. */
export default function RciInputs({ ctx }: { ctx: RciCtx }) {
  const { estado, R, editar } = ctx;
  const nav = useNavRci();
  /** Preferencia local; la sub efectiva es la del contexto de navegación si «Ir al dato» o la
   *  guía la fijaron (nav.sub manda), y si no, la última que el usuario abrió aquí. */
  const [preferida, setPreferida] = useState('normativa');
  const sub = nav.sub && SUB_POR_ID.has(nav.sub) ? nav.sub : preferida;
  const elegir = (id: string) => {
    setPreferida(id);
    nav.irA('entradas', id);
  };

  const [clasesAbiertas, setClasesAbiertas] = useState(false);
  /* Escape cierra el modal (listener a nivel documento, patrón HelpPanel). */
  useEffect(() => {
    if (!clasesAbiertas) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setClasesAbiertas(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [clasesAbiertas]);
  /** Abre el modal pedido por la celda Observación de un campo (la clave d.abreModal). */
  const abrirModal = (clave: string): void => {
    if (clave === 'clases') setClasesAbiertas(true);
  };

  const items: SubItemRci[] = SUBS_POR_TAB.entradas.map((s) => ({ id: s.id, titulo: s.l }));

  return (
    <>
      <SubTabsRci subs={items} sub={sub} setSub={elegir}>
        {/* Contenido centrado en la sección (ped. usuario), EXCEPTO Tubería y mangueras:
         *  esa sub vuelve al alineado a la izquierda original (ped. usuario posterior). */}
        <section style={{ padding: '2px 0 0' }}>
          {sub === 'tuberia' ? (
            /* Tubería y mangueras AL LADO del coeficiente C de Hazen-Williams; el catálogo de
             * accesorios especiales, debajo. Sin centrar: como estaba antes (ped. usuario). */
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, max-content))',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <GrupoTabla
                  titulo={SUB_POR_ID.get(sub)?.l || sub}
                  nota={NOTA_SUB[sub]}
                  icono={ICONO_SUB[sub]}
                  campos={GRUPOS[sub] || []}
                  estado={estado}
                  R={R}
                  editar={editar}
                  onAbrirModal={abrirModal}
                  depNota={notaDeps(GRUPOS[sub] || [])}
                  compacta
                />
                <TablaCmat estado={estado} editar={editar} />
              </div>
              <div style={{ marginTop: 16 }}>
                <TablaEsp estado={estado} editar={editar} />
              </div>
            </>
          ) : sub === 'montantes' ? (
            /* Montantes NFPA 14 solo: la ayuda «¿Qué clase elegir?» salió de la tarjeta y vive
             * en el MODAL que abre la celda Observación de la fila Clase de sistema. */
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GrupoTabla
                titulo={SUB_POR_ID.get(sub)?.l || sub}
                nota={NOTA_SUB[sub]}
                icono={ICONO_SUB[sub]}
                campos={GRUPOS[sub] || []}
                estado={estado}
                R={R}
                editar={editar}
                onAbrirModal={abrirModal}
                depNota={notaDeps(GRUPOS[sub] || [])}
              />
            </div>
          ) : sub === 'seleccion' ? null : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GrupoTabla
                minAncho={
                  sub === 'normativa' || sub === 'succion'
                    ? 1800
                    : sub === 'montantes'
                      ? 1600
                      : sub === 'clasificacion'
                        ? 720
                        : undefined
                }
                titulo={SUB_POR_ID.get(sub)?.l || sub}
                nota={NOTA_SUB[sub]}
                icono={ICONO_SUB[sub]}
                campos={GRUPOS[sub] || []}
                estado={estado}
                R={R}
                editar={editar}
                onAbrirModal={abrirModal}
                depNota={notaDeps(GRUPOS[sub] || [])}
              />
            </div>
          )}
          {sub === 'seleccion' ? (
            /* Bomba: selección, y la tubería del cuarto de bombas DEBAJO. */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <GrupoTabla
                titulo={SUB_POR_ID.get(sub)?.l || sub}
                nota={NOTA_SUB[sub]}
                icono={ICONO_SUB[sub]}
                campos={GRUPOS[sub] || []}
                estado={estado}
                R={R}
                editar={editar}
                onAbrirModal={abrirModal}
                depNota={notaDeps(GRUPOS[sub] || [])}
              />
              <div style={{ marginTop: 16 }}>
                <TablaCuarto estado={estado} editar={editar} />
              </div>
            </div>
          ) : null}
        </section>
      </SubTabsRci>
      {clasesAbiertas ? <ModalClases cerrar={() => setClasesAbiertas(false)} /> : null}
    </>
  );
}
