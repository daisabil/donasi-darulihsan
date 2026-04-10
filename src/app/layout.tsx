import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Update Donasi Lapangan SD",
  description: "Aplikasi transparansi update galang dana lapangan SD secara real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <nav style={{position: 'absolute', top: 10, right: 20, zIndex: 100}}>
          <a href="/" style={{marginRight: 15, textDecoration: 'none', color: '#00AEEF', fontWeight: 'bold'}}>Beranda Umum</a>
          <a href="/admin" style={{textDecoration: 'none', color: '#555'}}>Dashboard Admin</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
