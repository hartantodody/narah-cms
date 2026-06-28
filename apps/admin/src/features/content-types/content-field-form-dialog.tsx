import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { toApiId } from "@/lib/slug";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createContentField,
  getContentTypes,
  updateContentField,
} from "@/features/content-types/content-type.api";
import type {
  ContentField,
  ContentFieldType,
  ContentTypeListItem,
  CreateContentFieldInput,
} from "@/features/content-types/content-type.types";
import {
  buildOptionValue,
  getAdditionalConfigJson,
  getFieldOptionsText,
  getFieldRelationContentTypeId,
  getValidationObject,
} from "@/features/content-types/content-type.utils";
import { ValidationRulesBuilder } from "@/features/content-types/validation-rules-builder";
import { getApiErrorMessage } from "@/lib/api";

const contentFieldTypeOptions = [
  "TEXT",
  "RICH_TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "MEDIA",
  "JSON",
  "SELECT",
  "MULTI_SELECT",
  "RELATION",
] as const satisfies ContentFieldType[];

const contentFieldFormSchema = z
  .object({
    label: z.string().trim().min(2, "Label must be at least 2 characters long."),
    apiId: z.string().optional(),
    type: z.enum(contentFieldTypeOptions),
    description: z.string().optional(),
    required: z.boolean(),
    localized: z.boolean(),
    isList: z.boolean(),
    optionsText: z.string().optional(),
    relationContentTypeId: z.string().optional(),
    configJson: z.string().optional(),
    validation: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === "SELECT" || values.type === "MULTI_SELECT") {
      const optionCount = (values.optionsText ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length;
      if (optionCount === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["optionsText"],
          message: "Add at least one option (one per line).",
        });
      }
    }
  });

type ContentFieldFormValues = z.infer<typeof contentFieldFormSchema>;

type EditableContentField = ContentField;

type ContentFieldFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  contentTypeId: string;
  field?: EditableContentField | null;
  onSuccess?: (field: ContentField) => Promise<void> | void;
};

function getDefaultValues(
  field?: EditableContentField | null,
): ContentFieldFormValues {
  return {
    label: field?.label ?? "",
    apiId: field?.apiId ?? "",
    type: field?.type ?? "TEXT",
    description: field?.description ?? "",
    required: field?.required ?? false,
    localized: field?.localized ?? false,
    isList: field?.isList ?? false,
    optionsText: field ? getFieldOptionsText(field) : "",
    relationContentTypeId: field ? getFieldRelationContentTypeId(field) : "",
    configJson: field ? getAdditionalConfigJson(field) : "",
    validation: getValidationObject(field),
  };
}

function tryParseJsonObject(value: string | undefined, label: string) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return {
      value: null as Record<string, unknown> | null,
      error: null as string | null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        value: null,
        error: `${label} must be a valid JSON object.`,
      };
    }

    return {
      value: parsed as Record<string, unknown>,
      error: null,
    };
  } catch {
    return {
      value: null,
      error: `${label} must be valid JSON.`,
    };
  }
}

function buildFieldPayload(values: ContentFieldFormValues) {
  const configResult = tryParseJsonObject(
    values.configJson,
    "Advanced JSON config",
  );

  if (configResult.error) {
    return {
      payload: null as CreateContentFieldInput | null,
      error: configResult.error,
    };
  }

  const validation =
    values.validation && Object.keys(values.validation).length > 0
      ? values.validation
      : null;

  const config = { ...(configResult.value ?? {}) } as Record<string, unknown>;

  if (values.type === "SELECT" || values.type === "MULTI_SELECT") {
    const options = (values.optionsText ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({
        label,
        value: buildOptionValue(label),
      }));

    if (options.length > 0) {
      config.options = options;
    } else {
      delete config.options;
    }
  } else {
    delete config.options;
  }

  if (values.type === "RELATION") {
    const relatedContentTypeId = values.relationContentTypeId?.trim();

    if (relatedContentTypeId) {
      config.contentTypeId = relatedContentTypeId;
    } else {
      delete config.contentTypeId;
    }
  } else {
    delete config.contentTypeId;
  }

  return {
    payload: {
      label: values.label.trim(),
      apiId: values.apiId?.trim() ? values.apiId.trim() : undefined,
      type: values.type,
      description: values.description?.trim()
        ? values.description.trim()
        : null,
      required: values.required,
      localized: values.localized,
      isList: values.isList,
      config: Object.keys(config).length > 0 ? config : null,
      validation,
    } satisfies CreateContentFieldInput,
    error: null,
  };
}

