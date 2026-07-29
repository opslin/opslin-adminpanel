"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-9 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Shield className="h-14 w-14 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Platform admin access required</h1>
        <p className="text-sm text-muted-foreground">
          Your account does not have Super Admin privileges.
        </p>
        <button
          type="button"
          onClick={() => { window.location.href = `${DASHBOARD_URL}/apps`; }}
          className="mt-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminTopbar user={user} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminSidebar className="sticky top-14 hidden h-[calc(100vh-3.5rem)] lg:flex" />
        <main className="min-w-0 flex-1 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
