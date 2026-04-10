'use client';
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  // Jika di root (/), maka switch "ON" (biru, bulatan kanan)
  // Jika di /admin, maka switch "OFF" (abu, bulatan kiri)
  const isPublic = pathname === "/";

  const toggleMode = () => {
    if (isPublic) {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  return (
    <html lang="id">
      <head>
        <title>Live Update Donasi Lapangan SD</title>
        <meta name="description" content="Aplikasi transparansi update galang dana lapangan SD secara real-time." />
      </head>
      <body>
        <div className="nav-switch-container">
          <span className="nav-switch-label">Panel</span>
          <label className="nav-switch">
            <input 
              type="checkbox" 
              checked={isPublic} 
              onChange={toggleMode} 
            />
            <span className="nav-slider"></span>
          </label>
          <span className="nav-switch-label">Situs</span>
        </div>
        {children}
      </body>
    </html>
  );
}
