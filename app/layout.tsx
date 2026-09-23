import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://www.veltacapital.net";
const SITE_TITLE = "VeltaCapital: Financial reasoning practice";
const SOCIAL_DESCRIPTION =
  "A free financial reasoning lab using historical charts, transparent scoring, and risk-first education.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | VeltaCapital",
  },
  description:
    "Use a free course and historical-chart exercises to practice financial reasoning without trading real money.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VeltaCapital",
    title: SITE_TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SOCIAL_DESCRIPTION,
  },
};

type LayoutProps = Readonly<{ children: React.ReactNode }>;

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
