import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Lock,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AnalyticsSettingsSection } from "@/features/analytics/analytics-settings-section";
import { useSiteContext } from "@/layouts/site-layout-context";
import { archiveSite, updateSite } from "@/features/sites/site.api";
import type { SiteStatus } from "@/features/sites/site.types";
import { getApiErrorMessage } from "@/lib/api";

const siteStatusOptions: readonly SiteStatus[] = ["ACTIVE", "DISABLED", "ARCHIVED"] as const;

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and dashes only."),
  description: z.string().trim().optional(),
  status: z.enum(siteStatusOptions),
});

type FormValues = z.infer<typeof formSchema>;

export function SiteSettingsPage() {
  const { site, refresh, effectiveRole } = useSiteContext();
  const navigate = useNavigate();

  // OWNER only.
  if (effectiveRole !== "OWNER") {
    return <Navigate to={`/s/${site.id}`} replace />;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          site / settings
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Update site identity, control visibility, and manage the lifecycle of
          this site.
        </p>
      </header>

      <GeneralSection site={site} onSaved={refresh} />
      <AnalyticsSettingsSection siteId={site.id} canManage={true} />
      <DangerZone
        siteName={site.name}
        siteId={site.id}
        isArchived={site.status === "ARCHIVED"}
        onArchived={() => navigate("/sites", { replace: true })}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Section: General — name, slug, description, status            */
/* ────────────────────────────────────────────────────────────── */

function GeneralSection({
  site,
  onSaved,
}: {
  site: ReturnType<typeof useSiteContext>["site"];
  onSaved: () => Promise<void>;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: site.name,
      slug: site.slug,
      description: site.description ?? "",
      status: site.status,
    },
  });

  // Reset when site changes (e.g. user navigates to a different site or
  // refresh brought updated data).
  useEffect(() => {
    form.reset({
      name: site.name,
      slug: site.slug,
      description: site.description ?? "",
      status: site.status,
    });
  }, [form, site]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      await updateSite(site.id, {
        name: values.name,
        slug: values.slug,
        description: values.description?.trim() ? values.description : null,
        status: values.status,
      });
      await onSaved();
      setSavedAt(Date.now());
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "We couldn't save these changes."));
    }
  });

  return (
    <SettingsSection
      title="General"
      description="Public identity and how this site appears across the API and admin."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to save</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="settings-name" error={form.formState.errors.name?.message}>
            <Input
              id="settings-name"
              className="h-9 rounded-md text-sm"
              aria-invalid={form.formState.errors.name ? true : undefined}
              {...form.register("name")}
            />
          </Field>

          <Field
            label="Slug"
            htmlFor="settings-slug"
            error={form.formState.errors.slug?.message}
            hint="Used in URLs and API paths. Lowercase, dashes only."
          >
            <Input
              id="settings-slug"
              className="h-9 rounded-md font-mono text-sm"
              aria-invalid={form.formState.errors.slug ? true : undefined}
              {...form.register("slug")}
            />
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="settings-description"
          error={form.formState.errors.description?.message}
          hint="A short tagline for this site. Shown across admin lists."
        >
          <Textarea
            id="settings-description"
            rows={3}
            className="rounded-md text-sm"
            {...form.register("description")}
          />
        </Field>

        <Field
          label="Status"
          htmlFor="settings-status"
          hint="DISABLED hides this site from members and rejects API key traffic. ARCHIVED hides it from default lists."
        >
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="settings-status" className="h-9 w-full rounded-md text-sm md:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {siteStatusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <div className="flex items-center justify-between pt-2">
          <SavedIndicator savedAt={savedAt} dirty={form.formState.isDirty} />
          <Button
            type="submit"
            size="sm"
            className="gap-1.5"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting ? (
              <>
                <Spinner className="size-3.5" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Section: Analytics (placeholder — see docs/future-analytics)  */
/* ────────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────── */
/* Section: Danger zone                                          */
/* ────────────────────────────────────────────────────────────── */

function DangerZone({
  siteName,
  siteId,
  isArchived,
  onArchived,
}: {
  siteName: string;
  siteId: string;
  isArchived: boolean;
  onArchived: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setIsArchiving(true);
    setError(null);
    try {
      await archiveSite(siteId);
      setIsOpen(false);
      onArchived();
    } catch (e) {
      setError(getApiErrorMessage(e, "We couldn't archive this site."));
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Lock className="size-3.5" />
          Danger zone
        </h2>
        <p className="text-xs text-muted-foreground">
          Irreversible (or hard-to-reverse) actions. OWNER only.
        </p>
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium">Archive this site</p>
            <p className="text-xs leading-5 text-muted-foreground">
              The site is hidden from the default sites list and removed from
              navigation. Content and members are preserved. Currently the only
              available lifecycle action.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5"
            disabled={isArchived}
            onClick={() => setIsOpen(true)}
          >
            <Archive className="size-3.5" />
            {isArchived ? "Already archived" : "Archive site"}
          </Button>
        </div>
      </div>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {siteName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The site will be archived and hidden from the default lists. Members
              and content are preserved. You can restore it by re-activating the
              status from the API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isArchiving}
              onClick={handleArchive}
            >
              {isArchiving ? "Archiving…" : "Archive site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Shared building blocks                                        */
/* ────────────────────────────────────────────────────────────── */

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border border-border/40 bg-foreground/2 p-5 dark:bg-white/2">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </Label>
        {error ? <span className="text-[0.7rem] text-destructive">{error}</span> : null}
      </div>
      {children}
      {hint && !error ? <p className="text-[0.7rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SavedIndicator({ savedAt, dirty }: { savedAt: number | null; dirty: boolean }) {
  if (dirty) {
    return <span className="text-[0.7rem] text-muted-foreground">Unsaved changes</span>;
  }
  if (!savedAt) {
    return <span className="text-[0.7rem] text-muted-foreground">No changes</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-3" />
      Saved
    </span>
  );
}
