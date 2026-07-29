"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Rocket, Server, Timer, TrendingUp, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type InvestorMetrics = {
  totalUsers: number;
  activeBetaUsers: number;
  connectedServers: number;
  appsDeployed: number;
  successfulDeployments: number;
  deploySuccessRate: number;
  medianTimeToFirstDeploy: number;
  topErrorsFixedThisWeek: number;
  trialUsers: number;
  paymentIntentCount: number;
  weekNumber: number;
  formattedUpdate: string;
};

function formatDuration(ms: number) {
  if (!ms) {
    return "0m";
  }
  if (ms >= 60 * 60 * 1000) {
    return `${Math.round(ms / (60 * 60 * 1000))}h`;
  }
  return `${Math.round(ms / 60_000)}m`;
}

export default function AdminInvestorPage() {
  const metrics = useQuery({
    queryKey: ["admin", "investor-metrics"],
    queryFn: () => api.get<InvestorMetrics>("/admin/investor-metrics"),
  });

  const data = metrics.data;

  async function copyUpdate() {
    if (!data) {
      return;
    }
    try {
      await navigator.clipboard.writeText(data.formattedUpdate);
      toast.success("Investor update copied to clipboard");
    } catch {
      toast.error("Clipboard copy failed");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">P1 Investor</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Investor metrics export</h1>
        </div>
        <Button type="button" variant="outline" onClick={() => void copyUpdate()} disabled={!data}>
          <Copy className="size-4" />
          Copy Investor Update
        </Button>
      </div>

      {metrics.isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg border border-border/80 bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Users" value={data.totalUsers} icon={Users} status="info" />
            <StatCard label="Active Beta" value={data.activeBetaUsers} icon={Activity} status="ok" />
            <StatCard label="Connected Servers" value={data.connectedServers} icon={Server} status="ok" />
            <StatCard label="Apps Deployed" value={data.appsDeployed} icon={Rocket} status="info" />
            <StatCard label="Successful Deploys" value={data.successfulDeployments} icon={TrendingUp} status="ok" />
            <StatCard label="Deploy Success" value={`${data.deploySuccessRate}%`} icon={TrendingUp} status={data.deploySuccessRate >= 90 ? "ok" : "warning"} />
            <StatCard label="Median TTFD" value={formatDuration(data.medianTimeToFirstDeploy)} icon={Timer} accent="violet" />
            <StatCard label="Payment Intents" value={data.paymentIntentCount} icon={WalletCards} status="info" description={`${data.trialUsers} trial users`} />
          </div>

          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/80">
              <CardTitle>Week {data.weekNumber} formatted update</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => void copyUpdate()}>
                <Copy className="size-4" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg border border-border/80 bg-secondary/30 p-4 font-mono text-sm leading-6 text-muted-foreground">
                {data.formattedUpdate}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
