import { openaiApi } from '../api/openai';

interface ComposeCaptionInput {
  platforms: string[];
  prompt: string;
}

interface PadGenerationInput {
  templateName: string;
  brief: string;
  context: string;
}

async function runTextGeneration(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openaiApi.createChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 700,
  });

  if (!response.success || !response.data?.choices?.[0]?.message?.content) {
    throw new Error(response.error?.message || 'Generation failed');
  }

  return response.data.choices[0].message.content.trim();
}

export async function generateComposeCaption(input: ComposeCaptionInput): Promise<string> {
  return runTextGeneration(
    'You write clear social media captions for entertainment brands. Keep the output concise, publishable, and easy to edit.',
    `Platforms: ${input.platforms.join(', ') || 'General social'}\n\nPrompt:\n${input.prompt}`,
  );
}

export async function generatePadOutput(input: PadGenerationInput): Promise<string> {
  return runTextGeneration(
    'You are Screndly PAD, a focused AI writing copilot for entertainment and social publishing workflows. Produce polished draft copy only.',
    `Template: ${input.templateName}\n\nBrief:\n${input.brief}\n\nAdditional context:\n${input.context}`,
  );
}
