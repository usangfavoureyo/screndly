import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { TrailerAnalysis, VideoMoment } from '../lib/api/googleVideoIntelligence';
import { Clock, Tag, Zap, Volume2, Activity } from 'lucide-react';
import { useState } from 'react';
import { getSceneTypeLabel, getSceneTypeBadgeColor } from '../lib/analysis/sceneClassification';

interface TrailerScenesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: TrailerAnalysis;
  onSelectScene?: (moment: VideoMoment, hookType: 'opening' | 'midVideo' | 'ending') => void;
}

export function TrailerScenesDialog({ open, onOpenChange, analysis, onSelectScene }: TrailerScenesDialogProps) {
  const [pendingSelections, setPendingSelections] = useState<{
    opening?: VideoMoment;
    midVideo?: VideoMoment;
    ending?: VideoMoment;
  }>({});
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
    const colors: { [key: string]: string } = {
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

  const getIntensityLabel = (score: number): string => {
    if (score >= 0.8) return 'Very High';
    if (score >= 0.6) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  const getIntensityColor = (score: number): string => {
    if (score >= 0.8) return 'text-[#ec1e24]';
    if (score >= 0.6) return 'text-[#ec1e24]';
    if (score >= 0.4) return 'text-[#ec1e24]';
    return 'text-[#ec1e24]';
  };

  const handleSelectHook = (moment: VideoMoment, hookType: 'opening' | 'midVideo' | 'ending') => {
    setPendingSelections(prev => {
      // Check if this moment is already selected for this hook type (toggle off)
      if (prev[hookType]?.index === moment.index) {
        const newSelections = { ...prev };
        delete newSelections[hookType];
        return newSelections;
      }
      
      // Check if this moment is already selected for a different hook type
      const isSelectedElsewhere = Object.entries(prev).some(
        ([key, value]) => key !== hookType && value?.index === moment.index
      );
      
      // Don't allow selecting the same scene for multiple hooks
      if (isSelectedElsewhere) {
        return prev;
      }
      
      // Select the hook
      return {
        ...prev,
        [hookType]: moment
      };
    });
  };

  const handleSave = () => {
    if (onSelectScene) {
      if (pendingSelections.opening) {
        onSelectScene(pendingSelections.opening, 'opening');
      }
      if (pendingSelections.midVideo) {
        onSelectScene(pendingSelections.midVideo, 'midVideo');
      }
      if (pendingSelections.ending) {
        onSelectScene(pendingSelections.ending, 'ending');
      }
    }
    setPendingSelections({});
    onOpenChange(false);
  };

  const handleCancel = () => {
    setPendingSelections({});
    onOpenChange(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={handleCancel} heightMode="full">
      <BottomSheetHeader>
        <BottomSheetTitle className="text-lg sm:text-xl">All Detected Scenes</BottomSheetTitle>
        <BottomSheetDescription className="text-xs sm:text-sm text-gray-600 dark:text-[#9CA3AF]">
          Browse {analysis.moments.length} scenes detected by AI. Select hooks and click Save.
        </BottomSheetDescription>
      </BottomSheetHeader>
      
      <BottomSheetBody>
        <div className="space-y-4 pb-4" data-scrollable>
          {analysis.moments.map((moment, index) => {
            const isOpeningHook = moment.index === analysis.suggestedHooks.opening.index;
            const isMidHook = moment.index === analysis.suggestedHooks.midVideo.index;
            const isEndingHook = moment.index === analysis.suggestedHooks.ending.index;
            const isSelectedHook = isOpeningHook || isMidHook || isEndingHook;
            
            // Check if this moment is in pending selections
            const isPendingOpening = pendingSelections.opening?.index === moment.index;
            const isPendingMid = pendingSelections.midVideo?.index === moment.index;
            const isPendingEnding = pendingSelections.ending?.index === moment.index;
            const hasPendingSelection = isPendingOpening || isPendingMid || isPendingEnding;
            
            // Check if this scene is assigned to any hook (to disable other buttons)
            const assignedToOpening = pendingSelections.opening?.index === moment.index;
            const assignedToMid = pendingSelections.midVideo?.index === moment.index;
            const assignedToEnding = pendingSelections.ending?.index === moment.index;
            const isAssignedToAnyHook = assignedToOpening || assignedToMid || assignedToEnding;
            
            return (
              <div
                key={index}
                className={`p-3 sm:p-4 rounded-lg border transition-all ${
                  hasPendingSelection
                    ? 'border-[#ec1e24] bg-red-50 dark:bg-[#000000] dark:border-[#ec1e24]'
                    : isSelectedHook 
                    ? 'border-[#ec1e24] bg-red-50 dark:bg-[#000000] dark:border-[#ec1e24]' 
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                }`}
              >
                {/* Mobile Layout: Stack vertically */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  {/* Scene Number & Thumbnail */}
                  <div className="flex-shrink-0 w-full sm:w-auto">
                    <div className="w-full sm:w-32 h-24 sm:h-20 bg-gray-900 rounded overflow-hidden relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-xs opacity-50">
                          Scene {index + 1}
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-gray-900/50"></div>
                      {(isSelectedHook || hasPendingSelection) && (
                        <div className={`absolute top-1 right-1 text-white text-xs px-2 py-0.5 rounded ${
                          hasPendingSelection ? 'bg-[#ec1e24]' : 'bg-[#ec1e24]'
                        }`}>
                          {(isPendingOpening || isOpeningHook) && 'Opening'}
                          {(isPendingMid || isMidHook) && 'Mid'}
                          {(isPendingEnding || isEndingHook) && 'Ending'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Scene Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Time and Intensity - Stack on mobile */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <span className="font-mono text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          {formatTime(moment.startTime)} - {formatTime(moment.endTime)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({moment.duration.toFixed(1)}s)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <span className={`text-xs sm:text-sm font-medium ${getIntensityColor(moment.intensityScore)}`}>
                          {getIntensityLabel(moment.intensityScore)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Type Badge with Confidence */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${getSceneTypeBadgeColor(moment.type as any)} text-xs px-2 py-1 rounded whitespace-nowrap font-medium`}>
                        {getSceneTypeLabel(moment.type as any)}
                      </span>
                      <span className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded whitespace-nowrap">
                        {Math.round(moment.confidence * 100)}% confident
                      </span>
                      {moment.hasDialogue && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-1">
                          <Volume2 className="w-3 h-3" />
                          Speech
                        </span>
                      )}
                    </div>
                    
                    {/* Audio Features (if available) */}
                    {moment.audioFeatures && (
                      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Volume2 className="w-3 h-3" />
                          <span>Vol: {Math.round(moment.audioFeatures.avgVolume * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          <span>Range: {Math.round(moment.audioFeatures.dynamicRange * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Volume2 className="w-3 h-3" />
                          <span>Speech: {Math.round(moment.audioFeatures.speechProbability * 100)}%</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Labels */}
                    {moment.labels && moment.labels.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {moment.labels.map((label, i) => (
                            <span key={i} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1a1a1a] px-2 py-0.5 rounded">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons - Stack on mobile, horizontal on desktop */}
                    {onSelectScene && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1 sm:flex-wrap">
                        <button
                          onClick={() => handleSelectHook(moment, 'opening')}
                          disabled={isAssignedToAnyHook && !isPendingOpening}
                          className={`text-xs border px-3 py-2 rounded transition-colors whitespace-nowrap text-center sm:flex-1 ${
                            isPendingOpening
                              ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#d11a20]'
                              : isAssignedToAnyHook
                              ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-white dark:bg-black border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 active:bg-gray-100 dark:active:bg-gray-800'
                          }`}
                        >
                          {isPendingOpening ? '✓ Opening Hook (click to unselect)' : 'Use as Opening Hook'}
                        </button>
                        <button
                          onClick={() => handleSelectHook(moment, 'midVideo')}
                          disabled={isAssignedToAnyHook && !isPendingMid}
                          className={`text-xs border px-3 py-2 rounded transition-colors whitespace-nowrap text-center sm:flex-1 ${
                            isPendingMid
                              ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#d11a20]'
                              : isAssignedToAnyHook
                              ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-white dark:bg-black border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 active:bg-gray-100 dark:active:bg-gray-800'
                          }`}
                        >
                          {isPendingMid ? '✓ Mid Hook (click to unselect)' : 'Use as Mid Hook'}
                        </button>
                        <button
                          onClick={() => handleSelectHook(moment, 'ending')}
                          disabled={isAssignedToAnyHook && !isPendingEnding}
                          className={`text-xs border px-3 py-2 rounded transition-colors whitespace-nowrap text-center sm:flex-1 ${
                            isPendingEnding
                              ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#d11a20]'
                              : isAssignedToAnyHook
                              ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-white dark:bg-black border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 active:bg-gray-100 dark:active:bg-gray-800'
                          }`}
                        >
                          {isPendingEnding ? '✓ End Hook (click to unselect)' : 'Use as End Hook'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheetBody>
      
      <BottomSheetFooter className="flex-shrink-0 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-black rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={Object.keys(pendingSelections).length === 0}
          className="px-4 py-2 text-sm bg-[#ec1e24] text-white rounded hover:bg-[#ec1e24] active:bg-[#ec1e24] transition-colors disabled:bg-[#ec1e24] disabled:cursor-not-allowed"
        >
          Save Hooks
        </button>
      </BottomSheetFooter>
    </BottomSheet>
  );
}