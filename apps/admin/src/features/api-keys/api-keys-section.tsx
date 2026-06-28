import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from "./api-key.api";
import type { ApiKey, ApiKeyScope } from "./api-key.types";

const ENTRIES_READ: ApiKeyScope = "entries:read";
const ENTRIES_READ_DRAFTS: ApiKeyScope = "entries:read-drafts";
import type { SiteRole } from "@/features/sites/site.types";
import { getApiErrorMessage } from "@/lib/api";

const canManage = (role: SiteRole | null, isSuperAdmin: boolean) =>
  isSuperAdmin || role === "OWNER" || role === "ADMIN";

type StatusKey = "active" | "revoked" | "expired";

const statusOf = (key: ApiKey): { key: StatusKey; className: string } => {
  if (key.revokedAt) {
    return {
      key: "revoked",
      className:
        "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400",
    };
  }
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return {
      key: "expired",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    key: "active",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
};

type Props = {
  siteId: string;
  currentUserRole: SiteRole | null;
  isSuperAdmin: boolean;
};

export function ApiKeysSection({
  siteId,
  currentUserRole,
  isSuperAdmin,
}: Props) {
  const { t } = useTranslation();
  const userCanManage = canManage(currentUserRole, isSuperAdmin);
  const [items, setItems] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState<{ plaintext: string; key: ApiKey } | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formExpires, setFormExpires] = useState("");
  const [formOrigins, setFormOrigins] = useState("");
  const [formRateLimit, setFormRateLimit] = useState("60");
  const [formAllowDrafts, setFormAllowDrafts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrigins, setEditOrigins] = useState("");
  const [editRateLimit, setEditRateLimit] = useState("60");
  const [editAllowDrafts, setEditAllowDrafts] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState<ApiKey | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const openEdit = (key: ApiKey) => {
    setEditing(key);
    setEditName(key.name);
    setEditOrigins(key.allowedOrigins.join("\n"));
    setEditRateLimit(String(key.rateLimitPerMinute));
    setEditAllowDrafts(key.scopes.includes(ENTRIES_READ_DRAFTS));
    setEditError(null);
  };

  const scopesFromToggle = (allowDrafts: boolean): ApiKeyScope[] =>
    allowDrafts ? [ENTRIES_READ, ENTRIES_READ_DRAFTS] : [ENTRIES_READ];

  const parseOrigins = (raw: string): string[] =>
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await listApiKeys(siteId);
      setItems(response.apiKeys);
    } catch (err) {
      setError(getApiErrorMessage(err, t("apiKeys.section.loadErrorFallback")));
    } finally {
      setIsLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const rate = Number(formRateLimit);
      const response = await createApiKey(siteId, {
        name: formName.trim(),
        scopes: scopesFromToggle(formAllowDrafts),
        expiresAt: formExpires
          ? new Date(formExpires).toISOString()
          : undefined,
        allowedOrigins: parseOrigins(formOrigins),
        rateLimitPerMinute:
          Number.isFinite(rate) && rate > 0 ? Math.floor(rate) : undefined,
      });
      setNewKey({ plaintext: response.plaintext, key: response.apiKey });
      setCreateOpen(false);
      setFormName("");
      setFormExpires("");
      setFormOrigins("");
      setFormRateLimit("60");
      setFormAllowDrafts(false);
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, t("apiKeys.section.createErrorFallback")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setIsEditSaving(true);
    setEditError(null);
    try {
      const rate = Number(editRateLimit);
      await updateApiKey(siteId, editing.id, {
        name: editName.trim(),
        scopes: scopesFromToggle(editAllowDrafts),
        allowedOrigins: parseOrigins(editOrigins),
        rateLimitPerMinute:
          Number.isFinite(rate) && rate > 0 ? Math.floor(rate) : undefined,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(getApiErrorMessage(err, t("apiKeys.section.updateErrorFallback")));
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    setIsMutating(true);
    try {
      await revokeApiKey(siteId, revoking.id);
      setRevoking(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, t("apiKeys.section.revokeErrorFallback")));
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsMutating(true);
    try {
      await deleteApiKey(siteId, deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, t("apiKeys.section.errorFallback")));
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("apiKeys.section.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            <Trans
              i18nKey="apiKeys.section.description"
              components={{ code: <code /> }}
            />
          </p>
        </div>
        {userCanManage ? (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="size-4" />
            {t("apiKeys.section.newKey")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("apiKeys.section.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!userCanManage && !isLoading ? (
        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>{t("apiKeys.section.readOnlyTitle")}</AlertTitle>
          <AlertDescription>
            {t("apiKeys.section.readOnlyDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--narah-shadow-xs)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">{t("apiKeys.table.name")}</TableHead>
              <TableHead>{t("apiKeys.table.status")}</TableHead>
              <TableHead>{t("apiKeys.table.prefix")}</TableHead>
              <TableHead>{t("apiKeys.table.origins")}</TableHead>
              <TableHead>{t("apiKeys.table.rate")}</TableHead>
              <TableHead>{t("apiKeys.table.lastUsed")}</TableHead>
              <TableHead>{t("apiKeys.table.expires")}</TableHead>
              <TableHead className="w-27.5 text-right">
                {t("apiKeys.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <Spinner className="size-4" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {t("apiKeys.section.noKeys")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((key) => {
                const status = statusOf(key);
                return (
                  <TableRow key={key.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        {t("apiKeys.section.byUser", {
                          name: key.createdBy.name || key.createdBy.email,
                        })}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={status.className}>
                          {t(`apiKeys.status.${status.key}`)}
                        </Badge>
                        {key.scopes.includes(ENTRIES_READ_DRAFTS) ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-[0.65rem] text-amber-700 dark:text-amber-400"
                            title={t("apiKeys.status.previewTooltip")}
                          >
                            {t("apiKeys.status.preview")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      narah_…{key.keyPrefix}
                    </TableCell>
                    <TableCell>
                      {key.allowedOrigins.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[0.65rem] text-muted-foreground"
                        >
                          {t("apiKeys.table.anyOrigin")}
                        </Badge>
                      ) : (
                        <div
                          className="font-mono text-[0.7rem] text-muted-foreground"
                          title={key.allowedOrigins.join("\n")}
                        >
                          {t("apiKeys.table.originsCount", {
                            count: key.allowedOrigins.length,
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[0.7rem] text-muted-foreground">
                      {t("apiKeys.table.ratePerMinute", {
                        count: key.rateLimitPerMinute,
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleString()
                        : t("apiKeys.table.neverUsed")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleDateString()
                        : t("apiKeys.table.neverExpires")}
                    </TableCell>
                    <TableCell className="text-right">
                      {userCanManage ? (
                        <div className="flex justify-end gap-0.5">
                          {!key.revokedAt ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(key)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={t("apiKeys.table.editAria")}
                              title={t("common.edit")}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          ) : null}
                          {!key.revokedAt ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevoking(key)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {t("apiKeys.table.revoke")}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(key)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={t("apiKeys.table.deleteAria")}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.create.title")}</DialogTitle>
            <DialogDescription>
              {t("apiKeys.create.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="key-name" className="text-xs font-medium">
                {t("apiKeys.create.nameLabel")}
              </Label>
              <Input
                id="key-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("apiKeys.create.namePlaceholder")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-expires" className="text-xs font-medium">
                  {t("apiKeys.create.expiresLabel")}{" "}
                  <span className="text-muted-foreground">{t("common.optional")}</span>
                </Label>
                <Input
                  id="key-expires"
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-rate" className="text-xs font-medium">
                  {t("apiKeys.create.rateLimitLabel")}
                </Label>
                <Input
                  id="key-rate"
                  type="number"
                  min={1}
                  max={10000}
                  value={formRateLimit}
                  onChange={(e) => setFormRateLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="key-origins" className="text-xs font-medium">
                {t("apiKeys.create.originsLabel")}{" "}
                <span className="text-muted-foreground">{t("common.optional")}</span>
              </Label>
              <Textarea
                id="key-origins"
                value={formOrigins}
                onChange={(e) => setFormOrigins(e.target.value)}
                placeholder={t("apiKeys.create.originsPlaceholder")}
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-[0.7rem] text-muted-foreground">
                {t("apiKeys.create.originsHint")}
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5">
              <Checkbox
                id="key-allow-drafts"
                checked={formAllowDrafts}
                onCheckedChange={(c) => setFormAllowDrafts(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="key-allow-drafts"
                  className="text-xs font-medium leading-none"
                >
                  {t("apiKeys.create.allowDraftLabel")}{" "}
                  <span className="text-muted-foreground">
                    ({ENTRIES_READ_DRAFTS})
                  </span>
                </Label>
                <p className="text-[0.7rem] text-muted-foreground">
                  <Trans
                    i18nKey="apiKeys.create.allowDraftHint"
                    components={{ code: <code /> }}
                  />
                </p>
              </div>
            </div>

            {formError ? (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">
                  {formError}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || formName.trim().length < 2}
            >
              {isSubmitting
                ? t("apiKeys.create.submitting")
                : t("apiKeys.create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("apiKeys.edit.title", { name: editing.name })}
                </DialogTitle>
                <DialogDescription>
                  {t("apiKeys.edit.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name" className="text-xs font-medium">
                    {t("apiKeys.create.nameLabel")}
                  </Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-rate" className="text-xs font-medium">
                    {t("apiKeys.create.rateLimitLabel")}
                  </Label>
                  <Input
                    id="edit-rate"
                    type="number"
                    min={1}
                    max={10000}
                    value={editRateLimit}
                    onChange={(e) => setEditRateLimit(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-origins" className="text-xs font-medium">
                    {t("apiKeys.create.originsLabel")}
                  </Label>
                  <Textarea
                    id="edit-origins"
                    value={editOrigins}
                    onChange={(e) => setEditOrigins(e.target.value)}
                    placeholder={t("apiKeys.create.originsPlaceholder")}
                    rows={4}
                    className="font-mono text-xs"
                  />
                  <p className="text-[0.7rem] text-muted-foreground">
                    {t("apiKeys.edit.originsHint")}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5">
                  <Checkbox
                    id="edit-allow-drafts"
                    checked={editAllowDrafts}
                    onCheckedChange={(c) => setEditAllowDrafts(c === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="edit-allow-drafts"
                      className="text-xs font-medium leading-none"
                    >
                      {t("apiKeys.create.allowDraftLabel")}{" "}
                      <span className="text-muted-foreground">
                        ({ENTRIES_READ_DRAFTS})
                      </span>
                    </Label>
                    <p className="text-[0.7rem] text-muted-foreground">
                      <Trans
                        i18nKey="apiKeys.edit.allowDraftHint"
                        components={{ code: <code /> }}
                      />
                    </p>
                  </div>
                </div>

                {editError ? (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">
                      {editError}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditing(null)}
                  disabled={isEditSaving}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={isEditSaving || editName.trim().length < 2}
                >
                  {isEditSaving
                    ? t("apiKeys.edit.submitting")
                    : t("apiKeys.edit.submit")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* One-time plaintext reveal */}
      <Dialog
        open={newKey !== null}
        onOpenChange={(open) => !open && setNewKey(null)}
      >
        <DialogContent>
          {newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("apiKeys.reveal.title")}</DialogTitle>
                <DialogDescription>
                  {t("apiKeys.reveal.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <KeyReveal value={newKey.plaintext} />
                <Alert>
                  <KeyRound className="size-4" />
                  <AlertTitle className="text-sm">
                    {newKey.key.name}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {t("apiKeys.reveal.scopesLine", {
                      scopes: newKey.key.scopes.join(", "),
                    })}
                    {newKey.key.expiresAt
                      ? t("apiKeys.reveal.expiresLine", {
                          date: new Date(newKey.key.expiresAt).toLocaleDateString(),
                        })
                      : t("apiKeys.reveal.neverExpiresLine")}
                  </AlertDescription>
                </Alert>
                <div className="rounded-md bg-muted/40 p-3 font-mono text-[0.7rem] text-muted-foreground">
                  <p className="mb-1.5 text-foreground">{t("apiKeys.reveal.tryIt")}</p>
                  <pre className="overflow-x-auto whitespace-pre">{`curl -H "Authorization: Bearer ${newKey.plaintext.slice(0, 16)}..." \\
  ${apiBaseUrl()}/public/v1/me`}</pre>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setNewKey(null)}>{t("common.done")}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("apiKeys.revoke.title", { name: revoking?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("apiKeys.revoke.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating}
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
            >
              {isMutating
                ? t("apiKeys.revoke.submitting")
                : t("apiKeys.revoke.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("apiKeys.delete.title", { name: deleting?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("apiKeys.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {isMutating
                ? t("apiKeys.delete.submitting")
                : t("apiKeys.delete.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

/* -------------------------------------------------------------------------- */

function KeyReveal({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
      <code className="flex-1 truncate font-mono text-xs">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <>
            <Check className="size-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

const apiBaseUrl = (): string =>
  (import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000").replace(
    /\/+$/,
    "",
  );
