import assert from "node:assert/strict";
import test from "node:test";

import { collectPaginatedRows } from "../lib/paginated-rows.js";

function pageFrom(records, from, to) {
  return { rows: records.slice(from, to + 1) };
}

test("recupera más de 1,000 registros mediante páginas consecutivas", async () => {
  const source = Array.from({ length: 2505 }, (_, index) => ({ id: index + 1 }));
  const requestedRanges = [];

  const records = await collectPaginatedRows(
    async (from, to) => {
      requestedRanges.push([from, to]);
      return pageFrom(source, from, to);
    },
    { pageSize: 1000, getRowKey: (row) => row.id },
  );

  assert.deepEqual(requestedRanges, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
  assert.equal(records.length, 2505);
  assert.deepEqual(records.at(-1), { id: 2505 });
});

test("completa la exportación en un múltiplo exacto del tamaño de página", async () => {
  const source = Array.from({ length: 2000 }, (_, index) => index + 1);
  let calls = 0;

  const records = await collectPaginatedRows(
    async (from, to) => {
      calls += 1;
      return pageFrom(source, from, to);
    },
    { pageSize: 1000, getRowKey: (row) => row },
  );

  assert.equal(calls, 3);
  assert.equal(records.length, 2000);
});

test("rechaza una API que repite una página anterior", async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => index + 1);

  await assert.rejects(
    collectPaginatedRows(
      async () => ({ rows }),
      { pageSize: 1000, getRowKey: (row) => row },
    ),
    /repitió registros/,
  );
});
