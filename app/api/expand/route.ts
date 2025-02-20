import { NextResponse, NextRequest } from 'next/server';
import { ChatGroq } from "@langchain/groq";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";
import { Component } from '../../types/machines';

export const runtime = 'edge';

interface ExpandRequest {
    componentName: string;
    ancestry: string[];
}

interface ComponentChild {
    name: string;
    children: never[];
}

interface ComponentResponse {
    children: ComponentChild[];
}

async function generateChildComponents(componentName: string, ancestry: string[], existingChildren: Component[] = []): Promise<Omit<Component, 'parent'>[]> {
    const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY || '',
        model: "gemma2-9b-it",
        temperature: 0.7,
    });

    const parser = new JsonOutputFunctionsParser<ComponentResponse>();

    const context = ancestry.length === 0
        ? 'This is the root component. Generate two major physical subcomponents that would be the primary constituents at this scale.'
        : 'Consider the full physical hierarchy and current scale when determining appropriate subcomponents.';

    const existingChildrenString = existingChildren.length > 0
        ? `\nExisting children components: ${existingChildren.map(c => `"${c.name}"`).join(", ")}`
        : '';

    const ancestryString = ancestry.length > 0
        ? `considering its position in the physical hierarchy: ${ancestry.join(" → ")}`
        : '';

    const systemPrompt = `You are a universal decomposition expert, specializing in physical, engineering, biological, and chemical breakdowns of matter and systems.
    Output only valid JSON matching the following structure:
    {
        "children": [
        {
            "name": "string (first subcomponent)",
            "children": []
        },
        {
            "name": "string (second subcomponent)",
            "children": []
        }
        ]
    }

    Important guidelines:
    - Focus ONLY on concrete, physical components and structures - avoid abstract concepts
    - Break down components based on real, observable physical relationships
    - For engineered objects: focus on manufacturable parts, assemblies, and materials
    - For biological systems: focus on anatomical structures, tissues, cells, and biomolecules
    - For chemical systems: focus on compounds, molecules, and atomic structures
    - For materials: focus on crystal structures, grain boundaries, and atomic arrangements
    - Use precise technical terminology from engineering, biology, chemistry, and materials science
    - Name components as they would appear in technical documentation or scientific literature
    - Consider real-world manufacturing processes, biological processes, and chemical bonds
    - Maintain physically accurate relationships between parent and child components
    - Avoid duplicating existing components

    Scale transition guidelines:
    Engineering scale:
    - Large scale: Major assemblies and systems (e.g., Aircraft → Fuselage, Engine)
    - Medium scale: Components and subassemblies (e.g., Engine → Combustion Chamber, Turbine)
    - Small scale: Individual parts and materials (e.g., Turbine Blade → Nickel Superalloy Matrix)

    Biological scale:
    - Organism scale: Major organ systems (e.g., Human → Circulatory System, Nervous System)
    - Organ scale: Tissues and structures (e.g., Heart → Myocardium, Heart Valves)
    - Cellular scale: Cell components (e.g., Cell → Mitochondria, Nucleus)
    - Molecular scale: Biomolecules (e.g., Protein → Amino Acid Chains)

    Chemical/Material scale:
    - Bulk material: Crystal structures and phases (e.g., Steel → Ferrite, Cementite)
    - Molecular structure: Chemical compounds (e.g., Water → H2O Molecules)
    - Atomic structure: Elements and bonds (e.g., NaCl Crystal → Na+ Ion, Cl- Ion)
    - Subatomic scale: Nuclear components (e.g., Atomic Nucleus → Protons, Neutrons)

    ${context}`;

    const userPrompt = `Generate exactly two physical subcomponents that would be direct constituents of "${componentName}" ${ancestryString}.${existingChildrenString}
    Consider the appropriate scale level and break it down into its most logical physical subcomponents at that scale.
    These should be real, tangible components that can be observed or measured, and should logically complement any existing components while avoiding duplication.
    Focus on concrete physical structures, avoiding any abstract concepts or functions.`;

    try {
        const response = await model.invoke([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], {
            response_format: { type: "json_object" }
        });

        const content = response.content;
        if (typeof content !== 'string') {
            throw new Error('Invalid response format from LLM');
        }

        const result = await parser.parse(content);
        if (!Array.isArray(result.children) || result.children.length !== 2) {
            throw new Error('Invalid response structure from LLM');
        }

        return result.children.map((child: ComponentChild) => ({
            name: child.name,
            children: []
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
