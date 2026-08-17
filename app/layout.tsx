import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Roadwise CDL | Know the Route. Own the Road.";
  const description = "Adaptive Nebraska CDL study with personalized routes, mistake review, readiness tracking, and full-length practice tests.";

  return {
    title,
    description,
    applicationName: "Roadwise CDL",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Roadwise CDL", statusBarStyle: "black-translucent" },
    icons: { apple: "/icon-1024.png" },
    openGraph: { title, description, images: [{ url: `${origin}/og-adaptive.png`, width: 1536, height: 1024 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-adaptive.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}


