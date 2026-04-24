import { NextResponse } from 'next/server';
import { buildDemoSensor } from '@/lib/demo-sensor';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: buildDemoSensor(),
  });
}
