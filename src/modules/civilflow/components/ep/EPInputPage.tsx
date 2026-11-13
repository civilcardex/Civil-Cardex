/** Página 1 del diseño de ep (Equipo de Presión): entrada de datos (acometida, aparatos,
 *  presiones mínimas) que alimenta el cálculo del sistema. Ej: marcar «tanque hidroneumático»
 *  -> el dimensionamiento de bom (Bomba) cambia de doctrina. */
import React, { useState } from 'react';
import type { EPData } from './EPShared';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { LazyInp, Param, Comment } from './EPShared';
import { dec } from '../../utils/parseDecimal.ts';

interface EPInputPageProps {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
}

function EPInputPage({ ep, updEP }: EPInputPageProps) {
  const qac = dec(ep.qac),
    qasc = dec(ep.qasc);
  const nt = dec(ep.nt) || 1,
    nr = dec(ep.nr);
  const isRed = ep.modo === 'red';

  const ntot = nt + nr;
  const Qd = Math.max(qac, qasc);
  const Qb = nt > 0 ? Qd / nt : Qd;

  const [editCaudales, setEditCaudales] = useState(false);
  const [editPresiones, setEditPresiones] = useState(false);
  const [editPerdidas, setEditPerdidas] = useState(false);
  const [editBombas, setEditBombas] = useState(false);

  return (
    <div className="flex-col-6 flex-1 min-h-0">
      <div className="flex-row-6 justify-start">
        <button
          type="button"
          onClick={() => updEP('modo', 'red')}
          className="ep-modo-btn"
          data-on={isRed ? 'true' : 'false'}
          data-modo="red"
        >
          <img
            src="/iconos_civilflow/diseno_redes/equipos/succion_red.webp"
            alt="Succión directa"
            width={22}
            height={22}
            className="card-icon-22"
            loading="lazy"
          />{' '}
          Succión directa (red)
        </button>
        <button
          type="button"
          onClick={() => updEP('modo', 'cisterna')}
          className="ep-modo-btn"
          data-on={!isRed ? 'true' : 'false'}
          data-modo="cisterna"
        >
          <img
            src="/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp"
            alt="Succión cisterna"
            width={22}
            height={22}
            className="card-icon-22"
            loading="lazy"
          />{' '}
          Succión cisterna
        </button>
      </div>

      {/* Flujo de lectura: 1 arriba-izq, 2 debajo, 3 arriba-der, 4 debajo-der. */}
      <div className="ep-grid-2">
        <div className="flex-col-8">
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/caudales_diseno.webp"
            iconClassName="card-icon-22"
            title="1. Caudales de diseño"
            bodyClassName="card-b-p0"
            headerRight={<EditButton edit={editCaudales} setEdit={setEditCaudales} />}
          >
            <Tbl
              caption="Caudales de diseño"
              thClassName="tbl-th-11"
              tdClassName="tbl-td-12"
              tdlClassName="tbl-tdl-13"
              cols={['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia']}
              rows={[
                [
                  <Param name="Caudal diseño AF" sub="Red agua fría" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editCaudales}
                    field="qac"
                    ariaLabel="Caudal diseño AF"
                  />,
                  'L/s',
                  <Comment>
                    <span className="ep-note-600">Hunter / RAS 2000</span> · Caudal probable de la
                    red de agua fría. Obtenido del diseño hidráulico.
                  </Comment>,
                ],
                [
                  <Param name="Caudal diseño ACS" sub="Red agua caliente" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editCaudales}
                    field="qasc"
                    ariaLabel="Caudal diseño ACS"
                  />,
                  'L/s',
                  <Comment>
                    <span className="ep-note-600">Hunter / RAS 2000</span> · Típico 60–70% del Qac.
                    Del diseño de red ACS.
                  </Comment>,
                ],
              ]}
            />
          </Card>
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/perdidas_de_carga.webp"
            iconClassName="card-icon-22"
            title="2. Pérdidas de carga"
            bodyClassName="card-b-p0"
            headerRight={<EditButton edit={editPerdidas} setEdit={setEditPerdidas} />}
          >
            <Tbl
              caption="Pérdidas de carga"
              thClassName="tbl-th-11"
              tdClassName="tbl-td-12"
              tdlClassName="tbl-tdl-13"
              cols={['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia']}
              rows={[
                [
                  <Param name="Pérdidas red AF" sub="Tramos + accesorios" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPerdidas}
                    field="hfac"
                    ariaLabel="Pérdidas red AF"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Darcy-Weisbach</span> · Sumatoria pérdidas tramo
                    más desfavorable de la red AC.
                  </Comment>,
                ],
                [
                  <Param name="Pérdidas red ACS" sub="Tramos + accesorios" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPerdidas}
                    field="hfacs"
                    ariaLabel="Pérdidas red ACS"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Darcy-Weisbach</span> · El módulo usa MAX(Hf_ac,
                    Hf_acs) como pérdida crítica de diseño.
                  </Comment>,
                ],
                [
                  <Param name="Pérdidas adicionales" sub="Intercambiador, filtros, zonas" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPerdidas}
                    field="hfotros"
                    ariaLabel="Pérdidas adicionales"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Opcional</span> · Calentador, filtros multimedia,
                    válvulas de zona u otros no incluidos en el diseño de redes.
                  </Comment>,
                ],
              ]}
            />
          </Card>
        </div>
        <div className="flex-col-8">
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/presiones_y_cotas.webp"
            iconClassName="card-icon-22"
            title="3. Presiones y cotas"
            bodyClassName="card-b-p0"
            headerRight={<EditButton edit={editPresiones} setEdit={setEditPresiones} />}
          >
            <Tbl
              caption="Presiones y cotas"
              thClassName="tbl-th-11"
              tdClassName="tbl-td-12"
              tdlClassName="tbl-tdl-13"
              cols={['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia']}
              rows={[
                ...(isRed
                  ? ([
                      [
                        <Param name="Presión acometida" sub="Red pública en entrega" />,
                        <LazyInp
                          ep={ep}
                          updEP={updEP}
                          disabled={!editPresiones}
                          field="pred"
                          ariaLabel="Presión acometida"
                        />,
                        'm.c.a.',
                        <Comment>
                          <span className="ep-note-600">Medida en campo</span> · Usar convertidor 1.
                          Ej: 200 kPa = 20.39 m.c.a.
                        </Comment>,
                      ],
                    ] as React.ReactNode[][])
                  : []),
                [
                  <Param name="Presión mínima punto crítico" sub="Aparato más desfavorable" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="pmin"
                    ariaLabel="Presión mínima punto crítico"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">NTC 1500 Tab.3</span> · Mín. 5.0 (49 kPa). Ducha
                    confort: 7.13. Flujómetro: 10.70.
                  </Comment>,
                ],
                [
                  <Param name="Presión máxima sistema" sub="Límite 500 kPa = 51.0 m.c.a." />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="pmax"
                    ariaLabel="Presión máxima sistema"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">NSR-10 H.4.2</span> · Instalar RRP si Pred supera
                    este valor.
                  </Comment>,
                ],
                [
                  <Param name="Cota bomba" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="zbomba"
                    ariaLabel="Cota bomba"
                  />,
                  'm',
                  <Comment>Nivel de instalación del equipo. Referencia = 0.00 m.</Comment>,
                ],
                [
                  <Param
                    name="Cota punto más desfavorable"
                    sub="Piso más alto o aparato más lejano"
                  />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="ztop"
                    ariaLabel="Cota punto más desfavorable"
                  />,
                  'm',
                  <Comment>Del levantamiento topográfico o planos arquitectónicos.</Comment>,
                ],
              ]}
            />
          </Card>
          <Card
            className="ep-card-col"
            iconImg="/iconos_civilflow/diseno_redes/equipos/config_bombas.webp"
            iconClassName="card-icon-22"
            title="4. Configuración de bombas"
            bodyClassName="card-b-p4"
            headerRight={<EditButton edit={editBombas} setEdit={setEditBombas} />}
          >
            <div className="ep-grid-2-6">
              <div className="ep-bordered">
                <div className="ep-tiny-label">Bombas en trabajo</div>
                <div className="ep-px-row">
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editBombas}
                    field="nt"
                    ariaLabel="Bombas en trabajo"
                    className="ds-si-strong"
                  />
                </div>
                <div className="ep-dim">Operan simultáneamente en régimen normal</div>
              </div>
              <div className="ep-bordered">
                <div className="ep-tiny-label">Bombas en reserva</div>
                <div className="ep-px-row">
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editBombas}
                    field="nr"
                    ariaLabel="Bombas en reserva"
                    className="ds-si-strong"
                  />
                </div>
                <div className="ep-dim">Reserva · arranque automático por falla</div>
              </div>
            </div>
            <div className="ep-summary-bar">
              <span className="ep-summary-main">
                Total: {ntot} bombas · {nt} trabajo + {nr} reserva · Qb ={' '}
                {Qb > 0 ? Qb.toFixed(2) : '—'} L/s c/u
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default React.memo(EPInputPage);
