import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";

interface DownloadBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFileName?: string;
  imageUrl: string;
}

export function DownloadBottomSheet({
  open,
  onOpenChange,
  defaultFileName = 'design',
  imageUrl,
}: DownloadBottomSheetProps) {
  const [fileName, setFileName] = useState(defaultFileName);
  const [fileFormat, setFileFormat] = useState<'jpeg' | 'png'>('jpeg');

  const handleDownload = () => {
    haptics.medium();

    // Optimistic Update: Close immediately
    onOpenChange(false);
    toast.message('Download started...', {
      description: `Saving ${fileName}.${fileFormat}`
    });

    // Perform download in background
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${fileFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success(`Downloaded as ${fileName}.${fileFormat}`);
      })
      .catch(error => {
        toast.error('Failed to download design');
        console.error('Download error:', error);
      });
  };

  const handleCancel = () => {
    haptics.light();
    onOpenChange(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">Download Design</BottomSheetTitle>
        <BottomSheetDescription className="text-[#6B7280] dark:text-[#9CA3AF]">
          Choose format and filename for your design
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-4">
          {/* File Format */}
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">
              File Format
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  haptics.light();
                  setFileFormat('jpeg');
                }}
                className={`p-4 rounded-lg border-2 transition-all ${fileFormat === 'jpeg'
                    ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                    : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-gray-900 dark:text-white">JPEG</p>
                    <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                      Smaller file size
                    </p>
                  </div>
                  {fileFormat === 'jpeg' && (
                    <Check className="w-5 h-5 text-[#ec1e24]" />
                  )}
                </div>
              </button>

              <button
                onClick={() => {
                  haptics.light();
                  setFileFormat('png');
                }}
                className={`p-4 rounded-lg border-2 transition-all ${fileFormat === 'png'
                    ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                    : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-gray-900 dark:text-white">PNG</p>
                    <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                      Higher quality
                    </p>
                  </div>
                  {fileFormat === 'png' && (
                    <Check className="w-5 h-5 text-[#ec1e24]" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* File Name */}
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">
              File Name
            </Label>
            <div className="relative">
              <Input
                value={fileName}
                onChange={(e) => {
                  haptics.light();
                  setFileName(e.target.value);
                }}
                onFocus={() => haptics.light()}
                placeholder="Enter file name..."
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-[#6B7280]">
                .{fileFormat}
              </span>
            </div>
          </div>
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <div className="flex gap-3 w-full">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!fileName.trim()}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50"
          >
            Download
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}