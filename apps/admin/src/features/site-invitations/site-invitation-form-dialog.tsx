import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSiteInvitation } from "@/features/site-invitations/site-invitation.api";
import type {
  CreateSiteInvitationResponse,
  SiteInvitationRole,
} from "@/features/site-invitations/site-invitation.types";
import { getApiErrorMessage } from "@/lib/api";

const invitationFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

type InvitationFormValues = z.infer<typeof invitationFormSchema>;

type SiteInvitationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  allowedRoles: SiteInvitationRole[];
  defaultRole: SiteInvitationRole;
  onSuccess?: (
    response: CreateSiteInvitationResponse,
  ) => Promise<void> | void;
};

export function SiteInvitationFormDialog({
  open,
  onOpenChange,
  siteId,
  allowedRoles,
  defaultRole,
  onSuccess,
}: SiteInvitationFormDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: "",
      role: defaultRole,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      email: "",
      role: defaultRole,
    });
    setErrorMessage(null);
  }, [defaultRole, form, open]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);

    try {
      const response = await createSiteInvitation(siteId, values);
      await onSuccess?.(response);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't create this invitation right now.",
        ),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            Invite a member
          </DialogTitle>
          <DialogDescription>
            Email sending is not enabled yet. We&apos;ll generate a copyable
            invitation link after you create the invite.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to create invitation</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-medium">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="editor@example.com"
              className="h-9 rounded-lg border-border/80 bg-background/60 text-sm"
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-xs font-medium">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="invite-role"
                    className="h-9 w-full rounded-lg border-border/80 bg-background/60 text-sm"
                  >
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg border-border/80 bg-background/60 hover:bg-background/80"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-lg bg-primary px-4 hover:bg-primary/90"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating..." : "Create invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
