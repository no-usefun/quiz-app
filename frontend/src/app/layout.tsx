import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Quizly — Secure, Offline-First, AI-Proctored Assessment Platform",
  description:
    "Advanced assessment ecosystem for modern academic and technical evaluations.",
  icons: {
    icon: "/favicon.svg",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} font-sans antialiased bg-[#f5f5f4] text-[#111111] selection:bg-[#e6e3e2] selection:text-[#165dfb]`}
      >
        {children}
      </body>
    </html>
  );
}
