import { test } from "node:test";
import assert from "node:assert/strict";
import { criarLimitador, limitarPorIp, MSG_MUITAS_TENTATIVAS } from "../../src/middleware/rateLimit.js";

test("permite até o máximo na janela e nega o excedente", () => {
  const l = criarLimitador({ max: 5, janelaMs: 1000 });
  for (let i = 0; i < 5; i++) assert.equal(l.permitir("1.1.1.1", 100), true);
  assert.equal(l.permitir("1.1.1.1", 200), false);
});

test("outra chave não é afetada", () => {
  const l = criarLimitador({ max: 1, janelaMs: 1000 });
  assert.equal(l.permitir("a", 0), true);
  assert.equal(l.permitir("a", 1), false);
  assert.equal(l.permitir("b", 1), true);
});

test("depois da janela volta a permitir", () => {
  const l = criarLimitador({ max: 1, janelaMs: 1000 });
  assert.equal(l.permitir("a", 0), true);
  assert.equal(l.permitir("a", 999), false);
  assert.equal(l.permitir("a", 1000), true);
});

test("middleware: API recebe 429 em JSON; web recebe a página com a mensagem", () => {
  const l = criarLimitador({ max: 0 + 1, janelaMs: 60_000 });
  const render = (view) => limitarPorIp(l, { view });
  const resposta = () => {
    const r = { statusCode: 200, body: null, view: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.render = (v, data) => { r.view = v; r.body = data; return r; };
    return r;
  };
  let proximos = 0;
  const next = () => { proximos++; };
  const api = limitarPorIp(l);
  api({ ip: "9.9.9.9", body: {} }, resposta(), next);
  const r1 = resposta();
  api({ ip: "9.9.9.9", body: {} }, r1, next);
  assert.equal(proximos, 1);
  assert.deepEqual([r1.statusCode, r1.body], [429, { error: MSG_MUITAS_TENTATIVAS }]);

  const r2 = resposta();
  render("register")({ ip: "9.9.9.9", body: { email: "x@y.com" } }, r2, next);
  assert.deepEqual([r2.statusCode, r2.view, r2.body.error], [429, "register", MSG_MUITAS_TENTATIVAS]);
  assert.equal(MSG_MUITAS_TENTATIVAS, "Muitas tentativas. Aguarde alguns minutos e tente de novo.");
});
