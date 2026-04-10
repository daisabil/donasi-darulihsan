import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const donations = await prisma.fixedDonation.findMany({
      orderBy: { date: 'desc' },
      include: {
        donor: true
      }
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
    const { passcode, donorId, amount, date, paymentMethod, notes } = body;
    
    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newDonation = await prisma.fixedDonation.create({
      data: {
        donorId,
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

    await prisma.fixedDonation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
