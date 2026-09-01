import type { ReactNode } from "react";

export interface DataTableColumn {
  key: string;
  header: string;
}

export interface DataTableRow {
  id: string;
  cells: Record<string, ReactNode>;
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
}): ReactNode {
  return (
    <div className="ir-table-scroll">
      <table className="ir-table">
        <caption className="ir-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{row.cells[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
