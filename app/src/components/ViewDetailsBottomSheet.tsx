import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';

interface ViewDetailsBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    title: string;
    platform: string;
    description?: string;
    thumbnailUrl?: string;
  };
}

export function ViewDetailsBottomSheet({ open, onOpenChange, post }: ViewDetailsBottomSheetProps) {
  return (
    <BottomSheet 
      open={open} 
      onOpenChange={onOpenChange}
      heightMode="auto"
    >
      <BottomSheetHeader>
        <BottomSheetTitle>Post Details</BottomSheetTitle>
        <BottomSheetDescription>
          {post.platform} • {
            post.platform === 'YouTube' 
              ? 'Title, Description & Thumbnail' 
              : post.platform === 'X' 
                ? 'Caption & Thumbnail' 
                : 'Caption & Poster'
          }
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-6">
          {/* Title (YouTube only) */}
          {post.platform === 'YouTube' && (
            <div>
              <label className="block text-sm mb-2 text-gray-900 dark:text-white">
                Title
              </label>
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-4">
                <p className="text-gray-900 dark:text-white">
                  {post.title}
                </p>
              </div>
            </div>
          )}

          {/* Caption/Description */}
          <div>
            <label className="block text-sm mb-2 text-gray-900 dark:text-white">
              {post.platform === 'YouTube' ? 'Description' : 'Caption'}
            </label>
            {post.description ? (
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-4">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {post.description}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
                <p className="text-gray-500 dark:text-[#6B7280] italic">
                  No {post.platform === 'YouTube' ? 'description' : 'caption'} available
                </p>
              </div>
            )}
          </div>

          {/* Poster/Thumbnail */}
          <div>
            <label className="block text-sm mb-2 text-gray-900 dark:text-white">
              {post.platform === 'X' || post.platform === 'YouTube' ? 'Thumbnail' : 'Poster'}
            </label>
            {post.thumbnailUrl ? (
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-2 overflow-hidden">
                <img
                  src={post.thumbnailUrl}
                  alt={post.title}
                  className="w-full h-auto rounded-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div
                  className="hidden w-full aspect-video items-center justify-center bg-white dark:bg-black rounded-md"
                  style={{ display: 'none' }}
                >
                  <p className="text-gray-500 dark:text-[#6B7280] text-sm">
                    Failed to load image
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded-lg p-8 flex items-center justify-center">
                <p className="text-gray-500 dark:text-[#6B7280] italic">
                  No {post.platform === 'X' ? 'thumbnail' : 'poster'} available
                </p>
              </div>
            )}
          </div>
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button
          onClick={() => {
            haptics.light();
            onOpenChange(false);
          }}
          variant="outline"
          className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333] w-full"
        >
          Close
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
