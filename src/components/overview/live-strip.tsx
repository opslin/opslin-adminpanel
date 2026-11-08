"use client";

import type { ComponentType } from "react";
import {
  RiAlertLine,
  RiCpuLine,
  RiRocketLine,
  RiServerLine,
  RiUserHeartLine,
} from "@remixicon/react";

import { cx } from "@/utils/cx";
import {
  formatMs,
  formatNumber,
  type AgentMetricsResponse,
  type OverviewResponse,
  type RunningDeploymentsResponse,
  type SystemHealthResponse,
} from "./shared";

type Tone = "neutral" | "ok" | "warning" | "error";

const TONE_TILE: Record<Tone, string> = {
  neutral: "bg-stat-card-icon-background text-foreground-icon-primary",
  ok: "bg-status-lime-background text-status-lime-text",
  warning: "bg-status-orange-background text-status-orange-text",
  error: "bg-status-rose-background text-status-rose-text",
};

function LiveTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  pulse,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  pulse?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-5 py-4">
      <span className={cx("relative flex size-10 shrink-0 items-center justify-center rounded-xl", TONE_TILE[tone])}>
        <Icon className="size-5" aria-hidden />
        {pulse ? (
          <span className="absolute -end-0.5 -top-0.5 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-lime-text opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-status-lime-text" />
          </span>
        ) : null}
      </span>
      <div className="min-w-0">
        <p className="truncate text-body-regular text-text-secondary">{label}</p>
        <p className="truncate text-title-2-medium tabular-nums text-text-primary">{value}</p>
        <p className="truncate text-caption-1-regular text-text-tertiary">{detail}</p>
      </div>
    </div>
  );
}

/** "Right now" — the five numbers an operator checks first. */
export function LiveStrip({
  data,
  running,
  system,
  agents,
}: {
  data: OverviewResponse;
  running: RunningDeploymentsResponse | undefined;
  system: SystemHealthResponse | undefined;
  agents: AgentMetricsResponse | undefined;
}) {
  const deployingNow = running?.pagination.total ?? null;
  const queueWaiting = system?.queue.waiting ?? 0;
  const failed24h = system?.queue.failed24h ?? 0;
  const connected = agents?.connected ?? data.connectedAgents;
  const totalServers = agents?.total ?? data.totals.servers;
  const offline = Math.max(0, totalServers - connected);

  return (
    <section
      aria-label="Right now"
      className="grid grid-cols-1 divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x"
    >
      <LiveTile
        icon={RiRocketLine}
        label="Deploying now"
        value={deployingNow === null ? "—" : formatNumber(deployingNow)}
        detail={deployingNow ? "in progress or queued" : "nothing running"}
        tone={deployingNow ? "ok" : "neutral"}
        pulse={Boolean(deployingNow)}
      />
      <LiveTile
        icon={RiUserHeartLine}
        label="Active today"
        value={formatNumber(data.engagement.dau)}
        detail={`${formatNumber(data.activeUsers7d)} this week`}
        tone="neutral"
      />
      <LiveTile
        icon={RiServerLine}
        label="Servers online"
        value={`${formatNumber(connected)}/${formatNumber(totalServers)}`}
        detail={offline > 0 ? `${formatNumber(offline)} offline` : "all connected"}
        tone={offline > 0 ? "warning" : "ok"}
      />
      <LiveTile
        icon={RiCpuLine}
        label="Job queue"
        value={formatNumber(queueWaiting)}
        detail={`waiting · p95 ${formatMs(data.queueWaitP95)}`}
        tone={system?.queue.status === "error" ? "error" : system?.queue.status === "warning" ? "warning" : "neutral"}
      />
      <LiveTile
        icon={RiAlertLine}
        label="Failed jobs 24h"
        value={formatNumber(failed24h)}
        detail={`${data.deploySuccessRate24h}% deploy success`}
        tone={failed24h > 0 ? "warning" : "ok"}
      />
    </section>
  );
}
