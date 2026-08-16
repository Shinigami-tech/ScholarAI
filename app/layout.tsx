import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
