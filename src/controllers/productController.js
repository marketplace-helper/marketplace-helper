import { listProducts, setCostForSku, setDimsForSku } from "../services/productService.js";
import { getAuthStatus } from "../services/mlAuth.js";
import { getSkuMedidas } from "../services/productService.js";

export async function showProducts(req, res) {
  const userId = req.user.id;
  const { page, search } = req.query;
  const data = await listProducts({ userId, page, search });
  const status = await getAuthStatus(userId);
  res.render("products", {
    title: "Produtos",
    ...data,
    authenticated: status.authenticated,
  });
}

export async function saveProductCost(req, res) {
  const { sku, custo } = req.body;
  if (!sku) return res.status(400).json({ error: "SKU ausente." });
  const result = await setCostForSku(req.user.id, sku, custo);
  res.json({ ok: true, ...result });
}

export async function saveProductDims(req, res) {
  const { sku, largura, altura, comprimento, pesoReal } = req.body;
  if (!sku) return res.status(400).json({ error: "SKU ausente." });
  const result = await setDimsForSku(req.user.id, sku, { largura, altura, comprimento, pesoReal });
  res.json({ ok: true, ...result });
}

export async function pesoDoSku(req, res) {
  const sku = String(req.query.sku || "").trim();
  if (!sku) return res.status(400).json({ ok: false, error: "SKU ausente." });
  const medidas = await getSkuMedidas(req.user.id, sku);
  if (!medidas) return res.status(404).json({ ok: false, error: "Nenhum anúncio com esse SKU." });
  res.json({ ok: true, ...medidas });
}
