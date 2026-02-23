/**
 * Backblaze B2 Cloud Storage Integration
 * 
 * This module provides utilities for uploading and managing files
 * on Backblaze B2 using their S3-compatible API.
 * 
 * Supports multiple buckets:
 * - General Storage: Default bucket for general files
 * - Videos: Dedicated bucket for video trailers
 * - Design: Dedicated bucket for Design Studio templates and rendered designs
 * 
 * Cost Benefits:
 * - Storage: $6/TB (vs S3's $23/TB)
 * - First 3x your storage is free egress
 * - Perfect for video trailer storage and design assets
 */

export type BucketType = 'general' | 'videos' | 'design';

interface BackblazeConfig {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpoint?: string; // e.g., 's3.us-west-004.backblazeb2.com'
}

interface UploadOptions {
  file: File;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
  bucketType?: BucketType; // Specify which bucket to use
}

interface UploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  error?: string;
}

/**
 * Get Backblaze configuration from settings/localStorage
 * Supports multiple bucket types: general, videos, design
 */
export function getBackblazeConfig(bucketType: BucketType = 'general'): BackblazeConfig | null {
  let keyId: string | null;
  let applicationKey: string | null;
  let bucketName: string | null;
  
  // Select credentials based on bucket type
  switch (bucketType) {
    case 'videos':
      keyId = localStorage.getItem('backblazeVideosKeyId');
      applicationKey = localStorage.getItem('backblazeVideosApplicationKey');
      bucketName = localStorage.getItem('backblazeVideosBucketName');
      break;
    case 'design':
      keyId = localStorage.getItem('backblazeDesignKeyId');
      applicationKey = localStorage.getItem('backblazeDesignApplicationKey');
      bucketName = localStorage.getItem('backblazeDesignBucketName');
      break;
    case 'general':
    default:
      keyId = localStorage.getItem('backblazeKeyId');
      applicationKey = localStorage.getItem('backblazeApplicationKey');
      bucketName = localStorage.getItem('backblazeBucketName');
      break;
  }
  
  if (!keyId || !applicationKey || !bucketName) {
    return null;
  }
  
  return {
    keyId,
    applicationKey,
    bucketName,
    // Default to us-west region, users can customize this
    endpoint: localStorage.getItem('backblazeEndpoint') || 's3.us-west-004.backblazeb2.com'
  };
}

/**
 * Upload a file to Backblaze B2
 * Uses the S3-compatible API for easy integration
 */
export async function uploadToBackblaze(options: UploadOptions): Promise<UploadResult> {
  const bucketType = options.bucketType || 'general';
  const config = getBackblazeConfig(bucketType);
  
  if (!config) {
    return {
      success: false,
      error: `Backblaze B2 ${bucketType} bucket not configured. Please add your credentials in Settings → API Keys`
    };
  }
  
  const { file, fileName, contentType, metadata, onProgress } = options;
  const finalFileName = fileName || file.name;
  const finalContentType = contentType || file.type || 'application/octet-stream';
  
  try {
    // Create form data for upload
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata if provided
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(`x-amz-meta-${key}`, value);
      });
    }
    
    // S3-compatible upload endpoint
    const uploadUrl = `https://${config.endpoint}/${config.bucketName}/${finalFileName}`;
    
    // Create XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });
      }
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicUrl = `https://${config.bucketName}.${config.endpoint}/${finalFileName}`;
          resolve({
            success: true,
            url: publicUrl,
            fileId: finalFileName
          });
        } else {
          resolve({
            success: false,
            error: `Upload failed with status ${xhr.status}: ${xhr.statusText}`
          });
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error during upload'
        });
      });
      
      xhr.addEventListener('abort', () => {
        resolve({
          success: false,
          error: 'Upload cancelled'
        });
      });
      
      // Open and send request
      xhr.open('PUT', uploadUrl);
      
      // Set authorization header (Basic Auth with keyId:applicationKey)
      const authString = btoa(`${config.keyId}:${config.applicationKey}`);
      xhr.setRequestHeader('Authorization', `Basic ${authString}`);
      xhr.setRequestHeader('Content-Type', finalContentType);
      
      xhr.send(file);
    });
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload'
    };
  }
}

/**
 * Delete a file from Backblaze B2
 */
export async function deleteFromBackblaze(fileName: string, bucketType: BucketType = 'general'): Promise<boolean> {
  const config = getBackblazeConfig(bucketType);
  
  if (!config) {
    console.error('Backblaze B2 not configured');
    return false;
  }
  
  try {
    const deleteUrl = `https://${config.endpoint}/${config.bucketName}/${fileName}`;
    const authString = btoa(`${config.keyId}:${config.applicationKey}`);
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error deleting from Backblaze:', error);
    return false;
  }
}

/**
 * Generate a unique file name with timestamp
 */
