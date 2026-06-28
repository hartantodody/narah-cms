import type { UserResponse } from "@/features/auth/auth.types";

export type SiteMemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type SiteMember = {
  id: string;
  role: SiteMemberRole;
  createdAt: string;
  updatedAt: string;
  user: UserResponse;
};

export type SiteMemberListResponse = {
  members: SiteMember[];
};

export type UpdateSiteMemberInput = {
  role: SiteMemberRole;
};

export type UpdateSiteMemberResponse = {
  member: SiteMember;
};

export type RemoveSiteMemberResponse = {
  ok: boolean;
};
