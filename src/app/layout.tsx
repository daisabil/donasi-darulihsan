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
        <div className="nav-switch-container" style={!isPublic ? { top: 'auto', bottom: '20px', right: '20px', position: 'fixed', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.9)', border: '1px solid #ddd' } : { position: 'fixed' }}>
          <label className="nav-switch">
            <input 
              type="checkbox" 
              checked={isPublic} 
              onChange={toggleMode} 
            />
            <span className="nav-slider"></span>
          </label>
        </div>
        {children}
      </body>
    </html>
  );
}
