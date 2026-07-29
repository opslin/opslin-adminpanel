"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// Admin console is always dark (matches the prior (admin)/layout.tsx
// behavior, which forced a `dark` class regardless of the user's stored
// dashboard theme preference) — no system detection, no light option.
export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <ThemeProvider
            attribute="class"
            forcedTheme="dark"
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster position="top-right" />
            </QueryClientProvider>
        </ThemeProvider>
    );
}
