export type AspectRatio = '16:9' | '9:16' | '1:1';
export type MusicGenre = 'Hip-Hop' | 'Trap' | 'Rap' | 'Pop' | 'Electronic' | 'R&B' | 'House';
export type DuckingMode = 'Partial' | 'Full Mute' | 'Adaptive';
export type VideoFitMode = 'contain' | 'cover';

// Data Structures
export interface VideoTitleData {
    title: string;
    tmdbId?: number;
    year?: string;
    type?: 'movie' | 'tv';
    autoDetected?: boolean;
    voiceoverTimestamp?: string;
}

export interface AudioFile {
    name: string;
    size: number;
    url: string;
    uploadedUrl?: string;
    originalFile?: File;
    contentType?: string;
    durationSeconds?: number;
}

export interface DetectedTitle {
    title: string;
    releaseDate?: string;
    timestamp: string;
    confidence: number;
    context: string;
}


export interface Scene {
    description: string;
    startTime: string;
    endTime: string;
    details?: string;
    duration?: number;
}

export type PromptStatus = 'empty' | 'ready' | 'outdated' | 'warning';


export const aspectRatios: AspectRatio[] = ['16:9', '9:16', '1:1'];
export const musicGenres: MusicGenre[] = ['Hip-Hop', 'Trap', 'Rap', 'Pop', 'Electronic', 'R&B', 'House'];
export const duckingModes: DuckingMode[] = ['Partial', 'Full Mute', 'Adaptive'];
