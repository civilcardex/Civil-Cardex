/** Pasos 2 y 3 de la Guía de diseño RCI, el trazado sobre el plano: «Distribuye los
 *  rociadores» (cuadrícula y separaciones S/L) y «Organice ramales y tramos» (líneas, nudos
 *  y la derivación del montante). Ambos dibujan el plano/corte del proyecto.
 *  Ej: <PasoRociadores ctx={ctx} chk={chk} /> pinta el plano con "Separaciones entre
 *  rociadores, entre ramales y a muro". */
import { ChipEstado } from '../RCIUI.tsx';
import { CorteSvg, PlanSvg } from '../RCISvgFloorplan.tsx';
import { n2 } from '../RCISvgSchemas.tsx';
import { BLOQUE, BLOQUE_COMPACTO, GPAIR, GST, TXT, UL, type PropsPasoGuia } from './shared.ts';

/* 2 · Distribuye los rociadores */
export function PasoRociadores({ ctx, chk }: PropsPasoGuia) {
  const { R } = ctx;
  const ro = R.roc;
  return (
    <>
      <div style={BLOQUE_COMPACTO}>
        <PlanSvg
          roc={ro}
          opts={{
            dims: true,
            feed: false,
            label: 'Separaciones entre rociadores, entre ramales y a muro',
          }}
        />
      </div>
      <p style={TXT}>
        Sobre el plano arquitectónico ubica los rociadores en una cuadrícula regular. La separación
        S va a lo largo del ramal; la separación L, entre ramales.
      </p>
      <ul style={UL}>
        <li>
          <b>S y L</b> entre 1,80 m y {n2(ro.hz.s)} m.
        </li>
        <li>
          <b>S × L</b> no mayor que {n2(ro.Acmax * 0.092903)} m² ({ro.Acmax} ft²). Con L ={' '}
          {n2(ro.L)} m, S puede llegar a{' '}
          {n2(Math.min(ro.hz.s, (ro.Acmax * 0.092903) / (ro.L || 1)))} m.
        </li>
        <li>
          <b>Distancia a muro</b> no mayor que {n2(ro.hz.s / 2)} m (la mitad de la separación
          máxima) ni menor que 0,10 m, <b>en las dos direcciones</b>: a lo largo del ramal y
          perpendicular a él.
        </li>
        <li>Usa la misma S y la misma L en toda el área: así el cálculo representa el plano.</li>
      </ul>
      <div style={GST}>
        <span>Tu proyecto: S = {n2(ro.S)} m</span>{' '}
        <ChipEstado st={chk('Separación entre rociadores')} />
        <span>L = {n2(ro.L)} m</span> <ChipEstado st={chk('Separación entre ramales')} />
        <span>S × L</span> <ChipEstado st={chk('Área por rociador')} />
        <span>Muro</span> <ChipEstado st={chk('Distancia a muro')} />
      </div>
    </>
  );
}

/* 3 · Organice ramales y tramos */
export function PasoRamales({ ctx }: PropsPasoGuia) {
  const { estado, R } = ctx;
  const ro = R.roc;
  return (
    <>
      {/* Los DOS esquemas en UNA fila (.gpair del HTML): planta y corte lado a lado; si no
       * caben (modal angosto) el grid auto-fit baja uno debajo del otro. */}
      <div style={GPAIR}>
        <div style={BLOQUE}>
          <PlanSvg
            roc={ro}
            opts={{
              labels: true,
              nodes: true,
              verCorte: true,
              label: 'Ramales paralelos que entregan en tramos hasta la derivación del montante',
            }}
          />
        </div>
        {/* zNudoRaiz/Nramales sin dato aquí: CorteSvg usa sus defaults internos. */}
        <div style={{ ...BLOQUE, display: 'flex', alignItems: 'center' }}>
          <CorteSvg roc={ro} mont={estado.mont} />
        </div>
      </div>
      <p style={TXT}>
        Los rociadores de una misma línea forman un <b>ramal</b>. Cada ramal entrega su agua en un{' '}
        <b>nudo</b>; los <b>tramos</b> son las tuberías que unen un nudo con el siguiente hasta la{' '}
        <b>derivación del montante</b> del piso. Ahí termina el cálculo del piso. El tramo que llega
        a la derivación sube desde ella hasta la cota de los ramales: su L es la longitud de planta
        más la <b>bajada</b>, con dos codos (abajo y arriba de la bajada), y en él van la válvula de
        control del piso, el detector de flujo y la conexión de prueba y drenaje, a altura accesible
        y del mismo diámetro del tramo (ver corte).
      </p>
      <ul style={UL}>
        <li>
          Traza los ramales paralelos al lado más largo del recinto: el área de diseño se alinea con
          ellos.
        </li>
        <li>
          Los nudos llevan letras desde la <b>A</b>, en lo más remoto, hasta la derivación del
          montante, que es la última letra.
        </li>
        <li>
          Un tramo <b>alimenta</b> a los ramales que se conectan en sus nudos, y un ramal puede
          alimentar a otro ramal. Si un ramal alimenta a otro a mitad de su longitud, el pedazo que
          lleva los dos caudales es un tramo.
        </li>
        <li>
          Prefiere ramales cortos y tramos que lleguen cerca del centro de gravedad de los
          rociadores: reduce presión y diámetros.
        </li>
      </ul>
    </>
  );
}
