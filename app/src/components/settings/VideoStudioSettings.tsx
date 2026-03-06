import { useState, useEffect } from 'react';
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
import { AI_MODELS, getModelDisplayName } from '../../lib/ai/models';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';

interface VideoStudioSettingsProps {
  onSave?: () => void;
  onBack: () => void;
}

// Default prompt system settings
const defaultSettings = {
  // Video Generation Model Selection
  openaiModel: 'gpt-4o',

  // Video Generation Operational Settings
  temperature: 0,
  topP: 0.95,
  maxTokens: 4096,

  // Video Generation System Prompt
  systemPrompt: `You are an editor-prompt generator. Input: validated job JSON (segments, timestamps, audio_rules, caption_template, aspect). Output: (1) a Shotstack natural-language prompt that contains exact timestamps, audio ducking rules, caption template reference, and aspect directives; (2) a JSON validation summary with keys: segments_count, missing_fields, warnings. Strictly produce the Shotstack prompt in the field "shotstack_prompt_text" and do not add extra commentary. Follow the structured output schema exactly.`,

  // Response Settings
  useStructuredOutput: true,
  validateTimestamps: true,
  autoRetryOnMismatch: true,
  previewBeforeRender: true,

  // Caption Generation Settings
  captionOpenaiModel: 'gpt-4o',
  captionTemperature: 0.7,
  captionMaxTokens: 500,

  // Section-Specific Caption Prompts
  captionReviewPrompt: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for review-driven content about movies or TV shows.

INPUT: Voiceover transcript from a review video
OUTPUT: Review-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if mentioned), and review details from the voiceover
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on the review perspective and insights
- Make it compelling and authentic`,

  captionReleasesPrompt: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for upcoming or newly released titles for the month.

INPUT: Voiceover transcript about monthly releases
OUTPUT: Release-focused caption (120-250 characters)

Guidelines:
- Based on the voiceover, capture the excitement of new releases
- Keep it short: 120-250 characters
- NO emojis
- Sometimes include a call to action to watch the video (vary the phrasing)
- Use line breaks for readability when necessary
- Match the tone of the release slate (blockbusters, Oscar season, holiday films, etc.)
- Examples of style:
  * "We are ending this year with a bang, so join us as we run, sing and dance our way through the final films of 2025!"
  * "November officially kicks off the holiday movie rush — that time when family blockbusters share screens with Oscar hopefuls, and prestige dramas expand from festival chatter to mainstream buzz. Checkout the video to know what movies are coming out."
  * "If you've been wondering what movies are coming out in November 2025, you're in for a packed month. This slate brings fantasy spectacles, animated sequels, and big-budget dramas, balanced by intimate arthouse and international fare."`,

  captionScenesPrompt: `You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for scene-based clips cut from movies or shows.

INPUT: Voiceover transcript from a specific scene
OUTPUT: Scene-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if applicable), and scene details pertaining to that scene
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on what makes this particular scene compelling
- Capture the emotion, drama, or significance of the moment`,

  captionIncludeEmojis: true,
  captionIncludeHashtags: true,
  captionMaxLength: 280,
  captionTone: 'engaging', // engaging, professional, casual, hype

  // Pinterest Publishing Settings
  videoStudioPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for video content (reviews, releases, scenes).

INPUT: Video type (review/releases/scenes), movie/TV title, content context
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + Video Type/Context
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Batman (2025) - Movie Review | DC Comics Analysis"
- "November 2025 Movie Releases - Complete Guide | What to Watch"
- "Inception Dream Scene - Christopher Nolan | Best Movie Moments"
- "Stranger Things Season 5 Review | Netflix Series Analysis"

Guidelines:
- Identify the video content type clearly
- Include year/season for searchability when relevant
- Use " | " separator for clarity
- Prioritize search terms users would type
- Focus on video value proposition

