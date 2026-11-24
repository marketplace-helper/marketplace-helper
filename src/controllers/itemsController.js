import { listItems } from "../services/itemService.js";
import { getSettings } from "../services/syncService.js";
import { getAuthStatus } from "../services/mlAuth.js";

export async function showItems(req, res) {
  const userId = req.user.id;
  const { page, search, sort, dir, filter } = req.query;
  const data = await listItems({ userId, page, search, sort, dir, filter });
  const settings = await getSettings(userId);
  const status = await getAuthStatus(userId);

  res.render("items", {
    title: "Anuncios",
    ...data,
    zipCode: settings.zipCode,
    authenticated: status.authenticated,
  });
}
