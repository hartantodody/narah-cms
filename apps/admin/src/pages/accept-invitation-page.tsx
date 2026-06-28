import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LockKeyhole, UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitation } from "@/features/site-invitations/site-invitation.api";
import type { AcceptInvitationResponse } from "@/features/site-invitations/site-invitation.types";
import { getApiErrorMessage } from "@/lib/api";

const acceptInvitationSchema = z.object({
  name: z.string(),
  password: z
    .string()
    .refine(
      (value) => value.trim() === "" || value.trim().length >= 8,
      "Password must be at least 8 characters long.",
    ),
});

type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResponse, setSuccessResponse] =
    useState<AcceptInvitationResponse | null>(null);
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      setErrorMessage("This invitation link is missing its token.");
      return;
    }

    setErrorMessage(null);

    try {
      const response = await acceptInvitation({
        token,
        name: values.name.trim() || undefined,
        password: values.password.trim() || undefined,
      });

      setSuccessResponse(response);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't accept this invitation right now.",
        ),
      );
    }
  });

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <Card className="narah-glass-panel narah-gradient-border w-full max-w-2xl rounded-3xl py-0">
          <div className="grid md:grid-cols-[1fr_0.95fr]">
            <div className="border-b border-border/60 p-8 md:border-r md:border-b-0 md:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]">
                  Invitation Access
                </Badge>
                <Badge
                  variant="outline"
                  className="border-[var(--narah-border-strong)] bg-white/[0.03] text-[var(--narah-primary-soft)]"
                >
                  Manual Invite Link
                </Badge>
              </div>
              <div className="mt-6 space-y-3">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  Join Narah CMS
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  You&apos;ve been invited to join a Narah CMS site. Existing
                  users can accept and then log in. New users can create their
                  account here first.
                </p>
              </div>

              <div className="mt-7 space-y-3">
                <div className="narah-muted-surface rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Before you continue
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Name and password are required only if this email does not
                    have an account yet.
                  </p>
                </div>
                {!token ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Missing invitation token</AlertTitle>
                    <AlertDescription>
                      Open this page using the full invitation link that was
                      shared with you.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,rgba(17,16,26,0.52),rgba(11,7,20,0.24))] p-8 md:p-10">
              <CardHeader className="px-0 pb-5">
                <CardTitle className="font-heading text-xl font-semibold">Accept invitation</CardTitle>
                <CardDescription className="leading-6">
                  Complete the invitation to continue into Narah CMS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-0 pt-0">
                {successResponse ? (
                  <Alert>
                    <CheckCircle2 />
                    <AlertTitle>Invitation accepted</AlertTitle>
                    <AlertDescription className="space-y-4">
                      <p>{successResponse.message}</p>
                      <Button asChild size="lg" className="rounded-lg">
                        <Link to="/login">Go to login</Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <form className="space-y-4" onSubmit={onSubmit}>
                    {errorMessage ? (
                      <Alert variant="destructive">
                        <AlertCircle />
                        <AlertTitle>Unable to accept invitation</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-name" className="text-xs font-medium">Name</Label>
                      <div className="relative">
                        <UserRoundPlus className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="invite-name"
                          placeholder="Your full name"
                          className="h-10 rounded-lg border-border/80 bg-background/60 pl-9 text-sm"
                          {...form.register("name")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Required only if this email does not already have an account.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-password" className="text-xs font-medium">Password</Label>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="invite-password"
                          type="password"
                          autoComplete="new-password"
                          className="h-10 rounded-lg border-border/80 bg-background/60 pl-9 text-sm"
                          aria-invalid={
                            form.formState.errors.password ? true : undefined
                          }
                          {...form.register("password")}
                        />
                      </div>
                      {form.formState.errors.password ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.password.message}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Required only if this email does not already have an account.
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="mt-1 h-10 w-full rounded-lg bg-primary text-sm shadow-[0_12px_32px_rgba(124,58,237,0.28)] hover:bg-primary/90"
                      disabled={form.formState.isSubmitting || !token}
                    >
                      {form.formState.isSubmitting
                        ? "Accepting invitation..."
                        : "Accept invitation"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
