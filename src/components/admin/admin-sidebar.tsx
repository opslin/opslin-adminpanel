"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiAlertLine,
  RiBankCardLine,
  RiBarChartBoxLine,
  RiDashboardLine,
  RiFileTextLine,
  RiFlaskLine,
  RiGroupLine,
  RiListCheck3,
  RiMessage2Line,
  RiBox3Line,
  RiPriceTag3Line,
  RiPulseLine,
  RiRocketLine,
  RiRouteLine,
  RiServerLine,
  RiSettings4Line,
  RiShieldCheckLine,
  RiShieldUserLine,
  RiSideBarFill,
  RiFundsLine,
  RiUserSearchLine,
  type RemixiconComponentType,
} from "@remixicon/react";

import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { cx } from "@/utils/cx";

type AdminNavItem = {
  label: string;
  href: string;
  icon: RemixiconComponentType;
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
      { label: "Overview", href: "/", icon: RiDashboardLine },
      { label: "Users", href: "/users", icon: RiGroupLine },
      { label: "Onboarding", href: "/onboarding", icon: RiRouteLine },
      { label: "Agents", href: "/agents", icon: RiServerLine },
      { label: "Agent Releases", href: "/agent-releases", icon: RiBox3Line },
      { label: "Deployments", href: "/deployments", icon: RiRocketLine },
      { label: "Deploy Journal", href: "/deploy-journal", icon: RiFileTextLine },
      { label: "Deploy Insights", href: "/insights", icon: RiBarChartBoxLine },
      { label: "CI/CD Gates", href: "/ci-gates", icon: RiShieldCheckLine },
      { label: "Deploy Tests", href: "/deploy-tests", icon: RiFlaskLine },
      { label: "Queue", href: "/queue", icon: RiListCheck3 },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Plans & Features", href: "/plans", icon: RiPriceTag3Line },
      { label: "Billing", href: "/billing", icon: RiBankCardLine },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Errors", href: "/errors", icon: RiAlertLine },
      { label: "System Health", href: "/system", icon: RiPulseLine },
      { label: "Feedback", href: "/feedback", icon: RiMessage2Line },
      { label: "Investor", href: "/investor", icon: RiFundsLine },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Audit Logs", href: "/audit", icon: RiFileTextLine },
      { label: "User Activity", href: "/user-activity", icon: RiUserSearchLine },
      { label: "Settings", href: "/settings", icon: RiSettings4Line },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItemLink({
  item,
  active,
  collapsed,
  onNavigate,
  variant,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  variant: "desktop" | "mobile";
}) {
  const Icon = item.icon;

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={cx("size-5 shrink-0", active ? "text-white" : "text-foreground-icon-secondary")}
          aria-hidden
        />
        <span
          className={cx(
            "flex min-w-0 items-center overflow-hidden transition-[max-width,opacity,filter] duration-300 ease-in-out",
            collapsed ? "max-w-0 opacity-0 blur-[3px]" : "max-w-full opacity-100 blur-0",
          )}
        >
          <span
            className={cx(
              "truncate text-body-medium whitespace-nowrap",
              active ? "text-white" : "text-text-secondary",
            )}
          >
            {item.label}
          </span>
        </span>
      </span>
      {item.soon && !collapsed ? (
        <span className="rounded-full border border-separator-border px-1.5 py-0 text-caption-1-medium text-text-tertiary">
          Soon
        </span>
      ) : null}
    </>
  );

  const className = cx(
    "flex items-center justify-between overflow-hidden rounded-2lg p-2",
    "transition-[width,background-color] duration-300 ease-in-out",
    collapsed ? "w-9" : "w-full",
    active
      ? "bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected"
      : "hover:bg-background-secondary-hover",
    item.soon && "opacity-50",
  );

  if (item.soon) {
    return (
      <button
        id={`admin-nav-${variant}-${item.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}
        type="button"
        disabled
        title={item.label}
        className={className}
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
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      onClick={onNavigate}
      className={cx(className, "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring")}
    >
      {content}
    </Link>
  );
}

interface AdminSidebarProps {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  className?: string;
}

export function AdminSidebar({ variant = "desktop", onNavigate, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsedState, setCollapsed] = useState(false);
  const isDesktop = variant === "desktop";
  const collapsed = isDesktop && collapsedState;

  return (
    <aside
      className={cx(
        "flex h-full shrink-0 flex-col overflow-hidden",
        "rounded-3xl border border-border-button-default bg-background-secondary-default shadow-sidebar",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[60px] px-[11px] py-3" : isDesktop ? "w-[260px] p-3" : "w-full p-3",
        className,
      )}
    >
      <div className="-m-2 flex min-h-0 w-[calc(100%+16px)] flex-1 flex-col gap-4 overflow-y-auto p-2 [scrollbar-width:none]">
        <div
          className={cx(
            "flex w-full shrink-0 transition-[gap] duration-300 ease-in-out",
            collapsed ? "flex-col-reverse items-start justify-center gap-2.5" : "flex-row items-center justify-between",
          )}
        >
          <div
            className={cx(
              "-m-2 min-w-0 overflow-hidden p-2 transition-[max-width,opacity] duration-300 ease-in-out",
              collapsed ? "max-w-0 scale-95 opacity-0" : "max-w-[206px] scale-100 opacity-100",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-2lg bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected">
                <RiShieldUserLine className="size-5 text-white" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-caption-1-semibold text-text-tertiary">Super Admin</span>
                <span className="block truncate text-body-medium text-text-primary">Control plane</span>
              </span>
            </div>
          </div>
          {isDesktop ? (
            <button
              id={`admin-sidebar-${variant}-collapse`}
              type="button"
              aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
              className={cx(
                "flex cursor-pointer items-center justify-center rounded-2lg text-foreground-icon-secondary transition-transform duration-300 ease-in-out",
                "outline-none hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                collapsed && "h-9 w-9",
              )}
            >
              <RiSideBarFill className={cx("size-5", !collapsed && "-scale-x-100")} aria-hidden />
            </button>
          ) : null}
        </div>

        <nav className="flex w-full flex-col gap-4">
          {adminNavGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed ? (
                <p className="px-2 pb-1 text-caption-1-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  {group.label}
                </p>
              ) : (
                <div className="mx-2 border-t border-separator-border" aria-hidden />
              )}
              {group.items.map((item) => (
                <NavItemLink
                  key={item.href}
                  item={item}
                  variant={variant}
                  active={!item.soon && isActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 pt-3">
        <ThemeToggle
          collapsed={collapsed}
          appearance={collapsed ? "sidebar" : "sidebar-segmented"}
        />
      </div>
    </aside>
  );
}
