import { NextResponse } from 'next/server';
import { generateComponents } from '../../_services/llm';

export const runtime = 'edge';

interface RequestBody {
  parentName: string;
  parentType: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Type guard to validate request body
    if (!isValidRequestBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request body. Required fields: parentName, parentType' },
        { status: 400 }
      );
    }

    const { parentName, parentType } = body;

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

function isValidRequestBody(body: unknown): body is RequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'parentName' in body &&
    'parentType' in body &&
    typeof (body as RequestBody).parentName === 'string' &&
    typeof (body as RequestBody).parentType === 'string'
  );
} 
