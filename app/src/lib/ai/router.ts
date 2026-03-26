import {
  AIModelId,
  DefaultModelFeature,
  normalizeAIModelId,
  resolveSelectedModel,
} from './models';

export type AIRouterTaskType =
  | 'caption-generation'
  | 'summary-generation'
  | 'classification'
  | 'metadata-extraction'
  | 'movie-tv-detection'
  | 'youtube-validation'
  | 'rss-entity-extraction'
  | 'image-ranking'
  | 'validator'
  | 'comment-automation'
  | 'editorial-rewrite'
  | 'low-confidence-arbitration'
  | 'complex-disambiguation';

export interface AIRouterMetadata {
  modelUsed: AIModelId;
  taskType: AIRouterTaskType;
  confidence: number | null;
  escalated: boolean;
  escalationReason: string | null;
  retryCount: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIRouterDecision extends AIRouterMetadata {
  primaryModel: AIModelId;
  fallbackModel: AIModelId;
  threshold: number;
  manualOverride: boolean;
}

export interface AIRouterRequest {
  taskType: AIRouterTaskType;
  manualModelOverride?: string | null;
  defaultFeature?: DefaultModelFeature;
  primaryModel?: AIModelId;
  fallbackModel?: AIModelId;
  confidenceThreshold?: number;
  retryCount?: number;
  confidence?: number | null;
  escalationReason?: string | null;
}

const NANO_MODEL: AIModelId = 'gpt-5.4-nano';
const MINI_MODEL: AIModelId = 'gpt-5.4-mini';

const TASK_THRESHOLDS: Record<AIRouterTaskType, number> = {
  'caption-generation': 0.75,
  'summary-generation': 0.75,
  classification: 0.75,
  'metadata-extraction': 0.75,
  'movie-tv-detection': 0.75,
  'youtube-validation': 0.8,
  'rss-entity-extraction': 0.75,
  'image-ranking': 0.7,
  validator: 0.8,
  'comment-automation': 0.75,
  'editorial-rewrite': 1,
  'low-confidence-arbitration': 0.75,
  'complex-disambiguation': 1,
};

const MINI_FIRST_TASKS = new Set<AIRouterTaskType>([
  'editorial-rewrite',
  'low-confidence-arbitration',
  'complex-disambiguation',
]);

function logRouting(message: string, payload: unknown) {
  console.log(`[AIRouter] ${message}`, payload);
}

export function getDefaultThreshold(taskType: AIRouterTaskType): number {
  return TASK_THRESHOLDS[taskType];
}

export function createRouterMetadata(decision: AIRouterDecision): AIRouterMetadata {
  return {
    modelUsed: decision.modelUsed,
    taskType: decision.taskType,
    confidence: decision.confidence,
    escalated: decision.escalated,
    escalationReason: decision.escalationReason,
    retryCount: decision.retryCount,
    usage: decision.usage,
  };
}

export function shouldEscalateToFallback(
  taskType: AIRouterTaskType,
  confidence: number | null | undefined,
  threshold = getDefaultThreshold(taskType),
): boolean {
  if (MINI_FIRST_TASKS.has(taskType)) {
    return false;
  }

  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return false;
  }

  return confidence < threshold;
}

export function resolveAIRouterDecision(request: AIRouterRequest): AIRouterDecision {
  const taskType = request.taskType;
  const threshold = request.confidenceThreshold ?? getDefaultThreshold(taskType);
  const primaryModel = request.primaryModel ?? (MINI_FIRST_TASKS.has(taskType) ? MINI_MODEL : NANO_MODEL);
  const fallbackModel = request.fallbackModel ?? MINI_MODEL;
  const manual = request.manualModelOverride ? resolveSelectedModel(request.manualModelOverride, request.defaultFeature ?? 'video') : null;

  if (manual && manual.source === 'manual') {
    const decision: AIRouterDecision = {
      modelUsed: manual.modelId,
      primaryModel,
      fallbackModel,
      threshold,
      taskType,
      confidence: request.confidence ?? null,
      escalated: false,
      escalationReason: null,
      retryCount: request.retryCount ?? 0,
      manualOverride: true,
    };
    logRouting('manual override selected', decision);
    return decision;
  }

  if (MINI_FIRST_TASKS.has(taskType)) {
    const decision: AIRouterDecision = {
      modelUsed: fallbackModel,
      primaryModel,
      fallbackModel,
      threshold,
      taskType,
      confidence: request.confidence ?? null,
      escalated: false,
      escalationReason: request.escalationReason ?? null,
      retryCount: request.retryCount ?? 0,
      manualOverride: false,
    };
    logRouting('mini-first task selected', decision);
    return decision;
  }

  const escalated = shouldEscalateToFallback(taskType, request.confidence, threshold);
  const decision: AIRouterDecision = {
    modelUsed: escalated ? fallbackModel : normalizeAIModelId(primaryModel, NANO_MODEL),
    primaryModel: normalizeAIModelId(primaryModel, NANO_MODEL),
    fallbackModel: normalizeAIModelId(fallbackModel, MINI_MODEL),
    threshold,
    taskType,
    confidence: request.confidence ?? null,
    escalated,
    escalationReason: escalated ? request.escalationReason ?? 'confidence below threshold' : null,
    retryCount: request.retryCount ?? 0,
    manualOverride: false,
  };

  logRouting(escalated ? 'fallback escalation triggered' : 'primary model selected', decision);
  return decision;
}

export function attachUsageToMetadata(
  metadata: AIRouterMetadata,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): AIRouterMetadata {
  if (!usage) {
    return metadata;
  }

  return {
    ...metadata,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
  };
}
