/** Sección 1 del diseño RCI (Red Contra Incendio): proyecto, país, normativa local y notas —
 *  los datos que el motor no usa para calcular pero que el código local y la memoria exigen.
 *  Ej: exigeSP 'Sí' habilita montantes, gabinetes y siamesa en el resto del cálculo. */
import { SecRci, CampoRci, GRID_RCI, type RciCtx } from './uiRci.tsx';
import { SI } from '../../styles/sharedTableStyles.ts';
import { SINO, ZONAS_SIS } from '../../utils/rci/rowsModel.ts';
import { zonaSis } from '../../lib/rci/index.ts';

/** Países con perfil de normativa (los del HTML de referencia; 'Internacional' = solo NFPA). */
export const PAISES_RCI = [
  'Internacional',
  'Colombia',
  'Perú',
  'México',
  'Chile',
  'Ecuador',
  'Panamá',
  'Costa Rica',
  'Otro',
] as const;

export function RciProyectoNormativa({ ctx }: { ctx: RciCtx }) {
  const { estado, edit, editar } = ctx;
  const ls = estado.local;
  const setMeta = (k: 'proyecto' | 'pais' | 'ciudad' | 'disenador' | 'revision') => (v: string) =>
    editar((e) => ({ ...e, meta: { ...e.meta, [k]: v } }));
  const setLocal = (k: keyof typeof ls) => (v: string) =>
    editar((e) => ({ ...e, local: { ...e.local, [k]: v } }));

  const zona = zonaSis(estado);
  const sismoOn = ls.reqSismo === 'Sí';
  const rocOn = ls.exigeRoc === 'Sí';
  const spOn = ls.exigeSP === 'Sí';
  const notaZona = zona.auto
    ? `Auto con NSR-10: zona ${zona.z} (mayor de Aa y Av = ${zona.a?.toFixed(2)}). Cámbiela solo si la autoridad lo indica`
    : estado.meta.pais === 'Colombia' && !ls.zonaSis
      ? 'Con NSR-10 se calcula sola al escribir Aa y Av en el parámetro sísmico'
      : 'Según la norma sísmica local. Define el alcance de la guía de soportes sísmicos';

  return (
    <SecRci
      id="normativa"
      titulo="Proyecto y normativa local"
      nota="El código local decide cuándo; NFPA 13, cómo"
    >
      <div style={GRID_RCI}>
        <CampoRci
          etiqueta="Proyecto"
          val={estado.meta.proyecto}
          set={edit ? setMeta('proyecto') : undefined}
          campo="meta.proyecto"
          ancho={260}
          ayuda="Encabeza la memoria de cálculo"
        />
        <CampoRci
          etiqueta="País"
          val={estado.meta.pais}
          opciones={PAISES_RCI}
          set={edit ? setMeta('pais') : undefined}
          campo="meta.pais"
          ayuda="Con el perfil del país se proponen las referencias normativas; 'Internacional' = solo NFPA"
        />
        <CampoRci
          etiqueta="Ciudad / localidad"
          val={estado.meta.ciudad}
          set={edit ? setMeta('ciudad') : undefined}
          campo="meta.ciudad"
          ayuda="Informativo; la altitud del sitio se ingresa en Bomba y tanque → Succión"
        />
        <CampoRci
          etiqueta="Diseño"
          val={estado.meta.disenador}
          set={edit ? setMeta('disenador') : undefined}
          campo="meta.disenador"
          ayuda="Nombre y matrícula profesional del responsable"
        />
        <CampoRci
          etiqueta="Revisión / fecha"
          val={estado.meta.revision}
          set={edit ? setMeta('revision') : undefined}
          campo="meta.revision"
          ayuda="Control de versiones de la memoria"
        />
      </div>

      <h4 style={{ margin: '10px 0 4px', fontSize: 12, color: 'var(--txt2)' }}>
        Normativa local (no interviene en los cálculos)
      </h4>
      <div style={GRID_RCI}>
        <CampoRci
          etiqueta="Código de edificación aplicable"
          val={ls.codLocal}
          set={edit ? setLocal('codLocal') : undefined}
          campo="local.codLocal"
          ayuda="Ej.: NSR-10 Títulos J y K, NFPA 101, IBC o el código nacional"
        />
        <CampoRci
          etiqueta="Ocupación según el código local"
          val={ls.ocupLocal}
          set={edit ? setLocal('ocupLocal') : undefined}
          campo="local.ocupLocal"
          ayuda="Grupo de ocupación del código local. No define el riesgo NFPA 13"
        />
        <CampoRci
          etiqueta="¿El código exige rociadores?"
          val={ls.exigeRoc}
          opciones={SINO}
          set={edit ? setLocal('exigeRoc') : undefined}
          campo="local.exigeRoc"
          ayuda="NFPA 13 define cómo diseñar, no cuándo es obligatorio"
        />
        <CampoRci
          etiqueta="Artículo que exige rociadores"
          val={ls.refRoc}
          set={edit && rocOn ? setLocal('refRoc') : undefined}
          des={!rocOn}
          campo="local.refRoc"
          ayuda="Artículo exacto del código local; queda citado en la memoria"
        />
        <CampoRci
          etiqueta="¿Exige montantes / gabinetes?"
          val={ls.exigeSP}
          opciones={SINO}
          set={edit ? setLocal('exigeSP') : undefined}
          campo="local.exigeSP"
          ayuda="Si es Sí, se activan montantes, gabinetes y siamesa"
        />
        <CampoRci
          etiqueta="Artículo que exige montantes"
          val={ls.refSP}
          set={edit && spOn ? setLocal('refSP') : undefined}
          des={!spOn}
          campo="local.refSP"
          ayuda="Artículo exacto del código local; queda citado en la memoria"
        />
        <CampoRci
          etiqueta="Adopción nacional de NFPA 13 / 14"
          val={ls.adopNac}
          set={edit ? setLocal('adopNac') : undefined}
          campo="local.adopNac"
          ayuda="Dejar vacío si no aplica"
        />
        <CampoRci
          etiqueta="Norma eléctrica local"
          val={ls.normElec}
          set={edit ? setLocal('normElec') : undefined}
          campo="local.normElec"
          ayuda="Complementa NFPA 70 art. 695 (bomba contra incendio)"
        />
        <CampoRci
          etiqueta="¿Requiere diseño sísmico de la red?"
          val={ls.reqSismo}
          opciones={SINO}
          set={edit ? setLocal('reqSismo') : undefined}
          campo="local.reqSismo"
          ayuda="Si es Sí, se habilitan norma, parámetro y zona sísmica"
        />
        <CampoRci
          etiqueta="Norma sísmica local"
          val={ls.normSis}
          set={edit && sismoOn ? setLocal('normSis') : undefined}
          des={!sismoOn}
          campo="local.normSis"
          ayuda="Ej.: NSR-10 Título A o ASCE 7"
        />
        <CampoRci
          etiqueta="Parámetro sísmico de referencia"
          val={ls.parSismo}
          set={edit && sismoOn ? setLocal('parSismo') : undefined}
          des={!sismoOn}
          campo="local.parSismo"
          ayuda="Ej.: 'Aa 0.15, Av 0.20' — con el perfil Colombia calcula la zona sola"
        />
        <CampoRci
          etiqueta="Zona de amenaza sísmica"
          val={ls.zonaSis}
          opciones={ZONAS_SIS}
          set={edit && sismoOn ? setLocal('zonaSis') : undefined}
          des={!sismoOn}
          campo="local.zonaSis"
          ayuda={notaZona}
        />
        <CampoRci
          etiqueta="Coeficiente sísmico Cp"
          val={ls.cp}
          num
          set={edit && sismoOn ? setLocal('cp') : undefined}
          des={!sismoOn}
          campo="local.cp"
          ayuda="Vacío = 0,5 (NFPA 13). Define la separación de riostras"
        />
        <CampoRci
          etiqueta="¿Las losas restringen el montante?"
          val={ls.losaRestr}
          opciones={SINO}
          set={edit && sismoOn ? setLocal('losaRestr') : undefined}
          des={!sismoOn}
          campo="local.losaRestr"
          ayuda="Sí: la losa apoya el montante al atravesarla. No (shaft abierto): riostra de cuatro vías cada ≤ 7,6 m (NFPA 13 cap. 18)"
        />
      </div>

      <h4 style={{ margin: '10px 0 4px', fontSize: 12, color: 'var(--txt2)' }}>
        Notas del diseñador
      </h4>
      <textarea
        data-campo="notas"
        value={estado.notas}
        readOnly={!edit}
        onChange={(e) => editar((prev) => ({ ...prev, notas: e.target.value }))}
        placeholder="Supuestos, decisiones y justificaciones que irán a la memoria (ej.: gabinetes según NFPA 14 Clase III…)."
        style={{
          ...SI,
          textAlign: 'left',
          fontFamily: 'var(--body)',
          minHeight: 64,
          resize: 'vertical',
        }}
      />
      {sismoOn ? (
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--txt3)' }}>
          Zona sísmica efectiva: {zona.z || '—'}
          {zona.auto ? ' (calculada con NSR-10)' : ' (elegida a mano)'}.
        </p>
      ) : null}
    </SecRci>
  );
}
