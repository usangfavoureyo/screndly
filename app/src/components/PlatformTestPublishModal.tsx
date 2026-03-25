import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { PlatformType } from '../utils/platformConnections';
import { haptics } from '../utils/haptics';
import { publishContent, type PlatformSelection } from '../lib/api/platforms';
import { RedSpinner } from './PageLoader';

interface PlatformTestPublishModalProps {
  platform: PlatformType;
  isOpen: boolean;
  onClose: () => void;
  onPublished: () => void;
}

function formatPublishError(platform: PlatformType, message: string): string {
  if (
    platform === 'TikTok'
    && /unaudited_client_can_only_post_to_private_accounts/i.test(message)
  ) {
    return 'TikTok rejected this post because the app is unaudited. TikTok currently allows this app to post only to private or self-only accounts until the integration is audited. See https://developers.tiktok.com/doc/content-sharing-guidelines/.';
  }

  return message;
}

interface PublishConfig {
  title: string;
  description: string;
  liveWarning: string;
  requiresTitle?: boolean;
  requiresText?: boolean;
  requiresAnyImage?: boolean;
  requiresAnyVideo?: boolean;
  requiresAnyMedia?: boolean;
  supportsImageUrl?: boolean;
  supportsImageFile?: boolean;
  supportsVideoUrl?: boolean;
  supportsVideoFile?: boolean;
  supportsLink?: boolean;
  textLabel: string;
}

const PLATFORM_CONFIG: Record<PlatformType, PublishConfig> = {
  Instagram: {
    title: 'Test Instagram Publish',
    description: 'Create a live Instagram post or reel using your connected business account.',
    liveWarning: 'Instagram test publishing creates a real post. You can use a public image URL, public video URL, or upload an image/video file.',
    requiresText: true,
    requiresAnyMedia: true,
    supportsImageUrl: true,
    supportsImageFile: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    textLabel: 'Caption',
  },
  Facebook: {
    title: 'Test Facebook Publish',
    description: 'Create a live post on your connected Facebook Page.',
    liveWarning: 'Facebook test publishing creates a real page post.',
    requiresText: true,
    supportsImageUrl: true,
    supportsImageFile: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    supportsLink: true,
    textLabel: 'Message',
  },
  Threads: {
    title: 'Test Threads Publish',
    description: 'Create a live Threads post from the Platforms page.',
    liveWarning: 'Threads test publishing creates a real post.',
    requiresText: true,
    supportsImageUrl: true,
    supportsImageFile: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    textLabel: 'Post text',
  },
  TikTok: {
    title: 'Test TikTok Publish',
    description: 'Send a live TikTok video post using a video file or public video URL.',
    liveWarning: 'TikTok test publishing creates a real post. File upload is recommended because public URLs can fail if Screndly cannot fetch the video file.',
    requiresTitle: true,
    requiresAnyVideo: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    textLabel: 'Caption',
  },
  X: {
    title: 'Test X Publish',
    description: 'Post a live update to your connected X account with optional image or video media.',
    liveWarning: 'X test publishing creates a real post.',
    requiresText: true,
    supportsImageUrl: true,
    supportsImageFile: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    textLabel: 'Post text',
  },
  YouTube: {
    title: 'Test YouTube Publish',
    description: 'Upload a live YouTube video from a video file or public video URL.',
    liveWarning: 'YouTube test publishing uploads a real video and defaults it to private.',
    requiresTitle: true,
    requiresAnyVideo: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    textLabel: 'Description',
  },
  Pinterest: {
    title: 'Test Pinterest Publish',
    description: 'Create a live pin on your connected Pinterest board using an image or video.',
    liveWarning: 'Pinterest test publishing creates a real pin. You can use a public image URL, public video URL, or upload an image/video file.',
    requiresTitle: true,
    requiresAnyMedia: true,
    supportsImageUrl: true,
    supportsImageFile: true,
    supportsVideoUrl: true,
    supportsVideoFile: true,
    supportsLink: true,
    textLabel: 'Description',
  },
};