Tone: Clear, searchable, content-focused, optimized for Pinterest discovery`,

  videoStudioPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for video content.

INPUT: Video type, movie/TV title, content summary, voiceover transcript
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Title, video type, hook
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Video content summary (2-3 sentences)
3. Key details (cast, insights, highlights)
4. Hashtags (3-5 relevant tags)
5. CTA (Watch now, Get insights, etc.)

Example:
"In-depth review of The Batman (2025)! 🎬 Our analysis covers Robert Pattinson's performance, Matt Reeves' direction, and why this is the darkest Batman yet. Deep dive into cinematography, story choices, and what it means for DC's future. #TheBatman #MovieReview #DCComics #FilmAnalysis #ScreenRender

Watch the full review now! 🦇"

Guidelines:
- Describe the video content value prominently
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Include searchable hashtags (video type + content)
- Make first sentence compelling and complete
- Appeal to film enthusiasts and casual viewers

Tone: Engaging, insightful, value-focused, optimized for Pinterest users seeking entertainment content`,

  videoStudioPinterestBoardPrompt: `You are a Pinterest board strategist for Screen Render. Suggest the most appropriate Pinterest board name for video content.

INPUT: Video type (review/releases/scenes), movie/TV title, genre, context
OUTPUT: Pinterest board name (maximum 50 characters)

Board Selection Guidelines:
- Match content type to board purpose
- Consider existing Screen Render boards
- Optimize for discoverability
- Keep names clear and searchable

Suggested Boards by Video Type:
- Movie Reviews → "Movie Reviews & Film Analysis"
- TV Reviews → "TV Show Reviews & Series Analysis"
- Monthly Releases → "New Movies & TV Shows"
- Scene Clips → "Best Movie & TV Scenes"
- Trailer Analysis → "Movie Trailers & Previews"
- General Video → "Film & TV Video Content"

Output Format:
Return only the board name, nothing else. Maximum 50 characters.

Examples:
- "Movie Reviews & Film Analysis"
- "TV Show Reviews & Series Analysis"
- "New Movies & TV Shows"
- "Best Movie & TV Scenes"

Tone: Clear, category-focused, SEO-friendly`,
};

function getGlobalVideoStudioSettings(globalSettings: Record<string, any>) {
  return Object.keys(defaultSettings).reduce<Record<string, any>>((accumulator, key) => {
    if (globalSettings[key] !== undefined) {
      accumulator[key] = globalSettings[key];
    }
    return accumulator;
  }, {});
}

