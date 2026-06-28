import { AlertCircle, Copy, Link2, MailPlus, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteInvitationFormDialog } from "@/features/site-invitations/site-invitation-form-dialog";
import {
  getSiteInvitations,
  revokeSiteInvitation,
} from "@/features/site-invitations/site-invitation.api";
import type {
  CreateSiteInvitationResponse,
  SiteInvitation,
  SiteInvitationRole,
} from "@/features/site-invitations/site-invitation.types";
import type { SiteRole } from "@/features/sites/site.types";
import { formatSiteDate } from "@/features/sites/site.utils";
import { getApiErrorMessage } from "@/lib/api";

function getRoleBadgeVariant(role: SiteInvitationRole) {
  switch (role) {
    case "ADMIN":
      return "secondary";
    case "EDITOR":
      return "outline";
    case "VIEWER":
      return "ghost";
    default:
      return "outline";
  }
}

function getRoleBadgeClassName(role: SiteInvitationRole) {
  switch (role) {
    case "ADMIN":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "EDITOR":
      return "border-transparent bg-primary/14 text-[var(--narah-primary-soft)]";
    case "VIEWER":
      return "border-border/80 bg-white/[0.03] text-muted-foreground";
    default:
      return "";
  }
}

function getInvitationStatusBadgeVariant(status: SiteInvitation["status"]) {
  switch (status) {
    case "PENDING":
      return "default";
    case "ACCEPTED":
      return "secondary";
    case "EXPIRED":
      return "outline";
    case "REVOKED":
      return "destructive";
    default:
      return "outline";
  }
}

function getInvitationStatusBadgeClassName(status: SiteInvitation["status"]) {
  switch (status) {
    case "PENDING":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "ACCEPTED":
      return "border-transparent bg-emerald-500/14 text-emerald-300";
    case "EXPIRED":
      return "border-border/80 bg-white/[0.03] text-muted-foreground";
    case "REVOKED":
      return "border-transparent bg-destructive/15 text-red-300";
    default:
      return "";
  }
}

function getAllowedInvitationRoles({
  isSuperAdmin,
  currentUserRole,
}: {
  isSuperAdmin: boolean;
  currentUserRole: SiteRole | null;
}) {
  if (isSuperAdmin || currentUserRole === "OWNER") {
    return ["ADMIN", "EDITOR", "VIEWER"] as SiteInvitationRole[];
  }

  if (currentUserRole === "ADMIN") {
    return ["EDITOR", "VIEWER"] as SiteInvitationRole[];
  }

  return [] as SiteInvitationRole[];
}

type SiteInvitationsSectionProps = {
  siteId: string;
  currentUserRole: SiteRole | null;
  isSuperAdmin: boolean;
};