export function ContentFieldFormDialog({
  open,
  onOpenChange,
  siteId,
  contentTypeId,
  field,
  onSuccess,
}: ContentFieldFormDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(field);
  const form = useForm<ContentFieldFormValues>({
    resolver: zodResolver(contentFieldFormSchema),
    defaultValues: getDefaultValues(field),
  });
  const selectedType = form.watch("type");
  const watchedLabel = form.watch("label");
  const apiIdDirty = useRef(isEditing);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(getDefaultValues(field));
    apiIdDirty.current = Boolean(field);
    setErrorMessage(null);
  }, [field, form, open]);

  useEffect(() => {
    if (apiIdDirty.current) return;
    form.setValue("apiId", toApiId(watchedLabel ?? ""), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, watchedLabel]);

  // Load sibling content types so the RELATION dropdown can use them.
  const [contentTypes, setContentTypes] = useState<ContentTypeListItem[]>([]);
  const [isLoadingContentTypes, setIsLoadingContentTypes] = useState(false);
  useEffect(() => {
    if (!open || selectedType !== "RELATION") return;
    let cancelled = false;
    setIsLoadingContentTypes(true);
    getContentTypes(siteId)
      .then((response) => {
        if (cancelled) return;
        setContentTypes(response.contentTypes);
      })
      .catch(() => {
        // Silent — the input still allows manual UUID paste as a fallback.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContentTypes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedType, siteId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);

    const buildResult = buildFieldPayload(values);

    if (buildResult.error) {
      setErrorMessage(buildResult.error);
      return;
    }

    try {
      const response = field
        ? await updateContentField(siteId, contentTypeId, field.id, buildResult.payload!)
        : await createContentField(siteId, contentTypeId, buildResult.payload!);

      await onSuccess?.(response.field);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          isEditing
            ? "We couldn't update this field right now."
            : "We couldn't create this field right now.",
        ),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="narah-muted-surface rounded-lg p-4">
          <DialogTitle>{isEditing ? "Edit field" : "Add field"}</DialogTitle>
          <DialogDescription>
            Define the structure and metadata for this content field.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to save field</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="field-label">Label</Label>
              <Input
                id="field-label"
                placeholder="Title"
                className="h-11 rounded-lg border-border/80 bg-background/60"
                aria-invalid={form.formState.errors.label ? true : undefined}
                {...form.register("label")}
              />
              {form.formState.errors.label ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.label.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-api-id">API ID</Label>
              <Input
                id="field-api-id"
                placeholder="title"
                className="h-11 rounded-lg border-border/80 bg-background/60"
                {...form.register("apiId", {
                  onChange: () => {
                    apiIdDirty.current = true;
                  },
                })}
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from the label. Edit to customize.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              <Label htmlFor="field-type">Field type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field: controllerField }) => (
                  <Select
                    value={controllerField.value}
                    onValueChange={controllerField.onChange}
                  >
                    <SelectTrigger
                      id="field-type"
                      className="h-11 w-full rounded-lg border-border/80 bg-background/60"
                    >
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      {contentFieldTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-description">Description</Label>
              <Input
                id="field-description"
                placeholder="Optional editor hint"
                className="h-11 rounded-lg border-border/80 bg-background/60"
                {...form.register("description")}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Controller
              control={form.control}
              name="required"
              render={({ field: controllerField }) => (
                <div className="narah-muted-surface flex items-start gap-3 rounded-lg p-4">
                  <Checkbox
                    id="field-required"
                    checked={controllerField.value}
                    onCheckedChange={(checked) =>
                      controllerField.onChange(checked === true)
                    }
                    className="mt-0.5 border-[var(--narah-border-strong)]"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="field-required">Required</Label>
                    <p className="text-xs text-muted-foreground">
                      Entry must provide a value.
                    </p>
                  </div>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="localized"
              render={({ field: controllerField }) => (
                <div className="narah-muted-surface flex items-start gap-3 rounded-lg p-4">
                  <Checkbox
                    id="field-localized"
                    checked={controllerField.value}
                    onCheckedChange={(checked) =>
                      controllerField.onChange(checked === true)
                    }
                    className="mt-0.5 border-[var(--narah-border-strong)]"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="field-localized">Localized</Label>
                    <p className="text-xs text-muted-foreground">
                      Reserve this field for multi-locale content later.
                    </p>
                  </div>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="isList"
              render={({ field: controllerField }) => (
                <div className="narah-muted-surface flex items-start gap-3 rounded-lg p-4">
                  <Checkbox
                    id="field-is-list"
                    checked={controllerField.value}
                    onCheckedChange={(checked) =>
                      controllerField.onChange(checked === true)
                    }
                    className="mt-0.5 border-[var(--narah-border-strong)]"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="field-is-list">List</Label>
                    <p className="text-xs text-muted-foreground">
                      Store multiple values for this field.
                    </p>
                  </div>
                </div>
              )}
            />
          </div>

          {(selectedType === "SELECT" || selectedType === "MULTI_SELECT") && (
            <div className="space-y-2">
              <Label htmlFor="field-options">Options</Label>
              <Textarea
                id="field-options"
                rows={5}
                placeholder={"News\nProduct\nTutorial"}
                className="rounded-lg border-border/80 bg-background/60"
                aria-invalid={
                  form.formState.errors.optionsText ? true : undefined
                }
                {...form.register("optionsText")}
              />
              {form.formState.errors.optionsText ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionsText.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  One option per line. Values will be generated automatically.
                </p>
              )}
            </div>
          )}

          {selectedType === "RELATION" && (
            <div className="space-y-2">
              <Label htmlFor="field-related-content-type">
                Related content type
              </Label>
              <Controller
                control={form.control}
                name="relationContentTypeId"
                render={({ field: fld }) => (
                  <Select
                    value={fld.value || undefined}
                    onValueChange={(v) => fld.onChange(v)}
                    disabled={isLoadingContentTypes || contentTypes.length === 0}
                  >
                    <SelectTrigger
                      id="field-related-content-type"
                      className="h-11 w-full rounded-lg border-border/80 bg-background/60"
                    >
                      <SelectValue
                        placeholder={
                          isLoadingContentTypes
                            ? "Loading content types…"
                            : contentTypes.length === 0
                              ? "No other content types yet"
                              : "Choose a content type"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {contentTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          <span className="flex items-center gap-2">
                            <span>{ct.name}</span>
                            <span className="font-mono text-[0.65rem] text-muted-foreground">
                              {ct.apiId}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Entries created with this field will reference one entry from
                the chosen content type.
              </p>
            </div>
          )}

          <Controller
            control={form.control}
            name="validation"
            render={({ field: controllerField }) => (
              <ValidationRulesBuilder
                type={selectedType}
                value={(controllerField.value as Record<string, unknown> | null | undefined) ?? null}
                onChange={(next) => controllerField.onChange(next)}
              />
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="field-config-json">Advanced JSON config</Label>
            <Textarea
              id="field-config-json"
              rows={5}
              placeholder={'{\n  "helpText": "Optional field metadata"\n}'}
              className="rounded-lg border-border/80 bg-background/60 font-mono text-xs"
              {...form.register("configJson")}
            />
            <p className="text-[0.7rem] text-muted-foreground">
              Escape hatch for arbitrary metadata stored on the field. Most
              users won't need this.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-border/80 bg-background/60 hover:bg-background/80"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-lg bg-primary px-5 hover:bg-primary/90"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save field"
                  : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
