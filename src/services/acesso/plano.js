// Regras do plano da conta (funções puras, sem banco).
//
// TESTE: conta nova, liberada automaticamente ao confirmar o e-mail, com limites
//        (anúncios por sincronização, atualizações manuais por dia, prazo).
// COMPLETO: uso normal, liberado por um administrador.
// BLOQUEADO: não entra. Qualquer valor desconhecido é tratado como BLOQUEADO.

export const PLANOS = { TESTE: "TESTE", COMPLETO: "COMPLETO", BLOQUEADO: "BLOQUEADO" };

const DIA_MS = 24 * 60 * 60 * 1000;

// Inteiro > 0 vindo da env; qualquer outra coisa cai no padrão.
export function lerInteiroPositivo(valor, padrao) {
  const texto = String(valor ?? "").trim();
  if (!/^\d+$/.test(texto)) return padrao;
  const n = Number(texto);
  return n > 0 ? n : padrao;
}

export function situacaoDoPlano(user, agora = new Date()) {
  const plano = user?.plano;
  const testeAte = user?.testeAte ? new Date(user.testeAte) : null;

  if (plano === PLANOS.COMPLETO) {
    return { plano, podeEntrar: true, emTeste: false, testeExpirado: false, testeAte: null, podeSincronizar: true, podeAutoSync: true };
  }
  if (plano === PLANOS.TESTE) {
    // Sem data de fim só acontece antes de confirmar o e-mail (quando o login já é bloqueado).
    const testeExpirado = testeAte != null && testeAte.getTime() < agora.getTime();
    return { plano, podeEntrar: true, emTeste: true, testeExpirado, testeAte, podeSincronizar: !testeExpirado, podeAutoSync: false };
  }
  return { plano: PLANOS.BLOQUEADO, podeEntrar: false, emTeste: false, testeExpirado: false, testeAte: null, podeSincronizar: false, podeAutoSync: false };
}

export function inicioDoTeste(user, agora, dias) {
  if (user?.plano !== PLANOS.TESTE || user.testeAte != null) return {};
  return { testeAte: new Date(agora.getTime() + dias * DIA_MS) };
}

// Campos gravados quando o e-mail é confirmado: o teste começa junto.
export function dadosDeVerificacao(user, agora, dias) {
  return { emailVerifiedAt: agora, ...inicioDoTeste(user, agora, dias) };
}

// Data "AAAA-MM-DD" no fuso informado.
export function diaLocal(agora, timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

// Conta uma atualização manual do dia. `dados` é o que gravar em Settings quando permitido.
export function consumirSyncManual(settings, { agora, timezone, limite }) {
  const hoje = diaLocal(agora, timezone);
  const usadosHoje = settings?.syncManualDia === hoje ? settings.syncManualQtd || 0 : 0;
  if (usadosHoje >= limite) return { permitido: false, usados: usadosHoje, dados: null };
  const usados = usadosHoje + 1;
  return { permitido: true, usados, dados: { syncManualDia: hoje, syncManualQtd: usados } };
}
