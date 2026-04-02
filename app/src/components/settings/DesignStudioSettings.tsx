import { useState, useEffect, useRef } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { PinterestBoardSelect } from '../ui/pinterest-board-select';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { useSettings } from '../../contexts/SettingsContext';
import { useRSSFeeds } from '../../contexts/RSSFeedsContext';
import { AI_MODELS, DEFAULT_MODELS, getModelDisplayName, normalizeAIModelId } from '../../lib/ai/models';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';
import { designStudioPromptDefaults } from '../../config/cultureCravePromptDefaults';
import { BackIconButton } from '../BackIconButton';
import { fetchDesignStudioState } from '../../lib/api/designStudio';

interface DesignStudioSettingsProps {
  onSavex: () => void;
  onBack: () => void;
}

const DESIGN_STUDIO_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY = 'screndly_culturecrave_design_studio_prompts_v1';

const DEFAULT_AUTO_TRIGGER_KEYWORDS = [
  'renewed',
  'renewal',
  'canceled',
  'cancelled',
  'confirmed',
  'release date',
  'releasing',
  'premiere',
  'premieres',
  'in development',
];

const DESIGN_STUDIO_SHARED_SETTING_KEYS = new Set([
  'captionPosterPrompt',
  'captionCarouselPrompt',
  'captionStoryPrompt',
  'captionAnnouncementPrompt',
  'captionGeneralPrompt',
  'designStudioPinterestTitlePrompt',
  'designStudioPinterestDescriptionPrompt',
  'designStudioPinterestBoardPrompt',
  'designStudioAutoEnabled',
  'designStudioAutoPost',
  'designStudioDefaultAutoTemplateId',
  'designStudioPostingInterval',
  'designStudioTriggerKeywords',
  'designStudioBannedKeywords',
  'designStudioSelectedRssFeedIds',
  'designStudioMaxEditorialsPerRun',
  'designStudioCaptionLengthMode',
  'designStudioMinimumScoreThreshold',
  'designStudioTargetPlatforms',
  'designStudioAutoUpdatedAt',
]);

const DESIGN_STUDIO_CAPTION_PROMPTS = [
  {
    key: 'captionPosterPrompt',
    id: 'caption-poster-prompt',
    label: 'Poster Caption Prompt',
    description: 'Prompt used for movie and TV poster reveals, promo art, and key art announcements.',
    placeholder: 'Enter caption prompt for poster content...',
  },
  {
    key: 'captionCarouselPrompt',
    id: 'caption-carousel-prompt',
    label: 'Carousel Caption Prompt',
    description: 'Prompt used for multi-image carousel posts such as cast slides, stills, and BTS content.',
    placeholder: 'Enter caption prompt for carousel content...',
  },
  {
    key: 'captionStoryPrompt',
    id: 'caption-story-prompt',
    label: 'Story Caption Prompt',
    description: 'Prompt used for vertical story-style graphics and fast, short-form updates.',
    placeholder: 'Enter caption prompt for story content...',
  },
  {
    key: 'captionAnnouncementPrompt',
    id: 'caption-announcement-prompt',
    label: 'Announcement Caption Prompt',
    description: 'Prompt used for release dates, cast reveals, awards, milestones, and other major announcements.',
    placeholder: 'Enter caption prompt for announcement content...',
  },
  {
    key: 'captionGeneralPrompt',
    id: 'caption-general-prompt',
    label: 'General Caption Prompt',
    description: 'Prompt used for general movie and TV content that does not fit another design category.',
    placeholder: 'Enter caption prompt for general content...',
  },
] as const;

function normalizeDesignStudioSettings<T extends Record<string, any>>(settings: T): T {
  return {
    ...settings,
    captionOpenaiModel: normalizeAIModelId(settings.captionOpenaiModel, DEFAULT_MODELS.designStudio),
  };
}

