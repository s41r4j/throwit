import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://throwit.s41r4j.in"),
  title: "Throwit",
  description: "Throw files and text directly to nearby devices with fast peer-to-peer transfer.",
  applicationName: "Throwit",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Throwit",
    description: "Don’t upload it. Throw it directly to a nearby device.",
    url: "/",
    siteName: "Throwit",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Throwit peer-to-peer file sharing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Throwit",
    description: "Don’t upload it. Throw it directly to a nearby device.",
    creator: "@s41r4j",
    images: ["/twitter-image"],
  },
  icons: {
    icon: "/paper-logo.webp",
    shortcut: "/paper-logo.webp",
    apple: "/paper-logo.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f2ed",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
