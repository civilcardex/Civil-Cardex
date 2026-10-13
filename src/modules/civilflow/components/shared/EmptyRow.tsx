/** Fila vacía de tabla ("No hay tramos...") — un solo lugar para el texto y el estilo.
 *  @param colSpan - columnas que abarca la celda.
 *  @param fontSize - tamaño de letra (9 en tablas densas, 12 en el resto).
 *  @returns fila `tr` lista para `tbody`.
 */
export default function EmptyRow({
  colSpan,
  fontSize = 12,
}: {
  colSpan: number;
  fontSize?: number;
}) {
  return (
    <tr>
      <td
        className="c"
        colSpan={colSpan}
        style={{
          fontSize,
          color: 'var(--txt3)',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
      </td>
    </tr>
  );
}
