import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { Feed } from './FeedCard';
import { haptics } from '../../utils/haptics';
import { Checkbox } from '../ui/checkbox';

interface FeedEditorProps {
  feed?: Feed | null;
  onSave: (feed: Feed) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

const DEFAULT_FILTERS: Feed['filters'] = {
  scope: 'title_or_body',
  required: [],
  blocked: [],
  onlyFetchNewItems: false,
  startFromNowAt: null,
  maxItemAgeMinutes: null,
};

const ARTICLE_AGE_OPTIONS = [
  { value: 'none', label: 'No age limit' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
  { value: '300', label: '5 hours' },
  { value: '360', label: '6 hours' },
  { value: '420', label: '7 hours' },
  { value: '480', label: '8 hours' },
  { value: '540', label: '9 hours' },
  { value: '600', label: '10 hours' },
  { value: '660', label: '11 hours' },
  { value: '720', label: '12 hours' },
] as const;

function createDefaultFormData(): Partial<Feed> {
  return {
    name: '',
    url: '',
    enabled: true,
    interval: 10,
    imageCount: '2',
    dedupeDays: 30,
    filters: DEFAULT_FILTERS,
    serperPriority: true,
    rehostImages: false,
    platformsEnabled: { x: true, threads: true, facebook: false, pinterest: false },
    autoPost: true,
    status: 'active',
    trickle: 'newest_first',
  } as any;
}

export function FeedEditor({ feed, onSave, onDelete, onClose, isOpen }: FeedEditorProps) {
  const [formData, setFormData] = useState<Partial<Feed>>(createDefaultFormData());

  const [perPlatformImageCount, setPerPlatformImageCount] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const formFilters: Feed['filters'] = {
    ...DEFAULT_FILTERS,
    ...formData.filters,
    required: formData.filters?.required ?? [],
    blocked: formData.filters?.blocked ?? [],
  };

  useEffect(() => {
    if (feed) {
      setFormData({
        ...feed,
        filters: {
          ...DEFAULT_FILTERS,
          ...feed.filters,
          required: feed.filters?.required ?? [],
          blocked: feed.filters?.blocked ?? [],
        },
      });
      setPerPlatformImageCount(!!feed.platformImageCounts);
    } else {
      // Reset to defaults when adding new feed
      setFormData(createDefaultFormData());
      setPerPlatformImageCount(false);
    }
  }, [feed, isOpen]);

  const handleSave = async () => {
    haptics.medium();
    setIsSaving(true);
    try {
      const feedToSave: Feed = {
        id: feed?.id || `feed-${Date.now()}`,
        name: formData.name || '',
        url: formData.url || '',
        enabled: formData.enabled ?? true,
        interval: formData.interval || 10,
        imageCount: formData.imageCount || '2',
        dedupeDays: formData.dedupeDays || 30,
        filters: formFilters,
        serperPriority: formData.serperPriority ?? true,
        rehostImages: formData.rehostImages ?? false,
        platformsEnabled: formData.platformsEnabled || { x: true, threads: true, facebook: false, pinterest: false },
        autoPost: formData.autoPost ?? true,
        status: formData.status || 'active',
        platformImageCounts: perPlatformImageCount ? formData.platformImageCounts : undefined,
        trickle: formData.trickle || 'newest_first',
      };
      await onSave(feedToSave);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const addKeyword = (type: 'required' | 'blocked') => {
    haptics.light();
    const newKeyword = { text: '', matchType: 'contains' as const, caseSensitive: false, active: true };
    setFormData({
      ...formData,
      filters: {
        ...formFilters,
        [type]: [...formFilters[type], newKeyword],
      },
    });
  };

  const removeKeyword = (type: 'required' | 'blocked', index: number) => {
    haptics.light();
    setFormData({
      ...formData,
      filters: {
        ...formFilters,
        [type]: formFilters[type].filter((_, i) => i !== index),
      },
    });
  };

  const updateKeyword = (type: 'required' | 'blocked', index: number, field: string, value: any) => {
    const keywords = [...formFilters[type]];
    keywords[index] = { ...keywords[index], [field]: value };
    setFormData({
      ...formData,
      filters: {
        ...formFilters,
        [type]: keywords,
      },
    });
  };

  const applyPreset = (preset: 'trailers' | 'announcements' | 'studio') => {
    haptics.medium();
    const presets = {
      trailers: [
        { text: 'trailer', matchType: 'contains' as const, caseSensitive: false, active: true },
        { text: 'teaser', matchType: 'contains' as const, caseSensitive: false, active: true },
        { text: 'clip', matchType: 'contains' as const, caseSensitive: false, active: true },
      ],
      announcements: [
        { text: 'announces', matchType: 'contains' as const, caseSensitive: false, active: true },
        { text: 'confirmed', matchType: 'contains' as const, caseSensitive: false, active: true },
      ],
      studio: [
        { text: 'studio', matchType: 'contains' as const, caseSensitive: false, active: true },
        { text: 'production', matchType: 'contains' as const, caseSensitive: false, active: true },
      ],
    };
    setFormData({
      ...formData,
      filters: {
        ...formFilters,
        required: presets[preset],
      },
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      if (!open) {
        haptics.light();
      }
      onClose();
    }}>
      <SheetContent className="w-full sm:max-w-2xl bg-white dark:bg-[#000000] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {feed ? 'Edit Feed' : 'Add New Feed'}
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-[#6B7280]">
            {feed ? 'Modify the feed settings as needed.' : 'Enter the details for the new feed.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Section */}
          <div>
            <h3 className="text-gray-900 dark:text-white mb-4">Basic</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Feed Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    haptics.light();
                    setFormData({ ...formData, name: e.target.value });
                  }}
                  onFocus={() => haptics.light()}
                  placeholder="e.g., Variety - Film News"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Feed URL</Label>
                <Input
                  value={formData.url}
                  onChange={(e) => {
                    haptics.light();
                    setFormData({ ...formData, url: e.target.value });
                  }}
                  onFocus={() => haptics.light()}
                  placeholder="https://example.com/feed"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Polling Interval (minutes)</Label>
                <Select
                  value={formData.interval?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, interval: parseInt(value) })}
                >
                  <SelectTrigger 
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                    onFocus={() => haptics.light()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="2">2 minutes</SelectItem>
                    <SelectItem value="3">3 minutes</SelectItem>
                    <SelectItem value="4">4 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Only fetch new items from now on</Label>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                    Ignore older feed entries and start monitoring from the current time.
                  </p>
                  {feed && formFilters.onlyFetchNewItems ? (
                    <p className="text-xs text-[#ec1e24]">
                      Saving this change skips older backlog items. If you pause and reactivate the feed later, it restarts from that moment.
                    </p>
                  ) : null}
                </div>
                <Switch
                  checked={formFilters.onlyFetchNewItems ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      filters: {
                        ...formFilters,
                        onlyFetchNewItems: checked,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Ignore articles older than</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                  Older items are skipped during polling and any pending backlog older than this window expires instead of publishing later.
                </p>
                <Select
                  value={formFilters.maxItemAgeMinutes ? formFilters.maxItemAgeMinutes.toString() : 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      filters: {
                        ...formFilters,
                        maxItemAgeMinutes: value === 'none' ? null : parseInt(value, 10),
                      },
                    })
                  }
                >
                  <SelectTrigger
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-2"
                    onFocus={() => haptics.light()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTICLE_AGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="bg-gray-200 dark:bg-[#1A1A1A]" />

          {/* Filters & Rules Section */}
          <div>
            <h3 className="text-gray-900 dark:text-white mb-4">Filters & Rules</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Scope</Label>
                <Select
                  value={formFilters.scope}
                  onValueChange={(value: any) => setFormData({
                    ...formData,
                    filters: { ...formFilters, scope: value },
                  })}
                >
                  <SelectTrigger 
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                    onFocus={() => haptics.light()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Title only</SelectItem>
                    <SelectItem value="body">Body only</SelectItem>
                    <SelectItem value="title_or_body">Title OR Body</SelectItem>
                    <SelectItem value="title_and_body">Title AND Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Required Keywords */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Required Keywords (Whitelist)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyword('required')}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formFilters.required.map((keyword, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={keyword.text}
                        onChange={(e) => updateKeyword('required', index, 'text', e.target.value)}
                        onFocus={() => haptics.light()}
                        placeholder="keyword"
                        className="flex-1 bg-white dark:bg-[#000000] text-gray-900 dark:text-white text-sm border-gray-200 dark:border-[#333333]"
                      />
                      <Select
                        value={keyword.matchType}
                        onValueChange={(value) => updateKeyword('required', index, 'matchType', value)}
                      >
                        <SelectTrigger 
                          className="w-28 bg-white dark:bg-[#000000] text-gray-900 dark:text-white text-xs border-gray-200 dark:border-[#333333]"
                          onFocus={() => haptics.light()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyword('required', index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-3 h-3 text-[#EF4444]" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blocked Keywords */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Blocked Keywords (Blacklist)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyword('blocked')}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formFilters.blocked.map((keyword, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={keyword.text}
                        onChange={(e) => updateKeyword('blocked', index, 'text', e.target.value)}
                        onFocus={() => haptics.light()}
                        placeholder="keyword"
                        className="flex-1 bg-white dark:bg-[#000000] text-gray-900 dark:text-white text-sm border-gray-200 dark:border-[#333333]"
                      />
                      <Select
                        value={keyword.matchType}
                        onValueChange={(value) => updateKeyword('blocked', index, 'matchType', value)}
                      >
                        <SelectTrigger 
                          className="w-28 bg-white dark:bg-[#000000] text-gray-900 dark:text-white text-xs border-gray-200 dark:border-[#333333]"
                          onFocus={() => haptics.light()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyword('blocked', index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-3 h-3 text-[#EF4444]" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-gray-200 dark:bg-[#1A1A1A]" />

          {/* Posting Controls */}
          <div>
            <h3 className="text-gray-900 dark:text-white mb-4">Posting Controls</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Default Image Count</Label>
                <Select
                  value={formData.imageCount}
                  onValueChange={(value: any) => setFormData({ ...formData, imageCount: value })}
                >
                  <SelectTrigger 
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                    onFocus={() => haptics.light()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Image</SelectItem>
                    <SelectItem value="2">2 Images</SelectItem>
                    <SelectItem value="3">3 Images</SelectItem>
                    <SelectItem value="random">Random (1-2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Per-Platform Image Count</Label>
                <Checkbox
                  checked={perPlatformImageCount}
                  onCheckedChange={(checked: boolean) => setPerPlatformImageCount(checked)}
                />
              </div>

              {perPlatformImageCount && (
                <div className="pl-4 space-y-3 border-l-2 border-gray-200 dark:border-[#333333]">
                  {['x', 'threads', 'facebook'].map((platform) => (
                    <div key={platform}>
                      <Label className="text-gray-600 dark:text-[#9CA3AF] capitalize text-sm">{platform}</Label>
                      <Select
                        value={formData.platformImageCounts?.[platform as keyof typeof formData.platformImageCounts]?.toString() || '1'}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          platformImageCounts: {
                            ...formData.platformImageCounts,
                            [platform]: parseInt(value),
                          },
                        })}
                      >
                        <SelectTrigger 
                          className="bg-white dark:bg-[#000000] text-gray-900 dark:text-white mt-1 text-sm border-gray-200 dark:border-[#333333]"
                          onFocus={() => haptics.light()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Auto-post</Label>
                <Switch
                  checked={formData.autoPost}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoPost: checked })}
                />
              </div>

              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Deduplication Window (days)</Label>
                <Input
                  type="number"
                  value={formData.dedupeDays}
                  onChange={(e) => setFormData({ ...formData, dedupeDays: parseInt(e.target.value) })}
                  onFocus={() => haptics.light()}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Trickle</Label>
                <Select
                  value={(formData as any).trickle || 'newest_first'}
                  onValueChange={(value) => setFormData({ ...formData, trickle: value } as any)}
                >
                  <SelectTrigger 
                    className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
                    onFocus={() => haptics.light()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest_first">Post Newest Items First</SelectItem>
                    <SelectItem value="oldest_first">Post Oldest Items First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="bg-gray-200 dark:bg-[#1A1A1A]" />

          {/* Advanced */}
          <div>
            <h3 className="text-gray-900 dark:text-white mb-4">Advanced</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Serper Priority</Label>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">Use Serper images first</p>
                </div>
                <Switch
                  checked={formData.serperPriority}
                  onCheckedChange={(checked) => setFormData({ ...formData, serperPriority: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF]">Rehost Images to S3</Label>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">Store images on your server</p>
                </div>
                <Switch
                  checked={formData.rehostImages}
                  onCheckedChange={(checked) => setFormData({ ...formData, rehostImages: checked })}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name || !formData.url}
              className="flex-1 bg-[#ec1e24] hover:bg-[#ec1e24]/90 text-white"
            >
              {isSaving ? 'Saving...' : 'Save Feed'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
