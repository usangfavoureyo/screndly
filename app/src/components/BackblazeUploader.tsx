import { useState } from 'react';
import { Upload, CheckCircle2, XCircle } from 'lucide-react';
import { uploadToBackblaze, generateFileName, isBackblazeConfigured } from '../utils/backblaze';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { RedSpinner } from './PageLoader';

interface BackblazeUploaderProps {
  onUploadComplete?: (url: string, fileId: string) => void;
  onUploadError?: (error: string) => void;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
  fileNamePrefix?: string;
  buttonText?: string;
  className?: string;
}

export function BackblazeUploader({
  onUploadComplete,
  onUploadError,
  acceptedFileTypes = 'video/*',
  maxFileSizeMB = 500,
  fileNamePrefix = 'screndly',
  buttonText = 'Upload to Backblaze B2',
  className = ''
}: BackblazeUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setError(null);
    setUploadedUrl(null);
    setProgress(0);

    // Check if Backblaze is configured
    if (!isBackblazeConfigured('general')) {
      const errorMsg = 'Backblaze B2 General Storage not configured. Please add your credentials in Settings → API Keys';
      setError(errorMsg);
      toast.error('Configuration Required', {
        description: errorMsg
      });
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMB) {
      const errorMsg = `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum of ${maxFileSizeMB}MB`;
      setError(errorMsg);
      toast.error('File Too Large', {
        description: errorMsg
      });
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Start upload
    setUploading(true);
    haptics.medium();

    const toastId = toast.loading('Uploading to Backblaze B2...', {
      description: `${file.name} (${fileSizeMB.toFixed(1)}MB)`
    });

    try {
      const fileName = generateFileName(file.name, fileNamePrefix);
      
      const result = await uploadToBackblaze({
        file,
        fileName,
        bucketType: 'general', // Use General Storage bucket
        metadata: {
          'original-name': file.name,
          'upload-date': new Date().toISOString(),
          'app': 'screndly'
        },
        onProgress: (progressValue) => {
          setProgress(progressValue);
          toast.loading(`Uploading: ${Math.round(progressValue)}%`, {
            description: `${file.name} (${fileSizeMB.toFixed(1)}MB)`,
            id: toastId
          });
        }
      });

      if (result.success && result.url) {
        setUploadedUrl(result.url);
        haptics.success();
        toast.success('Upload Complete!', {
          description: `File available at Backblaze B2`,
          id: toastId
        });
        if (onUploadComplete && result.fileId) {
          onUploadComplete(result.url, result.fileId);
        }
      } else {
        const errorMsg = result.error || 'Upload failed';
        setError(errorMsg);
        haptics.error();
        toast.error('Upload Failed', {
          description: errorMsg,
          id: toastId
        });
        if (onUploadError) onUploadError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      haptics.error();
      toast.error('Upload Error', {
        description: errorMsg,
        id: toastId
      });
      if (onUploadError) onUploadError(errorMsg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <input
          type="file"
          id="backblaze-upload"
          accept={acceptedFileTypes}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <label
          htmlFor="backblaze-upload"
          className={`
            flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            border-2 border-dashed cursor-pointer transition-all
            ${uploading 
              ? 'border-gray-300 dark:border-[#333333] bg-gray-50 dark:bg-[#0A0A0A] cursor-not-allowed' 
              : 'border-[#ec1e24] hover:bg-[#ec1e24]/5 dark:hover:bg-[#ec1e24]/10'
            }
          `}
        >
          {uploading ? (
            <>
              <RedSpinner size="sm" label={`Uploading to Backblaze. ${Math.round(progress)} percent complete.`} />
              <span className="text-gray-900 dark:text-white">
                {Math.round(progress)}%
              </span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-[#ec1e24]" />
              <span className="text-gray-900 dark:text-white">
                {buttonText}
              </span>
            </>
          )}
        </label>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="w-full h-2 bg-gray-200 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#ec1e24] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Success State */}
      {uploadedUrl && !uploading && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-green-800 dark:text-green-200">
              Upload successful!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
              {uploadedUrl}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !uploading && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Maximum file size: {maxFileSizeMB}MB. Files stored on Backblaze B2 Cloud Storage.
      </p>
    </div>
  );
}
