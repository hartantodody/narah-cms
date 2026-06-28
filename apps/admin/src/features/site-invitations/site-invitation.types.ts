export type SiteInvitationRole = "ADMIN" | "EDITOR" | "VIEWER";
export type SiteInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export type SiteInvitation = {
  id: string;
  email: string;
  role: SiteInvitationRole;
  status: SiteInvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    name: string | null;
  };
  inviteUrl: string | null;
};

export type SiteInvitationListResponse = {
  invitations: SiteInvitation[];
};

export type CreateSiteInvitationInput = {
  email: string;
  role: SiteInvitationRole;
};

export type CreateSiteInvitationResponse = {
  invitation: SiteInvitation;
  inviteUrl: string;
};

export type RevokeSiteInvitationResponse = {
  ok: boolean;
};

export type AcceptInvitationInput = {
  token: string;
  name?: string;
  password?: string;
};

export type AcceptInvitationResponse = {
  ok: boolean;
  mode: "EXISTING_USER" | "NEW_USER";
  message: string;
};
