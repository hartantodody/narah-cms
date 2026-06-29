import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { toApiId } from "@/lib/slug";
import {
  Controller,
  useFieldArray,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
  "GROUP",
] as const satisfies ContentFieldType[];

/** Field types that may appear as a child INSIDE a GROUP (everything
 *  except GROUP itself — keeps nesting capped at 2 levels). */
const groupChildTypeOptions = contentFieldTypeOptions.filter(
  (t) => t !== "GROUP",
) as ReadonlyArray<Exclude<ContentFieldType, "GROUP">>;

const groupChildSchema = z.object({
  apiId: z
    .string()
    .trim()
    .min(1, "apiId is required.")
    .regex(/^[a-z][a-z0-9_]*$/, "apiId must be snake_case (a-z, 0-9, _)."),
  label: z.string().trim().min(1, "Label is required."),
  type: z.enum(groupChildTypeOptions),
  required: z.boolean().optional(),
  isList: z.boolean().optional(),
  /** SELECT/MULTI_SELECT options joined newline-style for the editor. */
  optionsText: z.string().optional(),
});

type GroupChildFormValue = z.infer<typeof groupChildSchema>;

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
    children: z.array(groupChildSchema).optional(),
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

    if (values.type === "GROUP") {
      const children = values.children ?? [];
      if (children.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["children"],
          message: "Add at least one child field.",
        });
      }
      if (children.length > 5) {
        ctx.addIssue({
          code: "custom",
          path: ["children"],
          message: "A group may have at most 5 child fields.",
        });
      }
      const seen = new Set<string>();
      children.forEach((child, idx) => {
        const key = child.apiId.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: ["children", idx, "apiId"],
            message: `Duplicate apiId "${child.apiId}".`,
          });
        }
        seen.add(key);
        if (
          (child.type === "SELECT" || child.type === "MULTI_SELECT") &&
          (child.optionsText ?? "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean).length === 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["children", idx, "optionsText"],
            message: "Add at least one option (one per line).",
          });
        }
      });
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

