import type { BadgeStatus } from "@/components/admin/status-badge";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
  emailVerified: boolean;
  organization: { id: string; name: string } | null;
  orgRole: string | null;
  plan: string;
  subscriptionStatus: string | null;
  trialEnd: string | null;
  serverCount: number;
  serversOnline: number;
  appCount: number;
  appsRunning: number;
  appsUnhealthy: number;
  dbCount: number;
  activeSessions: number;
  lastDevice: string | null;
  lastIp: string | null;
  lastActiveAt: string | null;
  lastDeploy: { status: string; startedAt: string; appName: string | null } | null;
};

export type UserListResponse = {
  users: AdminUser[];
  pagination: { page: number; pageSize: number; total: number };
};

export type UserDetailResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: string | null;
    status: string;
    emailVerified: boolean;
    onboardingCompleted: boolean | null;
    createdAt: string;
    sessions: Array<{
      id: string;
      device: string;
      ip: string;
      lastActive: string;
      createdAt: string;
      isRevoked: boolean;
    }>;
    organizationMemberships: Array<{
      role: string;
      organization: {
        id: string;
        name: string;
        plan: string;
        subscription: {
          status: string;
          trialEnd: string | null;
          currentPeriodEnd: string | null;
          plan: { name: string; priceWithGst: number; currency: string };
        } | null;
        servers: Array<{
          id: string;
          name: string;
          status: string;
          agentVersion: string | null;
          lastSeenAt: string | null;
        }>;
        apps: Array<{
          id: string;
          name: string;
          status: string;
          healthStatus: string;
          deployedAt: string | null;
          deployments: Array<{ id: string; status: string; startedAt: string; finishedAt: string | null }>;
        }>;
      };
    }>;
  };
  auditLogs: Array<{ id: string; event: string; targetType: string | null; createdAt: string }>;
};

export function buildQuery(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function initialsOf(name?: string | null, fallback?: string | null) {
  const source = (name?.trim() || fallback || "?").split(/[\s@._-]+/).filter(Boolean);
  return ((source[0]?.[0] ?? "?") + (source[1]?.[0] ?? "")).toUpperCase();
}

export function statusFor(value?: string | null): BadgeStatus {
  const normalized = value?.toLowerCase() ?? "";
  if (["connected", "running", "healthy", "succeeded", "active", "ok"].includes(normalized)) return "ok";
  if (["pending", "deploying", "unknown", "building", "trialing", "rolled_back"].includes(normalized)) return "warning";
  if (["failed", "error", "unhealthy", "disconnected", "suspended", "aborted"].includes(normalized)) return "error";
  return "info";
}

export function tintFor(seed: string): "blue" | "lime" | "pink" | "neutral" {
  const tints = ["blue", "lime", "pink", "neutral"] as const;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

/** Turns a raw user-agent string into "Chrome on macOS"; passes plain labels through. */
export function describeDevice(raw: string | null | undefined) {
  if (!raw) return "Unknown device";
  const ua = raw;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|axios|python|go-http/i.test(ua)
              ? "API client"
              : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  if (browser || os) return (browser ?? os) as string;
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}
