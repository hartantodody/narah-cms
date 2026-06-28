import { BarChart3, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteAnalyticsConfig,
  getAnalyticsConfig,
  setAnalyticsConfig,
} from "@/features/analytics/analytics.api";
import type { AnalyticsConfigResponse } from "@/features/analytics/analytics.types";
import { getApiErrorMessage } from "@/lib/api";

type Props = {
  siteId: string;
  canManage: boolean;
};

export function AnalyticsSettingsSection({ siteId, canManage }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AnalyticsConfigResponse | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [serviceAccount, setServiceAccount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getAnalyticsConfig(siteId)
      .then(({ config: cfg }) => {
        if (!active) return;
        setConfig(cfg);
        if (cfg.connected) {
          setPropertyId(cfg.propertyId);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiErrorMessage(err, t("analytics.errorLoad")));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId, t]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { config: cfg } = await setAnalyticsConfig(siteId, {
        propertyId: propertyId.trim(),
        serviceAccount: serviceAccount.trim(),
      });
      setConfig(cfg);
      setServiceAccount(""); // never re-display the secret
      setSuccessMessage(t("analytics.savedSuccess"));
    } catch (err) {
      setError(getApiErrorMessage(err, t("analytics.errorSave")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { config: cfg } = await deleteAnalyticsConfig(siteId);
      setConfig(cfg);
      setPropertyId("");
      setServiceAccount("");
    } catch (err) {
      setError(getApiErrorMessage(err, t("analytics.errorDisconnect")));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = config?.connected === true;

  return (
    <section
      id="analytics"
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-foreground/5 text-foreground dark:bg-white/5">
          <BarChart3 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {t("analytics.settings.title")}
            </h2>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                {t("analytics.settings.connected")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-foreground/5 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground dark:bg-white/5">
                {t("analytics.settings.disconnected")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("analytics.settings.description")}
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("analytics.settings.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertTitle>{t("analytics.settings.successTitle")}</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t("analytics.loading")}</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ga-property-id" className="text-xs font-medium">
              {t("analytics.settings.propertyIdLabel")}
            </Label>
            <Input
              id="ga-property-id"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="123456789"
              className="h-9 font-mono text-sm"
              disabled={!canManage}
            />
            <p className="text-[0.7rem] text-muted-foreground">
              {t("analytics.settings.propertyIdHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ga-service-account" className="text-xs font-medium">
              {t("analytics.settings.serviceAccountLabel")}
            </Label>
            <Textarea
              id="ga-service-account"
              value={serviceAccount}
              onChange={(e) => setServiceAccount(e.target.value)}
              rows={6}
              placeholder='{ "type": "service_account", "client_email": "…", "private_key": "…" }'
              className="font-mono text-xs"
              disabled={!canManage}
            />
            <p className="text-[0.7rem] text-muted-foreground">
              {isConnected
                ? t("analytics.settings.serviceAccountHintConnected")
                : t("analytics.settings.serviceAccountHint")}
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  !propertyId.trim() ||
                  // When already connected, allow saving property-id-only updates.
                  (!isConnected && !serviceAccount.trim())
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("analytics.settings.saving")}
                  </>
                ) : isConnected ? (
                  t("analytics.settings.update")
                ) : (
                  t("analytics.settings.connect")
                )}
              </Button>
              {isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting
                    ? t("analytics.settings.disconnecting")
                    : t("analytics.settings.disconnect")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <Link
            to={`/s/${siteId}/guides/google-analytics`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <BookOpen className="size-3.5" />
            {t("analytics.settings.openGuide")}
          </Link>
        </div>
      )}
    </section>
  );
}
