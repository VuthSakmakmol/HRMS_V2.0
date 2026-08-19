import { apiClient } from "@/shared/services/apiClient.js";
const EXCOM_ENDPOINT = "/excom";
let dashboardController = null;
export async function fetchExcom(params = {}, { force = false } = {}) {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const response = await apiClient.get(EXCOM_ENDPOINT, {
    params: force ? { ...params, forceRefresh: "true" } : params,
    signal: dashboardController.signal,
  });
  return response.data.data.dashboard;
}
export async function fetchExcomLookups(params = {}) {
  const response = await apiClient.get(`${EXCOM_ENDPOINT}/lookups`, {
    params,
  });
  return response.data.data.lookups;
}
