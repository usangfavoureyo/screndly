/**
 * Caption Template Storage
 * Store and manage reusable caption templates as JSON profiles
 */

export interface CaptionTemplate {
  id: string;
  name: string;
  description?: string;
  platform: 'instagram' | 'facebook' | 'threads' | 'x' | 'youtube' | 'tiktok' | 'all';
  template: {
    structure: string;
    includeHashtags: boolean;
    includeEmojis: boolean;
    tone: 'professional' | 'casual' | 'enthusiastic' | 'mysterious' | 'dramatic';
    maxLength?: number;
    callToAction?: string;
    customFields?: Record<string, any>;
  };
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  isFavorite: boolean;
}

const STORAGE_KEY = 'screndly_caption_templates';

/**
 * Default caption templates
 */
const DEFAULT_TEMPLATES: CaptionTemplate[] = [
  {
    id: 'template_instagram_hype',
    name: '🎬 Instagram Hype',
    description: 'Energetic and engaging for Instagram',
    platform: 'instagram',
    template: {
      structure: '[Movie Title] drops [Release Date]! 🔥\n\n[Brief Description]\n\n[Hashtags]\n\n🎟️ Get tickets now!',
      includeHashtags: true,
      includeEmojis: true,
      tone: 'enthusiastic',
      maxLength: 2200,
      callToAction: '🎟️ Get tickets now!'
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: true
  },
  {
    id: 'template_tiktok_viral',
    name: '⚡ TikTok Viral',
    description: 'Short and punchy for TikTok',
    platform: 'tiktok',
    template: {
      structure: '[Movie Title] is coming 👀\n\n[One-liner hook]\n\n[Release Date] 🎬\n\n[Hashtags]',
      includeHashtags: true,
      includeEmojis: true,
      tone: 'casual',
      maxLength: 300,
      callToAction: ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: true
  },
  {
    id: 'template_twitter_announce',
    name: '🐦 Twitter/X Announcement',
    description: 'Professional announcements for X',
    platform: 'x',
    template: {
      structure: '[Movie Title] - Official Trailer\n\n[Brief Description]\n\nIn theaters [Release Date]\n\n[Hashtags]',
      includeHashtags: true,
      includeEmojis: false,
      tone: 'professional',
      maxLength: 280,
      callToAction: ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: true
  },
  {
    id: 'template_youtube_detailed',
    name: '📺 YouTube Detailed',
    description: 'Comprehensive description for YouTube',
    platform: 'youtube',
    template: {
      structure: '[Movie Title] - Official Trailer\n\n[Detailed Description]\n\n🎬 Release Date: [Release Date]\n⭐ Cast: [Cast]\n🎥 Director: [Director]\n\n[Hashtags]\n\n🔔 Subscribe for more trailers!',
      includeHashtags: true,
      includeEmojis: true,
      tone: 'professional',
      maxLength: 5000,
      callToAction: '🔔 Subscribe for more trailers!'
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: true
  },
  {
    id: 'template_threads_conversational',
    name: '🧵 Threads Conversational',
    description: 'Casual and engaging for Threads',
    platform: 'threads',
    template: {
      structure: 'Just watched the new [Movie Title] trailer and... 🤯\n\n[Personal take]\n\nComing [Release Date]. Who\'s watching? 🎬\n\n[Hashtags]',
      includeHashtags: true,
      includeEmojis: true,
      tone: 'casual',
      maxLength: 500,
      callToAction: ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: false
  },
  {
    id: 'template_facebook_detailed',
    name: '📘 Facebook Community',
    description: 'Engaging and detailed for Facebook',
    platform: 'facebook',
    template: {
      structure: '🎬 [Movie Title] - New Trailer Alert!\n\n[Detailed Description]\n\n📅 Release Date: [Release Date]\n\n[Hashtags]\n\n👉 Tag someone who needs to see this!',
      includeHashtags: true,
      includeEmojis: true,
      tone: 'enthusiastic',
      maxLength: 5000,
      callToAction: '👉 Tag someone who needs to see this!'
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isFavorite: false
  }
];

/**
 * Load templates from storage
 */
export function loadCaptionTemplates(): CaptionTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with defaults
      saveCaptionTemplates(DEFAULT_TEMPLATES);
      return DEFAULT_TEMPLATES;
    }
    
    const templates = JSON.parse(stored);
    return templates;
  } catch (error) {
    console.error('Failed to load caption templates:', error);
    return DEFAULT_TEMPLATES;
  }
}

/**
 * Save templates to storage
 */
export function saveCaptionTemplates(templates: CaptionTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save caption templates:', error);
  }
}

/**
 * Create a new template
 */
export function createCaptionTemplate(template: Omit<CaptionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): CaptionTemplate {
  const templates = loadCaptionTemplates();
  
  const newTemplate: CaptionTemplate = {
    ...template,
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0
  };
  
  templates.push(newTemplate);
  saveCaptionTemplates(templates);
  
  return newTemplate;
}

/**
 * Update an existing template
 */
export function updateCaptionTemplate(id: string, updates: Partial<Omit<CaptionTemplate, 'id' | 'createdAt'>>): CaptionTemplate | null {
  const templates = loadCaptionTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index === -1) {
    return null;
  }
  
  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: Date.now()
  };
  
  saveCaptionTemplates(templates);
  return templates[index];
}

