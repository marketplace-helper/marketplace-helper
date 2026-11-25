import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminService } from "../../src/services/acesso/adminService.js";

// Banco, tokens e envio de e-mail em memória.
function setup({ adminEmails = ["a@x.com", "b@x.com"], users = null } = {}) {
  const db = {
    users: new Map((users || [{ id: 7, email: "loja@x.com", storeName: "Loja", whatsapp: "119", plano: "TESTE" }]).map((u) => [u.id, { ...u }])),
  };
  const prisma = {
    user: {
      findUnique: async ({ where }) => (db.users.has(where.id) ? { ...db.users.get(where.id) } : null),
      update: async ({ where, data }) => { const u = { ...db.users.get(where.id), ...data }; db.users.set(where.id, u); return { ...u }; },
      findMany: async ({ where }) => [...db.users.values()].filter((u) =>
        u.plano === where.plano && u.testeAte && u.testeAte < where.testeAte.lt && (u.testeAvisoEm ?? null) === where.testeAvisoEm),
    },
  };
  const emitidos = new Map(); // token -> { userId, type, usado }
  let seq = 0;
  const tokens = {
    issueToken: async (userId, type) => { const token = `t${++seq}`; emitidos.set(token, { id: seq, userId, type, usado: false }); return { token, record: { id: seq } }; },
    findValidToken: async (token, type) => { const r = emitidos.get(token); return r && r.type === type && !r.usado ? { ...r, token } : null; },
    consumeToken: async (record) => { const r = emitidos.get(record.token); if (!r || r.usado) return false; r.usado = true; return true; },
  };
  const enviados = [];
  const sendTemplateEmail = async (msg) => { enviados.push(msg); return "id"; };
  const svc = createAdminService({ prisma, tokens, sendTemplateEmail, config: { adminEmails, appUrl: "https://app.test" } });
  return { svc, db, enviados, emitidos };
}
const tokenDe = (url) => new URL(url).searchParams.get("token");

test("sem ADMIN_EMAILS não envia nada", async () => {
  const { svc, enviados } = setup({ adminEmails: [] });
  assert.equal(await svc.avisarAdmins({ id: 7, email: "loja@x.com", storeName: "Loja" }, "Nova conta em teste"), false);
  assert.equal(enviados.length, 0);
});

test("um e-mail para todos os admins com links de liberar e bloquear", async () => {
  const { svc, enviados } = setup();
  assert.equal(await svc.avisarAdmins({ id: 7, email: "loja@x.com", storeName: "Loja", whatsapp: "119" }, "Nova conta em teste"), true);
  assert.equal(enviados.length, 1);
  const [m] = enviados;
  assert.deepEqual(m.to, ["a@x.com", "b@x.com"]);
  assert.equal(m.template, "admin-conta");
  assert.equal(m.variables.MOTIVO, "Nova conta em teste");
  assert.equal(m.variables.EMAIL, "loja@x.com");
  assert.ok(m.variables.LIBERAR_URL.startsWith("https://app.test/admin/contas/acao?token="));
  assert.notEqual(tokenDe(m.variables.LIBERAR_URL), tokenDe(m.variables.BLOQUEAR_URL));
});

test("abrir o link (GET) não aplica a ação nem gasta o token", async () => {
  const { svc, db, enviados } = setup();
  await svc.avisarAdmins(db.users.get(7), "Nova conta em teste");
  const t = tokenDe(enviados[0].variables.LIBERAR_URL);
  const v = await svc.verAcao(t);
  assert.equal(v.acao, "LIBERAR");
  assert.equal(v.user.id, 7);
  assert.equal(db.users.get(7).plano, "TESTE");
  assert.ok(await svc.verAcao(t));
});

test("liberar deixa a conta COMPLETO e avisa o usuário; o link vale uma vez", async () => {
  const { svc, db, enviados } = setup();
  await svc.avisarAdmins(db.users.get(7), "Nova conta em teste");
  const t = tokenDe(enviados[0].variables.LIBERAR_URL);
  const r = await svc.aplicarAcao(t);
  assert.deepEqual([r.ok, r.acao], [true, "LIBERAR"]);
  assert.equal(db.users.get(7).plano, "COMPLETO");
  const aviso = enviados.find((e) => e.template === "conta-liberada");
  assert.equal(aviso.to, "loja@x.com");
  assert.equal(aviso.variables.ACTION_URL, "https://app.test/login");
  assert.deepEqual(await svc.aplicarAcao(t), { ok: false });
});

test("bloquear deixa a conta BLOQUEADO sem e-mail ao usuário", async () => {
  const { svc, db, enviados } = setup();
  await svc.avisarAdmins(db.users.get(7), "Nova conta em teste");
  const r = await svc.aplicarAcao(tokenDe(enviados[0].variables.BLOQUEAR_URL));
  assert.deepEqual([r.ok, r.acao], [true, "BLOQUEAR"]);
  assert.equal(db.users.get(7).plano, "BLOQUEADO");
  assert.equal(enviados.filter((e) => e.template === "conta-liberada").length, 0);
});

test("token inválido não mostra nem aplica nada", async () => {
  const { svc } = setup();
  assert.equal(await svc.verAcao("nao-existe"), null);
  assert.equal(await svc.verAcao(undefined), null);
  assert.deepEqual(await svc.aplicarAcao("nao-existe"), { ok: false });
});
