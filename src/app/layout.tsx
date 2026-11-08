import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { CookieBanner } from "@/components/gdpr/cookie-banner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const monoSource = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-source",
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
      <body className={`${inter.variable} ${monoSource.variable} font-sans antialiased`} suppressHydrationWarning>
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('[bis_skin_checked]').forEach(function (element) { element.removeAttribute('bis_skin_checked'); });",
          }}
        />
        <Script
          id="boardui-theme-prepaint"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('boardui:theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}",
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
