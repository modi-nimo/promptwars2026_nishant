import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConceptMate | Adaptive AI Tutor",
  description: "ConceptMate helps learners master any concept with Gemini-powered diagnostics, adaptive lessons, and visible progress."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script src="/runtime-config" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
