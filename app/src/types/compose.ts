export type ComposeStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type ComposePlatformKey =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'threads'
  | 'x'
  | 'youtube'
  | 'pinterest';

export type ComposeMediaKind = 'image' | 'video';

export interface ComposeMedia {
  kind: ComposeMediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
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
}

export interface ComposeItem {
  id: string;
  title: string;
  status: ComposeStatus;
  media?: ComposeMedia;
  platforms: ComposePlatformKey[];
  sharedCaption: string;
  platformFields: ComposePlatformFields;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  error?: string;
}
