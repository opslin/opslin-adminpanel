"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, FileText, Gift, IndianRupee, ReceiptText, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type BillingReadinessResponse = {
  distribution: {
    free: number;
    starter_trial: number;
    starter_paid: number;
    pro: number;
    business: number;
    enterprise: number;
  };
  trials: {
    activeTrials: number;
    endingIn7Days: Array<{ orgId: string; orgName: string; trialEndsAt: string }>;
    expired: Array<{ orgId: string; orgName: string; expiredAt: string }>;
  };
  billing: {
    razorpayEnabled: boolean;
    razorpayLastWebhook: string | null;
    razorpayWebhookHealth: "ok" | "stale" | "error";
    totalMRR: number;
    compedOrgs: number;
  };
};

type TrialAlert = {
  orgId: string;
  orgName: string;
  status: "ending" | "expired";
  date: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function healthStatus(value?: "ok" | "stale" | "error"): BadgeStatus {
  if (value === "ok") {
    return "ok";
  }
  if (value === "stale") {
    return "warning";
  }
  return "error";
}

export default function AdminBillingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [compOrg, setCompOrg] = useState<TrialAlert | null>(null);
  const [invoiceOrg, setInvoiceOrg] = useState<TrialAlert | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("99900");
  const [invoiceDescription, setInvoiceDescription] = useState("Manual invoice from platform admin");

  const readiness = useQuery({
    queryKey: ["admin", "billing-readiness"],
    queryFn: () => api.get<BillingReadinessResponse>("/admin/billing-readiness"),
  });

  const alerts = useMemo<TrialAlert[]>(() => {
    const ending = readiness.data?.trials.endingIn7Days.map((trial) => ({
      orgId: trial.orgId,
      orgName: trial.orgName,
      status: "ending" as const,
      date: trial.trialEndsAt,
    })) ?? [];
    const expired = readiness.data?.trials.expired.map((trial) => ({
      orgId: trial.orgId,
      orgName: trial.orgName,
      status: "expired" as const,
      date: trial.expiredAt,
    })) ?? [];
    return [...expired, ...ending];
  }, [readiness.data?.trials.endingIn7Days, readiness.data?.trials.expired]);

  const pagedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return alerts.slice(start, start + pageSize);
  }, [alerts, page, pageSize]);

  const compMutation = useMutation({
    mutationFn: (alert: TrialAlert) => api.post(`/admin/billing/${alert.orgId}/comp`, {
      reason: "Comped from admin billing readiness page",
    }),
    onSuccess: async () => {
      toast.success("Organization comped");
      setCompOrg(null);
      await readiness.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to comp organization");
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: (alert: TrialAlert) => api.post(`/admin/billing/${alert.orgId}/invoice`, {
      amount: Number(invoiceAmount),
      currency: "INR",
      description: invoiceDescription,
    }),
    onSuccess: async () => {
      toast.success("Manual invoice created");
      setInvoiceOrg(null);
      await readiness.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create invoice");
    },
  });

  const columns = useMemo<ColumnDef<TrialAlert>[]>(() => [
    {
      header: "Org",
      accessorKey: "orgName",
      cell: ({ row }) => <span className="font-medium">{row.original.orgName}</span>,
    },
    {
      header: "Alert",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status === "expired" ? "error" : "warning"}
          label={row.original.status === "expired" ? "expired" : "ending soon"}
        />
      ),
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button
            id={`admin-billing-${row.original.orgId}-comp`}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompOrg(row.original)}
          >
            <Gift className="size-4" />
            Comp
          </Button>
          <Button
            id={`admin-billing-${row.original.orgId}-invoice`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setInvoiceAmount("99900");
              setInvoiceDescription(`Manual invoice for ${row.original.orgName}`);
              setInvoiceOrg(row.original);
            }}
          >
            <ReceiptText className="size-4" />
            Invoice
          </Button>
        </div>
      ),
    },
  ], []);

  const distribution = readiness.data?.distribution;
  const starterCount = (distribution?.starter_trial ?? 0) + (distribution?.starter_paid ?? 0);
  const razorpay = readiness.data?.billing.razorpayWebhookHealth;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Revenue Ops</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Billing readiness</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Free" value={distribution?.free ?? 0} icon={WalletCards} status="info" />
        <StatCard label="Starter" value={starterCount} icon={CreditCard} status="info" description={`${distribution?.starter_trial ?? 0} trial / ${distribution?.starter_paid ?? 0} paid`} />
        <StatCard label="Pro" value={distribution?.pro ?? 0} icon={CreditCard} status="ok" />
        <StatCard label="Business" value={distribution?.business ?? 0} icon={CreditCard} status="ok" />
        <StatCard label="MRR" value={formatCurrency(readiness.data?.billing.totalMRR ?? 0)} icon={IndianRupee} status="ok" />
        <StatCard label="Comped Orgs" value={readiness.data?.billing.compedOrgs ?? 0} icon={Gift} status="warning" />
      </div>

      <Card className="rounded-lg py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/80 px-4 py-3">
          <CardTitle className="text-sm">Razorpay health</CardTitle>
          <StatusBadge status={healthStatus(razorpay)} label={razorpay ?? "unknown"} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{readiness.data?.billing.razorpayEnabled ? "Razorpay configured" : "Razorpay not configured"}</p>
            <p className="text-sm text-muted-foreground">
              Last webhook: {readiness.data?.billing.razorpayLastWebhook ? formatDate(readiness.data.billing.razorpayLastWebhook) : "None"}
            </p>
          </div>
          <Badge variant="outline">{readiness.data?.trials.activeTrials ?? 0} active trials</Badge>
        </CardContent>
      </Card>

      {readiness.isError ? (
        <EmptyState icon={FileText} title="Billing readiness unavailable" description="The billing readiness endpoint failed to respond." />
      ) : null}

      <DataTable
        idPrefix="admin-billing-alerts-table"
        columns={columns}
        data={pagedAlerts}
        pagination={{ page, pageSize, total: alerts.length }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={readiness.isLoading}
        emptyMessage="No expired or ending trials."
      />

      <ConfirmDialog
        idPrefix="admin-billing-comp-confirm"
        open={Boolean(compOrg)}
        onCancel={() => setCompOrg(null)}
        onConfirm={() => compOrg && compMutation.mutate(compOrg)}
        title="Comp organization"
        description="This creates a billing.comp feature override and writes an admin audit log."
        variant="warning"
        isLoading={compMutation.isPending}
      />

      <Dialog open={Boolean(invoiceOrg)} onOpenChange={(open) => !open && setInvoiceOrg(null)}>
        <DialogContent className="rounded-lg border-border/80">
          <DialogHeader>
            <DialogTitle>Create manual invoice</DialogTitle>
            <DialogDescription>
              Create an INR manual invoice for {invoiceOrg?.orgName ?? "this organization"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-billing-invoice-amount">Amount</Label>
              <Input
                id="admin-billing-invoice-amount"
                type="number"
                min={1}
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-billing-invoice-description">Description</Label>
              <Textarea
                id="admin-billing-invoice-description"
                value={invoiceDescription}
                onChange={(event) => setInvoiceDescription(event.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              id="admin-billing-invoice-cancel"
              type="button"
              variant="outline"
              disabled={invoiceMutation.isPending}
              onClick={() => setInvoiceOrg(null)}
            >
              Cancel
            </Button>
            <Button
              id="admin-billing-invoice-submit"
              type="button"
              disabled={invoiceMutation.isPending || !invoiceOrg || !invoiceDescription.trim() || Number(invoiceAmount) <= 0}
              onClick={() => invoiceOrg && invoiceMutation.mutate(invoiceOrg)}
            >
              {invoiceMutation.isPending ? "Creating..." : "Create invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
