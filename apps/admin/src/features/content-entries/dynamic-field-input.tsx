import { Image as ImageIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RichTextEditor } from "@/components/app/rich-text-editor";
import { AssetPicker } from "@/features/media-assets/asset-picker";
import type { MediaAsset } from "@/features/media-assets/media-asset.types";
import { buildAssetUrl } from "@/features/media-assets/media-asset.utils";
import {
  RelationPicker,
  type RelationPickerSelection,
} from "@/features/content-entries/relation-picker";
import type {
  ContentField,
  GroupChildFieldDef,
} from "@/features/content-types/content-type.types";

/**
 * Materialize a GROUP child field def (subset of ContentField stored in
 * config.children) as a full ContentField shape so we can hand it to
 * DynamicFieldInput. The synthetic id namespaces the parent so React
 * key uniqueness holds when multiple groups share child apiIds.
 */
const groupChildToContentField = (
  parent: ContentField,
  child: GroupChildFieldDef,
  childIndex: number,
): ContentField => ({
  id: `${parent.id}.${child.apiId}.${childIndex}`,
  label: child.label,
  apiId: child.apiId,
  type: child.type,
  description: child.description ?? null,
  required: child.required === true,
  localized: false,
  isList: child.isList === true,
  sortOrder: childIndex,
  config: child.config ?? null,
  validation: null,
  defaultValue: null,
  createdAt: parent.createdAt,
  updatedAt: parent.updatedAt,
});

const getGroupChildren = (field: ContentField): GroupChildFieldDef[] => {
  if (field.type !== "GROUP" || !field.config) return [];
  const raw = (field.config as { children?: unknown }).children;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is GroupChildFieldDef =>
      c !== null &&
      typeof c === "object" &&
      typeof (c as { apiId?: unknown }).apiId === "string" &&
      typeof (c as { type?: unknown }).type === "string",
  );
};

export type FieldOption = { label: string; value: string };

const extractOptions = (config: ContentField["config"]): FieldOption[] => {
  if (!config) return [];
  const raw = (config as Record<string, unknown>).options;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt): FieldOption | null => {
      if (typeof opt === "string") return { label: opt, value: opt };
      if (
        typeof opt === "object" &&
        opt !== null &&
        "value" in opt &&
        typeof (opt as Record<string, unknown>).value === "string"
      ) {
        const v = String((opt as Record<string, unknown>).value);
        const l = (opt as Record<string, unknown>).label;
        return { value: v, label: typeof l === "string" ? l : v };
      }
      return null;
    })
    .filter((o): o is FieldOption => o !== null);
};

type DynamicFieldInputProps = {
  field: ContentField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  error?: string;
  siteId: string;
};

