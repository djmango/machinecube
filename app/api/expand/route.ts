import { NextResponse } from 'next/server';
import { generateChildComponents } from '../_services/llm';

export const runtime = 'edge';

interface ExpandRequest {
    componentName: string;
    ancestry: string[];
}

export async function POST(request: Request) {
    try {
        const { componentName, ancestry } = await request.json() as ExpandRequest;
        if (!componentName || !ancestry) {
            return NextResponse.json({ error: 'Component name and ancestry are required' }, { status: 400 });
        }

        const children = await generateChildComponents(componentName, ancestry);
        return NextResponse.json(children);
    } catch (error) {
        console.error('Error expanding component:', error);
        return NextResponse.json(
            { error: 'Failed to expand component' },
            { status: 500 }
        );
    }
} 