export function generateFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
  
  const parts = [
    prefix,
    baseName,
    timestamp,
    random
  ].filter(Boolean);
  
  return `${parts.join('-')}.${extension}`;
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(fileName: string, bucketType: BucketType = 'general'): string | null {
  const config = getBackblazeConfig(bucketType);
  
  if (!config) {
    return null;
  }
  
  return `https://${config.bucketName}.${config.endpoint}/${fileName}`;
}

/**
 * Check if Backblaze is configured
 */
export function isBackblazeConfigured(bucketType: BucketType = 'general'): boolean {
  return getBackblazeConfig(bucketType) !== null;
}

/**
 * Validate Backblaze configuration
 */
export async function validateBackblazeConfig(bucketType: BucketType = 'general'): Promise<{ valid: boolean; error?: string }> {
  const config = getBackblazeConfig(bucketType);
  
  if (!config) {
    return {
      valid: false,
      error: 'Configuration missing'
    };
  }
  
  try {
    // Try to list bucket (simple validation)
    const listUrl = `https://${config.endpoint}/${config.bucketName}?max-keys=1`;
    const authString = btoa(`${config.keyId}:${config.applicationKey}`);
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    if (response.ok) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: `Authentication failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * List files in Backblaze B2 bucket
 */
export async function listBackblazeFiles(
  keyId: string,
  applicationKey: string,
  bucketName: string,
  endpoint: string = 's3.us-west-004.backblazeb2.com',
  maxKeys: number = 1000
): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const listUrl = `https://${endpoint}/${bucketName}?list-type=2&max-keys=${maxKeys}`;
    const authString = btoa(`${keyId}:${applicationKey}`);
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to list files: ${response.status} ${response.statusText}`
      };
    }
    
    const text = await response.text();
    
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Check for errors in XML
    const errorNode = xmlDoc.querySelector('Error');
    if (errorNode) {
      const errorMessage = errorNode.querySelector('Message')?.textContent || 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
    
    // Extract file information
    const contents = xmlDoc.querySelectorAll('Contents');
    const files = Array.from(contents).map(content => {
      const fileName = content.querySelector('Key')?.textContent || '';
      const size = parseInt(content.querySelector('Size')?.textContent || '0');
      const lastModified = content.querySelector('LastModified')?.textContent || '';
      const etag = content.querySelector('ETag')?.textContent || '';
      
      return {
        fileName,
        fileId: fileName,
        contentType: getContentTypeFromFileName(fileName),
        contentLength: size,
        uploadTimestamp: new Date(lastModified).getTime(),
        url: `https://${bucketName}.${endpoint}/${fileName}`,
        etag: etag.replace(/"/g, '')
      };
    });
    
    return {
      success: true,
      files
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * List templates from Design bucket
 * Convenience wrapper for listBackblazeFiles that uses Design bucket config
 */
export async function listDesignTemplates(
  prefix?: string,
  maxKeys: number = 1000
): Promise<{ success: boolean; files?: any[]; error?: string }> {
  const config = getBackblazeConfig('design');
  
  if (!config) {
    return {
      success: false,
      error: 'Backblaze B2 Design bucket not configured. Please add your credentials in Settings → API Keys'
    };
  }
  
  try {
    let listUrl = `https://${config.endpoint}/${config.bucketName}?list-type=2&max-keys=${maxKeys}`;
    
    // Add prefix filter if provided (e.g., "templates/" to only get templates)
    if (prefix) {
      listUrl += `&prefix=${encodeURIComponent(prefix)}`;
    }
    
    const authString = btoa(`${config.keyId}:${config.applicationKey}`);
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to list templates: ${response.status} ${response.statusText}`
      };
    }
    
    const text = await response.text();
    
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Check for errors in XML
    const errorNode = xmlDoc.querySelector('Error');
    if (errorNode) {
      const errorMessage = errorNode.querySelector('Message')?.textContent || 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
    
    // Extract file information
    const contents = xmlDoc.querySelectorAll('Contents');
    const files = Array.from(contents)
      .map(content => {
        const fileName = content.querySelector('Key')?.textContent || '';
        const size = parseInt(content.querySelector('Size')?.textContent || '0');
        const lastModified = content.querySelector('LastModified')?.textContent || '';
        const etag = content.querySelector('ETag')?.textContent || '';
        
        return {
          fileName,
          fileId: fileName,
          contentType: getContentTypeFromFileName(fileName),
          contentLength: size,
          uploadTimestamp: new Date(lastModified).getTime(),
          lastModified: new Date(lastModified),
          url: `https://${config.bucketName}.${config.endpoint}/${fileName}`,
          etag: etag.replace(/"/g, '')
        };
      })
      // Filter to only include PSD files (templates)
      .filter(file => file.fileName.toLowerCase().endsWith('.psd'));
    
    return {
      success: true,
      files
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get content type from file name
 */
function getContentTypeFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Video formats
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'm4v': 'video/x-m4v',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    
    // Design file formats
    'psd': 'image/vnd.adobe.photoshop',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ai': 'application/postscript',
    'eps': 'application/postscript',
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}