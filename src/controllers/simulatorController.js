import { simulate } from "../services/simulatorService.js";
import { getAuthStatus } from "../services/mlAuth.js";

export async function showSimulator(req, res) {
  const status = await getAuthStatus(req.user.id);
  res.render("simulator", {
    title: "Simulador de Anúncio",
    authenticated: status.authenticated,
    resultado: null,
    values: {},
    error: null,
  });
}

export async function runSimulator(req, res) {
  const userId = req.user.id;
  const status = await getAuthStatus(userId);
  const { title, preco, custo, freteManual } = req.body;
  const values = { title, preco, custo, freteManual };

  if (!status.authenticated) {
    return res.render("simulator", {
      title: "Simulador de Anúncio",
      authenticated: false,
      resultado: null,
      values,
      error: "Autorize o app (tela Autorização) para simular — precisamos da API do ML.",
    });
  }
  if (!title || !preco) {
    return res.render("simulator", {
      title: "Simulador de Anúncio",
      authenticated: true,
      resultado: null,
      values,
      error: "Informe ao menos o título e o preço de venda.",
    });
  }

  try {
    const resultado = await simulate(userId, { title, preco, custo, freteManual });
    res.render("simulator", {
      title: "Simulador de Anúncio",
      authenticated: true,
      resultado,
      values,
      error: null,
    });
  } catch (e) {
    res.render("simulator", {
      title: "Simulador de Anúncio",
      authenticated: true,
      resultado: null,
      values,
      error: "Erro ao simular: " + e.message,
    });
  }
}
