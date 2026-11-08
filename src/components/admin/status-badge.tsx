"use client";

import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";

export type BadgeStatus = "ok" | "warning" | "error" | "info" | "offline";

const STATUS_CHIP: Record<BadgeStatus, { color: ChipColor; label: string; dot: string }> = {
  ok: { color: "lime", label: "Ok", dot: "bg-status-lime-text" },
  warning: { color: "yellow", label: "Warning", dot: "bg-status-yellow-text" },
  error: { color: "rose", label: "Error", dot: "bg-status-rose-text" },
  info: { color: "cyan", label: "Info", dot: "bg-status-cyan-text" },
  offline: { color: "gray", label: "Offline", dot: "bg-foreground-icon-tertiary" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BadgeStatus;
  label?: string;
  className?: string;
}) {
  const chip = STATUS_CHIP[status];

  return (
    <Chip variant="subtle" color={chip.color} className={cx("gap-1.5", className)}>
      <span className={cx("size-1.5 rounded-full", chip.dot)} aria-hidden />
      {label ?? chip.label}
    </Chip>
  );
}
