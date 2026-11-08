"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthPageGuard } from "@/components/auth/auth-page-guard";
import { AuthCard } from "@/components/application/auth/auth-card";
import { login } from "@/lib/auth";
import { getPostAuthRedirect, isExternalRedirectTarget } from "@/lib/auth-redirect";
import { toast } from "sonner";

// No "Create account" / "Forgot password?" links here — admin accounts
// aren't self-service (created via opslin-api directly) and this app has
// no register/forgot-password routes of its own.
export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const nextPath = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || new URLSearchParams(window.location.search).get("redirect")
        : null;

    const handleSubmit = async (data: FormData) => {
        if (loading) return;
        const email = String(data.get("email") ?? "");
        const password = String(data.get("password") ?? "");
        setLoading(true);

        try {
            const result = await login(email, password);
            const target = getPostAuthRedirect(result.user, nextPath);
            if (isExternalRedirectTarget(target)) {
                window.location.href = target;
            } else {
                router.push(target);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthPageGuard nextPath={nextPath}>
            <main className="flex min-h-screen items-center justify-center bg-background-full p-6">
                <AuthCard
                    mode="signin"
                    providers={[]}
                    hideAuxLinks
                    title="Admin sign in"
                    description="Sign in to the Opslin admin console."
                    logo={
                        <span className="flex items-center">
                            <Image src="/logo/opslin-logo-black.png" alt="Opslin" width={129} height={40} className="theme-logo-light h-8 w-auto" />
                            <Image src="/logo/opslin-logo-white.png" alt="" aria-hidden width={129} height={40} className="theme-logo-dark h-8 w-auto" />
                        </span>
                    }
                    footnote="Accounts are provisioned by Opslin. Contact your administrator if you need access."
                    onSubmit={(data) => void handleSubmit(data)}
                />
            </main>
        </AuthPageGuard>
    );
}
