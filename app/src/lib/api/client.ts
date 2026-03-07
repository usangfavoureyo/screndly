// ============================================================================
// API CLIENT - Base HTTP Client
// ============================================================================
// Centralized HTTP client with error handling, retries, and interceptors

import { ApiResponse, ApiError } from './types';
import { getAuthHeaders as getStandardAuthHeaders, getToken } from './authToken';

/**
 * Get API URL from environment variables with fallback
 */
import { getApiUrl } from './config';

const isProductionDebug =
  typeof window !== 'undefined' &&
  (window.localStorage.getItem('screndly_debug_api') === '1' ||
    window.location.search.includes('debugApi=1'));

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private backendAvailable: boolean;

  constructor(baseUrl?: string, timeout: number = 30000, retryAttempts: number = 3) {
    // Use provided baseUrl or get from environment
    this.baseUrl = baseUrl || getApiUrl();
    this.timeout = timeout;
    this.retryAttempts = retryAttempts;
    this.backendAvailable = !!this.baseUrl;
  }

  /**
   * Check if backend is available
   */
  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * Core request method with retry logic
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestInit,
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const { CLIENT_VERSION } = await import('./authToken');

      // Build request options
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Screndly-Version': CLIENT_VERSION,
          ...this.getAuthHeaders(),
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options,
      };

      if (isProductionDebug) {
        const authHeader = requestOptions.headers && (requestOptions.headers as any)['Authorization'];
        const authType = authHeader ? (authHeader.startsWith('Bearer') ? 'JWT' : 'SECRET') : 'NONE';
        const tokenPreview = authHeader && authHeader.length > 20 ? `${authHeader.substring(0, 15)}...` : 'N/A';
        console.warn(`[API v${CLIENT_VERSION}] ${method} ${url} | Auth: ${authType} | Token: ${tokenPreview}`);
      }

      // Make request
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        const error = await this.handleErrorResponse(response);

        // Retry on 5xx errors or network issues
        if (this.shouldRetry(method, error) && attempt < this.retryAttempts) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          return this.request<T>(method, endpoint, data, options, attempt + 1);
        }

        return { success: false, error };
      }

      // Parse successful response
      const result = await response.json();

      // Auto-unwrap if backend returns standard ApiResponse structure
      if (result && typeof result === 'object' && 'success' in result && ('data' in result || 'error' in result)) {
        return result as ApiResponse<T>;
      }

      return { success: true, data: result };

    } catch (error: any) {
      // Handle network errors
      const apiError: ApiError = {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network request failed',
        statusCode: 0,
      };

      // Retry on network errors
      if (this.shouldRetry(method, apiError) && attempt < this.retryAttempts) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.request<T>(method, endpoint, data, options, attempt + 1);
      }

      return { success: false, error: apiError };
    }
  }

  /**
   * Handle error responses from API
   */
  private async handleErrorResponse(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json();
      const nestedError = errorData?.error;
      return {
        code: errorData.code || nestedError?.code || 'API_ERROR',
        message: errorData.message || nestedError?.message || response.statusText,
        details: errorData.details || nestedError?.details,
        statusCode: response.status,
      };
    } catch {
      return {
        code: 'PARSE_ERROR',
        message: response.statusText || 'Failed to parse error response',
        statusCode: response.status,
      };
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return getStandardAuthHeaders();
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(method: string, error: ApiError): boolean {
    // Avoid retrying non-idempotent methods to prevent duplicate side effects
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      return false;
    }

    // Retry on 5xx errors or timeout
    return error.statusCode >= 500 || error.code === 'NETWORK_ERROR';
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile<T>(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append('mediaFile', file);

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);

            if (result && typeof result === 'object' && 'success' in result && ('data' in result || 'error' in result)) {
              resolve(result as ApiResponse<T>);
              return;
            }

            resolve({ success: true, data: result });
          } catch {
            resolve({
              success: false,
              error: {
                code: 'PARSE_ERROR',
                message: 'Failed to parse response',
                statusCode: xhr.status,
              },
            });
          }
        } else {
          resolve({
            success: false,
            error: {
              code: 'UPLOAD_ERROR',
              message: xhr.statusText || 'Upload failed',
              statusCode: xhr.status,
            },
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Upload failed',
            statusCode: 0,
          },
        });
      });

      xhr.open('POST', `${this.baseUrl}${endpoint}`);

      // Add auth header
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
