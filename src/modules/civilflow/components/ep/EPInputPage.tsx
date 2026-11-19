/** Página 1 del diseño de ep (Equipo de Presión): entrada de datos (acometida, aparatos,
 *  presiones mínimas) que alimenta el cálculo del sistema. Ej: marcar «tanque hidroneumático»
 *  -> el dimensionamiento de bom (Bomba) cambia de doctrina. */
import React, { useEffect, useState } from 'react';
import type { EPData } from './EPShared';
import Card from '../shared/Card.tsx';
import Tbl from '../shared/Tbl';
import EditButton from '../shared/EditButton.tsx';
import { LazyInp, Param, Comment } from './EPShared';
import { dec } from '../../utils/parseDecimal.ts';
import { EP_APARATOS, apLim } from './epAparatos.ts';
import { EP_MATS } from './epEngine.ts';

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

  /* Pmin dentro del rango del aparato elegido: restauración automática — el motor
   *  además alerta si queda bajo el confort (grifería de baja presión). */
  useEffect(() => {
    const lim = apLim(parseInt(ep.apsel, 10));
    if (!lim) return;
    const v = dec(ep.pmin);
    if (v > 0 && (v < lim.min - 1e-9 || v > lim.max + 1e-9)) {
      updEP('pmin', String(v < lim.min ? lim.min : lim.max));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep.apsel, ep.pmin]);

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
                    className="ni"
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
                    className="ni"
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
                  <Param
                    name="Pérdidas cuarto de bombas"
                    sub="Válvulas, cheque, filtro, colectores"
                  />,
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
                      <input
                        type="checkbox"
                        checked={ep.hfauto !== 'false'}
                        onChange={(e) => updEP('hfauto', e.target.checked ? 'true' : 'false')}
                        aria-label="Calcular pérdidas del cuarto con el esquema"
                      />
                      auto
                    </label>
                    <LazyInp
                      ep={ep}
                      updEP={updEP}
                      disabled={!editPerdidas || ep.hfauto !== 'false'}
                      field="hfotros"
                      ariaLabel="Pérdidas cuarto de bombas"
                    />
                  </span>,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Método K</span> · Con «auto» se calculan con los
                    accesorios del esquema sugerido (VC 0,2 · cheque 2,5 · tee 1,0 · codo 0,75 ·
                    filtro Y 3,0, +10 % tramos). Manual: intercambiador, filtros de zona u otros.
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
                  <Param name="Aparato crítico" sub="Tipo y descripción o ubicación" />,
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      className="ds-si"
                      value={ep.apsel}
                      onChange={(e) => {
                        const i = parseInt(e.target.value, 10);
                        const a = apLim(i);
                        updEP('apsel', e.target.value);
                        if (a) updEP('pmin', String(a.confort));
                        updEP('apcrit', a ? a.nombre : '');
                      }}
                      aria-label="Tipo de aparato crítico"
                      disabled={!editPresiones}
                      style={{ minWidth: 90 }}
                    >
                      {EP_APARATOS.map((a, i) => (
                        <option key={a.nombre} value={String(i)}>
                          {a.nombre}
                        </option>
                      ))}
                      <option value="-1">Otro (escribir)</option>
                    </select>
                    <input
                      className="ds-si"
                      value={ep.apcrit}
                      onChange={(e) => updEP('apcrit', e.target.value)}
                      placeholder="nombre o ubicación"
                      aria-label="Descripción del aparato crítico"
                      disabled={!editPresiones}
                      style={{ maxWidth: 120 }}
                    />
                  </span>,
                  '',
                  <Comment>
                    <span className="ep-note-600">Tabla de 3 niveles</span> · Al elegir el tipo se
                    carga su presión de confort en Pmin (editable entre la mínima y la máxima del
                    aparato).
                  </Comment>,
                ],
                [
                  <Param name="Presión mínima punto crítico" sub="Aparato más desfavorable" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="pmin"
                    ariaLabel="Presión mínima punto crítico"
                    className="ni"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">IPC 604.3 · confort</span> · Entre la mínima y la
                    máxima del aparato elegido; por debajo del confort se acepta con alerta
                    (grifería de baja presión).
                  </Comment>,
                ],
                [
                  <Param name="P parada máxima" sub="Del Perfil de presiones" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="poffmax"
                    ariaLabel="P parada máxima admisible"
                    className="ni"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Perfil</span> · Menor entre el límite de la
                    tubería y la estática en pisos sin VRP. Vacío = sin verificar.
                  </Comment>,
                ],
                [
                  <Param name="Altitud" sub="Para la presión atmosférica (NPSH)" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="altitud"
                    ariaLabel="Altitud del proyecto"
                  />,
                  'm s.n.m.',
                  <Comment>
                    <span className="ep-note-600">Patm</span> · 10,33 m.c.a. a nivel del mar,
                    decrece con la altitud.
                  </Comment>,
                ],
                [
                  <Param name="Temperatura del agua" sub="Para la presión de vapor (NPSH)" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editPresiones}
                    field="temp"
                    ariaLabel="Temperatura del agua"
                  />,
                  '°C',
                  <Comment>
                    <span className="ep-note-600">Antoine</span> · 20 °C → 0,24 m.c.a. de vapor.
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
                    className="ni"
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
                    className="ni"
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
                    className="ni"
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
            <Tbl
              caption="Control con variador y tubería del cuarto"
              thClassName="tbl-th-11"
              tdClassName="tbl-td-12"
              tdlClassName="tbl-tdl-13"
              cols={['Control con variador', 'Valor', 'Ud.', 'Comentario / Referencia']}
              rows={[
                [
                  <Param name="Margen sobre P mín." sub="Para fijar el arranque" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editBombas}
                    field="margen"
                    ariaLabel="Margen sobre presión mínima"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">0–3</span> · Arranque = P mín. descarga + margen,
                    redondeado hacia arriba.
                  </Comment>,
                ],
                [
                  <Param name="Banda de control" sub="Arranque → parada" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editBombas}
                    field="dif"
                    ariaLabel="Banda de control del variador"
                  />,
                  'm.c.a.',
                  <Comment>
                    <span className="ep-note-600">Típ. 3–10</span> · P objetivo (setpoint) =
                    arranque + banda / 2.
                  </Comment>,
                ],
                [
                  <Param name="Caudal mín. de parada" sub="% de Qb" />,
                  <LazyInp
                    ep={ep}
                    updEP={updEP}
                    disabled={!editBombas}
                    field="qminp"
                    ariaLabel="Caudal mínimo de parada"
                  />,
                  '%',
                  <Comment>
                    <span className="ep-note-600">Típ. 10</span> · Bajo este caudal el variador
                    detiene la bomba y el tanque abastece.
                  </Comment>,
                ],
                [
                  <Param name="Tubería del cuarto" sub="Carga dInt y presión admisible" />,
                  <select
                    className="ds-si"
                    value={ep.mat}
                    onChange={(e) => updEP('mat', e.target.value)}
                    aria-label="Material de la tubería del cuarto"
                    disabled={!editBombas}
                  >
                    {Object.values(EP_MATS).map((m) => (
                      <option key={m.clave} value={m.clave}>
                        {m.corto}
                      </option>
                    ))}
                  </select>,
                  '',
                  <Comment>
                    <span className="ep-note-600">Con presión admisible</span> · La parada y la PSV
                    no pueden superar la admisible del material.
                  </Comment>,
                ],
              ]}
            />
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
