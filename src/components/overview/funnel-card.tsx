"use client";

import { Chip } from "@/components/base/badges/chip";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { cx } from "@/utils/cx";
import { EmptyLine, formatNumber, Panel, type FunnelResponse } from "./shared";

/** Where new users get stuck on the way to a first successful deploy. */
export function FunnelCard({ funnel, isLoading }: { funnel: FunnelResponse | undefined; isLoading: boolean }) {
  const steps = funnel?.steps ?? [];
  const first = steps[0]?.count ?? 0;
  const last = steps[steps.length - 1]?.count ?? 0;

  let worst: { from: string; to: string; lost: number; pct: number } | null = null;
  for (let index = 1; index < steps.length; index += 1) {
    const prev = steps[index - 1];
    const current = steps[index];
    const lost = prev.count - current.count;
    if (prev.count > 0 && lost > 0 && (worst === null || lost / prev.count > worst.pct)) {
      worst = { from: prev.name, to: current.name, lost, pct: lost / prev.count };
    }
  }

  return (
    <Panel
      title="Signup to first deploy"
      description="Last 30 days, share of people who reached each step"
      action={
        first > 0 ? (
          <Chip variant="subtle" color={last / first >= 0.3 ? "lime" : "yellow"}>
            {Math.round((last / first) * 100)}% finish
          </Chip>
        ) : null
      }
      bodyClassName="px-5 pb-5"
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-7 rounded-lg" />
          ))}
        </div>
      ) : first === 0 ? (
        <EmptyLine>No signups in the last 30 days.</EmptyLine>
      ) : (
        <>
          <ol className="flex flex-col gap-2.5">
            {steps.map((step, index) => {
              const pct = Math.round((step.count / first) * 100);
              const isWorst = worst !== null && worst.to === step.name;
              return (
                <li key={step.step} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3">
                  <span className="truncate text-body-regular text-text-secondary" title={step.name}>
                    {index + 1}. {step.name}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-background-tertiary-default">
                    <span
                      className={cx(
                        "block h-full rounded-full transition-[width] duration-500",
                        isWorst ? "bg-chart-3" : "bg-chart-1",
                      )}
                      style={{ width: `${Math.max(pct, step.count > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                  <span className="w-20 text-end text-body-medium tabular-nums text-text-primary">
                    {formatNumber(step.count)}
                    <span className="ms-1 text-text-tertiary">{pct}%</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {worst ? (
            <p className="mt-4 rounded-2xl bg-background-secondary-default px-4 py-3 text-body-regular text-text-secondary">
              Biggest drop: <span className="text-text-primary">{worst.from}</span> to{" "}
              <span className="text-text-primary">{worst.to}</span> loses {formatNumber(worst.lost)}{" "}
              {worst.lost === 1 ? "person" : "people"} ({Math.round(worst.pct * 100)}%).
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
