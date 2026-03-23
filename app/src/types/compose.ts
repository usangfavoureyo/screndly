export type ComposeStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type ComposePlatformKey =
  | 'instagram_feed'
  | 'instagram_reels'
  | 'instagram_stories'
  | 'facebook_feed'
  | 'facebook_stories'
  | 'tiktok'
  | 'threads'
  | 'x'
  | 'youtube'
  | 'pinterest';

export type ComposeMediaKind = 'image' | 'video';

export interface ComposeMediaAsset {
  id: string;
  kind: ComposeMediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  order: number;
  previewUrl?: string;
  storageUrl?: string;
  storageFileId?: string;
  uploadStatus?: 'idle' | 'uploading' | 'uploaded' | 'failed';
  uploadError?: string;
}

export type ComposeMedia = ComposeMediaAsset;

export type ComposeMediaSetKind =
  | 'empty'
  | 'single-image'
  | 'single-video'
  | 'multi-image'
  | 'multi-video'
  | 'mixed-media';

export interface ComposeMediaSummary {
  totalAssets: number;
  imageCount: number;
  videoCount: number;
  kind: ComposeMediaSetKind;
}

export interface ComposePlatformCompatibility {
  platform: ComposePlatformKey;
  supported: boolean;
  label: string;
  reason?: string;
}

export interface ComposeSchedule {
  scheduledAt: string;
}

export interface ComposePlatformFields {
  pinterest?: {
    title: string;
    description: string;
    board: string;
  };
  youtube?: {
    title: string;
    description: string;
    playlist: string;
  };
  thumbnails?: {
    shared?: ComposeThumbnailAsset;
    youtube?: ComposeThumbnailAsset;
    x?: ComposeThumbnailAsset;
  };
}

export interface ComposeThumbnailAsset {
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  storageUrl?: string;
  storageFileId?: string;
  uploadStatus?: 'idle' | 'uploading' | 'uploaded' | 'failed';
  uploadError?: string;
}

export interface ComposeItem {
  id: string;
  title: string;
  status: ComposeStatus;
  mediaAssets: ComposeMediaAsset[];
  media?: ComposeMedia;
  platforms: ComposePlatformKey[];
  sharedCaption: string;
  platformFields: ComposePlatformFields;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  error?: string;
}
