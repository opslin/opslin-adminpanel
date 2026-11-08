"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

// Theme (light/dark) is owned by BoardUI's ThemeToggle — it toggles the
// `.dark` class on <html> directly, persists to localStorage under
// "boardui:theme", and a pre-paint script in layout.tsx applies the stored
// value before hydration to avoid a flash. Light is the default.
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
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster position="top-right" />
        </QueryClientProvider>
    );
}
