import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { InstallPwaBanner } from "@/components/pwa/install-pwa-banner";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

const APP_URL = (() => {
  try {
    return new URL(
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
        /\/$/,
        "",
      ),
    );
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase: APP_URL,
  title: {
    default: "NEXORA",
    template: "%s · NEXORA",
  },
  description:
    "Plataforma para administrar conjuntos residenciales: residentes, visitas, entregas y más.",
  applicationName: "NEXORA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NEXORA",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#4f46e5" },
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
    <html lang="es">
      <body
        className={`${display.variable} ${body.variable} min-h-dvh antialiased`}
      >
        {children}
        <RegisterServiceWorker />
        <InstallPwaBanner />
      </body>
    </html>
  );
}
