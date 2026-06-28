import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toApiId } from "@/lib/slug";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createContentType,
  updateContentType,
} from "@/features/content-types/content-type.api";
import type {
  ContentTypeDetail,
  CreateContentTypeInput,
} from "@/features/content-types/content-type.types";
import { getApiErrorMessage } from "@/lib/api";

const contentTypeFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  apiId: z.string().optional(),
  description: z.string().optional(),
  isSingleton: z.boolean(),
});

type ContentTypeFormValues = z.infer<typeof contentTypeFormSchema>;

type EditableContentType = {
  id: string;
  name: string;
  apiId: string;
  description: string | null;
  isSingleton: boolean;
};

type ContentTypeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  contentType?: EditableContentType | null;
  onSuccess?: (contentType: ContentTypeDetail) => Promise<void> | void;
};

function getDefaultValues(
  contentType?: EditableContentType | null,
): ContentTypeFormValues {
  return {
    name: contentType?.name ?? "",
    apiId: contentType?.apiId ?? "",
    description: contentType?.description ?? "",
    isSingleton: contentType?.isSingleton ?? false,
  };
}

export function ContentTypeFormDialog({
  open,
  onOpenChange,
  siteId,
  contentType,
  onSuccess,
}: ContentTypeFormDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(contentType);
  const form = useForm<ContentTypeFormValues>({
    resolver: zodResolver(contentTypeFormSchema),
    defaultValues: getDefaultValues(contentType),
  });

  const apiIdDirty = useRef(isEditing);
  const watchedName = form.watch("name");

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(getDefaultValues(contentType));
    apiIdDirty.current = Boolean(contentType);
    setErrorMessage(null);
  }, [contentType, form, open]);

  useEffect(() => {
    if (apiIdDirty.current) return;
    form.setValue("apiId", toApiId(watchedName ?? ""), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, watchedName]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);

    try {
      const payload: CreateContentTypeInput = {
        name: values.name.trim(),
        apiId: values.apiId?.trim() ? values.apiId.trim() : undefined,
        description: values.description?.trim()
          ? values.description.trim()
          : null,
        isSingleton: values.isSingleton,
      };

      const response = contentType
        ? await updateContentType(siteId, contentType.id, payload)
        : await createContentType(siteId, payload);

      await onSuccess?.(response.contentType);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          isEditing
            ? "We couldn't update this content type right now."
            : "We couldn't create this content type right now.",
        ),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            {isEditing ? "Edit content type" : "Create content type"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the reusable schema definition for this site."
              : "Create the first schema definition for this site's content."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to save content type</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="content-type-name" className="text-xs font-medium">Name</Label>
            <Input
              id="content-type-name"
              placeholder="Page"
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
            <Label htmlFor="content-type-api-id" className="text-xs font-medium">API ID</Label>
            <Input
              id="content-type-api-id"
              placeholder="page"
              className="h-9 rounded-lg border-border/80 bg-background/60 font-mono text-sm"
              {...form.register("apiId", {
                onChange: () => {
                  apiIdDirty.current = true;
                },
              })}
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated from the name. Edit to customize.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content-type-description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="content-type-description"
              rows={3}
              placeholder="Website pages"
              className="rounded-lg border-border/80 bg-background/60 text-sm"
              {...form.register("description")}
            />
          </div>

          <Controller
            control={form.control}
            name="isSingleton"
            render={({ field }) => (
              <div className="narah-muted-surface flex items-start gap-3 rounded-lg p-4">
                <Checkbox
                  id="content-type-singleton"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5 border-[var(--narah-border-strong)]"
                />
                <div className="space-y-1">
                  <Label htmlFor="content-type-singleton" className="text-xs font-medium">Singleton type</Label>
                  <p className="text-xs leading-6 text-muted-foreground">
                    Use singleton mode when this schema should only have one
                    entry, such as a homepage or site settings document.
                  </p>
                </div>
              </div>
            )}
          />

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
                  : "Create content type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
