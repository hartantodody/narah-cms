/**
 * Slug utilities for auto-generating site slugs and content type / field
 * apiIds from user-facing labels. Mirrors backend normalization so the
 * preview matches what the API will store.
 */

const DIACRITICS = /[̀-ͯ]/g;

export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toApiId(value: string): string {
  let normalized = value
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const firstLetterIndex = normalized.search(/[a-z]/);
  if (firstLetterIndex > 0) {
    normalized = normalized.slice(firstLetterIndex);
  }

  return normalized;
}
