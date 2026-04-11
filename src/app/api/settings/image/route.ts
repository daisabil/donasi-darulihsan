import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'field_condition_image' },
    });

    if (!setting || !setting.value) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // value is a data URL: data:image/jpeg;base64,xxxx
    const [header, base64Data] = setting.value.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
