/** Pasos 8 y 9 de la Guía de diseño RCI, la fase después del criterio: «Captura la red en el
 *  plano» (el orden de trazado en el módulo PLANO) y «Revisa el cálculo y las verificaciones»
 *  (el orden de revisión y los criterios de bomba, montantes y jockey).
 *  Ej: <PasoDibujo ctx={ctx} /> pinta "Orden de trazado en el módulo de dibujo". */
import { PlanSvg } from '../RCISvgFloorplan.tsx';
import { n2 } from '../RCISvgSchemas.tsx';
import { BLOQUE_COMPACTO, GST, TXT, UL, type PropsPasoGuia } from './shared.ts';

/* 8 · Captura la red en el plano */
export function PasoDibujo({ ctx }: PropsPasoGuia) {
  const { R } = ctx;
  const ro = R.roc;
  return (
    <>
      <div style={BLOQUE_COMPACTO}>
        <PlanSvg
          roc={ro}
          opts={{ order: true, nodes: true, label: 'Orden de trazado en el módulo de dibujo' }}
        />
      </div>
      <p style={TXT}>
        En el módulo de dibujo (PLANO), sobre el PDF de cada piso, traza la red{' '}
        <b>desde lo más remoto hacia el montante</b>. Ramales, tramos, pisos y accesorios pasan
        solos a las tablas de RCI.
      </p>
      <ol style={{ ...UL, margin: '4px 0 8px' }}>
        <li style={{ marginBottom: 2 }}>
          <b>Calibra el plano.</b> Origen y ejes X/Y; comprueba con una cota conocida (por ejemplo,
          S = {n2(ro.S)} m).
        </li>
        <li>
          <b>Traza los ramales</b> desde la punta hacia su nudo (el orden de cálculo se ajusta en
          RCI).
        </li>
        <li>
          <b>Traza los tramos</b> de nudo a nudo hacia el montante (T1 es el más remoto); PLANO pone
          las letras desde la A y revisa el sentido del flujo en cada nudo.
        </li>
        <li>
          <b>Cierra en el montante.</b> Márcalo como extremo del último tramo; PLANO suma la bajada
          y dos codos.
        </li>
        <li>
          <b>Coloca los rociadores</b> sobre los ramales.
        </li>
        <li>
          <b>Asigna diámetro y material</b>, o deja «Auto» para que se elija por velocidad.
        </li>
      </ol>
      <p style={TXT}>
        <b>En RCI.</b> Lo que viene del dibujo (nombres, nudos, rociadores dibujados, longitudes,
        cotas, codos y tees) aparece en gris con candado y se corrige en PLANO.
      </p>
      {/* El botón "Abrir el módulo de dibujo" del HTML (data-gplano) no existe en este módulo. */}
    </>
  );
}

/* 9 · Revisa el cálculo y las verificaciones */
export function PasoRevision({ ctx }: PropsPasoGuia) {
  const { R } = ctx;
  const ro = R.roc;
  return (
    <>
      <p style={TXT}>
        Con la red capturada, el resto del cálculo es automático. Revisa en este orden:
      </p>
      <ol style={UL}>
        <li>
          <b>Hidráulica.</b> Que fluyan los {ro.Nreq} rociadores, que ningún tramo tenga velocidad
          alta y que ningún nudo quede con presión baja.
        </li>
        <li>
          <b>Gabinetes.</b> Solo si el código local exige montantes. Su demanda suele gobernar la
          bomba.
        </li>
        <li>
          <b>Bomba y tanque.</b> Demandas sobre la curva, succión positiva, NPSH y presión máxima
          del sistema.
        </li>
        <li>
          <b>Verificaciones.</b> Resuelve cada "No cumple" con "Ir al dato" hasta que el diseño
          quede verificado.
        </li>
      </ol>
      <p style={TXT}>
        <b>Criterios a tener presentes</b>
      </p>
      <ul style={UL}>
        <li>
          <b>Componentes.</b> Presión de trabajo estándar 175 psi; donde la estática la supera, VRP
          en la derivación del piso (columna «VRP» de Tipologías) o componentes de mayor presión.
        </li>
        <li>
          <b>Salidas de manguera.</b> Válvula reguladora si la residual de 1½" supera 100 psi o la
          estática supera 175 psi (columna «V. reg.» de Tipologías).
        </li>
        <li>
          <b>Montantes.</b> Clase I y III, 100 psi en la salida más remota con 250 gpm en cada una
          de las dos salidas más altas; Clase II, 65 psi y 100 gpm.
        </li>
        <li>
          <b>Bomba.</b> Succión positiva en bomba horizontal; cierre ≤ 140 % de la presión nominal;
          ≥ 65 % de la presión al 150 % del caudal; velocidad en succión ≤ 4,57 m/s.
        </li>
        <li>
          <b>Jockey.</b> Caudal menor que el de un rociador; la bomba principal arranca por debajo
          del arranque de la jockey.
        </li>
      </ul>
      <div style={GST}>
        <span>
          Estado actual: <b>{R.count['CUMPLE'] || 0}</b> cumplen, <b>{R.count['NO CUMPLE'] || 0}</b>{' '}
          no cumplen, <b>{R.count['REVISAR'] || 0}</b> por revisar,{' '}
          <b>{R.count['PENDIENTE'] || 0}</b> pendientes.
        </span>
      </div>
    </>
  );
}
