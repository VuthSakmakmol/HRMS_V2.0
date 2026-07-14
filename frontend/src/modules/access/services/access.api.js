import { apiClient } from "@/shared/services/apiClient.js";
export const fetchPermissions = async () =>
  (await apiClient.get("/access/permissions")).data.data;
export const fetchRoleLookup = async () =>
  (await apiClient.get("/access/lookups/roles")).data.data;
export const fetchScopeLookup = async () =>
  (await apiClient.get("/access/lookups/scopes")).data.data;
export const fetchRoles = async (params = {}) =>
  (await apiClient.get("/access/roles", { params })).data.data;
export const createRole = async (payload) =>
  (await apiClient.post("/access/roles", payload)).data.data.role;
export const updateRole = async (id, payload) =>
  (await apiClient.patch(`/access/roles/${id}`, payload)).data.data.role;
export const deleteRole = async (id) => apiClient.delete(`/access/roles/${id}`);
export const fetchAccounts = async (params = {}) =>
  (await apiClient.get("/access/accounts", { params })).data.data;
export const createAccount = async (payload) =>
  (await apiClient.post("/access/accounts", payload)).data.data.account;
export const updateAccount = async (id, payload) =>
  (await apiClient.patch(`/access/accounts/${id}`, payload)).data.data.account;
export const resetAccountPassword = async (id, password) =>
  apiClient.post(`/access/accounts/${id}/reset-password`, { password });
