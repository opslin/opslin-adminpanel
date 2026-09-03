const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiError {
    message: string;
    code?: string;
    error?: string;
    requestId?: string;
    details?: Record<string, unknown>;
    [key: string]: unknown;
}

export class ApiRequestError extends Error {
    status: number;
    details: ApiError;

    constructor(status: number, details: ApiError) {
        super(details.message || `Request failed with status ${status}`);
        this.name = "ApiRequestError";
        this.status = status;
        this.details = details;
    }
}

type QueryValue = string | number | boolean | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeApiErrorPayload(payload: unknown, status: number): ApiError {
    if (isRecord(payload) && isRecord(payload.error)) {
        const error = payload.error;
        const code = typeof error.code === "string"
            ? error.code
            : typeof error.error === "string"
                ? error.error
                : undefined;
        const message = typeof error.message === "string"
            ? error.message
            : `Request failed with status ${status}`;
        const details = isRecord(error.details) ? error.details : {};
        const requestId = typeof error.requestId === "string" ? error.requestId : undefined;

        return {
            ...details,
            message,
            code,
            error: code,
            requestId,
            details,
        };
    }

    if (isRecord(payload)) {
        const message = typeof payload.message === "string"
            ? payload.message
            : `Request failed with status ${status}`;
        const code = typeof payload.code === "string"
            ? payload.code
            : typeof payload.error === "string"
                ? payload.error
                : undefined;
        return {
            ...payload,
            message,
            code,
            error: typeof payload.error === "string" ? payload.error : code,
        };
    }

    return { message: `Request failed with status ${status}` };
}

function toQueryString(query?: object): string {
    if (!query) {
        return "";
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query as Record<string, QueryValue | QueryValue[]>)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }
        if (Array.isArray(value)) {
            for (const entry of value) {
                if (entry !== undefined && entry !== null && entry !== "") {
                    params.append(key, String(entry));
                }
            }
            continue;
        }
        params.set(key, String(value));
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
}

class ApiClient {

    private baseUrl: string;


    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }


    private getRequestHeaders(extra: HeadersInit = {}): HeadersInit {
        return {
            ...extra,
        };
    }


    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
        const headers: HeadersInit = {
            ...(options.body && !isFormDataBody && { "Content-Type": "application/json" }),
            ...this.getRequestHeaders(options.headers),
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
            credentials: "include",
        });

        if (!response.ok) {
            if (response.status === 401) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("token");
                    if (endpoint !== "/auth/me") {
                        window.location.href = "/login";
                    }
                }
            }
            const error = normalizeApiErrorPayload(
                await response.json().catch(() => null),
                response.status
            );
            throw new ApiRequestError(response.status, error);
        }

        return response.json();
    }


    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "GET" });
    }


    async post<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        });
    }


    async postWithHeaders<T>(endpoint: string, data?: unknown, headers: HeadersInit = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            headers,
            body: data ? JSON.stringify(data) : undefined,
        });
    }


    async put<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        });
    }


    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }


    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PATCH",
            body: data ? JSON.stringify(data) : undefined,
        });
    }


    async patchWithHeaders<T>(endpoint: string, data?: unknown, headers: HeadersInit = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PATCH",
            headers,
            body: data ? JSON.stringify(data) : undefined,
        });
    }


    // Raw-body variant for TUS-style binary chunk uploads (agent-release
    // artifacts) - unlike patchWithHeaders, never JSON.stringifies the body,
    // and returns response headers too since Upload-Offset/Upload-Length
    // come back that way, not in the JSON body.
    async patchBinary(endpoint: string, body: Blob, headers: HeadersInit = {}): Promise<{ uploadOffset: number; uploadLength: number; status: number }> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "PATCH",
            headers,
            credentials: "include",
            body,
        });

        if (!response.ok && response.status !== 204) {
            const error = normalizeApiErrorPayload(await response.json().catch(() => null), response.status);
            throw new ApiRequestError(response.status, error);
        }

        return {
            uploadOffset: Number(response.headers.get("upload-offset") || "0"),
            uploadLength: Number(response.headers.get("upload-length") || "0"),
            status: response.status,
        };
    }


    // Agent Release Management (Phase A)
    async testAgentReleaseStorage(input: AgentReleaseStorageInput) {
        return this.post<{ success: boolean; message: string }>("/admin/storage/agent-releases/test", input);
    }

    async saveAgentReleaseStorage(input: AgentReleaseStorageInput) {
        return this.put<AgentReleaseStorageStatus>("/admin/storage/agent-releases/", input);
    }

    async getAgentReleaseStorage() {
        return this.get<AgentReleaseStorageStatus>("/admin/storage/agent-releases/");
    }

    // Deploy Intelligence Layer (Phase 1) — platform-wide AI provider config
    async testAiConfig(input: AiConfigInput) {
        return this.post<{ success: boolean; message: string }>("/admin/ai-config/test", input);
    }

    async saveAiConfig(input: AiConfigInput) {
        return this.put<AiConfigStatus>("/admin/ai-config/", input);
    }

    async getAiConfig() {
        return this.get<AiConfigStatus>("/admin/ai-config/");
    }

    // Deploy Intelligence Layer (Phase 24) — per-model pricing (for cost
    // display only, not a credential — no live re-verification) and the
    // token/cost usage aggregation the founder uses to see spend per stage,
    // per user, per day.
    async saveAiPricing(input: AiPricingInput) {
        return this.patch<AiConfigStatus>("/admin/ai-config/pricing", input);
    }

    async getAiUsage(rangeDays = 30) {
        return this.get<AiUsageSummary>(`/admin/ai-config/usage?rangeDays=${rangeDays}`);
    }

    async getAiUsageEvents(query: { limit?: number; cursor?: string } = {}) {
        return this.get<AiUsageEventsResponse>(
            `/admin/ai-config/usage/events${toQueryString(query)}`
        );
    }

    async createAgentRelease(input: CreateAgentReleaseInput) {
        return this.post<AgentRelease>("/admin/agent-releases/", input);
    }

    async getAgentReleases(query: { page?: number; pageSize?: number } = {}) {
        return this.get<AgentReleaseListResponse>(`/admin/agent-releases/${toQueryString(query)}`);
    }

    async initAgentReleaseArtifactUpload(releaseId: string, os: string, arch: string, input: { filename: string; uploadLength: number; sha256: string }) {
        return this.post<AgentReleaseArtifactUploadSession>(
            `/admin/agent-releases/${releaseId}/artifacts/${os}/${arch}/uploads`,
            input
        );
    }

    async uploadAgentReleaseArtifactChunk(uploadUrl: string, uploadLength: number, offset: number, chunk: Blob) {
        return this.patchBinary(uploadUrl, chunk, {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(uploadLength),
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
        });
    }

    async rolloutAgentRelease(releaseId: string) {
        return this.postWithHeaders<{ rolloutId: string; totalTargeted: number; skippedCount: number }>(
            `/admin/agent-releases/${releaseId}/rollout`,
            undefined,
            { "x-admin-confirm": "ROLLOUT_AGENT_RELEASE" }
        );
    }

    async getAgentReleaseRollout(releaseId: string, rolloutId: string) {
        return this.get<AgentReleaseRolloutProgress>(`/admin/agent-releases/${releaseId}/rollouts/${rolloutId}`);
    }

    async rollbackAgentRelease(releaseId: string, targetVersion: string) {
        return this.postWithHeaders<{ rolloutId: string; totalTargeted: number; skippedCount: number }>(
            `/admin/agent-releases/${releaseId}/rollback`,
            { targetVersion },
            { "x-admin-confirm": "ROLLBACK_AGENT_RELEASE" }
        );
    }

    async getAgentReleaseErrorRate(releaseId: string) {
        return this.get<AgentReleaseErrorRate>(`/admin/agent-releases/${releaseId}/error-rate`);
    }

    async getAgentReleaseDetail(releaseId: string) {
        return this.get<AgentReleaseDetail>(`/admin/agent-releases/${releaseId}`);
    }

    // The route itself 302s to a short-lived presigned R2 URL rather than
    // proxying bytes through the API - this just builds the link so the
    // browser's own navigation (which carries the httpOnly auth cookie)
    // can follow the redirect directly, no fetch/blob handling needed.
    getAgentReleaseArtifactDownloadUrl(releaseId: string, artifactId: string) {
        return `${this.baseUrl}/admin/agent-releases/${releaseId}/artifacts/${artifactId}/download`;
    }


    // Auth
    async login(email: string, password: string) {
        return this.post<{ token: string; user: User }>("/auth/login", {
            email,
            password,
        });
    }


    async getMe() {
        return this.get<User>("/auth/me");
    }


    async logout() {
        try {
            await this.request("/auth/logout", { method: "POST" });
        } catch {}
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    }


    async getAdminOverview(query: AdminOverviewQuery = {}) {
        return this.get<AdminAnalyticsResponse>(`/admin${toQueryString(query)}`);
    }


    async getAdminAnalytics() {
        return this.getAdminOverview();
    }


    async getAdminUsers(query: AdminUsersQuery = {}) {
        return this.get<AdminUsersResponse>(`/admin/users${toQueryString(query)}`);
    }


    async getAdminUserDetail(userId: string) {
        return this.get<AdminUserDetailResponse>(`/admin/users/${encodeURIComponent(userId)}`);
    }


    async getAdminAgents(query: AdminAgentsQuery = {}) {
        return this.get<AdminAgentsResponse>(`/admin/agents${toQueryString(query)}`);
    }


    async getAdminDeployments(query: AdminDeploymentsQuery = {}) {
        return this.get<AdminDeploymentsResponse>(`/admin/deployments${toQueryString(query)}`);
    }


    async getAdminDomains(query: AdminDomainsQuery = {}) {
        return this.get<AdminDomainsResponse>(`/admin/domains${toQueryString(query)}`);
    }


    async getAdminQueue() {
        return this.get<AdminQueueSnapshot>("/admin/queue");
    }


    async getAdminSystemHealth() {
        return this.get<AdminSystemHealthResponse>("/admin/system-health");
    }


    async getAdminAuditLogs(query: AdminAuditLogsQuery = {}) {
        return this.get<AdminAuditLogsResponse>(`/admin/audit-logs${toQueryString(query)}`);
    }


    async getAdminUserActivity(query: AdminUserActivityQuery) {
        return this.get<AdminUserActivityResponse>(`/admin/user-activity${toQueryString(query)}`);
    }


    async getAdminInvestorMetrics(query: AdminInvestorMetricsQuery = {}) {
        return this.get<AdminInvestorMetricsResponse>(`/admin/investor-metrics${toQueryString(query)}`);
    }
}

