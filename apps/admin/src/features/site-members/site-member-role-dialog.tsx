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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSiteMember } from "@/features/site-members/site-member.api";
import type {
  SiteMember,
  SiteMemberRole,
} from "@/features/site-members/site-member.types";
import { getApiErrorMessage } from "@/lib/api";

const siteMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
});

type SiteMemberRoleValues = z.infer<typeof siteMemberRoleSchema>;

type SiteMemberRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  member: SiteMember | null;
  allowedRoles: SiteMemberRole[];
  onSuccess?: (member: SiteMember) => Promise<void> | void;
};

export function SiteMemberRoleDialog({
  open,
  onOpenChange,
  siteId,
  member,
  allowedRoles,
  onSuccess,
}: SiteMemberRoleDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<SiteMemberRoleValues>({
    resolver: zodResolver(siteMemberRoleSchema),
    defaultValues: {
      role: member?.role ?? "EDITOR",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      role: member?.role ?? allowedRoles[0] ?? "EDITOR",
    });
    setErrorMessage(null);
  }, [allowedRoles, form, member, open]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!member) {
      return;
    }

    setErrorMessage(null);

    try {
      const response = await updateSiteMember(siteId, member.id, values);
      await onSuccess?.(response.member);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn't update this member role right now.",
        ),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            Change member role
          </DialogTitle>
          <DialogDescription>
            Update the site role for {member?.user.name ?? member?.user.email}.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to update role</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="member-role" className="text-xs font-medium">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="member-role"
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
              {form.formState.isSubmitting ? "Saving..." : "Save role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
