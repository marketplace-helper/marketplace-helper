import { updateBusinessRules } from "../services/rulesService.js";
import { getAuthStatus } from "../services/mlAuth.js";
import { calcularCustoProduto } from "../services/calcService.js";
import { criarContextoTributario, montarContexto } from "../services/tributos/contexto.js";
import { carregarAliquotas } from "../services/tributos/aliquotaRepo.js";
import { ANOS_SIMULAVEIS, REGIMES, REGIME_LABEL, UFS } from "../services/tributos/constantes.js";

// Produto didático usado no exemplo da tela.
const EXEMPLO = { precoPor: 100, custoProduto: 40, comissao: 11.5, frete: 9.9 };

export async function showRules(req, res) {
  const userId = req.user.id;
  const ctx = await criarContextoTributario(userId);
  const linhas = await carregarAliquotas();
  const status = await getAuthStatus(userId);

  // Mesmo produto calculado hoje e nos anos simuláveis, com as regras do usuário.
  const exemplos = [null, ...ANOS_SIMULAVEIS].map((ano) => ({
    ano,
    ...calcularCustoProduto(EXEMPLO, ano == null ? ctx : montarContexto(ctx.rules, linhas, { ano })),
  }));

  res.render("rules", {
    title: "Regras de Negócio",
    rules: ctx.rules,
    regime: ctx.regime,
    aliquotas: Object.values(ctx.aliquotas),
    REGIMES,
    REGIME_LABEL,
    UFS,
    authenticated: status.authenticated,
    message: req.query.message || null,
    exemplo: EXEMPLO,
    exemplos,
  });
}

export async function saveRules(req, res) {
  // Checkbox desmarcado não vem no formulário: aqui ausente = desligado.
  await updateBusinessRules(req.user.id, { ...req.body, creditoCompra: req.body.creditoCompra ?? "0" });
  res.redirect("/regras?message=" + encodeURIComponent("Regras salvas com sucesso!"));
}
