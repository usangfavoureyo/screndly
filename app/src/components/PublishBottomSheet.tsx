import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { XIcon } from './icons/XIcon';
import { PinterestIcon } from './icons/PinterestIcon';
import { OptimalTimeSuggestion } from './OptimalTimeSuggestion';
import { haptics } from '../utils/haptics';
import type { PlatformSelection } from '../lib/api/platforms';

interface PublishBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  initialCaption?: string;
  onPublish?: (caption: string, platforms: PlatformSelection) => void | Promise<void>;
  onCaptionGenerate?: () => string | Promise<string>;
  isGeneratingCaption?: boolean;
  allowedPlatforms?: Array<'x' | 'threads' | 'facebook' | 'instagram' | 'pinterest'>;
}

export function PublishBottomSheet({
  open,
  onOpenChange,
  title = 'Publish',
  description = 'Select platforms and customize your caption',
  initialCaption = '',
  onPublish,
  onCaptionGenerate,
  isGeneratingCaption = false,
  allowedPlatforms = ['x', 'threads', 'facebook', 'instagram', 'pinterest'],
}: PublishBottomSheetProps) {
  const [generatedCaption, setGeneratedCaption] = useState(initialCaption);
  const [captionEditMode, setCaptionEditMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformSelection>({
    x: false,
    threads: false,
    facebook: false,
    instagram: false,
    pinterest: false,
  });

  // Pinterest-specific fields
  const [pinterestTitle, setPinterestTitle] = useState('');
  const [pinterestDescription, setPinterestDescription] = useState('');
  const [pinterestLink, setPinterestLink] = useState('');
  const [pinterestBoard, setPinterestBoard] = useState('');

  useEffect(() => {
    let cancelled = false;

    const populateCaption = async () => {
      if (open && !generatedCaption && onCaptionGenerate) {
        const caption = await onCaptionGenerate();
        if (!cancelled) {
          setGeneratedCaption(caption);
        }
      }
    };

    void populateCaption();

    return () => {
      cancelled = true;
    };
  }, [open, generatedCaption, onCaptionGenerate]);

  useEffect(() => {
    if (initialCaption) {
      setGeneratedCaption(initialCaption);
    }
  }, [initialCaption]);

  // Compute selected platforms list for OptimalTimeSuggestion
  const selectedPlatformsList = useMemo(() => {
    return Object.entries(selectedPlatforms)
      .filter(([, isSelected]) => isSelected)
      .map(([platform]) => platform);
  }, [selectedPlatforms]);

  const handleGenerateCaption = async () => {
    haptics.light();
    if (onCaptionGenerate) {
      const caption = await onCaptionGenerate();
      setGeneratedCaption(caption);
      setCaptionEditMode(false);
    }
  };

  const handlePublish = async () => {
    haptics.medium();
    if (onPublish) {
      await onPublish(generatedCaption, selectedPlatforms);
    }
    onOpenChange(false);
    setGeneratedCaption('');
    setCaptionEditMode(false);
  };

  const handleCancel = () => {
    haptics.light();
    onOpenChange(false);
    setGeneratedCaption('');
    setCaptionEditMode(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">{title}</BottomSheetTitle>
        <BottomSheetDescription className="text-[#6B7280] dark:text-[#9CA3AF]">
          {description}
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        {/* Caption Generation Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-gray-900 dark:text-white">Social Media Caption</Label>
            {onCaptionGenerate && (
              <button
                type="button"
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption}
                className="text-sm text-black dark:text-white hover:opacity-70 disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCaption ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              value={generatedCaption}
              onFocus={() => {
                haptics.light();
              }}
              onChange={(e) => {
                haptics.light();
                setGeneratedCaption(e.target.value);
                setCaptionEditMode(true);
              }}
              placeholder={isGeneratingCaption ? "Generating caption..." : "Caption will appear here"}
              disabled={isGeneratingCaption}
              className="w-full min-h-[120px] px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24] transition-colors resize-none disabled:opacity-50"
            />
            <div className="absolute bottom-2 right-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {generatedCaption.length} chars
            </div>
          </div>

          {captionEditMode && (
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Caption edited manually
            </p>
          )}
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Platform Selection */}
        <div className="space-y-3 pt-4">
          <Label className="text-gray-900 dark:text-white">Select Platforms</Label>
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-3 max-w-fit">
              {allowedPlatforms.includes('x') ? <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedPlatforms({ ...selectedPlatforms, x: !selectedPlatforms.x });
                }}
                className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.x
                  ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                  : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                  }`}
                title="X"
              >
                <XIcon className="w-4 h-4" />
              </button>
              : null}

              {allowedPlatforms.includes('threads') ? <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedPlatforms({ ...selectedPlatforms, threads: !selectedPlatforms.threads });
                }}
                className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.threads
                  ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                  : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                  }`}
                title="Threads"
              >
                <ThreadsIcon className="w-5 h-5" />
              </button>
              : null}

              {allowedPlatforms.includes('facebook') ? <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedPlatforms({ ...selectedPlatforms, facebook: !selectedPlatforms.facebook });
                }}
                className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.facebook
                  ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                  : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                  }`}
                title="Facebook"
              >
                <FacebookIcon className="w-5.5 h-5.5" />
              </button>
              : null}

              {allowedPlatforms.includes('instagram') ? <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedPlatforms({ ...selectedPlatforms, instagram: !selectedPlatforms.instagram });
                }}
                className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.instagram
                  ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                  : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                  }`}
                title="Instagram"
              >
                <InstagramIcon className="w-5.5 h-5.5" />
              </button>
              : null}

              {allowedPlatforms.includes('pinterest') ? <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedPlatforms({ ...selectedPlatforms, pinterest: !selectedPlatforms.pinterest });
                }}
                className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.pinterest
                  ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                  : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                  }`}
                title="Pinterest"
              >
                <PinterestIcon className="w-5.5 h-5.5" />
              </button>
              : null}
            </div>
          </div>
        </div>

        {/* Optimal Posting Time Suggestion */}
        <OptimalTimeSuggestion
          selectedPlatforms={selectedPlatformsList}
          className="mt-4"
        />

        {/* Pinterest-specific fields */}
        {selectedPlatforms.pinterest && (
          <div className="space-y-3 pt-4">
            <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />
            <Label className="text-gray-900 dark:text-white">Pinterest Details</Label>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Pinterest requires structured content for better discovery
            </p>
            <div className="space-y-2">
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Title (100 chars max)</Label>
              <Input
                type="text"
                value={pinterestTitle}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setPinterestTitle(e.target.value);
                }}
                placeholder="e.g., The Batman (2025) - Official Movie Trailer"
                maxLength={100}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {pinterestTitle.length}/100 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Description (500 chars max)</Label>
              <textarea
                value={pinterestDescription}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setPinterestDescription(e.target.value);
                }}
                placeholder="e.g., The Batman returns in 2025! Matt Reeves' epic sequel..."
                maxLength={500}
                rows={4}
                className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929] transition-colors resize-none"
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {pinterestDescription.length}/500 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Link URL (Required)</Label>
              <Input
                type="url"
                value={pinterestLink}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setPinterestLink(e.target.value);
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Board Name (Required)</Label>
              <Input
                type="text"
                value={pinterestBoard}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setPinterestBoard(e.target.value);
                }}
                placeholder="e.g., Movies & TV Shows"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Must match an existing board on your Pinterest account
              </p>
            </div>
          </div>
        )}
      </BottomSheetBody>

      <BottomSheetFooter>
        <div className="flex gap-3 w-full">
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100"
          >
            Publish
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
