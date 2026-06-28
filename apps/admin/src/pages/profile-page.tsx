import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, KeyRound, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import {
  changePassword as changePasswordRequest,
  updateProfile as updateProfileRequest,
} from "@/features/auth/auth.api";
import type { SiteMembershipRole } from "@/features/auth/auth.types";
import { SiteAvatar } from "@/features/sites/site-avatar";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, memberships, refreshMe } = useAuth();
  const [profileMsg, setProfileMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSaveProfile = profileForm.handleSubmit(async (values) => {
    setProfileMsg(null);
    try {
      await updateProfileRequest({ name: values.name });
      await refreshMe();
      setProfileMsg({ kind: "ok", text: "Profile updated." });
    } catch (err) {
      setProfileMsg({
        kind: "error",
        text: getApiErrorMessage(err, "Unable to update profile."),
      });
    }
  });

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordMsg(null);
    try {
      await changePasswordRequest({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset();
      setPasswordMsg({ kind: "ok", text: "Password updated." });
    } catch (err) {
      setPasswordMsg({
        kind: "error",
        text: getApiErrorMessage(err, "Unable to change password."),
      });
    }
  });

  const displayName = user?.name ?? user?.email ?? "User";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-1.5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          account
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          <em className="italic text-(--narah-accent)">Profile</em>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage your account details and password.
        </p>
      </header>

      {/* Identity card */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-(--narah-shadow-xs)">
        <div className="flex items-center gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-full bg-foreground text-lg font-semibold text-background"
            aria-hidden
          >
            {(displayName[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
          {user?.isSuperAdmin ? (
            <Badge
              variant="outline"
              className="border-(--narah-accent)/30 bg-(--narah-accent)/10 font-mono text-[0.6rem] uppercase text-(--narah-accent)"
            >
              super admin
            </Badge>
          ) : null}
        </div>
      </section>

      {/* Profile form */}
      <section className="space-y-3">
        <SectionHeader
          icon={User}
          title="Account details"
          subtitle="Update how your name appears across the workspace."
        />
        <form
          onSubmit={onSaveProfile}
          className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-(--narah-shadow-xs)"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...profileForm.register("name")}
              placeholder="Your name"
            />
            {profileForm.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact a super admin if you need to
              update it.
            </p>
          </div>
          {profileMsg ? (
            <Alert variant={profileMsg.kind === "ok" ? "default" : "destructive"}>
              {profileMsg.kind === "ok" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription>{profileMsg.text}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              {profileForm.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      {/* Password form */}
      <section className="space-y-3">
        <SectionHeader
          icon={KeyRound}
          title="Change password"
          subtitle="At least 8 characters."
        />
        <form
          onSubmit={onChangePassword}
          className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-(--narah-shadow-xs)"
        >
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...passwordForm.register("currentPassword")}
            />
            {passwordForm.formState.errors.currentPassword ? (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword ? (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword ? (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>
          {passwordMsg ? (
            <Alert
              variant={passwordMsg.kind === "ok" ? "default" : "destructive"}
            >
              {passwordMsg.kind === "ok" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription>{passwordMsg.text}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
            >
              {passwordForm.formState.isSubmitting
                ? "Updating…"
                : "Update password"}
            </Button>
          </div>
        </form>
      </section>

      {/* Memberships (only meaningful for non-super-admins) */}
      {!user?.isSuperAdmin && memberships.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            icon={User}
            title="Your sites"
            subtitle={`You are a member of ${memberships.length} site${memberships.length === 1 ? "" : "s"}.`}
          />
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.siteId}>
                <Link
                  to={`/s/${m.siteId}`}
                  className="narah-neon-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
                >
                  <SiteAvatar
                    name={m.siteName}
                    id={m.siteId}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.siteName}
                    </p>
                    <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
                      {m.siteSlug}
                    </p>
                  </div>
                  <RoleBadge role={m.role} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof User;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div className="space-y-0.5">
        <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: SiteMembershipRole }) {
  const styles: Record<SiteMembershipRole, string> = {
    OWNER:
      "border-(--narah-accent)/30 bg-(--narah-accent)/10 text-(--narah-accent)",
    ADMIN:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    EDITOR:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    VIEWER:
      "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400",
  };
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[0.6rem] uppercase", styles[role])}
    >
      {role.toLowerCase()}
    </Badge>
  );
}
