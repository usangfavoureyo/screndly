// ============================================================================
// API EXPORTS
// ============================================================================
// Central export point for all API services

// Core client
export { apiClient, ApiClient } from './client';

// API services
export { youtubeApi, YouTubeApi } from './youtube';
export { openaiApi, OpenAIApi } from './openai';
export { shotstackApi, ShotstackApi } from './shotstack';
export { tmdbApi, TMDbApi } from './tmdb';

// WebSocket client
export { wsClient, WebSocketClient } from './websocket';
export type { WebSocketEventHandler } from './websocket';

// Type definitions
export * from './types';
