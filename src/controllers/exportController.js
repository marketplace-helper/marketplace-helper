import { buildItemsWorkbook, buildProductsWorkbook } from "../services/exportService.js";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function sendWorkbook(res, wb, filename) {
  res.setHeader("Content-Type", XLSX);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

export async function exportExcel(req, res) {
  const wb = await buildItemsWorkbook(req.user.id, req.query.search || "");
  const date = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, wb, `anuncios_${date}.xlsx`);
}

export async function exportProducts(req, res) {
  const wb = await buildProductsWorkbook(req.user.id, req.query.search || "");
  const date = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, wb, `produtos_${date}.xlsx`);
}
