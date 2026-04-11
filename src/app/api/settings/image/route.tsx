import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'field_condition_image' },
    });

    const backgroundImageDataUrl = setting?.value || '';
    
    if (backgroundImageDataUrl.includes('base64,')) {
      const parts = backgroundImageDataUrl.split('base64,');
      const mimeType = parts[0].replace('data:', '').replace(';', '') || 'image/jpeg';
      const buffer = Buffer.from(parts[1], 'base64');

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=120, s-maxage=120',
        },
      });
    }

    return new Response('Gambar kosong', { status: 404 });
  } catch (error) {
    console.error('Image fetch error:', error);
    return new Response('Error', { status: 500 });
  }
}
