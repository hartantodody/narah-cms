import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toSlug } from "@/lib/slug";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSite, updateSite } from "@/features/sites/site.api";
import type {
  CreateSiteInput,
  SiteDetail,
  SiteStatus,
} from "@/features/sites/site.types";
import { getApiErrorMessage } from "@/lib/api";

const siteStatusOptions = ["ACTIVE", "DISABLED", "ARCHIVED"] as const;

const siteFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  slug: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(siteStatusOptions),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

type EditableSite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: SiteStatus;
};

type SiteFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: EditableSite | null;
  onSuccess?: (site: SiteDetail) => Promise<void> | void;
};

function getDefaultValues(site?: EditableSite | null): SiteFormValues {
  return {
    name: site?.name ?? "",
    slug: site?.slug ?? "",
    description: site?.description ?? "",
    status: site?.status ?? "ACTIVE",
  };
}

export function SiteFormDialog({
  open,
  onOpenChange,
  site,
  onSuccess,
}: SiteFormDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(site);
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: getDefaultValues(site),
  });

  // Auto-sync slug from name until the user manually edits the slug field.
  // Editing an existing site disables auto-sync entirely so existing slugs
  // stay stable.
  const slugDirty = useRef(isEditing);
  const watchedName = form.watch("name");

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(getDefaultValues(site));
    slugDirty.current = Boolean(site);
    setErrorMessage(null);
  }, [form, open, site]);

  useEffect(() => {
    if (slugDirty.current) return;
    form.setValue("slug", toSlug(watchedName ?? ""), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, watchedName]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);

    try {
      const createPayload: CreateSiteInput = {
        name: values.name.trim(),
        slug: values.slug?.trim() ? values.slug.trim() : undefined,
        description: values.description?.trim() ? values.description.trim() : null,
      };

      const response = site
        ? await updateSite(site.id, {
            ...createPayload,
            status: values.status,
          })
        : await createSite(createPayload);

      await onSuccess?.(response.site);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          isEditing
            ? "We couldn't update this site right now."
            : "We couldn't create this site right now.",
        ),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            {isEditing ? "Edit site" : "Create site"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the basic details for this site."
              : "Create your first site foundation for Narah CMS."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to save site</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="site-name" className="text-xs font-medium">Name</Label>
            <Input
              id="site-name"
              placeholder="Kaleka Website"
              className="h-9 rounded-lg border-border/80 bg-background/60 text-sm"
              aria-invalid={form.formState.errors.name ? true : undefined}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-slug" className="text-xs font-medium">Slug</Label>
            <Input
              id="site-slug"
              placeholder="kaleka-website"
              className="h-9 rounded-lg border-border/80 bg-background/60 font-mono text-sm"
              {...form.register("slug", {
                onChange: () => {
                  slugDirty.current = true;
                },
              })}
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated from the site name. Edit to customize.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="site-description"
              placeholder="Main website content"
              rows={3}
              className="rounded-lg border-border/80 bg-background/60 text-sm"
              {...form.register("description")}
            />
          </div>

          {isEditing ? (
            <div className="space-y-1.5">
              <Label htmlFor="site-status" className="text-xs font-medium">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="site-status"
                      className="h-9 w-full rounded-lg border-border/80 bg-background/60 text-sm"
                    >
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg border-border/80 bg-background/60 hover:bg-background/80"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-lg bg-primary px-4 hover:bg-primary/90"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save changes"
                  : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
