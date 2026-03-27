import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { PinterestBoardSelect } from '../ui/pinterest-board-select';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { AI_MODELS, DEFAULT_MODELS, getModelDisplayName } from '../../lib/ai/models';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';
import { rssPromptDefaults } from '../../config/cultureCravePromptDefaults';
import { BackIconButton } from '../BackIconButton';

interface RssSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function RssSettings({ settings, updateSetting, onBack }: RssSettingsProps) {
  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 flex min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-10 shrink-0 border-b border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 flex items-center gap-3">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">RSS Feeds</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="rss_settings"
          description="Enable AI-powered optimization to automatically improve captions, posting times, and model selection for RSS content based on performance analytics."
        />

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Daily Quotas Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Daily Quotas</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Maximum posts per day for each platform (prevents rate limiting)
            </p>
          </div>

          {/* X/Twitter Quota */}
          <div>
            <Label htmlFor="daily-quota-x" className="text-[#6B7280] dark:text-[#9CA3AF]">X (Twitter)</Label>
            <Select
              value={String(settings.dailyQuotaX ?? 50)}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('dailyQuotaX', Number(value));
              }}
            >
              <SelectTrigger id="daily-quota-x" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/day</SelectItem>
                <SelectItem value="25">25/day</SelectItem>
                <SelectItem value="50">50/day</SelectItem>
                <SelectItem value="100">100/day</SelectItem>
                <SelectItem value="200">200/day</SelectItem>
                <SelectItem value="999999">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Default: 50/day (X free tier limit)
            </p>
          </div>

          {/* Threads Quota */}
          <div>
            <Label htmlFor="daily-quota-threads" className="text-[#6B7280] dark:text-[#9CA3AF]">Threads</Label>
            <Select
              value={String(settings.dailyQuotaThreads ?? 100)}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('dailyQuotaThreads', Number(value));
              }}
            >
              <SelectTrigger id="daily-quota-threads" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/day</SelectItem>
                <SelectItem value="25">25/day</SelectItem>
                <SelectItem value="50">50/day</SelectItem>
                <SelectItem value="100">100/day</SelectItem>
                <SelectItem value="200">200/day</SelectItem>
                <SelectItem value="999999">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Default: 100/day (Meta quota)
            </p>
          </div>

          {/* Facebook Quota */}
          <div>
            <Label htmlFor="daily-quota-facebook" className="text-[#6B7280] dark:text-[#9CA3AF]">Facebook</Label>
            <Select
              value={String(settings.dailyQuotaFacebook ?? 25)}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('dailyQuotaFacebook', Number(value));
              }}
            >
              <SelectTrigger id="daily-quota-facebook" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/day</SelectItem>
                <SelectItem value="25">25/day</SelectItem>
                <SelectItem value="50">50/day</SelectItem>
                <SelectItem value="100">100/day</SelectItem>
                <SelectItem value="200">200/day</SelectItem>
                <SelectItem value="999999">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Default: 25/day (Meta quota)
            </p>
          </div>

          {/* Pinterest Quota */}
          <div>
            <Label htmlFor="daily-quota-pinterest" className="text-[#6B7280] dark:text-[#9CA3AF]">Pinterest</Label>
            <Select
              value={String(settings.dailyQuotaPinterest ?? 100)}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('dailyQuotaPinterest', Number(value));
              }}
            >
              <SelectTrigger id="daily-quota-pinterest" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/day</SelectItem>
                <SelectItem value="25">25/day</SelectItem>
                <SelectItem value="50">50/day</SelectItem>
                <SelectItem value="100">100/day</SelectItem>
                <SelectItem value="200">200/day</SelectItem>
                <SelectItem value="999999">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Default: 100/day (Pinterest recommended limit)
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Quiet Hours Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Quiet Hours</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Prevent posting during specified hours (e.g., midnight to early morning)
            </p>
          </div>

          {/* Quiet Hours Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-[#6B7280] dark:text-[#9CA3AF]">Enable Quiet Hours</Label>
            <Switch
              checked={settings.quietHoursEnabled ?? true}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('quietHoursEnabled', checked);
                toast.info(checked ? 'Quiet hours enabled' : 'Quiet hours disabled');
              }}
            />
          </div>

          {/* Start Time */}
          {(settings.quietHoursEnabled ?? true) && (
            <>
              <div>
                <Label htmlFor="quiet-hours-start" className="text-[#6B7280] dark:text-[#9CA3AF]">Start Time</Label>
                <Select
                  value={String(settings.quietHoursStart ?? 0)}
                  onValueChange={(value) => {
                    haptics.light();
                    updateSetting('quietHoursStart', Number(value));
                  }}
                >
                  <SelectTrigger id="quiet-hours-start" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                  Hour when quiet hours begin (default: 12 AM)
                </p>
              </div>

              {/* End Time */}
              <div>
                <Label htmlFor="quiet-hours-end" className="text-[#6B7280] dark:text-[#9CA3AF]">End Time</Label>
                <Select
                  value={String(settings.quietHoursEnd ?? 7)}
                  onValueChange={(value) => {
                    haptics.light();
                    updateSetting('quietHoursEnd', Number(value));
                  }}
                >
                  <SelectTrigger id="quiet-hours-end" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                  Hour when quiet hours end (default: 7 AM)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Caption Generation Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Caption Generation</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              AI-powered caption generation from RSS article content for social media publishing
            </p>
          </div>

          {/* Caption AI Model */}
          <div>
            <Label htmlFor="rss-caption-model" className="text-[#6B7280] dark:text-[#9CA3AF]">Caption AI Model</Label>
            <Select
              value={settings.rssCaptionModel || DEFAULT_MODELS.rss}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('rssCaptionModel', value);
                toast.success(`AI Model changed to ${getModelDisplayName(value)}`);
              }}
            >
              <SelectTrigger id="rss-caption-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
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
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              GPT-5.4 Mini is the current recommended mini GPT-5 Responses API model for high-quality captions at production scale
            </p>
          </div>

          {/* Caption Creativity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[#6B7280] dark:text-[#9CA3AF]">Caption Creativity (Temperature)</Label>
              <span className="text-sm text-gray-600 dark:text-white">
                {settings.rssCaptionTemperature || 0.7} - Balanced
              </span>
            </div>
            <Slider
              value={[settings.rssCaptionTemperature || 0.7]}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('rssCaptionTemperature', value[0]);
              }}
              min={0}
              max={1}
              step={0.1}
              className="mt-2"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Recommended: 0.7 — Balanced creativity for engaging yet relevant captions
            </p>
          </div>

          {/* Caption Tone */}
          <div>
            <Label htmlFor="rss-caption-tone" className="text-[#6B7280] dark:text-[#9CA3AF]">Caption Tone</Label>
            <Select
              value={settings.rssCaptionTone || 'Engaging'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('rssCaptionTone', value);
              }}
            >
              <SelectTrigger id="rss-caption-tone" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Engaging">Engaging (Recommended)</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Informative">Informative</SelectItem>
                <SelectItem value="Exciting">Exciting</SelectItem>
                <SelectItem value="Mysterious">Mysterious</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Sets the overall tone and style for generated captions
            </p>
          </div>

          {/* Max Caption Length */}
          <div>
            <Label htmlFor="rss-caption-length" className="text-[#6B7280] dark:text-[#9CA3AF]">Max Caption Length (Characters)</Label>
            <Input
              id="rss-caption-length"
              type="number"
              value={settings.rssCaptionMaxLength || 280}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('rssCaptionMaxLength', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              280 for X/Twitter compatibility, 2200 for Instagram, 63,206 for Facebook
            </p>
          </div>

          {/* Caption Generation Prompt */}
          <div>
            <Label htmlFor="rss-caption-prompt" className="text-[#6B7280] dark:text-[#9CA3AF]">Caption Generation Prompt</Label>
            <textarea
              id="rss-caption-prompt"
              value={settings.rssCaptionPrompt || rssPromptDefaults.rssCaptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('rssCaptionPrompt', e.target.value);
              }}
              rows={16}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Instructions for generating captions from RSS article content
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Pinterest Publishing Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Pinterest Publishing Settings</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for RSS articles.
            </p>
          </div>

          {/* Pinterest Title Generation Prompt */}
          <div>
            <Label htmlFor="rss-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="rss-pinterest-title-prompt"
              value={settings.rssPinterestTitlePrompt || rssPromptDefaults.rssPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('rssPinterestTitlePrompt', e.target.value);
              }}
              rows={22}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters for entertainment news
            </p>
          </div>

          {/* Pinterest Description Generation Prompt */}
          <div>
            <Label htmlFor="rss-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="rss-pinterest-description-prompt"
              value={settings.rssPinterestDescriptionPrompt || `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for entertainment news articles.

INPUT: RSS article title, description, content excerpt
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Topic, key details
- Include relevant keywords naturally throughout
- Include relevant keywords naturally throughout
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Key details (2-3 sentences)
3. Source/publication mention
4. CTA (Read more, Learn more, etc.)

Example:
"Warner Bros confirms Dune 3 is happening! 🎬 Director Denis Villeneuve will return to complete the epic trilogy based on Frank Herbert's novels. Production expected to begin in 2026. Stay tuned for casting and release date announcements.

Read the full story! 📰"

Guidelines:
- Extract most newsworthy element for opening
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Use emojis strategically (1-2 max)
- Make first sentence compelling and complete
- Link to full article for traffic

Tone: Engaging, informative, news-focused, optimized for entertainment fans on Pinterest`}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('rssPinterestDescriptionPrompt', e.target.value);
              }}
              rows={32}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with front-loaded hooks for news articles
            </p>
          </div>

          {/* Pinterest Board Selection */}
          <div>
            <Label htmlFor="rss-pinterest-board" className="text-[#9CA3AF]">Default Pinterest Board</Label>
            <PinterestBoardSelect
              id="rss-pinterest-board"
              value={settings.rssPinterestBoard || 'Entertainment News'}
              onChange={(value) => {
                haptics.light();
                updateSetting('rssPinterestBoard', value);
                toast.success('Pinterest board updated');
              }}
              placeholder="Entertainment News"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name where RSS articles will be published (must match existing Pinterest board)
            </p>
          </div>

          {/* Pinterest Link Strategy */}
          <div>
            <Label htmlFor="rss-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={settings.rssPinterestLinkStrategy || 'article'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('rssPinterestLinkStrategy', value);
                toast.success('Pinterest link strategy updated');
              }}
            >
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="article" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  RSS Article URL (Original Source)
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render News Page
                </SelectItem>
                <SelectItem value="custom" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Custom URL (set per post)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins (auto-generated from RSS article)
            </p>
          </div>

          {/* Pinterest Custom Default Link (conditional) */}
          {settings.rssPinterestLinkStrategy === 'custom' && (
            <div>
              <Label htmlFor="rss-pinterest-default-link" className="text-[#9CA3AF]">Default Custom Link</Label>
              <Input
                id="rss-pinterest-default-link"
                value={settings.rssPinterestDefaultLink || ''}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('rssPinterestDefaultLink', e.target.value);
                }}
                placeholder="https://screenrender.com/news"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Fallback URL when custom link is not specified per post
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* Activity Retention Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Activity Retention</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Hide older RSS activity items in the page and remove them during backend cleanup after a specified time period
            </p>
          </div>

          <div>
            <Label htmlFor="rss-activity-retention" className="text-[#6B7280] dark:text-[#9CA3AF]">Activity Retention (hours)</Label>
            <Input
              id="rss-activity-retention"
              type="number"
              value={settings.rssActivityRetention || 24}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('rssActivityRetention', parseInt(e.target.value, 10) || 24);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              RSS activity items older than this are hidden in the RSS activity page immediately and removed during backend cleanup (Default: 24 hours)
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        <div>
          <Label className="text-[#6B7280] dark:text-[#9CA3AF]">Log Level</Label>
          <Select
            value={settings.rssLogLevel}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('rssLogLevel', value);
            }}
          >
            <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Minimal (Errors only)</SelectItem>
              <SelectItem value="standard">Standard (Success + Failures)</SelectItem>
              <SelectItem value="full">Full (All entries + Status)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
