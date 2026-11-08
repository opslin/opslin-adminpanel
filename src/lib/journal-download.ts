const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type JournalDownload = {
  /** Only these runs. */
  runKeys?: string[];
  /** Only the N most recently active runs. */
  latestRuns?: number;
  /** "ai_call" for the AI calls only; empty for every event. */
  kind?: string;
  format?: "ndjson" | "json";
};

/** Downloads journal data as a file. Throws a plain message when nothing matches or the request fails. */
export async function downloadJournal(options: JournalDownload): Promise<number> {
  const params = new URLSearchParams();
  if (options.runKeys && options.runKeys.length > 0) params.set("runKeys", options.runKeys.join(","));
  else if (options.latestRuns && options.latestRuns > 0) params.set("latestRuns", String(options.latestRuns));
  if (options.kind) params.set("kind", options.kind);
  const format = options.format ?? "ndjson";
  params.set("format", format);
  const response = await fetch(`${API_BASE_URL}/admin/deploy-journal/export?${params.toString()}`, { credentials: "include" });
  if (!response.ok) throw new Error(`The download failed (${response.status}).`);
  const text = await response.text();
  const count = format === "json" ? (JSON.parse(text) as unknown[]).length : text.split("\n").filter(Boolean).length;
  if (count === 0) throw new Error("Nothing matched, so there is nothing to download.");
  const url = URL.createObjectURL(new Blob([text], { type: format === "json" ? "application/json" : "application/x-ndjson" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `opslin-journal-${new Date().toISOString().slice(0, 10)}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
  return count;
}

/** The journal run of one deployment, or null when it ran before the journal existed. */
export async function runKeyOfDeployment(deploymentId: string): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/admin/deploy-journal/by-deployment/${encodeURIComponent(deploymentId)}`, { credentials: "include" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not look up this deployment (${response.status}).`);
  return ((await response.json()) as { runKey: string }).runKey;
}
