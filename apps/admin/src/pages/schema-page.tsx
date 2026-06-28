import { useTranslation } from "react-i18next";
import { ContentTypesSection } from "@/features/content-types/content-types-section";
import { useSiteContext } from "@/layouts/site-layout-context";

export function SchemaPage() {
  const { t } = useTranslation();
  const { site, refresh, effectiveRole, isSuperAdmin } = useSiteContext();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          {t("schema.page.breadcrumb")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("schema.page.title")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("schema.page.description")}
        </p>
      </header>

      <ContentTypesSection
        siteId={site.id}
        currentUserRole={effectiveRole}
        isSuperAdmin={isSuperAdmin}
        onContentTypesChanged={refresh}
      />
    </div>
  );
}
