import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const passcode = formData.get('passcode') as string;

    // Validate passcode
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Passcode salah.' }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // Convert file to Base64 to store in DB
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Update DB
    await prisma.siteSetting.upsert({
      where: { key: 'field_condition_image' },
      update: { value: dataUrl },
      create: { key: 'field_condition_image', value: dataUrl },
    });

    return NextResponse.json({ success: true, url: '/api/settings/image' });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah foto.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'field_condition_image' },
    });
    return NextResponse.json({ exists: !!setting, url: '/api/settings/image' });
  } catch (error) {
    return NextResponse.json({ exists: false, url: null });
  }
}