/**
 * Delete a template
 */
export function deleteCaptionTemplate(id: string): boolean {
  const templates = loadCaptionTemplates();
  const filtered = templates.filter(t => t.id !== id);
  
  if (filtered.length === templates.length) {
    return false; // Template not found
  }
  
  saveCaptionTemplates(filtered);
  return true;
}

/**
 * Get a single template by ID
 */
export function getCaptionTemplate(id: string): CaptionTemplate | null {
  const templates = loadCaptionTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * Get templates by platform
 */
export function getCaptionTemplatesByPlatform(platform: CaptionTemplate['platform']): CaptionTemplate[] {
  const templates = loadCaptionTemplates();
  return templates.filter(t => t.platform === platform || t.platform === 'all');
}

/**
 * Increment template usage count
 */
export function incrementTemplateUsage(id: string): void {
  const templates = loadCaptionTemplates();
  const template = templates.find(t => t.id === id);
  
  if (template) {
    template.usageCount++;
    template.updatedAt = Date.now();
    saveCaptionTemplates(templates);
  }
}

/**
 * Toggle template favorite status
 */
export function toggleTemplateFavorite(id: string): boolean {
  const templates = loadCaptionTemplates();
  const template = templates.find(t => t.id === id);
  
  if (template) {
    template.isFavorite = !template.isFavorite;
    template.updatedAt = Date.now();
    saveCaptionTemplates(templates);
    return template.isFavorite;
  }
  
  return false;
}

/**
 * Get favorite templates
 */
export function getFavoriteTemplates(): CaptionTemplate[] {
  const templates = loadCaptionTemplates();
  return templates.filter(t => t.isFavorite);
}

/**
 * Get most used templates
 */
export function getMostUsedTemplates(limit: number = 5): CaptionTemplate[] {
  const templates = loadCaptionTemplates();
  return templates
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

/**
 * Duplicate a template
 */
export function duplicateCaptionTemplate(id: string, newName?: string): CaptionTemplate | null {
  const template = getCaptionTemplate(id);
  
  if (!template) {
    return null;
  }
  
  return createCaptionTemplate({
    name: newName || `${template.name} (Copy)`,
    description: template.description,
    platform: template.platform,
    template: { ...template.template },
    isFavorite: false
  });
}

/**
 * Export templates as JSON
 */
export function exportTemplates(): string {
  const templates = loadCaptionTemplates();
  return JSON.stringify(templates, null, 2);
}

/**
 * Import templates from JSON
 */
export function importTemplates(jsonString: string, merge: boolean = true): boolean {
  try {
    const imported: CaptionTemplate[] = JSON.parse(jsonString);
    
    if (!Array.isArray(imported)) {
      throw new Error('Invalid format: expected array of templates');
    }
    
    if (merge) {
      const existing = loadCaptionTemplates();
      const merged = [...existing];
      
      imported.forEach(importedTemplate => {
        const existingIndex = merged.findIndex(t => t.id === importedTemplate.id);
        if (existingIndex >= 0) {
          // Update existing
          merged[existingIndex] = importedTemplate;
        } else {
          // Add new
          merged.push(importedTemplate);
        }
      });
      
      saveCaptionTemplates(merged);
    } else {
      // Replace all
      saveCaptionTemplates(imported);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to import templates:', error);
    return false;
  }
}

/**
 * Reset to default templates
 */
export function resetToDefaultTemplates(): void {
  saveCaptionTemplates(DEFAULT_TEMPLATES);
}
