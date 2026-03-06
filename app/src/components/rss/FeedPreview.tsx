import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { ExternalLink, Zap } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { haptics } from '../../utils/haptics';

interface PreviewImage {
  url: string;
  reason: string;
}

interface FeedPreviewData {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  images: PreviewImage[];
  caption: string;
  captionCharCount: number;
}

interface FeedPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  preview: FeedPreviewData | null;
  onRunPipeline?: () => void;
}

export function FeedPreview({ isOpen, onClose, preview, onRunPipeline }: FeedPreviewProps) {
  if (!preview) return null;

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">Feed Item Preview</BottomSheetTitle>
        <BottomSheetDescription className="text-gray-500 dark:text-gray-400">
          Review the selected feed item and its generated caption.
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-6">
          {/* Article Info */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-gray-900 dark:text-white flex-1">{preview.title}</h3>
              <a
                href={preview.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ec1e24] hover:text-[#ec1e24]/80 flex-shrink-0"
                onClick={() => haptics.light()}
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-2">
              Published: {preview.pubDate}
            </p>
            <p className="text-gray-900 dark:text-white text-sm bg-gray-100 dark:bg-[#000000] p-3 rounded-lg border border-[#333333]">
              {preview.snippet}
            </p>
          </div>

          {/* Selected Images */}
          <div>
            <h4 className="text-gray-900 dark:text-white mb-3">Selected Images ({preview.images.length})</h4>
            <div className={`grid gap-4 ${preview.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {preview.images.map((image, index) => (
                <div key={index} className="relative group">
                  <ImageWithFallback
                    src={image.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <span className="text-white text-xs bg-[#ec1e24] px-2 py-1 rounded">
                        {image.reason}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generated Caption */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-gray-900 dark:text-white">Generated Caption</h4>
              <span className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">
                {preview.captionCharCount} characters
              </span>
            </div>
            <div className="bg-gray-100 dark:bg-[#000000] p-4 rounded-lg border border-[#333333]">
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{preview.caption}</p>
            </div>
          </div>

        </div>
      </BottomSheetBody>
      
      {onRunPipeline && (
        <BottomSheetFooter>
          <div className="space-y-2 w-full">
            <Button
              onClick={() => {
                haptics.medium();
                onRunPipeline();
              }}
              className="w-full bg-[#ec1e24] hover:bg-[#ec1e24]/90 text-white gap-2"
            >
              <Zap className="w-4 h-4" />
              Run Feed Now
            </Button>
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-xs text-center">
              This refreshes the feed immediately and follows the feed's current posting settings.
            </p>
          </div>
        </BottomSheetFooter>
      )}
    </BottomSheet>
  );
}