export function SiteInvitationsSection({
  siteId,
  currentUserRole,
  isSuperAdmin,
}: SiteInvitationsSectionProps) {
  const [invitations, setInvitations] = useState<SiteInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [hasCopiedLatestUrl, setHasCopiedLatestUrl] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [revokingInvitation, setRevokingInvitation] = useState<SiteInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const canManageInvitations =
    isSuperAdmin ||
    currentUserRole === "OWNER" ||
    currentUserRole === "ADMIN";

  const allowedRoles = getAllowedInvitationRoles({
    isSuperAdmin,
    currentUserRole,
  });

  useEffect(() => {
    if (!canManageInvitations) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    async function loadInvitations() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getSiteInvitations(siteId);

        if (!isActive) {
          return;
        }

        setInvitations(response.invitations);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          getApiErrorMessage(
            error,
            "We couldn't load site invitations right now.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInvitations();

    return () => {
      isActive = false;
    };
  }, [canManageInvitations, siteId]);

  const refreshInvitations = async () => {
    const response = await getSiteInvitations(siteId);
    setInvitations(response.invitations);
  };

  const handleInvitationCreated = async (
    response: CreateSiteInvitationResponse,
  ) => {
    await refreshInvitations();
    setLatestInviteUrl(response.inviteUrl);
    setHasCopiedLatestUrl(false);
  };

  const handleCopyInviteUrl = async () => {
    if (!latestInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      setHasCopiedLatestUrl(true);
    } catch {
      setErrorMessage(
        "We couldn't copy the invite link automatically. Please copy it manually.",
      );
    }
  };

  const handleRevokeInvitation = async () => {
    if (!revokingInvitation) {
      return;
    }

    setIsRevoking(true);
    setErrorMessage(null);

    try {
      await revokeSiteInvitation(siteId, revokingInvitation.id);
      await refreshInvitations();
      setRevokingInvitation(null);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't revoke this invitation right now.",
        ),
      );
    } finally {
      setIsRevoking(false);
    }
  };

  if (!canManageInvitations) {
    return (
      <Card className="narah-solid-panel rounded-2xl">
        <CardContent className="space-y-1.5 pt-4 pb-4">
          <p className="text-sm font-medium">Invitation access is limited.</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Only site owners, site admins, and super admins can manage pending
            invitations for this site.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Card className="narah-solid-panel rounded-2xl py-0">
          <CardHeader className="border-b border-border/60 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">Invitations</CardTitle>
                <CardDescription className="text-xs">
                  Create copyable invitation links for site members. Email
                  delivery is not implemented yet.
                </CardDescription>
              </div>
              <Button
                size="lg"
                className="h-9 rounded-lg bg-primary px-4 text-sm shadow-[0_8px_24px_rgba(124,58,237,0.24)] hover:bg-primary/90"
                onClick={() => setIsInviteDialogOpen(true)}
              >
                <MailPlus className="size-3.5" />
                Invite member
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 pb-2">
            {latestInviteUrl ? (
              <Alert className="border-[var(--narah-border-strong)] bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(124,58,237,0.06))]">
                <Link2 />
                <AlertTitle>Invitation link ready</AlertTitle>
                <AlertDescription className="space-y-2.5">
                  <p>
                    Copy this link and send it manually. Email sending will be
                    added in a later step.
                  </p>
                  <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-[rgba(9,6,18,0.88)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <code className="break-all text-xs text-muted-foreground">
                      {latestInviteUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-lg border-[var(--narah-border-strong)] bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)] hover:bg-[rgba(249,115,22,0.22)]"
                      onClick={handleCopyInviteUrl}
                    >
                      <Copy className="size-3.5" />
                      {hasCopiedLatestUrl ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Unable to load invitations</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {isLoading ? (
              <div className="flex min-h-36 items-center justify-center gap-2.5 text-xs text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="narah-muted-surface my-1 flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-6 py-8 text-center">
                <p className="text-sm font-medium">No pending invitations</p>
                <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                  Create an invitation link to add an admin, editor, or viewer
                  to this site.
                </p>
              </div>
            ) : (
              <Table className="[&_td]:h-12 [&_th]:text-[0.65rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-[var(--narah-text-subtle)]">
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead className="w-14 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id} className="border-border/50 hover:bg-white/[0.025]">
                      <TableCell className="text-sm font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getRoleBadgeVariant(invitation.role)}
                          className={getRoleBadgeClassName(invitation.role)}
                        >
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getInvitationStatusBadgeVariant(
                            invitation.status,
                          )}
                          className={getInvitationStatusBadgeClassName(
                            invitation.status,
                          )}
                        >
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatSiteDate(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {invitation.invitedBy.name ?? invitation.invitedBy.email}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="rounded-md border-border/70 bg-background/50 hover:bg-background/80"
                            >
                              <MoreHorizontal className="size-3.5" />
                              <span className="sr-only">Open invitation actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setRevokingInvitation(invitation)}
                            >
                              Revoke
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <SiteInvitationFormDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        siteId={siteId}
        allowedRoles={allowedRoles}
        defaultRole={allowedRoles[0] ?? "EDITOR"}
        onSuccess={handleInvitationCreated}
      />

      <AlertDialog
        open={Boolean(revokingInvitation)}
        onOpenChange={(open) => {
          if (!open) {
            setRevokingInvitation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokingInvitation
                ? `Revoke the pending invite for ${revokingInvitation.email}. The current invitation link will stop working.`
                : "The current invitation link will stop working."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isRevoking}
              onClick={handleRevokeInvitation}
            >
              {isRevoking ? "Revoking..." : "Revoke invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