export const api = new ApiClient(API_BASE_URL);

// Types
export interface User {
    id: string;
    email: string;
    name: string;
    preferences?: UserPreferences;
    onboardingCompleted: boolean;
    emailVerified: boolean;
    createdAt: string;
    isPlatformAdmin?: boolean;
    organizationId?: string | null;
    organizationName?: string | null;
    organizationSlug?: string | null;
    orgRole?: OrgRole | null;
    memberships?: OrganizationMembershipSummary[];
}

export interface UserPreferences {
    newDashboard?: boolean;
}

export interface UserPreferencesInput {
    newDashboard?: boolean;
}

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface OrganizationMembershipSummary {
    organizationId: string;
    name: string;
    slug: string;
    role: OrgRole;
}

export interface OrganizationMember {
    id: string;
    userId: string;
    role: OrgRole;
    createdAt: string;
    user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
    };
}

export interface OrganizationInvite {
    id: string;
    email: string;
    role: OrgRole;
    expiresAt: string;
    createdAt?: string;
    url?: string;
}

export interface OrganizationSummary {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
    subscription: {
        plan: string;
        planName?: string;
        status: string;
        paymentRequired?: boolean;
        trialStart?: string | null;
        trialEnd?: string | null;
        currentPeriodEnd?: string | null;
    } | null;
    members: OrganizationMember[];
    invites: OrganizationInvite[];
}

export interface PlanRecord {
    id: string;
    slug: string;
    name: string;
    priceMonthly: number;
    gstPercent: number;
    priceWithGst: number;
    currency: string;
    maxServers: number;
    maxApps: number;
    maxDatabases: number;
    features: Record<string, boolean | string>;
    isPublic: boolean;
    sortOrder: number;
}

export interface TrialStatusResponse {
    status: string;
    startedAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    isInGracePeriod: boolean;
    graceEndsAt: string | null;
    warningLevel: "7d" | "1d" | null;
}

export interface CurrentPlanResponse {
    plan: PlanRecord;
    pendingPlan: PlanRecord | null;
    subscription: {
        id: string;
        status: string;
        paymentRequired: boolean;
        trialStart: string | null;
        trialEnd: string | null;
        currentPeriodEnd: string | null;
        cancelledAt: string | null;
    };
    usage: {
        servers: number;
        apps: number;
        databases: number;
    };
    trial: TrialStatusResponse | null;
}

export interface PlanUsageResponse {
    usage: {
        servers: number;
        apps: number;
        databases: number;
    };
    limits: {
        servers: number;
        apps: number;
        databases: number;
    };
    plan: PlanRecord;
}

export interface EnterpriseContactInput {
    name: string;
    email: string;
    company: string;
    teamSize?: string;
    message?: string;
}

export interface BillingTaxBreakdown {
    baseAmount: number;
    gstAmount: number;
    gstPercent: number;
    totalAmount: number;
    currency: string;
}

export interface BillingCheckoutResponse {
    keyId: string;
    subscriptionId: string;
    planSlug: "pro" | "business";
    amount: number;
    currency: string;
    invoice: BillingTaxBreakdown;
}

export interface BillingSuccessPayload {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
}

export interface BillingSuccessResponse {
    success: boolean;
    subscription: {
        id: string;
        status: string;
        paymentRequired: boolean;
        razorpaySubId: string | null;
        planSlug: string;
        currentPeriodEnd?: string | null;
        endsAt?: string | null;
        trialEnd?: string | null;
    };
    invoice: BillingTaxBreakdown;
}

export interface BillingInvoiceRecord {
    id: string;
    planSlug: string;
    baseAmount: number;
    gstAmount: number;
    gstPercent: number;
    totalAmount: number;
    currency: string;
    status: string;
    razorpayInvoiceId?: string | null;
    razorpayPaymentId?: string | null;
    paidAt?: string | null;
    createdAt: string;
}

