/** Paso 7 «¿Listo para dibujar?» de la Guía de diseño RCI: checklist ILUSTRATIVO de los 6
 *  criterios de rociadores (sin estado del proyecto — ped. usuario). Los «revisar» saltan al
 *  dato con irGo. Ej: <PasoListo irGo={irGo} /> pinta el checklist sin chips. */
import { TXT, UL, type PropsPasoGuia } from './shared.ts';

/* 7 · ¿Listo para dibujar? */
export function PasoListo({ irGo }: PropsPasoGuia) {
  const items: [string, string[]][] = [
    ['Riesgo clasificado y compatible con el uso', ['entradas', 'clas.riesgo']],
    ['Altura de arrume definida (si hay almacenamiento)', ['entradas', 'clas.arrumeH']],
    ['Separación S dentro de límites', ['tipologias', 'pisos']],
    ['Separación L dentro de límites', ['tipologias', 'pisos']],
    ['Área por rociador ≤ cobertura máxima', ['tipologias', 'pisos']],
    ['Distancia a muro dentro de límites', ['tipologias', 'pisos']],
  ];
  return (
    <>
      <p style={TXT}>
        Antes de pasar al módulo de dibujo, verifica estos 6 criterios de rociadores en tu proyecto.
        Así el trazo se hace una sola vez.
      </p>
      <ul style={UL}>
        {items.map(([t, go]) => (
          <li key={t}>
            {t}{' '}
            <button
              type="button"
              style={{
                border: 0,
                background: 'none',
                padding: 0,
                font: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--acc)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={() => irGo(go)}
            >
              revisar
            </button>
          </li>
        ))}
      </ul>
      <p style={TXT}>
        <b>Todo listo.</b> Ten a mano el PDF del plano con la distribución de rociadores.
      </p>
    </>
  );
}
