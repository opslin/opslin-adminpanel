"use client";

import { Chip } from "@/components/base/badges/chip";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { cx } from "@/utils/cx";
import {
  EmptyLine,
  formatMs,
  formatNumber,
  formatUptime,
  humanizeClass,
  Panel,
  Row,
  type AgentMetricsResponse,
  type ErrorsResponse,
  type OverviewResponse,
  type SystemHealthResponse,
} from "./shared";

function toBadge(status: string | undefined): BadgeStatus {
  if (status === "ok" || status === "ready" || status === "healthy") return "ok";
  if (status === "warning" || status === "stale") return "warning";
  if (status === undefined) return "offline";
  return "error";
}

function Meter({ percent, tone }: { percent: number; tone: "ok" | "warning" | "error" }) {
  return (
    <span className="flex w-24 items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
        <span
          className={cx(
            "block h-full rounded-full",
            tone === "ok" ? "bg-status-lime-text" : tone === "warning" ? "bg-status-orange-text" : "bg-status-rose-text",
          )}
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </span>
      <span className="w-9 text-end text-body-medium tabular-nums">{Math.round(percent)}%</span>
    </span>
  );
}

export function PlatformHealthCard({
  system,
  fallback,
  isLoading,
}: {
  system: SystemHealthResponse | undefined;
  fallback: OverviewResponse["systemHealth"];
  isLoading: boolean;
}) {
  if (isLoading && !system) {
    return (
      <Panel title="Platform health" bodyClassName="px-5 pb-5">
        <Skeleton className="h-48 rounded-2xl" />
      </Panel>
    );
  }
  const diskPct = system?.disk.usedPercent ?? null;
  const redisPct = system?.redis.usedPercent ?? null;
  const diskTone = diskPct === null ? "ok" : diskPct >= 90 ? "error" : diskPct >= 75 ? "warning" : "ok";
  const redisTone = redisPct === null ? "ok" : redisPct >= 90 ? "error" : redisPct >= 75 ? "warning" : "ok";

  return (
    <Panel
      title="Platform health"
      action={
        <LinkButton href="/system" variant="secondary" size="small">
          Details
        </LinkButton>
      }
    >
      <Row label="API" hint={system ? `up ${formatUptime(system.api.uptimeSeconds)}` : undefined}>
        <StatusBadge status={toBadge(system?.api.status ?? fallback.api)} />
      </Row>
      <Row label="Database" hint={system ? `${formatMs(system.db.latencyMs)} response` : undefined}>
        <StatusBadge status={toBadge(system?.db.status ?? fallback.db)} />
      </Row>
      <Row label="Redis">
        {redisPct !== null ? (
          <Meter percent={redisPct} tone={redisTone} />
        ) : (
          <StatusBadge status={toBadge(system?.redis.status ?? fallback.redis)} />
        )}
      </Row>
      {system ? (
        <>
          <Row label="Disk" hint={diskPct === null ? "unknown" : undefined}>
            {diskPct !== null ? <Meter percent={diskPct} tone={diskTone} /> : <StatusBadge status={toBadge(system.disk.status)} />}
          </Row>
          <Row
            label="Workers"
            hint={system.queue.stuckCount > 0 ? `${system.queue.stuckCount} stuck job(s)` : undefined}
          >
            <StatusBadge
              status={system.queue.workersObserved >= system.queue.workersExpected ? "ok" : "warning"}
              label={`${system.queue.workersObserved}/${system.queue.workersExpected} up`}
            />
          </Row>
          <Row
            label="Platform backup"
            hint={system.platformBackup.ageHours !== null ? `${Math.round(system.platformBackup.ageHours)}h ago` : "never ran"}
          >
            <StatusBadge status={toBadge(system.platformBackup.status)} label={system.platformBackup.status} />
          </Row>
        </>
      ) : null}
    </Panel>
  );
}

export function FailuresCard({ errors, isLoading }: { errors: ErrorsResponse | undefined; isLoading: boolean }) {
  const rows = (errors?.errors ?? [])
    .filter((entry) => entry.count7d > 0)
    .sort((a, b) => b.count7d - a.count7d)
    .slice(0, 5);
  const max = rows[0]?.count7d ?? 1;

  return (
    <Panel
      title="Why deploys fail"
      description="Last 7 days, by cause"
      action={
        <LinkButton href="/errors" variant="secondary" size="small">
          All errors
        </LinkButton>
      }
      bodyClassName="px-5 pb-5"
    >
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyLine>No failed deploys this week.</EmptyLine>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.class} title={row.suggestedFix}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-body-medium text-text-primary">{humanizeClass(row.class)}</span>
                <span className="shrink-0 text-body-regular tabular-nums text-text-secondary">
                  {formatNumber(row.count7d)} · {formatNumber(row.affectedUsers)}{" "}
                  {row.affectedUsers === 1 ? "user" : "users"}
                </span>
              </div>
              <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-background-tertiary-default">
                <span
                  className="block h-full rounded-full bg-chart-3"
                  style={{ width: `${Math.max(4, (row.count7d / max) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function FleetCard({ agents, isLoading }: { agents: AgentMetricsResponse | undefined; isLoading: boolean }) {
  const versions = Object.entries(agents?.versions ?? {}).sort((a, b) => b[1] - a[1]);
  const onlinePct = agents && agents.total > 0 ? (agents.connected / agents.total) * 100 : 0;

  return (
    <Panel
      title="Customer servers"
      description="Agents running on customer VPS machines"
      action={
        <LinkButton href="/agents" variant="secondary" size="small">
          Manage
        </LinkButton>
      }
    >
      {isLoading || !agents ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="px-5 pb-4">
            <div className="flex items-end justify-between">
              <p className="text-display-4-medium tabular-nums text-text-primary">
                {formatNumber(agents.connected)}
                <span className="text-title-3-medium text-text-tertiary"> / {formatNumber(agents.total)} online</span>
              </p>
              <Chip variant="subtle" color={agents.disconnected > 0 ? "yellow" : "lime"}>
                {agents.disconnected > 0 ? `${agents.disconnected} offline` : "All online"}
              </Chip>
            </div>
            <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-background-tertiary-default">
              <span className="block h-full rounded-full bg-chart-1" style={{ width: `${onlinePct}%` }} />
            </span>
          </div>
          <Row label="Outdated agent">
            <StatusBadge status={agents.outdated > 0 ? "warning" : "ok"} label={String(agents.outdated)} />
          </Row>
          <Row label="Secure helper missing">
            <StatusBadge status={agents.helperMissing > 0 ? "warning" : "ok"} label={String(agents.helperMissing)} />
          </Row>
          {versions.length > 0 ? (
            <Row label="Agent versions" hint={`Newest in use: ${versions[0][0]}`}>
              <StatusBadge status="info" label={`${versions.length} in use`} />
            </Row>
          ) : null}
        </>
      )}
    </Panel>
  );
}
