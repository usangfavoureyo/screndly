import { openaiApi } from '../api/openai';
import { DEFAULT_MODELS, normalizeAIModelId } from '../ai/models';

interface ComposeCaptionInput {
  platforms: string[];
  prompt: string;
}

interface PadGenerationInput {
  templateName: string;
  brief: string;
  context: string;
}

interface PadReplyInput {
  model: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  attachmentNames?: string[];
}

async function runTextGeneration(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openaiApi.createRoutedChatCompletion(
    {
      taskType: 'caption-generation',
      defaultFeature: 'pad',
    },
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 700,
    },
  );

  if (!response.success || !response.data?.data?.choices?.[0]?.message?.content) {
    throw new Error(response.error?.message || 'Generation failed');
  }

  return response.data.data.choices[0].message.content.trim();
}

export async function generateComposeCaption(input: ComposeCaptionInput): Promise<string> {
  return runTextGeneration(
    'You write clear social media captions for entertainment brands. Keep the output concise, publishable, and easy to edit.',
    `Platforms: ${input.platforms.join(', ') || 'General social'}\n\nPrompt:\n${input.prompt}`,
  );
}

export async function generatePadOutput(input: PadGenerationInput): Promise<string> {
  return runTextGeneration(
    'You are Screndly Post, a focused AI writing copilot for entertainment and social publishing workflows. Produce polished draft copy only.',
    `Template: ${input.templateName}\n\nBrief:\n${input.brief}\n\nAdditional context:\n${input.context}`,
  );
}

export async function generatePadReply(input: PadReplyInput): Promise<string> {
  const attachmentContext = input.attachmentNames?.length
    ? `\n\nAttached images:\n${input.attachmentNames.map((name) => `- ${name}`).join('\n')}`
    : '';

  const response = await openaiApi.createChatCompletion({
    model: normalizeAIModelId(input.model, DEFAULT_MODELS.pad),
    messages: [
      {
        role: 'system',
        content:
          input.systemPrompt ||
          'You are Screndly Post, a focused AI writing copilot for entertainment and social publishing workflows. Reply conversationally and stay on the user-defined chat context.',
      },
      ...input.history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      {
        role: 'user',
        content: `${input.message}${attachmentContext}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 900,
  });

  if (!response.success || !response.data?.choices?.[0]?.message?.content) {
    throw new Error(response.error?.message || 'Generation failed');
  }

  return response.data.choices[0].message.content.trim();
}