// Default prompt system settings
const defaultSettings = {
  // Caption Generation Settings
  captionOpenaiModel: DEFAULT_MODELS.designStudio,
  captionTemperature: 0.7,
  captionMaxTokens: 500,

  // Section-Specific Caption Prompts
  captionPosterPrompt: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for movie/TV poster announcements and promotional graphics.

INPUT: Movie/TV title, tagline, release info, and any additional context
OUTPUT: Poster-focused caption (120-280 characters)

Guidelines:
- Create excitement around the visual/poster reveal
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Include relevant movie/show details (release date, cast, etc.)
- Use line breaks for readability when necessary
- Focus on visual appeal and announcement energy
- Match the tone to the content (blockbuster hype, indie charm, prestige drama, etc.)
- Examples of style:
  * "First look at [TITLE] starring [CAST]. Coming to theaters [DATE]."
  * "[TITLE] drops [DATE]. This is going to be incredible."
  * "New poster for [TITLE]. Everything you've heard is true."`,

  captionCarouselPrompt: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for multi-image carousel posts featuring cast photos, stills, or behind-the-scenes content.

INPUT: Movie/TV title, carousel theme, and context about the images
OUTPUT: Carousel-focused caption (120-280 characters)

Guidelines:
- Encourage users to swipe through the carousel
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use phrases like "Swipe to see", "Slide through", or variations
- Highlight what makes the carousel valuable (cast reveal, evolution, comparison, etc.)
- Use line breaks for readability when necessary
- Match the tone to the content type
- Examples of style:
  * "Swipe through for the full [TITLE] cast reveal. Thoughts|"
  * "The evolution of [CHARACTER] across all [NUMBER] films."
  * "Behind the scenes of [TITLE]. Slide to see the transformation."`,

  captionStoryPrompt: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for Instagram/Facebook Story-style vertical graphics (9:16).

INPUT: Movie/TV title, story theme, and quick announcement details
OUTPUT: Story-focused caption (80-200 characters)

Guidelines:
- Keep it VERY short and punchy: 80-200 characters
- NO emojis unless specifically requested
- Perfect for quick announcements, quotes, or teases
- Use conversational, immediate language
- Focus on urgency or FOMO when appropriate
- Use line breaks sparingly due to character limit
- Examples of style:
  * "[TITLE] is finally here"
  * "This scene from [TITLE] lives rent free in my head"
  * "Dropping tomorrow: [TITLE]"
  * "[TITLE] just broke the internet"`,

  captionAnnouncementPrompt: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for major announcements (cast reveals, release dates, awards, box office milestones).

INPUT: Announcement type and details (cast, date, award, milestone, etc.)
OUTPUT: Announcement-focused caption (120-280 characters)

Guidelines:
- Lead with the most important information
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use clear, direct language for maximum impact
- Include specific details (dates, names, numbers)
- Use line breaks to separate key information
- Match urgency to announcement importance
- Examples of style:
  * "BREAKING: [ACTOR] joins [TITLE] cast. Production starts [DATE]."
  * "[TITLE] crosses $500M worldwide. Now playing everywhere."
  * "Best Picture nominee [TITLE] expands to 2,000+ theaters this weekend."
  * "First trailer for [TITLE] drops tomorrow at 9am PT."`,

  captionGeneralPrompt: `You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions for general movie/TV content that doesn't fit other specific categories.

INPUT: Content description and context
OUTPUT: General caption (120-280 characters)

Guidelines:
- Adapt tone to the specific content
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Be authentic and engaging
- Use line breaks for readability when necessary
- Include relevant details without overcrowding
- Vary call-to-action phrasing
- Examples of style:
  * "Everything you need to know about [TITLE]."
  * "This moment from [TITLE] deserves its own appreciation post."
  * "Celebrating the legacy of [TITLE] on its [NUMBER]th anniversary."`,

  captionIncludeEmojis: false,
  captionIncludeHashtags: true,
  captionMaxLength: 280,
  captionTone: 'engaging', // engaging, professional, casual, hype

  // Pinterest Publishing Settings
  designStudioPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movie and TV show design graphics.

INPUT: Movie/TV title, design type (poster/carousel/story/announcement), content context
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + Design Type/Context
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Batman (2025) - Official Movie Poster | DC Comics"
- "Stranger Things Cast Photos - Netflix Series Carousel"
- "Wednesday Season 2 Announcement | 2025 Netflix Series"
- "Dune: Part Three Character Posters | 2026 Sci-Fi Epic"

Guidelines:
- Identify the design type and purpose
- Include year for searchability when relevant
- Use " | " separator for clarity
- Prioritize search terms users would type
- Focus on visual content being shared

Tone: Clear, searchable, design-focused, optimized for Pinterest discovery`,

  designStudioPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movie and TV show design graphics.

INPUT: Movie/TV title, design type, content details, context
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Title, design type, hook
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Design description (2-3 sentences)
3. Key details (cast, release date, etc.)
4. Hashtags (3-5 relevant tags)
5. CTA (Save for later, Get inspiration, etc.)

Example:
"Official poster for The Batman (2025)! 🦇 Matt Reeves' epic sequel features this stunning new poster design showcasing Robert Pattinson as the Dark Knight. The darker, grittier aesthetic perfectly captures Gotham's atmosphere. Coming to theaters Summer 2025. #TheBatman #MoviePoster #DCComics #FilmDesign #GraphicDesign

Save this for your watchlist! 🎬"

Guidelines:
- Describe the visual/design prominently
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Include searchable hashtags (design + content)
- Make first sentence compelling and complete
- Appeal to design enthusiasts and fans

Tone: Inspiring, design-focused, visually-oriented, optimized for Pinterest users seeking creative inspiration`,

  designStudioPinterestBoardPrompt: `You are a Pinterest board strategist for Screen Render. Suggest the most appropriate Pinterest board name for movie and TV show design graphics.

INPUT: Movie/TV title, design type (poster/carousel/story/announcement), genre, context
OUTPUT: Pinterest board name (maximum 50 characters)

Board Selection Guidelines:
- Match content type to board purpose
- Consider existing Screen Render boards
- Optimize for discoverability
- Keep names clear and searchable

Suggested Boards by Design Type:
- Movie Posters → "Movie Posters & Film Design"
- TV Show Posters → "TV Show Posters & Series Design"
- Cast Carousels → "Cast Photos & Character Design"
- Announcements → "Movie & TV News"
- Story Graphics → "Entertainment News & Updates"
- Character Posters → "Character Posters & Concepts"
- General Design → "Film & TV Graphic Design"

Output Format:
Return only the board name, nothing else. Maximum 50 characters.

Examples:
- "Movie Posters & Film Design"
- "TV Show Posters & Series Design"
- "Cast Photos & Character Design"
- "Entertainment News & Updates"

Tone: Clear, category-focused, SEO-friendly`,

  // Photopea Integration Settings
  autoPreviewEnabled: true,
  renderQuality: 'high', // low, medium, high, maximum
  exportFormat: 'jpeg', // jpeg, png
  jpegQuality: 90,
  designStudioAutoEnabled: false,
  designStudioAutoPost: false,
  designStudioDefaultAutoTemplateId: null,
  designStudioPostingInterval: '5',
  designStudioTriggerKeywords: [...DEFAULT_AUTO_TRIGGER_KEYWORDS],
  designStudioBannedKeywords: [] as string[],
  designStudioSelectedRssFeedIds: [] as string[],
  designStudioMaxEditorialsPerRun: 5,
  designStudioCaptionLengthMode: 'medium',
  designStudioMinimumScoreThreshold: 55,
  designStudioTargetPlatforms: ['x', 'threads'],
  designStudioAutoUpdatedAt: new Date().toISOString(),
  ...designStudioPromptDefaults,
};

