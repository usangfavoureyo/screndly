import { AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from '../ui/bottom-sheet';
import { haptics } from '../../utils/haptics';
import { useState } from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: {
    message: string;
    cause?: string;
    stack?: string;
  };
  jobId: string;
  fileName: string;
  onRetry: () => void;
  onDuplicate: () => void;
}

export function ErrorModal({
  isOpen,
  onClose,
  error,
  jobId,
  fileName,
  onRetry,
  onDuplicate,
}: ErrorModalProps) {
  const [showStack, setShowStack] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyError = () => {
    haptics.medium();
    const errorText = `
Job ID: ${jobId}
File: ${fileName}
Error: ${error.message}
${error.cause ? `Cause: ${error.cause}` : ''}
${error.stack ? `\nStack Trace:\n${error.stack}` : ''}
    `.trim();

    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    haptics.medium();
    onRetry();
    onClose();
  };

  const handleDuplicate = () => {
    haptics.medium();
    onDuplicate();
    onClose();
  };

  const getErrorCategory = (message: string) => {
    if (message.toLowerCase().includes('ffmpeg')) return 'FFmpeg Encoding Error';
    if (message.toLowerCase().includes('api') || message.toLowerCase().includes('quota')) return 'API Quota Error';
    if (message.toLowerCase().includes('metadata')) return 'Metadata Generation Error';
    if (message.toLowerCase().includes('upload')) return 'Upload Error';
    if (message.toLowerCase().includes('network')) return 'Network Error';
    return 'Processing Error';
  };

  const getErrorSolution = (message: string) => {
    if (message.toLowerCase().includes('ffmpeg')) 
      return 'Try re-encoding the video with different settings, or check if the source file is corrupted.';
    if (message.toLowerCase().includes('api') || message.toLowerCase().includes('quota')) 
      return 'API quota exceeded. Wait for quota reset or upgrade your plan.';
    if (message.toLowerCase().includes('metadata')) 
      return 'Metadata generation failed. Try duplicating the job and manually entering metadata.';
    if (message.toLowerCase().includes('upload')) 
      return 'Upload failed. Check your network connection and try again.';
    if (message.toLowerCase().includes('network')) 
      return 'Network connection issue. Check your internet and retry.';
    return 'Try retrying the job. If the issue persists, duplicate as draft and adjust settings.';
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <div className="flex items-start gap-3 mb-2">
          <div className="rounded-full bg-red-100 dark:bg-[#1a0000] p-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
          </div>
          <div className="flex-1">
            <BottomSheetTitle className="text-gray-900 dark:text-white">
              {getErrorCategory(error.message)}
            </BottomSheetTitle>
            <BottomSheetDescription className="text-gray-600 dark:text-[#9CA3AF] mt-1">
              Job failed: {fileName}
            </BottomSheetDescription>
          </div>
        </div>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-4">
          {/* Error Message */}
          <div className="p-4 bg-red-50 dark:bg-[#1a0000] border border-red-200 dark:border-red-900 rounded-lg">
            <h4 className="text-sm font-medium text-red-900 dark:text-red-400 mb-2">Error Message</h4>
            <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
          </div>

          {/* Cause */}
          {error.cause && (
            <div className="p-4 bg-yellow-50 dark:bg-[#1a1a00] border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-400 mb-2">Cause</h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{error.cause}</p>
            </div>
          )}

          {/* Suggested Solution */}
          <div className="p-4 bg-blue-50 dark:bg-[#001a1a] border border-blue-200 dark:border-blue-900 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-2">Suggested Solution</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">{getErrorSolution(error.message)}</p>
          </div>

          {/* Stack Trace */}
          {error.stack && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStack(!showStack)}
                className="text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white"
              >
                {showStack ? 'Hide' : 'Show'} Stack Trace
              </Button>
              
              {showStack && (
                <div className="p-4 bg-gray-100 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                  <pre className="text-xs text-gray-700 dark:text-[#9CA3AF] overflow-x-auto whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Job Info */}
          <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-[#6B7280]">Job ID:</span>
                <span className="ml-2 text-gray-900 dark:text-white font-mono">{jobId}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-[#6B7280]">File:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{fileName}</span>
              </div>
            </div>
          </div>

        </div>
      </BottomSheetBody>
      
      <BottomSheetFooter>
        <div className="space-y-3 w-full">
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRetry}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a1f] text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry with Same Metadata
            </Button>
            <Button
              onClick={handleDuplicate}
              variant="outline"
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate as Draft
            </Button>
          </div>

          {/* Copy Error Button */}
          <Button
            onClick={handleCopyError}
            variant="ghost"
            size="sm"
            className="w-full text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            {copied ? 'Copied to Clipboard!' : 'Copy Error Details'}
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
