import OpenAI from 'openai';
import { Component } from '../../types/machines';

function createLLMClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in environment variables');
  }

  return new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey,
  });
}

export async function generateChildComponents(componentName: string, ancestry: string[], existingChildren: Component[] = []): Promise<Omit<Component, 'parent'>[]> {
  const llm = createLLMClient();

  const systemPrompt = `You are a manufacturing and engineering expert specializing in bill of materials (BOM) and physical component breakdowns.
  Output only valid JSON matching the following structure:
  {
    "children": [
      {
        "name": "string (first physical subcomponent)",
        "children": []
      },
      {
        "name": "string (second physical subcomponent)",
        "children": []
      }
    ]
  }

  Important guidelines:
  - Focus ONLY on physical, tangible components or stock materials that would appear in a bill of materials
  - Each component should be a real, manufacturable part, assembly, or stock material
  - Use proper engineering/manufacturing terminology
  - Consider standard part hierarchies (assembly → subassembly → component → part → stock material)
  - Name components as they would appear in technical documentation
  - Avoid abstract concepts, functions, or features
  - Consider manufacturing processes and assembly requirements
  - Ensure new components complement existing ones and maintain logical assembly relationships
  - Avoid duplicating existing components or their close variants

  ${ancestry.length === 0
      ? 'This is the root component. Generate two major physical subassemblies or critical components that would be at the top level of a BOM.'
      : 'Consider the full component hierarchy when determining the appropriate level of subcomponents.'}`;

  const existingChildrenString = existingChildren.length > 0
    ? `\nExisting children components: ${existingChildren.map(c => `"${c.name}"`).join(", ")}`
    : '';

  const ancestryString = ancestry.length > 0
    ? `considering its position in the assembly hierarchy: ${ancestry.join(" → ")}`
    : '';

  const userPrompt = `Generate exactly two physical subcomponents or parts that would be direct children in a bill of materials for "${componentName}" ${ancestryString}.${existingChildrenString}
  These should be real, tangible parts that could be manufactured or sourced, and should logically complement any existing components while avoiding duplication.`;

  try {
    const completion = await llm.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "gemma2-9b-it",
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No content received from LLM');

    const result = JSON.parse(content);
    if (!Array.isArray(result.children) || result.children.length !== 2) {
      throw new Error('Invalid response structure from LLM');
    }

    // Create the child components without parent references
    return result.children.map((child: { name: string }) => ({
      name: child.name,
      children: []
    }));
  } catch (error) {
    console.error('Error in generateChildComponents:', error);
    throw error;
  }
} 
