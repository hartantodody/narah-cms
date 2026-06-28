import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  getCurrentLocale,
  setLocale,
  type Locale,
} from "@/lib/i18n";

export function LocaleToggle() {
  const { t, i18n } = useTranslation();
  // Subscribe to language changes so the chip re-renders.
  const current: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(
    i18n.resolvedLanguage ?? "",
  )
    ? (i18n.resolvedLanguage as Locale)
    : getCurrentLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          aria-label={t("locale.switcher.tooltip")}
          title={t("locale.switcher.tooltip")}
        >
          <Languages className="size-3.5" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            {LOCALE_FLAGS[current]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("locale.switcher.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => setLocale(locale)}
            className="gap-2 text-sm"
            data-active={locale === current ? true : undefined}
          >
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
              {LOCALE_FLAGS[locale]}
            </span>
            <span>{LOCALE_LABELS[locale]}</span>
            {locale === current ? (
              <span className="ml-auto text-[0.65rem] text-muted-foreground">
                ✓
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
