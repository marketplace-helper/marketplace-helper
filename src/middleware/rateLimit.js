// Limite de tentativas por IP (em memória, janela fixa). Protege cadastro, login e
// envios de e-mail contra robôs. Em produção o app usa `trust proxy`, então req.ip é o IP real.

export const MSG_MUITAS_TENTATIVAS = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

export function criarLimitador({ max, janelaMs }) {
  const janelas = new Map(); // chave -> { inicio, total }

  function limparVencidas(agora) {
    for (const [k, j] of janelas) if (agora - j.inicio >= janelaMs) janelas.delete(k);
  }

  function permitir(chave, agora = Date.now()) {
    if (janelas.size > 10_000) limparVencidas(agora);
    let j = janelas.get(chave);
    if (!j || agora - j.inicio >= janelaMs) {
      j = { inicio: agora, total: 0 };
      janelas.set(chave, j);
    }
    j.total++;
    return j.total <= max;
  }

  return { permitir };
}

// Sem `view`: responde 429 em JSON (API). Com `view`: re-renderiza a tela com a mensagem.
export function limitarPorIp(limitador, { view = null } = {}) {
  return (req, res, next) => {
    if (limitador.permitir(req.ip || "desconhecido")) return next();
    if (!view) return res.status(429).json({ error: MSG_MUITAS_TENTATIVAS });
    const { email, storeName, whatsapp } = req.body || {};
    return res.status(429).render(view, {
      title: view === "register" ? "Criar conta" : "Entrar",
      error: MSG_MUITAS_TENTATIVAS,
      message: null,
      values: { email, storeName, whatsapp },
      unverifiedEmail: null,
    });
  };
}

const HORA = 60 * 60 * 1000;
// Cadastro, reenvio de confirmação e recuperação de senha dividem o mesmo limite (todos enviam e-mail).
export const limiteEnvios = criarLimitador({ max: 5, janelaMs: HORA });
export const limiteLogin = criarLimitador({ max: 20, janelaMs: 15 * 60 * 1000 });
