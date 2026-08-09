import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.veltacapital.net"),
  title: {
    default: "VeltaCapital — Financial reasoning practice",
    template: "%s | VeltaCapital",
  },
  description:
    "Practice interpreting historical stock charts, explain your reasoning, and review what the data showed — without trading real money.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VeltaCapital",
    title: "VeltaCapital — Financial reasoning practice",
    description:
      "A financial reasoning lab using historical charts, transparent scoring, and risk-first education.",
  },
  twitter: {
    card: "summary",
    title: "VeltaCapital — Financial reasoning practice",
    description:
      "A financial reasoning lab using historical charts, transparent scoring, and risk-first education.",
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
