"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import {
  RiExternalLinkLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiSearchLine,
  RiShieldUserLine,
} from "@remixicon/react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { RefreshButton } from "@/components/admin/refresh-button";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Switch } from "@/components/base/switch/switch";
import { Drawer } from "@/components/base/drawer/drawer";
import { api, type User } from "@/lib/api";
import { initialsFor } from "@/lib/utils";

function EnvironmentBadge() {
  const env = process.env.NEXT_PUBLIC_APP_ENV?.toLowerCase();
  const isProduction = env === "production" || env === "prod";

  return (
    <Chip variant="subtle" color={isProduction ? "rose" : "cyan"}>
      {isProduction ? "Production" : "Staging"}
    </Chip>
  );
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export function AdminTopbar({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const refreshAdminQueries = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshAdminQueries();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, refreshAdminQueries]);

  return (
    <header className="sticky top-0 z-40 border-b border-separator-border bg-background-full">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:px-5">
        <Button
          id="admin-topbar-open-navigation"
          iconOnly
          leadingIcon={RiMenuLine}
          variant="ghost"
          size="small"
          className="lg:hidden"
          aria-label="Open admin navigation"
          onClick={() => setMobileNavOpen(true)}
        />

        <div className="hidden items-center gap-3 sm:flex">
          <Image src="/logo/opslin-logo-white.png" alt="Opslin" width={161} height={50} className="h-7 w-auto" />
          <p className="border-s border-separator-border ps-3 text-caption-1-medium text-text-tertiary">
            Super Admin
          </p>
        </div>

        <EnvironmentBadge />

        <div className="hidden min-w-0 flex-1 md:block">
          <Input
            id="admin-topbar-search"
            aria-label="Search users, agents, deploys"
            placeholder="Search users, agents, deploys..."
            leadingIcon={RiSearchLine}
            className="max-w-xl"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <RefreshButton
            id="admin-topbar-refresh"
            onClick={() => void refreshAdminQueries()}
            isRefreshing={isRefreshing}
          />
          <div className="hidden items-center gap-2 rounded-xl border border-border-button-default bg-background-primary-default px-2 py-1.5 lg:flex">
            <Switch
              id="admin-topbar-auto-refresh"
              size="sm"
              isSelected={autoRefresh}
              onChange={setAutoRefresh}
              aria-label="Auto refresh every 60 seconds"
            />
            <label
              htmlFor="admin-topbar-auto-refresh"
              className="cursor-pointer text-caption-1-medium text-text-tertiary"
            >
              60s auto
            </label>
          </div>
          <Button
            id="admin-topbar-mobile-search"
            iconOnly
            leadingIcon={RiSearchLine}
            variant="ghost"
            size="small"
            className="md:hidden"
            aria-label="Search admin"
          />

          <Dropdown>
            <DropdownTrigger
              id="admin-topbar-user-menu"
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-background-secondary-hover"
            >
              <Avatar size="md" initials={initialsFor(user.name, user.email)} color="blue" />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-body-medium text-text-primary">
                  {user.name || "Operator"}
                </span>
                <span className="block truncate text-caption-1-medium text-text-tertiary">
                  {user.email}
                </span>
              </span>
            </DropdownTrigger>
            <DropdownPopover aria-label="Account" placement="bottom end" className="w-64">
              <div className="flex flex-col gap-1 px-2 pb-2 pt-1">
                <span className="flex items-center gap-2 text-body-medium text-text-primary">
                  <RiShieldUserLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                  Platform admin
                </span>
                <span className="truncate ps-6 text-caption-1-regular text-text-tertiary">
                  {user.email}
                </span>
              </div>
              <DropdownDivider />
              <DropdownItem
                onSelect={() => {
                  window.location.href = `${DASHBOARD_URL}/overview`;
                }}
              >
                <RiExternalLinkLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span className="truncate text-body-medium text-text-primary">User dashboard</span>
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem
                onSelect={() => void api.logout()}
              >
                <RiLogoutBoxRLine className="size-5 shrink-0 text-text-error-primary" aria-hidden />
                <span className="truncate text-body-medium text-text-error-primary">Log out</span>
              </DropdownItem>
            </DropdownPopover>
          </Dropdown>
        </div>
      </div>

      <Drawer
        isOpen={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        placement="start"
        size="sm"
        aria-label="Admin navigation"
        className="bg-background-full p-0 shadow-none"
        overlayClassName="lg:hidden"
      >
        <div className="flex h-full flex-col p-2">
          <AdminSidebar variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Drawer>
    </header>
  );
}
