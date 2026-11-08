"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RiShieldUserLine } from "@remixicon/react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { Button } from "@/components/base/buttons/button";
import { Spinner } from "@/components/base/spinner/spinner";
import { useAuth } from "@/hooks/use-auth";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

/**
 * Standalone-app version of the former (admin)/layout.tsx gate — same
 * auth-check/isPlatformAdmin logic, unchanged. Real enforcement is 100%
 * server-side in opslin-api (every admin route re-checks isPlatformAdmin
 * independently); this is a UI convenience gate, not the security boundary.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background-full">
        <RiShieldUserLine className="size-14 text-foreground-icon-quaternary" aria-hidden />
        <h1 className="text-title-2-medium text-text-primary">Platform admin access required</h1>
        <p className="text-body-regular text-text-secondary">
          Your account does not have Super Admin privileges.
        </p>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => { window.location.href = `${DASHBOARD_URL}/apps`; }}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <AdminTopbar user={user} />
      <div className="flex min-h-[calc(100vh-3.5rem)] gap-3 p-3">
        <AdminSidebar className="sticky top-[3.75rem] hidden h-[calc(100vh-4.25rem)] lg:flex" />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
