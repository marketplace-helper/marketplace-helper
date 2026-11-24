import { getDashboardData } from "../services/dashboardService.js";
import { getAuthStatus } from "../services/mlAuth.js";

export async function showDashboard(req, res) {
  const userId = req.user.id;
  const data = await getDashboardData(userId);
  const status = await getAuthStatus(userId);
  res.render("dashboard", {
    title: "Dashboard",
    ...data,
    authenticated: status.authenticated,
  });
}
