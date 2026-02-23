/**
 * Centralized OpenAI Model Configuration
 * Single source of truth for all AI model selections across the app
 */

export interface AIModel {
  id: string;
  displayName: string;
  tier: 'flagship' | 'standard' | 'fast' | 'fastest' | 'legacy';
  description: string;
  contextWindow?: number;
  maxOutput?: number;
  reasoningTokens?: boolean;
}

/**
 * Complete registry of available OpenAI models
 * Used by all model selectors across the app
 */
export const AI_MODELS: AIModel[] = [
  // GPT-5 Series (Future-proofing)
  {
    id: 'gpt-5.2',
    displayName: 'GPT-5.2',
    tier: 'flagship',
    description: 'Best for coding, agentic workflows, complex reasoning',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5',
    displayName: 'GPT-5',
    tier: 'standard',
    description: 'Balanced general-purpose reasoning and generation',
  },
  {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    tier: 'fast',
    description: 'Faster, cheaper GPT-5 variant for well-defined tasks',
  },
  {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    tier: 'fastest',
    description: 'Fastest and cheapest GPT-5 variant for classification, summarization, short-form automation',
  },

  // GPT-4o Series (Current Flagship)
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    tier: 'standard',
    description: 'Recommended - Balanced performance and cost',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    tier: 'fast',
    description: 'Cost-efficient - Best value for most tasks',
  },

  // Flash 3 Series (Gemini)
  {
    id: 'flash-3',
    displayName: 'Flash 3',
    tier: 'fast',
    description: 'Gemini Flash 3 - Frontier intelligence, fast validation',
    contextWindow: 128000,
  },

  // GPT-4 Series (Legacy)
  {
    id: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    tier: 'legacy',
    description: 'Previous generation turbo model',
  },
  {
    id: 'gpt-4',
    displayName: 'GPT-4',
    tier: 'legacy',
    description: 'Original GPT-4 model',
  },

  // GPT-3.5 Series (Legacy)
  {
    id: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    tier: 'legacy',
    description: 'Oldest supported model',
  },
];

/**
 * Get model display name by ID
 */
export function getModelDisplayName(modelId: string): string {
  const model = AI_MODELS.find(m => m.id === modelId);
  return model?.displayName || modelId;
}

/**
 * Get model by ID
 */
export function getModel(modelId: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === modelId);
}

/**
 * Get tier badge text
 */
export function getTierBadge(tier: AIModel['tier']): string {
  const badges: Record<AIModel['tier'], string> = {
    flagship: 'Flagship',
    standard: 'Recommended',
    fast: 'Fast / Low Cost',
    fastest: 'Fastest / Cheapest',
    legacy: 'Legacy',
  };
  return badges[tier];
}

/**
 * Default models for each use case
 * DO NOT MODIFY - maintains backward compatibility
 */
export const DEFAULT_MODELS = {
  video: 'gpt-4o-mini',
  comment: 'gpt-4o-mini',
  tmdb: 'gpt-4o',
  rss: 'gpt-4o',
  designStudio: 'gpt-4o',
  videoStudio: 'gpt-4o',
} as const;
