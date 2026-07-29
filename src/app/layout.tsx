import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { CookieBanner } from "@/components/gdpr/cookie-banner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Opslin Admin",
  description: "Opslin platform admin console.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('[bis_skin_checked]').forEach(function (element) { element.removeAttribute('bis_skin_checked'); });",
          }}
        />
        <ErrorBoundary>
          <Providers>
            {children}
            <CookieBanner />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