function extractGroupChildren(
  field?: EditableContentField | null,
): GroupChildFormValue[] {
  if (!field || field.type !== "GROUP" || !field.config) return [];
  const raw = (field.config as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is Record<string, unknown> =>
        c !== null && typeof c === "object",
    )
    .map((c) => {
      const apiId = typeof c.apiId === "string" ? c.apiId : "";
      const label = typeof c.label === "string" ? c.label : apiId;
      const type =
        typeof c.type === "string" && c.type !== "GROUP"
          ? (c.type as Exclude<ContentFieldType, "GROUP">)
          : ("TEXT" as Exclude<ContentFieldType, "GROUP">);
      const required = c.required === true;
      const isList = c.isList === true;
      // Try to surface SELECT options as newline text for editing.
      let optionsText = "";
      if (
        (type === "SELECT" || type === "MULTI_SELECT") &&
        c.config &&
        typeof c.config === "object"
      ) {
        const opts = (c.config as { options?: unknown }).options;
        if (Array.isArray(opts)) {
          optionsText = opts
            .map((o) => {
              if (typeof o === "string") return o;
              if (
                o !== null &&
                typeof o === "object" &&
                typeof (o as { label?: unknown }).label === "string"
              ) {
                return String((o as { label: string }).label);
              }
              return "";
            })
            .filter(Boolean)
            .join("\n");
        }
      }
      return { apiId, label, type, required, isList, optionsText };
    });
}

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
    children: extractGroupChildren(field),
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

  if (values.type === "GROUP") {
    const children = (values.children ?? []).map((child) => {
      const childConfig: Record<string, unknown> = {};
      if (child.type === "SELECT" || child.type === "MULTI_SELECT") {
        const opts = (child.optionsText ?? "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((label) => ({ label, value: buildOptionValue(label) }));
        if (opts.length > 0) childConfig.options = opts;
      }
      return {
        apiId: child.apiId.trim(),
        label: child.label.trim(),
        type: child.type,
        required: child.required === true,
        isList: child.isList === true,
        config: Object.keys(childConfig).length > 0 ? childConfig : null,
      };
    });
    config.children = children;
  } else {
    delete config.children;
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

          {selectedType === "GROUP" && (
            <GroupChildrenEditor form={form} />
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

/* ────────────────────────────────────────────────────────────────────── */
/*  Group children editor — shown only when field.type === "GROUP".       */
/* ────────────────────────────────────────────────────────────────────── */

function GroupChildrenEditor({
  form,
}: {
  form: UseFormReturn<ContentFieldFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "children",
  });
  const childrenError = form.formState.errors.children;
  const rootMessage =
    childrenError && typeof childrenError.message === "string"
      ? childrenError.message
      : null;

  const addChild = () => {
    append({
      apiId: "",
      label: "",
      type: "TEXT",
      required: false,
      isList: false,
      optionsText: "",
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-background/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">Child fields</Label>
          <p className="text-xs text-muted-foreground">
            Up to 5 fields. Each item in a list-group is one record with these
            fields.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addChild}
          disabled={fields.length >= 5}
        >
          <Plus className="size-3.5" />
          Add child
        </Button>
      </div>

      {rootMessage ? (
        <p className="text-xs text-destructive">{rootMessage}</p>
      ) : null}

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          No child fields yet. Add at least one.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((row, index) => (
            <GroupChildRow
              key={row.id}
              form={form}
              index={index}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChildRow({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<ContentFieldFormValues>;
  index: number;
  onRemove: () => void;
}) {
  const childType = form.watch(`children.${index}.type`);
  const childLabel = form.watch(`children.${index}.label`);
  const apiIdDirty = useRef(Boolean(form.getValues(`children.${index}.apiId`)));
  const errors = form.formState.errors.children?.[index];

  // Auto-derive child apiId from label until the user edits it directly.
  useEffect(() => {
    if (apiIdDirty.current) return;
    form.setValue(`children.${index}.apiId`, toApiId(childLabel ?? ""), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [childLabel, form, index]);

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              {...form.register(`children.${index}.label`)}
              placeholder="Title"
              className="h-9 rounded-md border-border/80 bg-background/60"
              aria-invalid={errors?.label ? true : undefined}
            />
            {errors?.label ? (
              <p className="text-[0.7rem] text-destructive">
                {errors.label.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API ID</Label>
            <Input
              {...form.register(`children.${index}.apiId`, {
                onChange: () => {
                  apiIdDirty.current = true;
                },
              })}
              placeholder="title"
              className="h-9 rounded-md border-border/80 bg-background/60 font-mono text-xs"
              aria-invalid={errors?.apiId ? true : undefined}
            />
            {errors?.apiId ? (
              <p className="text-[0.7rem] text-destructive">
                {errors.apiId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Controller
              control={form.control}
              name={`children.${index}.type`}
              render={({ field: fld }) => (
                <Select
                  value={fld.value}
                  onValueChange={(v) =>
                    fld.onChange(v as Exclude<ContentFieldType, "GROUP">)
                  }
                >
                  <SelectTrigger className="h-9 rounded-md border-border/80 bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupChildTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <label className="flex items-center gap-1.5 text-xs">
              <Controller
                control={form.control}
                name={`children.${index}.required`}
                render={({ field: fld }) => (
                  <Checkbox
                    checked={fld.value === true}
                    onCheckedChange={(c) => fld.onChange(c === true)}
                  />
                )}
              />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Controller
                control={form.control}
                name={`children.${index}.isList`}
                render={({ field: fld }) => (
                  <Checkbox
                    checked={fld.value === true}
                    onCheckedChange={(c) => fld.onChange(c === true)}
                  />
                )}
              />
              List
            </label>
          </div>
          {(childType === "SELECT" || childType === "MULTI_SELECT") && (
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Options</Label>
              <Textarea
                rows={3}
                {...form.register(`children.${index}.optionsText`)}
                placeholder={"News\nProduct\nTutorial"}
                className="rounded-md border-border/80 bg-background/60"
                aria-invalid={errors?.optionsText ? true : undefined}
              />
              {errors?.optionsText ? (
                <p className="text-[0.7rem] text-destructive">
                  {errors.optionsText.message}
                </p>
              ) : (
                <p className="text-[0.7rem] text-muted-foreground">
                  One option per line. Values auto-derived.
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="mt-6 text-muted-foreground hover:text-destructive"
          aria-label="Remove child field"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
