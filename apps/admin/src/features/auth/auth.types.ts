export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export type UserTier = "FREE" | "PRO";

export type SiteMembershipRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type UserMembership = {
  siteId: string;
  siteSlug: string;
  siteName: string;
  role: SiteMembershipRole;
};

export type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
  tier: UserTier;
  isSuperAdmin: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  name: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: UserResponse;
  requiresPolicyAcceptance: boolean;
  memberships: UserMembership[];
};

export type CurrentUserResponse = {
  user: UserResponse;
  requiresPolicyAcceptance: boolean;
  memberships: UserMembership[];
};

export type PolicyDocumentResponse = {
  id: string;
  type: "PRIVACY_POLICY" | "USER_AGREEMENT";
  version: string;
  title: string;
  content: string;
  accepted: boolean;
};

export type RequiredPoliciesResponse = {
  policies: PolicyDocumentResponse[];
};

export type AcceptPoliciesRequest = {
  policyDocumentIds: string[];
};

export type AcceptPoliciesResponse = {
  ok: boolean;
  requiresPolicyAcceptance: boolean;
};

export type UpdateProfileInput = {
  name?: string;
};
