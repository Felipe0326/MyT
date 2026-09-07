import type { Metadata, Viewport } from "next";
import { getAppUrl } from "../lib/env";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f5f4f2",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = getAppUrl();
  const title = "Tlamati 2.0.";
  const description = "Repositorio de Dashboards Principales.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "Tlamati 2.0.",
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-192x192.png", type: "image/png", sizes: "192x192" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/logo-morelos-tym.png`, width: 1536, height: 1024, alt: "Tlamati 2.0." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-tym.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
