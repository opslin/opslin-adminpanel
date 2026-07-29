"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Server, TerminalSquare } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

type AgentStatusFilter = "all" | "connected" | "disconnected" | "outdated";

type AdminAgent = {
  serverId: string;
  serverName: string;
  userName: string | null;
  userEmail: string | null;
  orgName: string | null;
  status: "connected" | "disconnected";
  agentVersion: string | null;
  versionWarning: boolean;
  lastSeen: string | null;
  os: string | null;
  appCount: number;
  runningJobs: number;
};

type AdminAgentsResponse = {
  agents: AdminAgent[];
  pagination: { page: number; pageSize: number; total: number };
  summary: { connected: number; disconnected: number; outdated: number };
};

function buildQuery(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function agentStatus(agent: AdminAgent): BadgeStatus {
  if (agent.versionWarning) {
    return "warning";
  }
  return agent.status === "connected" ? "ok" : "error";
}

function AgentDrawer({ agent }: { agent?: AdminAgent }) {
  if (!agent) {
    return <EmptyState icon={Server} title="Select an agent" description="Agent details appear here." />;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="dashboard-section-label">Server</p>
            <p className="mt-2 font-medium">{agent.serverName}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Status</p>
            <div className="mt-2">
              <StatusBadge status={agentStatus(agent)} label={agent.versionWarning ? "outdated" : agent.status} />
            </div>
          </div>
          <div>
            <p className="dashboard-section-label">Owner</p>
            <p className="mt-2 text-sm">{agent.userName ?? "Unassigned"}</p>
            <p className="text-xs text-muted-foreground">{agent.orgName ?? "No org"}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Agent version</p>
            <p className="mt-2 font-mono text-sm">{agent.agentVersion ?? "unknown"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-sm">Runtime</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-border/80 p-3">
            <p className="text-muted-foreground">Apps</p>
            <p className="mt-2 text-xl font-semibold">{agent.appCount}</p>
          </div>
          <div className="rounded-md border border-border/80 p-3">
            <p className="text-muted-foreground">Running jobs</p>
            <p className="mt-2 text-xl font-semibold">{agent.runningJobs}</p>
          </div>
          <div className="rounded-md border border-border/80 p-3">
            <p className="text-muted-foreground">Last seen</p>
            <p className="mt-2 text-sm font-medium">{agent.lastSeen ? formatRelativeTime(agent.lastSeen) : "Never"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardContent className="flex items-start gap-3 p-4">
          <TerminalSquare className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Install command is masked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Agent tokens are never returned from admin aggregate APIs. Use the server detail page to rotate credentials.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminAgentsPage() {
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);

  // The backend has no server-side "outdated" status filter (versionWarning
  // isn't a `status` value), so that tab requests the "all" status and
  // filters client-side on top of the fetched page — the displayed page can
  // come back short of `pageSize` even when more outdated agents exist on
  // later pages. Connected/disconnected/all use real server-side pagination.
  const agentsQuery = useQuery({
    queryKey: ["admin", "agents", { page, pageSize, statusFilter, search }],
    queryFn: () => api.get<AdminAgentsResponse>(buildQuery("/admin/agents", {
      page,
      pageSize,
      status: statusFilter === "outdated" ? "all" : statusFilter,
      search,
    })),
    refetchInterval: 60_000,
  });

  // Tab counts always need the *unfiltered* summary — the backend computes
  // `summary` after applying `status`, so e.g. viewing the Connected tab
  // would otherwise make the Disconnected tab's count read as 0. A separate,
  // always status=all, minimal-pageSize query keeps the tab labels accurate
  // independent of whichever tab is currently active.
  const summaryQuery = useQuery({
    queryKey: ["admin", "agents", "summary", { search }],
    queryFn: () => api.get<AdminAgentsResponse>(buildQuery("/admin/agents", {
      page: 1,
      pageSize: 1,
      status: "all",
      search,
    })),
    refetchInterval: 60_000,
  });

  const fetchedAgents = agentsQuery.data?.agents ?? [];
  const pagedAgents = statusFilter === "outdated"
    ? fetchedAgents.filter((agent) => agent.versionWarning)
    : fetchedAgents;
  const summary = summaryQuery.data?.summary ?? { connected: 0, disconnected: 0, outdated: 0 };
  const globalTotal = summaryQuery.data?.pagination.total ?? 0;
  const total = statusFilter === "outdated" ? summary.outdated : (agentsQuery.data?.pagination.total ?? 0);

  const columns = useMemo<ColumnDef<AdminAgent>[]>(() => [
    {
      header: "Server",
      accessorKey: "serverName",
      cell: ({ row }) => <span className="font-medium">{row.original.serverName}</span>,
    },
    {
      header: "User/Org",
      id: "owner",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.userName ?? "Unassigned"}</p>
          <p className="text-xs text-muted-foreground">{row.original.orgName ?? row.original.userEmail ?? "No org"}</p>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={agentStatus(row.original)} label={row.original.versionWarning ? "outdated" : row.original.status} />,
    },
    {
      header: "Agent Version",
      accessorKey: "agentVersion",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.agentVersion ?? "unknown"}</span>,
    },
    {
      header: "Version Warning",
      accessorKey: "versionWarning",
      cell: ({ row }) => row.original.versionWarning
        ? <Badge className="border-warning/25 bg-warning-muted text-warning-text" variant="outline"><AlertTriangle className="size-3" /> Outdated</Badge>
        : <span className="text-muted-foreground">None</span>,
    },
    {
      header: "Last Seen",
      accessorKey: "lastSeen",
      cell: ({ row }) => row.original.lastSeen ? formatRelativeTime(row.original.lastSeen) : "Never",
    },
    { header: "OS", accessorKey: "os" },
    { header: "Apps", accessorKey: "appCount" },
    { header: "Jobs", accessorKey: "runningJobs" },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedAgent(row.original);
          }}
        >
          Inspect
        </Button>
      ),
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P0 Agents</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Agent fleet</h1>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => { setPage(1); setStatusFilter(value as AgentStatusFilter); }}>
        <TabsList className="grid w-full grid-cols-2 md:w-fit md:grid-cols-4">
          <TabsTrigger value="all">All ({globalTotal})</TabsTrigger>
          <TabsTrigger value="connected">Connected ({summary.connected})</TabsTrigger>
          <TabsTrigger value="disconnected">Disconnected ({summary.disconnected})</TabsTrigger>
          <TabsTrigger value="outdated">Outdated ({summary.outdated})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={pagedAgents}
        pagination={{ page, pageSize, total }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        searchPlaceholder="Search server, user, or org..."
        onSearch={(query) => { setPage(1); setSearch(query); }}
        isLoading={agentsQuery.isLoading}
        emptyMessage="No agents match this filter."
        onRowClick={setSelectedAgent}
      />

      <DetailDrawer
        open={Boolean(selectedAgent)}
        onClose={() => setSelectedAgent(null)}
        title={selectedAgent?.serverName ?? "Agent details"}
        subtitle={selectedAgent?.orgName ?? undefined}
        width="md"
      >
        <AgentDrawer agent={selectedAgent ?? undefined} />
      </DetailDrawer>
    </div>
  );
}
