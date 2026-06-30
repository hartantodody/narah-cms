import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
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
  updateContentField,
} from "@/features/content-types/content-type.api";
import type {
  ContentField,
  ContentFieldType,
  CreateContentFieldInput,
} from "@/features/content-types/content-type.types";
import { GROUP_MAX_CHILDREN } from "@/features/content-types/content-type.types";
import { buildOptionValue } from "@/features/content-types/content-type.utils";
import { getApiErrorMessage } from "@/lib/api";
import { toApiId } from "@/lib/slug";

/** Field types allowed as direct children of a GROUP. Excludes GROUP itself. */
const groupChildTypeOptions = [
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
] as const satisfies ReadonlyArray<Exclude<ContentFieldType, "GROUP">>;

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
  optionsText: z.string().optional(),
});

const groupFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(2, "Label must be at least 2 characters long."),
    apiId: z.string().optional(),
    description: z.string().optional(),
    repeatable: z.boolean(),
    children: z.array(groupChildSchema),
  })
  .superRefine((values, ctx) => {
    if (values.children.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["children"],
        message: "Add at least one child field.",
      });
    }
    if (values.children.length > GROUP_MAX_CHILDREN) {
      ctx.addIssue({
        code: "custom",
        path: ["children"],
        message: `A group may have at most ${GROUP_MAX_CHILDREN} child fields.`,
      });
    }
    const seen = new Set<string>();
    values.children.forEach((child, idx) => {
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
  });

type GroupFormValues = z.infer<typeof groupFormSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  contentTypeId: string;
  /** Existing GROUP field being edited, or null for create. */
  field?: ContentField | null;
  onSuccess?: (field: ContentField) => Promise<void> | void;
};

