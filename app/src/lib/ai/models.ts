/**
 * Centralized AI model configuration, migration, and selector defaults.
 */

export const AI_MODEL_IDS = [
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'flash-3',
  'gpt-5.2',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
] as const;

export type AIModelId = typeof AI_MODEL_IDS[number];

export type AIModelTier = 'flagship' | 'standard' | 'fast' | 'fastest';

export interface AIModel {
  id: AIModelId;
  displayName: string;
  tier: AIModelTier;
  description: string;
  contextWindow?: number;
  maxOutput?: number;
  reasoningTokens?: boolean;
}

export type DefaultModelFeature =
  | 'video'
  | 'comment'
  | 'tmdb'
  | 'rss'
  | 'designStudio'
  | 'videoStudio'
  | 'pad';

export type ModelSelectionSource = 'manual' | 'router-default' | 'migrated';

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    tier: 'flagship',
    description: 'Highest-end GPT-5.4 model for the most demanding reasoning and generation work.',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    tier: 'fast',
    description: 'Stronger production model for nuanced generation and fallback arbitration.',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5.4-nano',
    displayName: 'GPT-5.4 Nano',
    tier: 'fastest',
    description: 'Lowest-cost GPT-5.4 model for high-volume classification, extraction, and captioning.',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'flash-3',
    displayName: 'Flash 3',
    tier: 'fast',
    description: 'Gemini Flash 3 provider path preserved for fast validation and alternate routing.',
    contextWindow: 128000,
  },
  {
    id: 'gpt-5.2',
    displayName: 'GPT-5.2',
    tier: 'flagship',
    description: 'Alternative stronger GPT-5-series model for premium workflows.',
    contextWindow: 400000,
    maxOutput: 128000,
    reasoningTokens: true,
  },
  {
    id: 'gpt-5',
    displayName: 'GPT-5',
    tier: 'standard',
    description: 'Balanced GPT-5 model for general generation and planning.',
  },
  {
    id: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    tier: 'fast',
    description: 'Smaller GPT-5 model for lower-cost general automation.',
  },
  {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    tier: 'fastest',
    description: 'Cheaper GPT-5-family option for lightweight tasks outside the 5.4 router defaults.',
  },
];

export const DEPRECATED_MODEL_MIGRATIONS: Record<string, AIModelId> = {
  'gpt-4': 'gpt-5.4-mini',
  'gpt-4.1': 'gpt-5.4-mini',
  'gpt-4.1-mini': 'gpt-5.4-mini',
  'gpt-4.1-nano': 'gpt-5.4-mini',
  'gpt-4o': 'gpt-5.4-mini',
  'gpt-4o-mini': 'gpt-5.4-mini',
  'gpt-4-turbo': 'gpt-5.4-mini',
  'gpt-3.5-turbo': 'gpt-5.4-nano',
  'gpt-5.1': 'gpt-5.4-mini',
};

const LEGACY_MODEL_LABELS: Record<string, string> = {
  'gpt-4': 'GPT-4 (Migrated)',
  'gpt-4.1': 'GPT-4.1 (Migrated)',
  'gpt-4.1-mini': 'GPT-4.1 Mini (Migrated)',
  'gpt-4.1-nano': 'GPT-4.1 Nano (Migrated)',
  'gpt-4o': 'GPT-4o (Migrated)',
  'gpt-4o-mini': 'GPT-4o Mini (Migrated)',
  'gpt-4-turbo': 'GPT-4 Turbo (Migrated)',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo (Migrated)',
  'gpt-5.1': 'GPT-5.1 (Migrated)',
};

const AI_MODEL_SET = new Set<string>(AI_MODEL_IDS);

export const DEFAULT_MODELS: Record<DefaultModelFeature, AIModelId> = {
  video: 'gpt-5.4-mini',
  comment: 'gpt-5.4-nano',
  tmdb: 'gpt-5.4-nano',
  rss: 'gpt-5.4-nano',
  designStudio: 'gpt-5.4-mini',
  videoStudio: 'gpt-5.4-mini',
  pad: 'gpt-5.4-nano',
};

export function isValidAIModelId(modelId: unknown): modelId is AIModelId {
  return typeof modelId === 'string' && AI_MODEL_SET.has(modelId);
}

export function migrateDeprecatedModelId(modelId: unknown): AIModelId | null {
  if (typeof modelId !== 'string' || !modelId.trim()) {
    return null;
  }

  if (isValidAIModelId(modelId)) {
    return modelId;
  }

  return DEPRECATED_MODEL_MIGRATIONS[modelId] || null;
}

export function normalizeAIModelId(
  modelId: unknown,
  fallback: AIModelId = DEFAULT_MODELS.video,
): AIModelId {
  return migrateDeprecatedModelId(modelId) || fallback;
}

export function getModelDisplayName(modelId: string): string {
  const model = AI_MODELS.find((entry) => entry.id === modelId);
  return model?.displayName || LEGACY_MODEL_LABELS[modelId] || modelId;
}

export function getModel(modelId: string): AIModel | undefined {
  return AI_MODELS.find((entry) => entry.id === modelId);
}

export function getTierBadge(tier: AIModelTier): string {
  const badges: Record<AIModelTier, string> = {
    flagship: 'Flagship',
    standard: 'Recommended',
    fast: 'Fast / Low Cost',
    fastest: 'Fastest / Cheapest',
  };
  return badges[tier];
}

export function getDefaultModelForFeature(feature: DefaultModelFeature): AIModelId {
  return DEFAULT_MODELS[feature];
}

export function resolveSelectedModel(
  selectedModel: unknown,
  fallbackFeature: DefaultModelFeature,
): { modelId: AIModelId; source: ModelSelectionSource } {
  const fallback = getDefaultModelForFeature(fallbackFeature);

  if (isValidAIModelId(selectedModel)) {
    return {
      modelId: selectedModel,
      source: 'manual',
    };
  }

  const migrated = migrateDeprecatedModelId(selectedModel);
  if (migrated) {
    return {
      modelId: migrated,
      source: 'migrated',
    };
  }

  return {
    modelId: fallback,
    source: 'router-default',
  };
}

export function normalizeModelSettingRecord<
  T extends Record<string, any>,
>(
  record: T,
  modelKeys: Partial<Record<keyof T, DefaultModelFeature>>,
): T {
  const nextRecord = { ...record };

  for (const [key, feature] of Object.entries(modelKeys) as Array<[keyof T, DefaultModelFeature]>) {
    nextRecord[key] = normalizeAIModelId(nextRecord[key], getDefaultModelForFeature(feature));
  }

  return nextRecord;
}
