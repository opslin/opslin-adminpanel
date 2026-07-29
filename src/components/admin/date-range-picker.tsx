"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DateRangePreset = "24h" | "7d" | "30d" | "custom";

export interface AdminDateRange {
  preset: DateRangePreset;
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value?: AdminDateRange;
  onChange?: (range: AdminDateRange) => void;
  className?: string;
  idPrefix?: string;
}

const presetLabels: Array<{ value: DateRangePreset; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "custom", label: "Custom" },
];

function rangeForPreset(preset: Exclude<DateRangePreset, "custom">): AdminDateRange {
  const to = new Date();
  const from = new Date(to);

  if (preset === "24h") {
    from.setHours(to.getHours() - 24);
  }

  if (preset === "7d") {
    from.setDate(to.getDate() - 7);
  }

  if (preset === "30d") {
    from.setDate(to.getDate() - 30);
  }

  return { preset, from, to };
}

function toInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromInputValue(value: string) {
  return new Date(value);
}

export function DateRangePicker({ value, onChange, className, idPrefix }: DateRangePickerProps) {
  const generatedId = useId().replace(/:/g, "");
  const pickerId = idPrefix ?? `admin-date-range-${generatedId}`;
  const defaultRange = useMemo(() => rangeForPreset("24h"), []);
  const [internalRange, setInternalRange] = useState<AdminDateRange>(value ?? defaultRange);
  const range = value ?? internalRange;

  function updateRange(nextRange: AdminDateRange) {
    if (!value) {
      setInternalRange(nextRange);
    }
    onChange?.(nextRange);
  }

  function setPreset(preset: DateRangePreset) {
    if (preset === "custom") {
      updateRange({ ...range, preset: "custom" });
      return;
    }

    updateRange(rangeForPreset(preset));
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="inline-flex w-fit rounded-md border border-border/80 bg-card p-1">
        {presetLabels.map((preset) => (
          <Button
            id={`${pickerId}-${preset.value}`}
            key={preset.value}
            type="button"
            variant={range.preset === preset.value ? "secondary" : "ghost"}
            size="sm"
            className="h-7 rounded-sm px-2.5"
            onClick={() => setPreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {range.preset === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <Input
            id={`${pickerId}-from`}
            type="datetime-local"
            value={toInputValue(range.from)}
            onChange={(event) => updateRange({ ...range, from: fromInputValue(event.target.value) })}
            aria-label="Start date"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">to</span>
          <Input
            id={`${pickerId}-to`}
            type="datetime-local"
            value={toInputValue(range.to)}
            onChange={(event) => updateRange({ ...range, to: fromInputValue(event.target.value) })}
            aria-label="End date"
          />
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          Last {range.preset}
        </div>
      )}
    </div>
  );
}