function extractGroupChildren(field?: ContentField | null) {
  if (!field || field.type !== "GROUP" || !field.config) return [];
  const raw = (field.config as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
    .map((c) => {
      const apiId = typeof c.apiId === "string" ? c.apiId : "";
      const label = typeof c.label === "string" ? c.label : apiId;
      const type =
        typeof c.type === "string" && c.type !== "GROUP"
          ? (c.type as Exclude<ContentFieldType, "GROUP">)
          : ("TEXT" as Exclude<ContentFieldType, "GROUP">);
      const required = c.required === true;
      const isList = c.isList === true;
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

function getDefaultValues(field?: ContentField | null): GroupFormValues {
  return {
    label: field?.label ?? "",
    apiId: field?.apiId ?? "",
    description: field?.description ?? "",
    repeatable: field?.isList ?? true, // default to repeatable — most groups are
    children: extractGroupChildren(field),
  };
}

export function ContentGroupFormDialog({
  open,
  onOpenChange,
  siteId,
  contentTypeId,
  field,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(field);
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: getDefaultValues(field),
  });
  const watchedLabel = form.watch("label");
  const apiIdDirty = useRef(isEditing);

  useEffect(() => {
    if (!open) return;
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

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      const children = values.children.map((child) => {
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

      const payload: CreateContentFieldInput = {
        label: values.label.trim(),
        apiId: values.apiId?.trim() ? values.apiId.trim() : undefined,
        type: "GROUP",
        description: values.description?.trim()
          ? values.description.trim()
          : null,
        required: false,
        localized: false,
        isList: values.repeatable,
        config: { children },
        validation: null,
      };

      const result = isEditing
        ? await updateContentField(siteId, contentTypeId, field!.id, payload)
        : await createContentField(siteId, contentTypeId, payload);

      await onSuccess?.(result.field);
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Unable to save group."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 text-(--narah-accent)" />
            {isEditing
              ? t("schema.group.editTitle")
              : t("schema.group.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("schema.group.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>{t("common.errorTitle")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {/* Basic identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-label">{t("schema.group.labelLabel")}</Label>
              <Input
                id="group-label"
                placeholder="Gallery"
                className="h-11 rounded-lg border-border/80 bg-background/60"
                {...form.register("label")}
                aria-invalid={form.formState.errors.label ? true : undefined}
              />
              {form.formState.errors.label ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.label.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-api-id">{t("schema.group.apiIdLabel")}</Label>
              <Input
                id="group-api-id"
                placeholder="gallery"
                className="h-11 rounded-lg border-border/80 bg-background/60 font-mono text-xs"
                {...form.register("apiId", {
                  onChange: () => {
                    apiIdDirty.current = true;
                  },
                })}
              />
              <p className="text-[0.7rem] text-muted-foreground">
                {t("schema.group.apiIdHint")}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-description">
              {t("schema.group.descriptionLabel")}
            </Label>
            <Textarea
              id="group-description"
              rows={2}
              placeholder={t("schema.group.descriptionPlaceholder")}
              className="rounded-lg border-border/80 bg-background/60"
              {...form.register("description")}
            />
          </div>

          {/* Single vs Repeatable — the most important choice */}
          <div className="space-y-2 rounded-xl border border-border/80 bg-background/60 p-4">
            <Label className="text-sm font-medium">
              {t("schema.group.modeLabel")}
            </Label>
            <Controller
              control={form.control}
              name="repeatable"
              render={({ field: fld }) => (
                <div className="grid gap-2 md:grid-cols-2">
                  <ModeCard
                    selected={fld.value === false}
                    onClick={() => fld.onChange(false)}
                    title={t("schema.group.mode.singleTitle")}
                    description={t("schema.group.mode.singleDescription")}
                    example={t("schema.group.mode.singleExample")}
                  />
                  <ModeCard
                    selected={fld.value === true}
                    onClick={() => fld.onChange(true)}
                    title={t("schema.group.mode.repeatableTitle")}
                    description={t("schema.group.mode.repeatableDescription")}
                    example={t("schema.group.mode.repeatableExample")}
                  />
                </div>
              )}
            />
          </div>

          {/* Children editor */}
          <GroupChildrenEditor form={form} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-border/80 bg-background/60 hover:bg-background/80"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="rounded-lg bg-primary px-5 hover:bg-primary/90"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? isEditing
                  ? t("common.saving")
                  : t("common.creating")
                : isEditing
                  ? t("schema.group.saveCta")
                  : t("schema.group.createCta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Mode card — Single vs Repeatable choice                                */
/* ────────────────────────────────────────────────────────────────────── */

function ModeCard({
  selected,
  onClick,
  title,
  description,
  example,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  example: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "rounded-lg border border-(--narah-accent)/40 bg-(--narah-accent)/5 p-3 text-left transition-colors"
          : "rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-foreground/30"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span
          className={
            selected
              ? "size-3 rounded-full border-2 border-(--narah-accent) bg-(--narah-accent)"
              : "size-3 rounded-full border-2 border-border bg-transparent"
          }
        />
      </div>
      <p className="mt-1 text-[0.7rem] leading-4 text-muted-foreground">
        {description}
      </p>
      <p className="mt-1.5 font-mono text-[0.6rem] text-muted-foreground/80">
        e.g. {example}
      </p>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Children editor — same idea as the inline version we had before        */
/* ────────────────────────────────────────────────────────────────────── */

function GroupChildrenEditor({ form }: { form: UseFormReturn<GroupFormValues> }) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "children",
  });
  const childrenError = form.formState.errors.children;
  const rootMessage =
    childrenError && typeof childrenError.message === "string"
      ? childrenError.message
      : null;

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-background/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">
            {t("schema.group.children.label")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("schema.group.children.hint", { max: GROUP_MAX_CHILDREN })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              apiId: "",
              label: "",
              type: "TEXT",
              required: false,
              isList: false,
              optionsText: "",
            })
          }
          disabled={fields.length >= GROUP_MAX_CHILDREN}
        >
          <Plus className="size-3.5" />
          {t("schema.group.children.addCta")}
        </Button>
      </div>

      {rootMessage ? (
        <p className="text-xs text-destructive">{rootMessage}</p>
      ) : null}

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("schema.group.children.empty")}
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
  form: UseFormReturn<GroupFormValues>;
  index: number;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const childType = form.watch(`children.${index}.type`);
  const childLabel = form.watch(`children.${index}.label`);
  const apiIdDirty = useRef(Boolean(form.getValues(`children.${index}.apiId`)));
  const errors = form.formState.errors.children?.[index];

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
            <Label className="text-xs">
              {t("schema.group.children.row.labelLabel")}
            </Label>
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
            <Label className="text-xs">
              {t("schema.group.children.row.apiIdLabel")}
            </Label>
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
            <Label className="text-xs">
              {t("schema.group.children.row.typeLabel")}
            </Label>
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
                        {t.replaceAll("_", " ")}
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
              {t("schema.group.children.row.required")}
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
              {t("schema.group.children.row.multipleValues")}
            </label>
          </div>
          {(childType === "SELECT" || childType === "MULTI_SELECT") && (
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">
                {t("schema.group.children.row.optionsLabel")}
              </Label>
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
                  {t("schema.group.children.row.optionsHint")}
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
          aria-label={t("schema.group.children.row.remove")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
