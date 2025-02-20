import OpenAI from 'openai';
import { Machine, Component, MachineSchema } from '../../types/machines';

const llm = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function generateMachineData(machineName: string): Promise<Machine> {
  const systemPrompt = `You are a manufacturing expert. Output only valid JSON matching the following structure.
  Generate only the first level of components. Mark components that can be broken down further with hasChildren: true.
  Mark raw materials with type: "material" and hasChildren: false.
  ${JSON.stringify(MachineSchema, null, 2)}`;

  const userPrompt = `Generate first-level components for: ${machineName}`;

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
  return JSON.parse(content) as Machine;
}

export async function generateComponents(parentName: string, parentType: string): Promise<Component[]> {
  const systemPrompt = `You are a manufacturing expert. Generate subcomponents for a ${parentType} named "${parentName}".
  Output a JSON object with this exact structure:
  {
    "components": [
      {
        "name": "string",
        "type": "component" or "material",
        "hasChildren": boolean
      }
    ]
  }
  Mark raw materials with type: "material" and hasChildren: false.
  Mark components that can be broken down further with type: "component" and hasChildren: true.`;

  const userPrompt = `List the immediate subcomponents of ${parentName} as a JSON object containing a components array.`;

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
  return result.components || [];
} 
