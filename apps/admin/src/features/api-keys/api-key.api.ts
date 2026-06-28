import { apiFetch } from "@/lib/api";
import type {
  CreateApiKeyInput,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  RevokeApiKeyResponse,
  UpdateApiKeyInput,
  UpdateApiKeyResponse,
} from "./api-key.types";

const basePath = (siteId: string) => `/sites/${siteId}/api-keys`;

export const listApiKeys = (siteId: string, search?: string) => {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  const qs = params.toString();
  return apiFetch<ListApiKeysResponse>(
    qs ? `${basePath(siteId)}?${qs}` : basePath(siteId),
  );
};

export const createApiKey = (siteId: string, input: CreateApiKeyInput) =>
  apiFetch<CreateApiKeyResponse>(basePath(siteId), {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateApiKey = (
  siteId: string,
  apiKeyId: string,
  input: UpdateApiKeyInput,
) =>
  apiFetch<UpdateApiKeyResponse>(`${basePath(siteId)}/${apiKeyId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const revokeApiKey = (siteId: string, apiKeyId: string) =>
  apiFetch<RevokeApiKeyResponse>(
    `${basePath(siteId)}/${apiKeyId}/revoke`,
    { method: "POST" },
  );

export const deleteApiKey = (siteId: string, apiKeyId: string) =>
  apiFetch<{ id: string; deleted: boolean }>(
    `${basePath(siteId)}/${apiKeyId}`,
    { method: "DELETE" },
  );
