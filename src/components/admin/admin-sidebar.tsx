"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Route,
  Rocket,
  ScrollText,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  UserSearch,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Operate",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Users", href: "/users", icon: Users },
      { label: "Organizations", href: "/orgs", icon: Building2 },
      { label: "Onboarding", href: "/onboarding", icon: Route },
      { label: "Agents", href: "/agents", icon: Server },
      { label: "Agent Releases", href: "/agent-releases", icon: PackageCheck },
      { label: "Deployments", href: "/deployments", icon: Rocket },
      { label: "Deploy Insights", href: "/insights", icon: BarChart3 },
      { label: "CI/CD Gates", href: "/ci-gates", icon: ShieldCheck },
      { label: "Deploy Tests", href: "/deploy-tests", icon: FlaskConical },
      { label: "Queue", href: "/queue", icon: ListTodo },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Plans & Features", href: "/plans", icon: CreditCard },
      { label: "Billing", href: "/billing", icon: ReceiptText },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Errors", href: "/errors", icon: AlertTriangle },
      { label: "System Health", href: "/system", icon: Activity },
      { label: "Feedback", href: "/feedback", icon: MessageSquare },
      { label: "Investor", href: "/investor", icon: TrendingUp },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Audit Logs", href: "/audit", icon: ScrollText },
      { label: "User Activity", href: "/user-activity", icon: UserSearch },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminSidebarProps {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  className?: string;
}

export function AdminSidebar({ variant = "desktop", onNavigate, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = variant === "desktop";
  const isCollapsed = isDesktop && collapsed;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        isDesktop ? (isCollapsed ? "w-16" : "w-60") : "w-full border-r-0",
        className
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!isCollapsed ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Super Admin
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">Control plane</p>
          </div>
        ) : (
          <span className="mx-auto text-xs font-semibold text-muted-foreground">SA</span>
        )}
        {isDesktop ? (
          <Button
            id={`admin-sidebar-${variant}-collapse`}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={isCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
            onClick={() => setCollapsed((current) => !current)}
          >
            {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="pb-4">
            {!isCollapsed ? (
              <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            <nav aria-label={`${group.label} admin navigation`} className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                const content = (
                  <>
                    <Icon className="size-4 shrink-0" />
                    {!isCollapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                    {item.soon && !isCollapsed ? (
                      <Badge
                        variant="outline"
                        className="border-border/80 px-1.5 py-0 text-[10px] text-muted-foreground"
                      >
                        Soon
                      </Badge>
                    ) : null}
                  </>
                );

                if (item.soon) {
                  return (
                    <button
                      id={`admin-nav-${variant}-${item.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}
                      key={item.href}
                      type="button"
                      disabled
                      title={item.label}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm text-muted-foreground/60",
                        isCollapsed && "justify-center"
                      )}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    id={`admin-nav-${variant}-${item.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "admin"}`}
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-md border border-transparent px-2 text-sm transition-colors",
                      active
                        ? "border-border/80 bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
