import {
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

export type RailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  superAdminOnly?: boolean;
  badge?: "soon";
};

export type RailSection = {
  label?: string;
  items: RailItem[];
};

const universalTop: RailItem[] = [
  { id: "home", label: "Home", icon: Home, to: "/" },
  { id: "sites", label: "Sites", icon: Building2, to: "/sites" },
  { id: "admin", label: "Admin", icon: ShieldCheck, to: "/admin", superAdminOnly: true },
];

const universalBottom: RailItem[] = [
  { id: "profile", label: "Profile", icon: UserIcon, to: "/profile" },
];

type AppRailProps = {
  /** When true, rail is locked to icon-only mode (no toggle). */
  forceCollapsed?: boolean;
  /** When true, rail starts expanded — for layouts that prefer label-mode. */
  defaultExpanded?: boolean;
  /** Override the default universal top-section items. */
  sections?: RailSection[];
  /** Override the universal bottom-section items. */
  bottomItems?: RailItem[];
};

/**
 * Universal navigation rail.
 *
 * Modes:
 *  - icon-only (collapsed) — default. Hover surfaces a tooltip with the label.
 *  - expanded — label visible inline. User toggles via button at the bottom.
 *
 * `forceCollapsed` locks to icon-only (no toggle). `defaultExpanded` starts in
 * label mode. Callers can also fully override the menu via `sections` /
 * `bottomItems` for context-specific rails (e.g. AdminLayout passes its
 * platform/system items).
 */
export function AppRail({
  forceCollapsed = false,
  defaultExpanded = false,
  sections,
  bottomItems,
}: AppRailProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userExpanded, setUserExpanded] = useState(defaultExpanded);
  const expanded = !forceCollapsed && userExpanded;

  const isSuperAdmin = !!user?.isSuperAdmin;

  const resolvedSections: RailSection[] = sections ?? [
    { items: universalTop.filter((i) => !i.superAdminOnly || isSuperAdmin) },
  ];
  const resolvedBottom = bottomItems ?? universalBottom;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border/40 bg-foreground/2.5 transition-[width] duration-200 dark:bg-white/2",
          expanded ? "w-52" : "w-15",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 items-center px-2",
            expanded ? "gap-2.5 px-4" : "justify-center",
          )}
        >
          <NarahMark />
          {expanded ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold tracking-tight">Narah</span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                cms
              </span>
            </div>
          ) : null}
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {resolvedSections.map((section, idx) => (
            <div key={section.label ?? `s-${idx}`} className="mt-3 first:mt-1">
              {section.label && expanded ? (
                <div className="px-2 pb-1.5">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {section.label}
                  </span>
                </div>
              ) : null}
              <ul className="space-y-1">
                {section.items
                  .filter((i) => !i.superAdminOnly || isSuperAdmin)
                  .map((item) => (
                    <li key={item.id}>
                      <RailLink item={item} expanded={expanded} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom items */}
        <div className="px-2 pb-2">
          <ul className="space-y-1">
            {resolvedBottom
              .filter((i) => !i.superAdminOnly || isSuperAdmin)
              .map((item) => (
                <li key={item.id}>
                  <RailLink item={item} expanded={expanded} />
                </li>
              ))}
          </ul>
        </div>

        {/* Sign out + toggle */}
        <div className="border-t border-border/40 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  "flex items-center text-sm text-muted-foreground transition-colors hover:bg-foreground/3 hover:text-foreground dark:hover:bg-white/4",
                  expanded
                    ? "w-full justify-start gap-2.5 rounded-md px-2.5 py-1.5"
                    : "mx-auto size-10 justify-center rounded-md",
                )}
                aria-label="Sign out"
              >
                <LogOut className="size-6 shrink-0" />
                {expanded ? <span className="truncate">Sign out</span> : null}
              </button>
            </TooltipTrigger>
            {!expanded ? (
              <TooltipContent side="right" sideOffset={8}>
                Sign out
              </TooltipContent>
            ) : null}
          </Tooltip>

          {!forceCollapsed ? (
            <button
              type="button"
              onClick={() => setUserExpanded((v) => !v)}
              className={cn(
                "mt-1 flex items-center text-xs text-muted-foreground transition-colors hover:bg-foreground/3 hover:text-foreground dark:hover:bg-white/4",
                expanded
                  ? "w-full justify-start gap-2.5 rounded-md px-2.5 py-1.5"
                  : "mx-auto size-10 justify-center rounded-md",
              )}
              aria-label={expanded ? "Collapse" : "Expand"}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <>
                  <ChevronsLeft className="size-4 shrink-0" />
                  <span>Collapse</span>
                </>
              ) : (
                <ChevronsRight className="size-4" />
              )}
            </button>
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  );
}

/* ────────────────────────────────────────────────────────────── */

function RailLink({ item, expanded }: { item: RailItem; expanded: boolean }) {
  const Icon = item.icon;
  const disabled = item.badge === "soon";

  if (disabled) {
    const disabledBody = (
      <div
        className={cn(
          "flex items-center text-sm text-muted-foreground/60",
          expanded
            ? "w-full justify-start gap-2.5 rounded-md px-2.5 py-1.5"
            : "mx-auto size-10 justify-center rounded-md",
        )}
      >
        <Icon className="size-6 shrink-0 opacity-60" />
        {expanded ? (
          <span className="flex flex-1 items-center justify-between">
            <span className="truncate">{item.label}</span>
            <span className="font-mono text-[0.6rem] uppercase tracking-wide">soon</span>
          </span>
        ) : null}
      </div>
    );
    if (expanded) return disabledBody;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{disabledBody}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label} · soon
        </TooltipContent>
      </Tooltip>
    );
  }

  const link = (
    <NavLink
      to={item.to}
      end={item.end ?? item.to === "/"}
      className={({ isActive }) =>
        cn(
          "relative flex items-center text-sm transition-colors",
          isActive
            ? "bg-foreground/5 font-medium text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:bg-white/5"
            : "text-muted-foreground hover:bg-foreground/3 hover:text-foreground dark:hover:bg-white/4",
          expanded
            ? "w-full justify-start gap-2.5 rounded-md px-2.5 py-1.5"
            : "mx-auto size-10 justify-center rounded-md",
        )
      }
    >
      <Icon className="size-6 shrink-0" />
      {expanded ? <span className="truncate">{item.label}</span> : null}
    </NavLink>
  );

  if (expanded) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

const NarahMark = () => (
  <span
    className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-background"
    aria-hidden
  >
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V4l16 16V4" />
    </svg>
  </span>
);
