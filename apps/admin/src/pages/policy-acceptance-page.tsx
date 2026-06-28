import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getRequiredPolicies } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/auth-provider";
import type { PolicyDocumentResponse } from "@/features/auth/auth.types";
import { getApiErrorMessage } from "@/lib/api";

export function PolicyAcceptancePage() {
  const navigate = useNavigate();
  const { acceptRequiredPolicies, isLoading, requiresPolicyAcceptance, user, memberships } = useAuth();

  const postAcceptanceTarget = user?.isSuperAdmin
    ? "/admin"
    : memberships.length === 1
      ? `/s/${memberships[0].siteId}`
      : "/sites";
  const [policies, setPolicies] = useState<PolicyDocumentResponse[]>([]);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPolicies() {
      setIsPageLoading(true);
      setErrorMessage(null);

      try {
        const response = await getRequiredPolicies();

        if (!isActive) {
          return;
        }

        setPolicies(response.policies);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          getApiErrorMessage(
            error,
            "Unable to load the active policy documents right now.",
          ),
        );
      } finally {
        if (isActive) {
          setIsPageLoading(false);
        }
      }
    }

    void loadPolicies();

    return () => {
      isActive = false;
    };
  }, []);

  if (!isLoading && !requiresPolicyAcceptance) {
    return <Navigate to={postAcceptanceTarget} replace />;
  }

  const onAcceptPolicies = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await acceptRequiredPolicies(
        policies.map((policy) => policy.id),
      );

      if (response.requiresPolicyAcceptance) {
        setErrorMessage(
          "Some required policies are still pending. Please review them again.",
        );
        return;
      }

      navigate(postAcceptanceTarget, {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't record your policy acceptance. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {/* Page header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[0.65rem] uppercase tracking-wider">
              First Login
            </Badge>
            <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider">
              Legal Onboarding
            </Badge>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-serif text-3xl tracking-tight">
              Review required{" "}
              <em className="italic text-(--narah-accent)">legal documents</em>
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Before you can access the Narah CMS dashboard, you need to accept
              the latest active Privacy Policy and User Agreement for your
              account.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to continue</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {isPageLoading ? (
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-2.5 py-4">
              <Spinner className="size-3.5" />
              <p className="text-xs text-muted-foreground">
                Loading active policy documents...
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {policies.map((policy) => (
                <Card key={policy.id} className="rounded-2xl py-0">
                  <CardHeader className="border-b border-border py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-semibold">
                          {policy.title}
                        </CardTitle>
                        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          {policy.type.replaceAll("_", " ")} · Version{" "}
                          {policy.version}
                        </p>
                      </div>
                      <Badge
                        variant={policy.accepted ? "secondary" : "outline"}
                        className="font-mono text-[0.6rem] uppercase tracking-wider"
                      >
                        {policy.accepted
                          ? "Already accepted"
                          : "Requires acceptance"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="py-4">
                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-6 text-foreground/80">
                      {policy.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="rounded-2xl">
              <CardContent className="space-y-4 py-4">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                  <Checkbox
                    id="policy-confirmation"
                    checked={hasConfirmed}
                    onCheckedChange={(checked) => setHasConfirmed(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="policy-confirmation" className="text-sm leading-snug">
                      I have read and agree to the active Privacy Policy and User
                      Agreement.
                    </Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Your acceptance will be recorded for audit purposes and
                      allows access to the Narah CMS admin workspace.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    Required for first-time access
                  </div>
                  <Button
                    size="sm"
                    onClick={onAcceptPolicies}
                    disabled={isSubmitting || !hasConfirmed || policies.length === 0}
                    className="gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner className="size-3.5" />
                        Saving acceptance...
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="size-3.5" />
                        Accept and continue
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Accepted documents remain visible here until dashboard access is
              fully unlocked.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
