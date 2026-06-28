import { apiFetch, type PaginatedData } from "@/lib/api";
import type { UpdateUserInput, UserDetail, UserListItem, UserStatus } from "./user.types";

export type ListUsersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
  isSuperAdmin?: boolean;
};

export const listUsers = (params: ListUsersParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status) qs.set("status", params.status);
  if (params.isSuperAdmin !== undefined) {
    qs.set("isSuperAdmin", String(params.isSuperAdmin));
  }
  const query = qs.toString();
  return apiFetch<PaginatedData<UserListItem>>(
    query ? `/users?${query}` : "/users",
  );
};

export const getUser = (userId: string) =>
  apiFetch<{ user: UserDetail }>(`/users/${userId}`);

export const updateUser = (userId: string, input: UpdateUserInput) =>
  apiFetch<{ user: UserDetail }>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
