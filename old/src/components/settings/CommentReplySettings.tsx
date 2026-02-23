import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { AI_MODELS, getModelDisplayName } from '../../lib/ai/models';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';

interface CommentReplySettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function CommentReplySettings({ settings, updateSetting, onBack }: CommentReplySettingsProps) {
  // Defensive defaults for platform blacklist settings
  const defaultBlacklist = {
    active: false,
    usernames: '',
    keywords: '',
    noEmojiOnly: false,
    noLinks: false,
    pauseOldPosts: false,
    pauseAfterHours: '24',
  };

  const xBlacklist = settings.xCommentBlacklist || defaultBlacklist;
  const threadsBlacklist = settings.threadsCommentBlacklist || defaultBlacklist;
  const facebookBlacklist = settings.facebookCommentBlacklist || defaultBlacklist;
  const instagramBlacklist = settings.instagramCommentBlacklist || defaultBlacklist;
  const youtubeBlacklist = settings.youtubeCommentBlacklist || defaultBlacklist;
  const tiktokBlacklist = settings.tiktokCommentBlacklist || defaultBlacklist;
  const pinterestBlacklist = settings.pinterestCommentBlacklist || defaultBlacklist;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-4 z-10">
        <button
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2"
          onClick={() => {
            haptics.light();
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl text-gray-900 dark:text-white">Comment Automation</h2>
      </div>

      <div className="p-6 space-y-4">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="comment_automation_settings"
          description="Enable AI-powered optimization to automatically improve comment reply generation based on engagement analytics."
        />

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        <div>
          <Label className="text-[#9CA3AF]">Reply Frequency</Label>
          <Select
            value={settings.commentReplyFrequency}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('commentReplyFrequency', value);
            }}
          >
            <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant</SelectItem>
              <SelectItem value="5min">5 minutes</SelectItem>
              <SelectItem value="15min">15 minutes</SelectItem>
              <SelectItem value="30min">30 minutes</SelectItem>
              <SelectItem value="1hr">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[#9CA3AF]">Usage Throttle</Label>
            <span className="text-xs text-gray-500 dark:text-[#6B7280] capitalize">{settings.commentThrottle}</span>
          </div>
          {/* Throttle indicator bar */}
          <div className="flex gap-1 h-2">
            <div className={`flex-1 rounded-full transition-all ${settings.commentThrottle === 'low' || settings.commentThrottle === 'medium' || settings.commentThrottle === 'high'
              ? 'bg-[#ec1e24]'
              : 'bg-gray-200 dark:bg-[#1A1A1A]'
              }`} />
            <div className={`flex-1 rounded-full transition-all ${settings.commentThrottle === 'medium' || settings.commentThrottle === 'high'
              ? 'bg-[#ec1e24]'
              : 'bg-gray-200 dark:bg-[#1A1A1A]'
              }`} />
            <div className={`flex-1 rounded-full transition-all ${settings.commentThrottle === 'high'
              ? 'bg-[#ec1e24]'
              : 'bg-gray-200 dark:bg-[#1A1A1A]'
              }`} />
          </div>
          <div className="flex justify-between mt-1">
            <button
              onClick={() => {
                haptics.light();
                updateSetting('commentThrottle', 'low');
              }}
              className="text-xs text-gray-500 dark:text-[#6B7280] hover:text-[#ec1e24]"
            >
              Low
            </button>
            <button
              onClick={() => {
                haptics.light();
                updateSetting('commentThrottle', 'medium');
              }}
              className="text-xs text-gray-500 dark:text-[#6B7280] hover:text-[#ec1e24]"
            >
              Medium
            </button>
            <button
              onClick={() => {
                haptics.light();
                updateSetting('commentThrottle', 'high');
              }}
              className="text-xs text-gray-500 dark:text-[#6B7280] hover:text-[#ec1e24]"
            >
              High
            </button>
          </div>
        </div>

        {/* AI Model Selection */}
        <div>
          <Label htmlFor="comment-reply-model" className="text-[#9CA3AF]">Comment Reply AI Model</Label>
          <Select
            value={settings.commentReplyModel || 'gpt-4o-mini'}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('commentReplyModel', value);
              toast.success(`AI Model changed to ${getModelDisplayName(value)}`);
            }}
          >
            <SelectTrigger id="comment-reply-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
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
            AI model used for generating automated comment replies
          </p>
        </div>

        {/* X Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">X (Twitter) Settings</Label>
            <Switch
              checked={xBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('xCommentBlacklist', { ...xBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={xBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('xCommentBlacklist', { ...xBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={xBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('xCommentBlacklist', { ...xBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={xBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('xCommentBlacklist', { ...xBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={xBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('xCommentBlacklist', { ...xBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={xBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('xCommentBlacklist', { ...xBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {xBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={xBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('xCommentBlacklist', { ...xBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Threads Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">Threads Settings</Label>
            <Switch
              checked={threadsBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={threadsBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={threadsBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={threadsBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={threadsBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={threadsBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {threadsBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={threadsBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('threadsCommentBlacklist', { ...threadsBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Facebook Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">Facebook Settings</Label>
            <Switch
              checked={facebookBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={facebookBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={facebookBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={facebookBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={facebookBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={facebookBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {facebookBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={facebookBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('facebookCommentBlacklist', { ...facebookBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Instagram Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">Instagram Settings</Label>
            <Switch
              checked={instagramBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={instagramBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={instagramBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={instagramBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={instagramBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={instagramBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {instagramBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={instagramBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('instagramCommentBlacklist', { ...instagramBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* YouTube Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">YouTube Settings</Label>
            <Switch
              checked={youtubeBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={youtubeBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={youtubeBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={youtubeBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={youtubeBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={youtubeBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {youtubeBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={youtubeBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('youtubeCommentBlacklist', { ...youtubeBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* TikTok Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">TikTok Settings</Label>
            <Switch
              checked={tiktokBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={tiktokBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={tiktokBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={tiktokBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={tiktokBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={tiktokBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {tiktokBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={tiktokBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('tiktokCommentBlacklist', { ...tiktokBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Pinterest Platform Settings */}
        <div className="pt-4 border-t border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[#9CA3AF]">Pinterest Settings</Label>
            <Switch
              checked={pinterestBlacklist.active}
              onCheckedChange={(checked) => {
                haptics.light();
                updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, active: checked });
              }}
            />
          </div>
          <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-[#1F1F1F]">
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Usernames</Label>
              <Textarea
                value={pinterestBlacklist.usernames}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, usernames: e.target.value });
                }}
                placeholder="spam_user, troll_account"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Blacklist Keywords</Label>
              <Textarea
                value={pinterestBlacklist.keywords}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, keywords: e.target.value });
                }}
                placeholder="spam, badword"
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to emoji-only comments</span>
              <Switch
                checked={pinterestBlacklist.noEmojiOnly}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, noEmojiOnly: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Do not reply to comments containing links</span>
              <Switch
                checked={pinterestBlacklist.noLinks}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, noLinks: checked });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Pause replies on older posts</span>
              <Switch
                checked={pinterestBlacklist.pauseOldPosts}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, pauseOldPosts: checked });
                }}
              />
            </div>
            {pinterestBlacklist.pauseOldPosts && (
              <div>
                <Label className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pause replies for posts older than (hours)</Label>
                <Input
                  type="number"
                  value={pinterestBlacklist.pauseAfterHours}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    updateSetting('pinterestCommentBlacklist', { ...pinterestBlacklist, pauseAfterHours: e.target.value });
                  }}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333] my-4"></div>

        {/* Comment Activity Retention */}
        <div className="space-y-4">
          <div>
            <h4 className="text-gray-900 dark:text-white mb-1">Comment Activity Retention</h4>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
              Control how long comment reply history is stored
            </p>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Comment History Retention (hours)</Label>
            <Input
              type="number"
              value={settings.commentRetention || '168'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('commentRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Automatically remove comment reply history older than this period (Default: 168 hours / 7 days)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
