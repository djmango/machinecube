import { NextResponse, NextRequest } from 'next/server';
import { ChatGroq } from "@langchain/groq";
import { Component } from '../../types/machines';

export const runtime = 'edge';

interface ExpandRequest {
    componentName: string;
    ancestry: string[];
}

interface ComponentChild {
    name: string;
    children: ComponentChild[];
}

interface ComponentResponse {
    children: ComponentChild[];
}

async function generateChildComponents(componentName: string, ancestry: string[], existingChildren: Component[] = []): Promise<Omit<Component, 'parent'>[]> {
    const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY || '',
        model: "deepseek-r1-distill-llama-70b",
        temperature: 0.3,
    });

    const context = ancestry.length === 0
        ? 'This is the root machine component. Generate a complete multi-level breakdown of all physical subcomponents, including their own subcomponents.'
        : 'Break this component down into its physical subcomponents, including their own subcomponents where applicable.';

    const existingChildrenString = existingChildren.length > 0
        ? `\nExisting physical components: ${existingChildren.map(c => `"${c.name}"`).join(", ")}`
        : '';

    const ancestryString = ancestry.length > 0
        ? `within the physical assembly hierarchy: ${ancestry.join(" → ")}`
        : '';

    const systemPrompt = `You are a precision manufacturing engineer specializing in machine component design and assembly.
    Output only valid JSON matching the following structure, with multiple levels of physical subcomponents:
    {
        "children": [
            {
                "name": "string (specific physical part)",
                "children": [
                    {
                        "name": "string (subcomponent)",
                        "children": [
                            {
                                "name": "string (further subcomponent)",
                                "children": []
                            }
                        ]
                    }
                ]
            }
        ]
    }

    Component Requirements:
    - Every component must be a real, physical, manufacturable part
    - Use exact technical part names (e.g., "M8x1.25 Steel Hex Bolt" not just "Bolt")
    - Include specific materials where relevant (e.g., "6061-T6 Aluminum Frame Rail")
    - Specify critical dimensions or ratings where applicable (e.g., "2kW NEMA34 Stepper Motor")
    - Break down each major component into its physical subcomponents
    - Include mounting hardware and interfaces
    - Specify actual mechanical connections (bolts, welds, etc.)

    Physical Component Categories:
    Structural Elements:
    - Frame members with specific materials and dimensions
    - Mounting brackets with exact specifications
    - Support structures with load ratings
    - Housing components with material specs

    Motion Components:
    - Motors with power/torque ratings
    - Bearings with type and size
    - Rails with material and dimensions
    - Specific transmission components

    Mechanical Interfaces:
    - Exact fastener specifications
    - Specific connector types
    - Precise mounting hardware
    - Actual joint designs

    Control Hardware:
    - Specific sensor models
    - Actual controller boards
    - Real cable specifications
    - Physical interface components

    ${context}`;

    const userPrompt = `Generate a complete multi-level breakdown of all physical subcomponents for "${componentName}" ${ancestryString}.${existingChildrenString}
    Requirements:
    - List ONLY actual, physical, manufacturable parts
    - Include specific part numbers, materials, or dimensions where relevant
    - Break down each major component into its physical subcomponents
    - Show at least 2-3 levels of subcomponents where applicable
    - Include all mounting hardware and physical interfaces
    - Specify actual mechanical connections
    NO abstract concepts or functions - ONLY real, physical parts.`;

    try {
        const response = await model.invoke([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]);

        // Extract just the JSON part from the response
        const responseText = response.content as string;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const content = JSON.parse(jsonMatch[0]) as ComponentResponse;
        if (!content || typeof content !== 'object') {
            throw new Error('Invalid response format from LLM');
        }

        if (!Array.isArray(content.children) || content.children.length === 0) {
            throw new Error('Invalid response structure from LLM - no children found');
        }

        // Recursively map the nested structure to the Component type
        function mapToComponent(child: ComponentChild): Omit<Component, 'parent'> {
            return {
                name: child.name,
                children: child.children.map(c => ({
                    ...mapToComponent(c),
                    parent: null as unknown as Component // Will be set by the parent component
                }))
            };
        }

        return content.children.map(child => ({
            ...mapToComponent(child),
            parent: null as unknown as Component // Will be set by the parent component
        }));
    } catch (error) {
        console.error('Error in generateChildComponents:', error);
        throw error;
    }
}

export async function POST(request: NextRequest) {
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
