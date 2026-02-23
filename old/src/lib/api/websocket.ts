// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================
// Real-time communication for job status updates, notifications, and events

import { WebSocketEvent, JobStatusUpdateEvent, UploadProgressEvent } from './types';

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private isIntentionallyClosed = false;

  constructor(url: string = 'ws://localhost:3000/ws') {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isIntentionallyClosed = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Authenticate if token exists
          const token = localStorage.getItem('auth_token');
          if (token) {
            this.send({ type: 'auth', payload: { token } });
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketEvent = JSON.parse(event.data);
            this.handleEvent(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          
          if (!this.isIntentionallyClosed) {
            this.handleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  /**
   * Subscribe to specific event type
   */
  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: WebSocketEventHandler): () => void {
    return this.on('*', handler);
  }

  /**
   * Handle incoming event
   */
  private handleEvent(event: WebSocketEvent): void {
    // Call specific event handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }

    // Call wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(event));
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Subscribe to job status updates
   */
  onJobStatusUpdate(callback: (jobId: string, status: any) => void): () => void {
    return this.on('job_status_update', (event: WebSocketEvent) => {
      const payload = event.payload as JobStatusUpdateEvent['payload'];
      callback(payload.jobId, payload);
    });
  }

  /**
   * Subscribe to upload progress
   */
  onUploadProgress(callback: (uploadId: string, progress: number) => void): () => void {
    return this.on('upload_progress', (event: WebSocketEvent) => {
      const payload = event.payload as UploadProgressEvent['payload'];
      callback(payload.uploadId, payload.progress);
    });
  }

  /**
   * Subscribe to notifications
   */
  onNotification(callback: (notification: any) => void): () => void {
    return this.on('notification', (event: WebSocketEvent) => {
      callback(event.payload);
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();

// Auto-connect on module load (optional - you might want to control this manually)
// wsClient.connect().catch(console.error);
