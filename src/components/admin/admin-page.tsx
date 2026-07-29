"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@/lib/api";

export function useAdminAccess() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  return {
    user,
    authLoading,
    canFetch: !authLoading && user?.isPlatformAdmin === true,
  };
}

export function apiErrorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="dashboard-section-label">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function AdminLoadingState({ label = "Loading admin data" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-label={label}>
      <div className="h-10 max-w-md animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-border/80 bg-card" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-border/80 bg-card" />
    </div>
  );
}

export function AdminAccessNotice({
  authLoading,
  user,
}: {
  authLoading: boolean;
  user: User | null;
}) {
  if (authLoading) {
    return <AdminLoadingState label="Checking admin access" />;
  }

  if (!user) {
    return (
      <Alert>
        <ShieldAlert className="size-4" aria-hidden="true" />
        <AlertTitle>Authentication required</AlertTitle>
        <AlertDescription>Redirecting to login before loading Super Admin data.</AlertDescription>
      </Alert>
    );
  }

  if (user.isPlatformAdmin !== true) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="size-4" aria-hidden="true" />
        <AlertTitle>Platform admin access required</AlertTitle>
        <AlertDescription>Your account does not have Super Admin privileges.</AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function AdminQueryError({ error, resource }: { error: unknown; resource: string }) {
  const status = apiErrorStatus(error);

  if (status === 401) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="size-4" aria-hidden="true" />
        <AlertTitle>Authentication required</AlertTitle>
        <AlertDescription>Your session could not load {resource}. Sign in again or retry.</AlertDescription>
      </Alert>
    );
  }

  if (status === 403) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="size-4" aria-hidden="true" />
        <AlertTitle>Platform admin access required</AlertTitle>
        <AlertDescription>The backend rejected this request. Backend RBAC remains the source of truth.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <ShieldAlert className="size-4" aria-hidden="true" />
      <AlertTitle>Unable to load {resource}</AlertTitle>
      <AlertDescription>Check the API connection and try again.</AlertDescription>
    </Alert>
  );
}

export function dateTimeText(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function durationText(ms: number | null | undefined) {
  if (typeof ms !== "number") {
    return "—";
  }
  if (ms >= 60_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  if (ms >= 1000) {
    return `${Math.round(ms / 100) / 10}s`;
  }
  return `${ms}ms`;
}

export function numberText(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export function percentText(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(value % 1 === 0 ? 0 : 1)}%` : "—";
}

export function shortText(value: string | null | undefined, length = 8) {
  if (!value) {
    return "—";
  }
  return value.length > length ? value.slice(0, length) : value;
}
