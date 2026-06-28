export type AnalyticsConfigResponse =
  | { connected: false }
  | { connected: true; propertyId: string; updatedAt: string };

export type AnalyticsRow = { label: string; value: number };

export type AnalyticsDailyPoint = {
  date: string; // YYYY-MM-DD
  users: number;
  pageViews: number;
};

export type AnalyticsOverview = {
  propertyId: string;
  range: { days: number };
  summary: {
    activeUsers: number;
    pageViews: number;
    sessions: number;
    bounceRate: number;
  };
  topPages: AnalyticsRow[];
  sources: AnalyticsRow[];
  dailySeries: AnalyticsDailyPoint[];
};

export type SetAnalyticsConfigInput = {
  propertyId: string;
  serviceAccount: string;
};
