import { ArrowRight, Layers, ListPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AddToSchemaChoice = "field" | "group";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: AddToSchemaChoice) => void;
};

/**
 * Entry-point modal shown when an editor clicks "Add to schema". Splits
 * field creation into two distinct flows because Field (a value holder)
 * and Group (a composition primitive) are categorically different and
 * forcing both through one dropdown was overloading users.
 */
export function AddToSchemaChooserDialog({ open, onOpenChange, onChoose }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("schema.chooser.title")}</DialogTitle>
          <DialogDescription>{t("schema.chooser.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceCard
            icon={<ListPlus className="size-5" />}
            title={t("schema.chooser.field.title")}
            tagline={t("schema.chooser.field.tagline")}
            example={t("schema.chooser.field.example")}
            onClick={() => onChoose("field")}
          />
          <ChoiceCard
            icon={<Layers className="size-5" />}
            title={t("schema.chooser.group.title")}
            tagline={t("schema.chooser.group.tagline")}
            example={t("schema.chooser.group.example")}
            accent
            onClick={() => onChoose("group")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceCard({
  icon,
  title,
  tagline,
  example,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  example: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        accent
          ? "group flex flex-col gap-2 rounded-xl border border-(--narah-accent)/30 bg-(--narah-accent)/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-(--narah-accent)/50 hover:shadow-(--narah-shadow-sm)"
          : "group flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-(--narah-shadow-sm)"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={
            accent
              ? "grid size-10 shrink-0 place-items-center rounded-lg bg-(--narah-accent)/15 text-(--narah-accent)"
              : "grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-foreground/5 text-foreground dark:bg-white/5"
          }
        >
          {icon}
        </span>
        <ArrowRight
          className={
            accent
              ? "size-4 shrink-0 text-(--narah-accent) transition-transform group-hover:translate-x-0.5"
              : "size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          }
        />
      </div>
      <p className="text-base font-semibold leading-tight">{title}</p>
      <p className="text-xs leading-5 text-muted-foreground">{tagline}</p>
      <p className="rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-[0.65rem] leading-4 text-muted-foreground">
        {example}
      </p>
    </button>
  );
}
