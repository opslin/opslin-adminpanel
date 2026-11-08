"use client";

import { LinkButton } from "@/components/base/buttons/link-button";
import { StatusDot } from "@/components/base/badges/status-dot";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import { EmptyLine, Panel, type OverviewResponse, type RunningDeploymentsResponse } from "./shared";

function deployBadge(status: string): { status: BadgeStatus; label: string } {
  const value = status.toUpperCase();
  if (value === "SUCCEEDED") return { status: "ok", label: "succeeded" };
  if (value === "FAILED" || value === "ABORTED") return { status: "error", label: value.toLowerCase() };
  if (value === "ROLLED_BACK") return { status: "warning", label: "rolled back" };
  return { status: "info", label: value.toLowerCase() };
}

export function LiveDeploys({ running }: { running: RunningDeploymentsResponse | undefined }) {
  const rows = running?.deployments ?? [];
  return (
    <Panel
      title="Deploying now"
      description={rows.length > 0 ? "Live, updates every 10 seconds" : undefined}
      action={
        <LinkButton href="/deployments" variant="secondary" size="small">
          All deploys
        </LinkButton>
      }
    >
      {rows.length === 0 ? (
        <EmptyLine>Nobody is deploying right now.</EmptyLine>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-t border-separator-border px-5 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusDot color="indigo" />
                <div className="min-w-0">
                  <p className="truncate text-body-medium text-text-primary">{row.appName}</p>
                  <p className="truncate text-caption-1-regular text-text-tertiary">
                    {row.orgName ?? "No organization"} · {row.serverName}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-body-regular text-text-tertiary">{formatRelativeTime(row.startedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function RecentDeploys({ deployments }: { deployments: OverviewResponse["recentDeployments"] }) {
  const rows = deployments.slice(0, 7);
  return (
    <Panel
      title="Recent deploys"
      action={
        <LinkButton href="/deployments" variant="secondary" size="small">
          View all
        </LinkButton>
      }
    >
      {rows.length === 0 ? (
        <EmptyLine>No deploys yet.</EmptyLine>
      ) : (
        <ul>
          {rows.map((row) => {
            const badge = deployBadge(row.status);
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-t border-separator-border px-5 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-medium text-text-primary">{row.appName ?? "Unknown app"}</p>
                  <p className="text-caption-1-regular text-text-tertiary">{formatRelativeTime(row.startedAt)}</p>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function initials(name: string | null, email: string) {
  const source = (name?.trim() || email).split(/[\s@.]+/).filter(Boolean);
  return ((source[0]?.[0] ?? "?") + (source[1]?.[0] ?? "")).toUpperCase();
}

export function RecentSignups({ signups }: { signups: OverviewResponse["recentSignups"] }) {
  const rows = signups.slice(0, 7);
  return (
    <Panel
      title="Newest users"
      action={
        <LinkButton href="/users" variant="secondary" size="small">
          View all
        </LinkButton>
      }
    >
      {rows.length === 0 ? (
        <EmptyLine>No signups yet.</EmptyLine>
      ) : (
        <ul>
          {rows.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 border-t border-separator-border px-5 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-secondary">
                  {initials(user.name, user.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body-medium text-text-primary">{user.name || user.email}</p>
                  {user.name ? <p className="truncate text-caption-1-regular text-text-tertiary">{user.email}</p> : null}
                </div>
              </div>
              <span className="shrink-0 text-body-regular text-text-tertiary">{formatRelativeTime(user.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
