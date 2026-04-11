import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // 1. Fetch total donations
    const genSum = await prisma.generalDonation.aggregate({
      _sum: { amount: true }
    });
    const fixSum = await prisma.fixedDonation.aggregate({
      _sum: { amount: true }
    });
    
    const total = (genSum._sum.amount || 0) + (fixSum._sum.amount || 0);
    const TARGET = 200000000;
    const progress = Math.min(100, (total / TARGET) * 100);
    
    // 2. Fetch field condition image
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'field_condition_image' },
    });

    const backgroundImageDataUrl = setting?.value || '';
    let backgroundImageBuffer: ArrayBuffer | null = null;
    if (backgroundImageDataUrl.includes('base64,')) {
      const base64Part = backgroundImageDataUrl.split('base64,')[1];
      const nodeBuffer = Buffer.from(base64Part, 'base64');
      backgroundImageBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
    }

    // Format currency
    const formatRp = (n: number) => 
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
        .format(n).replace(/\s/g, '').replace(/Rp/i, "Rp.");

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backgroundColor: '#1a1a1a',
            position: 'relative',
          }}
        >
          {backgroundImageBuffer ? (
            <img
              // @ts-ignore
              src={backgroundImageBuffer}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 1,
              }}
            />
          ) : (
             <div style={{ color: 'white', fontSize: 32 }}>Gambar Kosong</div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 ratio
      }
    );
  } catch (error) {
    console.error('Dynamic image error:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
