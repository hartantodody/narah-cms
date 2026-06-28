import { apiFetch } from "@/lib/api";
import type {
  AcceptPoliciesResponse,
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RequiredPoliciesResponse,
  UpdateProfileInput,
  UserResponse,
} from "./auth.types";

export const login = (input: LoginRequest) =>
  apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const register = (input: RegisterRequest) =>
  apiFetch<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getMe = () => apiFetch<CurrentUserResponse>("/auth/me");

export const getRequiredPolicies = () =>
  apiFetch<RequiredPoliciesResponse>("/auth/required-policies");

export const acceptPolicies = (policyDocumentIds: string[]) =>
  apiFetch<AcceptPoliciesResponse>("/auth/accept-policies", {
    method: "POST",
    body: JSON.stringify({
      policyDocumentIds,
    }),
  });

export const updateProfile = (input: UpdateProfileInput) =>
  apiFetch<{ user: UserResponse }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
}) =>
  apiFetch<{ ok: true }>("/auth/me/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
