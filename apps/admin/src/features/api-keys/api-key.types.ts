export type UserSummary = {
  id: string;
  name: string;
  email: string;
};

export type ApiKeyScope = "entries:read" | "entries:read-drafts";

export type ApiKey = {
  id: string;
  siteId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  /** Empty array = any origin allowed. */
  allowedOrigins: string[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
};

export type ListApiKeysResponse = {
  apiKeys: ApiKey[];
};

export type CreateApiKeyResponse = {
  apiKey: ApiKey;
  /** Plaintext shown ONCE on creation. */
  plaintext: string;
};

export type RevokeApiKeyResponse = {
  apiKey: ApiKey;
};

export type CreateApiKeyInput = {
  name: string;
  scopes?: ApiKeyScope[];
  /** ISO date-time. */
  expiresAt?: string;
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
};

export type UpdateApiKeyInput = {
  name?: string;
  scopes?: ApiKeyScope[];
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
};

export type UpdateApiKeyResponse = {
  apiKey: ApiKey;
};
