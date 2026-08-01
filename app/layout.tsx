import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Throwit — local peer-to-peer transfer",
  description: "Throw files and text directly to nearby devices.",
  applicationName: "Throwit",
  icons: {
    icon: "/paper-logo.webp",
    shortcut: "/paper-logo.webp",
    apple: "/paper-logo.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f1ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
