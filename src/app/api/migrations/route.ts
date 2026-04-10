import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const migrations = await prisma.moneyMigration.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(migrations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode, fromMethod, toMethod, amount, date, notes } = body;

    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (fromMethod === toMethod) {
      return NextResponse.json({ error: 'Metode asal dan tujuan tidak boleh sama.' }, { status: 400 });
    }

    const migration = await prisma.moneyMigration.create({
      data: {
        fromMethod,
        toMethod,
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
      },
    });

    return NextResponse.json(migration);
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

    await prisma.moneyMigration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { passcode, id, fromMethod, toMethod, amount, date, notes } = body;

    if (passcode !== '124159') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (fromMethod === toMethod) {
      return NextResponse.json({ error: 'Metode asal dan tujuan tidak boleh sama.' }, { status: 400 });
    }

    const updated = await prisma.moneyMigration.update({
      where: { id },
      data: {
        fromMethod,
        toMethod,
        amount: Number(amount),
        date: new Date(date),
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
