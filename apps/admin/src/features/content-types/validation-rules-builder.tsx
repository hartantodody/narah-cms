import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentFieldType } from "@/features/content-types/content-type.types";
import {
  VALIDATION_RULES_BY_TYPE,
  type ValidationRuleKey,
} from "@/features/content-types/content-type.utils";

type ValidationValue = Record<string, unknown> | null;

type ValidationRulesBuilderProps = {
  type: ContentFieldType;
  value: ValidationValue;
  onChange: (next: ValidationValue) => void;
};

const RULE_LABELS: Record<ValidationRuleKey, string> = {
  minLength: "Minimum length",
  maxLength: "Maximum length",
  pattern: "Regex pattern",
  min: "Minimum value",
  max: "Maximum value",
  integer: "Integer only",
};

const RULE_HINTS: Record<ValidationRuleKey, string> = {
  minLength: "Reject values shorter than this many characters.",
  maxLength: "Reject values longer than this many characters.",
  pattern:
    "JavaScript-style regex (no slashes). Example: ^[a-zA-Z0-9-_]+$ for slug-safe values.",
  min: "Reject values below this number.",
  max: "Reject values above this number.",
  integer: "Reject decimals. The value must be a whole number.",
};

const numberOrUndefined = (raw: string): number | undefined => {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const stripEmpty = (record: Record<string, unknown>): ValidationValue => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
};

export function ValidationRulesBuilder({
  type,
  value,
  onChange,
}: ValidationRulesBuilderProps) {
  const supportedRules = VALIDATION_RULES_BY_TYPE[type] ?? [];

  const current = useMemo<Record<string, unknown>>(
    () => (value && typeof value === "object" ? { ...value } : {}),
    [value],
  );

  const setRule = (key: ValidationRuleKey, raw: unknown) => {
    const next = { ...current, [key]: raw };
    onChange(stripEmpty(next));
  };

  if (supportedRules.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Validation</Label>
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-[0.7rem] text-muted-foreground">
          No validation rules available for {type.replaceAll("_", " ")} fields
          yet. (Required / List toggles still apply.)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Validation</Label>
      <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-3">
        {supportedRules.map((rule) => {
          const labelText = RULE_LABELS[rule];
          const hint = RULE_HINTS[rule];

          if (rule === "integer") {
            return (
              <div key={rule} className="flex items-start gap-2.5 pt-0.5">
                <Checkbox
                  id={`validation-${rule}`}
                  checked={current[rule] === true}
                  onCheckedChange={(c) => setRule(rule, c === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`validation-${rule}`}
                    className="text-xs font-medium leading-none"
                  >
                    {labelText}
                  </Label>
                  <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
                </div>
              </div>
            );
          }

          if (rule === "pattern") {
            const raw = typeof current[rule] === "string" ? (current[rule] as string) : "";
            return (
              <div key={rule} className="space-y-1">
                <Label
                  htmlFor={`validation-${rule}`}
                  className="text-[0.7rem] font-medium text-muted-foreground"
                >
                  {labelText}
                </Label>
                <Input
                  id={`validation-${rule}`}
                  value={raw}
                  onChange={(e) => setRule(rule, e.target.value)}
                  placeholder="^[a-z0-9-]+$"
                  className="h-8 rounded-md font-mono text-xs"
                />
                <p className="text-[0.65rem] text-muted-foreground">{hint}</p>
              </div>
            );
          }

          // numeric rule
          const raw =
            typeof current[rule] === "number" ? String(current[rule]) : "";
          return (
            <div key={rule} className="space-y-1">
              <Label
                htmlFor={`validation-${rule}`}
                className="text-[0.7rem] font-medium text-muted-foreground"
              >
                {labelText}
              </Label>
              <Input
                id={`validation-${rule}`}
                type="number"
                inputMode="numeric"
                value={raw}
                onChange={(e) => setRule(rule, numberOrUndefined(e.target.value))}
                className="h-8 rounded-md text-xs"
              />
              <p className="text-[0.65rem] text-muted-foreground">{hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
