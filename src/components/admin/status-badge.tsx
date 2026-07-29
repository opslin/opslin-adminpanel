import { cn } from "@/lib/utils";

export type BadgeStatus = "ok" | "warning" | "error" | "info" | "offline";

const statusStyles: Record<BadgeStatus, string> = {
  ok: "border-success/25 bg-success-muted text-success-text",
  warning: "border-warning/25 bg-warning-muted text-warning-text",
  error: "border-danger/25 bg-danger-muted text-danger-text",
  info: "border-info/25 bg-info-muted text-info-text",
  offline: "border-muted-foreground/25 bg-secondary text-muted-foreground",
};

const dotStyles: Record<BadgeStatus, string> = {
  ok: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-info",
  offline: "bg-muted-foreground",
};

const statusLabels: Record<BadgeStatus, string> = {
  ok: "Ok",
  warning: "Warning",
  error: "Error",
  info: "Info",
  offline: "Offline",
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
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotStyles[status])} />
      {label ?? statusLabels[status]}
    </span>
  );
}
