import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; direction: "up" | "down" };
  status?: "ok" | "warning" | "error" | "info";
  /**
   * Violet secondary-accent treatment (doc 02 §3.2) for a metric that's
   * genuinely a trend/insight number with no real ok/warning/error meaning —
   * never a substitute for a real status. `status` is ignored when set.
   */
  accent?: "violet";
  description?: string;
}

const statusBorder: Record<NonNullable<StatCardProps["status"]>, string> = {
  ok: "border-l-success",
  warning: "border-l-warning",
  error: "border-l-danger",
  info: "border-l-info",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  status = "info",
  accent,
  description,
}: StatCardProps) {
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <Card
      className={cn(
        "hover-lift group overflow-hidden rounded-lg border-l-4 py-0",
        accent === "violet" ? "border-l-accent-2" : statusBorder[status]
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-md border border-border/80",
              accent === "violet" ? "bg-accent-2-muted text-accent-2" : "bg-secondary/40 text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
          </div>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                trend.direction === "up"
                  ? "bg-success-muted text-success-text"
                  : "bg-danger-muted text-danger-text"
              )}
            >
              <TrendIcon className="size-3.5" />
              {Math.abs(trend.value)}%
            </span>
          ) : null}
        </div>
        <div className="mt-6">
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          {description ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
