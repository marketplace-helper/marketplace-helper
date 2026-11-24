import { Router } from "express";
import { requireApiAuth } from "../middleware/apiAuth.js";
import * as api from "../controllers/apiController.js";
import ml from "../controllers/mlOAuthController.js";

const router = Router();

// Captura rejeições das funções async e encaminha ao handler de erro JSON.
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ===== Públicas =====
router.post("/login", a(api.login));
router.post("/register", a(api.register));
// O Mercado Livre redireciona o navegador para cá, sem Bearer.
router.get("/ml/oauth/callback", a(ml.callback));
// Notificações do Mercado Livre (items e orders_v2), sem Bearer.
router.post("/ml/webhooks", ml.webhook);

// ===== Protegidas (Authorization: Bearer <token>) =====
router.use(a(requireApiAuth));

router.get("/me", a(api.me));
router.post("/ml/oauth/start", a(ml.apiStart));
router.get("/ml/connection", a(ml.apiStatus));
router.delete("/ml/connection", a(ml.apiDisconnect));
router.get("/dashboard", a(api.dashboard));
router.get("/anuncios", a(api.anuncios));
router.get("/produtos", a(api.produtos));
router.get("/produtos/export", a(api.exportProdutos));
router.post("/produtos/:sku/custo", a(api.saveCusto));
router.post("/produtos/:sku/medidas", a(api.saveMedidas));
router.get("/regras", a(api.getRegras));
router.put("/regras", a(api.saveRegras));
router.get("/tributos/aliquotas", a(api.aliquotasTributos));
router.get("/frete/estimar", a(api.estimarFrete));
router.get("/config", a(api.getConfig));
router.put("/config/cep", a(api.saveZip));
router.post("/sync", a(api.startSync));
router.get("/sync/status", a(api.syncStatus));
router.post("/iot/medidas", a(api.iotMedidas));

export default router;