export function DynamicFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
  siteId,
}: DynamicFieldInputProps) {
  const options = useMemo(() => extractOptions(field.config), [field.config]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={field.apiId} className="text-sm font-medium">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-(--narah-accent)">*</span>
          ) : null}
        </Label>
        <FieldTypeBadge field={field} />
      </div>

      <FieldControl
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={options}
        siteId={siteId}
      />

      {field.description ? (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FieldTypeBadge({ field }: { field: ContentField }) {
  const label = field.type.replaceAll("_", " ").toLowerCase();
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
      {label}
      {field.isList && field.type !== "MULTI_SELECT" ? " · list" : ""}
      {field.localized ? " · i18n" : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function FieldControl({
  field,
  value,
  onChange,
  disabled,
  options,
  siteId,
}: {
  field: ContentField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  options: FieldOption[];
  siteId: string;
}) {
  // MULTI_SELECT is always list
  if (field.type === "MULTI_SELECT") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <MultiSelectControl
        id={field.apiId}
        value={arr}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  // List fields render repeated controls
  if (field.isList) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <ListControl
        field={field}
        items={arr}
        onChange={onChange}
        disabled={disabled}
        options={options}
        siteId={siteId}
      />
    );
  }

  return (
    <ScalarControl
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={options}
      siteId={siteId}
    />
  );
}

function ScalarControl({
  field,
  value,
  onChange,
  disabled,
  options,
  siteId,
}: {
  field: ContentField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  options: FieldOption[];
  siteId: string;
}) {
  switch (field.type) {
    case "TEXT": {
      return (
        <Input
          id={field.apiId}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10"
        />
      );
    }
    case "RICH_TEXT": {
      return (
        <RichTextEditor
          value={value}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          placeholder="Start writing…"
          siteId={siteId}
        />
      );
    }
    case "NUMBER": {
      return (
        <Input
          id={field.apiId}
          type="number"
          value={typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          disabled={disabled}
          className="h-10"
        />
      );
    }
    case "BOOLEAN": {
      return (
        <div className="flex h-10 items-center gap-2">
          <Checkbox
            id={field.apiId}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            {value === true ? "True" : "False"}
          </span>
        </div>
      );
    }
    case "DATE": {
      return (
        <Input
          id={field.apiId}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className="h-10"
        />
      );
    }
    case "DATETIME": {
      const v =
        typeof value === "string" ? value.slice(0, 16) /* trim seconds for input */ : "";
      return (
        <Input
          id={field.apiId}
          type="datetime-local"
          value={v}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw ? new Date(raw).toISOString() : null);
          }}
          disabled={disabled}
          className="h-10"
        />
      );
    }
    case "SELECT": {
      return (
        <Select
          value={typeof value === "string" ? value : undefined}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger id={field.apiId} className="h-10 w-full">
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No options configured on this field.
              </div>
            ) : (
              options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    }
    case "JSON": {
      const text =
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : JSON.stringify(value, null, 2);
      return (
        <Textarea
          id={field.apiId}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim() === "") {
              onChange(null);
              return;
            }
            try {
              onChange(JSON.parse(raw));
            } catch {
              // Keep the raw text so the user can fix it; backend will reject.
              onChange(raw);
            }
          }}
          disabled={disabled}
          rows={6}
          className="font-mono text-xs"
          placeholder='{ "key": "value" }'
        />
      );
    }
    case "MEDIA": {
      return (
        <MediaControl
          value={value}
          onChange={onChange}
          disabled={disabled}
          siteId={siteId}
        />
      );
    }
    case "RELATION": {
      return (
        <RelationControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          siteId={siteId}
        />
      );
    }
    case "GROUP": {
      return (
        <GroupControl
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          siteId={siteId}
        />
      );
    }
    default:
      return null;
  }
}

/**
 * Render one group item (singleton or one element of a list-group) as a
 * stacked card of inputs — one DynamicFieldInput per declared child.
 */
function GroupControl({
  field,
  value,
  onChange,
  disabled,
  siteId,
}: {
  field: ContentField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  siteId: string;
}) {
  const children = getGroupChildren(field);
  const item =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  if (children.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        This group has no child fields defined. Open the schema editor and add
        at least one child.
      </p>
    );
  }

  const setChild = (apiId: string, next: unknown) => {
    onChange({ ...item, [apiId]: next });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      {children.map((child, idx) => {
        const childField = groupChildToContentField(field, child, idx);
        return (
          <DynamicFieldInput
            key={child.apiId}
            field={childField}
            value={item[child.apiId]}
            onChange={(next) => setChild(child.apiId, next)}
            disabled={disabled}
            siteId={siteId}
          />
        );
      })}
    </div>
  );
}

function ListControl({
  field,
  items,
  onChange,
  disabled,
  options,
  siteId,
}: {
  field: ContentField;
  items: unknown[];
  onChange: (v: unknown[]) => void;
  disabled?: boolean;
  options: FieldOption[];
  siteId: string;
}) {
  const updateAt = (index: number, next: unknown) => {
    const copy = items.slice();
    copy[index] = next;
    onChange(copy);
  };
  const removeAt = (index: number) =>
    onChange(items.filter((_, i) => i !== index));
  const append = () => onChange([...items, defaultForType(field.type)]);

  // Render each list item as the scalar control with a delete button.
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items yet.</p>
      ) : (
        items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <ScalarControl
                field={{ ...field, isList: false }}
                value={item}
                onChange={(next) => updateAt(index, next)}
                disabled={disabled}
                options={options}
                siteId={siteId}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 text-muted-foreground hover:text-destructive"
              onClick={() => removeAt(index)}
              disabled={disabled}
              aria-label="Remove item"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={append}
        disabled={disabled}
      >
        + Add item
      </Button>
    </div>
  );
}

