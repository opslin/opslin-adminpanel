"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const widthClasses: Record<NonNullable<DetailDrawerProps["width"]>, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[720px]",
};

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "md",
}: DetailDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={cn(
          "fixed inset-y-0 right-0 left-auto top-0 h-full max-w-[calc(100vw-1rem)] translate-x-0 translate-y-0 rounded-none border-l border-border/80 p-0 shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          widthClasses[width]
        )}
      >
        <DialogHeader className="border-b border-border/80 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
