import { AlertCircle, MoreHorizontal, UserRoundCog, UserRoundMinus } from "lucide-react";
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
import { getSiteMembers, removeSiteMember } from "@/features/site-members/site-member.api";
import { SiteMemberRoleDialog } from "@/features/site-members/site-member-role-dialog";
import type {
  SiteMember,
  SiteMemberRole,
} from "@/features/site-members/site-member.types";
import type { SiteRole } from "@/features/sites/site.types";
import { formatSiteDate } from "@/features/sites/site.utils";
import { getApiErrorMessage } from "@/lib/api";

const allRoles: SiteMemberRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const adminManageableRoles = new Set<SiteMemberRole>(["EDITOR", "VIEWER"]);

function getRoleBadgeVariant(role: SiteMemberRole) {
  switch (role) {
    case "OWNER":
      return "default";
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

function getRoleBadgeClassName(role: SiteMemberRole) {
  switch (role) {
    case "OWNER":
      return "border-transparent bg-primary/14 text-[var(--narah-primary-soft)]";
    case "ADMIN":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "EDITOR":
      return "border-border/80 bg-white/[0.03] text-foreground";
    case "VIEWER":
      return "border-border/70 bg-background/50 text-muted-foreground";
    default:
      return "";
  }
}

function getStatusBadgeVariant(status: SiteMember["user"]["status"]) {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "PENDING":
      return "secondary";
    case "DISABLED":
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusBadgeClassName(status: SiteMember["user"]["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-transparent bg-emerald-500/14 text-emerald-300";
    case "PENDING":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "DISABLED":
      return "border-transparent bg-destructive/15 text-red-300";
    default:
      return "";
  }
}

function canManageTargetMember({
  isSuperAdmin,
  currentUserRole,
  targetRole,
}: {
  isSuperAdmin: boolean;
  currentUserRole: SiteRole | null;
  targetRole: SiteMemberRole;
}) {
  if (isSuperAdmin) {
    return true;
  }

  if (currentUserRole === "OWNER") {
    return true;
  }

  if (currentUserRole === "ADMIN") {
    return adminManageableRoles.has(targetRole);
  }

  return false;
}

function getAllowedRolesForActor({
  isSuperAdmin,
  currentUserRole,
}: {
  isSuperAdmin: boolean;
  currentUserRole: SiteRole | null;
}) {
  if (isSuperAdmin || currentUserRole === "OWNER") {
    return allRoles;
  }

  if (currentUserRole === "ADMIN") {
    return ["EDITOR", "VIEWER"] as SiteMemberRole[];
  }

  return [] as SiteMemberRole[];
}

type SiteMembersSectionProps = {
  siteId: string;
  currentUserRole: SiteRole | null;
  isSuperAdmin: boolean;
  onMembersChanged?: () => Promise<void> | void;
};

export function SiteMembersSection({
  siteId,
  currentUserRole,
  isSuperAdmin,
  onMembersChanged,
}: SiteMembersSectionProps) {
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<SiteMember | null>(null);
  const [removingMember, setRemovingMember] = useState<SiteMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadMembers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getSiteMembers(siteId);

        if (!isActive) {
          return;
        }

        setMembers(response.members);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          getApiErrorMessage(error, "We couldn't load site members right now."),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      isActive = false;
    };
  }, [siteId]);

  const allowedRoles = getAllowedRolesForActor({
    isSuperAdmin,
    currentUserRole,
  });

  const refreshMembers = async () => {
    const response = await getSiteMembers(siteId);
    setMembers(response.members);
    await onMembersChanged?.();
  };

  const handleRoleUpdated = async () => {
    await refreshMembers();
    setEditingMember(null);
  };

  const handleRemoveMember = async () => {
    if (!removingMember) {
      return;
    }

    setIsRemoving(true);
    setErrorMessage(null);

    try {
      await removeSiteMember(siteId, removingMember.id);
      await refreshMembers();
      setRemovingMember(null);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't remove this site member right now.",
        ),
      );
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <Card className="narah-solid-panel rounded-2xl py-0">
        <CardHeader className="border-b border-border/60 py-4">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold">Members</CardTitle>
            <CardDescription className="text-xs">
              Manage who can access this site and what role they hold.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-3 pb-2">
          {errorMessage ? (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle />
              <AlertTitle>Unable to load members</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-36 items-center justify-center gap-2.5 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="narah-muted-surface my-1 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-border/60 px-6 py-8 text-center">
              <p className="text-sm font-medium text-muted-foreground">No members found for this site.</p>
            </div>
          ) : (
            <Table className="[&_td]:h-12 [&_th]:text-[0.65rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-[var(--narah-text-subtle)]">
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-14 text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                  const canManage = canManageTargetMember({
                    isSuperAdmin,
                    currentUserRole,
                    targetRole: member.role,
                  });

                  return (
                    <TableRow key={member.id} className="border-border/50 hover:bg-white/[0.025]">
                      <TableCell className="text-sm font-medium">
                        {member.user.name ?? "Unnamed user"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {member.user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getRoleBadgeVariant(member.role)}
                          className={getRoleBadgeClassName(member.role)}
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(member.user.status)}
                          className={getStatusBadgeClassName(member.user.status)}
                        >
                          {member.user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatSiteDate(member.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="rounded-md border-border/70 bg-background/50 hover:bg-background/80"
                              >
                                <MoreHorizontal className="size-3.5" />
                                <span className="sr-only">Open member actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => setEditingMember(member)}
                              >
                                <UserRoundCog className="size-3.5" />
                                Change role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setRemovingMember(member)}
                              >
                                <UserRoundMinus className="size-3.5" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SiteMemberRoleDialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMember(null);
          }
        }}
        siteId={siteId}
        member={editingMember}
        allowedRoles={allowedRoles}
        onSuccess={handleRoleUpdated}
      />

      <AlertDialog
        open={Boolean(removingMember)}
        onOpenChange={(open) => {
          if (!open) {
            setRemovingMember(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMember
                ? `Remove ${removingMember.user.email} from this site. They will lose site access immediately.`
                : "This member will lose site access immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isRemoving}
              onClick={handleRemoveMember}
            >
              {isRemoving ? "Removing..." : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
