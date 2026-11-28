import { signToken } from "../config/jwt.js";
import {
  findByEmail, verifyPassword, validatePassword, createUser,
} from "../services/accountService.js";
import { sendVerificationEmail } from "../services/emailAuthService.js";
import { listItems } from "../services/itemService.js";
import { listProducts, setCostForSku, setDimsForSku } from "../services/productService.js";
import { getDashboardData } from "../services/dashboardService.js";
import { getBusinessRules, updateBusinessRules } from "../services/rulesService.js";
import { freteEstimado } from "../services/freteTable.js";
import { runSync, getSyncState, getSettings, updateZipCode } from "../services/syncService.js";
import { getAuthStatus } from "../services/mlAuth.js";
import { criarContextoTributario } from "../services/tributos/contexto.js";
import { carregarAliquotas } from "../services/tributos/aliquotaRepo.js";
import { icmsInternoPorUf } from "../services/tributos/icmsInterno.js";
import { buildProductsWorkbook } from "../services/exportService.js";
import { situacaoDoPlano, MSG_BLOQUEADO } from "../services/acesso/plano.js";
import { config } from "../config/env.js";

const publicUser = (u) => ({
  id: u.id, email: u.email, storeName: u.storeName, whatsapp: u.whatsapp, plano: u.plano, testeAte: u.testeAte,
});

// ===== Autenticação =====
export async function login(req, res) {
  const { email, password } = req.body || {};
  const user = await findByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ error: "E-mail não confirmado. Use o link enviado no cadastro." });
  }
  if (!situacaoDoPlano(user).podeEntrar) {
    return res.status(403).json({ error: MSG_BLOQUEADO });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}

export async function register(req, res) {
  const { email, storeName, whatsapp, password } = req.body || {};
  if (!email || !storeName || !password) {
    return res.status(400).json({ error: "Informe email, storeName e password." });
  }
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (await findByEmail(email)) return res.status(409).json({ error: "E-mail já cadastrado." });
  const user = await createUser({ email, storeName, whatsapp, password });
  // Sem token: a conta só pode ser usada depois de confirmar o e-mail.
  await sendVerificationEmail(user).catch((e) =>
    console.error("[api/register] e-mail de confirmação não enviado:", e.message)
  );
  res.status(201).json({
    message: "Conta criada. Enviamos um link de confirmação para o e-mail informado.",
    user: publicUser(user),
  });
}

export async function me(req, res) {
  const status = await getAuthStatus(req.user.id);
  res.json({
    user: publicUser(req.user),
    mercadoLivre: status,
    situacao: situacaoDoPlano(req.user),
    limites: config.teste,
  });
}

// ===== Dados =====
export async function dashboard(req, res) {
  res.json(await getDashboardData(req.user.id, { ano: req.query.ano }));
}

export async function anuncios(req, res) {
  const { page, search, sort, dir, filter, ano } = req.query;
  res.json(await listItems({ userId: req.user.id, page, search, sort, dir, filter, ano }));
}

export async function produtos(req, res) {
  const { page, search } = req.query;
  res.json(await listProducts({ userId: req.user.id, page, search }));
}

export async function exportProdutos(req, res) {
  const wb = await buildProductsWorkbook(req.user.id, req.query.search || "");
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="produtos_${date}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export async function saveCusto(req, res) {
  const { sku } = req.params;
  if (!sku) return res.status(400).json({ error: "SKU ausente." });
  const r = await setCostForSku(req.user.id, sku, req.body?.custo);
  res.json({ ok: true, ...r });
}

export async function saveMedidas(req, res) {
  const { sku } = req.params;
  if (!sku) return res.status(400).json({ error: "SKU ausente." });
  const { largura, altura, comprimento, pesoReal } = req.body || {};
  const r = await setDimsForSku(req.user.id, sku, { largura, altura, comprimento, pesoReal });
  res.json({ ok: true, ...r });
}

// icmsInternoPorUf: alíquota interna modal de cada UF, para sugerir o ICMS (Presumido/Real).
export async function getRegras(req, res) {
  const [rules, linhas] = await Promise.all([getBusinessRules(req.user.id), carregarAliquotas()]);
  res.json({ ...rules, icmsInternoPorUf: icmsInternoPorUf(linhas) });
}

export async function saveRegras(req, res) {
  const r = await updateBusinessRules(req.user.id, req.body || {});
  res.json({ ok: true, ...r });
}

export function estimarFrete(req, res) {
  const { largura, altura, comprimento, peso, preco } = req.query;
  const est = freteEstimado(largura, altura, comprimento, peso, preco);
  if (!est) return res.status(400).json({ error: "Informe largura, altura, comprimento, peso e preço válidos." });
  res.json(est);
}

export async function getConfig(req, res) {
  const s = await getSettings(req.user.id);
  res.json({ zipCode: s.zipCode, lastSyncAt: s.lastSyncAt });
}

export async function saveZip(req, res) {
  const s = await updateZipCode(req.user.id, req.body?.zipCode);
  res.json({ ok: true, zipCode: s.zipCode });
}

// ===== Sincronização =====
export async function startSync(req, res) {
  const mlbs = Array.isArray(req.body?.mlbs) ? req.body.mlbs : null;
  const state = await runSync(req.user.id, mlbs);
  if (state.negado) return res.status(429).json({ error: state.negado });
  res.json({ ok: true, state });
}

export function syncStatus(req, res) {
  res.json(getSyncState(req.user.id));
}

// ===== IoT (dispositivo ESP32 autenticado com token Bearer) =====
export async function iotMedidas(req, res) {
  const { sku, pesoKg, largura, altura, comprimento } = req.body || {};
  if (!sku) return res.status(400).json({ error: "SKU ausente." });
  const r = await setDimsForSku(req.user.id, sku, { largura, altura, comprimento, pesoReal: pesoKg });
  if (r.afetados === 0) return res.status(404).json({ error: "Nenhum anúncio com esse SKU." });
  const c = r.comparacao || {};
  res.status(201).json({
    ok: true,
    afetados: r.afetados,
    freteReal: c.freteReal ?? null,
    freteCobrado: c.freteCobrado ?? null,
    divergente: !!c.divergente,
    comparacao: r.comparacao,
  });
}

// Alíquotas que valem para o usuário (regime e UF das Regras) hoje ou no ?ano= simulado.
export async function aliquotasTributos(req, res) {
  const ctx = await criarContextoTributario(req.user.id, { ano: req.query.ano });
  res.json({ regime: ctx.regime, ano: ctx.ano, data: ctx.data, aliquotas: ctx.aliquotas });
}
