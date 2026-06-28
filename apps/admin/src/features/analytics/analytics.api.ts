import { apiFetch } from "@/lib/api";
import type {
  AnalyticsConfigResponse,
  AnalyticsOverview,
  SetAnalyticsConfigInput,
} from "./analytics.types";

const base = (siteId: string) => `/sites/${siteId}/analytics`;

export const getAnalyticsConfig = (siteId: string) =>
  apiFetch<{ config: AnalyticsConfigResponse }>(`${base(siteId)}/config`);

export const setAnalyticsConfig = (
  siteId: string,
  input: SetAnalyticsConfigInput,
) =>
  apiFetch<{ config: AnalyticsConfigResponse }>(`${base(siteId)}/config`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const deleteAnalyticsConfig = (siteId: string) =>
  apiFetch<{ config: AnalyticsConfigResponse }>(`${base(siteId)}/config`, {
    method: "DELETE",
  });

export const getAnalyticsOverview = (siteId: string) =>
  apiFetch<AnalyticsOverview>(`${base(siteId)}/overview`);
