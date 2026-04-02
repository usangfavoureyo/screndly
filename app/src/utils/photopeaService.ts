/**
 * Photopea Service
 * Manages Photopea iframe communication and script execution
 */

import { DesignData } from '../components/EditDesignBottomSheet';
import { generateRenderScript, generateLayerAnalysisScript } from './photopeaScriptGenerator';

class PhotopeaService {
  private iframe: HTMLIFrameElement | null = null;
  private messageQueue: Array<{
    script?: string;
    binary?: ArrayBuffer;
    resolve: (value: string | null) => void;
    reject: (reason?: unknown) => void;
    payload?: unknown;
  }> = [];
  private isReady = false;
  private messageListenerAttached = false;

  /**
   * Initialize Photopea iframe (hidden)
   */
  async initialize(): Promise<void> {
    if (this.iframe) return;

    return new Promise((resolve, reject) => {
      try {
        // Create hidden iframe
        this.iframe = document.createElement('iframe');
        this.iframe.style.display = 'none';
        this.iframe.style.position = 'fixed';
        this.iframe.style.top = '-9999px';
        this.iframe.style.left = '-9999px';
        this.iframe.style.width = '1px';
        this.iframe.style.height = '1px';

        // Load Photopea
        // In production, use: https://www.photopea.com
        // For development with scripts: https://www.photopea.com#%7B%22files%22:%5B%5D%7D
        this.iframe.src = 'https://www.photopea.com/#';

        // Handle iframe load errors
        this.iframe.onerror = () => {
          console.error('[Photopea] Failed to load iframe');
          this.cleanup();
          reject(new Error('Failed to load Photopea. Please check your internet connection.'));
        };

        document.body.appendChild(this.iframe);

        const timeout = window.setTimeout(() => {
          window.removeEventListener('message', onReadyMessage);
          this.cleanup();
          reject(new Error('Photopea initialization timed out. Please try again.'));
        }, 30000);

        const onReadyMessage = (event: MessageEvent) => {
          if (event.source !== this.iframe?.contentWindow) return;
          if (event.data === 'done') {
            window.clearTimeout(timeout);
            window.removeEventListener('message', onReadyMessage);
            this.isReady = true;
            this.setupMessageListener();
            console.log('[Photopea] Initialized successfully');
            resolve();
          }
        };

        window.addEventListener('message', onReadyMessage);

      } catch (error) {
        this.cleanup();
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error(`Photopea initialization failed: ${errorMsg}`));
      }
    });
  }

  /**
   * Cleanup Photopea iframe
   */
  private cleanup(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.isReady = false;
    this.messageQueue = [];
    this.messageListenerAttached = false;
  }

  /**
   * Setup message listener for Photopea responses
   */
  private setupMessageListener(): void {
    if (this.messageListenerAttached) return;
    this.messageListenerAttached = true;

    window.addEventListener('message', (e) => {
      // Only process messages from Photopea
      if (e.source !== this.iframe?.contentWindow) return;

      // Process message queue
      if (this.messageQueue.length > 0) {
        const current = this.messageQueue[0];
        const message = e.data;

        if (message === 'done') {
          const payload = current.payload;
          current.payload = undefined;
          const normalized = this.normalizePayload(payload);
          current.resolve(normalized);
          this.messageQueue.shift();

          // Process next message in queue
          if (this.messageQueue.length > 0) {
            this.executeNextInQueue();
          }
        } else if (message && typeof message === 'object' && 'error' in message && typeof (message as { error?: unknown }).error === 'string') {
          const errorMessage = (message as { error: string }).error;
          current.reject(new Error(errorMessage));
          this.messageQueue.shift();

          // Process next message in queue
          if (this.messageQueue.length > 0) {
            this.executeNextInQueue();
          }
        } else if (message !== undefined && message !== null) {
          current.payload = message;
        }
      }
    });
  }

  private normalizePayload(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload instanceof ArrayBuffer) {
      const bytes = new Uint8Array(payload);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    if (payload instanceof Uint8Array) {
      let binary = '';
      for (let i = 0; i < payload.length; i++) {
        binary += String.fromCharCode(payload[i]);
      }
      return btoa(binary);
    }

    return null;
  }

  /**
   * Execute next script in queue
   */
  private executeNextInQueue(): void {
    if (this.messageQueue.length === 0) return;

    const current = this.messageQueue[0];

    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage(current.binary ?? current.script ?? '', '*');
    }
  }

  /**
   * Execute Photopea script
   */
  async executeScript(script: string): Promise<string | null> {
    if (!this.isReady || !this.iframe) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({ script, resolve, reject, payload: undefined });

      // If this is the only item in queue, execute immediately
      if (this.messageQueue.length === 1) {
        this.executeNextInQueue();
      }
    });
  }

  async executeBinary(binary: ArrayBuffer): Promise<string | null> {
    if (!this.isReady || !this.iframe) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({ binary, resolve, reject, payload: undefined });

      // If this is the only item in queue, execute immediately
      if (this.messageQueue.length === 1) {
        this.executeNextInQueue();
      }
    });
  }

  /**
   * Load PSD file into Photopea
   */
  async loadPSD(file: File): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;

        try {
          await this.executeBinary(arrayBuffer);
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read PSD file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Load PSD from URL
   */
  async loadPSDFromURL(url: string): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    const script = `
      app.open("${url}");
    `;

    await this.executeScript(script);
  }

  /**
   * Analyze PSD layer structure
   */
  async analyzeLayers(): Promise<{
    width: number;
    height: number;
    layers: any[];
    detectedLayers: {
      hasHeader: boolean;
      hasSubtext: boolean;
      hasOverlay: boolean;
      hasBackground: boolean;
    };
  }> {
    const script = generateLayerAnalysisScript();
    const result = await this.executeScript(script);

    if (!result) {
      throw new Error('Failed to analyze layers');
    }

    return JSON.parse(result);
  }

  /**
   * Render design from DesignData
   */
  async renderDesign(
    data: DesignData,
    templateData: {
      width: number;
      height: number;
      hasSubtext: boolean;
      hasOverlay: boolean;
    }
  ): Promise<Blob> {
    // Generate and execute render script
    const script = generateRenderScript(data, templateData);
    await this.executeScript(script);

    // Export as JPEG
    const exportScript = `
      app.activeDocument.saveToOE("jpg");
    `;

    const base64Result = await this.executeScript(exportScript);

    if (!base64Result) {
      throw new Error('Failed to export image');
    }

    // Convert base64 to Blob
    const binaryString = atob(base64Result);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/jpeg' });
  }

  /**
   * Get document preview as base64
   */
  async getPreview(): Promise<string> {
    const script = `
      // Flatten copy
      var originalDoc = app.activeDocument;
      var tempDoc = originalDoc.duplicate();
      app.activeDocument = tempDoc;
      tempDoc.flatten();

      tempDoc.saveToOE("png");
      tempDoc.close(SaveOptions.DONOTSAVECHANGES);

      app.activeDocument = originalDoc;
    `;

    const result = await this.executeScript(script);
    return result ? `data:image/png;base64,${result}` : '';
  }

  /**
   * Close current document
   */
  async closeDocument(): Promise<void> {
    const script = `
      if (app.documents.length > 0) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    `;

    await this.executeScript(script);
  }

  /**
   * Cleanup and destroy iframe
   */
  destroy(): void {
    if (this.iframe) {
      document.body.removeChild(this.iframe);
      this.iframe = null;
      this.isReady = false;
      this.messageQueue = [];
    }
  }
}

// Singleton instance
let photopeaInstance: PhotopeaService | null = null;

/**
 * Get or create Photopea service instance
 */
export function getPhotopeaService(): PhotopeaService {
  if (!photopeaInstance) {
    photopeaInstance = new PhotopeaService();
  }
  return photopeaInstance;
}

/**
 * Destroy Photopea service instance
 */
export function destroyPhotopeaService(): void {
  if (photopeaInstance) {
    photopeaInstance.destroy();
    photopeaInstance = null;
  }
}

export default PhotopeaService;
