import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const donations = await prisma.generalDonation.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(donations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode, name, amount, date, paymentMethod, notes } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newDonation = await prisma.generalDonation.create({
      data: {
        name,
        amount: Number(amount),
        date: new Date(date),
        paymentMethod,
        notes: notes || null,
      },
    });

    return NextResponse.json(newDonation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { passcode, id } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.generalDonation.delete({
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
    const { passcode, id, name, amount, date, paymentMethod, notes } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await prisma.generalDonation.update({
      where: { id },
      data: {
        name,
        amount: Number(amount),
        date: new Date(date),
        paymentMethod,
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
