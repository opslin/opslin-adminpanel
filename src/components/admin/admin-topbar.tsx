"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Search, Shield } from "lucide-react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { RefreshButton } from "@/components/admin/refresh-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { api, type User } from "@/lib/api";
import { cn, initialsFor } from "@/lib/utils";

function EnvironmentBadge() {
  const env = process.env.NEXT_PUBLIC_APP_ENV?.toLowerCase();
  const isProduction = env === "production" || env === "prod";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2 text-[11px] font-medium",
        isProduction
          ? "border-danger/30 bg-danger-muted text-danger-text"
          : "border-info/30 bg-info-muted text-info-text"
      )}
    >
      {isProduction ? "Production" : "Staging"}
    </Badge>
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
    <header className="glass-panel backdrop-blur-md sticky top-0 z-40 h-14 rounded-none border-x-0 border-t-0">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:px-5">
        <Button
          id="admin-topbar-open-navigation"
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Open admin navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="size-4" />
        </Button>

        <div className="hidden items-center gap-3 sm:flex">
          <Image src="/logo/opslin-logo-white.png" alt="Opslin" width={161} height={50} className="h-7 w-auto" />
          <p className="border-l border-border/80 pl-3 text-[11px] text-muted-foreground">Super Admin</p>
        </div>

        <EnvironmentBadge />

        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-topbar-search"
            placeholder="Search users, agents, deploys..."
            className="h-9 max-w-xl border-border/80 bg-secondary/30 pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <RefreshButton
            id="admin-topbar-refresh"
            onClick={() => void refreshAdminQueries()}
            isRefreshing={isRefreshing}
          />
          <div className="hidden items-center gap-2 rounded-md border border-border/80 bg-secondary/30 px-2 py-1.5 lg:flex">
            <Switch
              id="admin-topbar-auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <label htmlFor="admin-topbar-auto-refresh" className="text-xs text-muted-foreground">
              60s auto
            </label>
          </div>
          <Button id="admin-topbar-mobile-search" type="button" variant="ghost" size="icon-sm" className="md:hidden" aria-label="Search admin">
            <Search className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button id="admin-topbar-user-menu" variant="ghost" className="h-9 gap-2 rounded-full px-2">
                <Avatar className="size-8 border border-border/80">
                  <AvatarFallback>{initialsFor(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 text-left sm:block">
                  <p className="truncate text-sm font-medium">{user.name || "Operator"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  <span>Platform admin</span>
                </div>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem id="admin-topbar-user-dashboard" onClick={() => { window.location.href = `${DASHBOARD_URL}/overview`; }}>User dashboard</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem id="admin-topbar-logout" onClick={() => void api.logout()} className="text-destructive">
                <LogOut className="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <AdminSidebar variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
