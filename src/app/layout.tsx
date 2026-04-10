'use client';
import { usePathname } from "next/navigation";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="id">
      <head>
        <title>Live Update Donasi Lapangan SD</title>
        <meta name="description" content="Aplikasi transparansi update galang dana lapangan SD secara real-time." />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
