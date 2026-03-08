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
 * Curated registry of models exposed in settings selectors.
 * Legacy models remain available for backward compatibility, but are no
 * longer used as defaults anywhere in the app.
 */
export const AI_MODELS: AIModel[] = [
  // GPT-5 Series
  {
    id: 'gpt-5.2',
    displayName: 'GPT-5.2',
    tier: 'flagship',
    description: 'Flagship quality for complex prompt generation and high-stakes creative tasks',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5.1',
    displayName: 'GPT-5.1',
    tier: 'flagship',
    description: 'High-end reasoning and generation for premium workflows',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5',
    displayName: 'GPT-5',
    tier: 'standard',
    description: 'Balanced flagship model for advanced generation and planning',
  },
  {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    tier: 'fast',
    description: 'Recommended default for captions, replies, and most automation tasks',
  },
  {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    tier: 'fastest',
    description: 'Fastest and cheapest GPT-5 variant for lightweight classification and short-form automation',
  },

  // GPT-4.1 Series
  {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    tier: 'standard',
    description: 'Strong non-reasoning model for precise generation and structured output',
  },
  {
    id: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    tier: 'fast',
    description: 'Fast, lower-cost GPT-4.1 variant for captions and comment replies',
  },
  {
    id: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    tier: 'fastest',
    description: 'Ultra-fast GPT-4.1 variant for simple filtering and short responses',
  },

  // GPT-4o Series
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    tier: 'legacy',
    description: 'Previous default all-round model, still useful for compatibility',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    tier: 'legacy',
    description: 'Legacy low-cost fallback model',
  },

  // Flash 3 Series (Gemini)
  {
    id: 'flash-3',
    displayName: 'Flash 3',
    tier: 'fast',
    description: 'Gemini Flash 3 - Frontier intelligence, fast validation',
    contextWindow: 128000,
  },
  {
    id: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    tier: 'legacy',
    description: 'Legacy GPT-4 option retained for older workflows',
  },
  {
    id: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    tier: 'legacy',
    description: 'Legacy low-cost option retained for backward compatibility',
  },

];

const LEGACY_MODEL_LABELS: Record<string, string> = {
  'gpt-4-turbo': 'GPT-4 Turbo (Legacy)',
  'gpt-4': 'GPT-4 (Legacy)',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo (Legacy)',
};

/**
 * Get model display name by ID
 */
export function getModelDisplayName(modelId: string): string {
  const model = AI_MODELS.find(m => m.id === modelId);
  return model?.displayName || LEGACY_MODEL_LABELS[modelId] || modelId;
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
  video: 'gpt-5-mini',
  comment: 'gpt-4.1-mini',
  tmdb: 'gpt-5-mini',
  rss: 'gpt-5-mini',
  designStudio: 'gpt-5-mini',
  videoStudio: 'gpt-4.1',
} as const;
