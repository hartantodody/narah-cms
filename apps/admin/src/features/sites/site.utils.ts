import type { SiteStatus } from "./site.types";

const siteStatusLabels: Record<SiteStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
  ARCHIVED: "Archived",
};

export function formatSiteStatus(status: SiteStatus) {
  return siteStatusLabels[status];
}

export function getSiteStatusBadgeVariant(status: SiteStatus) {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "DISABLED":
      return "secondary";
    case "ARCHIVED":
      return "outline";
    default:
      return "outline";
  }
}

export function getSiteStatusBadgeClassName(status: SiteStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-transparent bg-emerald-500/14 text-emerald-300";
    case "DISABLED":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "ARCHIVED":
      return "border-border/80 bg-white/[0.03] text-muted-foreground";
    default:
      return "";
  }
}

export function formatSiteDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
