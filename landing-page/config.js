// ===== Configurações da Landing Page =====

// URL base do sistema Marketplace Helper.
// Local: http://localhost:3333 · Em produção: troque pela URL real do app.
window.APP_URL = "https://app.marketplacehelper.com.br/";

// WhatsApp do botão flutuante.
// Coloque o número com DDI + DDD + número, SÓ DÍGITOS. Ex Brasil: 5511999998888
// Deixe "" (vazio) para esconder o botão.
window.WHATSAPP_NUMBER = "5511999999999";
window.WHATSAPP_MSG = "Olá! Quero saber mais sobre o Marketplace Helper.";

// --- Aplica a URL do app aos botões de login/cadastro ---
document.querySelectorAll("[data-app-link]").forEach(function (a) {
  var path = a.getAttribute("href") || "/login";
  a.setAttribute("href", String(window.APP_URL).replace(/\/$/, "") + path);
});

// --- Monta o link do botão flutuante do WhatsApp ---
(function () {
  var wa = document.getElementById("wa-float");
  if (!wa) return;
  var num = String(window.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (num.length >= 10) {
    wa.href = "https://wa.me/" + num + "?text=" + encodeURIComponent(window.WHATSAPP_MSG || "");
  } else {
    wa.style.display = "none";
  }
})();
