import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { getAppOrigin } from "@/lib/app-origin";

import { Providers } from "./providers";
import "@fontsource-variable/lora/wght.css";
import "./globals.css";

const appUrl = getAppOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Fitness AI — дневник тренировок с AI-анализом",
    template: "%s · Fitness AI",
  },
  description:
    "Создавайте шаблоны тренировок, фиксируйте подходы и получайте AI-анализ прогресса по силе, объёму и технике.",
  applicationName: "Fitness AI",
  authors: [{ name: "Innertalk Studio" }],
  creator: "Innertalk Studio",
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fitness AI",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#22221f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
