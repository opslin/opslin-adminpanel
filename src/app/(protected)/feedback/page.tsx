"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

type FeedbackStatus = "all" | "open" | "investigating" | "fixed" | "closed";

type FeedbackRecord = {
  id: string;
  userId: string;
  type: string;
  content: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string } | null;
};

type FeedbackResponse = {
  feedback: FeedbackRecord[];
  pagination: { page: number; pageSize: number; total: number };
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

function statusBadge(status: string): BadgeStatus {
  if (status === "fixed" || status === "closed") {
    return "ok";
  }
  if (status === "investigating") {
    return "warning";
  }
  return "info";
}

function preview(content: string) {
  return content.length > 90 ? `${content.slice(0, 90)}...` : content;
}

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState<FeedbackStatus>("open");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecord | null>(null);
  const [comment, setComment] = useState("");
  const [nextStatus, setNextStatus] = useState<Exclude<FeedbackStatus, "all">>("investigating");
  const [confirmComment, setConfirmComment] = useState(false);

  const feedback = useQuery({
    queryKey: ["admin", "feedback", { page, pageSize, status, search }],
    queryFn: () => api.get<FeedbackResponse>(buildQuery("/admin/feedback", { page, pageSize, status, search })),
  });

  const commentMutation = useMutation({
    mutationFn: () => {
      if (!selectedFeedback) {
        throw new Error("Feedback item missing");
      }
      return api.post<{ success: boolean }>(`/admin/feedback/${selectedFeedback.id}/comment`, {
        comment,
        status: nextStatus,
      });
    },
    onSuccess: async () => {
      toast.success("Comment added");
      setConfirmComment(false);
      setComment("");
      const result = await feedback.refetch();
      const refreshed = result.data?.feedback.find((item) => item.id === selectedFeedback?.id);
      if (refreshed) {
        setSelectedFeedback(refreshed);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add comment");
    },
  });

  const columns = useMemo<ColumnDef<FeedbackRecord>[]>(() => [
    {
      header: "User",
      accessorKey: "user",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.user?.name ?? "Unknown user"}</p>
          <p className="text-xs text-muted-foreground">{row.original.user?.email ?? row.original.userId}</p>
        </div>
      ),
    },
    { header: "Type", accessorKey: "type" },
    {
      header: "Content",
      accessorKey: "content",
      cell: ({ row }) => <span className="text-muted-foreground">{preview(row.original.content)}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={statusBadge(row.original.status)} label={row.original.status} />,
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) => formatRelativeTime(row.original.createdAt),
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P1 Support</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Feedback inbox</h1>
      </div>

      <Tabs value={status} onValueChange={(value) => { setPage(1); setStatus(value as FeedbackStatus); }}>
        <TabsList className="grid w-full grid-cols-2 md:w-fit md:grid-cols-4">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="investigating">Investigating</TabsTrigger>
          <TabsTrigger value="fixed">Fixed</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={feedback.data?.feedback ?? []}
        pagination={feedback.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        searchPlaceholder="Search feedback..."
        onSearch={(query) => { setPage(1); setSearch(query); }}
        isLoading={feedback.isLoading}
        emptyMessage="No feedback matches this filter."
        onRowClick={(item) => {
          setSelectedFeedback(item);
          setNextStatus(item.status === "open" ? "investigating" : item.status as Exclude<FeedbackStatus, "all">);
        }}
      />

      <DetailDrawer
        open={Boolean(selectedFeedback)}
        onClose={() => setSelectedFeedback(null)}
        title={selectedFeedback?.type ?? "Feedback"}
        subtitle={selectedFeedback?.user?.email ?? selectedFeedback?.userId}
        width="lg"
      >
        {selectedFeedback ? (
          <div className="space-y-5">
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/80">
                <CardTitle className="text-sm">Full content</CardTitle>
                <StatusBadge status={statusBadge(selectedFeedback.status)} label={selectedFeedback.status} />
              </CardHeader>
              <CardContent className="whitespace-pre-wrap p-4 text-sm text-muted-foreground">
                {selectedFeedback.content}
              </CardContent>
            </Card>

            {selectedFeedback.adminNote ? (
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-sm">Admin notes</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground">
                  {selectedFeedback.adminNote}
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  Add admin comment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a concise admin note..."
                  rows={5}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Select value={nextStatus} onValueChange={(value) => setNextStatus(value as Exclude<FeedbackStatus, "all">)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" disabled={!comment.trim()} onClick={() => setConfirmComment(true)}>
                    <Send className="size-4" />
                    Submit comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState icon={MessageSquare} title="Select feedback" description="Feedback detail and admin notes appear here." />
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={confirmComment}
        onCancel={() => setConfirmComment(false)}
        onConfirm={() => commentMutation.mutate()}
        title="Add admin comment"
        description="This comment will be attached to the feedback item and written to the admin audit log."
        variant="warning"
        isLoading={commentMutation.isPending}
      />
    </div>
  );
}
