"use client";

import { useEffect, useState } from "react";
import { RiArrowRightSLine, RiSearchLine, RiTeamLine } from "@remixicon/react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Input } from "@/components/base/input/input";
import { Pagination } from "@/components/base/pagination/pagination";
import { Select, SelectItem } from "@/components/base/select/select";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { cx } from "@/utils/cx";
import {
  describeDevice,
  initialsOf,
  statusFor,
  tintFor,
  type AdminUser,
  type UserListResponse,
} from "./types";

export type UserFilters = { search: string; plan: string; sort: string };

type Option = { id: string; label: string };

const PLANS: Option[] = [
  { id: "all", label: "All plans" },
  { id: "free", label: "Free" },
  { id: "starter", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business" },
  { id: "enterprise", label: "Enterprise" },
];
const SORTS: Option[] = [
  { id: "createdAt", label: "Newest first" },
  { id: "serverCount", label: "Most servers" },
  { id: "lastActiveAt", label: "Recently active" },
];

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      size="sm"
      selectedKey={value}
      onSelectionChange={(key) => key && onChange(String(key))}
      className="w-full sm:w-auto sm:min-w-36"
    >
      {options.map((option) => (
        <SelectItem key={option.id} id={option.id}>
          {option.label}
        </SelectItem>
      ))}
    </Select>
  );
}

function Pair({ main, sub, tone }: { main: string; sub: string; tone?: "warn" }) {
  return (
    <span className="flex flex-col items-start leading-tight">
      <span className="whitespace-nowrap text-body-medium tabular-nums text-text-primary">{main}</span>
      <span
        className={cx(
          "whitespace-nowrap text-caption-1-regular",
          tone === "warn" ? "text-status-orange-text" : "text-text-tertiary",
        )}
      >
        {sub}
      </span>
    </span>
  );
}

function Dash() {
  return <span className="text-body-regular text-text-tertiary">—</span>;
}

function PlanCell({ user }: { user: AdminUser }) {
  const expired = user.trialEnd ? new Date(user.trialEnd).getTime() < new Date().getTime() : false;
  return (
    <div className="flex flex-col items-start gap-1">
      <Chip variant="subtle" color="blue">
        {user.plan}
      </Chip>
      {user.trialEnd ? (
        <span className={cx("whitespace-nowrap text-caption-1-regular", expired ? "text-text-error-primary" : "text-text-tertiary")}>
          {expired ? "Trial ended" : "Trial ends"} {formatDate(user.trialEnd)}
        </span>
      ) : null}
    </div>
  );
}

