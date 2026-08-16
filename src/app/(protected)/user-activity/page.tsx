"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, Search, UserSearch } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiRequestError, api, type AdminUserActivityEventItem } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

// ClickHouse's stored `time` comes back as a naive "YYYY-MM-DD HH:MM:SS.mmm"
// string with no timezone marker (opslin-api/src/lib/user-activity.ts's
// toClickHouseDateTime strips the "T"/"Z" ClickHouse's insert parser
// rejects) — the value itself is UTC, but re-parsing that naive string with
// `new Date(...)` lets the browser guess, and it guesses local time, not
// UTC. Re-attach "T"/"Z" first so it's unambiguous before doing anything
// with it (relative time, IST display, or otherwise).
function parseActivityTime(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

function formatIST(value: string): string {
  return `${parseActivityTime(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })} IST`;
}

// ISO 3166-1 alpha-2 code -> flag emoji via Unicode regional indicator
// symbols (each letter A-Z maps to U+1F1E6..U+1F1FF; 127397 = 0x1F1E6 - 65).
// No image/API needed for the flag itself — only the country code (which
// comes from a real GeoLite2 lookup) needs resolving server-side.
function countryFlag(isoCode: string | null): string {
  if (!isoCode || isoCode.length !== 2) {
    return "🏳️";
  }
  const codePoints = [...isoCode.toUpperCase()].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function targetLabel(event: AdminUserActivityEventItem) {
  if (!event.targetId) {
    return event.targetType ?? "—";
  }
  return `${event.targetType ?? "target"}:${event.targetId.slice(0, 8)}`;
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function detailSummary(detail: Record<string, unknown> | null) {
  if (!detail) {
    return "—";
  }
  const entries = Object.entries(detail);
  if (entries.length === 0) {
    return "—";
  }
  // Surface the error category inline when present — the whole point of
  // capturing it is so an admin can scan the timeline for exactly this
  // without opening each row.
  if (typeof detail.errorCategory === "string") {
    return `errorCategory: ${detail.errorCategory}`;
  }
  // key: value, not just the key name — the key alone ("path") told the
  // admin nothing; the value ("/servers") is the actual signal.
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${formatDetailValue(value)}`)
    .join(", ");
}

export default function AdminUserActivityPage() {
  const [emailInput, setEmailInput] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useQuery({
    queryKey: ["admin", "user-activity", submittedEmail, page, pageSize],
    queryFn: () => api.getAdminUserActivity({ email: submittedEmail, page, pageSize }),
    enabled: submittedEmail.length > 0,
    retry: false,
  });

  const notFound = query.isError && query.error instanceof ApiRequestError && query.error.status === 404;
  const unavailable = query.isError && query.error instanceof ApiRequestError && query.error.status === 503;

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    setPage(1);
    setSubmittedEmail(trimmed);
  }

  const columns = useMemo<ColumnDef<AdminUserActivityEventItem>[]>(() => [
    {
      header: "Time",
      accessorKey: "time",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{formatRelativeTime(parseActivityTime(row.original.time))}</p>
          <p className="text-xs text-muted-foreground">{formatIST(row.original.time)}</p>
        </div>
      ),
    },
    {
      header: "Event",
      accessorKey: "event",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.event}</span>,
    },
    {
      header: "Target",
      accessorKey: "targetType",
      cell: ({ row }) => <span className="font-mono text-xs">{targetLabel(row.original)}</span>,
    },
    {
      header: "Detail",
      accessorKey: "detail",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{detailSummary(row.original.detail)}</span>,
    },
    {
      header: "IP",
      accessorKey: "ip",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span title={row.original.country ?? "Unknown country"}>{countryFlag(row.original.country)}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.ip}</span>
          {row.original.likelyDatacenter ? (
            <Badge
              variant="destructive"
              title="ASN organization name matches a known hosting/cloud provider pattern — an approximate signal, not a confirmed VPN/proxy"
            >
              Datacenter/VPN?
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      header: "Device",
      accessorKey: "device",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.device}</span>,
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Governance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">User activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up one user&apos;s full behavior timeline by email — register, login, OTP, server connect, deploys, and page visits.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-user-activity-email"
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="user@example.com"
            className="pl-9"
          />
        </div>
        <Button id="admin-user-activity-search" type="submit" disabled={!emailInput.trim()}>
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {!submittedEmail ? (
        <EmptyState
          icon={UserSearch}
          title="Search for a user"
          description="Enter a user's email above to see their full activity timeline."
        />
      ) : notFound ? (
        <EmptyState
          icon={UserSearch}
          title="No user found"
          description={`No account exists with the email "${submittedEmail}".`}
        />
      ) : unavailable ? (
        <EmptyState
          icon={UserSearch}
          title="Activity log temporarily unavailable"
          description="The activity storage backend didn't respond. Try again shortly."
        />
      ) : (
        <>
          {query.data?.user ? (
            <Card className="rounded-lg">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                <div>
                  <p className="dashboard-section-label">Name</p>
                  <p className="mt-2 font-medium">{query.data.user.name}</p>
                </div>
                <div>
                  <p className="dashboard-section-label">Email</p>
                  <p className="mt-2 font-mono text-sm">{query.data.user.email}</p>
                </div>
                <div>
                  <p className="dashboard-section-label">Joined</p>
                  <p className="mt-2 text-sm">
                    {new Date(query.data.user.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DataTable
            idPrefix="admin-user-activity-table"
            columns={columns}
            data={query.data?.events ?? []}
            pagination={query.data?.pagination ?? { page, pageSize, total: 0 }}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
            isLoading={query.isLoading}
            emptyMessage="No activity recorded for this user yet."
          />
        </>
      )}
    </div>
  );
}
