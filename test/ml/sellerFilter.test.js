import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarItensDoVendedor } from "../../src/services/ml/sellerFilter.js";

test("mantém só os itens do vendedor (seller_id numérico ou string)", (t) => {
  t.mock.method(console, "warn", () => {});
  const out = filtrarItensDoVendedor(
    [{ id: "MLB1", seller_id: 555 }, { id: "MLB2", seller_id: "999" }, { id: "MLB3" }, null],
    "555"
  );
  assert.deepEqual(out.map((d) => d.id), ["MLB1"]);
});

test("registra aviso para itens descartados", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  filtrarItensDoVendedor([{ id: "MLB9", seller_id: 1 }], "2");
  assert.equal(warn.mock.callCount(), 1);
});
