import OpenAI from 'openai';
import { Machine } from '../types/machines';

const llm = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const PLACEHOLDER_IMAGE = '/machinecube.png';

const machineSchema = {
  name: "string",
  imageUrl: PLACEHOLDER_IMAGE,
  description: "string",
  components: [{
    name: "string",
    description: "string",
    imageUrl: PLACEHOLDER_IMAGE,
    requiredMachines: ["<recursive>"] // indicates this is a recursive reference to Machine[]
  }]
} as const;

export async function generateMachineData(machineName: string): Promise<Machine> {
  const systemPrompt = `You are a manufacturing expert. Output only valid JSON matching the following structure. Always use "${PLACEHOLDER_IMAGE}" for imageUrl fields:
  ${JSON.stringify(machineSchema, null, 2)}`;

  const userPrompt = `Generate detailed manufacturing information for: ${machineName}. Include realistic components and descriptions.`;

  const completion = await llm.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: "deepseek-r1-distill-llama-70b",
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No content received from LLM');
  return JSON.parse(content) as Machine;
} 
