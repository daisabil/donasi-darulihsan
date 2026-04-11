import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <title>Live Update Donasi Lapangan SD</title>
        <meta name="description" content="Aplikasi transparansi update galang dana lapangan SD secara real-time." />
        
        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://donasi-darulihsan.vercel.app/" />
        <meta property="og:title" content="Donasi Pembangunan Halaman Masjid Darul Ihsan" />
        <meta property="og:description" content="Mari berpartisipasi dalam pembangunan paving halaman Masjid Darul Ihsan untuk kenyamanan santri dan jamaah." />
        <meta property="og:image" content="https://donasi-darulihsan.vercel.app/api/settings/image" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="600" />
        <meta property="og:image:height" content="600" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="Donasi Pembangunan Halaman Masjid Darul Ihsan" />
        <meta property="twitter:description" content="Mari berpartisipasi dalam pembangunan paving halaman Masjid Darul Ihsan untuk kenyamanan santri dan jamaah." />
        <meta property="twitter:image" content="https://donasi-darulihsan.vercel.app/api/settings/image" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
