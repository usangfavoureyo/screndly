/**
 * Resumable Upload/Download Manager for Screndly
 * 
 * Handles chunked uploads/downloads with automatic resume on:
 * - Network failures
 * - App closure/restart
 * - Browser crashes
 * 
 * Supports Backblaze B2 Large File API for multi-part uploads
 */

interface TransferState {
  id: string;
  type: 'upload' | 'download';
  fileName: string;
  fileSize: number;
  chunks: ChunkState[];
  totalChunks: number;
  bytesTransferred: number;
  status: 'pending' | 'in-progress' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
  section?: 'review' | 'releases' | 'scenes'; // Which Video Studio section
}

interface ChunkState {
  index: number;
  start: number;
  end: number;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  etag?: string; // For Backblaze multipart uploads
  sha1?: string; // Backblaze requires SHA1 for parts
  retries: number;
}

interface ResumableUploadOptions {
  file: File;
  fileName?: string;
  chunkSize?: number; // Default: 10MB
  metadata?: Record<string, any>;
  section?: 'review' | 'releases' | 'scenes';
  onProgress?: (progress: number, bytesTransferred: number, totalBytes: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onComplete?: (url: string, fileId: string) => void;
  onError?: (error: string) => void;
}

interface ResumableDownloadOptions {
  url: string;
  fileName: string;
  fileSize?: number;
  chunkSize?: number; // Default: 5MB
  section?: 'review' | 'releases' | 'scenes';
  onProgress?: (progress: number, bytesTransferred: number, totalBytes: number) => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: string) => void;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (Backblaze minimum is 5MB except last part)
const DOWNLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB for downloads
const MAX_RETRIES = 3;
const STORAGE_KEY = 'screndly_transfer_states';

/**
 * Get all transfer states from localStorage
 */
function getTransferStates(): TransferState[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save transfer state to localStorage
 */
function saveTransferState(state: TransferState): void {
  const states = getTransferStates();
  const index = states.findIndex(s => s.id === state.id);
  
  if (index >= 0) {
    states[index] = state;
  } else {
    states.push(state);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

/**
 * Get specific transfer state by ID
 */
export function getTransferState(id: string): TransferState | null {
  const states = getTransferStates();
  return states.find(s => s.id === id) || null;
}

/**
 * Delete transfer state
 */
export function deleteTransferState(id: string): void {
  const states = getTransferStates();
  const filtered = states.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Get all pending/in-progress transfers for a section
 */
export function getPendingTransfers(section?: 'review' | 'releases' | 'scenes'): TransferState[] {
  const states = getTransferStates();
  return states.filter(s => {
    const isActive = s.status === 'pending' || s.status === 'in-progress' || s.status === 'paused';
    return section ? (isActive && s.section === section) : isActive;
  });
}

/**
 * Cancel a transfer
 */
export function cancelTransfer(id: string): void {
  const state = getTransferState(id);
  if (state) {
    state.status = 'cancelled';
    state.updatedAt = Date.now();
    saveTransferState(state);
  }
}

/**
 * Generate SHA1 hash for Backblaze part verification
 */
async function generateSHA1(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Backblaze B2 Large File Upload Manager
 */
class BackblazeMultipartUpload {
  private config: any;
  private fileId: string | null = null;
  private uploadUrls: string[] = [];
  private authTokens: string[] = [];

  constructor() {
    this.config = this.getBackblazeConfig();
  }

  private getBackblazeConfig() {
    return {
      keyId: localStorage.getItem('backblazeKeyId') || '',
      applicationKey: localStorage.getItem('backblazeApplicationKey') || '',
      bucketName: localStorage.getItem('backblazeBucketName') || '',
      bucketId: localStorage.getItem('backblazeBucketId') || '',
      endpoint: localStorage.getItem('backblazeEndpoint') || 's3.us-west-004.backblazeb2.com',
      apiUrl: localStorage.getItem('backblazeApiUrl') || 'https://api.backblazeb2.com'
    };
  }

  /**
   * Get authorization token from Backblaze
   */
  private async authorize(): Promise<{ authToken: string; apiUrl: string; downloadUrl: string }> {
    const { keyId, applicationKey, apiUrl } = this.config;
    const authString = btoa(`${keyId}:${applicationKey}`);

    const response = await fetch(`${apiUrl}/b2api/v2/b2_authorize_account`, {
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });

    if (!response.ok) {
      throw new Error(`Authorization failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      authToken: data.authorizationToken,
      apiUrl: data.apiUrl,
      downloadUrl: data.downloadUrl
    };
  }

  /**
   * Start large file upload
   */
  async startLargeFile(fileName: string, contentType: string): Promise<string> {
    const auth = await this.authorize();
    
    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_start_large_file`, {
      method: 'POST',
      headers: {
        'Authorization': auth.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: this.config.bucketId,
        fileName: fileName,
        contentType: contentType
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to start large file: ${response.status}`);
    }

    const data = await response.json();
    this.fileId = data.fileId;
    return data.fileId;
  }

  /**
   * Get upload URL for a part
   */
  async getUploadPartUrl(fileId: string): Promise<{ uploadUrl: string; authToken: string }> {
    const auth = await this.authorize();

    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_part_url`, {
      method: 'POST',
      headers: {
        'Authorization': auth.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileId })
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload part URL: ${response.status}`);
    }

    const data = await response.json();
    return {
      uploadUrl: data.uploadUrl,
      authToken: data.authorizationToken
    };
  }

  /**
   * Upload a single part
   */
  async uploadPart(
    chunk: Blob,
    partNumber: number,
    uploadUrl: string,
    authToken: string
  ): Promise<{ sha1: string }> {
    const arrayBuffer = await chunk.arrayBuffer();
    const sha1 = await generateSHA1(arrayBuffer);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'X-Bz-Part-Number': partNumber.toString(),
        'Content-Length': chunk.size.toString(),
        'X-Bz-Content-Sha1': sha1
      },
      body: chunk
    });

    if (!response.ok) {
      throw new Error(`Failed to upload part ${partNumber}: ${response.status}`);
    }

    return { sha1 };
  }

  /**
   * Finish large file upload
   */
  async finishLargeFile(fileId: string, partSha1Array: string[]): Promise<{ fileId: string; fileName: string }> {
    const auth = await this.authorize();

    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_finish_large_file`, {
      method: 'POST',
      headers: {
        'Authorization': auth.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileId,
        partSha1Array
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to finish large file: ${response.status}`);
    }

    const data = await response.json();
    return {
      fileId: data.fileId,
      fileName: data.fileName
    };
  }

  /**
   * Cancel large file upload
   */
  async cancelLargeFile(fileId: string): Promise<void> {
    const auth = await this.authorize();

    await fetch(`${auth.apiUrl}/b2api/v2/b2_cancel_large_file`, {
      method: 'POST',
      headers: {
        'Authorization': auth.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileId })
    });
  }
}

/**
 * Resumable Upload Manager
 */
export class ResumableUploadManager {
  private transferId: string;
  private state: TransferState;
  private options: ResumableUploadOptions;
  private b2Upload: BackblazeMultipartUpload;
  private abortController: AbortController;

  constructor(options: ResumableUploadOptions, transferId?: string) {
    this.options = options;
    this.transferId = transferId || `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.b2Upload = new BackblazeMultipartUpload();
    this.abortController = new AbortController();

    // Load existing state or create new
    const existingState = transferId ? getTransferState(transferId) : null;
    
    if (existingState) {
      this.state = existingState;
      this.state.status = 'in-progress';
    } else {
      this.state = this.createInitialState();
    }
  }

  private createInitialState(): TransferState {
    const chunkSize = this.options.chunkSize || CHUNK_SIZE;
    const totalChunks = Math.ceil(this.options.file.size / chunkSize);
    const chunks: ChunkState[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, this.options.file.size);
      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        status: 'pending',
        retries: 0
      });
    }

    return {
      id: this.transferId,
      type: 'upload',
      fileName: this.options.fileName || this.options.file.name,
      fileSize: this.options.file.size,
      chunks,
      totalChunks,
      bytesTransferred: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: this.options.metadata,
      section: this.options.section
    };
  }

  /**
   * Start or resume upload
   */
  async start(): Promise<void> {
    try {
      this.state.status = 'in-progress';
      saveTransferState(this.state);

      // Start large file if not already started
      if (!this.state.metadata?.fileId) {
        const fileId = await this.b2Upload.startLargeFile(
          this.state.fileName,
          this.options.file.type || 'application/octet-stream'
        );
        
        this.state.metadata = {
          ...this.state.metadata,
          fileId
        };
        saveTransferState(this.state);
      }

      // Upload pending chunks
      for (const chunk of this.state.chunks) {
        if (chunk.status === 'completed') {
          continue; // Skip already uploaded chunks
        }

        await this.uploadChunk(chunk);
        
        // Check if cancelled
        if (this.state.status === 'cancelled') {
          throw new Error('Upload cancelled by user');
        }
      }

      // Finish large file
      const partSha1Array = this.state.chunks.map(c => c.sha1!);
      const result = await this.b2Upload.finishLargeFile(
        this.state.metadata!.fileId,
        partSha1Array
      );

      this.state.status = 'completed';
      this.state.updatedAt = Date.now();
      saveTransferState(this.state);

      // Get public URL
      const config = this.b2Upload['config'];
      const url = `https://${config.bucketName}.${config.endpoint}/${result.fileName}`;

      if (this.options.onComplete) {
        this.options.onComplete(url, result.fileId);
      }

    } catch (error) {
      this.state.status = 'failed';
      this.state.updatedAt = Date.now();
      saveTransferState(this.state);

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (this.options.onError) {
        this.options.onError(errorMsg);
      }
      throw error;
    }
  }

  private async uploadChunk(chunk: ChunkState): Promise<void> {
    const maxRetries = MAX_RETRIES;
    
    while (chunk.retries < maxRetries) {
      try {
        chunk.status = 'uploading';
        saveTransferState(this.state);

        // Get upload URL
        const { uploadUrl, authToken } = await this.b2Upload.getUploadPartUrl(
          this.state.metadata!.fileId
        );

        // Extract chunk from file
        const blob = this.options.file.slice(chunk.start, chunk.end);

        // Upload part (part numbers are 1-indexed)
        const { sha1 } = await this.b2Upload.uploadPart(
          blob,
          chunk.index + 1,
          uploadUrl,
          authToken
        );

        chunk.sha1 = sha1;
        chunk.status = 'completed';
        this.state.bytesTransferred += chunk.size;
        this.state.updatedAt = Date.now();
        saveTransferState(this.state);

        // Progress callback
        if (this.options.onProgress) {
          const progress = (this.state.bytesTransferred / this.state.fileSize) * 100;
          this.options.onProgress(progress, this.state.bytesTransferred, this.state.fileSize);
        }

        if (this.options.onChunkComplete) {
          this.options.onChunkComplete(chunk.index + 1, this.state.totalChunks);
        }

        return; // Success
        
      } catch (error) {
        chunk.retries++;
        
        if (chunk.retries >= maxRetries) {
          chunk.status = 'failed';
          saveTransferState(this.state);
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, chunk.retries) * 1000));
      }
    }
  }

  /**
   * Pause upload
   */
  pause(): void {
    this.state.status = 'paused';
    this.state.updatedAt = Date.now();
    saveTransferState(this.state);
    this.abortController.abort();
  }

  /**
   * Cancel upload and clean up
   */
  async cancel(): Promise<void> {
    this.state.status = 'cancelled';
    this.state.updatedAt = Date.now();
    saveTransferState(this.state);
    
    // Cancel large file on Backblaze
    if (this.state.metadata?.fileId) {
      try {
        await this.b2Upload.cancelLargeFile(this.state.metadata.fileId);
      } catch (error) {
        console.error('Failed to cancel large file:', error);
      }
    }
    
    deleteTransferState(this.transferId);
  }

  getState(): TransferState {
    return this.state;
  }

  getId(): string {
    return this.transferId;
  }
}

/**
 * Resumable Download Manager
 */
export class ResumableDownloadManager {
  private transferId: string;
  private state: TransferState;
  private options: ResumableDownloadOptions;
  private downloadedChunks: Map<number, ArrayBuffer>;

  constructor(options: ResumableDownloadOptions, transferId?: string) {
    this.options = options;
    this.transferId = transferId || `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.downloadedChunks = new Map();

    // Load existing state or create new
    const existingState = transferId ? getTransferState(transferId) : null;
    
    if (existingState) {
      this.state = existingState;
      this.state.status = 'in-progress';
    } else {
      this.state = this.createInitialState();
    }
  }

  private createInitialState(): TransferState {
    const chunkSize = this.options.chunkSize || DOWNLOAD_CHUNK_SIZE;
    const fileSize = this.options.fileSize || 0;
    const totalChunks = fileSize > 0 ? Math.ceil(fileSize / chunkSize) : 1;
    const chunks: ChunkState[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        status: 'pending',
        retries: 0
      });
    }

    return {
      id: this.transferId,
      type: 'download',
      fileName: this.options.fileName,
      fileSize,
      chunks,
      totalChunks,
      bytesTransferred: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      section: this.options.section
    };
  }

  /**
   * Start or resume download
   */
  async start(): Promise<Blob> {
    try {
      this.state.status = 'in-progress';
      saveTransferState(this.state);

      // If we don't know file size, fetch it first
      if (this.state.fileSize === 0) {
        const headResponse = await fetch(this.options.url, { method: 'HEAD' });
        const fileSize = parseInt(headResponse.headers.get('content-length') || '0');
        
        if (fileSize > 0) {
          this.state.fileSize = fileSize;
          this.state.chunks = this.createInitialState().chunks;
          saveTransferState(this.state);
        }
      }

      // Download pending chunks
      for (const chunk of this.state.chunks) {
        if (chunk.status === 'completed') {
          continue; // Skip already downloaded chunks
        }

        await this.downloadChunk(chunk);
        
        // Check if cancelled
        if (this.state.status === 'cancelled') {
          throw new Error('Download cancelled by user');
        }
      }

      // Combine all chunks
      const sortedChunks = Array.from(this.downloadedChunks.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, buffer]) => buffer);

      const blob = new Blob(sortedChunks);

      this.state.status = 'completed';
      this.state.updatedAt = Date.now();
      saveTransferState(this.state);

      if (this.options.onComplete) {
        this.options.onComplete(blob);
      }

      return blob;

    } catch (error) {
      this.state.status = 'failed';
      this.state.updatedAt = Date.now();
      saveTransferState(this.state);

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (this.options.onError) {
        this.options.onError(errorMsg);
      }
      throw error;
    }
  }

  private async downloadChunk(chunk: ChunkState): Promise<void> {
    const maxRetries = MAX_RETRIES;
    
    while (chunk.retries < maxRetries) {
      try {
        chunk.status = 'uploading'; // Reusing status
        saveTransferState(this.state);

        // Download with Range header
        const response = await fetch(this.options.url, {
          headers: {
            'Range': `bytes=${chunk.start}-${chunk.end - 1}`
          }
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Download failed: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        this.downloadedChunks.set(chunk.index, arrayBuffer);

        chunk.status = 'completed';
        this.state.bytesTransferred += arrayBuffer.byteLength;
        this.state.updatedAt = Date.now();
        saveTransferState(this.state);

        // Progress callback
        if (this.options.onProgress) {
          const progress = (this.state.bytesTransferred / this.state.fileSize) * 100;
          this.options.onProgress(progress, this.state.bytesTransferred, this.state.fileSize);
        }

        return; // Success
        
      } catch (error) {
        chunk.retries++;
        
        if (chunk.retries >= maxRetries) {
          chunk.status = 'failed';
          saveTransferState(this.state);
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, chunk.retries) * 1000));
      }
    }
  }

  /**
   * Pause download
   */
  pause(): void {
    this.state.status = 'paused';
    this.state.updatedAt = Date.now();
    saveTransferState(this.state);
  }

  /**
   * Cancel download
   */
  cancel(): void {
    this.state.status = 'cancelled';
    this.state.updatedAt = Date.now();
    saveTransferState(this.state);
    deleteTransferState(this.transferId);
  }

  getState(): TransferState {
    return this.state;
  }

  getId(): string {
    return this.transferId;
  }
}

/**
 * Auto-resume pending transfers on app start
 */
export async function resumePendingTransfers(
  onUploadProgress?: (id: string, progress: number) => void,
  onDownloadProgress?: (id: string, progress: number) => void
): Promise<void> {
  const pending = getPendingTransfers();
  
  for (const state of pending) {
    if (state.type === 'upload') {
      // Note: Cannot auto-resume uploads without the original File object
      // This would need to be triggered from the UI with file re-selection
      console.log(`Upload ${state.id} requires manual resume (file re-selection needed)`);
    } else if (state.type === 'download') {
      try {
        const manager = new ResumableDownloadManager({
          url: state.metadata?.url || '',
          fileName: state.fileName,
          fileSize: state.fileSize,
          onProgress: (progress) => {
            if (onDownloadProgress) onDownloadProgress(state.id, progress);
          }
        }, state.id);
        
        await manager.start();
      } catch (error) {
        console.error(`Failed to resume download ${state.id}:`, error);
      }
    }
  }
}