export function UsersTable({
  data,
  isLoading,
  filters,
  onFilters,
  page,
  pageSize,
  onPage,
  onOpen,
  selectedId,
}: {
  data: UserListResponse | undefined;
  isLoading: boolean;
  filters: UserFilters;
  onFilters: (patch: Partial<UserFilters>) => void;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onOpen: (user: AdminUser) => void;
  selectedId: string | null;
}) {
  const [searchText, setSearchText] = useState(filters.search);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (searchText !== filters.search) onFilters({ search: searchText });
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchText, filters.search, onFilters]);

  const rows = data?.users ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <section className="overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs">
      <div className="flex flex-col gap-3 border-b border-separator-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <Input
          aria-label="Search users"
          placeholder="Search name or email"
          leadingIcon={RiSearchLine}
          value={searchText}
          onChange={setSearchText}
          className="w-full lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Filter label="Plan" value={filters.plan} options={PLANS} onChange={(plan) => onFilters({ plan })} />
          <Filter label="Sort" value={filters.sort} options={SORTS} onChange={(sort) => onFilters({ sort })} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-background-secondary-default">
            <RiTeamLine className="size-6 text-foreground-icon-secondary" aria-hidden />
          </span>
          <p className="text-title-3-medium text-text-primary">No users found</p>
          <p className="text-body-regular text-text-tertiary">Try a different search or clear a filter.</p>
        </div>
      ) : (
        <Table
          aria-label="Users"
          selectionMode="none"
          className="min-w-[1180px]"
          onRowAction={(key) => {
            const user = rows.find((row) => row.id === String(key));
            if (user) onOpen(user);
          }}
        >
          <TableHeader>
            <TableColumn id="user" isRowHeader>
              User
            </TableColumn>
            <TableColumn id="email">Email</TableColumn>
            <TableColumn id="plan">Plan</TableColumn>
            <TableColumn id="servers">Servers</TableColumn>
            <TableColumn id="apps">Apps</TableColumn>
            <TableColumn id="dbs">Databases</TableColumn>
            <TableColumn id="deploy">Last deploy</TableColumn>
            <TableColumn id="active">Last active</TableColumn>
            <TableColumn id="status">Status</TableColumn>
            <TableColumn id="open" className="w-10">
              <span className="sr-only">Open</span>
            </TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow
                key={user.id}
                id={user.id}
                className={cx("cursor-pointer", selectedId === user.id && "bg-background-secondary-default")}
              >
                <TableCell id={`${user.id}-user`}>
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" color={tintFor(user.id)} initials={initialsOf(user.name, user.email)} />
                    <div className="min-w-0">
                      <p className="whitespace-nowrap text-body-medium text-text-primary">{user.name || "Unnamed"}</p>
                      <p className="whitespace-nowrap text-caption-1-regular text-text-tertiary">
                        Joined {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell id={`${user.id}-email`}>
                  <div className="flex flex-col items-start gap-1">
                    <span className="whitespace-nowrap text-body-regular text-text-primary">{user.email}</span>
                    <Chip variant="subtle" color={user.emailVerified ? "lime" : "yellow"}>
                      {user.emailVerified ? "Verified" : "Not verified"}
                    </Chip>
                  </div>
                </TableCell>
                <TableCell id={`${user.id}-plan`}>
                  <PlanCell user={user} />
                </TableCell>
                <TableCell id={`${user.id}-servers`}>
                  {user.serverCount > 0 ? (
                    <Pair
                      main={`${user.serversOnline} of ${user.serverCount}`}
                      sub={user.serversOnline === user.serverCount ? "all online" : `${user.serverCount - user.serversOnline} offline`}
                      tone={user.serversOnline < user.serverCount ? "warn" : undefined}
                    />
                  ) : (
                    <Pair main="0" sub="no servers" />
                  )}
                </TableCell>
                <TableCell id={`${user.id}-apps`}>
                  {user.appCount > 0 ? (
                    <Pair
                      main={`${user.appsRunning} of ${user.appCount}`}
                      sub={user.appsUnhealthy > 0 ? `${user.appsUnhealthy} unhealthy` : "running"}
                      tone={user.appsUnhealthy > 0 ? "warn" : undefined}
                    />
                  ) : (
                    <Pair main="0" sub="no apps" />
                  )}
                </TableCell>
                <TableCell id={`${user.id}-dbs`}>
                  <Pair main={String(user.dbCount)} sub={user.dbCount === 1 ? "database" : "databases"} />
                </TableCell>
                <TableCell id={`${user.id}-deploy`}>
                  {user.lastDeploy ? (
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge
                        status={statusFor(user.lastDeploy.status)}
                        label={user.lastDeploy.status.toLowerCase().replace("_", " ")}
                      />
                      <span className="whitespace-nowrap text-caption-1-regular text-text-tertiary">
                        {user.lastDeploy.appName ? `${user.lastDeploy.appName} · ` : ""}
                        {formatRelativeTime(user.lastDeploy.startedAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="whitespace-nowrap text-body-regular text-text-tertiary">Never deployed</span>
                  )}
                </TableCell>
                <TableCell id={`${user.id}-active`}>
                  {user.lastActiveAt ? (
                    <Pair
                      main={formatRelativeTime(user.lastActiveAt)}
                      sub={describeDevice(user.lastDevice)}
                    />
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell id={`${user.id}-status`}>
                  <StatusBadge
                    status={user.status === "suspended" ? "error" : "ok"}
                    label={user.status === "suspended" ? "Suspended" : "Active"}
                  />
                </TableCell>
                <TableCell id={`${user.id}-open`}>
                  <RiArrowRightSLine className="size-5 text-foreground-icon-tertiary" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-3 border-t border-separator-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0 text-body-regular text-text-tertiary">
          {total === 0 ? "No users" : `Showing ${from} to ${to} of ${total}`}
        </p>
        <div className="sm:w-80">
          <Pagination page={page} totalPages={totalPages} onChange={onPage} />
        </div>
      </div>
    </section>
  );
}
