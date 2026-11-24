import { getBusinessRules, updateBusinessRules } from "../services/rulesService.js";
import { getAuthStatus } from "../services/mlAuth.js";

export async function showRules(req, res) {
  const userId = req.user.id;
  const rules = await getBusinessRules(userId);
  const status = await getAuthStatus(userId);

  // Exemplo didático usando as alíquotas que o usuário salvou
  const ex = { precoPor: 100, custo: 40, comissao: 11.5, frete: 9.9 };
  const base = ex.precoPor;
  const icmsVal = (base * (rules.icms || 0)) / 100;
  const ipiVal = (base * (rules.ipi || 0)) / 100;
  const difalVal = (base * (rules.difal || 0)) / 100;
  const custoOpVal = (base * (rules.custoOperacional || 0)) / 100;
  const impostos = icmsVal + ipiVal + difalVal + custoOpVal;
  const lucro = base - ex.custo - ex.comissao - ex.frete - impostos;
  const margem = base > 0 ? (lucro / base) * 100 : 0;

  res.render("rules", {
    title: "Regras de Negócio",
    rules,
    authenticated: status.authenticated,
    message: req.query.message || null,
    exemplo: { ...ex, base, icmsVal, ipiVal, difalVal, custoOpVal, impostos, lucro, margem },
  });
}

export async function saveRules(req, res) {
  await updateBusinessRules(req.user.id, req.body);
  res.redirect("/regras?message=" + encodeURIComponent("Regras salvas com sucesso!"));
}
