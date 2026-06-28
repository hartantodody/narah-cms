import { getAccessToken } from "@/lib/auth-token";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

const normalizedApiBaseUrl = API_BASE_URL.replace(/\/+$/, "");

export const apiBaseUrl = normalizedApiBaseUrl;

export const POLICY_ACCEPTANCE_REQUIRED_EVENT =
  "narah:policy-acceptance-required";

/* ────────────────────────────────────────────────────────────── */
/* API envelope contract                                         */
/* ────────────────────────────────────────────────────────────── */

/**
 * Narah CMS admin API response envelope. The backend wraps every admin-facing
 * response in this shape so consumers can rely on a uniform contract:
 *
 *   Success: { success: true,  message, data }
 *   Error:   { success: false, message, code?, issues? }
 *
 * For paginated lists, `data` carries `{ items, total, page, pageSize,
 * pageCount }`. Public delivery (`/public/v1/*`) and binary endpoints
 * (`/api/media/*`) keep their own contracts and don't use this envelope.
 */

type ApiSuccessEnvelope<T> = {
  success: true;
  message: string;
  data: T;
};

type ApiErrorEnvelope = {
  success: false;
  message: string;
  code?: string;
  issues?: string[];
};

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const isEnvelope = (value: unknown): value is ApiEnvelope<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "success" in value &&
  typeof (value as { success: unknown }).success === "boolean";

/* ────────────────────────────────────────────────────────────── */
/* ApiError                                                       */
/* ────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: string[];

  constructor({
    message,
    status,
    code,
    issues,
  }: {
    message: string;
    status: number;
    code?: string;
    issues?: string[];
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const isPolicyAcceptanceRequiredError = (error: unknown) =>
  error instanceof ApiError && error.code === "POLICY_ACCEPTANCE_REQUIRED";

export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage = "Something went wrong.",
) => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
};

/* ────────────────────────────────────────────────────────────── */
/* apiFetch                                                       */
/* ────────────────────────────────────────────────────────────── */

/**
 * Fetch from the Narah admin API. Returns the unwrapped `data` payload from
 * the envelope; throws `ApiError` on transport failure, non-2xx HTTP, or
 * `success: false` envelope.
 *
 * Use `T` to type the inner payload — e.g. `apiFetch<{ site: SiteDetail }>(...)`.
 * For paginated lists pass `PaginatedData<T>`.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${normalizedApiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError({
      message:
        "Unable to reach the Narah CMS API. Check that the backend is running and VITE_API_BASE_URL is correct.",
      status: 0,
    });
  }

  const responseText = await response.text();
  const parsed = responseText ? safeParseJson(responseText) : null;

  // Envelope path — the normal case for every admin endpoint.
  if (isEnvelope(parsed)) {
    if (parsed.success) {
      return parsed.data as T;
    }

    if (
      parsed.code === "POLICY_ACCEPTANCE_REQUIRED" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent(POLICY_ACCEPTANCE_REQUIRED_EVENT));
    }

    throw new ApiError({
      message: parsed.message,
      status: response.status,
      code: parsed.code,
      issues: parsed.issues,
    });
  }

  // Fallback — non-envelope responses (legacy or third-party). Treat 2xx as
  // raw payload; non-2xx as a generic error.
  if (response.ok) {
    return parsed as T;
  }

  throw new ApiError({
    message: `Request failed with status ${response.status}.`,
    status: response.status,
  });
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
