import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import type {
  ListMediaAssetsQuery,
  ListMediaAssetsResponse,
  MediaAssetResponse,
  UpdateMediaAssetInput,
} from "./media-asset.types";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

const basePath = (siteId: string) => `/sites/${siteId}/media`;

export function listMediaAssets(
  siteId: string,
  query?: ListMediaAssetsQuery,
) {
  const params = new URLSearchParams();
  if (query?.search?.trim()) params.set("search", query.search.trim());
  if (query?.mimeTypePrefix) params.set("mimeTypePrefix", query.mimeTypePrefix);
  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiFetch<ListMediaAssetsResponse>(
    qs ? `${basePath(siteId)}?${qs}` : basePath(siteId),
  );
}

export const getMediaAsset = (siteId: string, assetId: string) =>
  apiFetch<MediaAssetResponse>(`${basePath(siteId)}/${assetId}`);

/**
 * Upload uses native fetch directly because apiFetch always sets
 * Content-Type: application/json which breaks multipart uploads.
 */
export async function uploadMediaAsset(
  siteId: string,
  file: File,
): Promise<MediaAssetResponse> {
  const form = new FormData();
  form.append("file", file);

  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${basePath(siteId)}`, {
      method: "POST",
      body: form,
      headers,
    });
  } catch {
    throw new ApiError({
      message: "Unable to reach the Narah CMS API.",
      status: 0,
    });
  }

  const text = await response.text();
  const data = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const payload =
      typeof data === "object" && data !== null
        ? (data as { message?: string; code?: string; issues?: string[] })
        : undefined;
    throw new ApiError({
      message:
        payload?.message ?? `Upload failed with status ${response.status}.`,
      status: response.status,
      code: payload?.code,
      issues: payload?.issues,
    });
  }

  return data as MediaAssetResponse;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export const updateMediaAsset = (
  siteId: string,
  assetId: string,
  input: UpdateMediaAssetInput,
) =>
  apiFetch<MediaAssetResponse>(`${basePath(siteId)}/${assetId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteMediaAsset = (siteId: string, assetId: string) =>
  apiFetch<{ id: string; deleted: boolean }>(
    `${basePath(siteId)}/${assetId}`,
    { method: "DELETE" },
  );

/**
 * Trigger a browser download of the original (un-transformed) asset.
 * Hits the auth-gated endpoint, then forces a save dialog.
 */
export async function downloadMediaOriginal(
  siteId: string,
  assetId: string,
  filename: string,
): Promise<void> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(
    `${API_BASE_URL}${basePath(siteId)}/${assetId}/download`,
    { headers },
  );

  if (!response.ok) {
    const text = await response.text();
    const payload = safeParseJson(text);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Download failed with status ${response.status}.`;
    throw new ApiError({ message, status: response.status });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
