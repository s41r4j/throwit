import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Throwit — local P2P sharing",
  description: "Fast peer-to-peer file and text transfer between nearby devices.",
  icons: { icon: "/paper-logo.webp" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
