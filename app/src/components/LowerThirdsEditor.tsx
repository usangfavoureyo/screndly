import { useState, useEffect } from 'react';
import { Type, Clock, MapPin, Trash2, Plus, Eye, EyeOff, Sparkles, Zap } from 'lucide-react';
import { haptics } from '../utils/haptics';

export interface LowerThirdItem {
  id: string;
  title: string;
  releaseDate: string;
  timestamp: number; // seconds when it should appear
  duration: number; // how long to show (default 3.5s)
  enabled: boolean;
}

interface LowerThirdsEditorProps {
  items: LowerThirdItem[];
  aspectRatio: '16:9' | '9:16' | '1:1';
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onItemsChange: (items: LowerThirdItem[]) => void;
  onPositionChange: (position: 'bottom-left' | 'bottom-center' | 'mid-bottom-center') => void;
  position: 'bottom-left' | 'bottom-center' | 'mid-bottom-center';
  voiceoverDuration?: number;
}

export function LowerThirdsEditor({
  items,
  aspectRatio,
  enabled,
  onToggle,
  onItemsChange,
  onPositionChange,
  position,
  voiceoverDuration = 0,
}: LowerThirdsEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [preventFocus, setPreventFocus] = useState(false);

  // Prevent auto-focus when component expands
  useEffect(() => {
    if (enabled) {
      setPreventFocus(true);
      // Blur any focused element immediately
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // Reset after 300ms
      const timer = setTimeout(() => {
        setPreventFocus(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  const addItem = () => {
    haptics.light();
    const newItem: LowerThirdItem = {
      id: Date.now().toString(),
      title: '',
      releaseDate: '',
      timestamp: 0,
      duration: 3.5,
      enabled: true,
    };
    onItemsChange([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<LowerThirdItem>) => {
    onItemsChange(
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteItem = (id: string) => {
    haptics.light();
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const getPositionForAspectRatio = () => {
    if (aspectRatio === '16:9') return 'bottom-left';
    if (aspectRatio === '9:16') return 'mid-bottom-center';
    return 'bottom-center';
  };

  const recommendedPosition = getPositionForAspectRatio();

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ec1e24]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#ec1e24]" />
          </div>
          <div>
            <h3 className="text-black dark:text-white">Lower Thirds</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Animated title overlays for each release
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            haptics.light();
            onToggle(!enabled);
          }}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-[#ec1e24]' : 'bg-gray-300 dark:bg-[#333333]'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Position Selector */}
          <div>
            <label className="text-sm text-black dark:text-white mb-2 block">
              Position <span className="text-[#6B7280] dark:text-[#9CA3AF]">(optimized for {aspectRatio})</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  haptics.light();
                  onPositionChange('bottom-left');
                }}
                className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  position === 'bottom-left'
                    ? 'bg-[#ec1e24] text-white'
                    : 'bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:border-[#ec1e24]'
                }`}
              >
                Bottom Left
                {recommendedPosition === 'bottom-left' && (
                  <span className="ml-1 text-xs">✨</span>
                )}
              </button>
              <button
                onClick={() => {
                  haptics.light();
                  onPositionChange('bottom-center');
                }}
                className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  position === 'bottom-center'
                    ? 'bg-[#ec1e24] text-white'
                    : 'bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:border-[#ec1e24]'
                }`}
              >
                Bottom Center
                {recommendedPosition === 'bottom-center' && (
                  <span className="ml-1 text-xs">✨</span>
                )}
              </button>
              <button
                onClick={() => {
                  haptics.light();
                  onPositionChange('mid-bottom-center');
                }}
                className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  position === 'mid-bottom-center'
                    ? 'bg-[#ec1e24] text-white'
                    : 'bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:border-[#ec1e24]'
                }`}
              >
                Mid-Bottom
                {recommendedPosition === 'mid-bottom-center' && (
                  <span className="ml-1 text-xs">✨</span>
                )}
              </button>
            </div>
          </div>

          {/* Lower Third Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-black dark:text-white">
                Title Cards
                <span className="ml-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  {items.filter((i) => i.enabled).length} active
                </span>
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:border-[#ec1e24] hover:text-[#ec1e24] transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-8 bg-gray-50 dark:bg-[#0A0A0A] border border-dashed border-gray-300 dark:border-[#333333] rounded-xl text-center">
                <Zap className="w-8 h-8 text-gray-400 dark:text-[#6B7280] mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-3">
                  No lower thirds yet
                </p>
                <button
                  onClick={addItem}
                  className="px-4 py-2 bg-[#ec1e24] text-white rounded-lg hover:bg-[#d11a20] transition-colors"
                >
                  Create First Card
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 bg-white dark:bg-black border rounded-xl transition-all duration-200 ${
                      item.enabled
                        ? 'border-gray-200 dark:border-[#333333]'
                        : 'border-gray-200 dark:border-[#333333] opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => {
                          haptics.light();
                          updateItem(item.id, { enabled: !item.enabled });
                        }}
                        className="mt-1 flex-shrink-0"
                      >
                        {item.enabled ? (
                          <Eye className="w-4 h-4 text-[#ec1e24]" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400 dark:text-[#6B7280]" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        {/* Title */}
                        <div>
                          <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 flex items-center gap-1">
                            <Type className="w-3 h-3" />
                            Movie/Show Title
                          </label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                            onFocus={(e) => haptics.light()}
                            placeholder="e.g., Sinners"
                            autoFocus={false}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929]"
                          />
                        </div>

                        {/* Release Date */}
                        <div>
                          <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Release Date
                          </label>
                          <input
                            type="text"
                            value={item.releaseDate}
                            onChange={(e) =>
                              updateItem(item.id, { releaseDate: e.target.value })
                            }
                            onFocus={(e) => haptics.light()}
                            placeholder="e.g., April 13 or In Theaters April 13"
                            autoFocus={false}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929]"
                          />
                        </div>

                        {/* Timestamp and Duration */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Show at
                            </label>
                            <input
                              type="number"
                              value={item.timestamp}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  timestamp: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              step="0.1"
                              min="0"
                              max={voiceoverDuration || 999}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-[#ec1e24]"
                            />
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                              {formatTimestamp(item.timestamp)}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">
                              Duration (s)
                            </label>
                            <input
                              type="number"
                              value={item.duration}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  duration: Math.max(0.5, parseFloat(e.target.value) || 3.5),
                                })
                              }
                              step="0.5"
                              min="0.5"
                              max="10"
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-[#ec1e24]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="mt-1 flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-[#0A0A0A] rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 dark:text-[#6B7280] hover:text-red-600 dark:hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Style Preview */}
          <div>
            <label className="text-sm text-black dark:text-white mb-2 block">
              Preview
            </label>
            <div className="p-6 bg-gray-900 dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-[#333333] relative overflow-hidden">
              {/* Aspect Ratio Frame */}
              <div
                className={`mx-auto bg-gray-800 dark:bg-black relative overflow-hidden ${
                  aspectRatio === '16:9'
                    ? 'w-full h-0 pb-[56.25%]'
                    : aspectRatio === '9:16'
                    ? 'w-[40%] h-0 pb-[177.78%]'
                    : 'w-[60%] h-0 pb-[100%]'
                }`}
              >
                {/* Sample Lower Third */}
                <div
                  className={`absolute ${
                    position === 'bottom-left'
                      ? 'bottom-[8%] left-[5%]'
                      : position === 'bottom-center'
                      ? 'bottom-[8%] left-1/2 -translate-x-1/2'
                      : 'bottom-[22%] left-1/2 -translate-x-1/2'
                  }`}
                >
                  <div className="relative">
                    {/* Red accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ec1e24] rounded-l-lg" />
                    
                    {/* Content */}
                    <div className="pl-4 pr-6 py-3 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div className="space-y-1">
                        <div className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">
                          {items.length > 0 && items[0].title
                            ? items[0].title
                            : 'Movie Title'}
                        </div>
                        <div className="text-gray-300 text-[10px] sm:text-xs whitespace-nowrap">
                          {items.length > 0 && items[0].releaseDate
                            ? items[0].releaseDate
                            : 'In Theaters April 13'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Aspect Ratio Label */}
              <div className="mt-3 text-center text-xs text-gray-500 dark:text-[#6B7280]">
                {aspectRatio} Preview
              </div>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100 mb-1">
                <strong>Pro Tip:</strong> Sync with voiceover
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Set timestamps to match when each movie is mentioned in your voiceover for perfect synchronization.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}