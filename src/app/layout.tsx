'use client';
import { usePathname } from "next/navigation";
import "./globals.css";
import ModeSwitch from "@/components/ModeSwitch";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <html lang="id">
      <head>
        <title>Live Update Donasi Lapangan SD</title>
        <meta name="description" content="Aplikasi transparansi update galang dana lapangan SD secara real-time." />
      </head>
      <body>
        {/* Render Switch hanya di halaman utama. 
            Di halaman admin, komponen ini akan dirender di dalam admin/page.tsx 
            agar bisa mendeteksi status login secara tepat. */}
        {isHome && <ModeSwitch isPublic={true} style={{ position: 'absolute' }} />}
        
        {children}
      </body>
    </html>
  );
}
