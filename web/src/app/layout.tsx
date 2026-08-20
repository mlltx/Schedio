import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppTenantProvider } from "@/components/AppTenantProvider";
import { AppConnectorProvider } from "@/components/AppConnectorProvider";
import { AppPermissionsProvider } from "@/components/AppPermissionsProvider";
import "@schedio/embed/style.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A real single-tenant deployment would source this from the same tenant
// config (at build/server time, e.g. env vars) rather than the in-browser
// preview switcher below — metadata is rendered before any client script
// runs, so it can't reactively follow a client-side selection.
export const metadata: Metadata = {
  title: "Schedio",
  description: "A visual model for scheduled work.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppTenantProvider>
          <AppConnectorProvider>
            <AppPermissionsProvider>{children}</AppPermissionsProvider>
          </AppConnectorProvider>
        </AppTenantProvider>
      </body>
    </html>
  );
}
