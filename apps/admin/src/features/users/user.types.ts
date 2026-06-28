export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export type UserTier = "FREE" | "PRO";

export type SiteRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type UserListItem = {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  tier: UserTier;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  siteCount: number;
};

export type UserDetail = UserListItem & {
  updatedAt: string;
  memberships: Array<{
    siteId: string;
    siteName: string;
    siteSlug: string;
    role: SiteRole;
  }>;
};

export type UpdateUserInput = {
  name?: string;
  status?: UserStatus;
  tier?: UserTier;
  isSuperAdmin?: boolean;
};
