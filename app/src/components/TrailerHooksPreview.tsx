import { Sparkles, Clock, Film, RotateCcw } from 'lucide-react';
import { TrailerAnalysis, VideoMoment } from '../lib/api/googleVideoIntelligence';
import { Button } from './ui/button';
import { getSceneTypeLabel, getSceneTypeBadgeColor } from '../lib/analysis/sceneClassification';

interface TrailerHooksPreviewProps {
  analysis: TrailerAnalysis;
  onShowAllMoments?: () => void;
  customOpeningHook?: VideoMoment | null;
  customMidVideoHook?: VideoMoment | null;
  customEndingHook?: VideoMoment | null;
  onResetHook?: (hookType: 'opening' | 'midVideo' | 'ending') => void;
}

export function TrailerHooksPreview({ 
  analysis, 
  onShowAllMoments,
  customOpeningHook,
  customMidVideoHook,
  customEndingHook,
  onResetHook
}: TrailerHooksPreviewProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getTypeColor = (type: string): string => {
    const colors: { [key: string]: string} = {
      'action_peak': 'bg-[#ec1e24]',
      'dramatic_dialogue': 'bg-[#ec1e24]',
      'character_moment': 'bg-[#ec1e24]',
      'title_card': 'bg-[#ec1e24]',
      'establishing_shot': 'bg-[#ec1e24]',
      'suspense_moment': 'bg-[#ec1e24]',
      'general': 'bg-[#ec1e24]'
    };
    return colors[type] || 'bg-[#ec1e24]';
  };
  
  // Use custom hooks if available, otherwise use AI suggestions
  const openingHook = customOpeningHook || analysis.suggestedHooks.opening;
  const midVideoHook = customMidVideoHook || analysis.suggestedHooks.midVideo;
  const endingHook = customEndingHook || analysis.suggestedHooks.ending;

  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#ec1e24] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            AI-Selected Hook Scenes
          </h4>
          
          {/* Opening Hook */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#ec1e24]" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Opening Hook</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-[#ec1e24]" />
                <span className="text-xs font-mono text-[#ec1e24]">
                  {formatTime(openingHook.startTime)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${getSceneTypeBadgeColor(openingHook.type as any)} text-xs px-2 py-0.5 rounded font-medium`}>
                {getSceneTypeLabel(openingHook.type as any)}
              </span>
              <span className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded">
                {Math.round(openingHook.confidence * 100)}%
              </span>
              {openingHook.reason && (
                <span className="text-xs text-gray-600 dark:text-gray-400 italic">
                  {openingHook.reason}
                </span>
              )}
            </div>
            
            <div className="relative h-20 bg-gray-900 rounded overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-xs opacity-50">
                  {formatTime(openingHook.startTime)} - {formatTime(openingHook.endTime)}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20"></div>
            </div>
            
            {customOpeningHook && onResetHook && (
              <Button
                onClick={() => onResetHook('opening')}
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-gray-600 hover:text-red-600"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to AI Default
              </Button>
            )}
          </div>
          
          {/* Mid-Video Hook */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#ec1e24]" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Mid-Video Hook</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-[#ec1e24]" />
                <span className="text-xs font-mono text-[#ec1e24]">
                  {formatTime(midVideoHook.startTime)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${getSceneTypeBadgeColor(midVideoHook.type as any)} text-xs px-2 py-0.5 rounded font-medium`}>
                {getSceneTypeLabel(midVideoHook.type as any)}
              </span>
              <span className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded">
                {Math.round(midVideoHook.confidence * 100)}%
              </span>
              {midVideoHook.reason && (
                <span className="text-xs text-gray-600 dark:text-gray-400 italic">
                  {midVideoHook.reason}
                </span>
              )}
            </div>
            
            <div className="relative h-20 bg-gray-900 rounded overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-xs opacity-50">
                  {formatTime(midVideoHook.startTime)} - {formatTime(midVideoHook.endTime)}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 to-red-900/20"></div>
            </div>
            
            {customMidVideoHook && onResetHook && (
              <Button
                onClick={() => onResetHook('midVideo')}
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-gray-600 hover:text-red-600"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to AI Default
              </Button>
            )}
          </div>
          
          {/* Ending Hook */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#ec1e24]" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Ending Hook</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-[#ec1e24]" />
                <span className="text-xs font-mono text-[#ec1e24]">
                  {formatTime(endingHook.startTime)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${getSceneTypeBadgeColor(endingHook.type as any)} text-xs px-2 py-0.5 rounded font-medium`}>
                {getSceneTypeLabel(endingHook.type as any)}
              </span>
              <span className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded">
                {Math.round(endingHook.confidence * 100)}%
              </span>
              {endingHook.reason && (
                <span className="text-xs text-gray-600 dark:text-gray-400 italic">
                  {endingHook.reason}
                </span>
              )}
            </div>
            
            <div className="relative h-20 bg-gray-900 rounded overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-xs opacity-50">
                  {formatTime(endingHook.startTime)} - {formatTime(endingHook.endTime)}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20"></div>
            </div>
            
            {customEndingHook && onResetHook && (
              <Button
                onClick={() => onResetHook('ending')}
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-gray-600 hover:text-red-600"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to AI Default
              </Button>
            )}
          </div>
          
          {onShowAllMoments && (
            <button
              onClick={onShowAllMoments}
              className="text-sm text-[#ec1e24] hover:text-[#c01a1f] hover:underline"
            >
              Browse all {analysis.moments.length} detected scenes →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
