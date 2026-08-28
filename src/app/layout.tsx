import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SABBA — Ledningssystem",
  description: "Internt CRM, ekonomi och lösenordsvalv för SABBA agency",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
