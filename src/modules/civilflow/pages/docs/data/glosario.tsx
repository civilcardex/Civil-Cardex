import { Tabla } from './ui';

const glosario = {
  name: 'Glosario ES ↔ EN',
  desc: 'Vocabulario del dominio en español (UI, RAS/NSR) y su identificador en inglés en el código. Los nombres de archivo van en inglés; los identificadores conservan el término español del dominio.',
  icon: 'translate',
  color: '#38BDF8',
  sections: [
    {
      title: 'Redes (net)',
      body: (
        <div className="space-y-3">
          <p>El `net` de cada tramo y la familia de sus claves de conteo:</p>
          <Tabla
            head={['Red (ES)', 'Código', 'Familia de claves']}
            rows={[
              ['Sanitaria', 'san', 'san_* (UD)'],
              ['Aguas lluvias', 'll', 'll_*'],
              ['Agua fría', 'af', 'af_* (UC)'],
              ['Agua caliente', 'ac', 'ac_* (UC)'],
              ['Gas', 'gas', 'gas_* (m³/h)'],
              ['Ventilación', 'vent', 'sin UC/UD'],
              ['Red contra incendio', 'rci', '—'],
              ['Recolectora (subred ll)', 'recolectora', 'll_*'],
              ['Rejillas (subred gas)', 'rejillas', 'gas_AR*'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Elementos del motor (PlanoEngine)',
      body: (
        <div className="space-y-3">
          <p>Tipos de `PlanoBajante` / `PlanoRamal` y su prefijo de etiqueta:</p>
          <Tabla
            head={['Elemento (ES)', 'tipo en código', 'Etiqueta']}
            rows={[
              ['Ramal', 'ramal', 'RSn / RAFn / ...'],
              ['Tributario', 'tributario', 'TnRSm'],
              ['Bajante', 'bajante', 'BANn / BALLn'],
              ['Montante', 'montante', 'MAFn'],
              ['Caja de inspección', 'caja_san / caja_ll', 'CANn / CALLn'],
              ['Contador', 'contador', 'CNT'],
              ['Calentador', 'calentador', 'CALENT'],
              ['Bomba', 'bomba', 'BOMANn-Pn'],
              ['Ldesvío (fantasma de asociación)', 'ramal LD_', 'LD_<id>'],
              ['Marcador entre pisos', '— (crossFloorGhost)', 'XFG'],
              ['Canal recolector', 'canal', 'CNLn'],
              ['Red pública', 'red_publica', 'RP'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Claves compuestas (utils/keys.ts)',
      body: (
        <div className="space-y-3">
          <p>
            Forma canónica `red_id_plano` (antes `net_id_planId`): el último segmento numérico es el
            plano; sin sufijo = legado. Punteros entre pisos `planId|id`.
          </p>
          <Tabla
            head={['Concepto (ES)', 'Constructor / parser', 'Ejemplo']}
            rows={[
              ['Clave de conteos', 'countKey / splitCount', 'san_RS4_2'],
              ['Clave de tramo en tabla', 'splitTramo', 'AC-01-3 → sector AC-01, plano 3'],
              ['Clave de gas interna', 'plantilla plan:id', '2:RS1'],
              ['Puntero entre pisos', 'ptr / splitPtr', '2|BAN1'],
              ['Clave de borrado', 'claveDeBorrado', 'acepta T1RS4_2 y LD_BAN2_1'],
              ['¿Es de este plano?', 'isPlanKeyFor', 'filtra por sufijo _<planId>'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Bus de fixtures (utils/fixtureEvents.ts)',
      body: (
        <div className="space-y-3">
          <p>
            El bus sigue siendo eventos DOM (mismo timing, mismo detail); el módulo centraliza
            nombres y emisores para un futuro swap a invalidación explícita:
          </p>
          <Tabla
            head={['Evento', 'Emisor', 'Quién escucha']}
            rows={[
              ['aparatos-clear', 'emitAparatosClear', 'panel, menú, tablas, rejillas'],
              ['civilflow_san_sync_changed', 'emitSanSync', 'tablas san, contextos'],
              ['civilflow_hidro_sync_changed', 'emitHidroSync', 'tablas hidro, contextos'],
              ['civilflow_plan_loaded', 'emitPlanLoaded', 'panel (re-corre espejos)'],
              ['storage (nativo)', 'EV_STORAGE', 'tablas, visor, contextos'],
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Conceptos hidráulicos',
      body: (
        <div className="space-y-3">
          <Tabla
            head={['Término (ES)', 'En código', 'Nota']}
            rows={[
              ['Unidades de descarga', 'UD', 'san/ll'],
              ['Unidades de consumo', 'UC', 'af/ac'],
              ['Aparato', 'aparatoInicio / aparatoFin', 'extremos del tramo'],
              ['Carga propagada', 'heredado (libro aparatos_heredados_v1)', 'af/ac aguas abajo'],
              [
                'Plegado de tributarios',
                'fold (libro aparatos_heredados_trib_v1)',
                'sube al padre',
              ],
              ['Nodo de unión', 'cluster (aparatosPresion)', 'tolerancia 0.5 px'],
              ['Acometida', 'acometida (SupplyConnection)', 'AF'],
              ['Diámetro nominal', 'dNominal / diametro', 'etiqueta con ″'],
              ['Pendiente', 'pendiente (%)', 'san/ll/vent, rango 0–15'],
              ['Caudal', 'caudal / Q (L/s)', 'll: C·I·A/3600'],
            ]}
          />
        </div>
      ),
    },
  ],
};

export default glosario;
