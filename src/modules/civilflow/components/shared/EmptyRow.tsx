/** Fila "no hay datos todavía" de las tablas: texto y estilo en un solo lugar.
 *  `colSpan` = columnas que ocupa la celda; `fontSize` = letra (9 en tablas densas, 12 el resto). */
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
