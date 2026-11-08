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
} from "../controllers/accountController.js";
import { showItems } from "../controllers/itemsController.js";
import { showDashboard } from "../controllers/dashboardController.js";
import {
  showAuthPage,
  saveMlCredentials,
  submitCode,
  oauthCallback,
} from "../controllers/authController.js";
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

const router = Router();

// ===== Publicas (sem login) =====
router.get("/login", showLogin);
router.post("/login", login);
router.get("/register", showRegister);
router.post("/register", register);
router.get("/recuperar-senha", showForgot);
router.post("/recuperar-senha", submitForgot);
router.get("/logout", logout);
router.post("/logout", logout);

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
router.get("/callback", oauthCallback);
router.get("/conta", showAccount);
router.post("/conta/perfil", updateAccountProfile);
router.post("/conta/senha", updateAccountPassword);

router.post("/auth/credentials", saveMlCredentials);
router.post("/auth/code", submitCode);
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

export default router;