export interface OrganizationActivityEntry {
    id: string;
    event: string;
    actorId?: string | null;
    actorType: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

export interface ActivityEvent {
    id: string;
    event: string;
    icon: string;
    description: string;
    actor: {
        id?: string | null;
        type: string;
        name?: string | null;
        email?: string | null;
    };
    target: {
        type?: string | null;
        id?: string | null;
    };
    metadata: Record<string, unknown>;
    createdAt: string;
}

export interface ActivityResponse {
    events: ActivityEvent[];
    nextCursor: string | null;
}

export interface AdminAnalyticsResponse {
    totals: {
        users: number;
        servers: number;
        apps: number;
        deployments24h: number;
        activeSubscriptions: number;
    };
    performance: {
        successRate: number;
        avgDeployTimeMs: number;
    };
    revenue: {
        mrr: number;
        currency: string;
    };
    engagement: {
        dau: number;
        wau: number;
    };
    deploys30d: Array<{
        date: string;
        total: number;
        succeeded: number;
        failed: number;
    }>;
    newUsersToday?: number;
    activeUsers7d?: number;
    totalOrgs?: number;
    connectedAgents?: number;
    disconnectedAgents?: number;
    deploySuccessRate24h?: number;
    deploySuccessRate7d?: number;
    queueWaitAvg?: number;
    queueWaitP95?: number;
    workerCountExpected?: number;
    systemHealth?: {
        api: "ok" | "error";
        db: "ok" | "error";
        redis: "ok" | "error";
    };
    recentDeployments?: Array<{
        id: string;
        appId: string | null;
        appName: string | null;
        status: string;
        startedAt: string;
        finishedAt: string | null;
    }>;
    recentSignups?: Array<{
        id: string;
        name: string | null;
        email: string;
        createdAt: string;
    }>;
    pagination?: {
        page: number;
        pageSize: number;
        total: {
            deployments: number;
            subscriptions: number;
            auditLogs: number;
        };
    };
    generatedAt: string;
}

export interface AdminOverviewQuery {
    page?: number;
    pageSize?: number;
}

export interface AdminPagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages?: number;
}

export interface AdminUsersQuery extends AdminOverviewQuery {
    search?: string;
    plan?: string;
    sortBy?: "createdAt" | "lastActiveAt" | "serverCount";
    sortOrder?: "asc" | "desc";
}

export interface AdminUserListItem {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    status: string;
    emailVerified: boolean;
    orgRole: string | null;
    organization: { id: string; name: string } | null;
    plan: string;
    subscriptionStatus: string | null;
    trialEnd: string | null;
    serverCount: number;
    appCount: number;
    lastActiveAt: string | null;
    riskLevel: "low" | "medium" | string;
}

export interface AdminUsersResponse {
    users: AdminUserListItem[];
    pagination: AdminPagination;
}

export interface AdminUserDetailResponse {
    user: Record<string, unknown> & {
        id: string;
        name: string | null;
        email: string;
        platformRole: string | null;
        status: string;
        createdAt: string;
        updatedAt: string;
    };
    auditLogs: Array<{
        id: string;
        event: string;
        actorType: string;
        targetType: string | null;
        targetId: string | null;
        createdAt: string;
    }>;
}

export interface AdminAgentsQuery extends AdminOverviewQuery {
    status?: "all" | "connected" | "disconnected";
    version?: string;
    search?: string;
}

export interface AdminAgentListItem {
    serverId: string;
    serverName: string;
    userName: string | null;
    userEmail: string | null;
    orgName: string | null;
    status: "connected" | "disconnected" | string;
    agentVersion: string | null;
    versionWarning: boolean;
    lastSeen: string | null;
    os: string | null;
    appCount: number;
    runningJobs: number;
}

export interface AdminAgentsResponse {
    agents: AdminAgentListItem[];
    pagination: AdminPagination;
    summary: {
        connected: number;
        disconnected: number;
        outdated: number;
    };
}

export interface AdminDeploymentsQuery extends AdminOverviewQuery {
    status?: "all" | "success" | "failed" | "running";
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    appId?: string;
    serverId?: string;
}

export interface AdminDeploymentListItem {
    id: string;
    appId: string;
    appName: string;
    serverId: string;
    serverName: string;
    orgId: string | null;
    orgName: string | null;
    sha: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    errorClass: string | null;
}

export interface AdminDeploymentsResponse {
    widgets: {
        deploymentsToday: number;
        successRate: number;
        failureRate: number;
        avgDeployTimeMs: number;
        p95DeployTimeMs: number;
        topFailureReason: string | null;
    };
    deployments: AdminDeploymentListItem[];
    pagination: AdminPagination;
}

export interface AdminDomainsQuery extends AdminOverviewQuery {
    search?: string;
    type?: string;
    status?: string;
    sslStatus?: string;
    appId?: string;
    serverId?: string;
}

