import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';

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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingDescription, setIsRegeneratingDescription] = useState(false);

  // Update local state when post changes
  useEffect(() => {
    setTitle(post.title);
    setDescription(post.description || '');
    setThumbnailUrl(post.thumbnailUrl || '');
  }, [post]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title Required', {
        description: 'Please enter a title for your video'
      });
      return;
    }

    setIsSaving(true);
    haptics.medium();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

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
    setIsRegenerating(true);

    toast.info('Regenerating Thumbnail', {
      description: 'Creating new thumbnail with overlay settings...'
    });

    // Simulate thumbnail regeneration with overlay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real implementation, this would use the Thumbnail Overlay system
    // to regenerate the thumbnail with the current logo/template settings
    const newThumbnailUrl = `https://image.tmdb.org/t/p/original/regenerated-${Date.now()}.jpg`;
    setThumbnailUrl(newThumbnailUrl);

    setIsRegenerating(false);
    toast.success('Thumbnail Regenerated', {
      description: 'New thumbnail created with your overlay settings'
    });
  };

  const handleUpload = () => {
    haptics.light();
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      haptics.medium();
      
      toast.info('Uploading Thumbnail', {
        description: 'Processing your image...'
      });

      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real implementation, this would upload to Backblaze B2
      const uploadedUrl = URL.createObjectURL(file);
      setThumbnailUrl(uploadedUrl);

      toast.success('Thumbnail Uploaded', {
        description: 'Your custom thumbnail has been uploaded'
      });
    };

    input.click();
  };

  const handleRegenerateTitle = async () => {
    haptics.light();
    setIsRegeneratingTitle(true);

    toast.info('Regenerating Title', {
      description: 'Using AI to create a new title...'
    });

    // Simulate AI title generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate variations based on current title
    const titleVariations = [
      `${post.title.split(' - ')[0]} - Complete Review & Analysis`,
      `${post.title.split(' - ')[0]} - Everything You Need to Know`,
      `${post.title.split(' - ')[0]} - Official Breakdown`,
      `${post.title.split(' - ')[0]} - In-Depth Analysis`,
    ];
    
    const newTitle = titleVariations[Math.floor(Math.random() * titleVariations.length)];
    setTitle(newTitle);

    setIsRegeneratingTitle(false);
    haptics.success();
    toast.success('Title Regenerated', {
      description: 'New AI-generated title created'
    });
  };

  const handleRegenerateDescription = async () => {
    haptics.light();
    setIsRegeneratingDescription(true);

    toast.info('Regenerating Description', {
      description: 'Using AI to create a new description...'
    });

    // Simulate AI description generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate variations based on title
    const descriptionVariations = [
      `Check out our comprehensive review and analysis! We break down everything you need to know. Don't forget to like and subscribe! #Movies #Reviews`,
      `Join us as we dive deep into this incredible content. Full breakdown and insights in this video! Hit that subscribe button! #Entertainment #Analysis`,
      `Everything you need to know in one place! Watch our complete coverage and let us know your thoughts in the comments. #Video #Content`,
      `Don't miss this detailed look! We cover all the important details and share our honest thoughts. Subscribe for more! #Review #Breakdown`,
    ];
    
    const newDescription = descriptionVariations[Math.floor(Math.random() * descriptionVariations.length)];
    setDescription(newDescription);

    setIsRegeneratingDescription(false);
    haptics.success();
    toast.success('Description Regenerated', {
      description: 'New AI-generated description created'
    });
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
                <div className="flex items-center gap-2">
                  {/* Regenerate Button (Icon Only) */}
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="p-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] disabled:opacity-50 transition-all"
                    title="Regenerate with overlay"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {/* Upload Button */}
                  <button
                    onClick={handleUpload}
                    className="px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-all flex items-center gap-2 text-sm"
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