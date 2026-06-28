import type { SiteRole } from "@/features/sites/site.types";
import type { ContentEntryStatus } from "./content-entry.types";

const contentEditableRoles = new Set<SiteRole>(["OWNER", "ADMIN", "EDITOR"]);

export function canEditContentEntries({
  isSuperAdmin,
  currentUserRole,
}: {
  isSuperAdmin: boolean;
  currentUserRole: SiteRole | null;
}) {
  return (
    isSuperAdmin ||
    (currentUserRole !== null && contentEditableRoles.has(currentUserRole))
  );
}

export const contentEntryStatusLabel = (status: ContentEntryStatus) =>
  status === "DRAFT" ? "Draft" : status === "PUBLISHED" ? "Published" : "Archived";

export const contentEntryStatusClass = (status: ContentEntryStatus) => {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "ARCHIVED":
      return "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400";
    case "DRAFT":
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
};
