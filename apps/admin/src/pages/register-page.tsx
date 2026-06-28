import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoftAurora } from "@/components/app/soft-aurora";
import { TypingText } from "@/components/app/typing-text";
import { getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/features/auth/auth-provider";

const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const TAGLINES = [
  "your story starts on a blank page.",
  "schema first, content next.",
  "one workspace, every channel.",
  "structure your content. own your voice.",
];

export function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, register, requiresPolicyAcceptance } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  if (!isLoading && isAuthenticated && requiresPolicyAcceptance) {
    return <Navigate to="/onboarding/policies" replace />;
  }
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      const response = await register({
        email: values.email,
        name: values.name,
        password: values.password,
      });
      navigate(
        response.requiresPolicyAcceptance ? "/onboarding/policies" : "/",
        { replace: true },
      );
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to create an account right now. Please try again."),
      );
    }
  });

  return (
    <main className="narah-aurora-stage dark relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 text-foreground sm:px-6">
      <SoftAurora
        color1="#6366f1"
        color2="#e11d48"
        brightness={1.1}
        speed={0.5}
        bandHeight={0.55}
      />

      {/* Top brand row */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <NarahMark />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-white/55">
            narah / cms
          </span>
        </div>
        <span className="pointer-events-auto font-mono text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
          v0.1 · alpha
        </span>
      </div>

      {/* Center card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-white/65 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-rose-400" />
            </span>
            free tier · 1 site
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/4 p-7 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-8">
          <div className="space-y-2 text-center">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-white/55">
              $ narah register
            </p>
            <h1 className="font-serif text-3xl tracking-tight text-white">
              Create your{" "}
              <em className="italic text-(--narah-accent)">workspace</em>.
            </h1>
            <p className="text-sm text-white/60">
              Free tier — one site. Upgrade to Pro for more.
            </p>
          </div>

          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            {errorMessage ? (
              <Alert variant="destructive" className="py-3">
                <AlertCircle className="size-4" />
                <AlertTitle className="text-sm">Couldn't create account</AlertTitle>
                <AlertDescription className="text-xs">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField
              id="name"
              label="Name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />

            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />

            <Button
              type="submit"
              className="group h-10 w-full text-sm font-medium"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-white/55">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-white/85 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center font-mono text-[0.7rem] tracking-tight text-white/40">
          <span className="text-rose-400/70">{"> "}</span>
          <TypingText
            phrases={TAGLINES}
            className="text-white/65"
            caretClassName="text-rose-400"
          />
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-6 py-5 font-mono text-[0.7rem] text-white/40 sm:px-10">
        <span>© {new Date().getFullYear()} narah</span>
        <span>build · 0.1.0 · sgp1</span>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

type FormFieldProps = {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  error?: string;
} & React.ComponentPropsWithoutRef<typeof Input>;

const FormField = ({ id, label, error, type, autoComplete, placeholder, ...rest }: FormFieldProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-xs font-medium text-white/75">
        {label}
      </Label>
      {error ? (
        <span className="text-[0.7rem] text-destructive">{error}</span>
      ) : null}
    </div>
    <Input
      id={id}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      className="h-10 rounded-lg border-white/10 bg-white/4 text-sm text-white placeholder:text-white/35"
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  </div>
);

const NarahMark = () => (
  <span className="grid size-7 place-items-center rounded-md bg-white text-black" aria-hidden>
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4l16 16V4" />
    </svg>
  </span>
);
