import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CaptionTemplate {
  id: string;
  name: string;
  content: string;
  tone: 'engaging' | 'hype' | 'informative' | 'casual' | 'professional';
  maxLength: number;
  tags: string[];
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

export interface AudioTemplate {
  id: string;
  name: string;
  genre: 'Hip-Hop' | 'Trap' | 'Rap' | 'Pop' | 'Electronic' | 'R&B' | 'Dance' | 'House' | 'Jazz';
  duckingMode: 'Partial' | 'Full Mute' | 'Adaptive';
  volume: number;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

export interface VideoTemplate {
  id: string;
  name: string;
  type: 'review' | 'monthly';
  aspectRatio: '16:9' | '9:16' | '1:1';
  letterboxEnabled: boolean;
  letterboxColor: string;
  audioTemplateId?: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

interface VideoStudioTemplatesContextType {
  captionTemplates: CaptionTemplate[];
  audioTemplates: AudioTemplate[];
  videoTemplates: VideoTemplate[];
  
  // Caption template methods
  addCaptionTemplate: (template: Omit<CaptionTemplate, 'id' | 'createdAt' | 'useCount'>) => void;
  updateCaptionTemplate: (id: string, updates: Partial<CaptionTemplate>) => void;
  deleteCaptionTemplate: (id: string) => void;
  useCaptionTemplate: (id: string) => CaptionTemplate | undefined;
  
  // Audio template methods
  addAudioTemplate: (template: Omit<AudioTemplate, 'id' | 'createdAt' | 'useCount'>) => void;
  updateAudioTemplate: (id: string, updates: Partial<AudioTemplate>) => void;
  deleteAudioTemplate: (id: string) => void;
  useAudioTemplate: (id: string) => AudioTemplate | undefined;
  
  // Video template methods
  addVideoTemplate: (template: Omit<VideoTemplate, 'id' | 'createdAt' | 'useCount'>) => void;
  updateVideoTemplate: (id: string, updates: Partial<VideoTemplate>) => void;
  deleteVideoTemplate: (id: string) => void;
  useVideoTemplate: (id: string) => VideoTemplate | undefined;
}

const VideoStudioTemplatesContext = createContext<VideoStudioTemplatesContextType | undefined>(undefined);

export function VideoStudioTemplatesProvider({ children }: { children: ReactNode }) {
  const [captionTemplates, setCaptionTemplates] = useState<CaptionTemplate[]>([]);
  const [audioTemplates, setAudioTemplates] = useState<AudioTemplate[]>([]);
  const [videoTemplates, setVideoTemplates] = useState<VideoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates from localStorage on mount
  useEffect(() => {
    const savedCaptions = localStorage.getItem('screndlyVideoCaptionTemplates');
    const savedAudio = localStorage.getItem('screndlyVideoAudioTemplates');
    const savedVideo = localStorage.getItem('screndlyVideoTemplates');
    
    if (savedCaptions) {
      try {
        setCaptionTemplates(JSON.parse(savedCaptions));
      } catch (e) {
        console.error('Failed to parse caption templates:', e);
        setCaptionTemplates(getDefaultCaptionTemplates());
      }
    } else {
      setCaptionTemplates(getDefaultCaptionTemplates());
    }
    
    if (savedAudio) {
      try {
        setAudioTemplates(JSON.parse(savedAudio));
      } catch (e) {
        console.error('Failed to parse audio templates:', e);
        setAudioTemplates(getDefaultAudioTemplates());
      }
    } else {
      setAudioTemplates(getDefaultAudioTemplates());
    }
    
    if (savedVideo) {
      try {
        setVideoTemplates(JSON.parse(savedVideo));
      } catch (e) {
        console.error('Failed to parse video templates:', e);
        setVideoTemplates(getDefaultVideoTemplates());
      }
    } else {
      setVideoTemplates(getDefaultVideoTemplates());
    }
    
    setIsLoading(false);
  }, []);

  // Auto-save caption templates
  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem('screndlyVideoCaptionTemplates', JSON.stringify(captionTemplates));
  }, [captionTemplates, isLoading]);

  // Auto-save audio templates
  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem('screndlyVideoAudioTemplates', JSON.stringify(audioTemplates));
  }, [audioTemplates, isLoading]);

  // Auto-save video templates
  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem('screndlyVideoTemplates', JSON.stringify(videoTemplates));
  }, [videoTemplates, isLoading]);

  // Caption template methods
  const addCaptionTemplate = (template: Omit<CaptionTemplate, 'id' | 'createdAt' | 'useCount'>) => {
    const newTemplate: CaptionTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    setCaptionTemplates(prev => [...prev, newTemplate]);
  };

  const updateCaptionTemplate = (id: string, updates: Partial<CaptionTemplate>) => {
    setCaptionTemplates(prev =>
      prev.map(template => (template.id === id ? { ...template, ...updates } : template))
    );
  };

  const deleteCaptionTemplate = (id: string) => {
    setCaptionTemplates(prev => prev.filter(template => template.id !== id));
  };

  const useCaptionTemplate = (id: string) => {
    const template = captionTemplates.find(t => t.id === id);
    if (template) {
      updateCaptionTemplate(id, {
        lastUsed: new Date().toISOString(),
        useCount: template.useCount + 1,
      });
    }
    return template;
  };

  // Audio template methods
  const addAudioTemplate = (template: Omit<AudioTemplate, 'id' | 'createdAt' | 'useCount'>) => {
    const newTemplate: AudioTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    setAudioTemplates(prev => [...prev, newTemplate]);
  };

  const updateAudioTemplate = (id: string, updates: Partial<AudioTemplate>) => {
    setAudioTemplates(prev =>
      prev.map(template => (template.id === id ? { ...template, ...updates } : template))
    );
  };

  const deleteAudioTemplate = (id: string) => {
    setAudioTemplates(prev => prev.filter(template => template.id !== id));
  };

  const useAudioTemplate = (id: string) => {
    const template = audioTemplates.find(t => t.id === id);
    if (template) {
      updateAudioTemplate(id, {
        lastUsed: new Date().toISOString(),
        useCount: template.useCount + 1,
      });
    }
    return template;
  };

  // Video template methods
  const addVideoTemplate = (template: Omit<VideoTemplate, 'id' | 'createdAt' | 'useCount'>) => {
    const newTemplate: VideoTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      useCount: 0,
    };
    setVideoTemplates(prev => [...prev, newTemplate]);
  };

  const updateVideoTemplate = (id: string, updates: Partial<VideoTemplate>) => {
    setVideoTemplates(prev =>
      prev.map(template => (template.id === id ? { ...template, ...updates } : template))
    );
  };

  const deleteVideoTemplate = (id: string) => {
    setVideoTemplates(prev => prev.filter(template => template.id !== id));
  };

  const useVideoTemplate = (id: string) => {
    const template = videoTemplates.find(t => t.id === id);
    if (template) {
      updateVideoTemplate(id, {
        lastUsed: new Date().toISOString(),
        useCount: template.useCount + 1,
      });
    }
    return template;
  };

  return (
    <VideoStudioTemplatesContext.Provider
      value={{
        captionTemplates,
        audioTemplates,
        videoTemplates,
        addCaptionTemplate,
        updateCaptionTemplate,
        deleteCaptionTemplate,
        useCaptionTemplate,
        addAudioTemplate,
        updateAudioTemplate,
        deleteAudioTemplate,
        useAudioTemplate,
        addVideoTemplate,
        updateVideoTemplate,
        deleteVideoTemplate,
        useVideoTemplate,
      }}
    >
      {children}
    </VideoStudioTemplatesContext.Provider>
  );
}

