import type { Metadata } from "next";
import "./globals.css";

// Previously loaded Geist/Geist Mono via next/font/google. That pulls
// fonts.googleapis.com at build time — a real, unnecessary reliability
// risk (a blocked/slow/unreachable Google Fonts CDN fails the whole
// build) for CSS variables globals.css never actually referenced. The
// body font stack below already relies entirely on the system font
// stack, so removing this has no visual effect and zero external
// dependency.
export const metadata: Metadata = {
  title: "ScholarAI — AI-Powered Academic Intelligence",
  description:
    "Turn academic documents into clear insights, explanations and study materials.",
  openGraph: {
    title: "ScholarAI — AI-Powered Academic Intelligence",
    description:
      "Turn academic documents into clear insights, explanations and study materials.",
    siteName: "ScholarAI",
  },
  twitter: {
    card: "summary",
    title: "ScholarAI — AI-Powered Academic Intelligence",
    description:
      "Turn academic documents into clear insights, explanations and study materials.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
