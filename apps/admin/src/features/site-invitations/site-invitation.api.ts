import { apiFetch } from "@/lib/api";
import type {
  AcceptInvitationInput,
  AcceptInvitationResponse,
  CreateSiteInvitationInput,
  CreateSiteInvitationResponse,
  RevokeSiteInvitationResponse,
  SiteInvitationListResponse,
} from "./site-invitation.types";

export const getSiteInvitations = (siteId: string) =>
  apiFetch<SiteInvitationListResponse>(`/sites/${siteId}/invitations`);

export const createSiteInvitation = (
  siteId: string,
  input: CreateSiteInvitationInput,
) =>
  apiFetch<CreateSiteInvitationResponse>(`/sites/${siteId}/invitations`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const revokeSiteInvitation = (siteId: string, invitationId: string) =>
  apiFetch<RevokeSiteInvitationResponse>(
    `/sites/${siteId}/invitations/${invitationId}`,
    {
      method: "DELETE",
    },
  );

export const acceptInvitation = (input: AcceptInvitationInput) =>
  apiFetch<AcceptInvitationResponse>("/invitations/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
