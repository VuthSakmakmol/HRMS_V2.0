import { apiClient } from "@/shared/services/apiClient.js";
const HR_DASHBOARD_ENDPOINT = "/hr-dashboard";
let dashboardController = null;
export async function fetchHrDashboard(params = {}) {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const response = await apiClient.get(HR_DASHBOARD_ENDPOINT, {
    params,
    signal: dashboardController.signal,
  });
  return response.data.data.dashboard;
}
export async function fetchHrDashboardLookups(params = {}) {
  const response = await apiClient.get(`${HR_DASHBOARD_ENDPOINT}/lookups`, {
    params,
  });
  return response.data.data.lookups;
}
