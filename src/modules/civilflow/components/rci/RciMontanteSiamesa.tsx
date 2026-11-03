/** Sección 5 del diseño RCI (Red Contra Incendio): montante NFPA 14 y siamesa — material,
 *  diámetro y alturas del montante (lo que dibujó el plano llega con candado 🔒), clase de
 *  sistema y datos de la conexión de bomberos, con los resultados de la ruta y la presión que
 *  pide el carro. Ej: Clase III pide 500 gpm @ 100 psi en la salida más remota. */
import { SecRci, CampoRci, GRID_RCI, KvTabla, type RciCtx } from './uiRci.tsx';
import {
  SINO,
  CLASES_SP,
  DIAMETROS,
  MATERIALES,
  kvMontante,
  kvSiamesa,
} from '../../utils/rci/rowsModel.ts';
import type { MontDibujo } from '../../utils/rci/extract.ts';
import type { RciSia, RciSp } from '../../lib/rci/types.ts';

export function RciMontanteSiamesa({
  ctx,
  montDibujo,
}: {
  ctx: RciCtx;
  /** Lo que el dibujo dijo del montante: fija los candados de material/diámetro/altDeriv. */
  montDibujo: MontDibujo;
}) {
  const { estado, R, edit, editar } = ctx;
  const mont = estado.mont;
  const sp: RciSp = estado.sp;
  const sia: RciSia = estado.sia;
  const spOn = estado.local.exigeSP === 'Sí';

  const setMont = (k: 'mat' | 'dn' | 'hS' | 'hD' | 'zBase' | 'holgura') => (v: string) =>
    editar((e) => ({ ...e, mont: { ...e.mont, [k]: v } }));
  const setSp = (k: keyof RciSp) => (v: string) =>
    editar((e) => ({ ...e, sp: { ...e.sp, [k]: v } }));
  const setSia = (k: keyof RciSia) => (v: string) =>
    editar((e) => ({ ...e, sia: { ...e.sia, [k]: v } }));

  return (
    <SecRci
      id="montantes"
      titulo="Montante y siamesa"
      nota={spOn ? `Clase ${sp.clase} (NFPA 14)` : 'montantes no exigidos por el código'}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--txt2)' }}>
            Montante (NFPA 14)
          </h4>
          <div style={GRID_RCI}>
            <CampoRci
              etiqueta="Clase de sistema"
              val={sp.clase}
              opciones={CLASES_SP}
              set={edit && spOn ? setSp('clase') : undefined}
              des={!spOn}
              campo="sp.clase"
              ayuda={
                'Clase I: conexión 2½" para bomberos (100 psi · 500 gpm). Clase II: gabinete 1½" (65 psi · 100 gpm). Clase III: ambas'
              }
            />
            <CampoRci
              etiqueta="Número de montantes"
              val={sp.num}
              num
              set={edit && spOn ? setSp('num') : undefined}
              des={!spOn}
              campo="sp.num"
              uni="un"
              ayuda="Clase I/III: cada montante adicional suma 250 gpm"
            />
            <CampoRci
              etiqueta="Edificio totalmente rociado"
              val={sp.rociado}
              opciones={SINO}
              set={edit && spOn ? setSp('rociado') : undefined}
              des={!spOn}
              campo="sp.rociado"
              ayuda="Sí: tope de 1000 gpm y gobierna la mayor demanda (no se suman)"
            />
            <CampoRci
              etiqueta="Diámetro mínimo del montante"
              val={sp.diam}
              num
              set={edit && spOn ? setSp('diam') : undefined}
              des={!spOn}
              campo="sp.diam"
              uni="pulg"
              ayuda='Mín. 4"; combinado 6" salvo cálculo hidráulico'
            />
            <CampoRci
              etiqueta="Cota de la salida más baja del edificio"
              val={sp.zMinSalida}
              num
              set={edit && spOn ? setSp('zMinSalida') : undefined}
              des={!spOn}
              campo="sp.zMinSalida"
              uni="m"
              ayuda={
                R.sp.activo && R.sp.zAuto !== undefined
                  ? `Vacío = ${R.sp.zAuto} m (la más baja de la tabla de pisos)`
                  : 'Sobre el eje de la bomba'
              }
            />
            <CampoRci
              etiqueta="Material del montante"
              val={mont.mat}
              opciones={MATERIALES}
              set={edit && !montDibujo.mat ? setMont('mat') : undefined}
              fijo={!!montDibujo.mat}
              campo="mont.mat"
              ayuda={
                montDibujo.mat
                  ? `Del dibujo: ${montDibujo.mat}`
                  : 'Su C sale de la tabla de materiales'
              }
            />
            <CampoRci
              etiqueta="Diámetro del montante"
              val={mont.dn}
              opciones={DIAMETROS}
              set={edit && !montDibujo.dn ? setMont('dn') : undefined}
              fijo={!!montDibujo.dn}
              campo="mont.dn"
              ayuda={
                montDibujo.dn
                  ? `Del dibujo: ${montDibujo.dn}`
                  : `Auto: el menor que cumple velocidad y mínimo de norma. Ø usado: ${R.edif.dnM || '—'}`
              }
            />
            <CampoRci
              etiqueta="Altura de la válvula de manguera (gabinete)"
              val={mont.hS}
              num
              set={edit ? setMont('hS') : undefined}
              campo="mont.hS"
              uni="m"
              ayuda="Centro de la válvula sobre el NPT. NFPA 14: entre 0,90 y 1,50 m"
            />
            <CampoRci
              etiqueta="Altura de la derivación del piso (altDeriv)"
              val={mont.hD}
              num
              set={edit && montDibujo.altDeriv === null ? setMont('hD') : undefined}
              fijo={montDibujo.altDeriv !== null}
              campo="mont.hD"
              uni="m"
              ayuda={
                montDibujo.altDeriv !== null
                  ? `Del dibujo: ${montDibujo.altDeriv} m — la tee del montante hacia el piso, antes de la VCP`
                  : 'La tee del montante hacia el piso, antes de la VCP. Con red extraída manda la cota del nudo de derivación'
              }
            />
            <CampoRci
              etiqueta="Cota de la base del montante"
              val={mont.zBase}
              num
              set={edit ? setMont('zBase') : undefined}
              campo="mont.zBase"
              uni="m"
              ayuda="Sobre el eje de la bomba"
            />
            <CampoRci
              etiqueta="Holgura mínima en cada derivación"
              val={mont.holgura}
              num
              set={edit ? setMont('holgura') : undefined}
              campo="mont.holgura"
              uni="psi"
              ayuda="0 = lo que exige la norma; un margen de diseño la aumenta"
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <KvTabla filas={kvMontante(R.edif, R.gab)} />
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--txt2)' }}>
            Siamesa: conexión de bomberos (NFPA 14)
          </h4>
          <div style={GRID_RCI}>
            <CampoRci
              etiqueta="Número de siamesas"
              val={sia.n}
              num
              set={edit && spOn ? setSia('n') : undefined}
              des={!spOn}
              campo="sia.n"
              uni="un"
              ayuda="En edificios altos, al menos dos alejadas entre sí por zona"
            />
            <CampoRci
              etiqueta={'Entradas de 2½" por siamesa'}
              val={sia.entradas}
              num
              set={edit && spOn ? setSia('entradas') : undefined}
              des={!spOn}
              campo="sia.entradas"
              uni="un"
              ayuda="Lo usual son dos (siamesa en Y)"
            />
            <CampoRci
              etiqueta="Rosca de las entradas"
              val={sia.rosca}
              set={edit && spOn ? setSia('rosca') : undefined}
              des={!spOn}
              campo="sia.rosca"
              ayuda="La define el cuerpo de bomberos local"
            />
            <CampoRci
              etiqueta="NPT del andén frente a la siamesa"
              val={sia.npt}
              num
              set={edit && spOn ? setSia('npt') : undefined}
              des={!spOn}
              campo="sia.npt"
              uni="m"
              ayuda="Mismo origen que los NPT de los pisos"
            />
            <CampoRci
              etiqueta="Altura de las entradas sobre el andén"
              val={sia.h}
              num
              set={edit && spOn ? setSia('h') : undefined}
              des={!spOn}
              campo="sia.h"
              uni="m"
              ayuda="NFPA 14: entre 0,46 y 1,22 m (18 y 48 in)"
            />
            <CampoRci
              etiqueta="Material de la tubería"
              val={sia.mat}
              opciones={MATERIALES}
              set={edit && spOn ? setSia('mat') : undefined}
              des={!spOn}
              campo="sia.mat"
              ayuda="Su C sale de la tabla de materiales"
            />
            <CampoRci
              etiqueta="Diámetro de la tubería"
              val={sia.dn}
              opciones={DIAMETROS.slice(1)}
              set={edit && spOn ? setSia('dn') : undefined}
              des={!spOn}
              campo="sia.dn"
              ayuda='Mínimo 4"'
            />
            <CampoRci
              etiqueta="Longitud a la base del montante"
              val={sia.L}
              num
              set={edit && spOn ? setSia('L') : undefined}
              des={!spOn}
              campo="sia.L"
              uni="m"
              ayuda="Recorrido real de la tubería"
            />
            <CampoRci
              etiqueta="Codos 90°"
              val={sia.c90}
              num
              set={edit && spOn ? setSia('c90') : undefined}
              des={!spOn}
              campo="sia.c90"
              uni="un"
            />
            <CampoRci
              etiqueta="Tees con giro"
              val={sia.tee}
              num
              set={edit && spOn ? setSia('tee') : undefined}
              des={!spOn}
              campo="sia.tee"
              uni="un"
              ayuda="Solo donde el flujo gira"
            />
            <CampoRci
              etiqueta="Cheques (retención)"
              val={sia.chq}
              num
              set={edit && spOn ? setSia('chq') : undefined}
              des={!spOn}
              campo="sia.chq"
              uni="un"
              ayuda="NFPA 14: un cheque listado en la tubería de la siamesa"
            />
            <CampoRci
              etiqueta="¿Válvula de cierre entre siamesa y sistema?"
              val={sia.cierre}
              opciones={SINO}
              set={edit && spOn ? setSia('cierre') : undefined}
              des={!spOn}
              campo="sia.cierre"
              ayuda="NFPA 14 no la permite"
            />
            <CampoRci
              etiqueta="¿Drenaje automático entre siamesa y cheque?"
              val={sia.drenaje}
              opciones={SINO}
              set={edit && spOn ? setSia('drenaje') : undefined}
              des={!spOn}
              campo="sia.drenaje"
              ayuda="Evita que la tubería quede con agua"
            />
            <CampoRci
              etiqueta="Distancia al hidrante más cercano"
              val={sia.hidrante}
              num
              set={edit && spOn ? setSia('hidrante') : undefined}
              des={!spOn}
              campo="sia.hidrante"
              uni="m"
              ayuda="La fija la autoridad; lo usual es 30,5 m (100 ft) o menos"
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <KvTabla filas={kvSiamesa(R.sia)} />
          </div>
        </div>
      </div>
    </SecRci>
  );
}
