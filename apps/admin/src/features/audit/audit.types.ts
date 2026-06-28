export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  siteId: string | null;
  userId: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
  site: { id: string; name: string; slug: string } | null;
};

export type AuditLogListResponse = {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AuditLogQuery = {
  page?: number;
  pageSize?: number;
  siteId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
};
