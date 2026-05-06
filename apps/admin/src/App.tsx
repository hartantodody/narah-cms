import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function App() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.09),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(120,113,108,0.16),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full border border-border/70 bg-card/95 py-0 shadow-2xl shadow-black/5 backdrop-blur">
          <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-border/70 p-8 md:border-r md:border-b-0 md:p-10">
              <CardHeader className="px-0">
                <Badge variant="outline" className="mb-4">
                  Foundation Phase
                </Badge>
                <CardTitle className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Narah CMS Admin
                </CardTitle>
                <CardDescription className="max-w-xl text-sm leading-6 md:text-base">
                  Schema-driven content management system
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pt-4 text-sm leading-6 text-muted-foreground">
                This workspace is ready for the first implementation pass. The
                admin shell stays intentionally minimal while we lock down the
                platform foundations for multi-site content management.
              </CardContent>
            </div>

            <div className="space-y-4 p-8 md:p-10">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Initial Focus
                </p>
                <p className="mt-3 text-sm leading-6">
                  Monorepo stability, API structure, shared conventions, and
                  blueprint planning before feature modules arrive.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-border/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Next Up
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Authentication, site management, and schema tooling will be
                  added in later phases.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default App;
