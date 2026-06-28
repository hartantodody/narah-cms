export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const isImageMime = (mime: string) => mime.startsWith("image/");

/** Replace or add the `w`/`h`/`q` query params on a render URL. */
export const buildAssetUrl = (
  url: string,
  params: { w?: number; h?: number; q?: number; fit?: string } = {},
): string => {
  try {
    const u = new URL(url, window.location.origin);
    if (params.w !== undefined) u.searchParams.set("w", String(params.w));
    if (params.h !== undefined) u.searchParams.set("h", String(params.h));
    if (params.q !== undefined) u.searchParams.set("q", String(params.q));
    if (params.fit !== undefined) u.searchParams.set("fit", params.fit);
    return u.toString();
  } catch {
    return url;
  }
};
