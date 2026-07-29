"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: "danger" | "warning";
  isLoading?: boolean;
  idPrefix?: string;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText,
  variant = "warning",
  isLoading = false,
  idPrefix,
}: ConfirmDialogProps) {
  const generatedId = useId().replace(/:/g, "");
  const dialogId = idPrefix ?? `admin-confirm-${generatedId}`;
  const [typedText, setTypedText] = useState("");
  const requiresTypedConfirmation = variant === "danger" && Boolean(confirmText);
  const canConfirm = !isLoading && (!requiresTypedConfirmation || typedText === confirmText);

  useEffect(() => {
    if (!open) {
      setTypedText("");
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent className="rounded-lg border-border/80">
        <AlertDialogHeader>
          <div
            className={cn(
              "mb-1 flex size-10 items-center justify-center rounded-md border",
              variant === "danger"
                ? "border-danger/25 bg-danger-muted text-danger-text"
                : "border-warning/25 bg-warning-muted text-warning-text"
            )}
          >
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTypedConfirmation ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono text-foreground">{confirmText}</span> to confirm.
            </p>
            <Input
              id={`${dialogId}-confirm-input`}
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              placeholder={confirmText}
              autoComplete="off"
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel id={`${dialogId}-cancel`} disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            id={`${dialogId}-confirm`}
            disabled={!canConfirm}
            className={cn(
              variant === "danger"
                ? "bg-destructive text-danger-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={(event) => {
              if (!canConfirm) {
                event.preventDefault();
                return;
              }
              onConfirm();
            }}
          >
            {isLoading ? "Working..." : variant === "danger" ? "Confirm danger" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
