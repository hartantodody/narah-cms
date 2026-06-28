import { apiFetch } from "@/lib/api";
import type {
  RemoveSiteMemberResponse,
  SiteMemberListResponse,
  UpdateSiteMemberInput,
  UpdateSiteMemberResponse,
} from "./site-member.types";

export const getSiteMembers = (siteId: string) =>
  apiFetch<SiteMemberListResponse>(`/sites/${siteId}/members`);

export const updateSiteMember = (
  siteId: string,
  memberId: string,
  input: UpdateSiteMemberInput,
) =>
  apiFetch<UpdateSiteMemberResponse>(`/sites/${siteId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const removeSiteMember = (siteId: string, memberId: string) =>
  apiFetch<RemoveSiteMemberResponse>(`/sites/${siteId}/members/${memberId}`, {
    method: "DELETE",
  });
