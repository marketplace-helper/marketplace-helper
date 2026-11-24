import { test } from "node:test";
import assert from "node:assert/strict";
import { createSyncQueue } from "../../src/services/ml/syncQueue.js";

function setup(t, { running = () => false } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  const queue = createSyncQueue({
    runSync: async (userId, mlbs) => { calls.push({ userId, mlbs }); },
    getSyncState: () => ({ running: running() }),
    delayMs: 30_000,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  return { queue, calls };
}

test("3 enqueue do mesmo usuário com MLBs repetidos geram 1 runSync com únicos", (t) => {
  const { queue, calls } = setup(t);
  queue.enqueue(1, ["MLB1", "MLB2"]);
  t.mock.timers.tick(5_000);
  queue.enqueue(1, ["MLB2"]);
  t.mock.timers.tick(5_000);
  queue.enqueue(1, ["MLB3", "MLB1"]);
  t.mock.timers.tick(19_999);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(calls, [{ userId: 1, mlbs: ["MLB1", "MLB2", "MLB3"] }]);
});

test("sync em andamento reagenda e roda depois sem perder MLBs", (t) => {
  let running = true;
  const { queue, calls } = setup(t, { running: () => running });
  queue.enqueue(7, ["MLB1"]);
  t.mock.timers.tick(30_000);
  assert.equal(calls.length, 0);
  queue.enqueue(7, ["MLB2"]);
  running = false;
  t.mock.timers.tick(30_000);
  assert.deepEqual(calls, [{ userId: 7, mlbs: ["MLB1", "MLB2"] }]);
});

test("usuários diferentes têm lotes independentes", (t) => {
  const { queue, calls } = setup(t);
  queue.enqueue(1, ["MLB1"]);
  queue.enqueue(2, ["MLB2"]);
  t.mock.timers.tick(30_000);
  assert.equal(calls.length, 2);
});

test("falha do runSync não derruba o processo", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(console, "error", () => {});
  const queue = createSyncQueue({
    runSync: async () => { throw new Error("boom"); },
    getSyncState: () => ({ running: false }),
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  });
  queue.enqueue(1, ["MLB1"]);
  t.mock.timers.tick(30_000);
  await Promise.resolve(); await Promise.resolve();
});

test("lote é limitado a 200 MLBs por usuário; o excedente é descartado com aviso", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const { queue, calls } = setup(t);
  queue.enqueue(1, Array.from({ length: 150 }, (_, i) => `MLB${i}`));
  queue.enqueue(1, Array.from({ length: 150 }, (_, i) => `MLB${1000 + i}`));
  t.mock.timers.tick(30_000);
  assert.equal(calls[0].mlbs.length, 200);
  assert.ok(warn.mock.callCount() >= 1);
});
