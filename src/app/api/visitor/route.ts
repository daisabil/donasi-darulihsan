import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getKeyFromDate(d: Date, g: string): string {
  switch (g) {
    case 'hourly':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
    case 'weekly': {
      const wn = getWeekNumber(d);
      return `${d.getFullYear()}-W${pad(wn)}`;
    }
    case 'monthly':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    default: // daily
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const g = searchParams.get('g') || 'daily';

    const views = await prisma.pageView.findMany({
      orderBy: { date: 'desc' },
      take: 50000,
    });

    // Group by key
    const grouped: Record<string, number> = {};
    views.forEach(v => {
      const key = getKeyFromDate(new Date(v.date), g);
      grouped[key] = (grouped[key] || 0) + 1;
    });

    // Build result array
    const result: { date: string; count: number; label: string }[] = [];

    if (g === 'hourly') {
      // Last 24 hours
      for (let i = 23; i >= 0; i--) {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() - i);
        const key = getKeyFromDate(d, 'hourly');
        result.push({ date: key, count: grouped[key] || 0, label: `${pad(d.getHours())}:00` });
      }
    } else if (g === 'daily') {
      // Last 14 days
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = getKeyFromDate(d, 'daily');
        result.push({
          date: key, count: grouped[key] || 0,
          label: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        });
      }
    } else if (g === 'weekly') {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const wn = getWeekNumber(d);
        const key = `${d.getFullYear()}-W${pad(wn)}`;
        result.push({ date: key, count: grouped[key] || 0, label: `Mg ${wn}` });
      }
    } else {
      // monthly — last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = getKeyFromDate(d, 'monthly');
        result.push({
          date: key, count: grouped[key] || 0,
          label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        });
      }
    }

    return NextResponse.json({ total: views.length, data: result, granularity: g });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const page = body?.page || '/';
    await prisma.pageView.create({ data: { page } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record' }, { status: 500 });
  }
}
