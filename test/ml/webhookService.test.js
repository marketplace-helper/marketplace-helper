import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebhookService } from "../../src/services/ml/webhookService.js";

function setup({ orderItems = ["MLB9"], orderFails = false } = {}) {
  const enqueued = [];
  const svc = createWebhookService({
    appId: "123",
    store: { findUserIdByMlUserId: async (id) => (id === "555" ? 42 : null) },
    queue: { enqueue: (u, m) => enqueued.push([u, m]) },
    getOrderItemIds: async () => { if (orderFails) throw new Error("x"); return orderItems; },
  });
  return { svc, enqueued };
}
const base = { application_id: 123, user_id: 555, topic: "items", resource: "/items/MLB123" };

test("items válido enfileira", async () => {
  const { svc, enqueued } = setup();
  assert.equal(await svc.handle(base), "enfileirado");
  assert.deepEqual(enqueued, [[42, ["MLB123"]]]);
});

test("prefixo mlb minúsculo é normalizado", async () => {
  const { svc, enqueued } = setup();
  await svc.handle({ ...base, resource: "/items/mlb77" });
  assert.deepEqual(enqueued, [[42, ["MLB77"]]]);
});

test("orders_v2 usa os MLBs do pedido", async () => {
  const { svc, enqueued } = setup({ orderItems: ["MLB1", "MLB2"] });
  assert.equal(await svc.handle({ ...base, topic: "orders_v2", resource: "/orders/2000123" }), "enfileirado");
  assert.deepEqual(enqueued, [[42, ["MLB1", "MLB2"]]]);
});

test("entradas inválidas são ignoradas sem exceção", async () => {
  const { svc, enqueued } = setup();
  for (const body of [
    { ...base, application_id: 999 },
    { ...base, user_id: 1 },
    { ...base, topic: "payments" },
    { ...base, resource: null },
    { ...base, resource: "/items/abc" },
    { ...base, topic: "orders_v2", resource: "/orders/xx" },
    {}, null, undefined,
  ]) assert.equal(await svc.handle(body), "ignorado");
  assert.equal(enqueued.length, 0);
});

test("getOrderItemIds rejeitando é ignorado", async (t) => {
  t.mock.method(console, "error", () => {});
  const { svc, enqueued } = setup({ orderFails: true });
  assert.equal(await svc.handle({ ...base, topic: "orders_v2", resource: "/orders/2000" }), "ignorado");
  assert.equal(enqueued.length, 0);
});

test("pedido sem itens é ignorado", async () => {
  const { svc } = setup({ orderItems: [] });
  assert.equal(await svc.handle({ ...base, topic: "orders_v2", resource: "/orders/2000" }), "ignorado");
});