type DesignTemplateOption = {
  id: string;
  name: string;
  layoutVariant?: string;
  isValidated?: boolean;
};

export function DesignStudioSettings({ onSave, onBack }: DesignStudioSettingsProps) {
  const { settings: globalSettings, updateSetting: updateGlobalSetting } = useSettings();
  const { feeds } = useRSSFeeds();
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newTriggerKeyword, setNewTriggerKeyword] = useState('');
  const [newBannedKeyword, setNewBannedKeyword] = useState('');
  const [templateOptions, setTemplateOptions] = useState<DesignTemplateOption[]>([]);
  const initialSharedSettingsRef = useRef<Record<string, any> | null>(null);

  if (initialSharedSettingsRef.current === null) {
    initialSharedSettingsRef.current = Object.fromEntries(
      Object.entries(globalSettings as Record<string, any>).filter(([key]) =>
        DESIGN_STUDIO_SHARED_SETTING_KEYS.has(key)
      )
    );
  }

  // Load settings from localStorage + shared persisted prompt settings on mount
  useEffect(() => {
    const sharedSettings = initialSharedSettingsRef.current || {};
    const savedSettings = localStorage.getItem('screndly_design_studio_settings');
    const shouldInjectCultureCravePrompts = !localStorage.getItem(DESIGN_STUDIO_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY);
    if (savedSettings) {
      try {
        const parsed = normalizeDesignStudioSettings(JSON.parse(savedSettings));
        const nextSettings = { ...defaultSettings, ...sharedSettings, ...parsed };
        setSettings(normalizeDesignStudioSettings(nextSettings));
      } catch (error) {
        console.error('Error loading Design Studio settings:', error);
        setSettings(normalizeDesignStudioSettings({ ...defaultSettings, ...sharedSettings }));
      }
    } else {
      setSettings(normalizeDesignStudioSettings({ ...defaultSettings, ...sharedSettings }));
    }
    if (shouldInjectCultureCravePrompts) {
      localStorage.setItem(DESIGN_STUDIO_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY, 'true');
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('screndly_design_studio_settings', JSON.stringify(normalizeDesignStudioSettings(settings)));
    }
  }, [settings, isLoaded]);

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      try {
        const state = await fetchDesignStudioState();
        if (!isMounted) {
          return;
        }

        const nextTemplates = (state.templates || [])
          .filter((template) => template.isValidated !== false)
          .map((template) => ({
            id: template.id,
            name: template.name,
            layoutVariant: template.layoutVariant,
            isValidated: template.isValidated !== false,
          }));
        setTemplateOptions(nextTemplates);
      } catch (error) {
        console.error('Failed to load Design Studio templates for settings:', error);
        if (isMounted) {
          setTemplateOptions([]);
        }
      }
    };

    void loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => {
      const next = normalizeDesignStudioSettings({ ...prev, [key]: value });
      localStorage.setItem('screndly_design_studio_settings', JSON.stringify(next));
      return next;
    });

    if (DESIGN_STUDIO_SHARED_SETTING_KEYS.has(key)) {
      updateGlobalSetting(key, value);
    }

    // Show toast notifications for important settings
    if (key === 'captionOpenaiModel') {
      toast.success(`Caption AI Model changed to ${getModelDisplayName(value)}`);
    }

    if (key === 'captionTone') {
      const toneNames: Record<string, string> = {
        'engaging': 'Engaging',
        'hype': 'Hype & Excitement',
        'professional': 'Professional',
        'casual': 'Casual & Friendly'
      };
      toast.success(`Caption Tone: ${toneNames[value] || value}`);
    }

    if (key === 'renderQuality') {
      const qualityNames: Record<string, string> = {
        'low': 'Low (Faster)',
        'medium': 'Medium',
        'high': 'High (Recommended)',
        'maximum': 'Maximum (Slower)'
      };
      toast.success(`Render Quality: ${qualityNames[value] || value}`);
    }

    if (onSave) {
      setTimeout(onSave, 100);
    }
  };

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const existingIds = new Set(feeds.map((feed) => feed.id));
    const selectedIds = Array.isArray(settings.designStudioSelectedRssFeedIds)
      ? settings.designStudioSelectedRssFeedIds
      : [];
    const prunedIds = selectedIds.filter((id) => existingIds.has(id));

    if (selectedIds.length !== prunedIds.length) {
      updateSetting('designStudioSelectedRssFeedIds', prunedIds);
    }
  }, [feeds, isLoaded, settings.designStudioSelectedRssFeedIds]);

  const toggleRssFeedSelection = (feedId: string) => {
    const selectedIds = Array.isArray(settings.designStudioSelectedRssFeedIds)
      ? settings.designStudioSelectedRssFeedIds
      : [];
    const nextSelectedIds = selectedIds.includes(feedId)
      ? selectedIds.filter((id) => id !== feedId)
      : [...selectedIds, feedId];
    updateSetting('designStudioSelectedRssFeedIds', nextSelectedIds);
    updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
  };

  const addTriggerKeyword = () => {
    const trimmed = newTriggerKeyword.trim();
    if (!trimmed) {
      return;
    }

    const currentKeywords = Array.isArray(settings.designStudioTriggerKeywords)
      ? settings.designStudioTriggerKeywords
      : [];
    const exists = currentKeywords.some((keyword) => keyword.toLowerCase() === trimmed.toLowerCase());

    if (exists) {
      toast.info('Keyword already added');
      return;
    }

    updateSetting('designStudioTriggerKeywords', [...currentKeywords, trimmed]);
    updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
    setNewTriggerKeyword('');
  };

  const removeTriggerKeyword = (keywordToRemove: string) => {
    const currentKeywords = Array.isArray(settings.designStudioTriggerKeywords)
      ? settings.designStudioTriggerKeywords
      : [];
    updateSetting(
      'designStudioTriggerKeywords',
      currentKeywords.filter((keyword) => keyword !== keywordToRemove),
    );
    updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
  };

  const addBannedKeyword = () => {
    const trimmed = newBannedKeyword.trim();
    if (!trimmed) {
      return;
    }

    const currentKeywords = Array.isArray(settings.designStudioBannedKeywords)
      ? settings.designStudioBannedKeywords
      : [];
    const exists = currentKeywords.some((keyword) => keyword.toLowerCase() === trimmed.toLowerCase());

    if (exists) {
      toast.info('Banned keyword already added');
      return;
    }

    updateSetting('designStudioBannedKeywords', [...currentKeywords, trimmed]);
    updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
    setNewBannedKeyword('');
  };

  const removeBannedKeyword = (keywordToRemove: string) => {
    const currentKeywords = Array.isArray(settings.designStudioBannedKeywords)
      ? settings.designStudioBannedKeywords
      : [];
    updateSetting(
      'designStudioBannedKeywords',
      currentKeywords.filter((keyword) => keyword !== keywordToRemove),
    );
    updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
  };

  const resetToDefaults = () => {
    setSettings(normalizeDesignStudioSettings(defaultSettings));
    toast.success('Reset to recommended settings');
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">Design Studio</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="design_studio_settings"
          description="Enable AI-powered optimization to automatically improve captions and model selection for design content based on performance analytics."
        />

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* General Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">General</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Configure output defaults, rendering quality, and storage-friendly export behavior.
            </p>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Manual Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Manual</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Configure PSD-driven manual template handling, prompt behavior, and reusable design workflows.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4">
            <p className="text-sm text-gray-900 dark:text-white">Template Source Behavior</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Manual mode keeps using PSD templates from device uploads and Backblaze imports. Validated templates can also be reused by Auto mode.
            </p>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Caption Generation Settings */}
        <div className="space-y-4">
          <h3 className="text-gray-900 dark:text-white">Caption Generation</h3>

          <div>
            <Label htmlFor="caption-model" className="text-[#9CA3AF]">Caption AI Model</Label>
            <Select
              value={settings.captionOpenaiModel}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('captionOpenaiModel', value);
              }}
            >
              <SelectTrigger id="caption-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Model used to generate social media captions for static designs
            </p>
          </div>

          <div>
            <Label htmlFor="caption-temperature" className="text-[#9CA3AF]">Caption Temperature</Label>
            <div className="flex gap-3 items-center mt-1">
              <Input
                id="caption-temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.captionTemperature}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('captionTemperature', parseFloat(e.target.value));
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap min-w-[100px]">
                {settings.captionTemperature < 0.5 ? 'Focused' : settings.captionTemperature < 1 ? 'Balanced' : 'Creative'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Recommended: 0.7 — Balanced creativity for engaging captions
            </p>
          </div>

          <div>
            <Label htmlFor="caption-max-tokens" className="text-[#9CA3AF]">Caption Max Tokens</Label>
            <Input
              id="caption-max-tokens"
              type="number"
              min="100"
              max="1000"
              step="50"
              value={settings.captionMaxTokens}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('captionMaxTokens', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Maximum tokens for caption generation (Recommended: 500)
            </p>
          </div>

          {/* Caption Options */}
          <div>
            <Label htmlFor="caption-tone" className="text-[#9CA3AF]">Caption Tone</Label>
            <Select
              value={settings.captionTone}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('captionTone', value);
              }}
            >
              <SelectTrigger id="caption-tone" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engaging">Engaging</SelectItem>
                <SelectItem value="hype">Hype & Excitement</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual & Friendly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Overall tone and style for generated captions
            </p>
          </div>

          <div>
            <Label htmlFor="caption-max-length" className="text-[#9CA3AF]">Caption Max Length</Label>
            <Input
              id="caption-max-length"
              type="number"
              min="100"
              max="500"
              step="10"
              value={settings.captionMaxLength}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('captionMaxLength', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Maximum character length for generated captions (Recommended: 250-280)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="caption-emojis" className="text-[#9CA3AF]">Include Emojis</Label>
            <Switch
              id="caption-emojis"
              checked={settings.captionIncludeEmojis}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('captionIncludeEmojis', checked);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="caption-hashtags" className="text-[#9CA3AF]">Include Hashtags</Label>
            <Switch
              id="caption-hashtags"
              checked={settings.captionIncludeHashtags}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('captionIncludeHashtags', checked);
              }}
            />
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Section-Specific Caption Prompts */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Content-Specific Caption Prompts</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Customize caption generation prompts for different design types
            </p>
          </div>

          {DESIGN_STUDIO_CAPTION_PROMPTS.map((promptConfig) => (
            <div key={promptConfig.key}>
              <Label htmlFor={promptConfig.id} className="text-[#9CA3AF]">{promptConfig.label}</Label>
              <Textarea
                id={promptConfig.id}
                value={settings[promptConfig.key] || ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting(promptConfig.key, e.target.value);
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs"
                placeholder={promptConfig.placeholder}
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
                {promptConfig.description}
              </p>
            </div>
          ))}
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Auto Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Auto</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Generate selective editorial cards automatically from chosen RSS feed sources and trigger keywords.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4">
            <div>
              <Label htmlFor="design-studio-auto-enabled" className="text-[#9CA3AF]">Enable Auto Editorials</Label>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Turn on selective editorial generation for matching entertainment-news updates.
              </p>
            </div>
            <Switch
              id="design-studio-auto-enabled"
              checked={settings.designStudioAutoEnabled}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('designStudioAutoEnabled', checked);
                updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm text-gray-900 dark:text-white">RSS Feed Sources</h4>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                  Choose which RSS feeds can generate auto editorials
                </p>
              </div>
              {feeds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateSetting('designStudioSelectedRssFeedIds', feeds.map((feed) => feed.id));
                      updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                    }}
                    className="rounded-full border border-gray-200 dark:border-[#333333] px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateSetting('designStudioSelectedRssFeedIds', []);
                      updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                    }}
                    className="rounded-full border border-gray-200 dark:border-[#333333] px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {feeds.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 text-center">
                <p className="text-sm text-gray-900 dark:text-white">No RSS feeds available</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                  Add RSS feeds in the Feeds page to use them for Auto editorials
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {feeds.map((feed) => {
                  const selected = (settings.designStudioSelectedRssFeedIds || []).includes(feed.id);
                  return (
                    <button
                      key={feed.id}
                      type="button"
                      onClick={() => toggleRssFeedSelection(feed.id)}
                      className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 text-left"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-gray-900 dark:text-white">{feed.name}</p>
                          <p className="truncate text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">{feed.url}</p>
                        </div>
                        <Switch
                          checked={selected}
                          onCheckedChange={() => toggleRssFeedSelection(feed.id)}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm text-gray-900 dark:text-white">Editorial Trigger Keywords</h4>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Titles from selected feeds must match one of these keywords or phrases before an editorial is generated.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={newTriggerKeyword}
                onFocus={() => haptics.light()}
                onChange={(e) => setNewTriggerKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTriggerKeyword();
                  }
                }}
                placeholder="Add keyword or phrase"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addTriggerKeyword}
                className="rounded-xl bg-[#ec1e24] px-4 py-2 text-sm text-white hover:bg-[#d01a20]"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(settings.designStudioTriggerKeywords || []).map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => removeTriggerKeyword(keyword)}
                  className="rounded-full border border-gray-200 dark:border-[#333333] px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                >
                  {keyword} ×
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                updateSetting('designStudioTriggerKeywords', [...DEFAULT_AUTO_TRIGGER_KEYWORDS]);
                updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
              }}
              className="rounded-full border border-gray-200 dark:border-[#333333] px-4 py-2 text-sm text-gray-900 dark:text-white"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm text-gray-900 dark:text-white">Banned Keywords</h4>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Titles from selected feeds will be skipped if they contain any banned keyword or phrase.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={newBannedKeyword}
                onFocus={() => haptics.light()}
                onChange={(e) => setNewBannedKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBannedKeyword();
                  }
                }}
                placeholder="Add banned keyword or phrase"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addBannedKeyword}
                className="rounded-xl bg-[#ec1e24] px-4 py-2 text-sm text-white hover:bg-[#d01a20]"
              >
                Add
              </button>
            </div>

            {(settings.designStudioBannedKeywords || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(settings.designStudioBannedKeywords || []).map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => removeBannedKeyword(keyword)}
                    className="rounded-full border border-gray-200 dark:border-[#333333] px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                  >
                    {keyword} x
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                No banned keywords added yet.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="design-studio-default-auto-template" className="text-[#9CA3AF]">Default Auto Template</Label>
            <Select
              value={settings.designStudioDefaultAutoTemplateId || 'none'}
              onValueChange={(value) => {
                updateSetting('designStudioDefaultAutoTemplateId', value === 'none' ? null : value);
                updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
              }}
            >
              <SelectTrigger id="design-studio-default-auto-template" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default template</SelectItem>
                {templateOptions.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}{template.layoutVariant ? ` | ${template.layoutVariant}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Only validated templates appear here for Auto editorial generation.
            </p>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Posting Platforms</Label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[
                { id: 'x', label: 'X' },
                { id: 'threads', label: 'Threads' },
                { id: 'facebook', label: 'Facebook' },
                { id: 'pinterest', label: 'Pinterest' },
              ].map((platform) => {
                const activePlatforms = settings.designStudioTargetPlatforms || [];
                const checked = activePlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => {
                      const nextPlatforms = checked
                        ? activePlatforms.filter((entry) => entry !== platform.id)
                        : [...activePlatforms, platform.id];
                      updateSetting('designStudioTargetPlatforms', nextPlatforms);
                      updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      checked
                        ? 'border-[#ec1e24] bg-[#ec1e24] text-white'
                        : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white'
                    }`}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="design-studio-posting-interval" className="text-[#9CA3AF]">Posting Interval</Label>
              <Select
                value={settings.designStudioPostingInterval || '5'}
                onValueChange={(value) => {
                  updateSetting('designStudioPostingInterval', value);
                  updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                }}
              >
                <SelectTrigger id="design-studio-posting-interval" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4', '5', '10', '15', '20'].map((value) => (
                    <SelectItem key={value} value={value}>{value} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="design-studio-caption-length" className="text-[#9CA3AF]">Caption Length</Label>
              <Select
                value={settings.designStudioCaptionLengthMode || 'medium'}
                onValueChange={(value) => {
                  updateSetting('designStudioCaptionLengthMode', value);
                  updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                }}
              >
                <SelectTrigger id="design-studio-caption-length" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="design-studio-max-editorials" className="text-[#9CA3AF]">Max Editorials Per Run</Label>
              <Input
                id="design-studio-max-editorials"
                type="number"
                min="1"
                max="20"
                value={settings.designStudioMaxEditorialsPerRun || 5}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  updateSetting('designStudioMaxEditorialsPerRun', Math.min(20, Math.max(1, Number.parseInt(e.target.value || '5', 10) || 5)));
                  updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
            </div>

            <div>
              <Label htmlFor="design-studio-score-threshold" className="text-[#9CA3AF]">Minimum Score Threshold</Label>
              <Input
                id="design-studio-score-threshold"
                type="number"
                min="0"
                max="100"
                value={settings.designStudioMinimumScoreThreshold || 55}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  updateSetting('designStudioMinimumScoreThreshold', Math.min(100, Math.max(0, Number.parseInt(e.target.value || '55', 10) || 55)));
                  updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4">
            <div>
              <Label htmlFor="design-studio-auto-post" className="text-[#9CA3AF]">Auto Post</Label>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Automatically publish scheduled editorials to the selected platforms.
              </p>
            </div>
            <Switch
              id="design-studio-auto-post"
              checked={settings.designStudioAutoPost}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('designStudioAutoPost', checked);
                updateSetting('designStudioAutoUpdatedAt', new Date().toISOString());
              }}
            />
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Pinterest Publishing Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Pinterest Publishing Settings</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for design graphics.
            </p>
          </div>

          {/* Pinterest Title Generation Prompt */}
          <div>
            <Label htmlFor="design-studio-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="design-studio-pinterest-title-prompt"
              value={settings.designStudioPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('designStudioPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters with design-focused keywords
            </p>
          </div>

          {/* Pinterest Description Generation Prompt */}
          <div>
            <Label htmlFor="design-studio-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="design-studio-pinterest-description-prompt"
              value={settings.designStudioPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('designStudioPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with visual-focused hooks and design hashtags
            </p>
          </div>

          {/* Pinterest Board Generation Prompt */}
          <div>
            <Label htmlFor="design-studio-pinterest-board-prompt" className="text-[#9CA3AF]">Pinterest Board Generation Prompt</Label>
            <textarea
              id="design-studio-pinterest-board-prompt"
              value={settings.designStudioPinterestBoardPrompt || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('designStudioPinterestBoardPrompt', e.target.value);
              }}
              rows={16}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Prompt used to suggest the most appropriate Pinterest board name for each design post.
            </p>
          </div>

          {/* Default Pinterest Board */}
          <div>
            <Label htmlFor="design-studio-default-pinterest-board" className="text-[#9CA3AF]">Default Pinterest Board</Label>
            <PinterestBoardSelect
              id="design-studio-default-pinterest-board"
              value={settings.designStudioDefaultPinterestBoard || 'Movie Posters'}
              onChange={(value) => {
                updateSetting('designStudioDefaultPinterestBoard', value);
                toast.success('Default Pinterest board updated');
              }}
              placeholder="Movie Posters"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board where design graphics will be published
            </p>
          </div>

          {/* Pinterest Link Strategy */}
          <div>
            <Label htmlFor="design-studio-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={settings.designStudioPinterestLinkStrategy || 'tmdb'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('designStudioPinterestLinkStrategy', value);
                toast.success('Pinterest link strategy updated');
              }}
            >
              <SelectTrigger id="design-studio-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Movie Page
                </SelectItem>
                <SelectItem value="custom" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Custom URL (set per post)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins (auto-generated based on movie/show data)
            </p>
          </div>

          {/* Pinterest Custom Default Link (conditional) */}
          {settings.designStudioPinterestLinkStrategy === 'custom' && (
            <div>
              <Label htmlFor="design-studio-pinterest-default-link" className="text-[#9CA3AF]">Default Custom Link</Label>
              <Input
                id="design-studio-pinterest-default-link"
                value={settings.designStudioPinterestDefaultLink || ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('designStudioPinterestDefaultLink', e.target.value);
                }}
                placeholder="https://screenrender.com"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Fallback URL when custom link is not specified per post
              </p>
            </div>
          )}
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Photopea Integration Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Photopea Integration</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Configure Photopea rendering engine settings
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-preview" className="text-[#9CA3AF]">Auto-Preview Enabled</Label>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Automatically generate live previews while editing
              </p>
            </div>
            <Switch
              id="auto-preview"
              checked={settings.autoPreviewEnabled}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('autoPreviewEnabled', checked);
              }}
            />
          </div>

          <div>
            <Label htmlFor="render-quality" className="text-[#9CA3AF]">Render Quality</Label>
            <Select
              value={settings.renderQuality}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('renderQuality', value);
              }}
            >
              <SelectTrigger id="render-quality" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Faster)</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High (Recommended)</SelectItem>
                <SelectItem value="maximum">Maximum (Slower)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Higher quality = slower rendering but better output
            </p>
          </div>

          <div>
            <Label htmlFor="export-format" className="text-[#9CA3AF]">Export Format</Label>
            <Select
              value={settings.exportFormat}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('exportFormat', value);
              }}
            >
              <SelectTrigger id="export-format" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG (Smaller, Recommended)</SelectItem>
                <SelectItem value="png">PNG (Larger, Transparent)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              JPEG is recommended for social media uploads
            </p>
          </div>

          <div>
            <Label htmlFor="jpeg-quality" className="text-[#9CA3AF]">JPEG Quality</Label>
            <div className="flex gap-3 items-center mt-1">
              <Input
                id="jpeg-quality"
                type="number"
                min="1"
                max="100"
                step="5"
                value={settings.jpegQuality}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('jpegQuality', parseInt(e.target.value));
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap min-w-[100px]">
                {settings.jpegQuality >= 90 ? 'Excellent' : settings.jpegQuality >= 75 ? 'Good' : 'Compressed'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Recommended: 90 — Balance between quality and file size
            </p>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Activity Retention Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Activity Retention</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Hide older design activity items in the page and remove them during backend cleanup after a specified time period
            </p>
          </div>

        <div>
          <Label htmlFor="design-studio-activity-retention" className="text-[#6B7280] dark:text-[#9CA3AF]">Activity Retention (hours)</Label>
          <Input
            id="design-studio-activity-retention"
            type="number"
              value={globalSettings.designStudioActivityRetention || 24}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateGlobalSetting('designStudioActivityRetention', parseInt(e.target.value, 10) || 24);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Older design activity items are hidden in the Design Studio activity page immediately and removed during backend cleanup after this time period (Default: 24 hours)
            </p>
          </div>

          <div>
            <Label htmlFor="design-studio-log-level" className="text-[#6B7280] dark:text-[#9CA3AF]">Log Level</Label>
            <Select
              value={globalSettings.designStudioLogLevel || 'standard'}
              onValueChange={(value) => {
                haptics.light();
                updateGlobalSetting('designStudioLogLevel', value);
              }}
            >
              <SelectTrigger id="design-studio-log-level" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal (Published designs only)</SelectItem>
                <SelectItem value="standard">Standard (Rendered + Published)</SelectItem>
                <SelectItem value="full">Full (All activity)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Controls how much design activity is shown in the Design Studio activity page.
            </p>
          </div>
        </div>

        {/* Reset Button */}
        <div className="pt-4">
          <button
            onClick={() => {
              haptics.medium();
              resetToDefaults();
            }}
            className="w-full px-4 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1A1A1A] active:bg-white dark:active:bg-[#000000] transition-colors"
          >
            Reset to Recommended Settings
          </button>
        </div>
      </div>
    </div>
  );
}
