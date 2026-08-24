/**
 * @template T
 * @typedef {{ rows: T[] }} PaginatedRowsPage
 */

/**
 * Recorre una consulta paginada y detecta si el servidor repite registros de
 * una página anterior.
 *
 * @template T
 * @param {(from: number, to: number) => Promise<PaginatedRowsPage<T>>} fetchPage
 * @param {{
 *   pageSize?: number;
 *   getRowKey?: (row: T) => string | number | null | undefined;
 * }} [options]
 * @returns {Promise<T[]>}
 */
export async function collectPaginatedRows(fetchPage, options = {}) {
  const pageSize = options.pageSize ?? 1000;
  const getRowKey = options.getRowKey;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("El tamaño de página debe ser un entero positivo.");
  }

  /** @type {T[]} */
  const records = [];
  const seenKeys = new Set();
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (!Array.isArray(page.rows)) {
      throw new Error("La respuesta paginada no contiene una lista de registros.");
    }
    if (page.rows.length > pageSize) {
      throw new Error("La respuesta paginada excede el tamaño solicitado.");
    }

    if (getRowKey) {
      for (const row of page.rows) {
        const key = getRowKey(row);
        if (key === null || key === undefined) continue;
        const normalizedKey = `${typeof key}:${String(key)}`;
        if (seenKeys.has(normalizedKey)) {
          throw new Error("Supabase repitió registros durante la exportación.");
        }
        seenKeys.add(normalizedKey);
      }
    }

    records.push(...page.rows);

    if (page.rows.length < pageSize) {
      return records;
    }

    from += page.rows.length;
  }
}
