import React from 'react';
import EditButton from '../shared/EditButton.tsx';
import { SI } from '../../styles/sharedTableStyles.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys.ts';
import { factoresGas, qDisenoGas, renouardByType } from '../../utils/gasUtils.ts';

import { SR_ONLY_STYLE } from '../../../../components/shared/sharedStyles.ts';
const TXT_VAL: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontWeight: 600,
  fontSize: 13,
  textAlign: 'right',
  display: 'block',
  width: 100,
  padding: '5px 8px',
};

export interface GasDatosGeneralesProps {
  alt: string;
  setAlt: (v: string) => void;
  patm: string;
  temp: string;
  setTemp: (v: string) => void;
  pmin: string;
  setPmin: (v: string) => void;
  densRel: string;
  setDensRel: (v: string) => void;
  edit: boolean;
  setEdit: React.Dispatch<React.SetStateAction<boolean>>;
  /** Tramos de la red: solo para sumar la carga instalada y sacar el Q de diseño global. */
  tramos: Array<{ id: string; planId: string | number }>;
}

/** Página 1 del diseño de gas: datos del sitio y factores de corrección. Ej: 2600 msnm -> Q de diseño global. */
export function GasDatosGenerales(props: GasDatosGeneralesProps) {
  const {
    alt,
    setAlt,
    patm,
    temp,
    setTemp,
    pmin,
    setPmin,
    densRel,
    setDensRel,
    edit,
    setEdit,
    tramos,
  } = props;
  const fGas = factoresGas({ patm, temp, densRel });
  // Q de diseño global = Renouard sobre TODA la carga instalada (cada aparato contado UNA vez).
  // Sumar los qConsumo de las filas doble-contaba: el tronco ya carga la demanda de sus hojas
  // (acumulados del árbol). Con 2 aparatos en hojas distintas daba 2× el caudal.
  // Aparatos REALES (APARATOS_BY_TRAMO_KEY, clave gas_id_planId) — NO gasAcc (que guarda
  // ACCESORIOS: renouardByType filtraba por GAS_APPARATUS y devolvía 0 → '2.7' fijo, F-2).
  const aparatosRed = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  const totalAparatos: Record<string, number> = {};
  for (const t of tramos) {
    const appPid = t.planId ? `_${String(t.planId)}` : '';
    const propios = aparatosRed[`gas_${t.id}${appPid}`] || aparatosRed[`gas_${t.id}`] || {};
    for (const [ap, n] of Object.entries(propios)) {
      totalAparatos[ap] = (totalAparatos[ap] || 0) + (Number(n) || 0);
    }
  }
  const qGlobal = renouardByType(totalAparatos);

  const filas: {
    lbl: string;
    val: string;
    setVal?: (v: string) => void;
    uni: string;
  }[] = [
    { lbl: 'Altitud de la ciudad del proyecto', val: alt, setVal: setAlt, uni: 'msnm' },
    { lbl: 'Presión atmosférica de la ciudad de diseño', val: patm, uni: 'kPa' },
    { lbl: 'Temperatura promedio de la ciudad', val: temp, setVal: setTemp, uni: '°C' },
    { lbl: 'Presión mínima de la red según operador', val: pmin, setVal: setPmin, uni: 'mbar' },
    { lbl: 'Densidad relativa del gas a utilizar', val: densRel, setVal: setDensRel, uni: '' },
  ];
  const factores: [string, React.ReactNode][] = [
    [
      'Altitud',
      <>
        f<sub>alt</sub> = 101.325 / {fGas.pAtm.toFixed(2)} ={' '}
        <b style={{ color: 'var(--gas)' }}>{fGas.fAlt.toFixed(2)}</b>
      </>,
    ],
    [
      'Temperatura',
      <>
        f<sub>temp</sub> = &radic;(288 / (273 + {Number(temp) || 23})) ={' '}
        <b style={{ color: 'var(--gas)' }}>{fGas.fTemp.toFixed(2)}</b>
      </>,
    ],
    [
      'Densidad relativa',
      <>
        f<sub>dens</sub> = &radic;(0.67 / {fGas.DR.toFixed(2)}) ={' '}
        <b style={{ color: 'var(--gas)' }}>{fGas.fDens.toFixed(2)}</b>
      </>,
    ],
    [
      'Caudal de diseño',
      <>
        Q<sub>d</sub> = max(&Sigma;Q&middot;f, 2.7) ={' '}
        <b style={{ color: 'var(--gas)' }}>{qDisenoGas(qGlobal, fGas).toFixed(2)} m&sup3;/h</b>
      </>,
    ],
  ];

  return (
    <>
      {/* ancho común: ambas cards estiran al ancho del contenido más ancho */}
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 10,
          alignSelf: 'center',
          maxWidth: '100%',
        }}
      >
        <section className="card" style={{ flexShrink: 0 }}>
          <div className="card-h" style={{ padding: '6px 12px' }}>
            <h3 className="card-t">
              <img
                src="/iconos_civilflow/diseno_redes/gas/datos_generales_red_gas.webp"
                alt="Datos generales red de gas"
                width={24}
                height={24}
                style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
                loading="lazy"
              />
              Datos generales
            </h3>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <table className="tbl" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              <caption style={SR_ONLY_STYLE}>Datos generales</caption>
              <tbody>
                {filas.map((row, i, arr) => (
                  <tr key={row.lbl}>
                    <td
                      style={{
                        padding: '6px 10px',
                        fontWeight: 600,
                        color: 'var(--txt)',
                        fontSize: 13,
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                        borderRight: '1px solid var(--line)',
                      }}
                    >
                      {row.lbl}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                        borderRight: '1px solid var(--line)',
                      }}
                    >
                      {row.setVal && edit ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={row.lbl}
                          value={row.val}
                          onChange={(e) => row.setVal!(e.target.value)}
                          style={{
                            ...SI,
                            textAlign: 'right',
                            fontSize: 13,
                            padding: '5px 8px',
                            width: 100,
                          }}
                        />
                      ) : (
                        <span style={TXT_VAL}>{row.val}</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        color: 'var(--txt2)',
                        fontSize: 13,
                        fontWeight: 500,
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                      }}
                    >
                      {row.uni}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card" style={{ flexShrink: 0 }}>
          <div className="card-h" style={{ padding: '6px 12px' }}>
            <h3 className="card-t">
              <img
                src="/iconos_civilflow/diseno_redes/general/calculo_perdidas_de_carga.webp"
                alt="Factores de corrección"
                width={20}
                height={20}
                style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 4 }}
                loading="lazy"
              />
              Factores de correcci&oacute;n
            </h3>
          </div>
          <div style={{ padding: '10px 16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 32px',
              }}
            >
              {factores.map(([lbl, node]) => (
                <div key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ color: 'var(--txt3)', fontSize: 13 }}>{lbl}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 15.5 }}>
                    {node}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
