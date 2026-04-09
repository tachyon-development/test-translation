import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HospiQ",
  description: "Real-time AI-powered hospitality workflow system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