export function VideoStudioSettings({ onSave, onBack }: VideoStudioSettingsProps) {
  const { settings: globalSettings, updateSetting: updateGlobalSetting } = useSettings();
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('screndly_video_studio_settings');
    const sharedSettings = getGlobalVideoStudioSettings(globalSettings as Record<string, any>);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...sharedSettings, ...parsed });
      } catch (error) {
        console.error('Error loading Video Studio settings:', error);
        setSettings({ ...defaultSettings, ...sharedSettings });
      }
    } else {
      setSettings({ ...defaultSettings, ...sharedSettings });
    }
    setIsLoaded(true);
  }, [globalSettings]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('screndly_video_studio_settings', JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    updateGlobalSetting(key, value);

    // Show toast notifications for important settings
    if (key === 'openaiModel') {
      toast.success(`Video AI Model changed to ${getModelDisplayName(value)}`);
    }

    if (key === 'captionOpenaiModel') {
      toast.success(`Caption AI Model changed to ${getModelDisplayName(value)}`);
    }

    if (key === 'temperature') {
      toast.success(`Video Temperature set to ${value} (${value === 0 ? 'Deterministic' : 'Creative'})`);
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

    if (onSave) {
      setTimeout(onSave, 100);
    }
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    Object.entries(defaultSettings).forEach(([key, value]) => {
      updateGlobalSetting(key, value);
    });
    toast.success('Reset to recommended settings');
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <button
          className="text-gray-900 dark:text-white p-1"
          onClick={() => {
            haptics.light();
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-gray-900 dark:text-white text-xl">Video Studio</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="video_studio_settings"
          description="Enable AI-powered optimization to automatically improve captions and model selection for video content based on performance analytics."
        />

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* AI Model Selection */}
        <div className="space-y-4">
          <h3 className="text-gray-900 dark:text-white">AI Model Selection</h3>

          <div>
            <Label htmlFor="openai-model" className="text-[#9CA3AF]">Generate LLM Prompt AI Model</Label>
            <Select
              value={settings.openaiModel}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('openaiModel', value);
              }}
            >
              <SelectTrigger id="openai-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
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
              GPT-4o provides best accuracy for JSON→Shotstack translation. Use GPT-4o-mini for high-volume batch processing.
            </p>
          </div>
        </div>

        {/* Operational Settings */}
        <div className="space-y-4">
          {/* Temperature */}
          <div>
            <Label htmlFor="temperature" className="text-[#9CA3AF]">Temperature</Label>
            <div className="flex gap-3 items-center mt-1">
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('temperature', parseFloat(e.target.value));
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
              />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap min-w-[100px]">
                {settings.temperature === 0 ? 'Deterministic' : settings.temperature < 0.5 ? 'Low Creative' : settings.temperature < 1 ? 'Moderate' : 'High Creative'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Recommended: 0 — Deterministic output, avoids creative rephrasing
            </p>
          </div>

          {/* Top P */}
          <div>
            <Label htmlFor="top-p" className="text-[#9CA3AF]">Top P (Nucleus Sampling)</Label>
            <Input
              id="top-p"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={settings.topP}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('topP', parseFloat(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Recommended: 0.95 — Controls diversity of token selection
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <Label htmlFor="max-tokens" className="text-[#9CA3AF]">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              min="512"
              max="8192"
              step="256"
              value={settings.maxTokens}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('maxTokens', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Allocate 1.5-2× your JSON length. Typical: 2048-4096 tokens
            </p>
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-4">
          <h3 className="text-gray-900 dark:text-white">System Prompt</h3>

          <div>
            <Label htmlFor="system-prompt" className="text-[#9CA3AF]">Instruction Prompt</Label>
            <Textarea
              id="system-prompt"
              value={settings.systemPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('systemPrompt', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs"
              placeholder="Enter system prompt for the AI model..."
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Strict instruction-following role that enforces format/keywords for JSON→Shotstack translation
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
              Model used to generate social media captions from voiceover transcripts
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
            <h3 className="text-gray-900 dark:text-white">Section-Specific Caption Prompts</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Customize caption generation prompts for different content types
            </p>
          </div>

          <div>
            <Label htmlFor="caption-review-prompt" className="text-[#9CA3AF]">Review Caption Prompt</Label>
            <Textarea
              id="caption-review-prompt"
              value={settings.captionReviewPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('captionReviewPrompt', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs"
              placeholder="Enter caption prompt for review content..."
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Prompt used for generating captions for review-driven content
            </p>
          </div>

          <div>
            <Label htmlFor="caption-releases-prompt" className="text-[#9CA3AF]">Releases Caption Prompt</Label>
            <Textarea
              id="caption-releases-prompt"
              value={settings.captionReleasesPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('captionReleasesPrompt', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs"
              placeholder="Enter caption prompt for monthly releases..."
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Prompt used for generating captions for upcoming or newly released titles
            </p>
          </div>

          <div>
            <Label htmlFor="caption-scenes-prompt" className="text-[#9CA3AF]">Scenes Caption Prompt</Label>
            <Textarea
              id="caption-scenes-prompt"
              value={settings.captionScenesPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('captionScenesPrompt', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs"
              placeholder="Enter caption prompt for scene-based content..."
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Prompt used for generating captions for specific scene clips
            </p>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

        {/* Pinterest Publishing Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Pinterest Publishing Settings</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for video content.
            </p>
          </div>

          {/* Pinterest Title Generation Prompt */}
          <div>
            <Label htmlFor="video-studio-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="video-studio-pinterest-title-prompt"
              value={settings.videoStudioPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoStudioPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters with video-focused keywords
            </p>
          </div>

          {/* Pinterest Description Generation Prompt */}
          <div>
            <Label htmlFor="video-studio-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="video-studio-pinterest-description-prompt"
              value={settings.videoStudioPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoStudioPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with content-value hooks and video hashtags
            </p>
          </div>

          {/* Default Pinterest Board */}
          <div>
            <Label htmlFor="video-studio-default-pinterest-board" className="text-[#9CA3AF]">Default Pinterest Board</Label>
            <PinterestBoardSelect
              id="video-studio-default-pinterest-board"
              value={settings.videoStudioDefaultPinterestBoard || 'Movie Trailers'}
              onChange={(value) => {
                updateSetting('videoStudioDefaultPinterestBoard', value);
                toast.success('Default Pinterest board updated');
              }}
              placeholder="Movie Trailers"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board where video content will be published
            </p>
          </div>

          {/* Pinterest Link Strategy */}
          <div>
            <Label htmlFor="video-studio-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={settings.videoStudioPinterestLinkStrategy || 'youtube'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('videoStudioPinterestLinkStrategy', value);
                toast.success('Pinterest link strategy updated');
              }}
            >
              <SelectTrigger id="video-studio-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="youtube" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  YouTube Video URL
                </SelectItem>
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
              Default link destination for Pinterest pins (auto-generated based on video content)
            </p>
          </div>

          {/* Pinterest Custom Default Link (conditional) */}
          {settings.videoStudioPinterestLinkStrategy === 'custom' && (
            <div>
              <Label htmlFor="video-studio-pinterest-default-link" className="text-[#9CA3AF]">Default Custom Link</Label>
              <Input
                id="video-studio-pinterest-default-link"
                value={settings.videoStudioPinterestDefaultLink || ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('videoStudioPinterestDefaultLink', e.target.value);
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

        {/* Activity Retention Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white">Activity Retention</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Automatically remove completed and failed video generation activity items after a specified time period
            </p>
          </div>

          <div>
            <Label htmlFor="video-studio-activity-retention" className="text-[#6B7280] dark:text-[#9CA3AF]">Activity Retention (hours)</Label>
            <Input
              id="video-studio-activity-retention"
              type="number"
              value={globalSettings.videoStudioActivityRetention || 24}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateGlobalSetting('videoStudioActivityRetention', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Completed and failed video generation items will be automatically removed after this time period (Default: 24 hours)
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
