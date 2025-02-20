import { NextResponse } from 'next/server';
import { generateMachineData } from '@/app/api/_services/llm';

interface GenerateRequest {
  machineName: string;
}

export async function POST(request: Request) {
  try {
    const { machineName } = await request.json() as GenerateRequest;
    
    if (!machineName) {
      return NextResponse.json(
        { error: 'Machine name is required' },
        { status: 400 }
      );
    }

    const machine = await generateMachineData(machineName);
    return NextResponse.json(machine);
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate machine data' },
      { status: 500 }
    );
  }
} 