export function useVideoStudioTemplates() {
  const context = useContext(VideoStudioTemplatesContext);
  if (context === undefined) {
    throw new Error('useVideoStudioTemplates must be used within a VideoStudioTemplatesProvider');
  }
  return context;
}

// Default templates
function getDefaultCaptionTemplates(): CaptionTemplate[] {
  return [
    {
      id: '1',
      name: 'Hype Style',
      content: '🔥 {title} is HERE! Don\'t miss this epic {type}! #MustWatch #ComingSoon',
      tone: 'hype',
      maxLength: 280,
      tags: ['action', 'blockbuster', 'thriller'],
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 12,
      lastUsed: '2024-11-18T14:30:00Z',
    },
    {
      id: '2',
      name: 'Informative Style',
      content: '{title} - A {genre} {type} releasing {date}. Directed by {director}.',
      tone: 'informative',
      maxLength: 280,
      tags: ['drama', 'documentary', 'biopic'],
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 8,
      lastUsed: '2024-11-17T09:15:00Z',
    },
    {
      id: '3',
      name: 'Casual Style',
      content: 'Just watched the new {title} trailer and WOW 😍 Can\'t wait for this! {emoji}',
      tone: 'casual',
      maxLength: 280,
      tags: ['comedy', 'romance', 'animation'],
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 15,
      lastUsed: '2024-11-18T16:00:00Z',
    },
  ];
}

function getDefaultAudioTemplates(): AudioTemplate[] {
  return [
    {
      id: '1',
      name: 'Epic Trailer Mix',
      genre: 'Electronic',
      duckingMode: 'Adaptive',
      volume: 0.7,
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 25,
      lastUsed: '2024-11-18T15:00:00Z',
    },
    {
      id: '2',
      name: 'Hype Trap Beat',
      genre: 'Trap',
      duckingMode: 'Partial',
      volume: 0.8,
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 18,
      lastUsed: '2024-11-18T12:30:00Z',
    },
  ];
}

function getDefaultVideoTemplates(): VideoTemplate[] {
  return [
    {
      id: '1',
      name: 'Standard Review (16:9)',
      type: 'review',
      aspectRatio: '16:9',
      letterboxEnabled: false,
      letterboxColor: '#000000',
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 30,
      lastUsed: '2024-11-18T16:30:00Z',
    },
    {
      id: '2',
      name: 'Vertical Stories (9:16)',
      type: 'review',
      aspectRatio: '9:16',
      letterboxEnabled: true,
      letterboxColor: '#000000',
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 22,
      lastUsed: '2024-11-18T14:00:00Z',
    },
    {
      id: '3',
      name: 'Monthly Compilation',
      type: 'monthly',
      aspectRatio: '16:9',
      letterboxEnabled: false,
      letterboxColor: '#000000',
      createdAt: '2024-11-01T10:00:00Z',
      useCount: 10,
      lastUsed: '2024-11-15T10:00:00Z',
    },
  ];
}
