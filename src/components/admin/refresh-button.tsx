"use client";

import { RiRefreshLine } from "@remixicon/react";

import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

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
      variant="secondary"
      size="small"
      disabled={isRefreshing}
      aria-label={label}
      onClick={onClick}
      className={cx(className, isRefreshing && "[&_svg]:animate-spin")}
      leadingIcon={RiRefreshLine}
    >
      <span className="hidden sm:inline">{isRefreshing ? "Refreshing" : label}</span>
    </Button>
  );
}
