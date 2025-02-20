import { NextResponse } from 'next/server';
import { generateComponents } from '../../_services/llm';

export async function POST(request: Request) {
  try {
    const { parentName, parentType } = await request.json();
    
    if (!parentName || !parentType) {
      return NextResponse.json(
        { error: 'Parent name and type are required' },
        { status: 400 }
      );
    }

    const components = await generateComponents(parentName, parentType);
    return NextResponse.json(components);
  } catch (error) {
    console.error('Component generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate components' },
      { status: 500 }
    );
  }
} 
