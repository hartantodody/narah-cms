import { apiFetch } from "@/lib/api";
import type { AuditLogListResponse, AuditLogQuery } from "./audit.types";

function toQueryString(query?: AuditLogQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.siteId) params.set("siteId", query.siteId);
  if (query.userId) params.set("userId", query.userId);
  if (query.action) params.set("action", query.action);
  if (query.entityType) params.set("entityType", query.entityType);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const getGlobalAuditLogs = (query?: AuditLogQuery) =>
  apiFetch<AuditLogListResponse>(`/audit-logs${toQueryString(query)}`);

export const getSiteAuditLogs = (siteId: string, query?: AuditLogQuery) =>
  apiFetch<AuditLogListResponse>(
    `/sites/${siteId}/audit-logs${toQueryString(query)}`,
  );
