"use client";

import type { ComponentType } from "react";
import { RiArrowRightDownLine, RiArrowRightUpLine } from "@remixicon/react";

import { Chip } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";

type IconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type StatCardStatus = "ok" | "warning" | "error" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconComponent;
  /** Percentage change chip; direction picks the glyph and color. */
  trend?: { value: number; direction: "up" | "down" };
  status?: StatCardStatus;
  /** Tints the icon tile for metrics whose meaning is status-like. */
  accent?: "violet";
  description?: string;
  className?: string;
  id?: string;
}

/**
 * Icon-tile tints per status. Neutral metrics (info) keep the standard
 * BoardUI stat-card tile; ok/warning/error use the shared status palette.
 */
const STATUS_TILE: Record<StatCardStatus | "violet", string> = {
  info: "bg-stat-card-icon-background text-foreground-icon-primary",
  ok: "bg-status-lime-background text-status-lime-text",
  warning: "bg-status-orange-background text-status-orange-text",
  error: "bg-status-rose-background text-status-rose-text",
  violet: "bg-stat-card-icon-background text-foreground-icon-primary",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  status = "info",
  accent,
  description,
  className,
  id,
}: StatCardProps) {
  const tile = STATUS_TILE[accent ?? status];

  return (
    <section
      id={id}
      className={cx(
        "flex min-w-0 flex-col items-start justify-between gap-3 rounded-2xl bg-background-secondary-default p-4 transition-[box-shadow] duration-200",
        className,
      )}
    >
      <span className={cx("flex items-center rounded-md p-1.5", tile)}>
        <Icon className="size-5 shrink-0" aria-hidden />
      </span>
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <p className="w-full truncate text-body-medium text-text-secondary">{label}</p>
        <div className="flex w-full flex-wrap items-center gap-2">
          <p className="whitespace-nowrap text-title-1-medium tabular-nums text-text-primary">
            {value}
          </p>
          {trend ? (
            <Chip variant="bold" color={trend.direction === "up" ? "lime" : "rose"}>
              <span className="inline-flex items-center gap-0.5">
                {trend.direction === "up" ? (
                  <RiArrowRightUpLine className="size-3.5" aria-hidden />
                ) : (
                  <RiArrowRightDownLine className="size-3.5" aria-hidden />
                )}
                {Math.abs(trend.value)}%
              </span>
            </Chip>
          ) : null}
        </div>
        {description ? (
          <p className="text-caption-1-regular text-text-tertiary">{description}</p>
        ) : null}
      </div>
    </section>
  );
}
