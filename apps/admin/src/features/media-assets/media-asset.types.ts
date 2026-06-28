export type UserSummary = {
  id: string;
  name: string;
  email: string;
};

export type FocalPoint = { x: number; y: number };

export type MediaAsset = {
  id: string;
  siteId: string;
  filename: string;
  /** Render endpoint URL — transformed derivative, not the original. */
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  width: number | null;
  height: number | null;
  focalPoint: FocalPoint;
  createdAt: string;
  updatedAt: string;
  uploadedBy: UserSummary;
};

export type ListMediaAssetsResponse = {
  items: MediaAsset[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MediaAssetResponse = {
  asset: MediaAsset;
};

export type ListMediaAssetsQuery = {
  search?: string;
  mimeTypePrefix?: string;
  page?: number;
  pageSize?: number;
};

export type UpdateMediaAssetInput = {
  filename?: string;
  altText?: string | null;
  focalPoint?: FocalPoint | null;
};
