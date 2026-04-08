import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { apiClient } from '../lib/api/client';
import { DEFAULT_MODELS } from '../lib/ai/models';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { useDesktopFileDrop } from '../hooks/useDesktopFileDrop';

interface EditMetadataBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    title: string;
    platform: string;
    description?: string;
    thumbnailUrl?: string;
  };
  onSave: (postId: string, updates: { title: string; description: string; thumbnailUrl?: string }) => void;
}

export function EditMetadataBottomSheet({ open, onOpenChange, post, onSave }: EditMetadataBottomSheetProps) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(post.thumbnailUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingDescription, setIsRegeneratingDescription] = useState(false);

  // Update local state when post changes
  useEffect(() => {
    setTitle(post.title);
    setDescription(post.description || '');
    setThumbnailUrl(post.thumbnailUrl || '');
  }, [post]);

  const generateMetadataText = async (target: 'title' | 'description') => {
    const prompt = target === 'title'
      ? [
          `Rewrite this ${post.platform} video title for publication.`,
          'Keep it concise, natural, and platform-appropriate.',
          'Return only the title text.',
          '',
          `Current title: ${title}`,
          description.trim() ? `Current description: ${description}` : '',
        ].filter(Boolean).join('\n')
      : [
          `Rewrite this ${post.platform} video description for publication.`,
          'Keep it useful, natural, and ready to publish.',
          'Return only the description text.',
          '',
          `Title: ${title}`,
          description.trim() ? `Current description: ${description}` : '',
        ].filter(Boolean).join('\n');

    const response = await apiClient.post<{ content: string }>('/api/ai/generate', {
      model: DEFAULT_MODELS.video,
      prompt,
      systemPrompt: `You improve ${post.platform} video metadata for publishing. Do not add labels, notes, or explanation.`,
      temperature: 0.7,
      maxTokens: target === 'title' ? 120 : 400,
    });

    if (!response.success || !response.data?.content) {
      throw new Error(response.error?.message || `Failed to generate ${target}`);
    }

    return response.data.content.trim();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title Required', {
        description: 'Please enter a title for your video'
      });
      return;
    }

    setIsSaving(true);
    haptics.medium();

    onSave(post.id, {
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined
    });

    toast.success('Metadata Updated', {
      description: `${post.platform} post metadata has been updated successfully`
    });

    setIsSaving(false);
    onOpenChange(false);
  };

  const handleRegenerate = async () => {
    haptics.medium();
    toast.error('Thumbnail regeneration is not available here', {
      description: 'Use Thumbnail Overlay settings or upload a custom thumbnail from this sheet.'
    });
  };

  const handleThumbnailFile = (file: File) => {
    haptics.medium();

    const uploadedUrl = URL.createObjectURL(file);
    setThumbnailUrl(uploadedUrl);

    toast.success('Thumbnail attached', {
      description: 'The selected image is attached locally to this metadata edit.'
    });
  };

  const handleUpload = () => {
    haptics.light();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      handleThumbnailFile(file);
    };

    input.click();
  };

  const thumbnailDrop = useDesktopFileDrop({
    accept: 'image/*',
    onFiles: (files) => {
      if (files[0]) {
        handleThumbnailFile(files[0]);
      }
    },
  });

  const handleRegenerateTitle = async () => {
    haptics.light();
    setIsRegeneratingTitle(true);

    toast.info('Regenerating Title', {
      description: 'Using AI to create a new title...'
    });

    try {
      const newTitle = await generateMetadataText('title');
      setTitle(newTitle);
      haptics.success();
      toast.success('Title Regenerated', {
        description: 'New AI-generated title created'
      });
    } catch (error) {
      console.error('Failed to regenerate title:', error);
      haptics.error();
      toast.error('Failed to regenerate title');
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateDescription = async () => {
    haptics.light();
    setIsRegeneratingDescription(true);

    toast.info('Regenerating Description', {
      description: 'Using AI to create a new description...'
    });

    try {
      const newDescription = await generateMetadataText('description');
      setDescription(newDescription);
      haptics.success();
      toast.success('Description Regenerated', {
        description: 'New AI-generated description created'
      });
    } catch (error) {
      console.error('Failed to regenerate description:', error);
      haptics.error();
      toast.error('Failed to regenerate description');
    } finally {
      setIsRegeneratingDescription(false);
    }
  };

  return (
    <BottomSheet 
      open={open} 
      onOpenChange={onOpenChange}
      heightMode="full"
    >
      <BottomSheetHeader>
        <BottomSheetTitle>Edit Metadata</BottomSheetTitle>
        <BottomSheetDescription>
          {post.platform} • Update title, description, and thumbnail
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-6" data-scrollable>
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-900 dark:text-white">Title</Label>
              <button
                onClick={handleRegenerateTitle}
                disabled={isRegeneratingTitle}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Regenerate Title"
              >
                <RefreshCw className={`w-4 h-4 text-black dark:text-white ${isRegeneratingTitle ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                haptics.light();
                setTitle(e.target.value);
              }}
              onFocus={() => haptics.light()}
              placeholder="Enter video title"
              maxLength={100}
              className="w-full px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929] dark:focus:ring-[#292929]"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              {title.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-900 dark:text-white">Description</Label>
              <button
                onClick={handleRegenerateDescription}
                disabled={isRegeneratingDescription}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Regenerate Description"
              >
                <RefreshCw className={`w-4 h-4 text-black dark:text-white ${isRegeneratingDescription ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => {
                haptics.light();
                setDescription(e.target.value);
              }}
              onFocus={() => haptics.light()}
              placeholder="Enter video description"
              maxLength={5000}
              rows={6}
              className="w-full px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929] dark:focus:ring-[#292929] resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              {description.length}/5000 characters
            </p>
          </div>

          {/* Thumbnail URL (for YouTube/Facebook) */}
          {(post.platform === 'YouTube' || post.platform === 'Facebook') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-900 dark:text-white">Thumbnail URL</Label>
                <div className="flex items-center gap-2" {...thumbnailDrop.bind}>
                  {/* Regenerate Button (Icon Only) */}
                  <button
                    onClick={handleRegenerate}
                    className="p-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] disabled:opacity-50 transition-all"
                    title="Regenerate with overlay"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  
                  {/* Upload Button */}
                  <button
                    onClick={handleUpload}
                    className={`px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-all flex items-center gap-2 text-sm ${
                      thumbnailDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                    }`}
                  >
                    Upload Thumbnail
                  </button>
                </div>
              </div>
              
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => {
                  haptics.light();
                  setThumbnailUrl(e.target.value);
                }}
                onFocus={() => haptics.light()}
                placeholder="https://example.com/thumbnail.jpg"
                className="w-full px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929] dark:focus:ring-[#292929]"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Optional: Provide a new thumbnail image URL
              </p>
              
              {/* Thumbnail Preview */}
              {thumbnailUrl && (
                <div className="mt-3">
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail preview"
                    className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-[#333333]"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-white dark:bg-black border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Changes will update the local metadata. To update the actual post on {post.platform}, you'll need to use {post.platform}'s API or dashboard.
            </p>
          </div>
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              haptics.light();
              onOpenChange(false);
            }}
            disabled={isSaving}
            className="border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] bg-white dark:bg-[#000000]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="bg-[#ec1e24] hover:bg-[#d01a1f] text-white"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
