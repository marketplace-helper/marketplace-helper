import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  showLogin,
  login,
  showRegister,
  register,
  logout,
  showAccount,
  updateAccountProfile,
  updateAccountPassword,
  showForgot,
  submitForgot,
  showResetPassword,
  submitResetPassword,
  showCheckEmail,
  resendVerification,
  confirmEmail,
  cancelAccountEmailChange,
  confirmAccountEmailChange,
} from "../controllers/accountController.js";
import { showItems } from "../controllers/itemsController.js";
import { showDashboard } from "../controllers/dashboardController.js";
import { showAuthPage } from "../controllers/authController.js";
import mlOAuth from "../controllers/mlOAuthController.js";
import {
  startSync,
  startSyncSelection,
  syncStatus,
  saveZipCode,
} from "../controllers/syncController.js";
import { exportExcel, exportProducts } from "../controllers/exportController.js";
import { showRules, saveRules } from "../controllers/rulesController.js";
import { showSimulator, runSimulator } from "../controllers/simulatorController.js";
import { showProducts, saveProductCost, saveProductDims, pesoDoSku} from "../controllers/productController.js";
import { showFrete } from "../controllers/freteController.js";
import { showMedir } from "../controllers/medirController.js";
import { showAcao, aplicarAcao } from "../controllers/adminController.js";
import { limitarPorIp, limiteEnvios, limiteLogin, LIMITES_ATIVOS } from "../middleware/rateLimit.js";
import {
  classificar,
  classificarLote,
  enviarFeedback,
} from "../controllers/classifierController.js";

const router = Router();

// ===== Publicas (sem login) =====
router.get("/login", showLogin);
router.post("/login", limitarPorIp(limiteLogin, { view: "login", ativo: LIMITES_ATIVOS }), login);
router.get("/register", showRegister);
router.post("/register", limitarPorIp(limiteEnvios, { view: "register", ativo: LIMITES_ATIVOS }), register);
router.get("/recuperar-senha", showForgot);
router.post("/recuperar-senha", limitarPorIp(limiteEnvios, { view: "login", ativo: LIMITES_ATIVOS }), submitForgot);
router.get("/redefinir-senha", showResetPassword);
router.post("/redefinir-senha", submitResetPassword);
router.get("/verifique-email", showCheckEmail);
router.post("/confirmar-email/reenviar", limitarPorIp(limiteEnvios, { view: "login", ativo: LIMITES_ATIVOS }), resendVerification);
router.get("/confirmar-email", confirmEmail);
router.get("/confirmar-novo-email", confirmAccountEmailChange);
router.get("/logout", logout);
router.post("/logout", logout);

// Links enviados aos administradores (o token é a autorização).
router.get("/admin/contas/acao", showAcao);
router.post("/admin/contas/acao", aplicarAcao);

// ===== Daqui pra baixo exige login =====
router.use(requireAuth);

router.get("/", showDashboard);
router.get("/anuncios", showItems);
router.get("/dashboard", showDashboard);
router.get("/produtos", showProducts);
router.get("/medir", showMedir);
router.get("/medir/peso", requireAuth, pesoDoSku);
router.get("/regras", showRules);
router.get("/simulador", showSimulator);
router.get("/frete", showFrete);
router.get("/auth", showAuthPage);
router.get("/ml/conectar", mlOAuth.connect);
router.post("/ml/desconectar", mlOAuth.disconnect);
router.get("/conta", showAccount);
router.post("/conta/perfil", updateAccountProfile);
router.post("/conta/email/cancelar", cancelAccountEmailChange);
router.post("/conta/senha", updateAccountPassword);

router.post("/sync", startSync);
router.post("/sync/selection", startSyncSelection);
router.get("/sync/status", syncStatus);
router.post("/settings/zip", saveZipCode);
router.post("/produtos/custo", saveProductCost);
router.post("/produtos/medidas", saveProductDims);
router.post("/regras", saveRules);
router.post("/simulador", runSimulator);
router.get("/export", exportExcel);
router.get("/produtos/export", exportProducts);

router.get("/anuncios/:id/classificacao", classificar);
router.post("/anuncios/classificacao-lote", classificarLote);
router.post("/anuncios/:id/classificacao/feedback", enviarFeedback);

export default router;
