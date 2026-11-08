"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RiAlarmLine,
  RiBankCardLine,
  RiComputerLine,
  RiFileList3Line,
  RiRocketLine,
  RiServerLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { api } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  describeDevice,
  initialsOf,
  statusFor,
  tintFor,
  type AdminUser,
  type UserDetailResponse,
} from "./types";

type TabId = "overview" | "devices" | "infra" | "activity";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default">
      <h3 className="border-b border-separator-border px-4 py-3 text-body-medium text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function Line({ left, sub, right }: { left: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-separator-border px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate text-body-medium text-text-primary">{left}</div>
        {sub ? <div className="truncate text-caption-1-regular text-text-tertiary">{sub}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-body-regular text-text-secondary">{right}</div> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-body-regular text-text-tertiary">{children}</p>;
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof RiServerLine;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-background-secondary-default p-3.5">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon className="size-4" aria-hidden />
        <span className="text-body-regular">{label}</span>
      </div>
      <p className="text-title-2-medium tabular-nums text-text-primary">{value}</p>
      <p className="text-caption-1-regular text-text-tertiary">{sub}</p>
    </div>
  );
}

export function UserDrawer({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");
  const [confirming, setConfirming] = useState(false);
  const id = user?.id ?? null;

  const detail = useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: () => api.get<UserDetailResponse>(`/admin/users/${id}`),
    enabled: Boolean(id),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const extendTrial = useMutation({
    mutationFn: () => api.post(`/admin/users/${id}/extend-trial`, { days: 7 }),
    onSuccess: async () => {
      toast.success("Trial extended by 7 days");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not extend trial"),
  });

  const suspend = useMutation({
    mutationFn: () => api.post(`/admin/users/${id}/suspend`, { reason: "Suspended by platform admin from the users drawer." }),
    onSuccess: async () => {
      toast.success("User suspended");
      setConfirming(false);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not suspend user"),
  });

  const person = detail.data?.user;
  const membership = person?.organizationMemberships[0];
  const workspace = membership?.organization;
  const sub = workspace?.subscription;
  const suspended = (person?.status ?? user?.status) === "suspended";

  const recentDeploys =
    workspace?.apps
      .flatMap((app) => app.deployments.map((deployment) => ({ ...deployment, appName: app.name })))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 6) ?? [];

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "devices", label: `Devices${person ? ` (${person.sessions.length})` : ""}` },
    { id: "infra", label: "Servers and apps" },
    { id: "activity", label: "Activity log" },
  ];

  return (
    <Drawer
      isOpen={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) {
          setConfirming(false);
          setTab("overview");
          onClose();
        }
      }}
      size="lg"
      aria-label={user ? `${user.name} profile` : "User profile"}
    >
      {user ? (
        <>
          <DrawerHeader title={user.name || user.email} description={user.email} className="pt-6">
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Avatar size="lg" color={tintFor(user.id)} initials={initialsOf(user.name, user.email)} />
              <Chip variant="subtle" color="blue">
                {sub?.plan.name ?? user.plan}
              </Chip>
              <Chip variant="subtle" color={user.emailVerified ? "lime" : "yellow"}>
                {user.emailVerified ? "Email verified" : "Email not verified"}
              </Chip>
              <Chip variant="subtle" color={suspended ? "rose" : "lime"}>
                {suspended ? "Suspended" : "Active"}
              </Chip>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {user.organization ? (
                <Button
                  variant="secondary"
                  size="small"
                  leadingIcon={RiBankCardLine}
                  onClick={() => router.push(`/plans?orgId=${user.organization?.id}`)}
                >
                  Change plan
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiAlarmLine}
                disabled={extendTrial.isPending}
                onClick={() => extendTrial.mutate()}
              >
                Extend trial 7 days
              </Button>
              {user.organization ? (
                <Button
                  variant="secondary"
                  size="small"
                  leadingIcon={RiFileList3Line}
                  onClick={() => router.push(`/audit?orgId=${user.organization?.id}`)}
                >
                  Audit log
                </Button>
              ) : null}
              {suspended ? null : confirming ? (
                <>
                  <Button variant="secondary" size="small" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="small" disabled={suspend.isPending} onClick={() => suspend.mutate()}>
                    Confirm suspend
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="small" onClick={() => setConfirming(true)}>
                  Suspend
                </Button>
              )}
            </div>
            <div className="-mb-1 mt-4 overflow-x-auto">
              <PillTabList>
                {tabs.map((item) => (
                  <PillTab key={item.id} variant="gray" isSelected={tab === item.id} onSelect={() => setTab(item.id)}>
                    {item.label}
                  </PillTab>
                ))}
              </PillTabList>
            </div>
          </DrawerHeader>

          <DrawerBody className="pb-6 pt-3">
            {detail.isLoading || !person ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {tab === "overview" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Tile
                        icon={RiServerLine}
                        label="Servers"
                        value={`${user.serversOnline} of ${user.serverCount}`}
                        sub={user.serverCount === 0 ? "none connected" : "online now"}
                      />
                      <Tile
                        icon={RiRocketLine}
                        label="Apps"
                        value={`${user.appsRunning} of ${user.appCount}`}
                        sub={user.appsUnhealthy > 0 ? `${user.appsUnhealthy} unhealthy` : "running now"}
                      />
                      <Tile
                        icon={RiComputerLine}
                        label="Active sign-ins"
                        value={String(user.activeSessions)}
                        sub={user.lastActiveAt ? `last ${formatRelativeTime(user.lastActiveAt)}` : "never active"}
                      />
                      <Tile
                        icon={RiShieldCheckLine}
                        label="Databases"
                        value={String(user.dbCount)}
                        sub={user.dbCount === 1 ? "database" : "databases"}
                      />
                    </div>
                    <Section title="Account">
                      <Line left="Email" right={person.email} />
                      <Line
                        left="Email verified"
                        right={<StatusBadge status={person.emailVerified ? "ok" : "warning"} label={person.emailVerified ? "verified" : "not verified"} />}
                      />
                      <Line left="Joined" right={formatDate(person.createdAt)} />
                      <Line left="Onboarding" right={person.onboardingCompleted ? "completed" : "not finished"} />
                      {person.platformRole ? <Line left="Platform role" right={person.platformRole} /> : null}
                    </Section>
                    <Section title="Plan">
                      {sub ? (
                        <>
                          <Line left="Plan" right={`${sub.plan.name} · ${sub.plan.priceWithGst} ${sub.plan.currency}/mo`} />
                          <Line left="Status" right={<StatusBadge status={statusFor(sub.status)} label={sub.status} />} />
                          {sub.trialEnd ? <Line left="Trial ends" right={formatDate(sub.trialEnd)} /> : null}
                          {sub.currentPeriodEnd ? <Line left="Renews" right={formatDate(sub.currentPeriodEnd)} /> : null}
                        </>
                      ) : (
                        <Empty>No paid subscription. This user is on the free plan.</Empty>
                      )}
                    </Section>
                    <Section title="Recent deploys">
                      {recentDeploys.length === 0 ? (
                        <Empty>Nothing deployed yet.</Empty>
                      ) : (
                        recentDeploys.map((deployment) => (
                          <Line
                            key={deployment.id}
                            left={deployment.appName}
                            sub={formatRelativeTime(deployment.startedAt)}
                            right={<StatusBadge status={statusFor(deployment.status)} label={deployment.status.toLowerCase().replace("_", " ")} />}
                          />
                        ))
                      )}
                    </Section>
                  </>
                ) : null}

                {tab === "devices" ? (
                  <Section title="Signed-in devices">
                    {person.sessions.length === 0 ? (
                      <Empty>No sign-ins recorded.</Empty>
                    ) : (
                      person.sessions.map((session) => (
                        <Line
                          key={session.id}
                          left={describeDevice(session.device)}
                          sub={`${session.ip} · signed in ${formatDate(session.createdAt)}`}
                          right={
                            session.isRevoked ? (
                              <StatusBadge status="offline" label="signed out" />
                            ) : (
                              <span>{formatRelativeTime(session.lastActive)}</span>
                            )
                          }
                        />
                      ))
                    )}
                  </Section>
                ) : null}

                {tab === "infra" ? (
                  <>
                    <Section title={`Servers (${workspace?.servers.length ?? 0})`}>
                      {!workspace || workspace.servers.length === 0 ? (
                        <Empty>No servers connected.</Empty>
                      ) : (
                        workspace.servers.map((server) => (
                          <Line
                            key={server.id}
                            left={server.name}
                            sub={`${server.agentVersion ?? "no agent"}${server.lastSeenAt ? ` · seen ${formatRelativeTime(server.lastSeenAt)}` : ""}`}
                            right={<StatusBadge status={statusFor(server.status)} label={server.status.toLowerCase()} />}
                          />
                        ))
                      )}
                    </Section>
                    <Section title={`Apps (${workspace?.apps.length ?? 0})`}>
                      {!workspace || workspace.apps.length === 0 ? (
                        <Empty>No apps yet.</Empty>
                      ) : (
                        workspace.apps.map((app) => (
                          <Line
                            key={app.id}
                            left={app.name}
                            sub={
                              app.deployments[0]
                                ? `last deploy ${app.deployments[0].status.toLowerCase().replace("_", " ")} ${formatRelativeTime(app.deployments[0].startedAt)}`
                                : "never deployed"
                            }
                            right={<StatusBadge status={statusFor(app.status)} label={app.status.toLowerCase()} />}
                          />
                        ))
                      )}
                    </Section>
                  </>
                ) : null}

                {tab === "activity" ? (
                  <Section title="What this user did">
                    {detail.data?.auditLogs.length ? (
                      detail.data.auditLogs.map((log) => (
                        <Line
                          key={log.id}
                          left={log.event.replace(/[._]/g, " ")}
                          sub={log.targetType ?? undefined}
                          right={formatRelativeTime(log.createdAt)}
                        />
                      ))
                    ) : (
                      <Empty>No activity recorded.</Empty>
                    )}
                  </Section>
                ) : null}
              </div>
            )}
          </DrawerBody>
        </>
      ) : null}
    </Drawer>
  );
}
