import { apiClient } from "@/shared/services/apiClient.js";
const EXCOME_ENDPOINT = "/excome";
let dashboardController = null;
export async function fetchExcome(params = {}) {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const response = await apiClient.get(EXCOME_ENDPOINT, {
    params,
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
