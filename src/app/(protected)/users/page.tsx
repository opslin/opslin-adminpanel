"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { buildQuery, type AdminUser, type UserListResponse } from "@/components/users/types";
import { UserDrawer } from "@/components/users/user-drawer";
import { UsersTable, type UserFilters } from "@/components/users/users-table";
import { api } from "@/lib/api";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<UserFilters>({ search: "", plan: "all", sort: "createdAt" });
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const onFilters = useCallback((patch: Partial<UserFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const users = useQuery({
    queryKey: ["admin", "users", "list", page, filters],
    queryFn: () =>
      api.get<UserListResponse>(
        buildQuery("/admin/users", {
          page,
          pageSize: PAGE_SIZE,
          search: filters.search,
          plan: filters.plan === "all" ? undefined : filters.plan,
          sortBy: filters.sort,
          sortOrder: "desc",
        }),
      ),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="text-caption-1-semibold uppercase tracking-[0.14em] text-text-tertiary">Super Admin</p>
        <h1 className="mt-1 text-title-1-medium text-text-primary">Users</h1>
        <p className="mt-1 text-body-regular text-text-tertiary">
          Every user with their email, plan, servers and apps running, last deploy and the device they last used.
        </p>
      </div>

      <UsersTable
        data={users.data}
        isLoading={users.isLoading}
        filters={filters}
        onFilters={onFilters}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        onOpen={setSelected}
        selectedId={selected?.id ?? null}
      />

      <UserDrawer user={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
