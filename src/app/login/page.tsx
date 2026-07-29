"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPageGuard } from "@/components/auth/auth-page-guard";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";
import { getPostAuthRedirect, isExternalRedirectTarget } from "@/lib/auth-redirect";
import { toast } from "sonner";

// No "Create account" / "Forgot password?" links here — admin accounts
// aren't self-service (created via opslin-api directly) and this app has
// no register/forgot-password routes of its own.
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const nextPath = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || new URLSearchParams(window.location.search).get("redirect")
        : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
        <AuthSplitShell>
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground">Admin sign in</h1>
                <p className="mt-1 text-sm text-muted-foreground">Sign in to the Opslin admin console</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <Button
                    type="submit"
                    className="w-full transition-transform duration-150 active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? "Signing in..." : "Sign in"}
                </Button>
            </form>
        </AuthSplitShell>
        </AuthPageGuard>
    );
}
