// ============================================================================
// OPENAI API SERVICE
// ============================================================================
// Handles all OpenAI API interactions for LLM operations

import { apiClient } from './client';
import { OpenAICompletionRequest, OpenAICompletionResponse, ApiResponse } from './types';
import {
  AIRouterMetadata,
  AIRouterRequest,
  attachUsageToMetadata,
  createRouterMetadata,
  resolveAIRouterDecision,
} from '../ai/router';
import { DEFAULT_MODELS } from '../ai/models';

export interface RoutedOpenAIResult<T> {
  data: T;
  metadata: AIRouterMetadata;
}

export class OpenAIApi {
  /**
   * Generate chat completion
   */
  async createChatCompletion(
    request: OpenAICompletionRequest
  ): Promise<ApiResponse<OpenAICompletionResponse>> {
    return apiClient.post<OpenAICompletionResponse>('/openai/chat/completions', request);
  }

  async createRoutedChatCompletion(
    routerRequest: AIRouterRequest,
    request: Omit<OpenAICompletionRequest, 'model'>,
  ): Promise<ApiResponse<RoutedOpenAIResult<OpenAICompletionResponse>>> {
    const decision = resolveAIRouterDecision(routerRequest);
    const response = await this.createChatCompletion({
      ...request,
      model: decision.modelUsed,
    });

    if (!response.success || !response.data) {
      console.error('[AIRouter] request failed', {
        taskType: decision.taskType,
        modelUsed: decision.modelUsed,
        escalated: decision.escalated,
        reason: response.error?.message || 'unknown failure',
      });
      return response as unknown as ApiResponse<RoutedOpenAIResult<OpenAICompletionResponse>>;
    }

    const metadata = attachUsageToMetadata(createRouterMetadata(decision), response.data.usage);
    console.log('[AIRouter] request complete', metadata);

    return {
      success: true,
      data: {
        data: response.data,
        metadata,
      },
    };
  }

  /**
   * Generate Visla prompt from Video Studio job JSON
   */
  async generateVislaPrompt(
    jobData: any,
    model: string = DEFAULT_MODELS.videoStudio,
    temperature: number = 0,
    systemPrompt?: string
  ): Promise<ApiResponse<{ visla_prompt_text: string; validation: any }>> {
    const request: OpenAICompletionRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: systemPrompt || `You are an editor-prompt generator. Input: validated job JSON (segments, timestamps, audio_rules, caption_template, aspect). Output: (1) a Visla natural-language prompt that contains exact timestamps, audio ducking rules, caption template reference, and aspect directives; (2) a JSON validation summary with keys: segments_count, missing_fields, warnings. Strictly produce the Visla prompt in the field "visla_prompt_text" and do not add extra commentary. Follow the structured output schema exactly.`,
        },
        {
          role: 'user',
          content: JSON.stringify(jobData),
        },
      ],
      temperature,
      top_p: 0.95,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    const response = await this.createChatCompletion(request);
    
    if (response.success && response.data) {
      try {
        const parsedContent = JSON.parse(response.data.choices[0].message.content);
        return {
          success: true,
          data: parsedContent,
        };
      } catch {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse LLM response',
            statusCode: 500,
          },
        };
      }
    }

    return response as any;
  }

  /**
   * Generate comment reply using AI
   */
  async generateCommentReply(
    commentText: string,
    videoContext: string,
    tone: 'professional' | 'casual' | 'enthusiastic' = 'professional'
  ): Promise<ApiResponse<string>> {
    const response = await this.createRoutedChatCompletion(
      {
        taskType: 'comment-automation',
        defaultFeature: 'comment',
      },
      {
        messages: [
          {
            role: 'system',
            content: `You are a social media manager for Screen Render, responding to YouTube comments. Be ${tone}, helpful, and engaging. Keep responses under 200 characters.`,
          },
          {
            role: 'user',
            content: `Video context: ${videoContext}\n\nComment: ${commentText}\n\nGenerate a reply:`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
    );
    
    if (response.success && response.data) {
      return {
        success: true,
        data: response.data.data.choices[0].message.content,
      };
    }

    return response as any;
  }

  /**
   * Validate timestamps in generated prompt
   */
  validateTimestamps(jobData: any, generatedPrompt: string): {
    valid: boolean;
    mismatches: string[];
  } {
    const segments = jobData.segments || [];
    const mismatches: string[] = [];

    segments.forEach((segment: any) => {
      const startTime = segment.startTime;
      const endTime = segment.endTime;
      
      // Check if timestamps exist in prompt
      const startExists = generatedPrompt.includes(String(startTime));
      const endExists = generatedPrompt.includes(String(endTime));
      
      if (!startExists) {
        mismatches.push(`Start time ${startTime}s not found in prompt`);
      }
      if (!endExists) {
        mismatches.push(`End time ${endTime}s not found in prompt`);
      }
    });

    return {
      valid: mismatches.length === 0,
      mismatches,
    };
  }

  /**
   * Retry prompt generation with validation
   */
  async generateVislaPromptWithRetry(
    jobData: any,
    model: string = DEFAULT_MODELS.videoStudio,
    maxRetries: number = 1
  ): Promise<ApiResponse<{ visla_prompt_text: string; validation: any }>> {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      const response = await this.generateVislaPrompt(jobData, model, 0);
      
      if (response.success && response.data) {
        // Validate timestamps
        const validation = this.validateTimestamps(jobData, response.data.visla_prompt_text);
        
        if (validation.valid) {
          return {
            success: true,
            data: {
              ...response.data,
              validation: { ...validation, attempt },
            },
          };
        }
        
        // If invalid and retries available, try again
        if (attempt < maxRetries) {
          console.warn(`Timestamp validation failed on attempt ${attempt + 1}, retrying...`);
        } else {
          return {
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Timestamp validation failed after retries',
              details: validation.mismatches,
              statusCode: 422,
            },
          };
        }
      } else {
        return response;
      }
      
      attempt++;
    }

    return {
      success: false,
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        message: 'Failed to generate valid prompt',
        statusCode: 500,
      },
    };
  }
}

export const openaiApi = new OpenAIApi();
