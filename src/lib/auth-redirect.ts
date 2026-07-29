import type { User } from "@/lib/api";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
const POST_VERIFY_REDIRECT_KEY = "opslin.postVerifyRedirect";
const UNSAFE_AUTH_REDIRECT_PATHS = new Set([
    "/forgot-password",
    "/login",
    "/register",
    "/reset-password",
    "/verify-email",
]);

function isSafeLocalPath(path: string | null | undefined) {
    if (!path || !path.startsWith("/") || path.startsWith("//")) {
        return false;
    }

    try {
        const target = new URL(path, "https://opslin.local");
        return !UNSAFE_AUTH_REDIRECT_PATHS.has(target.pathname);
    } catch {
        return false;
    }
}

export function getAuthRedirectTarget(path: string | null | undefined, fallback = "/") {
    return isSafeLocalPath(path) ? path as string : fallback;
}

// This app has no /verify-email route of its own (admin accounts are
// created directly in opslin-api, never through self-service signup) — send
// unverified users to the dashboard's real verify-email flow instead.
export function getVerifyEmailRedirectTarget(path: string | null | undefined) {
    if (typeof window !== "undefined" && isSafeLocalPath(path)) {
        sessionStorage.setItem(POST_VERIFY_REDIRECT_KEY, path as string);
    }
    return `${DASHBOARD_URL}/verify-email`;
}

export function isExternalRedirectTarget(target: string) {
    return /^https?:\/\//.test(target);
}

export function getPostVerificationRedirect(fallback = "/") {
    if (typeof window === "undefined") {
        return fallback;
    }

    const stored = sessionStorage.getItem(POST_VERIFY_REDIRECT_KEY);
    if (stored) {
        sessionStorage.removeItem(POST_VERIFY_REDIRECT_KEY);
        return getAuthRedirectTarget(stored, fallback);
    }

    const nextPath = new URLSearchParams(window.location.search).get("next");
    return getAuthRedirectTarget(nextPath, fallback);
}

export function getPostAuthRedirect(user: Pick<User, "emailVerified">, nextPath: string | null | undefined) {
    if (user.emailVerified === false) {
        return getVerifyEmailRedirectTarget(nextPath);
    }

    return getAuthRedirectTarget(nextPath);
}

export function canShowDevOtp() {
    return process.env.NODE_ENV !== "production";
}
