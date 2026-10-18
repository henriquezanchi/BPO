import assert from "node:assert/strict";
import test from "node:test";
import { createPolling } from "../src/lib/polling.ts";
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("consulta sequencialmente e encerra ao confirmar", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve; let calls = 0; const states = [];
  const polling = createPolling({ check: () => { calls++; return new Promise((r) => { resolve = r; }); }, onResult: (r) => r.paid, onState: (s) => states.push(s) });
  t.mock.timers.tick(5000); assert.equal(calls, 1);
  t.mock.timers.tick(20000); polling.retry(); assert.equal(calls, 1);
  resolve({ paid: true }); await flush();
  t.mock.timers.tick(60000); polling.retry(); assert.equal(calls, 1); assert.equal(states.at(-1), "complete");
  polling.dispose();
});

test("falha recuperável faz backoff e permite nova tentativa manual", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0; const states = [];
  const polling = createPolling({ check: async () => { calls++; if(calls === 1) throw new Error("offline"); return true; }, onResult: (r) => r, onState: (s) => states.push(s) });
  t.mock.timers.tick(5000); await flush(); assert.equal(states.at(-1), "error");
  t.mock.timers.tick(5000); assert.equal(calls, 1);
  polling.retry(); await flush(); assert.equal(calls, 2); assert.equal(states.at(-1), "complete"); polling.dispose();
});

test("timeout pausa sem sobrepor consulta pendente; desmontagem ignora resposta tardia", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve; let calls = 0; let results = 0; const states = [];
  const polling = createPolling({ maxDuration: 10000, check: () => { calls++; return new Promise((r) => { resolve = r; }); }, onResult: () => { results++; return true; }, onState: (s) => states.push(s) });
  t.mock.timers.tick(5000); t.mock.timers.tick(5000); assert.equal(states.at(-1), "paused");
  polling.retry(); assert.equal(calls, 1); polling.dispose(); resolve(true); await flush();
  assert.equal(results, 0); t.mock.timers.tick(600000); assert.equal(calls, 1);
});

test("pausa e retoma uma consulta pendente sem declarar pagamento confirmado", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0; const states = [];
  const polling = createPolling({ maxDuration: 10000, interval: 1000, check: async () => { calls++; return false; }, onResult: (r) => r, onState: (s) => states.push(s) });
  t.mock.timers.tick(1000); await flush();t.mock.timers.tick(9000);await flush();assert.equal(states.at(-1), "paused");
  const previous = calls;polling.retry();await flush();assert.equal(calls, previous + 1);assert.equal(states.at(-1), "waiting");polling.dispose();
});
