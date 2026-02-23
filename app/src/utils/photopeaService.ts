/**
 * Photopea Service
 * Manages Photopea iframe communication and script execution
 */

import { DesignData } from '../components/EditDesignBottomSheet';
import { generateRenderScript, generateLayerAnalysisScript } from './photopeaScriptGenerator';

interface PhotopeaMessage {
  done?: boolean;
  result?: string;
  error?: string;
}

class PhotopeaService {
  private iframe: HTMLIFrameElement | null = null;
  private messageQueue: Array<{ script: string; resolve: Function; reject: Function }> = [];
  private isReady = false;

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
        this.iframe.src = 'https://www.photopea.com';

        // Handle iframe load errors
        this.iframe.onerror = () => {
          console.error('[Photopea] Failed to load iframe');
          this.cleanup();
          reject(new Error('Failed to load Photopea. Please check your internet connection.'));
        };

        document.body.appendChild(this.iframe);

        // Wait for Photopea to load
        let checkCount = 0;
        const maxChecks = 20; // 20 seconds max
        const checkReady = setInterval(() => {
          checkCount++;

          if (checkCount >= maxChecks) {
            clearInterval(checkReady);
            this.cleanup();
            reject(new Error('Photopea initialization timed out. Please try again.'));
            return;
          }

          try {
            if (this.iframe?.contentWindow) {
              this.isReady = true;
              clearInterval(checkReady);
              this.setupMessageListener();
              console.log('[Photopea] Initialized successfully');
              resolve();
            }
          } catch (_e) {
            // Cross-origin check failed, continue waiting
            // This is expected during initialization
          }
        }, 1000);

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
  }

  /**
   * Setup message listener for Photopea responses
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (e) => {
      // Only process messages from Photopea
      if (e.source !== this.iframe?.contentWindow) return;

      const message: PhotopeaMessage = e.data;

      // Process message queue
      if (this.messageQueue.length > 0) {
        const current = this.messageQueue[0];

        if (message.done) {
          current.resolve(message.result || null);
          this.messageQueue.shift();

          // Process next message in queue
          if (this.messageQueue.length > 0) {
            this.executeNextInQueue();
          }
        } else if (message.error) {
          current.reject(new Error(message.error));
          this.messageQueue.shift();

          // Process next message in queue
          if (this.messageQueue.length > 0) {
            this.executeNextInQueue();
          }
        }
      }
    });
  }

  /**
   * Execute next script in queue
   */
  private executeNextInQueue(): void {
    if (this.messageQueue.length === 0) return;

    const { script } = this.messageQueue[0];

    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage(script, '*');
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
      this.messageQueue.push({ script, resolve, reject });

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
        const uint8Array = new Array.from(new Uint8Array(arrayBuffer));

        // Send file data to Photopea
        const script = `
          var arr = [${uint8Array.join(',')}];
          var file = new File(arr, "template.psd");
          app.open(file);
        `;

        try {
          await this.executeScript(script);
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
      var jpegOptions = new JPEGSaveOptions();
      jpegOptions.quality = 12;
      jpegOptions.embedColorProfile = true;
      
      var tempFile = new File(Folder.temp + "/screndly-output.jpg");
      app.activeDocument.saveAs(tempFile, jpegOptions, true);
      
      // Read file as base64
      tempFile.encoding = "BINARY";
      tempFile.open("r");
      var content = tempFile.read();
      tempFile.close();
      
      btoa(content);
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
      
      // Export as PNG to temp
      var pngOptions = new PNGSaveOptions();
      var tempFile = new File(Folder.temp + "/preview.png");
      tempDoc.saveAs(tempFile, pngOptions, true);
      tempDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      app.activeDocument = originalDoc;
      
      // Read as base64
      tempFile.encoding = "BINARY";
      tempFile.open("r");
      var content = tempFile.read();
      tempFile.close();
      
      "data:image/png;base64," + btoa(content);
    `;

    const result = await this.executeScript(script);
    return result || '';
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