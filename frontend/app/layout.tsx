import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConceptPilot",
  description: "Adaptive learning assistant for effective concept mastery"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