export function PlatformTestPublishModal({
  platform,
  isOpen,
  onClose,
  onPublished,
}: PlatformTestPublishModalProps) {
  const config = PLATFORM_CONFIG[platform];
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);
  const displayError = lastError ? formatPublishError(platform, lastError) : null;
  const supportsImageInput = Boolean(config.supportsImageUrl || config.supportsImageFile);
  const supportsVideoInput = Boolean(config.supportsVideoUrl || config.supportsVideoFile);
  const supportsMediaFile = Boolean(config.supportsImageFile || config.supportsVideoFile);
  const fileAccept = [
    config.supportsImageFile ? 'image/*' : null,
    config.supportsVideoFile ? 'video/*' : null,
  ].filter(Boolean).join(',');
  const mediaFileKind = mediaFile?.type.startsWith('video/')
    ? 'video'
    : mediaFile?.type.startsWith('image/')
      ? 'image'
      : null;

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setText('');
      setImageUrl('');
      setVideoUrl('');
      setMediaFile(null);
      setLink('');
      setIsPublishing(false);
      setLastError(null);
      setLastSuccess(null);
    }
  }, [isOpen]);

  const selection = useMemo<PlatformSelection>(() => ({
    x: platform === 'X',
    facebook: platform === 'Facebook',
    instagram: platform === 'Instagram',
    threads: platform === 'Threads',
    youtube: platform === 'YouTube',
    tiktok: platform === 'TikTok',
    pinterest: platform === 'Pinterest',
  }), [platform]);

  const validate = (): string | null => {
    if (config.requiresTitle && !title.trim()) {
      return 'Title is required.';
    }

    if (config.requiresText && !text.trim()) {
      return `${config.textLabel} is required.`;
    }

    const hasImageSource = Boolean(imageUrl.trim()) || mediaFileKind === 'image';
    const hasVideoSource = Boolean(videoUrl.trim()) || mediaFileKind === 'video';

    if (config.requiresAnyImage && !hasImageSource) {
      return config.supportsImageFile
        ? 'An image file or public image URL is required.'
        : 'A public image URL is required.';
    }

    if (config.requiresAnyVideo && !hasVideoSource) {
      return config.supportsVideoFile
        ? 'A video file or public video URL is required.'
        : 'A public video URL is required.';
    }

    if (config.requiresAnyMedia && !hasImageSource && !hasVideoSource) {
      if (config.supportsImageFile || config.supportsVideoFile) {
        return 'Add an image or video URL, or upload a media file.';
      }
      return 'Add an image or video URL.';
    }

    return null;
  };

  const handlePublish = async () => {
    const validationError = validate();
    if (validationError) {
      haptics.error();
      setLastError(validationError);
      return;
    }

    setIsPublishing(true);
    setLastError(null);
    setLastSuccess(null);
    haptics.medium();

    const response = await publishContent(selection, {
      title: title.trim() || undefined,
      text: text.trim(),
      imageUrl: imageUrl.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      link: link.trim() || undefined,
    }, mediaFile || undefined, {
      timeout: 180000,
    });

    setIsPublishing(false);

    if (!response.success) {
      const message = response.error?.message || 'Publish failed.';
      setLastError(message);
      haptics.error();
      return;
    }

    const firstResult = response.data?.results?.[0];
    if (!firstResult || firstResult.status !== 'posted') {
      const message = firstResult?.error || 'Publish failed.';
      setLastError(message);
      haptics.error();
      return;
    }

    const successMessage = typeof firstResult.postUrl === 'string'
      ? `Published successfully: ${firstResult.postUrl}`
      : 'Published successfully.';
    setLastSuccess(successMessage);
    haptics.success();
    toast.success(`${platform} test publish completed.`);
    onPublished();

    window.setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => !open && !isPublishing && onClose()}
      disableSwipe={isPublishing}
      disableBackdropClose={isPublishing}
    >
      <BottomSheetHeader>
        <BottomSheetTitle>{config.title}</BottomSheetTitle>
        <BottomSheetDescription>{config.description}</BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-4">
        <div className="rounded-lg border border-[#ec1e24]/20 bg-[#ec1e24]/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-[#ec1e24]" />
            <p className="text-sm text-gray-700 dark:text-[#D1D5DB]">{config.liveWarning}</p>
          </div>
        </div>

        {config.requiresTitle && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">Title</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Enter a ${platform} title`}
            />
          </div>
        )}

        {(config.requiresText || platform === 'Facebook' || platform === 'Threads' || platform === 'Pinterest' || platform === 'YouTube') && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">{config.textLabel}</label>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Enter ${config.textLabel.toLowerCase()}`}
              className="min-h-[120px] bg-black text-white placeholder:text-[#9CA3AF] border-gray-200 dark:border-[#333333] focus-visible:ring-[#ec1e24]"
            />
          </div>
        )}

        {supportsImageInput && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">Public image URL</label>
            <Input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            {platform === 'Instagram' && (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Screndly will normalize uploaded and remote images before sending them to Instagram.
              </p>
            )}
          </div>
        )}

        {supportsVideoInput && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">Public video URL</label>
            <Input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://example.com/video.mp4"
            />
            {platform === 'TikTok' && (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Screndly will try to download the video and upload it to TikTok for you.
              </p>
            )}
          </div>
        )}

        {supportsMediaFile && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">
              {config.supportsImageFile && config.supportsVideoFile
                ? 'Image or video file'
                : config.supportsImageFile
                  ? 'Image file'
                  : 'Video file'}
            </label>
            <Input
              type="file"
              accept={fileAccept || undefined}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setMediaFile(nextFile);
                if (nextFile?.type.startsWith('image/')) {
                  setImageUrl('');
                  setVideoUrl('');
                } else if (nextFile?.type.startsWith('video/')) {
                  setVideoUrl('');
                  setImageUrl('');
                }
              }}
            />
            {mediaFile && (
              <p className="break-all text-xs text-[#6B7280] dark:text-[#9CA3AF]">{mediaFile.name}</p>
            )}
            {config.supportsImageFile && config.supportsVideoFile && (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                If both image and video are provided, the video path is used first.
              </p>
            )}
            {(platform === 'TikTok' || platform === 'YouTube') && (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Preferred for video platforms. File upload avoids remote URL fetch and ownership issues.
              </p>
            )}
          </div>
        )}

        {config.supportsLink && (
          <div className="space-y-2">
            <label className="text-sm text-gray-900 dark:text-white">Link (optional)</label>
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://example.com"
            />
          </div>
        )}

        {displayError && (
          <div className="overflow-hidden rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {displayError}
            </p>
          </div>
        )}

        {lastSuccess && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{lastSuccess}</span>
            </div>
          </div>
        )}
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button variant="outline" onClick={onClose} disabled={isPublishing}>
          Cancel
        </Button>
        <Button onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
            <>
              <RedSpinner size="sm" className="mr-2" label={`Publishing ${platform} live test...`} />
              Publish Live Test
            </>
          ) : 'Publish Live Test'}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