export interface AdminDomainListItem {
    id: string;
    domain: string;
    type: string;
    status: string;
    sslStatus: string | null;
    enabled: boolean;
    primary: boolean;
    expectedIp: string | null;
    resolvedIps: string[];
    lastCheckedAt: string | null;
    errorMessage: string | null;
    app: {
        id: string;
        name: string;
        status: string;
    } | null;
    server: {
        id: string;
        name: string;
        ip: string | null;
        publicIp: string | null;
        status: string | null;
    } | null;
    organization: {
        id: string;
        name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDomainsResponse {
    items: AdminDomainListItem[];
    pagination: Required<Pick<AdminPagination, "page" | "pageSize" | "total" | "totalPages">>;
    filters: Partial<Pick<AdminDomainsQuery, "type" | "status" | "sslStatus" | "search" | "appId" | "serverId">>;
}

export interface AdminQueueSnapshot {
    jobs: {
        active: number;
        waiting: number;
        failed: number;
        failed24h: number;
        dlq: number;
    };
    waitTime: {
        avgMs: number;
        p95Ms: number;
    };
    workers: {
        expected: number;
        concurrency: number;
        totalCapacity: number;
    };
    redis: {
        status: "ok" | "error";
        latencyMs: number;
    };
}

export interface AdminSystemHealthResponse {
    api: {
        status: "ok" | "error";
        uptimeSeconds: number;
    };
    db: {
        status: "ok" | "error";
        latencyMs: number;
    };
    redis: {
        status: "ok" | "error";
        latencyMs: number;
    };
    queue: {
        waiting: number;
        active: number;
        failed: number;
    };
    websocket: {
        connectionCount: number;
    };
    backup: {
        lastSuccessful: string | null;
    };
}

export interface AdminAuditLogsQuery extends AdminOverviewQuery {
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    orgId?: string;
    from?: string;
    to?: string;
    search?: string;
}

export interface AdminAuditLogItem {
    id: string;
    createdAt: string;
    actorType: string;
    actorId: string | null;
    actorName: string | null;
    actorEmail: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown>;
    orgId: string | null;
}

export interface AdminAuditLogsResponse {
    logs: AdminAuditLogItem[];
    total: number;
    page: number;
    pageSize: number;
    pagination: AdminPagination;
}

// Named user-activity, not "activity" — the API's own /activity route is an
// unrelated, already-shipped customer-facing feed; this is the founder-only
// per-user behavior timeline backed by ClickHouse (opslin-api/src/lib/user-activity.ts).
export interface AdminUserActivityQuery {
    email: string;
    page?: number;
    pageSize?: number;
    event?: string;
    from?: string;
    to?: string;
}

export interface AdminUserActivityEventItem {
    event: string;
    orgId: string | null;
    targetType: string | null;
    targetId: string | null;
    detail: Record<string, unknown> | null;
    ip: string;
    device: string;
    // Free-tier GeoLite2 lookup — country is a real ISO code, but
    // likelyDatacenter is a heuristic (ASN-name pattern match against known
    // hosting/cloud/VPN providers), not a definitive VPN/proxy detection.
    // MaxMind's real Anonymous-IP signal is a separate paid product.
    country: string | null;
    likelyDatacenter: boolean;
    time: string;
}

export interface AdminUserActivityResponse {
    user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
    };
    events: AdminUserActivityEventItem[];
    pagination: AdminPagination;
}

export interface AdminInvestorMetricsQuery {
    [key: string]: string | number | boolean | undefined;
}

export interface AdminInvestorMetricsResponse {
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
}

export interface PublicMetricsResponse {
    totalDeploys: number;
    avgDeployTimeMs: number;
    uptimePercent: number;
    generatedAt: string;
}

export interface PublicStatusResponse {
    app: {
        id: string;
        name: string;
        status: string;
        healthStatus: string;
        healthCheckedAt: string | null;
        deployedAt: string | null;
    };
    currentStatus: string;
    uptimePercent: number;
    healthHistory: Array<{
        timestamp: string;
        status: string;
        healthStatus: string;
    }>;
    incidents: Array<{
        id: string;
        metric: string;
        severity: string;
        status: string;
        openedAt: string;
        resolvedAt: string | null;
    }>;
    generatedAt: string;
}

export interface DemoStartResponse {
    token: string;
    expiresAt: string;
    loginUrl: string;
    user: {
        id: string;
        email: string;
        name: string;
    };
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    server: {
        id: string;
        name: string;
        status: string;
    };
    app: {
        id: string;
        name: string;
        status: string;
    };
}

export interface OrganizationSlaAppSummary {
    appId: string;
    appName: string;
    domain: string | null;
    publicStatus: boolean;
    currentHealthStatus: "UNKNOWN" | "HEALTHY" | "UNHEALTHY";
    uptimePercent7d: number;
    totalSamples7d: number;
    healthySamples7d: number;
    lastSampleAt: string | null;
    lastIncident: {
        id: string;
        metric: string;
        status: string;
        openedAt: string;
        resolvedAt: string | null;
    } | null;
    targetMet: boolean;
}

export interface OrganizationSlaOverview {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    generatedAt: string;
    windowDays: number;
    targetPercent: number;
    alertThresholdPercent: number;
    uptimePercent7d: number;
    totalSamples7d: number;
    healthySamples7d: number;
    appsAtRisk: number;
    apps: OrganizationSlaAppSummary[];
}

export interface InvitePreview {
    email: string;
    role: OrgRole;
    expiresAt: string;
    organization: {
        id: string;
        name: string;
        slug: string;
    };
}

export interface Server {
    id: string;
    name: string;
    ip: string;
    publicIp?: string | null;
    hostname?: string;
    os?: string;
    arch?: string;
    status: "pending" | "connected" | "disconnected" | "error" | "unclaimed";
    // TRUTH: Real-time agent connection status from WebSocket Map
    isLiveConnected?: boolean;
    agentVersion?: string;
    agentVersionWarning?: boolean;
    helperStatus?: string;
    secureControl?: boolean;
    domainReadiness?: DomainReadiness;
    connectedAt?: string;
    lastSeenAt?: string;
    createdAt: string;
}

export type DomainPortStatus = "available" | "opslin_listening" | "occupied_by_other" | "unknown" | string;

export interface DomainReadiness {
    dockerReady: boolean;
    helperReady: boolean;
    proxyReady: boolean;
    canManageRoutes: boolean;
    canIssueSsl: boolean;
    supportsPrivilegedJobs: boolean;
    publicIp?: string | null;
    port80Status: DomainPortStatus;
    port443Status: DomainPortStatus;
    version?: string | null;
    lastReportedAt?: string | null;
    warning?: string | null;
}

export interface AgentReleaseNotes {
    version: string;
    channel: "stable" | "beta";
    releasedAt: string;
    commit: string;
    criticality: "optional" | "recommended" | "critical";
    whyUpdate: string[];
    bugFixes: string[];
    newFunctions: string[];
    vpsChanges: string[];
    securityNotes: string[];
}

export interface AgentReleaseManifest {
    latestStable: string;
    minimumSelfUpdateVersion: string;
    minimumSecureControlVersion: string;
    releases: AgentReleaseNotes[];
}

export interface AgentUpdateInfo {
    serverId: string;
    currentVersion: string | null;
    latestVersion: string;
    minimumSelfUpdateVersion: string;
    minimumSecureControlVersion: string;
    updateAvailable: boolean;
    canSelfUpdate: boolean;
    isSelfUpdateCapable: boolean;
    isSecureControlCapable: boolean;
    manualUpdateRequired: boolean;
    connected: boolean;
    queueAvailable?: boolean;
    queueError?: string | null;
    jobStoreAvailable?: boolean;
    jobStoreError?: string | null;
    canQueueUpdate: boolean;
    blockedReason?: string | null;
    helperStatus: string;
    manualFallbackCommand: string;
    release: AgentReleaseNotes;
    artifact: {
        os: "linux" | "darwin";
        arch: "amd64" | "arm64";
        downloadUrl: string;
        sha256: string;
        sizeBytes: number;
    };
    activeUpdateJob?: ServerJobStatus | null;
    lastUpdateJob?: ServerJobStatus | null;
}

export interface ServerJobStatus {
    id: string;
    type: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | string;
    payload?: unknown;
    result?: unknown;
    error?: string | null;
    createdAt?: string;
    startedAt?: string | null;
    endedAt?: string | null;
    queueState?: string | null;
    queuePosition?: number | null;
    jobsAhead?: number | null;
    estimatedStartSeconds?: number | null;
    queueError?: string | null;
    progress?: {
        phase?: string | null;
        percent?: number | null;
        message?: string | null;
        status?: string | null;
        elapsedMs?: number | null;
    } | null;
}

export type AgentControlActionName =
    | "agent_status"
    | "agent_logs"
    | "agent_restart"
    | "service_status"
    | "service_restart"
    | "docker_ps"
    | "docker_logs"
    | "docker_inspect"
    | "system_health";

export interface AgentControlInfo {
    serverId: string;
    connected: boolean;
    currentVersion: string | null;
    latestVersion: string;
    minimumSecureControlVersion: string;
    isSecureControlCapable: boolean;
    helperStatus: string;
    secureControl: boolean;
    domainReadiness?: DomainReadiness;
    runningJob?: { id: string; type: string; status?: string; createdAt?: string | null; startedAt?: string | null } | null;
    lastPrivilegedAction?: AgentControlAction | null;
    actions: AgentControlActionName[];
}

export interface AgentControlRequest {
    action: AgentControlActionName;
    args?: Record<string, unknown>;
    timeoutSeconds?: number;
}

export interface AgentControlQueued {
    jobId: string;
    serverId: string;
    action: AgentControlActionName;
    status: "queued";
}

export interface AgentControlAction {
    id: string;
    type: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    payload?: unknown;
    result?: unknown;
    error?: string | null;
    createdAt?: string;
    startedAt?: string | null;
    endedAt?: string | null;
}

export interface AgentUpdateQueued {
    jobId: string;
    serverId: string;
    version: string;
    status: "queued";
    queuePosition?: number | null;
    jobsAhead?: number | null;
    estimatedStartSeconds?: number | null;
}

export interface AuthSession {
    id: string;
    device: string;
    ip: string;
    lastActive: string;
    createdAt: string;
    isCurrent: boolean;
}

export interface ApiKeyRecord {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt?: string | null;
    expiresAt?: string | null;
    createdAt: string;
}

export type FirewallPortClassification = "system" | "managed" | "unknown";

export interface FirewallDiscoveredPort {
    proto: string;
    port: number;
    bind: string;
    process: string;
    containerId?: string;
    containerName?: string;
    classification: FirewallPortClassification;
}

export interface FirewallRule {
    port: number;
    protocol: "tcp" | "udp";
    fromCidr?: string;
    comment?: string;
}

export type FirewallProfile = "WEB" | "API_ONLY" | "INTERNAL" | "CUSTOM";

export interface FirewallPolicyInput {
    profile: FirewallProfile;
    sshCidrs?: string[];
    monitoringIps?: string[];
    customRules?: FirewallRule[];
}

export interface FirewallDiscoveryResponse {
    discovery: {
        ports: FirewallDiscoveredPort[];
    };
}

export interface FirewallPreviewResponse extends FirewallDiscoveryResponse {
    profile: FirewallProfile;
    policy: {
        profile: FirewallProfile;
        defaults: {
            incoming: string;
            outgoing: string;
        };
        rules: FirewallRule[];
    };
    previewCommands: string[];
}

export interface FirewallApplyResponse {
    commitId: string;
    jobId: string;
    status: string;
    preview: FirewallPreviewResponse;
}

export interface FirewallCommitRecord {
    id: string;
    profile: FirewallProfile;
    status: "pending_apply" | "pending_confirmation" | "active" | "auto_reverted" | "reverted" | "failed";
    hasSnapshot: boolean;
    autoRevertJobId?: string | null;
    confirmedAt?: string | null;
    revertedAt?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
}

export interface CloudflareCredentialSummary {
    configured: boolean;
    tokenName?: string | null;
    status?: string | null;
    scopes: string[];
}

export type CloudflareWAFTemplate = "xss" | "sqli" | "country_block";

export type FirewallAttackWindow = "1h" | "24h" | "7d";

export interface FirewallAttackOverview {
    window: FirewallAttackWindow;
    countries: Array<{ country: string; count: number }>;
    sources: Array<{ src_ip_text: string; country: string; count: number }>;
    ports: Array<{ port: number; proto: string; count: number }>;
    recent: Array<{
        time: string;
        srcIp: string;
        country: string;
        port: number;
        proto: string;
        count: number;
    }>;
}

export interface FirewallState {
    server: {
        id: string;
        name: string;
        ip: string;
        status: string;
    };
    cloudflare: CloudflareCredentialSummary | null;
    apps: Array<{
        id: string;
        name: string;
        domain?: string | null;
        cloudflareZoneId?: string | null;
    }>;
    commits: FirewallCommitRecord[];
}

export type HealthCheckMode = "auto" | "strict_http" | "port";

export interface App {
    id: string;
    name: string;
    domain?: string;
    publicStatus?: boolean;
    status: "deploying" | "running" | "stopping" | "stopped" | "deleting" | "delete_failed" | "error" | "pending";
    healthStatus?: "healthy" | "unhealthy" | "unknown";
    gitUrl?: string;
    branch?: string;
    port?: number | null;
    healthPath?: string | null;
    healthCheckMode?: HealthCheckMode | null;
    envVars?: Record<string, string> | null;
    buildpackOverride?: AppBuildpackName | null;
    buildpackVersion?: string | null;
    buildpackVersionPin?: string | null;
    hasDockerfileOverride?: boolean;
    registryCredentials?: RegistryCredentialsSummary | null;
    githubInstallationId?: string | null;
    githubWebhookId?: number | null;
    deployLogs?: string | null;
    deployedAt?: string | null;
    previewDomain?: string | null;
    primaryDomain?: string | null;
    preferredUrl?: string | null;
    createdAt: string;
}

export type DeleteAppResponse = {
    success: boolean;
    status?: "deleting";
    message?: string;
    jobId?: string;
};

export interface AppWithServer extends App {
    server: {
        id: string;
        name: string;
        hostname?: string | null;
        ip?: string | null;
        publicIp?: string | null;
    };
}

export type AppDomainType = "preview" | "custom";

export type AppDomainStatus =
    | "pending_dns"
    | "misconfigured"
    | "connected"
    | "ssl_pending"
    | "active"
    | "failed"
    | "disabled";

export type AppDomainSslStatus =
    | "not_started"
    | "pending"
    | "active"
    | "failed"
    | "not_configured"
    | "manual_required"
    | null;

export type AppDomainRecord = {
    id: string;
    domain: string;
    type: AppDomainType;
    status: AppDomainStatus;
    expectedIp: string | null;
    resolvedIps: string[] | null;
    lastCheckedAt: string | null;
    connectedAt: string | null;
    sslStatus: AppDomainSslStatus;
    primary: boolean;
    enabled: boolean;
    createdAt: string;
    errorMessage?: string | null;
    httpUrl?: string;
    httpsUrl?: string;
    preferredUrl?: string;
    canRetrySsl?: boolean;
    routeStatus?: "pending" | "active" | "failed";
    sslFailureCategory?: string | null;
    sslFailureAction?: string | null;
    readinessWarning?: string | null;
};

export type DnsInstruction = {
    type: "A" | "CNAME";
    name: string;
    value: string;
    ttl: string;
};

export type AppDomainsResponse = {
    domains: AppDomainRecord[];
    primaryDomain: string | null;
    previewDomain: string | null;
};

export type AddCustomDomainResponse = {
    domain: AppDomainRecord;
    dnsInstructions: DnsInstruction;
};

export type DnsCheckResponse = {
    domain: string;
    status: AppDomainStatus;
    expectedIp: string | null;
    resolvedIps: string[];
    checkedAt: string;
    message: string;
};

export interface DeploymentRecord {
    id: string;
    appId?: string;
    sha: string;
    attemptNumber?: number;
    retryOfDeploymentId?: string | null;
    jobId?: string | null;
    status: "pending" | "running" | "succeeded" | "failed" | "aborted" | "rolled_back";
    startedAt: string;
    finishedAt?: string;
    healthLog?: string | null;
    triggeredBy: string;
    triggerMeta: Record<string, unknown>;
    previousSha?: string | null;
    errorClassification?: DeployErrorClassification | null;
    isRetry?: boolean;
    sameCommitRedeploy?: boolean;
    buildpackName?: string | null;
    buildpackVersion?: string | null;
    queue?: {
        jobId: string | null;
        state: "waiting" | "active" | "delayed" | "failed" | "completed" | "unknown" | null;
        attemptsMade?: number;
        failedReason?: string | null;
        workerPickedAt?: string | null;
        lastProgressAt?: string | null;
        progress?: Record<string, unknown> | null;
    };
    checkReport?: DeploymentCheckReport | null;
}

export type DeployGateMode = "safe" | "safe_with_health";

export interface CiRunSummary {
    id: string;
    deployGateId?: string | null;
    deploymentId?: string | null;
    provider?: string | null;
    repoFullName?: string | null;
    branch?: string | null;
    status: "pending" | "passed" | "failed" | string;
    commitSha: string;
    runId?: string | null;
    runUrl?: string | null;
    failureReason?: string | null;
    summary?: Record<string, unknown> | null;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
}

/**
 * Server-Capacity Safety Guard advisory.
 *
 * Mirrors the API's `CapacityAdvisory` interface in
 * `opslin-api/src/lib/capacity-advisor.ts`. Declared locally so the
 * dashboard does not import from the API package directly.
 */
export interface CapacityAdvisory {
    serverId: string;
    safeVuCeiling: number;
    recommendedVu: number;
    planMaxVu: number;
    reason: string;
    serverProfile: {
        cpuCores: number;
        totalMemMb: number;
        availableMemMb: number;
        loadAvg1m: number;
        containerMemLimitMb: number | null;
    };
    dangerZone: boolean;
}

/**
 * FIS Phase 0 preflight check result (docs/audit/07). Mirrors the API's
 * `lib/fis/preflight.ts` `PreflightCheck` shape. Returned on every
 * `deployApp` response once an org opts into FIS_PREFLIGHT_ENABLED — empty
 * array otherwise (feature is a no-op by default).
 */
export interface PreflightCheck {
    id: string;
    result: "PASS" | "WARN" | "BLOCK";
    evidence: string;
    overridable: boolean;
}

/**
 * FIS Phase 1 deployment-risk score (docs/audit/07 "Deployment-risk
 * scoring"). Advisory only — HIGH never blocks a deploy by itself. Mirrors
 * the API's `lib/fis/risk-score.ts` `RiskScoreResult` shape.
 */
export interface RiskScoreResult {
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
}

/**
 * CSF Phase 0 drift finding (docs/audit/06). Read-only — detection only, no
 * reconcile action exists yet. Mirrors the API's `/servers/:id/drift`
 * response shape in `opslin-api/src/routes/servers.ts`.
 */
export interface DriftFinding {
    id: string;
    domain: "APP_RUNTIME" | "NGINX" | "SSL" | "FIREWALL" | "DATABASE" | "ENV";
    path: string;
    expected: unknown;
    observed: unknown;
    severity: "INFO" | "WARN" | "CRIT";
    status: "OPEN" | "ACKNOWLEDGED" | "RECONCILED" | "IGNORED" | "STALE";
    firstSeenAt: string;
    lastSeenAt: string;
}

export interface ServerDriftResponse {
    serverId: string;
    findings: DriftFinding[];
}

export interface DeploymentCheckReport {
    id: string;
    deploymentId: string;
    appId: string;
    serverId: string;
    organizationId?: string | null;
    mode: string;
    status: "pending" | "passed" | "failed" | "warning" | string;
    healthPassed: boolean;
    healthPath?: string | null;
    healthStatusCode?: number | null;
    healthResponseMs?: number | null;
    smokePassed: boolean;
    smokeStatusCode?: number | null;
    smokeResponseMs?: number | null;
    virtualUsers: number;
    durationSeconds: number;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    p50Ms?: number | null;
    p95Ms?: number | null;
    errorRate?: number | null;
    containerRestarted: boolean;
    autoRolledBack: boolean;
    report?: Record<string, unknown> | null;
    createdAt: string;
}

export interface DeployGateSummary {
    id: string;
    appId: string;
    organizationId?: string | null;
    provider: "github" | string;
    repoFullName: string;
    branch: string;
    mode: DeployGateMode | string;
    workflowPath?: string | null;
    workflowBranch?: string | null;
    workflowPrUrl?: string | null;
    workflowPrState?: "open" | "merged" | "closed" | string | null;
    setupStatus?: "not_configured" | "pr_open" | "ready" | "pr_merged_workflow_missing" | "pr_closed" | "permission_error" | string | null;
    setupMessage?: string | null;
    workflowInstalled?: boolean;
    workflowInstalledBranch?: string | null;
    tokenLastUsedAt?: string | null;
    enabled: boolean;
    disabledReason?: string | null;
    secretsInjected: boolean;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    lastCiRun?: CiRunSummary | null;
    recentCiRuns?: CiRunSummary[];
    lastDeploymentStatus?: DeploymentRecord["status"] | string | null;
    lastDeployment?: (DeploymentRecord & { checkReport?: DeploymentCheckReport | null }) | null;
}

export type CreateDeployGateInput = {
    branch: string;
    mode: DeployGateMode;
    repoFullName: string;
};

export type CreateDeployGateResponse = {
    gateId: string;
    token: string;
    webhookUrl: string;
};

export type SafeDeploySetupResponse = {
    prUrl: string;
    workflowPath: string;
    stack: string;
};

export interface DeployErrorClassification {
    code?: string | null;
    category?: string | null;
    title: string;
    description?: string | null;
    summary?: string | null;
    suggestedFix?: string | null;
    suggestion?: string | null;
    logSnippet?: string | null;
    docsLink?: string | null;
    diagnostics?: {
        healthPath?: string | null;
        healthCheckPath?: string | null;
        candidateExitCode?: string | number | null;
        exitCode?: string | number | null;
        buildpack?: string | null;
        buildpackOverride?: string | null;
        runtime?: string | null;
        detectedRuntime?: string | null;
        lastLogLines?: string[] | string | null;
        firstFailureLocation?: {
            file: string;
            line: number;
            column?: number;
        } | null;
        [key: string]: unknown;
    } | null;
}

export interface Database {
    id: string;
    name: string;
    type: "postgresql" | "mysql" | "mongodb" | "redis";
    status: "creating" | "running" | "stopped" | "error";
    port?: number | null;
    hostPort?: number | null;
    username?: string;
    exposure?: "internal" | "public";
    readOnly?: boolean;
    cpuLimit?: number;
    memoryLimit?: number;
    createdAt: string;
}

export interface DatabaseConnectionTestResult {
    connected: boolean;
    message: string;
    checkedAt: string;
}

export interface DatabaseBackupSchedule {
    id: string;
    cron: string;
    retention: number;
    destination: {
        type: string;
        bucket: string;
        prefix: string;
        region: string;
        endpoint?: string | null;
        forcePathStyle?: boolean;
    };
    enabled: boolean;
    lastRunAt?: string | null;
}

export interface DatabaseBackupArtifact {
    id: string;
    sha256: string;
    sizeBytes: number;
    location: string;
    metadata: Record<string, unknown>;
    scheduleId?: string | null;
    createdAt: string;
}

export interface DatabaseBackupScheduleResponse {
    databaseId: string;
    schedule: DatabaseBackupSchedule | null;
    keyProvisioned: boolean;
}

export interface DatabaseBackupOverview {
    databaseId: string;
    schedule: DatabaseBackupSchedule | null;
    artifacts: DatabaseBackupArtifact[];
}

export interface CreateAppInput {
    name: string;
    gitUrl?: string;
    branch?: string;
    githubInstallationId?: string;
    domain?: string;
    healthCheckMode?: HealthCheckMode;
    healthPath?: string;
    envVars?: Record<string, string>;
    buildpackOverride?: BuildpackName;
    dockerfileOverride?: string;
    registryCredentials?: RegistryCredentialsInput;
}

export interface GitHubRepository {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    htmlUrl: string;
    cloneUrl: string;
    sshUrl: string;
    defaultBranch: string;
    language: string | null;
    updatedAt: string | null;
    installationId: string;
    installationAccount: string;
}

export interface GitHubBranch {
    name: string;
    sha: string;
    protected: boolean;
}

export interface AppMetricCurrent {
    id: string;
    name: string;
    status: string;
    healthStatus: "healthy" | "unhealthy" | "unknown";
    healthCheckedAt?: string | null;
    healthPath: string;
    timestamp?: string;
    cpuPercent?: number;
    memoryUsed?: number;
    memoryLimit?: number;
    memoryPercent?: number;
    netInput?: number;
    netOutput?: number;
    blockInput?: number;
    blockOutput?: number;
    restartCount?: number;
    containerId?: string;
    message?: string;
}

export interface AppMetricHistory {
    range: string;
    series: {
        timestamps: string[];
        cpu: number[];
        memoryPercent: number[];
        restartCount: number[];
    };
    healthStatus: "healthy" | "unhealthy" | "unknown";
}

export interface RequestFeedEvent {
    requestId: string;
    timestamp: string;
    method: string;
    path: string;
    pathNormalized: string;
    query: string;
    status: number;
    responseMs: number;
    upstreamMs: number;
    bytesSent: number;
    ip: string;
    userAgent: string;
    country: string;
}

export interface RequestFeedResponse {
    appId: string;
    window: string;
    events: RequestFeedEvent[];
}

export interface RequestLatencyResponse {
    appId: string;
    window: string;
    series: Array<{
        bucket: string;
        p50: number;
        p95: number;
        p99: number;
    }>;
}

export interface RequestErrorResponse {
    appId: string;
    window: string;
    rows: Array<{
        pathNormalized: string;
        status: number;
        count: number;
        samplePath: string;
    }>;
}

export interface RequestHeatmapResponse {
    appId: string;
    rows: Array<{
        bucket: string;
        pathNormalized: string;
        count: number;
    }>;
}

export interface RequestSlowestResponse {
    appId: string;
    window: string;
    rows: Array<{
        pathNormalized: string;
        p95: number;
        requests: number;
    }>;
}

export interface AppOverviewMetric {
    id: string;
    name: string;
    status: string;
    healthStatus: "healthy" | "unhealthy" | "unknown";
    domain?: string | null;
    server: {
        id: string;
        name: string;
    };
    cpuPercent: number;
    memoryUsed: number;
    memoryLimit: number;
    memoryPercent: number;
    restartCount: number;
    updatedAt: string;
}

export interface UpdateAppInput {
    domain?: string | null;
    healthCheckMode?: HealthCheckMode;
    healthPath?: string;
    envVars?: Record<string, string>;
    publicStatus?: boolean;
    buildpackOverride?: BuildpackName | null;
    registryCredentials?: (RegistryCredentialsInput & { clear?: boolean }) | null;
}

export interface DomainCheckResult {
    status: "ready" | "pending" | "missing_public_ip" | "unknown";
    domain: string;
    expectedIp: string | null;
    resolvedIps: string[];
    checkedAt: string;
    message: string;
}

export interface ManifestEntryRecord {
    path: string;
    sha256: string;
    size: number;
}

export interface LatestManifestResponse {
    sha: string | null;
    manifest: ManifestEntryRecord[];
    savedAt: string | null;
    manifestHash: string | null;
}

export interface UploadSessionCreateInput {
    filename: string;
    uploadLength: number;
    archiveSha256: string;
    manifest: ManifestEntryRecord[];
    deletedPaths?: string[];
    forceFullUpload?: boolean;
    mode?: "full" | "delta";
}

export interface UploadSessionRecord {
    id: string;
    appId: string;
    filename: string;
    uploadLength: number;
    uploadOffset: number;
    chunkSize: number;
    status: "pending" | "completed" | "failed";
    mode: "full" | "delta";
    forceFullUpload: boolean;
    manifestHash: string;
    expiresAt: string;
    completedAt: string | null;
    error: string | null;
    uploadUrl: string;
}

export interface UploadManifestDiffResponse {
    mode: "full" | "delta";
    latest: {
        sha: string | null;
        savedAt: string | null;
        manifestHash: string | null;
    };
    changedOrAdded: ManifestEntryRecord[];
    deleted: string[];
    fallbackReason: string | null;
}

export type BuildpackName =
    | "node"
    | "python"
    | "go"
    | "php"
    | "ruby"
    | "java"
    | "rust"
    | "static";

export type LegacyBuildpackName =
    | "react"
    | "vite"
    | "cra"
    | "create-react-app"
    | "angular"
    | "next"
    | "nextjs"
    | "next.js"
    | "next_static"
    | "vue"
    | "nuxt"
    | "svelte"
    | "sveltekit"
    | "django"
    | "flask"
    | "fastapi"
    | "golang"
    | "laravel"
    | "rails"
    | "spring"
    | "springboot"
    | "html";

export type AppBuildpackName = BuildpackName | LegacyBuildpackName;

export interface RegistryCredentialsInput {
    registry: string;
    username: string;
    password: string;
}

export interface RegistryCredentialsSummary {
    registry: string;
    username: string;
    hasPassword: boolean;
}

export interface NginxVersionRecord {
    id: string;
    version: number;
    userSnippet: string;
    fullConfig: string;
    diff: string;
    authorId: string;
    createdAt: string;
}

export interface ProxyRecord {
    id: string;
    path: string;
    upstreamUrl: string;
    upstreamHost?: string;
    upstreamPort?: number;
    pinnedIp?: string;
    preserveHost?: boolean;
    stripPrefix?: boolean;
    timeoutMs?: number;
    forwardCookies?: boolean;
    disabledAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProxyInput {
    path: string;
    upstreamUrl: string;
    preserveHost?: boolean;
    stripPrefix?: boolean;
    timeoutMs?: number;
    forwardCookies?: boolean;
}

export interface NginxEditorResponse {
    appId: string;
    domain?: string | null;
    userSnippet: string;
    fullConfig: string;
    diff: string;
    versions: NginxVersionRecord[];
    proxies: ProxyRecord[];
}

export type AlertMetric = "http_5xx_rate" | "cpu_percent" | "health_status" | "attack_event_spike_ratio";
export type AlertOperator = "GT" | "GTE" | "LT" | "LTE" | "EQ";
export type AlertSeverity = "INFO" | "WARN" | "CRIT";
export type AlertSilenceDuration = "15m" | "1h" | "4h" | "until-resolve";

export type EmailAlertChannelInput = {
    type: "email";
    label: string;
    to: string;
    from: string;
    host: string;
    port: number;
    secure?: boolean;
    username: string;
    password?: string;
};

export type WebhookAlertChannelInput = {
    type: "slack" | "discord";
    label: string;
    webhookUrl?: string;
};

export type PagerDutyAlertChannelInput = {
    type: "pagerduty";
    label: string;
    routingKey?: string;
};

export type AlertChannelInput =
    | EmailAlertChannelInput
    | WebhookAlertChannelInput
    | PagerDutyAlertChannelInput;

export type AlertRuleInput = {
    appId?: string;
    serverId?: string;
    metric: AlertMetric;
    operator: AlertOperator;
    threshold: number;
    durationSec: number;
    severity: AlertSeverity;
    channels: AlertChannelInput[];
    enabled?: boolean;
};

export type AlertEventRecord = {
    id: string;
    openedAt: string;
    resolvedAt: string | null;
    peakValue: number | null;
    lastValue: number | null;
    notifiedChannels: Array<Record<string, unknown>>;
    status: "firing" | "resolved" | "silenced";
    rule?: {
        id: string;
        metric: AlertMetric;
        metricLabel: string;
        threshold: number;
        severity: AlertSeverity;
        app: { id: string; name: string; domain: string | null } | null;
        server: { id: string; name: string } | null;
    };
};

export type AlertRuleRecord = {
    id: string;
    metric: AlertMetric;
    metricLabel: string;
    operator: AlertOperator;
    threshold: number;
    durationSec: number;
    severity: AlertSeverity;
    channels: Array<Record<string, unknown> & { type: string; label: string; hasSecret?: boolean }>;
    silencedUntil: string | null;
    enabled: boolean;
    createdAt: string;
    app: { id: string; name: string; domain: string | null } | null;
    server: { id: string; name: string } | null;
    activeEvent: AlertEventRecord | null;
};

export type AlertTimelinePoint = {
    date: string;
    firing: number;
    resolved: number;
    silenced: number;
};

export type AlertEventDetail = AlertEventRecord & {
    rule: {
        id: string;
        metric: AlertMetric;
        metricLabel: string;
        threshold: number;
        severity: AlertSeverity;
        app: { id: string; name: string; domain: string | null } | null;
        server: { id: string; name: string } | null;
        silencedUntil: string | null;
    };
    chart: {
        threshold: number;
        markers: {
            openedAt: string;
            resolvedAt: string | null;
        };
        samples: Array<{
            time: string;
            value: number;
        }>;
    };
};


export interface CreateDatabaseInput {
    name: string;
    type: "postgresql" | "mysql" | "mongodb" | "redis";
    exposure?: "internal" | "public";
}

// Agent Release Management (Phase A)
export type AgentReleaseStorageProvider = "aws_s3" | "cloudflare_r2" | "s3_compatible";

export interface AgentReleaseStorageInput {
    provider: AgentReleaseStorageProvider;
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
}

export interface AgentReleaseStorageStatus {
    configured: boolean;
    provider?: AgentReleaseStorageProvider;
    bucket?: string;
    region?: string | null;
    endpoint?: string | null;
    forcePathStyle?: boolean;
    lastVerifiedAt?: string | null;
}

// Deploy Intelligence Layer (Phase 1)
export type AiConfigProvider = "anthropic" | "openai_compatible";

export interface AiConfigInput {
    provider: AiConfigProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
}

export interface AiConfigStatus {
    configured: boolean;
    provider?: AiConfigProvider;
    model?: string;
    baseUrl?: string | null;
    lastVerifiedAt?: string | null;
    updatedAt?: string;
    // DIL Phase 24 — null/unset shows as "cost unknown" rather than a
    // fabricated number anywhere this status is used.
    inputCostPerMillionUsd?: number | null;
    outputCostPerMillionUsd?: number | null;
    usdToInrRate?: number | null;
}

// Deploy Intelligence Layer (Phase 24) — token/cost usage tracking
export interface AiPricingInput {
    inputCostPerMillionUsd?: number | null;
    outputCostPerMillionUsd?: number | null;
    usdToInrRate?: number | null;
}

export interface AiUsageBucket {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
}

export interface AiUsageByStage extends AiUsageBucket {
    stage: string;
}

export interface AiUsageByUser extends AiUsageBucket {
    userId: string | null;
    name: string;
    email: string | null;
}

export interface AiUsageByDay extends AiUsageBucket {
    date: string;
}

export interface AiUsageSummary {
    rangeDays: number;
    costKnown: boolean;
    pricing: {
        inputCostPerMillionUsd: number | null;
        outputCostPerMillionUsd: number | null;
        usdToInrRate: number | null;
    };
    totals: {
        calls: number;
        inputTokens: number;
        outputTokens: number;
        costUsd: number | null;
        costInr: number | null;
        unattributedCalls: number;
    };
    byStage: AiUsageByStage[];
    byUser: AiUsageByUser[];
    byDay: AiUsageByDay[];
}

export interface AiUsageEventItem {
    id: string;
    stage: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    jobId: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    createdAt: string;
}

export interface AiUsageEventsResponse {
    events: AiUsageEventItem[];
    nextCursor: string | null;
}

export interface CreateAgentReleaseInput {
    version: string;
    channel?: "stable" | "beta";
    criticality?: "optional" | "recommended" | "critical";
    commit?: string;
    whyUpdate?: string[];
    bugFixes?: string[];
    newFunctions?: string[];
    vpsChanges?: string[];
    securityNotes?: string[];
}

export interface AgentReleaseArtifact {
    id: string;
    releaseId: string;
    os: "linux" | "darwin";
    arch: "amd64" | "arm64";
    sha256: string;
    sizeBytes: number;
    storageKey: string;
    uploadedAt: string;
}

export interface AgentRelease {
    id: string;
    version: string;
    channel: string;
    criticality: string;
    status: string;
    commit: string | null;
    whyUpdate: string[] | null;
    bugFixes: string[] | null;
    newFunctions: string[] | null;
    vpsChanges: string[] | null;
    securityNotes: string[] | null;
    uploadedById: string;
    uploadedAt: string;
    rolledOutAt: string | null;
    artifacts: AgentReleaseArtifact[];
    serversOnVersion: number;
}

export interface AgentReleaseListResponse {
    releases: AgentRelease[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AgentReleaseArtifactUploadSession {
    id: string;
    releaseId: string;
    os: string;
    arch: string;
    filename: string;
    uploadLength: number;
    uploadOffset: number;
    chunkSize: number;
    status: "pending" | "completed" | "failed";
    uploadUrl: string;
}

export interface AgentReleaseErrorRate {
    version: string;
    measures: "update_installation_failure_rate";
    totalUpdateAttempts: number;
    counts: Record<string, number>;
    updateFailureRate: number | null;
}

export interface AgentReleaseRolloutProgress {
    rolloutId: string;
    kind: "rollout" | "rollback";
    totalTargeted: number;
    skippedCount: number;
    status: string;
    triggeredAt: string;
    completedAt: string | null;
    counts: Record<string, number>;
}

// Phase C
export interface AgentReleaseRolloutRecord {
    id: string;
    releaseId: string;
    kind: "rollout" | "rollback";
    targetServerIds: string[];
    totalTargeted: number;
    skippedCount: number;
    status: string;
    triggeredById: string;
    triggeredAt: string;
    completedAt: string | null;
}

// Phase D
export interface AgentReleaseSmokeTestRecord {
    id: string;
    releaseId: string;
    artifactId: string;
    os: string;
    arch: string;
    status: "pending" | "running" | "passed" | "failed" | "timed_out" | "error";
    serverId: string | null;
    connected: boolean;
    handshakeReceived: boolean;
    reportedVersion: string | null;
    failureReason: string | null;
    startedAt: string;
    completedAt: string | null;
}

export interface AgentReleaseDetail extends Omit<AgentRelease, "serversOnVersion"> {
    rolledOutById: string | null;
    rollouts: AgentReleaseRolloutRecord[];
    smokeTests: AgentReleaseSmokeTestRecord[];
    errorRate: AgentReleaseErrorRate;
}
