"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  id?: string;
  onClick: () => void;
  isRefreshing?: boolean;
  label?: string;
  className?: string;
}

export function RefreshButton({
  id,
  onClick,
  isRefreshing = false,
  label = "Refresh",
  className,
}: RefreshButtonProps) {
  return (
    <Button
      id={id}
      type="button"
      variant="outline"
      size="sm"
      disabled={isRefreshing}
      aria-label={label}
      onClick={onClick}
      className={cn("h-9", className)}
    >
      <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
      <span className="hidden sm:inline">{isRefreshing ? "Refreshing" : label}</span>
    </Button>
  );
}
