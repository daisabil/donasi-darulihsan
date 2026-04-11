import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const passcode = formData.get('passcode') as string;

    // Validate passcode (hardcoded as '124159' in this project)
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Passcode salah.' }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(process.cwd(), 'public', 'field-condition.jpg');

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ success: true, url: '/field-condition.jpg' });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah foto.' }, { status: 500 });
  }
}

// Optional: GET to check if file exists or get metadata
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'field-condition.jpg');
  const exists = fs.existsSync(filePath);
  return NextResponse.json({ exists, url: exists ? '/field-condition.jpg' : null });
}
