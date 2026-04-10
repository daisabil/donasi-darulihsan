import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const donors = await prisma.fixedDonor.findMany({
      orderBy: { name: 'asc' },
      include: {
        donations: true
      }
    });
    return NextResponse.json(donors);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode, name, date, whatsapp } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newDonor = await prisma.fixedDonor.create({
      data: {
        name,
        whatsapp,
        startDate: new Date(date),
      },
    });

    return NextResponse.json(newDonor);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Nama donatur sudah terdaftar' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal mendaftar donatur' }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { passcode, id } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.fixedDonor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { passcode, id, name, whatsapp } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await prisma.fixedDonor.update({
      where: { id },
      data: {
        name,
        whatsapp,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
