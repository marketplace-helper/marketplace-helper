import { test } from "node:test";
import assert from "node:assert/strict";
import { ehAmbienteLocal } from "../../src/config/env.js";
import { formatarEmailLocal } from "../../src/services/mailService.js";
import { limitarPorIp, criarLimitador } from "../../src/middleware/rateLimit.js";

test("local = sem NODE_ENV=production e fora do Railway", () => {
  assert.equal(ehAmbienteLocal({}), true);
  assert.equal(ehAmbienteLocal({ NODE_ENV: "development" }), true);
  assert.equal(ehAmbienteLocal({ NODE_ENV: "production" }), false);
  assert.equal(ehAmbienteLocal({ RAILWAY_ENVIRONMENT: "staging" }), false);
});

test("e-mail local mostra destinatário, template e os links", () => {
  const txt = formatarEmailLocal({
    to: ["a@x.com", "b@x.com"],
    template: "confirmar-email",
    variables: { STORE_NAME: "Loja", ACTION_URL: "http://localhost:3333/confirmar-email?token=abc" },
  });
  assert.match(txt, /confirmar-email/);
  assert.match(txt, /a@x\.com, b@x\.com/);
  assert.match(txt, /ACTION_URL: http:\/\/localhost:3333\/confirmar-email\?token=abc/);
});

test("limite por IP desligado deixa tudo passar", () => {
  const mw = limitarPorIp(criarLimitador({ max: 1, janelaMs: 60_000 }), { ativo: false });
  let passou = 0;
  for (let i = 0; i < 5; i++) mw({ ip: "1.1.1.1" }, {}, () => passou++);
  assert.equal(passou, 5);
});