function MultiSelectControl({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: FieldOption[];
  disabled?: boolean;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div id={id} className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No options configured on this field.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt.value)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="text-[0.7rem]">
              {v}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type MediaValue = { id?: string; url: string; alt?: string | null };

const toMediaValue = (raw: unknown): MediaValue | null => {
  if (typeof raw === "string" && raw.trim() !== "") {
    // Legacy: UUID string. We can't render preview without url; treat as empty.
    return null;
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).url === "string"
  ) {
    const r = raw as Record<string, unknown>;
    return {
      id: typeof r.id === "string" ? r.id : undefined,
      url: r.url as string,
      alt: typeof r.alt === "string" || r.alt === null ? (r.alt as string | null) : undefined,
    };
  }
  return null;
};

function MediaControl({
  value,
  onChange,
  disabled,
  siteId,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  siteId: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const media = toMediaValue(value);

  const handleSelect = (asset: MediaAsset) => {
    const next: MediaValue = {
      id: asset.id,
      url: asset.url,
      alt: asset.altText,
    };
    onChange(next);
  };

  return (
    <>
      {media ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <img
            src={buildAssetUrl(media.url, { w: 200, q: 70 })}
            alt={media.alt ?? ""}
            className="size-16 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {media.alt || "Untitled"}
            </p>
            <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
              {media.url}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={disabled}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          <ImageIcon className="size-4" />
          Choose an image
        </button>
      )}
      <AssetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        siteId={siteId}
        onSelect={handleSelect}
        mimeTypePrefix="image/"
      />
    </>
  );
}

type RelationValue = {
  id: string;
  slug?: string | null;
  contentTypeApiId?: string;
};

const toRelationValue = (raw: unknown): RelationValue | null => {
  if (typeof raw === "string" && raw.trim() !== "") {
    return { id: raw };
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).id === "string"
  ) {
    const r = raw as Record<string, unknown>;
    return {
      id: r.id as string,
      slug:
        typeof r.slug === "string" || r.slug === null
          ? (r.slug as string | null)
          : undefined,
      contentTypeApiId:
        typeof r.contentTypeApiId === "string"
          ? (r.contentTypeApiId as string)
          : undefined,
    };
  }
  return null;
};

function RelationControl({
  field,
  value,
  onChange,
  disabled,
  siteId,
}: {
  field: ContentField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  siteId: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const relation = toRelationValue(value);

  const relatedContentTypeId =
    field.config && typeof (field.config as Record<string, unknown>).contentTypeId === "string"
      ? ((field.config as Record<string, unknown>).contentTypeId as string)
      : null;

  if (!relatedContentTypeId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        This relation field has no target content type configured. Edit the
        field in the schema builder to choose one.
      </div>
    );
  }

  const handleSelect = (selection: RelationPickerSelection) => {
    onChange({
      id: selection.id,
      slug: selection.slug,
      contentTypeApiId: selection.contentTypeApiId,
    });
  };

  return (
    <>
      {relation ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-muted text-[0.7rem] font-mono uppercase text-muted-foreground">
            {relation.contentTypeApiId
              ? relation.contentTypeApiId.slice(0, 2)
              : "→"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {relation.slug ?? (
                <span className="italic text-muted-foreground">(no slug)</span>
              )}
            </p>
            <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
              {relation.contentTypeApiId
                ? `${relation.contentTypeApiId} · `
                : ""}
              {relation.id}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={disabled}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          Choose an entry
        </button>
      )}
      <RelationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        siteId={siteId}
        contentTypeId={relatedContentTypeId}
        onSelect={handleSelect}
      />
    </>
  );
}

const defaultForType = (type: ContentField["type"]) => {
  switch (type) {
    case "BOOLEAN":
      return false;
    case "NUMBER":
      return null;
    case "JSON":
      return null;
    case "GROUP":
      return {};
    default:
      return "";
  }
};
