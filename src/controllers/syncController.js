import { runSync, getSyncState, updateZipCode } from "../services/syncService.js";
import { getAuthStatus } from "../services/mlAuth.js";

export async function startSync(req, res) {
  const userId = req.user.id;
  const status = await getAuthStatus(userId);
  if (!status.authenticated) {
    return res.status(401).json({ error: "Autorize o app primeiro." });
  }
  const state = await runSync(userId);
  if (state.negado) return res.status(429).json({ error: state.negado });
  res.json({ ok: true, state });
}

export async function startSyncSelection(req, res) {
  const userId = req.user.id;
  const status = await getAuthStatus(userId);
  if (!status.authenticated) {
    return res.status(401).json({ error: "Autorize o app primeiro." });
  }
  const mlbs = Array.isArray(req.body?.mlbs) ? req.body.mlbs : [];
  if (mlbs.length === 0) {
    return res.status(400).json({ error: "Nenhum anuncio selecionado." });
  }
  const state = await runSync(userId, mlbs);
  if (state.negado) return res.status(429).json({ error: state.negado });
  res.json({ ok: true, state });
}

export function syncStatus(req, res) {
  res.json(getSyncState(req.user.id));
}

export async function saveZipCode(req, res) {
  await updateZipCode(req.user.id, req.body.zipCode);
  res.redirect(req.get("referer") || "/");
}
