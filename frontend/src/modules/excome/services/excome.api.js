import { apiClient } from "@/shared/services/apiClient.js";
const EXCOME_ENDPOINT = "/excome";
let dashboardController = null;
export async function fetchExcome(params = {}, { force = false } = {}) {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const response = await apiClient.get(EXCOME_ENDPOINT, {
    params: force ? { ...params, forceRefresh: "true" } : params,
    signal: dashboardController.signal,
  });
  return response.data.data.dashboard;
}
export async function fetchExcomeLookups(params = {}) {
  const response = await apiClient.get(`${EXCOME_ENDPOINT}/lookups`, {
    params,
  });
  return response.data.data.lookups;
}
